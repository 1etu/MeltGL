import { Emitter, assert, clamp } from '@meltgl/common'
import type { Disposable, Size } from '@meltgl/common'
import { probeCapabilities } from './capabilities.js'
import type { Capabilities } from './capabilities.js'

export interface RenderSurfaceOptions {
  canvas?: HTMLCanvasElement
  alpha?: boolean
  premultipliedAlpha?: boolean
  antialias?: boolean
  preserveDrawingBuffer?: boolean
  maxPixelRatio?: number
}

export interface SurfaceEvents extends Record<string, unknown> {
  resize: Size
  contextlost: undefined
}

export class RenderSurface extends Emitter<SurfaceEvents> implements Disposable {
  readonly canvas: HTMLCanvasElement
  readonly gl: WebGL2RenderingContext
  readonly capabilities: Capabilities

  private width = 0
  private height = 0
  private pixelRatio = 1
  private readonly maxPixelRatio: number
  private contextLost = false
  private disposed = false

  constructor(options: RenderSurfaceOptions = {}) {
    super()
    this.canvas = options.canvas ?? document.createElement('canvas')
    this.maxPixelRatio = options.maxPixelRatio ?? 2

    const gl = this.canvas.getContext('webgl2', {
      alpha: options.alpha ?? true,
      premultipliedAlpha: options.premultipliedAlpha ?? true,
      antialias: options.antialias ?? false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    assert(gl, 'context-unavailable', 'webgl2 is not available on this canvas')

    this.gl = gl
    this.capabilities = probeCapabilities(gl)
    this.canvas.addEventListener('webglcontextlost', this.onContextLost)
  }

  get size(): Size {
    return { width: this.width, height: this.height }
  }

  get drawingBufferSize(): Size {
    return { width: this.canvas.width, height: this.canvas.height }
  }

  get ratio(): number {
    return this.pixelRatio
  }

  get lost(): boolean {
    return this.contextLost || this.gl.isContextLost()
  }

  resize(width: number, height: number, pixelRatio = window.devicePixelRatio || 1): void {
    const ratio = clamp(pixelRatio, 1, this.maxPixelRatio)
    const max = this.capabilities.maxTextureSize
    const pixelWidth = Math.min(Math.max(1, Math.round(width * ratio)), max)
    const pixelHeight = Math.min(Math.max(1, Math.round(height * ratio)), max)

    this.width = width
    this.height = height
    this.pixelRatio = ratio

    if (this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) return

    this.canvas.width = pixelWidth
    this.canvas.height = pixelHeight
    this.emit('resize', { width: pixelWidth, height: pixelHeight })
  }

  bindDefault(): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  clearTo(r = 0, g = 0, b = 0, a = 0): void {
    const { gl } = this
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.clear()
  }

  private readonly onContextLost = (): void => {
    this.contextLost = true
    this.emit('contextlost', undefined)
  }
}
