import { clamp } from '@meltgl/common'
import type { Texture } from '@meltgl/render-pipeline'
import { resolveMaterial } from './materials.js'
import type { Material, MaterialInput } from './materials.js'

export interface MemberKey {
  readonly colour: readonly [number, number, number]
  readonly tolerance: number
}

export interface SimulationMember {
  readonly texture: Texture
  readonly rect: readonly [number, number, number, number]
  readonly key?: MemberKey | null
}

export interface LayerInput {
  material: MaterialInput
  delay?: number
}

export interface Layer {
  material: Material
  delay: number
}

export type GroundMode = 'open' | 'floor'

export type PressureSolver = 'multigrid' | 'jacobi'

export interface SimulationOptions {
  material: MaterialInput
  layers?: LayerInput[]
  layerDelay: number
  ground: GroundMode
  simulationScale: number
  substeps: number
  viscosityIterations: number
  pressureIterations: number
  pressureSolver: PressureSolver
  pressureCycles: number
  stepDuration: number
  snapshotEvery: number
  maxKeyframes: number
  gravity: number
  drag: number
  meltPoint: number
  conduction: number
  heatTop: number
  coreHeat: number
  surfaceHeat: number
  surfaceDepth: number
  columnFeed: number
  onsetSpread: number
  noiseScale: number
  freezePoint: number
  solidViscosity: number
  curvatureFlow: number
  volumeGuard: number
  rim: number
  edgeWidth: number
  dripRoom: number
  topRoom: number
  sideRoom: number
  seed: number
  light: readonly [number, number, number]
}

export interface ResolvedSimulationOptions extends Omit<SimulationOptions, 'material' | 'layers'> {
  layers: Layer[]
}

export const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  material: 'wax',
  layerDelay: 0.35,
  ground: 'open',
  simulationScale: 0.4,
  substeps: 2,
  viscosityIterations: 16,
  pressureIterations: 24,
  pressureSolver: 'multigrid',
  pressureCycles: 2,
  stepDuration: 1 / 60,
  snapshotEvery: 12,
  maxKeyframes: 48,
  gravity: 1,
  drag: 1,
  meltPoint: 0.5,
  conduction: 4,
  heatTop: 1.2,
  coreHeat: 0.1,
  surfaceHeat: 2,
  surfaceDepth: 5,
  columnFeed: 0.5,
  onsetSpread: 0.6,
  noiseScale: 4,
  freezePoint: 0.45,
  solidViscosity: 40,
  curvatureFlow: 0.1,
  volumeGuard: 0.15,
  rim: 6,
  edgeWidth: 0.6,
  dripRoom: 0.6,
  topRoom: 0.08,
  sideRoom: 0.15,
  seed: 11,
  light: [-0.35, 0.6, 1],
}

export const SIMULATION_RANGES = {
  layerDelay: [0, 5],
  simulationScale: [0.125, 1],
  substeps: [1, 6],
  viscosityIterations: [2, 64],
  pressureIterations: [2, 96],
  pressureCycles: [1, 6],
  stepDuration: [1 / 240, 1 / 15],
  snapshotEvery: [1, 120],
  maxKeyframes: [4, 512],
  gravity: [0, 4],
  drag: [0, 10],
  meltPoint: [0.2, 0.8],
  conduction: [0, 16],
  heatTop: [0, 3],
  coreHeat: [0, 4],
  surfaceHeat: [0, 6],
  surfaceDepth: [1, 20],
  columnFeed: [0, 1],
  onsetSpread: [0, 1],
  noiseScale: [0.5, 16],
  freezePoint: [0, 0.8],
  solidViscosity: [5, 400],
  curvatureFlow: [0, 0.5],
  volumeGuard: [0, 0.5],
  rim: [0, 32],
  edgeWidth: [0.2, 2],
  dripRoom: [0, 2],
  topRoom: [0, 1],
  sideRoom: [0, 1],
} as const

type RangeName = keyof typeof SIMULATION_RANGES

const defined = <T extends object>(source: T): Partial<T> => {
  const result: Partial<T> = {}
  for (const key of Object.keys(source) as (keyof T)[]) {
    const value = source[key]
    if (value !== undefined) result[key] = value
  }
  return result
}

const number = (value: number, name: RangeName): number => {
  const [min, max] = SIMULATION_RANGES[name]
  const fallback = DEFAULT_SIMULATION_OPTIONS[name]
  return clamp(Number.isFinite(value) ? value : fallback, min, max)
}

const integer = (value: number, name: RangeName): number => Math.round(number(value, name))

const unit = (direction: readonly [number, number, number]): readonly [number, number, number] => {
  const [x, y, z] = direction
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

export const resolveLight = (light: unknown): readonly [number, number, number] => {
  if (Array.isArray(light) && light.length === 3) {
    const [x, y, z] = light.map((component) => Number(component)) as [number, number, number]
    const length = Math.hypot(x, y, z)
    if (Number.isFinite(length) && length > 1e-6) return unit([x, y, z])
  }
  return unit(DEFAULT_SIMULATION_OPTIONS.light)
}

const resolveLayers = (inputs: readonly LayerInput[], layerDelay: number): Layer[] =>
  inputs.map((layer, index) => ({
    material: resolveMaterial(layer.material),
    delay: Math.max(0, Number.isFinite(layer.delay ?? Number.NaN) ? (layer.delay as number) : index * layerDelay),
  }))

export const resolveSimulationOptions = (overrides: Partial<SimulationOptions> = {}): ResolvedSimulationOptions => {
  const merged = { ...DEFAULT_SIMULATION_OPTIONS, ...defined(overrides) }
  const layerDelay = number(merged.layerDelay, 'layerDelay')
  const layerInputs = merged.layers && merged.layers.length > 0 ? merged.layers : [{ material: merged.material }]
  return {
    layers: resolveLayers(layerInputs, layerDelay),
    layerDelay,
    ground: merged.ground === 'floor' ? 'floor' : 'open',
    simulationScale: number(merged.simulationScale, 'simulationScale'),
    substeps: integer(merged.substeps, 'substeps'),
    viscosityIterations: integer(merged.viscosityIterations, 'viscosityIterations'),
    pressureIterations: integer(merged.pressureIterations, 'pressureIterations'),
    pressureSolver: merged.pressureSolver === 'jacobi' ? 'jacobi' : 'multigrid',
    pressureCycles: integer(merged.pressureCycles, 'pressureCycles'),
    stepDuration: number(merged.stepDuration, 'stepDuration'),
    snapshotEvery: integer(merged.snapshotEvery, 'snapshotEvery'),
    maxKeyframes: integer(merged.maxKeyframes, 'maxKeyframes'),
    gravity: number(merged.gravity, 'gravity'),
    drag: number(merged.drag, 'drag'),
    meltPoint: number(merged.meltPoint, 'meltPoint'),
    conduction: number(merged.conduction, 'conduction'),
    heatTop: number(merged.heatTop, 'heatTop'),
    coreHeat: number(merged.coreHeat, 'coreHeat'),
    surfaceHeat: number(merged.surfaceHeat, 'surfaceHeat'),
    surfaceDepth: number(merged.surfaceDepth, 'surfaceDepth'),
    columnFeed: number(merged.columnFeed, 'columnFeed'),
    onsetSpread: number(merged.onsetSpread, 'onsetSpread'),
    noiseScale: number(merged.noiseScale, 'noiseScale'),
    freezePoint: number(merged.freezePoint, 'freezePoint'),
    solidViscosity: number(merged.solidViscosity, 'solidViscosity'),
    curvatureFlow: number(merged.curvatureFlow, 'curvatureFlow'),
    volumeGuard: number(merged.volumeGuard, 'volumeGuard'),
    rim: number(merged.rim, 'rim'),
    edgeWidth: number(merged.edgeWidth, 'edgeWidth'),
    dripRoom: number(merged.dripRoom, 'dripRoom'),
    topRoom: number(merged.topRoom, 'topRoom'),
    sideRoom: number(merged.sideRoom, 'sideRoom'),
    seed: Number.isFinite(merged.seed) ? merged.seed : DEFAULT_SIMULATION_OPTIONS.seed,
    light: resolveLight(merged.light),
  }
}

export const toSimulationInput = (resolved: ResolvedSimulationOptions): Partial<SimulationOptions> => {
  const { layers, ...rest } = resolved
  return { ...rest, layers: layers.map((layer) => ({ material: layer.material, delay: layer.delay })) }
}

export const mergeSimulationOptions = (
  previous: ResolvedSimulationOptions,
  overrides: Partial<SimulationOptions>,
): ResolvedSimulationOptions => {
  const { material, layers, ...rest } = defined(overrides)
  const base = { ...toSimulationInput(previous), ...rest }
  if (layers && layers.length > 0) return resolveSimulationOptions({ ...base, layers })
  if (material === undefined) return resolveSimulationOptions(base)
  const replaced = previous.layers.map((layer, index) => ({
    material: index === 0 ? material : layer.material,
    delay: layer.delay,
  }))
  return resolveSimulationOptions({ ...base, layers: replaced })
}
