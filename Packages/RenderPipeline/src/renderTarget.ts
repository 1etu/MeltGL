import { assert } from '@meltgl/common'
import type { Disposable } from '@meltgl/common'
import { Texture } from './texture.js'

export class RenderTarget implements Disposable {
  readonly texture: Texture

  private readonly gl: WebGL2RenderingContext
  private readonly framebuffer: WebGLFramebuffer

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    const framebuffer = gl.createFramebuffer()
    assert(framebuffer, 'context-unavailable', 'failed to allocate a framebuffer')

    this.gl = gl
    this.framebuffer = framebuffer
    this.texture = new Texture(gl, { width, height })
    this.attach()
  }

  get width(): number {
    return this.texture.width
  }

  get height(): number {
    return this.texture.height
  }

  resize(width: number, height: number): void {
    if (width === this.texture.width && height === this.texture.height) return
    this.texture.resize(width, height)
    this.attach()
  }

  bind(): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.viewport(0, 0, this.texture.width, this.texture.height)
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer)
    this.texture.dispose()
  }

  private attach(): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture.handle, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    assert(
      status === gl.FRAMEBUFFER_COMPLETE,
      'framebuffer-incomplete',
      `framebuffer is incomplete: 0x${status.toString(16)}`,
    )
  }
}

export class PingPong implements Disposable {
  private front: RenderTarget
  private back: RenderTarget

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.front = new RenderTarget(gl, width, height)
    this.back = new RenderTarget(gl, width, height)
  }

  get read(): RenderTarget {
    return this.front
  }

  get write(): RenderTarget {
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
