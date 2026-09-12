import { QUAD, drawMesh, uploadMesh } from '@meltgl/geometry'
import type { MeshBuffers } from '@meltgl/geometry'
import type { Disposable } from '@meltgl/common'
import { Program } from './program.js'
import { COPY_FRAGMENT_GLSL, FULLSCREEN_VERTEX_GLSL } from './shaders.js'
import type { MultiRenderTarget } from './multiRenderTarget.js'
import type { Texture } from './texture.js'

const COPY_PAIR_FRAGMENT_GLSL = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outFirst;
layout(location = 1) out vec4 outSecond;
uniform sampler2D uFirst;
uniform sampler2D uSecond;

void main() {
  outFirst = texture(uFirst, vUv);
  outSecond = texture(uSecond, vUv);
}
`

export class Blitter implements Disposable {
  private readonly gl: WebGL2RenderingContext
  private readonly quad: MeshBuffers
  private readonly single: Program
  private readonly pair: Program

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.quad = uploadMesh(gl, QUAD)
    this.single = new Program(gl, FULLSCREEN_VERTEX_GLSL, COPY_FRAGMENT_GLSL)
    this.pair = new Program(gl, FULLSCREEN_VERTEX_GLSL, COPY_PAIR_FRAGMENT_GLSL)
  }

  copy(source: Texture, target: { bind(): void } | null, width = 0, height = 0): void {
    const { gl } = this
    if (target) target.bind()
    else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
    }
    gl.disable(gl.BLEND)
    this.single.use()
    this.single.setTexture('uInput', source.handle)
    drawMesh(gl, this.quad)
  }

  copyPair(first: Texture, second: Texture, target: MultiRenderTarget): void {
    const { gl } = this
    target.bind()
    gl.disable(gl.BLEND)
    this.pair.use()
    this.pair.setTexture('uFirst', first.handle)
    this.pair.setTexture('uSecond', second.handle)
    drawMesh(gl, this.quad)
  }

  drawQuad(): void {
    drawMesh(this.gl, this.quad)
  }

  dispose(): void {
    this.single.dispose()
    this.pair.dispose()
    this.quad.dispose()
  }
}
