import type { Disposable } from '@meltgl/common'
import { assert } from '@meltgl/common'
import { Blitter, FULLSCREEN_VERTEX_GLSL, MultiPingPong, MultiRenderTarget, Program } from '@meltgl/render-pipeline'
import type { TextureOptions } from '@meltgl/render-pipeline'
import { mergeSimulationOptions, resolveSimulationOptions } from './options.js'
import type { Layer, ResolvedSimulationOptions, SimulationMember, SimulationOptions } from './options.js'
import {
  COARSEST_LEVEL,
  FLOOR_ROWS,
  GRAVITY_PER_HEIGHT,
  INITIAL_REINIT_PASSES,
  LAYER_SEED_STRIDE,
  MAX_LEVELS,
  MIN_LIQUID_VISCOSITY,
  REINIT_PASSES,
  RIM_MINIMUM,
  SMOOTH_PASSES,
  TENSION_STABILITY,
  VISCOSITY_PER_HEIGHT,
  YIELD_PER_HEIGHT,
} from './scheme.js'
import {
  ADVECT_A_FRAGMENT_GLSL,
  ADVECT_B_FRAGMENT_GLSL,
  COLUMN_VOLUME_FRAGMENT_GLSL,
  DIVERGENCE_FRAGMENT_GLSL,
  INIT_A_FRAGMENT_GLSL,
  INIT_B_FRAGMENT_GLSL,
  PAINT_FRAGMENT_GLSL,
  PRESSURE_FRAGMENT_GLSL,
  PROLONGATE_FRAGMENT_GLSL,
  REINIT_FRAGMENT_GLSL,
  RESIDUAL_FRAGMENT_GLSL,
  RESTRICT_FRAGMENT_GLSL,
  ROW_VOLUME_FRAGMENT_GLSL,
  SHADE_FRAGMENT_GLSL,
  SUBTRACT_FRAGMENT_GLSL,
  VISCOSITY_FRAGMENT_GLSL,
} from './shaders.js'

interface Level {
  readonly width: number
  readonly height: number
  readonly rhs: MultiRenderTarget
  readonly pressure: MultiPingPong
  readonly residual: MultiRenderTarget
}

interface LayerFields {
  layer: Layer
  readonly a: MultiPingPong
  readonly b: MultiPingPong
  readonly rhs: MultiRenderTarget
  readonly rows: MultiRenderTarget
  readonly volume: MultiRenderTarget
  readonly volumeReference: MultiRenderTarget
  levels: Level[]
  readonly keyframes: Map<number, MultiRenderTarget>
}

export class MeltSimulation implements Disposable {
  private readonly gl: WebGL2RenderingContext
  private readonly blitter: Blitter
  private readonly programs: {
    paint: Program
    initA: Program
    initB: Program
    reinit: Program
    advectA: Program
    advectB: Program
    viscosity: Program
    divergence: Program
    pressure: Program
    residual: Program
    restrict: Program
    prolongate: Program
    subtract: Program
    rowVolume: Program
    columnVolume: Program
    shade: Program
  }
  private readonly fieldA: TextureOptions
  private readonly fieldB: TextureOptions
  private readonly scalar: TextureOptions
  private readonly pair: TextureOptions
  private readonly colour: TextureOptions

  private options: ResolvedSimulationOptions
  private layers: LayerFields[] = []
  private members: SimulationMember[] = []
  private readonly origin: MultiRenderTarget
  private readonly originFull: MultiRenderTarget
  private width = 1
  private height = 1
  private simWidth = 4
  private simHeight = 4
  private steps = 0
  private target = 0
  private keyframeSpacing: number
  private disposed = false

  constructor(gl: WebGL2RenderingContext, options: Partial<SimulationOptions>, halfFloatRenderable: boolean) {
    assert(halfFloatRenderable, 'context-unavailable', 'the melt simulation needs renderable half float textures')
    this.gl = gl
    this.options = resolveSimulationOptions(options)
    this.keyframeSpacing = this.options.snapshotEvery
    this.blitter = new Blitter(gl)
    const make = (fragment: string): Program => new Program(gl, FULLSCREEN_VERTEX_GLSL, fragment)
    this.programs = {
      paint: make(PAINT_FRAGMENT_GLSL),
      initA: make(INIT_A_FRAGMENT_GLSL),
      initB: make(INIT_B_FRAGMENT_GLSL),
      reinit: make(REINIT_FRAGMENT_GLSL),
      advectA: make(ADVECT_A_FRAGMENT_GLSL),
      advectB: make(ADVECT_B_FRAGMENT_GLSL),
      viscosity: make(VISCOSITY_FRAGMENT_GLSL),
      divergence: make(DIVERGENCE_FRAGMENT_GLSL),
      pressure: make(PRESSURE_FRAGMENT_GLSL),
      residual: make(RESIDUAL_FRAGMENT_GLSL),
      restrict: make(RESTRICT_FRAGMENT_GLSL),
      prolongate: make(PROLONGATE_FRAGMENT_GLSL),
      subtract: make(SUBTRACT_FRAGMENT_GLSL),
      rowVolume: make(ROW_VOLUME_FRAGMENT_GLSL),
      columnVolume: make(COLUMN_VOLUME_FRAGMENT_GLSL),
      shade: make(SHADE_FRAGMENT_GLSL),
    }
    this.fieldA = { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR }
    this.fieldB = { internalFormat: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT, filter: gl.LINEAR }
    this.scalar = { internalFormat: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, filter: gl.LINEAR }
    this.pair = { internalFormat: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT, filter: gl.LINEAR }
    this.colour = { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, filter: gl.LINEAR }
    this.origin = new MultiRenderTarget(gl, 4, 4, [this.colour])
    this.originFull = new MultiRenderTarget(gl, 4, 4, [this.colour])
    this.rebuildLayers()
  }

  get elapsed(): number {
    return this.steps * this.options.stepDuration
  }

  get stepDuration(): number {
    return this.options.stepDuration
  }

  get settings(): ResolvedSimulationOptions {
    return this.options
  }

  get pending(): boolean {
    return this.steps !== this.target
  }

  get keyframeCount(): number {
    return this.layers[0]?.keyframes.size ?? 0
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    this.applyScale()
    this.originFull.resize(w, h)
    this.reset()
  }

  setMembers(members: readonly SimulationMember[]): void {
    this.members = [...members]
    this.reset()
  }

  configure(overrides: Partial<SimulationOptions>): void {
    const previous = this.options
    const next = mergeSimulationOptions(previous, overrides)
    const structural =
      next.layers.length !== previous.layers.length ||
      next.simulationScale !== previous.simulationScale ||
      next.snapshotEvery !== previous.snapshotEvery ||
      next.stepDuration !== previous.stepDuration
    this.options = next
    if (structural) {
      this.rebuildLayers()
      this.applyScale()
      this.reset()
      return
    }
    this.layers.forEach((entry, index) => {
      const layer = next.layers[index]
      if (layer) entry.layer = layer
      this.clearKeyframes(entry)
    })
    this.keyframeSpacing = next.snapshotEvery
  }

  reset(): void {
    this.steps = 0
    this.target = 0
    this.keyframeSpacing = this.options.snapshotEvery
    this.paintMembers(this.origin)
    this.paintMembers(this.originFull)
    for (const entry of this.layers) {
      this.clearKeyframes(entry)
      this.initialise(entry)
    }
  }

  refreshOrigin(): void {
    this.paintMembers(this.origin)
    this.paintMembers(this.originFull)
  }

  step(): void {
    const dt = this.options.stepDuration / this.options.substeps
    for (let sub = 0; sub < this.options.substeps; sub += 1) {
      const time = this.elapsed + sub * dt
      for (const entry of this.layers) this.substep(entry, dt, time)
    }
    this.steps += 1
    if (this.steps % this.keyframeSpacing === 0) this.snapshot()
  }

  seek(time: number, maxSteps: number = Number.POSITIVE_INFINITY): boolean {
    const target = Math.max(0, Math.round(time / this.options.stepDuration))
    this.target = target
    if (target < this.steps && !this.restore(target)) this.reset()
    let budget = maxSteps
    while (this.steps < target && budget > 0) {
      this.step()
      budget -= 1
    }
    return this.steps === target
  }

  render(): void {
    const { gl } = this
    const program = this.programs.shade
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    for (let i = this.layers.length - 1; i >= 0; i -= 1) {
      const entry = this.layers[i]
      if (!entry) continue
      const { material } = entry.layer
      program.use()
      program.set('uTexel', this.texel())
      program.set('uMeltPoint', this.options.meltPoint)
      program.set('uRim', this.options.rim * this.options.simulationScale + RIM_MINIMUM)
      program.set('uEdgeWidth', this.options.edgeWidth)
      program.set('uLight', new Float32Array(this.options.light))
      program.set('uGloss', material.gloss)
      program.set('uFresnel', material.fresnel)
      program.set('uRefraction', material.refraction)
      program.set('uBlend', material.blend)
      program.set('uTranslucency', material.translucency)
      program.set('uAbsorption', new Float32Array(material.absorption))
      program.set('uTint', new Float32Array(material.tint))
      program.setTexture('uA', entry.a.read.texture(0).handle)
      program.setTexture('uB', entry.b.read.texture(0).handle)
      program.setTexture('uOrigin', this.originFull.texture(0).handle)
      this.blitter.drawQuad()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const entry of this.layers) this.disposeLayer(entry)
    this.layers = []
    this.origin.dispose()
    this.originFull.dispose()
    for (const program of Object.values(this.programs)) program.dispose()
    this.blitter.dispose()
  }

  private texel(): Float32Array {
    return new Float32Array([1 / this.simWidth, 1 / this.simHeight])
  }

  private levelTexel(level: Level): Float32Array {
    return new Float32Array([1 / level.width, 1 / level.height])
  }

  private buildLevels(width: number, height: number): Level[] {
    const { gl } = this
    const levels: Level[] = []
    let w = width
    let h = height
    while (levels.length < MAX_LEVELS) {
      levels.push({
        width: w,
        height: h,
        rhs: new MultiRenderTarget(gl, w, h, [this.pair]),
        pressure: new MultiPingPong(gl, w, h, [this.scalar]),
        residual: new MultiRenderTarget(gl, w, h, [this.scalar]),
      })
      if (Math.min(w, h) <= COARSEST_LEVEL) break
      w = Math.ceil(w / 2)
      h = Math.ceil(h / 2)
    }
    return levels
  }

  private disposeLevels(levels: Level[]): void {
    for (const level of levels) {
      level.rhs.dispose()
      level.pressure.dispose()
      level.residual.dispose()
    }
  }

  private applyScale(): void {
    this.simWidth = Math.max(4, Math.round(this.width * this.options.simulationScale))
    this.simHeight = Math.max(4, Math.round(this.height * this.options.simulationScale))
    this.origin.resize(this.simWidth, this.simHeight)
    for (const entry of this.layers) {
      entry.a.resize(this.simWidth, this.simHeight)
      entry.b.resize(this.simWidth, this.simHeight)
      entry.rhs.resize(this.simWidth, this.simHeight)
      entry.rows.resize(1, this.simHeight)
      this.disposeLevels(entry.levels)
      entry.levels = this.buildLevels(this.simWidth, this.simHeight)
      this.clearKeyframes(entry)
    }
  }

  private rebuildLayers(): void {
    for (const entry of this.layers) this.disposeLayer(entry)
    const { gl, simWidth: w, simHeight: h } = this
    this.layers = this.options.layers.map((layer) => ({
      layer,
      a: new MultiPingPong(gl, w, h, [this.fieldA]),
      b: new MultiPingPong(gl, w, h, [this.fieldB]),
      rhs: new MultiRenderTarget(gl, w, h, [this.fieldA]),
      rows: new MultiRenderTarget(gl, 1, h, [this.scalar]),
      volume: new MultiRenderTarget(gl, 1, 1, [this.scalar]),
      volumeReference: new MultiRenderTarget(gl, 1, 1, [this.scalar]),
      levels: this.buildLevels(w, h),
      keyframes: new Map(),
    }))
  }

  private disposeLayer(entry: LayerFields): void {
    this.clearKeyframes(entry)
    entry.a.dispose()
    entry.b.dispose()
    entry.rhs.dispose()
    entry.rows.dispose()
    entry.volume.dispose()
    entry.volumeReference.dispose()
    this.disposeLevels(entry.levels)
  }

  private common(program: Program, dt: number, time: number, texel: Float32Array = this.texel()): void {
    program.use()
    program.set('uTexel', texel)
    program.set('uDt', dt)
    program.set('uTime', time)
    program.set('uFloor', this.options.ground === 'floor' ? 1 : 0)
    program.set('uFloorLevel', FLOOR_ROWS / this.simHeight)
  }

  private clearTarget(target: MultiRenderTarget): void {
    const { gl } = this
    target.bind()
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private paintMembers(target: MultiRenderTarget): void {
    const { gl } = this
    const program = this.programs.paint
    this.clearTarget(target)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    for (const member of this.members) {
      program.use()
      program.set('uRect', new Float32Array(member.rect))
      program.set('uKey', new Float32Array(member.key ? member.key.colour : [0, 0, 0]))
      program.set('uKeyTolerance', member.key ? member.key.tolerance : 0)
      program.set('uKeyEnabled', member.key ? 1 : 0)
      program.setTexture('uSource', member.texture.handle)
      this.blitter.drawQuad()
    }
    gl.disable(gl.BLEND)
  }

  private initialise(entry: LayerFields): void {
    const { gl } = this
    gl.disable(gl.BLEND)

    entry.a.write.bind()
    this.common(this.programs.initA, 0, 0)
    this.programs.initA.setTexture('uOrigin', this.origin.texture(0).handle)
    this.blitter.drawQuad()
    entry.a.swap()

    entry.b.write.bind()
    this.common(this.programs.initB, 0, 0)
    this.blitter.drawQuad()
    entry.b.swap()

    this.clearTarget(entry.volume)
    this.clearTarget(entry.volumeReference)
    this.blitter.copy(entry.a.read.texture(0), entry.rhs)
    for (let i = 0; i < INITIAL_REINIT_PASSES; i += 1) this.reinit(entry, 0)
    this.measureVolume(entry)
    this.blitter.copy(entry.volume.texture(0), entry.volumeReference)

    const base = entry.levels[0]
    if (base) {
      this.clearTarget(base.pressure.read)
      this.clearTarget(base.pressure.write)
    }
  }

  private reinit(entry: LayerFields, tensionFlow: number): void {
    const program = this.programs.reinit
    entry.a.write.bind()
    this.common(program, 0, 0)
    program.set('uTensionFlow', tensionFlow)
    program.set('uVolumeGuard', this.options.volumeGuard)
    program.set('uMeltPoint', this.options.meltPoint)
    program.setTexture('uA', entry.a.read.texture(0).handle)
    program.setTexture('uRhs', entry.rhs.texture(0).handle)
    program.setTexture('uVolume', entry.volume.texture(0).handle)
    program.setTexture('uVolumeReference', entry.volumeReference.texture(0).handle)
    this.blitter.drawQuad()
    entry.a.swap()
  }

  private measureVolume(entry: LayerFields): void {
    const p = this.programs
    entry.rows.bind()
    this.common(p.rowVolume, 0, 0)
    p.rowVolume.set('uCount', this.simWidth)
    p.rowVolume.setTexture('uA', entry.a.read.texture(0).handle)
    this.blitter.drawQuad()

    entry.volume.bind()
    this.common(p.columnVolume, 0, 0, new Float32Array([1, 1 / this.simHeight]))
    p.columnVolume.set('uCount', this.simHeight)
    p.columnVolume.setTexture('uRows', entry.rows.texture(0).handle)
    this.blitter.drawQuad()
  }

  private smooth(level: Level, passes: number): void {
    const program = this.programs.pressure
    for (let i = 0; i < passes; i += 1) {
      level.pressure.write.bind()
      this.common(program, 0, 0, this.levelTexel(level))
      program.setTexture('uPressure', level.pressure.read.texture(0).handle)
      program.setTexture('uDivergence', level.rhs.texture(0).handle)
      this.blitter.drawQuad()
      level.pressure.swap()
    }
  }

  private vcycle(levels: readonly Level[], index: number): void {
    const level = levels[index]
    if (!level) return
    const next = levels[index + 1]
    if (!next) {
      this.smooth(level, SMOOTH_PASSES * 2)
      return
    }

    this.smooth(level, SMOOTH_PASSES)

    const residual = this.programs.residual
    level.residual.bind()
    this.common(residual, 0, 0, this.levelTexel(level))
    residual.setTexture('uPressure', level.pressure.read.texture(0).handle)
    residual.setTexture('uDivergence', level.rhs.texture(0).handle)
    this.blitter.drawQuad()

    const restrict = this.programs.restrict
    next.rhs.bind()
    this.common(restrict, 0, 0, this.levelTexel(next))
    restrict.setTexture('uResidual', level.residual.texture(0).handle)
    restrict.setTexture('uFineRhs', level.rhs.texture(0).handle)
    this.blitter.drawQuad()

    this.clearTarget(next.pressure.read)
    this.clearTarget(next.pressure.write)
    this.vcycle(levels, index + 1)

    const prolongate = this.programs.prolongate
    level.pressure.write.bind()
    this.common(prolongate, 0, 0, this.levelTexel(level))
    prolongate.setTexture('uPressure', level.pressure.read.texture(0).handle)
    prolongate.setTexture('uCoarse', next.pressure.read.texture(0).handle)
    prolongate.setTexture('uDivergence', level.rhs.texture(0).handle)
    this.blitter.drawQuad()
    level.pressure.swap()

    this.smooth(level, SMOOTH_PASSES)
  }

  private project(entry: LayerFields, dt: number, time: number): void {
    const base = entry.levels[0]
    if (!base) return
    const p = this.programs

    base.rhs.bind()
    this.common(p.divergence, dt, time)
    p.divergence.setTexture('uA', entry.a.read.texture(0).handle)
    this.blitter.drawQuad()

    if (this.options.pressureSolver === 'jacobi') {
      this.smooth(base, this.options.pressureIterations)
    } else {
      for (let cycle = 0; cycle < this.options.pressureCycles; cycle += 1) this.vcycle(entry.levels, 0)
    }

    entry.a.write.bind()
    this.common(p.subtract, dt, time)
    p.subtract.setTexture('uA', entry.a.read.texture(0).handle)
    p.subtract.setTexture('uPressure', base.pressure.read.texture(0).handle)
    this.blitter.drawQuad()
    entry.a.swap()
  }

  private substep(entry: LayerFields, dt: number, time: number): void {
    const { gl, options } = this
    const { material } = entry.layer
    const p = this.programs
    gl.disable(gl.BLEND)

    const gravity = GRAVITY_PER_HEIGHT * this.simHeight * options.gravity
    const nuLiquid = Math.max(MIN_LIQUID_VISCOSITY, (material.viscosity / material.density) * this.simHeight * VISCOSITY_PER_HEIGHT)
    const nuSolid = options.solidViscosity * this.simHeight
    const yieldStress = material.yield * this.simHeight * YIELD_PER_HEIGHT
    const sigma = (material.tension * TENSION_STABILITY) / (2 * Math.PI * dt * dt)
    const tensionFlow = material.tension * options.curvatureFlow

    entry.b.write.bind()
    this.common(p.advectB, dt, time)
    p.advectB.setTexture('uA', entry.a.read.texture(0).handle)
    p.advectB.setTexture('uB', entry.b.read.texture(0).handle)
    this.blitter.drawQuad()
    entry.b.swap()

    entry.a.write.bind()
    this.common(p.advectA, dt, time)
    p.advectA.set('uGravity', gravity)
    p.advectA.set('uDrag', options.drag)
    p.advectA.set('uSigma', sigma)
    p.advectA.set('uMeltRate', material.meltRate)
    p.advectA.set('uMeltPoint', options.meltPoint)
    p.advectA.set('uConduction', options.conduction)
    p.advectA.set('uCooling', material.cooling)
    p.advectA.set('uHeatTop', options.heatTop)
    p.advectA.set('uCoreHeat', options.coreHeat)
    p.advectA.set('uSurfaceHeat', options.surfaceHeat)
    p.advectA.set('uSurfaceDepth', options.surfaceDepth)
    p.advectA.set('uColumnFeed', options.columnFeed)
    p.advectA.set('uOnsetSpread', options.onsetSpread)
    p.advectA.set('uNoiseScale', options.noiseScale)
    p.advectA.set('uFreezePoint', options.freezePoint)
    p.advectA.set('uSeed', options.seed + this.layers.indexOf(entry) * LAYER_SEED_STRIDE)
    p.advectA.set('uDelay', entry.layer.delay)
    p.advectA.setTexture('uA', entry.a.read.texture(0).handle)
    this.blitter.drawQuad()
    entry.a.swap()

    this.blitter.copy(entry.a.read.texture(0), entry.rhs)

    for (let i = 0; i < options.viscosityIterations; i += 1) {
      entry.a.write.bind()
      this.common(p.viscosity, dt, time)
      p.viscosity.set('uNuSolid', nuSolid)
      p.viscosity.set('uNuLiquid', nuLiquid)
      p.viscosity.set('uMeltPoint', options.meltPoint)
      p.viscosity.set('uYield', yieldStress)
      p.viscosity.setTexture('uA', entry.a.read.texture(0).handle)
      p.viscosity.setTexture('uRhs', entry.rhs.texture(0).handle)
      this.blitter.drawQuad()
      entry.a.swap()
    }

    this.project(entry, dt, time)

    for (let i = 0; i < REINIT_PASSES; i += 1) this.reinit(entry, tensionFlow)
    this.measureVolume(entry)
  }

  private snapshot(): void {
    const first = this.layers[0]
    if (!first || first.keyframes.has(this.steps)) return
    while (first.keyframes.size >= this.options.maxKeyframes) this.thinKeyframes()
    if (this.steps % this.keyframeSpacing !== 0) return
    for (const entry of this.layers) {
      const target = new MultiRenderTarget(this.gl, this.simWidth, this.simHeight, [this.fieldA, this.fieldB])
      this.blitter.copyPair(entry.a.read.texture(0), entry.b.read.texture(0), target)
      entry.keyframes.set(this.steps, target)
    }
  }

  private thinKeyframes(): void {
    const spacing = this.keyframeSpacing * 2
    for (const entry of this.layers) {
      for (const [step, keyframe] of entry.keyframes) {
        if (step % spacing === 0) continue
        keyframe.dispose()
        entry.keyframes.delete(step)
      }
    }
    this.keyframeSpacing = spacing
  }

  private restore(target: number): boolean {
    const first = this.layers[0]
    if (!first) return false
    let best = -1
    for (const step of first.keyframes.keys()) {
      if (step <= target && step > best) best = step
    }
    if (best < 0) return false
    for (const entry of this.layers) {
      if (!entry.keyframes.has(best)) return false
    }
    for (const entry of this.layers) {
      const keyframe = entry.keyframes.get(best)
      if (!keyframe) return false
      this.blitter.copy(keyframe.texture(0), entry.a.write)
      entry.a.swap()
      this.blitter.copy(keyframe.texture(1), entry.b.write)
      entry.b.swap()
      const base = entry.levels[0]
      if (base) this.clearTarget(base.pressure.read)
    }
    this.steps = best
    return true
  }

  private clearKeyframes(entry: LayerFields): void {
    for (const keyframe of entry.keyframes.values()) keyframe.dispose()
    entry.keyframes.clear()
  }
}
