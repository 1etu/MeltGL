import { describe, expect, it } from 'vitest'
import { ManualClock } from '@meltgl/animation-clock'
import type { FrameInfo } from '@meltgl/common'
import { TransitionController } from '@meltgl/transition-controller'

describe('ManualClock', () => {
  it('ticks with the given delta', () => {
    const clock = new ManualClock()
    const frames: FrameInfo[] = []
    clock.on('tick', (frame) => frames.push(frame))
    clock.start()
    clock.advance(0.25)
    clock.advance(0.5)
    expect(frames.map((frame) => frame.delta)).toEqual([0.25, 0.5])
    expect(frames.map((frame) => frame.frame)).toEqual([1, 2])
    expect(frames.map((frame) => frame.time)).toEqual([0.25, 0.75])
    expect(clock.time).toBe(0.75)
    expect(clock.running).toBe(true)
  })

  it('ignores advance while stopped', () => {
    const clock = new ManualClock()
    let ticks = 0
    clock.on('tick', () => { ticks += 1 })
    clock.advance(1)
    clock.start()
    clock.stop()
    clock.advance(1)
    expect(ticks).toBe(0)
    expect(clock.time).toBe(0)
    expect(clock.running).toBe(false)
  })

  it('emits start and stop once each', () => {
    const clock = new ManualClock()
    let starts = 0
    let stops = 0
    clock.on('start', () => { starts += 1 })
    clock.on('stop', () => { stops += 1 })
    clock.start()
    clock.start()
    clock.stop()
    clock.stop()
    expect(starts).toBe(1)
    expect(stops).toBe(1)
  })

  it('drives an attached transition', () => {
    const clock = new ManualClock()
    const controller = new TransitionController({ duration: 2, easing: 'linear' })
    controller.attach(clock)
    clock.start()
    controller.play()
    clock.advance(0.5)
    expect(controller.progress).toBe(0.25)
    clock.advance(1.5)
    expect(controller.progress).toBe(1)
    expect(controller.state).toBe('melted')
  })
})
