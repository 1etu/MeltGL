import { QUAD, drawMesh, uploadMesh } from '@meltgl/geometry'
import type { MeshBuffers } from '@meltgl/geometry'
import type { Disposable, FrameInfo } from '@meltgl/common'
import type { RenderSurface } from '@meltgl/render-surface'
import { PingPong } from './renderTarget.js'
import type { PassContext, RenderPass } from './pass.js'
import { Program } from './program.js'
import { COPY_FRAGMENT_GLSL, FULLSCREEN_VERTEX_GLSL } from './shaders.js'
import type { Texture } from './texture.js'

export class RenderPipeline implements Disposable {
  private readonly surface: RenderSurface
  private readonly gl: WebGL2RenderingContext
  private readonly quad: MeshBuffers
  private readonly targets: PingPong
  private readonly copy: Program
  private readonly passes: RenderPass[] = []

  constructor(surface: RenderSurface) {
    this.surface = surface
    this.gl = surface.gl
    this.quad = uploadMesh(this.gl, QUAD)
    const { width, height } = surface.drawingBufferSize
    this.targets = new PingPong(this.gl, width, height)
    this.copy = new Program(this.gl, FULLSCREEN_VERTEX_GLSL, COPY_FRAGMENT_GLSL)
  }

  add(pass: RenderPass): void {
    this.passes.push(pass)
  }

  insert(index: number, pass: RenderPass): void {
    this.passes.splice(index, 0, pass)
  }

  remove(pass: RenderPass): void {
    const index = this.passes.indexOf(pass)
    if (index >= 0) this.passes.splice(index, 1)
  }

  get length(): number {
    return this.passes.length
  }

  resize(width: number, height: number): void {
    this.targets.resize(width, height)
    for (const pass of this.passes) pass.resize?.(width, height)
  }

  render(source: Texture, frame: FrameInfo, progress: number): void {
    const { gl } = this
    const { width, height } = this.surface.drawingBufferSize
    const active = this.passes.filter((pass) => pass.enabled)
    gl.disable(gl.BLEND)

    if (active.length === 0) {
      this.surface.bindDefault()
      this.copy.use()
      this.copy.setTexture('uInput', source.handle)
      drawMesh(gl, this.quad)
      return
    }

    let input = source
    for (let i = 0; i < active.length; i += 1) {
      const pass = active[i]
      if (!pass) continue
      const last = i === active.length - 1

      if (last) {
        this.surface.bindDefault()
      } else {
        this.targets.write.bind()
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }

      const context: PassContext = {
        gl,
        frame,
        progress,
        width,
        height,
        source,
        input,
        drawQuad: () => drawMesh(gl, this.quad),
      }

      pass.render(context)

      if (!last) {
        input = this.targets.write.texture
        this.targets.swap()
      }
    }
  }

  dispose(): void {
    this.passes.length = 0
    this.copy.dispose()
    this.targets.dispose()
    this.quad.dispose()
  }
}
