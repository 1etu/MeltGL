import { hashString, lerp, smootherstep } from '@meltgl/common'

export interface NoiseFieldOptions {
  seed?: number | string
  frequency?: number
  octaves?: number
  lacunarity?: number
  gain?: number
}

const gradient = (seed: number, x: number, y: number): number => {
  let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export class NoiseField {
  private readonly seed: number
  private readonly frequency: number
  private readonly octaves: number
  private readonly lacunarity: number
  private readonly gain: number

  constructor(options: NoiseFieldOptions = {}) {
    const seed = options.seed ?? 0
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0
    this.frequency = options.frequency ?? 1
    this.octaves = Math.max(1, Math.min(8, options.octaves ?? 4))
    this.lacunarity = options.lacunarity ?? 2
    this.gain = options.gain ?? 0.5
  }

  value(x: number, y: number): number {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = smootherstep(0, 1, x - ix)
    const fy = smootherstep(0, 1, y - iy)
    const a = gradient(this.seed, ix, iy)
    const b = gradient(this.seed, ix + 1, iy)
    const c = gradient(this.seed, ix, iy + 1)
    const d = gradient(this.seed, ix + 1, iy + 1)
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
  }

  sample(x: number, y: number): number {
    let amplitude = 0.5
    let total = 0
    let normalisation = 0
    let px = x * this.frequency
    let py = y * this.frequency
    for (let i = 0; i < this.octaves; i += 1) {
      total += amplitude * this.value(px, py)
      normalisation += amplitude
      px *= this.lacunarity
      py *= this.lacunarity
      amplitude *= this.gain
    }
    return normalisation > 0 ? total / normalisation : 0
  }

  signed(x: number, y: number): number {
    return this.sample(x, y) * 2 - 1
  }
}
