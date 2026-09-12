import { lerp, saturate } from '@meltgl/common'
import type { FrameInfo, Size } from '@meltgl/common'
import { resolveMaterial } from '@meltgl/displacement-engine'
import type { Material } from '@meltgl/displacement-engine'
import { SvgMeltFilter } from '@meltgl/filter-system'
import type { SvgMeltFilterOptions } from '@meltgl/filter-system'
import type { GraphicsSource } from '@meltgl/source-graphics'
import type { MeltConfig } from './options.js'
import type { MeltRenderer } from './renderer.js'

export interface SvgRendererOptions {
  target: HTMLElement
  source: GraphicsSource
  config: MeltConfig
  duration: number
}

type Room = Pick<SvgMeltFilterOptions, 'dripRoom' | 'topRoom' | 'sideRoom'>

const PIXEL_RATIO_CAP = 2
const VISCOSITY_FLOOR = -3
const VISCOSITY_DECADES = 4.7
const SAG_RUNNY = 0.45
const SAG_STIFF = 0.06
const BLUR_LOOSE = 0.004
const BLUR_TAUT = 0.014
const PINCH_LOOSE = 2.5
const PINCH_TAUT = 12
const LATERAL_LOOSE = 0.14
const LATERAL_TAUT = 0.04
const COLUMNS_PER_NOISE_SCALE = 1
const DEFAULT_NOISE_SCALE = 4
const DEFAULT_SEED = 11

const readRoom = (config: MeltConfig, current: Room): Room => ({
  dripRoom: config.dripRoom ?? current.dripRoom,
  topRoom: config.topRoom ?? current.topRoom,
  sideRoom: config.sideRoom ?? current.sideRoom,
})

const sameRoom = (a: Room, b: Room): boolean =>
  a.dripRoom === b.dripRoom && a.topRoom === b.topRoom && a.sideRoom === b.sideRoom

export class SvgRenderer implements MeltRenderer {
  readonly backend = 'svg'
  readonly dynamic: boolean
  readonly settled = true

  private readonly target: HTMLElement
  private readonly source: GraphicsSource
  private readonly duration: number
  private readonly layer: HTMLDivElement
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D | null
  private readonly observer: ResizeObserver | null
  private filter: SvgMeltFilter
  private material: Material
  private noiseScale: number
  private seed: number
  private room: Room
  private scratch: HTMLCanvasElement | null = null
  private box: Size | null = null
  private progress = 0
  private restorePosition: string | null = null
  private restoreOverflow: string | null = null
  private mounted = false
  private disposed = false

  constructor(options: SvgRendererOptions) {
    this.target = options.target
    this.source = options.source
    this.dynamic = options.source.dynamic
    this.duration = Math.max(0.01, options.duration)
    this.material = resolveMaterial(options.config.layers?.[0]?.material ?? options.config.material)
    this.noiseScale = options.config.noiseScale ?? DEFAULT_NOISE_SCALE
    this.seed = options.config.seed ?? DEFAULT_SEED
    this.room = readRoom(options.config, {})

    this.layer = document.createElement('div')
    this.layer.setAttribute('data-meltgl', 'svg-melt')
    this.layer.style.position = 'absolute'
    this.layer.style.left = '0'
    this.layer.style.top = '0'
    this.layer.style.width = '100%'
    this.layer.style.height = '100%'
    this.layer.style.display = 'block'
    this.layer.style.overflow = 'visible'
    this.layer.style.pointerEvents = 'none'
    this.layer.style.zIndex = '1'

    this.canvas = document.createElement('canvas')
    this.canvas.style.display = 'block'
    this.canvas.style.position = 'absolute'
    this.canvas.style.left = '0'
    this.canvas.style.top = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.layer.append(this.canvas)

    this.context = this.canvas.getContext('2d')
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.layout())
    this.filter = this.build()
  }

  async prepare(): Promise<void> {
    await this.source.load()
    if (this.disposed) return
    const computed = getComputedStyle(this.target)
    if (computed.position === 'static') {
      this.restorePosition = this.target.style.position
      this.target.style.position = 'relative'
    }
    if (computed.overflow !== 'visible') {
      this.restoreOverflow = this.target.style.overflow
      this.target.style.overflow = 'visible'
    }
    this.target.append(this.layer)
    this.filter.mount(this.filterHost())
    this.layer.style.filter = this.filter.cssValue
    this.mounted = true
    this.layout()
    this.observer?.observe(this.target)
  }

  seek(time: number): void {
    this.progress = saturate(time / this.duration)
    this.filter.setProgress(this.progress)
  }

  draw(_frame: FrameInfo, _progress: number): void {
    if (!this.mounted || !this.dynamic) return
    this.paint()
  }

  configure(config: MeltConfig): void {
    const material = config.material !== undefined || config.layers !== undefined
    if (material) this.material = resolveMaterial(config.layers?.[0]?.material ?? config.material)
    if (config.noiseScale !== undefined) this.noiseScale = config.noiseScale
    if (config.seed !== undefined) this.seed = config.seed
    const room = readRoom(config, this.room)
    const moved = !sameRoom(room, this.room)
    this.room = room
    if (!material && config.noiseScale === undefined && config.seed === undefined && !moved) return

    const previous = this.filter
    this.filter = this.build()
    this.filter.setProgress(this.progress)
    if (this.mounted) {
      this.filter.mount(this.filterHost())
      this.layer.style.filter = this.filter.cssValue
    }
    previous.dispose()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mounted = false
    this.observer?.disconnect()
    this.layer.style.filter = ''
    this.layer.remove()
    this.filter.dispose()
    this.source.dispose()
    this.scratch = null
    if (this.restorePosition !== null) {
      this.target.style.position = this.restorePosition
      this.restorePosition = null
    }
    if (this.restoreOverflow !== null) {
      this.target.style.overflow = this.restoreOverflow
      this.restoreOverflow = null
    }
  }

  private build(): SvgMeltFilter {
    const mobility = Math.max(1e-6, this.material.viscosity / this.material.density)
    const stiffness = saturate((Math.log10(mobility) - VISCOSITY_FLOOR) / VISCOSITY_DECADES)
    const tension = saturate(this.material.tension)
    return new SvgMeltFilter({
      seed: this.seed,
      sag: lerp(SAG_RUNNY, SAG_STIFF, stiffness),
      lateral: lerp(LATERAL_LOOSE, LATERAL_TAUT, tension),
      columns: this.noiseScale * COLUMNS_PER_NOISE_SCALE,
      blur: lerp(BLUR_LOOSE, BLUR_TAUT, tension),
      pinch: lerp(PINCH_LOOSE, PINCH_TAUT, tension),
      box: this.box ?? undefined,
      ...this.room,
    })
  }

  private filterHost(): ParentNode {
    const root = this.target.getRootNode()
    return root instanceof ShadowRoot ? root : document.body
  }

  private layout(): void {
    if (!this.mounted) return
    const rect = this.layer.getBoundingClientRect()
    const width = rect.width || this.target.clientWidth
    const height = rect.height || this.target.clientHeight
    if (width <= 0 || height <= 0) return
    this.box = { width, height }
    const ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP)
    const pixels = {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    }
    if (this.canvas.width !== pixels.width || this.canvas.height !== pixels.height) {
      this.canvas.width = pixels.width
      this.canvas.height = pixels.height
    }
    this.filter.setBox(this.box)
    this.paint()
  }

  private paint(): void {
    const context = this.context
    const frame = this.source.frame()
    if (!context || !frame) return
    const { width, height } = this.canvas
    if (width === 0 || height === 0) return
    context.clearRect(0, 0, width, height)
    const drawable = this.toDrawable(frame)
    if (!drawable) return
    const sourceWidth = this.source.width > 0 ? this.source.width : width
    const sourceHeight = this.source.height > 0 ? this.source.height : height
    const scale = Math.min(width / sourceWidth, height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    context.drawImage(drawable, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  }

  private toDrawable(frame: TexImageSource): CanvasImageSource | null {
    if (!(frame instanceof ImageData)) return frame
    const scratch = this.scratch ?? document.createElement('canvas')
    this.scratch = scratch
    if (scratch.width !== frame.width || scratch.height !== frame.height) {
      scratch.width = frame.width
      scratch.height = frame.height
    }
    const context = scratch.getContext('2d')
    if (!context) return null
    context.putImageData(frame, 0, 0)
    return scratch
  }
}
