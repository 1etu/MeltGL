import type { Disposable, FrameInfo } from '@meltgl/common'
import type { MeltConfig } from './options.js'

export interface MeltRenderer extends Disposable {
  readonly backend: 'webgl2' | 'svg'
  readonly dynamic: boolean
  readonly settled: boolean
  prepare(): Promise<void>
  seek(time: number): void
  draw(frame: FrameInfo, progress: number): void
  configure(config: MeltConfig): void
}
