import type { Disposable } from '@meltgl/common'

export interface GraphicsSource extends Disposable {
  readonly ready: boolean
  readonly dynamic: boolean
  readonly width: number
  readonly height: number
  load(): Promise<void>
  frame(): TexImageSource | null
}
