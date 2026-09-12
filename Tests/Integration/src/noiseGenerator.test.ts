import { describe, expect, it } from 'vitest'
import { NOISE_PRELUDE, NoiseField, composeNoise } from '@meltgl/noise-generator'

const points: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.5, 1.25],
  [3.75, -2.5],
  [12.5, 7.125],
  [-8.25, 0.0625],
]

const sampleAll = (field: NoiseField): number[] => points.map(([x, y]) => field.sample(x, y))

describe('NoiseField', () => {
  it('gives the same field for the same seed', () => {
    expect(sampleAll(new NoiseField({ seed: 42 }))).toEqual(sampleAll(new NoiseField({ seed: 42 })))
  })

  it('gives a different field for another seed', () => {
    expect(sampleAll(new NoiseField({ seed: 42 }))).not.toEqual(sampleAll(new NoiseField({ seed: 43 })))
  })

  it('hashes a string seed consistently', () => {
    expect(sampleAll(new NoiseField({ seed: 'teapot' }))).toEqual(sampleAll(new NoiseField({ seed: 'teapot' })))
    expect(sampleAll(new NoiseField({ seed: 'teapot' }))).not.toEqual(sampleAll(new NoiseField({ seed: 'kettle' })))
  })

  it('is repeatable call after call', () => {
    const field = new NoiseField({ seed: 7 })
    expect(sampleAll(field)).toEqual(sampleAll(field))
  })

  it('stays inside zero and one', () => {
    const field = new NoiseField({ seed: 7, octaves: 6, frequency: 3 })
    for (const [x, y] of points) {
      const value = field.sample(x, y)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      expect(field.signed(x, y)).toBeCloseTo(value * 2 - 1, 12)
    }
  })

  it('frequency and octaves change the field', () => {
    const base = new NoiseField({ seed: 5 })
    expect(sampleAll(new NoiseField({ seed: 5, frequency: 4 }))).not.toEqual(sampleAll(base))
    expect(sampleAll(new NoiseField({ seed: 5, octaves: 1 }))).not.toEqual(sampleAll(base))
  })
})

describe('noise chunks', () => {
  it('composes by name in order', () => {
    const composed = composeNoise('hash', 'simplex')
    expect(composed).toContain('meltHash12')
    expect(composed).toContain('meltSimplex')
    expect(composed.indexOf('meltPermute')).toBeLessThan(composed.indexOf('meltSimplex'))
  })

  it('the prelude carries every chunk', () => {
    expect(NOISE_PRELUDE).toContain('meltHash12')
    expect(NOISE_PRELUDE).toContain('meltSimplex')
    expect(NOISE_PRELUDE).toContain('meltFbm')
  })
})
