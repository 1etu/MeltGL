export type EasingFunction = (t: number) => number

export const linear: EasingFunction = (t) => t
export const easeInQuad: EasingFunction = (t) => t * t
export const easeOutQuad: EasingFunction = (t) => t * (2 - t)
export const easeInCubic: EasingFunction = (t) => t * t * t
export const easeOutCubic: EasingFunction = (t) => 1 - (1 - t) ** 3
export const easeInOutCubic: EasingFunction = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
export const easeOutQuint: EasingFunction = (t) => 1 - (1 - t) ** 5
export const easeInOutSine: EasingFunction = (t) => -(Math.cos(Math.PI * t) - 1) / 2
export const easeInExpo: EasingFunction = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10))

export const easings = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeOutQuint,
  easeInOutSine,
  easeInExpo,
} as const

export type EasingName = keyof typeof easings
export const resolveEasing = (easing: EasingName | EasingFunction): EasingFunction => typeof easing === 'function' ? easing : easings[easing]
