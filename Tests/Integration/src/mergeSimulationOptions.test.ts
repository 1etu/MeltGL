import { describe, expect, it } from 'vitest'
import {
  MATERIALS,
  SIMULATION_RANGES,
  mergeSimulationOptions,
  resolveSimulationOptions,
} from '@meltgl/displacement-engine'

describe('mergeSimulationOptions', () => {
  it('keeps previous values that are not overridden', () => {
    const previous = resolveSimulationOptions({ gravity: 2, noiseScale: 8, seed: 99 })
    const merged = mergeSimulationOptions(previous, { substeps: 4 })
    expect(merged.substeps).toBe(4)
    expect(merged.gravity).toBe(2)
    expect(merged.noiseScale).toBe(8)
    expect(merged.seed).toBe(99)
  })

  it('clamps overrides the way a fresh resolve does', () => {
    const previous = resolveSimulationOptions()
    const merged = mergeSimulationOptions(previous, { substeps: 99, noiseScale: 0.01 })
    expect(merged.substeps).toBe(SIMULATION_RANGES.substeps[1])
    expect(merged.noiseScale).toBe(SIMULATION_RANGES.noiseScale[0])
  })

  it('replaces the single layer material when material alone is overridden', () => {
    const previous = resolveSimulationOptions({ material: 'wax' })
    expect(previous.layers[0]?.material.viscosity).toBe(MATERIALS.wax.viscosity)
    const merged = mergeSimulationOptions(previous, { material: 'tar' })
    expect(merged.layers).toHaveLength(1)
    expect(merged.layers[0]?.material.viscosity).toBe(MATERIALS.tar.viscosity)
    expect(merged.layers[0]?.material.viscosity).not.toBe(previous.layers[0]?.material.viscosity)
  })

  it('lets layers win over material', () => {
    const previous = resolveSimulationOptions({ material: 'wax' })
    const merged = mergeSimulationOptions(previous, {
      material: 'tar',
      layers: [{ material: 'honey' }, { material: 'slime' }],
    })
    expect(merged.layers).toHaveLength(2)
    expect(merged.layers[0]?.material.viscosity).toBe(MATERIALS.honey.viscosity)
    expect(merged.layers[1]?.material.viscosity).toBe(MATERIALS.slime.viscosity)
  })

  it('keeps the previous layers when neither material nor layers is given', () => {
    const previous = resolveSimulationOptions({ layers: [{ material: 'honey' }, { material: 'tar' }] })
    const merged = mergeSimulationOptions(previous, { gravity: 3 })
    expect(merged.layers).toHaveLength(2)
    expect(merged.layers[0]?.material.viscosity).toBe(MATERIALS.honey.viscosity)
    expect(merged.layers[1]?.material.viscosity).toBe(MATERIALS.tar.viscosity)
    expect(merged.gravity).toBe(3)
  })

  it('leaves the previous options untouched', () => {
    const previous = resolveSimulationOptions({ material: 'wax', gravity: 1 })
    const viscosity = previous.layers[0]?.material.viscosity
    mergeSimulationOptions(previous, { material: 'tar', gravity: 3 })
    expect(previous.gravity).toBe(1)
    expect(previous.layers).toHaveLength(1)
    expect(previous.layers[0]?.material.viscosity).toBe(viscosity)
  })
})
