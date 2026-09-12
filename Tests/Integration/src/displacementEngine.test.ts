import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIMULATION_OPTIONS,
  MATERIALS,
  MATERIAL_RANGES,
  SIMULATION_RANGES,
  resolveMaterial,
  resolveSimulationOptions,
} from '@meltgl/displacement-engine'
import type { MaterialName } from '@meltgl/displacement-engine'

const materialNames = Object.keys(MATERIALS) as MaterialName[]
const rangedFields = Object.keys(MATERIAL_RANGES) as (keyof typeof MATERIAL_RANGES)[]

describe('resolveMaterial', () => {
  it('resolves every preset to a copy inside its ranges', () => {
    for (const name of materialNames) {
      const material = resolveMaterial(name)
      expect(material).toEqual(MATERIALS[name])
      expect(material).not.toBe(MATERIALS[name])
      for (const field of rangedFields) {
        const [min, max] = MATERIAL_RANGES[field]
        expect(material[field]).toBeGreaterThanOrEqual(min)
        expect(material[field]).toBeLessThanOrEqual(max)
      }
    }
  })

  it('defaults to wax', () => {
    expect(resolveMaterial()).toEqual(MATERIALS.wax)
  })

  it('clamps overrides above the range', () => {
    const material = resolveMaterial({ viscosity: 1e6, tension: 4, refraction: 9, meltRate: 100, cooling: 50 })
    expect(material.viscosity).toBe(MATERIAL_RANGES.viscosity[1])
    expect(material.tension).toBe(MATERIAL_RANGES.tension[1])
    expect(material.refraction).toBe(MATERIAL_RANGES.refraction[1])
    expect(material.meltRate).toBe(MATERIAL_RANGES.meltRate[1])
    expect(material.cooling).toBe(MATERIAL_RANGES.cooling[1])
  })

  it('clamps overrides below the range', () => {
    const material = resolveMaterial({ viscosity: -10, density: 0, yield: -1, gloss: -2, blend: -0.5 })
    expect(material.viscosity).toBe(MATERIAL_RANGES.viscosity[0])
    expect(material.density).toBe(MATERIAL_RANGES.density[0])
    expect(material.yield).toBe(MATERIAL_RANGES.yield[0])
    expect(material.gloss).toBe(MATERIAL_RANGES.gloss[0])
    expect(material.blend).toBe(MATERIAL_RANGES.blend[0])
  })

  it('keeps in range overrides untouched', () => {
    const material = resolveMaterial({ viscosity: 3.5, tension: 0.25 })
    expect(material.viscosity).toBe(3.5)
    expect(material.tension).toBe(0.25)
  })

  it('starts from base and keeps the rest of that preset', () => {
    const material = resolveMaterial({ base: 'tar', tension: 0.5 })
    expect(material.tension).toBe(0.5)
    expect(material.viscosity).toBe(MATERIALS.tar.viscosity)
    expect(material.tint).toEqual(MATERIALS.tar.tint)
    expect(material.absorption).toEqual(MATERIALS.tar.absorption)
  })
})

describe('resolveSimulationOptions', () => {
  it('fills in the defaults', () => {
    const resolved = resolveSimulationOptions()
    expect(resolved.ground).toBe(DEFAULT_SIMULATION_OPTIONS.ground)
    expect(resolved.simulationScale).toBe(DEFAULT_SIMULATION_OPTIONS.simulationScale)
    expect(resolved.substeps).toBe(DEFAULT_SIMULATION_OPTIONS.substeps)
    expect(resolved.viscosityIterations).toBe(DEFAULT_SIMULATION_OPTIONS.viscosityIterations)
    expect(resolved.pressureIterations).toBe(DEFAULT_SIMULATION_OPTIONS.pressureIterations)
    expect(resolved.pressureSolver).toBe('multigrid')
    expect(resolved.seed).toBe(DEFAULT_SIMULATION_OPTIONS.seed)
    expect(resolved.noiseScale).toBe(DEFAULT_SIMULATION_OPTIONS.noiseScale)
  })

  it('normalises the light direction', () => {
    const resolved = resolveSimulationOptions()
    const [x, y, z] = resolved.light
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12)
    const [dx, dy, dz] = DEFAULT_SIMULATION_OPTIONS.light
    const length = Math.hypot(dx, dy, dz)
    expect(x).toBeCloseTo(dx / length, 12)
    expect(y).toBeCloseTo(dy / length, 12)
    expect(z).toBeCloseTo(dz / length, 12)
    const scaled = resolveSimulationOptions({ light: [0, 0, 4] })
    expect(scaled.light).toEqual([0, 0, 1])
  })

  it('builds one wax layer with no delay by default', () => {
    const resolved = resolveSimulationOptions()
    expect(resolved.layers).toHaveLength(1)
    expect(resolved.layers[0]?.material).toEqual(MATERIALS.wax)
    expect(resolved.layers[0]?.delay).toBe(0)
  })

  it('puts a material override into the single layer', () => {
    const resolved = resolveSimulationOptions({ material: 'chocolate' })
    expect(resolved.layers).toHaveLength(1)
    expect(resolved.layers[0]?.material).toEqual(MATERIALS.chocolate)
  })

  it('clamps values out of range', () => {
    const resolved = resolveSimulationOptions({
      simulationScale: 9,
      substeps: 99,
      viscosityIterations: 0,
      pressureIterations: 1000,
      pressureCycles: 0,
      gravity: -3,
      heatTop: 99,
      onsetSpread: -1,
      noiseScale: 0.01,
      dripRoom: 99,
      sideRoom: -1,
    })
    expect(resolved.simulationScale).toBe(SIMULATION_RANGES.simulationScale[1])
    expect(resolved.substeps).toBe(SIMULATION_RANGES.substeps[1])
    expect(resolved.viscosityIterations).toBe(SIMULATION_RANGES.viscosityIterations[0])
    expect(resolved.pressureIterations).toBe(SIMULATION_RANGES.pressureIterations[1])
    expect(resolved.pressureCycles).toBe(SIMULATION_RANGES.pressureCycles[0])
    expect(resolved.gravity).toBe(SIMULATION_RANGES.gravity[0])
    expect(resolved.heatTop).toBe(SIMULATION_RANGES.heatTop[1])
    expect(resolved.onsetSpread).toBe(SIMULATION_RANGES.onsetSpread[0])
    expect(resolved.noiseScale).toBe(SIMULATION_RANGES.noiseScale[0])
    expect(resolved.dripRoom).toBe(SIMULATION_RANGES.dripRoom[1])
    expect(resolved.sideRoom).toBe(SIMULATION_RANGES.sideRoom[0])
  })

  it('rounds counted options to integers', () => {
    const resolved = resolveSimulationOptions({
      substeps: 2.6,
      viscosityIterations: 10.4,
      pressureIterations: 20.5,
      snapshotEvery: 2.4,
    })
    expect(resolved.substeps).toBe(3)
    expect(resolved.viscosityIterations).toBe(10)
    expect(resolved.pressureIterations).toBe(21)
    expect(resolved.snapshotEvery).toBe(2)
  })

  it('accepts the named ground modes and solvers only', () => {
    expect(resolveSimulationOptions({ ground: 'floor' }).ground).toBe('floor')
    expect(resolveSimulationOptions({ pressureSolver: 'jacobi' }).pressureSolver).toBe('jacobi')
    expect(resolveSimulationOptions({ pressureSolver: 'multigrid' }).pressureSolver).toBe('multigrid')
  })

  it('builds a layer per input with staggered delays', () => {
    const resolved = resolveSimulationOptions({ layers: [{ material: 'honey' }, { material: 'tar' }] })
    expect(resolved.layers).toHaveLength(2)
    expect(resolved.layers[0]?.material.viscosity).toBe(MATERIALS.honey.viscosity)
    expect(resolved.layers[1]?.material.viscosity).toBe(MATERIALS.tar.viscosity)
    expect(resolved.layers[0]?.delay).toBe(0)
    expect(resolved.layers[1]?.delay).toBeCloseTo(0.35, 10)
  })

  it('honours an explicit layer delay and never goes negative', () => {
    const resolved = resolveSimulationOptions({
      layers: [{ material: 'wax', delay: 1.5 }, { material: 'wax', delay: -4 }],
    })
    expect(resolved.layers[0]?.delay).toBe(1.5)
    expect(resolved.layers[1]?.delay).toBe(0)
  })

  it('falls back to material when layers is empty', () => {
    const resolved = resolveSimulationOptions({ material: 'slime', layers: [] })
    expect(resolved.layers).toHaveLength(1)
    expect(resolved.layers[0]?.material).toEqual(MATERIALS.slime)
  })
})
