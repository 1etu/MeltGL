import { assert } from '@meltgl/common'
import type { Disposable } from '@meltgl/common'

export interface TextureOptions {
  width?: number
  height?: number
  internalFormat?: number
  format?: number
  type?: number
  filter?: number
  wrap?: number
  flipY?: boolean
  premultiply?: boolean
}

export class Texture implements Disposable {
  private readonly gl: WebGL2RenderingContext
  private readonly internalFormat: number
  private readonly format: number
  private readonly type: number
  private readonly filter: number
  private readonly wrap: number
  private readonly flipY: boolean
  private readonly premultiply: boolean

  private current: WebGLTexture
  private currentWidth: number
  private currentHeight: number

  constructor(gl: WebGL2RenderingContext, options: TextureOptions = {}) {
    this.gl = gl
    this.internalFormat = options.internalFormat ?? gl.RGBA8
    this.format = options.format ?? gl.RGBA
    this.type = options.type ?? gl.UNSIGNED_BYTE
    this.filter = options.filter ?? gl.LINEAR
    this.wrap = options.wrap ?? gl.CLAMP_TO_EDGE
    this.flipY = options.flipY ?? false
    this.premultiply = options.premultiply ?? false
    this.currentWidth = Math.max(1, options.width ?? 1)
    this.currentHeight = Math.max(1, options.height ?? 1)
    this.current = this.allocate(this.currentWidth, this.currentHeight)
  }

  get handle(): WebGLTexture {
    return this.current
  }

  get width(): number {
    return this.currentWidth
  }

  get height(): number {
    return this.currentHeight
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    if (w === this.currentWidth && h === this.currentHeight) return
    this.gl.deleteTexture(this.current)
    this.currentWidth = w
    this.currentHeight = h
    this.current = this.allocate(w, h)
  }

  upload(source: TexImageSource, width: number, height: number): void {
    const { gl } = this
    this.resize(width, height)
    gl.bindTexture(gl.TEXTURE_2D, this.current)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flipY)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiply)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  uploadData(data: ArrayBufferView, width: number, height: number): void {
    const { gl } = this
    this.resize(width, height)
    gl.bindTexture(gl.TEXTURE_2D, this.current)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, data)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  dispose(): void {
    this.gl.deleteTexture(this.current)
  }

  private allocate(width: number, height: number): WebGLTexture {
    const { gl } = this
    const texture = gl.createTexture()
    assert(texture, 'context-unavailable', 'failed to allocate a texture')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrap)
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.internalFormat, width, height)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }
}
