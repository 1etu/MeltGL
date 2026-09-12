import { clamp } from '@meltgl/common'

export interface KeyColour {
  readonly colour: readonly [number, number, number]
  readonly tolerance: number
}

const SAMPLE = 64
const RING = 2
const ALPHA_LIMIT = 250
const MAX_SPREAD = 0.1

export const estimateKey = (frame: TexImageSource): KeyColour | null => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  let data: Uint8ClampedArray
  try {
    context.drawImage(frame as CanvasImageSource, 0, 0, SAMPLE, SAMPLE)
    data = context.getImageData(0, 0, SAMPLE, SAMPLE).data
  } catch {
    return null
  }

  let translucent = 0
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 255) < ALPHA_LIMIT) translucent += 1
  }
  if (translucent > (data.length / 4) * 0.01) return null

  const ring: [number, number, number][] = []
  for (let y = 0; y < SAMPLE; y += 1) {
    for (let x = 0; x < SAMPLE; x += 1) {
      if (x >= RING && y >= RING && x < SAMPLE - RING && y < SAMPLE - RING) continue
      const i = (y * SAMPLE + x) * 4
      ring.push([(data[i] ?? 0) / 255, (data[i + 1] ?? 0) / 255, (data[i + 2] ?? 0) / 255])
    }
  }

  const mean: [number, number, number] = [0, 0, 0]
  for (const [r, g, b] of ring) {
    mean[0] += r
    mean[1] += g
    mean[2] += b
  }
  mean[0] /= ring.length
  mean[1] /= ring.length
  mean[2] /= ring.length

  let spread = 0
  for (const [r, g, b] of ring) {
    spread += Math.hypot(r - mean[0], g - mean[1], b - mean[2])
  }
  spread /= ring.length
  if (spread > MAX_SPREAD) return null

  return { colour: mean, tolerance: clamp(spread * 2.5 + 0.06, 0.08, 0.3) }
}
