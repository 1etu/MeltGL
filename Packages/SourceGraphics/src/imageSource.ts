import { MeltError, assert } from '@meltgl/common'
import type { GraphicsSource } from './source.js'

export class ImageSource implements GraphicsSource {
  readonly dynamic = false

  private image: HTMLImageElement | null = null
  private readonly input: string | HTMLImageElement
  private loaded = false

  constructor(input: string | HTMLImageElement) {
    this.input = input
  }

  get ready(): boolean {
    return this.loaded
  }

  get width(): number {
    return this.image?.naturalWidth ?? 0
  }

  get height(): number {
    return this.image?.naturalHeight ?? 0
  }

  async load(): Promise<void> {
    if (this.loaded) return
    const image = typeof this.input === 'string' ? new Image() : this.input
    if (typeof this.input === 'string') {
      image.crossOrigin = 'anonymous'
      image.src = this.input
    }
    if (!image.complete || image.naturalWidth === 0) {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = (): void => {
          image.removeEventListener('error', onFailed)
          resolve()
        }
        const onFailed = (): void => {
          image.removeEventListener('load', onLoaded)
          reject(new MeltError('source-unavailable', `failed to load ${image.src}`))
        }
        image.addEventListener('load', onLoaded, { once: true })
        image.addEventListener('error', onFailed, { once: true })
      })
    }
    assert(image.naturalWidth > 0, 'source-unavailable', `image has no dimensions: ${image.src}`)
    this.image = image
    this.loaded = true
  }

  frame(): TexImageSource | null {
    return this.loaded ? this.image : null
  }

  dispose(): void {
    this.image = null
    this.loaded = false
  }
}
