import { MeltError } from '@meltgl/common'
import { ImageSource, VideoSource } from '@meltgl/source-graphics'
import type { GraphicsSource } from '@meltgl/source-graphics'
import type { MeltSourceInput } from './options.js'

const VIDEO_URL = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i

const isGraphicsSource = (value: MeltSourceInput): value is GraphicsSource =>
  typeof value === 'object' && 'frame' in value && typeof value.frame === 'function'

export const resolveSource = (input: MeltSourceInput): GraphicsSource => {
  if (typeof input === 'string') return VIDEO_URL.test(input) ? new VideoSource(input) : new ImageSource(input)
  if (isGraphicsSource(input)) return input
  if (input instanceof HTMLImageElement) return new ImageSource(input)
  if (input instanceof HTMLVideoElement) return new VideoSource(input)
  throw new MeltError('invalid-options', 'source must be an image, a video, a URL, or a GraphicsSource')
}
