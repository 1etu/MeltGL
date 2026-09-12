import { clamp } from '@meltgl/common'

export interface Material {
  viscosity: number
  density: number
  tension: number
  meltRate: number
  cooling: number
  yield: number
  gloss: number
  fresnel: number
  refraction: number
  blend: number
  translucency: number
  absorption: readonly [number, number, number]
  tint: readonly [number, number, number, number]
}

export type MaterialName = 'wax' | 'honey' | 'chocolate' | 'tar' | 'solder' | 'slime'

export type MaterialInput = MaterialName | (Partial<Material> & { base?: MaterialName })

export const MATERIALS: Record<MaterialName, Material> = {
  wax: {
    viscosity: 0.02,
    density: 0.9,
    tension: 0.5,
    meltRate: 1,
    cooling: 0.35,
    yield: 0.08,
    gloss: 0.35,
    fresnel: 0.3,
    refraction: 0.01,
    blend: 0.2,
    translucency: 0.2,
    absorption: [0.1, 0.1, 0.1],
    tint: [1, 1, 1, 1],
  },
  honey: {
    viscosity: 2.5,
    density: 1.4,
    tension: 0.7,
    meltRate: 1.2,
    cooling: 0,
    yield: 0,
    gloss: 0.85,
    fresnel: 0.5,
    refraction: 0.03,
    blend: 0.65,
    translucency: 0.6,
    absorption: [0.05, 0.4, 1.1],
    tint: [1, 0.72, 0.25, 1],
  },
  chocolate: {
    viscosity: 1.5,
    density: 1.2,
    tension: 0.45,
    meltRate: 0.9,
    cooling: 0.15,
    yield: 0.35,
    gloss: 0.6,
    fresnel: 0.25,
    refraction: 0.005,
    blend: 0.9,
    translucency: 0.1,
    absorption: [0.5, 0.9, 1.3],
    tint: [0.36, 0.2, 0.1, 1],
  },
  tar: {
    viscosity: 12,
    density: 1.3,
    tension: 0.3,
    meltRate: 0.6,
    cooling: 0,
    yield: 0.25,
    gloss: 0.95,
    fresnel: 0.7,
    refraction: 0,
    blend: 1,
    translucency: 0,
    absorption: [2, 2, 2],
    tint: [0.05, 0.05, 0.05, 1],
  },
  solder: {
    viscosity: 0.005,
    density: 3,
    tension: 1,
    meltRate: 2.5,
    cooling: 1.2,
    yield: 0,
    gloss: 1,
    fresnel: 0.9,
    refraction: 0,
    blend: 0.85,
    translucency: 0,
    absorption: [0.15, 0.15, 0.15],
    tint: [0.78, 0.8, 0.85, 1],
  },
  slime: {
    viscosity: 0.4,
    density: 0.8,
    tension: 0.85,
    meltRate: 1.5,
    cooling: 0,
    yield: 0.12,
    gloss: 0.7,
    fresnel: 0.4,
    refraction: 0.04,
    blend: 0.7,
    translucency: 0.5,
    absorption: [0.9, 0.1, 0.9],
    tint: [0.45, 1, 0.3, 1],
  },
}

export const MATERIAL_RANGES = {
  viscosity: [0.001, 50],
  density: [0.1, 4],
  tension: [0, 1],
  meltRate: [0.05, 6],
  cooling: [0, 3],
  yield: [0, 1],
  gloss: [0, 1],
  fresnel: [0, 1],
  refraction: [0, 0.08],
  blend: [0, 1],
  translucency: [0, 1],
} as const

export const resolveMaterial = (input: MaterialInput = 'wax'): Material => {
  if (typeof input === 'string') return { ...MATERIALS[input] }
  const { base, ...overrides } = input
  const merged: Material = { ...MATERIALS[base ?? 'wax'], ...overrides }
  return {
    ...merged,
    viscosity: clamp(merged.viscosity, ...MATERIAL_RANGES.viscosity),
    density: clamp(merged.density, ...MATERIAL_RANGES.density),
    tension: clamp(merged.tension, ...MATERIAL_RANGES.tension),
    meltRate: clamp(merged.meltRate, ...MATERIAL_RANGES.meltRate),
    cooling: clamp(merged.cooling, ...MATERIAL_RANGES.cooling),
    yield: clamp(merged.yield, ...MATERIAL_RANGES.yield),
    gloss: clamp(merged.gloss, ...MATERIAL_RANGES.gloss),
    fresnel: clamp(merged.fresnel, ...MATERIAL_RANGES.fresnel),
    refraction: clamp(merged.refraction, ...MATERIAL_RANGES.refraction),
    blend: clamp(merged.blend, ...MATERIAL_RANGES.blend),
    translucency: clamp(merged.translucency, ...MATERIAL_RANGES.translucency),
  }
}
