import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const alias = {
  '@meltgl/common': resolve(root, 'Packages/Common/src/index.ts'),
  '@meltgl/geometry': resolve(root, 'Packages/Geometry/src/index.ts'),
  '@meltgl/animation-clock': resolve(root, 'Packages/AnimationClock/src/index.ts'),
  '@meltgl/noise-generator': resolve(root, 'Packages/NoiseGenerator/src/index.ts'),
  '@meltgl/render-surface': resolve(root, 'Packages/RenderSurface/src/index.ts'),
  '@meltgl/render-pipeline': resolve(root, 'Packages/RenderPipeline/src/index.ts'),
  '@meltgl/displacement-engine': resolve(root, 'Packages/DisplacementEngine/src/index.ts'),
  '@meltgl/filter-system': resolve(root, 'Packages/FilterSystem/src/index.ts'),
  '@meltgl/transition-controller': resolve(root, 'Packages/TransitionController/src/index.ts'),
  '@meltgl/source-graphics': resolve(root, 'Packages/SourceGraphics/src/index.ts'),
  '@meltgl/element-host': resolve(root, 'Packages/ElementHost/src/index.ts'),
  meltgl: resolve(root, 'Packages/MeltGL/src/index.ts'),
}

const shared = {
  entryPoints: [resolve(root, 'Packages/MeltGL/src/index.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  alias,
  sourcemap: true,
  legalComments: 'none',
}

await build({ ...shared, outfile: resolve(root, 'Website/meltgl.js'), minify: false })
await build({ ...shared, outfile: resolve(root, 'Website/meltgl.min.js'), minify: true })

console.log('bundled Website/meltgl.js and Website/meltgl.min.js')
