import { describe, expect, it } from 'vitest'
import {
  Emitter,
  clamp,
  createRandom,
  easings,
  hashString,
  inverseLerp,
  isPowerOfTwo,
  lerp,
  nextPowerOfTwo,
  resolveEasing,
  saturate,
  smootherstep,
  smoothstep,
} from '@meltgl/common'
import type { EasingName } from '@meltgl/common'

const easingNames = Object.keys(easings) as EasingName[]
const unitSamples = Array.from({ length: 41 }, (_, index) => index / 40)

describe('easing', () => {
  it('maps zero to zero and one to one', () => {
    for (const name of easingNames) {
      expect(easings[name](0)).toBeCloseTo(0, 10)
      expect(easings[name](1)).toBeCloseTo(1, 10)
    }
  })

  it('stays inside the unit interval', () => {
    for (const name of easingNames) {
      for (const t of unitSamples) {
        const value = easings[name](t)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('never decreases', () => {
    for (const name of easingNames) {
      for (let index = 1; index < unitSamples.length; index += 1) {
        const previous = easings[name](unitSamples[index - 1]!)
        const current = easings[name](unitSamples[index]!)
        expect(current).toBeGreaterThanOrEqual(previous - 1e-12)
      }
    }
  })

  it('resolves names and passes functions through', () => {
    expect(resolveEasing('easeInOutCubic')).toBe(easings.easeInOutCubic)
    const custom = (t: number): number => t * t
    expect(resolveEasing(custom)).toBe(custom)
  })
})

interface CountEvents extends Record<string, unknown> {
  value: number
  other: string
}

describe('Emitter', () => {
  it('delivers until the subscription is released', () => {
    const emitter = new Emitter<CountEvents>()
    const seen: number[] = []
    const stop = emitter.on('value', (value) => seen.push(value))
    emitter.emit('value', 1)
    emitter.emit('value', 2)
    stop()
    emitter.emit('value', 3)
    expect(seen).toEqual([1, 2])
  })

  it('delivers to every listener of an event', () => {
    const emitter = new Emitter<CountEvents>()
    const first: number[] = []
    const second: number[] = []
    emitter.on('value', (value) => first.push(value))
    emitter.on('value', (value) => second.push(value))
    emitter.emit('value', 7)
    expect(first).toEqual([7])
    expect(second).toEqual([7])
  })

  it('once fires a single time', () => {
    const emitter = new Emitter<CountEvents>()
    const seen: number[] = []
    emitter.once('value', (value) => seen.push(value))
    emitter.emit('value', 1)
    emitter.emit('value', 2)
    expect(seen).toEqual([1])
  })

  it('off removes only the listener given', () => {
    const emitter = new Emitter<CountEvents>()
    const kept: number[] = []
    const dropped: number[] = []
    const keep = (value: number): void => void kept.push(value)
    const drop = (value: number): void => void dropped.push(value)
    emitter.on('value', keep)
    emitter.on('value', drop)
    emitter.off('value', drop)
    emitter.emit('value', 5)
    expect(kept).toEqual([5])
    expect(dropped).toEqual([])
  })

  it('clear removes every event', () => {
    const emitter = new Emitter<CountEvents>()
    let values = 0
    let others = 0
    emitter.on('value', () => { values += 1 })
    emitter.on('other', () => { others += 1 })
    emitter.clear()
    emitter.emit('value', 1)
    emitter.emit('other', 'a')
    expect(values).toBe(0)
    expect(others).toBe(0)
  })

  it('emitting an event nobody listens to is harmless', () => {
    const emitter = new Emitter<CountEvents>()
    expect(() => emitter.emit('value', 1)).not.toThrow()
  })
})

describe('math', () => {
  it('clamps to both bounds', () => {
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(0.25, 0, 1)).toBe(0.25)
    expect(clamp(3, -2, 8)).toBe(3)
  })

  it('saturates to zero and one', () => {
    expect(saturate(-1)).toBe(0)
    expect(saturate(2)).toBe(1)
    expect(saturate(0.5)).toBe(0.5)
  })

  it('interpolates and inverts', () => {
    expect(lerp(2, 4, 0.5)).toBe(3)
    expect(lerp(2, 4, 0)).toBe(2)
    expect(lerp(2, 4, 1)).toBe(4)
    expect(inverseLerp(2, 4, 3)).toBe(0.5)
    expect(inverseLerp(4, 4, 3)).toBe(0)
  })

  it('smooths between the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(0, 1, 2)).toBe(1)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12)
    expect(smootherstep(0, 1, 0)).toBe(0)
    expect(smootherstep(0, 1, 1)).toBe(1)
    expect(smootherstep(0, 1, 0.5)).toBeCloseTo(0.5, 12)
  })

  it('recognises and rounds up to powers of two', () => {
    expect(isPowerOfTwo(0)).toBe(false)
    expect(isPowerOfTwo(1)).toBe(true)
    expect(isPowerOfTwo(6)).toBe(false)
    expect(isPowerOfTwo(256)).toBe(true)
    expect(nextPowerOfTwo(1)).toBe(1)
    expect(nextPowerOfTwo(5)).toBe(8)
    expect(nextPowerOfTwo(8)).toBe(8)
    expect(nextPowerOfTwo(1000)).toBe(1024)
  })

  it('gives a repeatable random sequence per seed', () => {
    const take = (seed: number): number[] => {
      const random = createRandom(seed)
      return Array.from({ length: 8 }, () => random())
    }
    expect(take(11)).toEqual(take(11))
    expect(take(11)).not.toEqual(take(12))
    for (const value of take(11)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('hashes strings deterministically', () => {
    expect(hashString('wax')).toBe(hashString('wax'))
    expect(hashString('wax')).not.toBe(hashString('tar'))
    expect(hashString('')).toBeGreaterThanOrEqual(0)
  })
})
