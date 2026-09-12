import { assert } from '@meltgl/common'
import type { Disposable } from '@meltgl/common'

interface UniformRecord {
  readonly location: WebGLUniformLocation
  readonly type: number
}

const compile = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type)
  assert(shader, 'context-unavailable', 'failed to allocate a shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error'
    gl.deleteShader(shader)
    const stage = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
    assert(false, 'shader-compile', `${stage} shader failed to compile: ${log}`)
  }
  return shader
}

export class Program implements Disposable {
  readonly handle: WebGLProgram

  private readonly gl: WebGL2RenderingContext
  private readonly uniforms = new Map<string, UniformRecord>()
  private unit = 0

  constructor(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
    this.gl = gl
    const program = gl.createProgram()
    assert(program, 'context-unavailable', 'failed to allocate a program')

    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error'
      gl.deleteProgram(program)
      assert(false, 'program-link', `program failed to link: ${log}`)
    }

    this.handle = program
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < count; i += 1) {
      const info = gl.getActiveUniform(program, i)
      if (!info) continue
      const name = info.name.replace(/\[0\]$/, '')
      const location = gl.getUniformLocation(program, name)
      if (location) this.uniforms.set(name, { location, type: info.type })
    }
  }

  use(): void {
    this.gl.useProgram(this.handle)
    this.unit = 0
  }

  set(name: string, value: number | boolean | ArrayLike<number>): void {
    const record = this.uniforms.get(name)
    if (!record) return
    const { gl } = this
    const { location, type } = record

    if (typeof value === 'boolean') {
      gl.uniform1i(location, value ? 1 : 0)
      return
    }
    if (typeof value === 'number') {
      if (type === gl.INT || type === gl.BOOL) gl.uniform1i(location, value)
      else gl.uniform1f(location, value)
      return
    }

    const data = value instanceof Float32Array ? value : new Float32Array(Array.from(value))
    switch (type) {
      case gl.FLOAT_VEC2:
        gl.uniform2fv(location, data)
        break
      case gl.FLOAT_VEC3:
        gl.uniform3fv(location, data)
        break
      case gl.FLOAT_VEC4:
        gl.uniform4fv(location, data)
        break
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(location, false, data)
        break
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(location, false, data)
        break
      default:
        gl.uniform1fv(location, data)
    }
  }

  setTexture(name: string, texture: WebGLTexture): void {
    const record = this.uniforms.get(name)
    if (!record) return
    const { gl } = this
    const unit = this.unit
    this.unit += 1
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(record.location, unit)
  }

  dispose(): void {
    this.gl.deleteProgram(this.handle)
    this.uniforms.clear()
  }
}
