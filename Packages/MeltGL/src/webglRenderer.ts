import { MeltError } from '@meltgl/common'
import type { Disposable, FrameInfo } from '@meltgl/common'
import { MeltSimulation } from '@meltgl/displacement-engine'
import type { SimulationOptions } from '@meltgl/displacement-engine'
import { ElementHost } from '@meltgl/element-host'
import { FilterChain } from '@meltgl/filter-system'
import type { FilterDefinition } from '@meltgl/filter-system'
import { RenderPipeline, RenderTarget, Texture } from '@meltgl/render-pipeline'
import { FLOAT_TARGET_EXTENSIONS, RenderSurface } from '@meltgl/render-surface'
import { estimateKey } from '@meltgl/source-graphics'
import type { GraphicsSource, KeyColour } from '@meltgl/source-graphics'
import type { KeyMode, MeltConfig } from './options.js'
import type { MeltRenderer } from './renderer.js'

export interface WebglRendererOptions {
  target: HTMLElement
  source: GraphicsSource
  key: KeyMode
  simulation: Partial<SimulationOptions>
  filters: readonly FilterDefinition[]
  maxPixelRatio: number
  maxStepsPerFrame: number
  onContextLost?: () => void
}

interface MemberLayout {
  readonly rect: readonly [number, number, number, number]
  readonly key: KeyColour | null
  readonly texture: Texture
}

const TAINTED_SOURCE = 'the source is cross-origin and was not loaded with crossOrigin="anonymous"'

interface WebglResources {
  readonly surface: RenderSurface
  readonly simulation: MeltSimulation
  readonly texture: Texture
  readonly host: ElementHost
  readonly filters: FilterChain
  readonly pipeline: RenderPipeline
  readonly offscreen: RenderTarget
}

const createResources = (options: WebglRendererOptions): WebglResources => {
  const surface = new RenderSurface({ maxPixelRatio: options.maxPixelRatio })
  const { capabilities, gl } = surface
  const floatRenderable = capabilities.colorBufferFloat || capabilities.colorBufferHalfFloat
  if (!floatRenderable) {
    surface.dispose()
    throw new MeltError(
      'context-unavailable',
      `webgl2 cannot render to float targets, the melt simulation needs ${FLOAT_TARGET_EXTENSIONS}`,
    )
  }
  const built: Disposable[] = [surface]
  try {
    const simulation = new MeltSimulation(gl, options.simulation, floatRenderable)
    built.push(simulation)
    const texture = new Texture(gl, { flipY: true, premultiply: true })
    built.push(texture)
    const host = new ElementHost({ target: options.target, surface })
    built.push(host)
    const filters = new FilterChain(gl)
    built.push(filters)
    const pipeline = new RenderPipeline(surface)
    built.push(pipeline)
    for (const definition of options.filters) pipeline.add(filters.add(definition))
    const offscreen = new RenderTarget(gl, 1, 1)
    return { surface, simulation, texture, host, filters, pipeline, offscreen }
  } catch (error) {
    for (const resource of built.reverse()) resource.dispose()
    throw error
  }
}

export class WebglRenderer implements MeltRenderer {
  readonly backend = 'webgl2'
  readonly dynamic: boolean
  readonly host: ElementHost
  readonly simulation: MeltSimulation

  private readonly surface: RenderSurface
  private readonly source: GraphicsSource
  private readonly texture: Texture
  private readonly filters: FilterChain
  private readonly pipeline: RenderPipeline
  private readonly offscreen: RenderTarget
  private readonly keyMode: KeyMode
  private readonly maxStepsPerFrame: number
  private key: KeyColour | null = null
  private members: MemberLayout | null = null
  private caughtUp = true
  private prepared = false
  private disposed = false

  constructor(options: WebglRendererOptions) {
    const resources = createResources(options)
    this.surface = resources.surface
    this.simulation = resources.simulation
    this.texture = resources.texture
    this.host = resources.host
    this.filters = resources.filters
    this.pipeline = resources.pipeline
    this.offscreen = resources.offscreen
    this.source = options.source
    this.keyMode = options.key
    this.maxStepsPerFrame = options.maxStepsPerFrame
    this.dynamic = options.source.dynamic
    this.host.on('resize', () => this.layout())
    const { onContextLost } = options
    if (onContextLost) this.surface.on('contextlost', () => onContextLost())
  }

  get settled(): boolean {
    return this.caughtUp
  }

  async prepare(): Promise<void> {
    await this.source.load()
    this.upload()
    this.key = this.resolveKey()
    this.applyRoom()
    this.host.mount()
    this.layout()
    this.prepared = true
  }

  seek(time: number): void {
    if (!this.prepared || this.surface.lost) return
    this.caughtUp = this.simulation.seek(time, this.maxStepsPerFrame)
  }

  draw(frame: FrameInfo, progress: number): void {
    if (!this.prepared || this.surface.lost) return
    if (this.dynamic) {
      this.upload()
      this.simulation.refreshOrigin()
    }

    const { gl } = this.surface
    gl.disable(gl.DEPTH_TEST)

    if (this.pipeline.length === 0) {
      this.surface.bindDefault()
      this.surface.clearTo()
      this.simulation.render()
      return
    }

    this.offscreen.bind()
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.simulation.render()
    this.surface.bindDefault()
    this.surface.clearTo()
    this.pipeline.render(this.offscreen.texture, frame, progress)
  }

  configure(config: MeltConfig): void {
    this.simulation.configure(config)
    this.applyRoom()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pipeline.dispose()
    this.filters.dispose()
    this.offscreen.dispose()
    this.simulation.dispose()
    this.texture.dispose()
    this.source.dispose()
    this.host.dispose()
  }

  private applyRoom(): void {
    const { dripRoom, topRoom, sideRoom } = this.simulation.settings
    const { width, height } = this.host.size
    const next = { bottom: height * dripRoom, top: height * topRoom, sides: width * sideRoom }
    const current = this.host.room
    if (next.bottom === current.bottom && next.top === current.top && next.sides === current.sides) return
    this.host.setExtents(next)
  }

  private resolveKey(): KeyColour | null {
    if (this.keyMode === 'none') return null
    if (this.keyMode !== 'auto') return this.keyMode
    const frame = this.source.frame()
    return frame ? estimateKey(frame) : null
  }

  private upload(): void {
    const frame = this.source.frame()
    if (!frame || this.source.width === 0 || this.source.height === 0) return
    try {
      this.texture.upload(frame, this.source.width, this.source.height)
    } catch {
      throw new MeltError('source-unavailable', TAINTED_SOURCE)
    }
  }

  private layout(): void {
    const { width, height } = this.surface.drawingBufferSize
    if (width === 0 || height === 0) return
    const box = this.host.size
    const canvas = this.host.canvasSize
    const room = this.host.room
    if (canvas.width === 0 || canvas.height === 0) return

    const rect: readonly [number, number, number, number] = [
      room.sides / canvas.width,
      room.bottom / canvas.height,
      box.width / canvas.width,
      box.height / canvas.height,
    ]

    this.offscreen.resize(width, height)
    this.pipeline.resize(width, height)
    this.simulation.resize(width, height)

    const previous = this.members
    if (
      previous &&
      previous.texture === this.texture &&
      previous.key === this.key &&
      previous.rect[0] === rect[0] &&
      previous.rect[1] === rect[1] &&
      previous.rect[2] === rect[2] &&
      previous.rect[3] === rect[3]
    ) {
      return
    }

    this.members = { rect, key: this.key, texture: this.texture }
    this.simulation.setMembers([{ texture: this.texture, rect, key: this.key }])
  }
}
