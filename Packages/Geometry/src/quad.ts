import type { MeshData } from './mesh.js'

export const QUAD: MeshData = {
  positions: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
  indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
}
