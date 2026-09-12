import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = (name: string, path: string): [string, string] => [name, fileURLToPath(new URL(path, import.meta.url))]

export default defineConfig({
  resolve: {
    alias: Object.fromEntries([
      alias('@meltgl/common', '../../Packages/Common/src/index.ts'),
      alias('@meltgl/geometry', '../../Packages/Geometry/src/index.ts'),
      alias('@meltgl/animation-clock', '../../Packages/AnimationClock/src/index.ts'),
      alias('@meltgl/noise-generator', '../../Packages/NoiseGenerator/src/index.ts'),
      alias('@meltgl/render-surface', '../../Packages/RenderSurface/src/index.ts'),
      alias('@meltgl/render-pipeline', '../../Packages/RenderPipeline/src/index.ts'),
      alias('@meltgl/displacement-engine', '../../Packages/DisplacementEngine/src/index.ts'),
      alias('@meltgl/filter-system', '../../Packages/FilterSystem/src/index.ts'),
      alias('@meltgl/transition-controller', '../../Packages/TransitionController/src/index.ts'),
      alias('@meltgl/source-graphics', '../../Packages/SourceGraphics/src/index.ts'),
      alias('@meltgl/element-host', '../../Packages/ElementHost/src/index.ts'),
      alias('meltgl', '../../Packages/MeltGL/src/index.ts'),
    ]),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
