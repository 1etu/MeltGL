import { describe, expect, it } from 'vitest'
import { TransitionController } from '@meltgl/transition-controller'
import type { MeltState } from '@meltgl/transition-controller'

const advanceBy = (controller: TransitionController, step: number, steps: number): void => {
  for (let index = 0; index < steps; index += 1) controller.advance(step)
}

const controllerWith = (loop = false): TransitionController =>
  new TransitionController({ duration: 1, easing: 'linear', loop })

describe('TransitionController', () => {
  it('starts idle at zero', () => {
    const controller = controllerWith()
    expect(controller.state).toBe('idle')
    expect(controller.progress).toBe(0)
    expect(controller.running).toBe(false)
  })

  it('play runs to melted and completes once', () => {
    const controller = controllerWith()
    const completed: MeltState[] = []
    controller.on('complete', (state) => completed.push(state))
    controller.play()
    expect(controller.state).toBe('melting')
    advanceBy(controller, 0.25, 8)
    expect(controller.progress).toBe(1)
    expect(controller.state).toBe('melted')
    expect(controller.running).toBe(false)
    expect(completed).toEqual(['melted'])
  })

  it('reverse from melted runs back to idle', () => {
    const controller = controllerWith()
    controller.play()
    advanceBy(controller, 0.25, 4)
    expect(controller.state).toBe('melted')

    const completed: MeltState[] = []
    controller.on('complete', (state) => completed.push(state))
    controller.reverse()
    expect(controller.state).toBe('reforming')
    advanceBy(controller, 0.25, 4)
    expect(controller.progress).toBe(0)
    expect(controller.state).toBe('idle')
    expect(controller.running).toBe(false)
    expect(completed).toEqual(['idle'])
  })

  it('loop flips direction and never completes', () => {
    const controller = controllerWith(true)
    let completes = 0
    const states: MeltState[] = []
    controller.on('complete', () => { completes += 1 })
    controller.on('statechange', (state) => states.push(state))

    controller.play()
    advanceBy(controller, 0.25, 4)
    expect(controller.progress).toBe(1)
    expect(controller.state).toBe('reforming')
    expect(controller.running).toBe(true)

    advanceBy(controller, 0.25, 4)
    expect(controller.progress).toBe(0)
    expect(controller.state).toBe('melting')
    expect(controller.running).toBe(true)

    expect(states).toEqual(['melting', 'reforming', 'melting'])
    expect(completes).toBe(0)
  })

  it('toggle on a fresh idle instance starts melting', () => {
    const controller = controllerWith()
    controller.toggle()
    expect(controller.state).toBe('melting')
    controller.advance(0.25)
    expect(controller.progress).toBe(0.25)
  })

  it('toggle from melted reforms', () => {
    const controller = controllerWith()
    controller.play()
    advanceBy(controller, 0.25, 4)
    expect(controller.state).toBe('melted')
    controller.toggle()
    expect(controller.state).toBe('reforming')
    controller.advance(0.25)
    expect(controller.progress).toBe(0.75)
  })

  it('reports eased progress from the easing it was given', () => {
    const controller = new TransitionController({ duration: 1, easing: (t) => t * t })
    controller.seek(0.5)
    expect(controller.progress).toBe(0.5)
    expect(controller.eased).toBe(0.25)
    controller.setEasing('linear')
    expect(controller.eased).toBe(0.5)
  })

  it('seek clamps and emits change', () => {
    const controller = controllerWith()
    const seen: number[] = []
    controller.on('change', (change) => seen.push(change.progress))
    controller.seek(2)
    controller.seek(-1)
    expect(seen).toEqual([1, 0])
  })

  it('pause stops advancing and reset returns to idle', () => {
    const controller = controllerWith()
    controller.play()
    controller.advance(0.25)
    controller.pause()
    controller.advance(0.25)
    expect(controller.progress).toBe(0.25)
    controller.reset()
    expect(controller.progress).toBe(0)
    expect(controller.state).toBe('idle')
    expect(controller.running).toBe(false)
  })

  it('dispose drops listeners', () => {
    const controller = controllerWith()
    let changes = 0
    controller.on('change', () => { changes += 1 })
    controller.dispose()
    controller.seek(0.5)
    expect(changes).toBe(0)
  })
})
