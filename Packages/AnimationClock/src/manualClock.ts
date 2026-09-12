import { Emitter } from '@meltgl/common'
import type { ClockEvents, Ticker } from './clock.js'

export class ManualClock extends Emitter<ClockEvents> implements Ticker {
  private frame = 0
  private elapsed = 0
  private active = false

  get running(): boolean {
    return this.active
  }

  get time(): number {
    return this.elapsed
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.emit('start', undefined)
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.emit('stop', undefined)
  }

  advance(delta: number): void {
    if (!this.active) return
    this.elapsed += delta
    this.frame += 1
    this.emit('tick', { time: this.elapsed, delta, frame: this.frame })
  }
}
