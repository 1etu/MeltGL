import { Emitter, resolveEasing, saturate } from '@meltgl/common'
import type { Disposable, EasingFunction, EasingName, Unsubscribe } from '@meltgl/common'
import type { Ticker } from '@meltgl/animation-clock'

export type MeltState = 'idle' | 'melting' | 'melted' | 'reforming'

export interface TransitionOptions {
  duration?: number
  easing?: EasingName | EasingFunction
  loop?: boolean
}

export interface TransitionEvents extends Record<string, unknown> {
  change: { progress: number; eased: number; state: MeltState }
  statechange: MeltState
  complete: MeltState
}

export class TransitionController extends Emitter<TransitionEvents> implements Disposable {
  duration: number

  private easing: EasingFunction
  private readonly loop: boolean
  private raw = 0
  private direction: 1 | -1 = 1
  private current: MeltState = 'idle'
  private active = false
  private detach: Unsubscribe | null = null

  constructor(options: TransitionOptions = {}) {
    super()
    this.duration = options.duration ?? 1.4
    this.easing = resolveEasing(options.easing ?? 'easeInOutCubic')
    this.loop = options.loop ?? false
  }

  get progress(): number {
    return this.raw
  }

  get eased(): number {
    return this.easing(this.raw)
  }

  get state(): MeltState {
    return this.current
  }

  get running(): boolean {
    return this.active
  }

  setEasing(easing: EasingName | EasingFunction): void {
    this.easing = resolveEasing(easing)
  }

  play(): void {
    this.direction = 1
    this.active = true
    this.transitionTo('melting')
  }

  reverse(): void {
    this.direction = -1
    this.active = true
    this.transitionTo('reforming')
  }

  toggle(): void {
    if (this.current === 'melting' || this.current === 'melted') this.reverse()
    else this.play()
  }

  pause(): void {
    this.active = false
  }

  reset(): void {
    this.active = false
    this.direction = 1
    this.raw = 0
    this.transitionTo('idle')
    this.emitChange()
  }

  seek(progress: number): void {
    this.raw = saturate(progress)
    this.emitChange()
  }

  advance(delta: number): void {
    if (!this.active || this.duration <= 0) return
    const next = saturate(this.raw + (delta / this.duration) * this.direction)
    if (next === this.raw) return
    this.raw = next
    this.emitChange()

    if (this.raw === 1 && this.direction === 1) this.finish('melted')
    else if (this.raw === 0 && this.direction === -1) this.finish('idle')
  }

  attach(ticker: Ticker): Unsubscribe {
    this.detach?.()
    this.detach = ticker.on('tick', (frame) => this.advance(frame.delta))
    return this.detach
  }

  dispose(): void {
    this.detach?.()
    this.detach = null
    this.active = false
    this.clear()
  }

  private finish(state: MeltState): void {
    if (this.loop) {
      this.direction = this.direction === 1 ? -1 : 1
      this.transitionTo(this.direction === 1 ? 'melting' : 'reforming')
      return
    }
    this.active = false
    this.transitionTo(state)
    this.emit('complete', state)
  }

  private transitionTo(state: MeltState): void {
    if (this.current === state) return
    this.current = state
    this.emit('statechange', state)
  }

  private emitChange(): void {
    this.emit('change', { progress: this.raw, eased: this.easing(this.raw), state: this.current })
  }
}
