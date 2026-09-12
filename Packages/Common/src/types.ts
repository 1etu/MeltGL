export type Vec2 = readonly [number, number]

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Rect extends Size {
  readonly x: number
  readonly y: number
}

export interface Disposable {
  dispose(): void
}

export type Listener<T> = (payload: T) => void

export type Unsubscribe = () => void

export interface FrameInfo {
  readonly time: number
  readonly delta: number
  readonly frame: number
}

export type Direction = 'down' | 'up' | 'left' | 'right'

export type RenderBackend = 'webgl2' | 'webgl' | 'svg'
