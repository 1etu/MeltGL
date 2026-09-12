export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

export const saturate = (value: number): number => clamp(value, 0, 1)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const inverseLerp = (a: number, b: number, value: number): number =>
  a === b ? 0 : (value - a) / (b - a)

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = saturate(inverseLerp(edge0, edge1, value))
  return t * t * (3 - 2 * t)
}

export const smootherstep = (edge0: number, edge1: number, value: number): number => {
  const t = saturate(inverseLerp(edge0, edge1, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const isPowerOfTwo = (value: number): boolean => value > 0 && (value & (value - 1)) === 0

export const nextPowerOfTwo = (value: number): number => {
  let result = 1
  while (result < value) result <<= 1
  return result
}

export const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0 || 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const hashString = (value: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
