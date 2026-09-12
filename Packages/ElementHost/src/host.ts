import { Emitter } from '@meltgl/common'
import type { Disposable, Size } from '@meltgl/common'
import { RenderSurface } from '@meltgl/render-surface'

export interface HostExtents {
  readonly bottom: number
  readonly top: number
  readonly sides: number
}

export interface ElementHostOptions {
  target: HTMLElement
  surface?: RenderSurface
  zIndex?: number
  extents?: Partial<HostExtents>
}

export interface HostEvents extends Record<string, unknown> {
  resize: Size
}

const NONE: HostExtents = { bottom: 0, top: 0, sides: 0 }

export class ElementHost extends Emitter<HostEvents> implements Disposable {
  readonly target: HTMLElement
  readonly surface: RenderSurface

  private readonly observer: ResizeObserver
  private restorePosition: string | null = null
  private restoreOverflow: string | null = null
  private extents: HostExtents
  private mounted = false
  private lastBox: Size = { width: 0, height: 0 }
  private lastCanvas: Size = { width: 0, height: 0 }
  private lastPixels: Size = { width: 0, height: 0 }

  constructor(options: ElementHostOptions) {
    super()
    this.target = options.target
    this.surface = options.surface ?? new RenderSurface()
    this.extents = { ...NONE, ...options.extents }

    const canvas = this.surface.canvas
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = String(options.zIndex ?? 1)

    this.observer = new ResizeObserver(() => this.sync())
  }

  get size(): Size {
    const rect = this.target.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  get room(): HostExtents {
    return this.extents
  }

  get canvasSize(): Size {
    const { width, height } = this.size
    return {
      width: width + this.extents.sides * 2,
      height: height + this.extents.top + this.extents.bottom,
    }
  }

  get bounds(): DOMRect {
    return this.target.getBoundingClientRect()
  }

  setExtents(extents: Partial<HostExtents>): void {
    this.extents = {
      bottom: Math.max(0, extents.bottom ?? this.extents.bottom),
      top: Math.max(0, extents.top ?? this.extents.top),
      sides: Math.max(0, extents.sides ?? this.extents.sides),
    }
    this.sync()
  }

  mount(): void {
    if (this.mounted) return
    this.mounted = true
    const computed = getComputedStyle(this.target)
    if (computed.position === 'static') {
      this.restorePosition = this.target.style.position
      this.target.style.position = 'relative'
    }
    if (computed.overflow !== 'visible') {
      this.restoreOverflow = this.target.style.overflow
      this.target.style.overflow = 'visible'
    }
    this.target.append(this.surface.canvas)
    this.observer.observe(this.target)
    this.sync()
  }

  unmount(): void {
    if (!this.mounted) return
    this.mounted = false
    this.observer.unobserve(this.target)
    this.surface.canvas.remove()
    if (this.restorePosition !== null) {
      this.target.style.position = this.restorePosition
      this.restorePosition = null
    }
    if (this.restoreOverflow !== null) {
      this.target.style.overflow = this.restoreOverflow
      this.restoreOverflow = null
    }
  }

  dispose(): void {
    this.unmount()
    this.observer.disconnect()
    this.surface.dispose()
    this.clear()
  }

  private sync(): void {
    const box = this.size
    const { width, height } = this.canvasSize
    if (width === 0 || height === 0) return
    const canvas = this.surface.canvas
    canvas.style.left = `${-this.extents.sides}px`
    canvas.style.top = `${-this.extents.top}px`
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    this.surface.resize(width, height)
    const pixels = this.surface.drawingBufferSize
    const unchanged =
      box.width === this.lastBox.width &&
      box.height === this.lastBox.height &&
      width === this.lastCanvas.width &&
      height === this.lastCanvas.height &&
      pixels.width === this.lastPixels.width &&
      pixels.height === this.lastPixels.height
    if (unchanged) return
    this.lastBox = box
    this.lastCanvas = { width, height }
    this.lastPixels = pixels
    this.emit('resize', { width, height })
  }
}
