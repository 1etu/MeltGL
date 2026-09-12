import { assert } from '@meltgl/common'
import type { Disposable } from '@meltgl/common'
import { Texture } from './texture.js'
import type { TextureOptions } from './texture.js'

export class MultiRenderTarget implements Disposable {
  readonly textures: readonly Texture[]

  private readonly gl: WebGL2RenderingContext
  private readonly framebuffer: WebGLFramebuffer
  private readonly buffers: number[]

  constructor(gl: WebGL2RenderingContext, width: number, height: number, attachments: readonly TextureOptions[]) {
    assert(attachments.length > 0, 'invalid-options', 'a render target needs at least one attachment')
    const framebuffer = gl.createFramebuffer()
    assert(framebuffer, 'context-unavailable', 'failed to allocate a framebuffer')

    this.gl = gl
    this.framebuffer = framebuffer
    this.textures = attachments.map((options) => new Texture(gl, { ...options, width, height }))
    this.buffers = attachments.map((_, index) => gl.COLOR_ATTACHMENT0 + index)
    this.attach()
  }

  get width(): number {
    return this.textures[0]?.width ?? 0
  }

  get height(): number {
    return this.textures[0]?.height ?? 0
  }

  texture(index: number): Texture {
    const texture = this.textures[index]
    assert(texture, 'invalid-options', `no attachment at index ${index}`)
    return texture
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    for (const texture of this.textures) texture.resize(width, height)
    this.attach()
  }

  bind(): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.drawBuffers(this.buffers)
    gl.viewport(0, 0, this.width, this.height)
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer)
    for (const texture of this.textures) texture.dispose()
  }

  private attach(): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    this.textures.forEach((texture, index) => {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, texture.handle, 0)
    })
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    assert(
      status === gl.FRAMEBUFFER_COMPLETE,
      'framebuffer-incomplete',
      `multi render target is incomplete: 0x${status.toString(16)}`,
    )
  }
}

export class MultiPingPong implements Disposable {
  private front: MultiRenderTarget
  private back: MultiRenderTarget

  constructor(gl: WebGL2RenderingContext, width: number, height: number, attachments: readonly TextureOptions[]) {
    this.front = new MultiRenderTarget(gl, width, height, attachments)
    this.back = new MultiRenderTarget(gl, width, height, attachments)
  }

  get read(): MultiRenderTarget {
    return this.front
  }

  get write(): MultiRenderTarget {
    return this.back
  }

  swap(): void {
    const previous = this.front
    this.front = this.back
    this.back = previous
  }

  resize(width: number, height: number): void {
    this.front.resize(width, height)
    this.back.resize(width, height)
  }

  dispose(): void {
    this.front.dispose()
    this.back.dispose()
  }
}
