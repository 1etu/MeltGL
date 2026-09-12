import { assert } from '@meltgl/common'
import type { MeshData } from './mesh.js'

export const createGrid = (columns: number, rows: number): MeshData => {
  assert(columns >= 1 && rows >= 1, 'invalid-options', 'grid needs at least one cell per axis')

  const cols = columns + 1
  const rws = rows + 1
  const count = cols * rws
  const positions = new Float32Array(count * 2)
  const uvs = new Float32Array(count * 2)

  for (let y = 0; y < rws; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const i = (y * cols + x) * 2
      const u = x / columns
      const v = y / rows
      positions[i] = u * 2 - 1
      positions[i + 1] = v * 2 - 1
      uvs[i] = u
      uvs[i + 1] = v
    }
  }

  const indexCount = columns * rows * 6
  const indices = count > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)

  let cursor = 0
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const a = y * cols + x
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices[cursor] = a
      indices[cursor + 1] = b
      indices[cursor + 2] = c
      indices[cursor + 3] = c
      indices[cursor + 4] = b
      indices[cursor + 5] = d
      cursor += 6
    }
  }

  return { positions, uvs, indices }
}
