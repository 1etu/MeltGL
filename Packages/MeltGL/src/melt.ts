import { Clock } from '@meltgl/animation-clock'
import { Emitter, MeltError, clamp } from '@meltgl/common'
import type { Disposable, FrameInfo } from '@meltgl/common'
import { preferredBackend } from '@meltgl/render-surface'
import { TransitionController } from '@meltgl/transition-controller'
import type { MeltState } from '@meltgl/transition-controller'
import { MELT_DEFAULTS, MELT_RANGES, prefersReducedMotion, resolveMaxStepsPerFrame, validateOptions } from './options.js'
import type { MeltConfig, MeltGLOptions } from './options.js'
import { resolveSource } from './resolveSource.js'
import { SvgRenderer } from './svgRenderer.js'
import { WebglRenderer } from './webglRenderer.js'
import type { MeltRenderer } from './renderer.js'

export interface MeltEvents extends Record<string, unknown> {
  progress: number
  statechange: MeltState
  complete: MeltState
  contextlost: undefined
}

const buildConfig = (options: MeltGLOptions): MeltConfig => ({
  ...options.simulation,
  material: options.material ?? 'wax',
  ...(options.layers && options.layers.length > 0 ? { layers: options.layers } : {}),
})

const asMeltError = (error: unknown): MeltError => {
  if (error instanceof MeltError) return error
  return new MeltError('source-unavailable', error instanceof Error ? error.message : String(error))
}

export class MeltGL extends Emitter<MeltEvents> implements Disposable {
  readonly renderer: MeltRenderer
  readonly transition: TransitionController
  readonly duration: number

  private readonly clock: Clock
  private readonly reducedMotion: boolean
  private prepared = false
  private suspended = false
  private disposed = false

  private constructor(options: MeltGLOptions) {
    super()
    validateOptions(options)
    this.reducedMotion = (options.respectReducedMotion ?? true) && prefersReducedMotion()
    this.duration = clamp(options.duration ?? MELT_DEFAULTS.duration, ...MELT_RANGES.duration)

    const backend = options.backend ?? 'auto'
    const useWebgl = backend === 'webgl2' || (backend === 'auto' && preferredBackend() === 'webgl2')
    const config = buildConfig(options)
    const source = resolveSource(options.source)

    this.renderer = useWebgl
      ? new WebglRenderer({
          target: options.target,
          source,
          key: options.key ?? 'auto',
          simulation: config,
          filters: options.filters ?? [],
          maxPixelRatio: options.maxPixelRatio ?? MELT_DEFAULTS.maxPixelRatio,
          maxStepsPerFrame: resolveMaxStepsPerFrame(options.maxStepsPerFrame),
          onContextLost: () => this.onContextLost(),
        })
      : new SvgRenderer({ target: options.target, source, config, duration: this.duration })

    this.transition = new TransitionController({
      duration: this.reducedMotion ? MELT_DEFAULTS.reducedMotionDuration : this.duration,
      easing: options.easing ?? 'linear',
      loop: options.loop ?? false,
    })

    this.clock = new Clock()
    this.transition.attach(this.clock)
    this.clock.on('tick', this.onTick)
    this.transition.on('statechange', (state) => this.emit('statechange', state))
    this.transition.on('complete', (state) => {
      this.emit('complete', state)
      this.syncClock()
    })
  }

  static async create(options: MeltGLOptions): Promise<MeltGL> {
    const instance = new MeltGL(options)
    try {
      await instance.renderer.prepare()
      instance.prepared = true
      instance.render()
    } catch (error) {
      instance.dispose()
      throw asMeltError(error)
    }
    instance.syncClock()
    if (options.autoPlay) instance.play()
    return instance
  }

  get progress(): number {
    return this.transition.progress
  }

  get state(): MeltState {
    return this.transition.state
  }

  get backend(): 'webgl2' | 'svg' {
    return this.renderer.backend
  }

  get settled(): boolean {
    return this.renderer.settled
  }

  play(): void {
    this.assertLive()
    this.transition.play()
    this.syncClock()
  }

  reverse(): void {
    this.assertLive()
    this.transition.reverse()
    this.syncClock()
  }

  toggle(): void {
    this.assertLive()
    this.transition.toggle()
    this.syncClock()
  }

  pause(): void {
    this.assertLive()
    this.transition.pause()
    this.syncClock()
  }

  suspend(): void {
    this.assertLive()
    this.suspended = true
    this.clock.stop()
  }

  resume(): void {
    this.assertLive()
    this.suspended = false
    this.syncClock()
  }

  seek(progress: number): void {
    this.assertLive()
    this.transition.seek(progress)
    this.render()
  }

  reset(): void {
    this.assertLive()
    this.transition.reset()
    this.render()
  }

  configure(config: MeltConfig): void {
    this.assertLive()
    this.renderer.configure(config)
    this.render()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clock.dispose()
    this.transition.dispose()
    this.renderer.dispose()
    this.clear()
  }

  private assertLive(): void {
    if (this.disposed) throw new MeltError('disposed', 'this melt has been disposed')
  }

  private syncClock(): void {
    if (this.disposed || this.suspended) return
    const needsFrames = this.transition.running || this.renderer.dynamic || !this.renderer.settled
    if (needsFrames) this.clock.start()
    else this.clock.stop()
  }

  private render(frame: FrameInfo = { time: this.clock.time, delta: 0, frame: 0 }): void {
    if (!this.prepared || this.disposed) return
    this.renderer.seek(this.transition.eased * this.duration)
    this.renderer.draw(frame, this.transition.progress)
    this.emit('progress', this.transition.progress)
    this.syncClock()
  }

  private readonly onTick = (frame: FrameInfo): void => {
    this.render(frame)
  }

  private readonly onContextLost = (): void => {
    this.clock.stop()
    this.emit('contextlost', undefined)
  }
}

export const createMelt = (options: MeltGLOptions): Promise<MeltGL> => MeltGL.create(options)
