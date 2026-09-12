export interface MeshData {
  readonly positions: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array | Uint32Array
}

export const vertexCount = (mesh: MeshData): number => mesh.positions.length / 2
