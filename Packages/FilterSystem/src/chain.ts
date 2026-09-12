import type { Disposable } from '@meltgl/common'
import { FilterPass } from './filter.js'
import type { FilterDefinition } from './filter.js'

export class FilterChain implements Disposable {
  private readonly gl: WebGL2RenderingContext
  private readonly entries: FilterPass[] = []

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  get passes(): readonly FilterPass[] {
    return this.entries
  }

  add(definition: FilterDefinition): FilterPass {
    const pass = new FilterPass(this.gl, definition)
    this.entries.push(pass)
    return pass
  }

  remove(pass: FilterPass): void {
    const index = this.entries.indexOf(pass)
    if (index < 0) return
    this.entries.splice(index, 1)
    pass.dispose()
  }

  dispose(): void {
    for (const pass of this.entries) pass.dispose()
    this.entries.length = 0
  }
}
