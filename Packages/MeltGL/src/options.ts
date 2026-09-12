import { MeltError } from '@meltgl/common'
import type { EasingFunction, EasingName } from '@meltgl/common'
import type { LayerInput, MaterialInput, SimulationOptions } from '@meltgl/displacement-engine'
import type { FilterDefinition } from '@meltgl/filter-system'
import type { GraphicsSource, KeyColour } from '@meltgl/source-graphics'

export type MeltBackend = 'auto' | 'webgl2' | 'svg'

export type MeltSourceInput = GraphicsSource | string | HTMLImageElement | HTMLVideoElement

export type SimulationSettings = Partial<Omit<SimulationOptions, 'material' | 'layers'>>

export type KeyMode = 'auto' | 'none' | KeyColour

export interface MeltGLOptions {
  target: HTMLElement
  source: MeltSourceInput
  backend?: MeltBackend
  key?: KeyMode
  material?: MaterialInput
  layers?: LayerInput[]
  simulation?: SimulationSettings
  filters?: FilterDefinition[]
  duration?: number
  easing?: EasingName | EasingFunction
  loop?: boolean
  autoPlay?: boolean
  maxPixelRatio?: number
  maxStepsPerFrame?: number
  respectReducedMotion?: boolean
}

export interface MeltConfig extends SimulationSettings {
  material?: MaterialInput
  layers?: LayerInput[]
}

export const MELT_DEFAULTS = {
  duration: 1.6,
  maxPixelRatio: 2,
  maxStepsPerFrame: 24,
  reducedMotionDuration: 0.05,
} as const

export const MELT_RANGES = {
  duration: [0.05, Number.MAX_SAFE_INTEGER],
  maxPixelRatio: [0.5, 8],
  maxStepsPerFrame: [1, 240],
} as const

const BACKENDS: readonly MeltBackend[] = ['auto', 'webgl2', 'svg']

const isPositiveNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0

export const validateOptions = (options: MeltGLOptions): void => {
  if (typeof HTMLElement === 'undefined' || !(options.target instanceof HTMLElement)) {
    throw new MeltError('invalid-options', 'target must be an HTMLElement')
  }
  if (options.duration !== undefined && !isPositiveNumber(options.duration)) {
    throw new MeltError('invalid-options', `duration must be a finite number above zero, received ${String(options.duration)}`)
  }
  if (options.maxPixelRatio !== undefined && !isPositiveNumber(options.maxPixelRatio)) {
    throw new MeltError('invalid-options', `maxPixelRatio must be a number above zero, received ${String(options.maxPixelRatio)}`)
  }
  if (options.maxStepsPerFrame !== undefined && !isPositiveNumber(options.maxStepsPerFrame)) {
    throw new MeltError('invalid-options', `maxStepsPerFrame must be a number above zero, received ${String(options.maxStepsPerFrame)}`)
  }
  if (options.backend !== undefined && !BACKENDS.includes(options.backend)) {
    throw new MeltError('invalid-options', `backend must be one of ${BACKENDS.join(', ')}, received ${String(options.backend)}`)
  }
}

export const resolveMaxStepsPerFrame = (value: number | undefined): number => {
  const [min, max] = MELT_RANGES.maxStepsPerFrame
  return Math.round(Math.min(Math.max(value ?? MELT_DEFAULTS.maxStepsPerFrame, min), max))
}

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
