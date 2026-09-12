import { Emitter } from '@meltgl/common'
import type { Disposable, FrameInfo } from '@meltgl/common'

export interface ClockEvents extends Record<string, unknown> {
  tick: FrameInfo
  start: undefined
  stop: undefined
}

export interface ClockOptions {
  maxDelta?: number
  timeScale?: number
  pauseWhenHidden?: boolean
}

export interface Ticker extends Emitter<ClockEvents> {
  readonly running: boolean
  start(): void
  stop(): void
}

export class Clock extends Emitter<ClockEvents> implements Ticker, Disposable {
  timeScale: number

  private handle = 0
  private last = 0
  private frame = 0
  private elapsed = 0
  private active = false
  private resumeWhenVisible = false
  private readonly maxDelta: number
  private readonly pauseWhenHidden: boolean

  constructor(options: ClockOptions = {}) {
    super()
    this.maxDelta = options.maxDelta ?? 1 / 15
    this.timeScale = options.timeScale ?? 1
    this.pauseWhenHidden = options.pauseWhenHidden ?? true
    if (this.pauseWhenHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange)
    }
  }

  get running(): boolean {
    return this.active
  }

  get time(): number {
    return this.elapsed
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.last = performance.now()
    this.handle = requestAnimationFrame(this.loop)
    this.emit('start', undefined)
  }

  stop(): void {
    this.resumeWhenVisible = false
    if (!this.active) return
    this.active = false
    cancelAnimationFrame(this.handle)
    this.handle = 0
    this.emit('stop', undefined)
  }

  dispose(): void {
    this.stop()
    if (this.pauseWhenHidden && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange)
    }
    this.clear()
  }

  private readonly loop = (now: number): void => {
    if (!this.active) return
    this.handle = requestAnimationFrame(this.loop)
    const delta = Math.min((now - this.last) / 1000, this.maxDelta) * this.timeScale
    this.last = now
    this.elapsed += delta
    this.frame += 1
    this.emit('tick', { time: this.elapsed, delta, frame: this.frame })
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      const wasRunning = this.active
      this.stop()
      this.resumeWhenVisible = wasRunning
      return
    }
    if (!this.resumeWhenVisible) return
    this.resumeWhenVisible = false
    this.start()
  }
}
