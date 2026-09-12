import { clamp, hashString, lerp, saturate } from '@meltgl/common'
import type { Disposable, Size } from '@meltgl/common'

const SVG_NS = 'http://www.w3.org/2000/svg'

export interface SvgMeltFilterOptions {
  id?: string
  seed?: number | string
  sag?: number
  lateral?: number
  columns?: number
  streak?: number
  octaves?: number
  blur?: number
  pinch?: number
  dripRoom?: number
  topRoom?: number
  sideRoom?: number
  box?: Size
}

export interface SvgMeltSettings {
  readonly sag: number
  readonly lateral: number
  readonly columns: number
  readonly streak: number
  readonly octaves: number
  readonly blur: number
  readonly pinch: number
  readonly dripRoom: number
  readonly topRoom: number
  readonly sideRoom: number
}

export const SVG_MELT_DEFAULTS: SvgMeltSettings = {
  sag: 0.16,
  lateral: 0.08,
  columns: 4,
  streak: 0.08,
  octaves: 2,
  blur: 0.008,
  pinch: 6,
  dripRoom: 0.6,
  topRoom: 0.08,
  sideRoom: 0.15,
}

export const SVG_MELT_RANGES = {
  sag: [0, 1],
  lateral: [0, 0.5],
  columns: [0.5, 64],
  streak: [0.01, 1],
  octaves: [1, 5],
  blur: [0, 0.05],
  pinch: [1, 24],
  dripRoom: [0, 2],
  topRoom: [0, 1],
  sideRoom: [0, 1],
} as const

const DEFAULT_BOX: Size = { width: 300, height: 300 }
const SAG_TO_SCALE = 4
const FIELD_GAIN = 0.5
const RAMP_PIVOT = 0.5
const LATERAL_BLUR = 0.35
const COARSEN = 0.3
const STRETCH = 0.55
const IDENTITY_RGB = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  '

let instances = 0

const element = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag)

const resolveSettings = (options: SvgMeltFilterOptions): SvgMeltSettings => ({
  sag: clamp(options.sag ?? SVG_MELT_DEFAULTS.sag, ...SVG_MELT_RANGES.sag),
  lateral: clamp(options.lateral ?? SVG_MELT_DEFAULTS.lateral, ...SVG_MELT_RANGES.lateral),
  columns: clamp(options.columns ?? SVG_MELT_DEFAULTS.columns, ...SVG_MELT_RANGES.columns),
  streak: clamp(options.streak ?? SVG_MELT_DEFAULTS.streak, ...SVG_MELT_RANGES.streak),
  octaves: Math.round(clamp(options.octaves ?? SVG_MELT_DEFAULTS.octaves, ...SVG_MELT_RANGES.octaves)),
  blur: clamp(options.blur ?? SVG_MELT_DEFAULTS.blur, ...SVG_MELT_RANGES.blur),
  pinch: clamp(options.pinch ?? SVG_MELT_DEFAULTS.pinch, ...SVG_MELT_RANGES.pinch),
  dripRoom: clamp(options.dripRoom ?? SVG_MELT_DEFAULTS.dripRoom, ...SVG_MELT_RANGES.dripRoom),
  topRoom: clamp(options.topRoom ?? SVG_MELT_DEFAULTS.topRoom, ...SVG_MELT_RANGES.topRoom),
  sideRoom: clamp(options.sideRoom ?? SVG_MELT_DEFAULTS.sideRoom, ...SVG_MELT_RANGES.sideRoom),
})

const travelOf = (settings: SvgMeltSettings): number => SAG_TO_SCALE * settings.sag * 0.5

const resolveBox = (box: Size | undefined): Size => ({
  width: Math.max(1, box?.width ?? DEFAULT_BOX.width),
  height: Math.max(1, box?.height ?? DEFAULT_BOX.height),
})

export class SvgMeltFilter implements Disposable {
  readonly id: string
  readonly root: SVGSVGElement
  readonly settings: SvgMeltSettings

  private readonly turbulence: SVGFETurbulenceElement
  private readonly displacement: SVGFEDisplacementMapElement
  private readonly softening: SVGFEGaussianBlurElement | null
  private readonly ramp: SVGFEColorMatrixElement
  private box: Size
  private progress = 0
  private frequencyX = 0
  private frequencyY = 0
  private scale = 0
  private softness = 0

  constructor(options: SvgMeltFilterOptions = {}) {
    const seed = options.seed ?? 'meltgl'
    const numericSeed = typeof seed === 'string' ? hashString(seed) : seed >>> 0
    instances += 1
    const unique = `${instances.toString(36)}${Math.random().toString(36).slice(2, 6)}`
    this.id = options.id ?? `meltgl-melt-${numericSeed.toString(36)}-${unique}`
    this.settings = resolveSettings(options)
    this.box = resolveBox(options.box)

    this.root = element('svg')
    this.root.setAttribute('aria-hidden', 'true')
    this.root.setAttribute('focusable', 'false')
    this.root.setAttribute('width', '0')
    this.root.setAttribute('height', '0')
    this.root.style.position = 'absolute'
    this.root.style.width = '0'
    this.root.style.height = '0'
    this.root.style.overflow = 'hidden'
    this.root.style.pointerEvents = 'none'

    const filter = element('filter')
    filter.setAttribute('id', this.id)
    filter.setAttribute('filterUnits', 'objectBoundingBox')
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse')
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    const room = Math.max(this.settings.dripRoom, travelOf(this.settings))
    filter.setAttribute('x', (-this.settings.sideRoom).toFixed(4))
    filter.setAttribute('y', (-this.settings.topRoom).toFixed(4))
    filter.setAttribute('width', (1 + this.settings.sideRoom * 2).toFixed(4))
    filter.setAttribute('height', (1 + this.settings.topRoom + room).toFixed(4))

    this.turbulence = element('feTurbulence')
    this.turbulence.setAttribute('type', 'fractalNoise')
    this.turbulence.setAttribute('numOctaves', String(this.settings.octaves))
    this.turbulence.setAttribute('seed', String(numericSeed % 1000))
    this.turbulence.setAttribute('stitchTiles', 'noStitch')
    this.turbulence.setAttribute('baseFrequency', '0 0')
    this.turbulence.setAttribute('result', 'meltNoise')

    const field = element('feColorMatrix')
    field.setAttribute('in', 'meltNoise')
    field.setAttribute('type', 'matrix')
    field.setAttribute('values', this.fieldValues())
    field.setAttribute('result', 'meltField')

    this.displacement = element('feDisplacementMap')
    this.displacement.setAttribute('in', 'SourceGraphic')
    this.displacement.setAttribute('in2', 'meltField')
    this.displacement.setAttribute('scale', '0')
    this.displacement.setAttribute('xChannelSelector', 'R')
    this.displacement.setAttribute('yChannelSelector', 'G')
    this.displacement.setAttribute('result', 'meltDisplaced')

    this.softening = this.settings.blur > 0 ? element('feGaussianBlur') : null
    if (this.softening) {
      this.softening.setAttribute('in', 'meltDisplaced')
      this.softening.setAttribute('edgeMode', 'none')
      this.softening.setAttribute('stdDeviation', '0 0')
      this.softening.setAttribute('result', 'meltSoftened')
    }

    this.ramp = element('feColorMatrix')
    this.ramp.setAttribute('in', this.softening ? 'meltSoftened' : 'meltDisplaced')
    this.ramp.setAttribute('type', 'matrix')
    this.ramp.setAttribute('values', `${IDENTITY_RGB}0 0 0 1 0`)
    this.ramp.setAttribute('result', 'meltOut')

    filter.append(this.turbulence, field, this.displacement)
    if (this.softening) filter.append(this.softening)
    filter.append(this.ramp)

    const defs = element('defs')
    defs.append(filter)
    this.root.append(defs)

    this.applyBox()
    this.setProgress(0)
  }

  get cssValue(): string {
    return `url(#${this.id})`
  }

  mount(parent: ParentNode = document.body): void {
    if (this.root.parentNode === parent) return
    parent.append(this.root)
  }

  setBox(box: Size): void {
    const next = resolveBox(box)
    if (next.width === this.box.width && next.height === this.box.height) return
    this.box = next
    this.applyBox()
    this.setProgress(this.progress)
  }

  setProgress(progress: number): void {
    const t = saturate(progress)
    this.progress = t
    const eased = t * t
    const x = this.frequencyX * (1 - COARSEN * eased)
    const y = this.frequencyY * (1 - STRETCH * eased)
    this.turbulence.setAttribute('baseFrequency', `${x.toFixed(6)} ${y.toFixed(6)}`)
    this.displacement.setAttribute('scale', (this.scale * eased).toFixed(2))
    if (this.softening) {
      const sigma = this.softness * eased
      this.softening.setAttribute('stdDeviation', `${(sigma * LATERAL_BLUR).toFixed(3)} ${sigma.toFixed(3)}`)
    }
    const steepness = lerp(1, this.settings.pinch, eased)
    const pivot = RAMP_PIVOT * (1 - steepness)
    this.ramp.setAttribute('values', `${IDENTITY_RGB}0 0 0 ${steepness.toFixed(3)} ${pivot.toFixed(3)}`)
  }

  dispose(): void {
    this.root.remove()
  }

  private fieldValues(): string {
    const lateral = this.settings.lateral
    return [
      `${lateral.toFixed(4)} 0 0 0 ${(0.5 - lateral * 0.5).toFixed(4)}`,
      `0 ${FIELD_GAIN.toFixed(4)} 0 0 0`,
      '0 0 0 0 0',
      '0 0 0 0 1',
    ].join('  ')
  }

  private applyBox(): void {
    this.frequencyX = this.settings.columns / this.box.width
    this.frequencyY = this.frequencyX * this.settings.streak
    this.scale = SAG_TO_SCALE * this.settings.sag * this.box.height
    this.softness = this.settings.blur * this.box.height
  }
}
