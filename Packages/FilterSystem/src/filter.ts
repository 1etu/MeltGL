import { ShaderPass } from '@meltgl/render-pipeline'
import type { PassContext } from '@meltgl/render-pipeline'

export type FilterUniforms = Record<string, number | boolean | ArrayLike<number>>

export interface FilterDefinition {
  readonly name: string
  readonly fragment: string
  readonly uniforms?: FilterUniforms
}

export class FilterPass extends ShaderPass {
  readonly uniforms: FilterUniforms

  constructor(gl: WebGL2RenderingContext, definition: FilterDefinition) {
    super(gl, definition.name, definition.fragment)
    this.uniforms = { ...definition.uniforms }
  }

  protected override bind(_context: PassContext): void {
    for (const key of Object.keys(this.uniforms)) {
      const value = this.uniforms[key]
      if (value !== undefined) this.program.set(key, value)
    }
  }
}
