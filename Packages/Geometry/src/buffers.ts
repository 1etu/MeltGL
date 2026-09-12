import { assert } from '@meltgl/common'
import type { Disposable } from '@meltgl/common'
import type { MeshData } from './mesh.js'

export interface MeshBuffers extends Disposable {
  readonly vao: WebGLVertexArrayObject
  readonly indexCount: number
  readonly indexType: number
}

const createBuffer = (gl: WebGL2RenderingContext): WebGLBuffer => {
  const buffer = gl.createBuffer()
  assert(buffer, 'context-unavailable', 'failed to allocate a buffer')
  return buffer
}

export const POSITION_LOCATION = 0
export const UV_LOCATION = 1

export const uploadMesh = (gl: WebGL2RenderingContext, mesh: MeshData): MeshBuffers => {
  const vao = gl.createVertexArray()
  assert(vao, 'context-unavailable', 'failed to allocate a vertex array')

  const position = createBuffer(gl)
  const uv = createBuffer(gl)
  const index = createBuffer(gl)

  gl.bindVertexArray(vao)

  gl.bindBuffer(gl.ARRAY_BUFFER, position)
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(POSITION_LOCATION)
  gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, uv)
  gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(UV_LOCATION)
  gl.vertexAttribPointer(UV_LOCATION, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  return {
    vao,
    indexCount: mesh.indices.length,
    indexType: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    dispose: () => {
      gl.deleteBuffer(position)
      gl.deleteBuffer(uv)
      gl.deleteBuffer(index)
      gl.deleteVertexArray(vao)
    },
  }
}

export const drawMesh = (gl: WebGL2RenderingContext, buffers: MeshBuffers): void => {
  gl.bindVertexArray(buffers.vao)
  gl.drawElements(gl.TRIANGLES, buffers.indexCount, buffers.indexType, 0)
  gl.bindVertexArray(null)
}
