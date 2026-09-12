import type { Disposable, FrameInfo } from '@meltgl/common'
import { Program } from './program.js'
import { FULLSCREEN_VERTEX_GLSL } from './shaders.js'
import type { Texture } from './texture.js'

export interface PassContext {
  readonly gl: WebGL2RenderingContext
  readonly frame: FrameInfo
  readonly progress: number
  readonly width: number
  readonly height: number
  readonly source: Texture
  readonly input: Texture
  drawQuad(): void
}

export interface RenderPass extends Disposable {
  readonly name: string
  enabled: boolean
  render(context: PassContext): void
  resize?(width: number, height: number): void
}

export abstract class ShaderPass implements RenderPass {
  readonly name: string

  enabled = true

  protected readonly program: Program

  constructor(gl: WebGL2RenderingContext, name: string, fragmentSource: string, vertexSource = FULLSCREEN_VERTEX_GLSL) {
    this.name = name
    this.program = new Program(gl, vertexSource, fragmentSource)
  }

  render(context: PassContext): void {
    this.program.use()
    this.program.set('uResolution', new Float32Array([context.width, context.height]))
    this.program.set('uTime', context.frame.time)
    this.program.set('uProgress', context.progress)
    this.program.setTexture('uInput', context.input.handle)
    this.program.setTexture('uSource', context.source.handle)
    this.bind(context)
    context.drawQuad()
  }

  dispose(): void {
    this.program.dispose()
  }

  protected bind(_context: PassContext): void {}
}
