import { MeltError } from '@meltgl/common'
import type { GraphicsSource } from './source.js'

export class VideoSource implements GraphicsSource {
  readonly dynamic = true

  private readonly video: HTMLVideoElement
  private readonly owned: boolean
  private loaded = false

  constructor(input: string | HTMLVideoElement) {
    this.owned = typeof input === 'string'
    if (typeof input === 'string') {
      this.video = document.createElement('video')
      this.video.crossOrigin = 'anonymous'
      this.video.muted = true
      this.video.loop = true
      this.video.playsInline = true
      this.video.src = input
    } else {
      this.video = input
    }
  }

  get ready(): boolean {
    return this.loaded && this.video.readyState >= 2
  }

  get width(): number {
    return this.video.videoWidth
  }

  get height(): number {
    return this.video.videoHeight
  }

  async load(): Promise<void> {
    if (this.video.readyState < 2) {
      const failure = this.video.error
      if (failure) throw new MeltError('source-unavailable', `the video element already failed: ${failure.message}`)
      await new Promise<void>((resolve, reject) => {
        const onLoaded = (): void => {
          this.video.removeEventListener('error', onFailed)
          resolve()
        }
        const onFailed = (): void => {
          this.video.removeEventListener('loadeddata', onLoaded)
          reject(new MeltError('source-unavailable', `failed to load video: ${this.video.error?.message ?? 'unknown error'}`))
        }
        this.video.addEventListener('loadeddata', onLoaded, { once: true })
        this.video.addEventListener('error', onFailed, { once: true })
      })
    }
    await this.video.play().catch(() => undefined)
    this.loaded = true
  }

  frame(): TexImageSource | null {
    return this.ready ? this.video : null
  }

  dispose(): void {
    this.loaded = false
    if (!this.owned) return
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
  }
}
