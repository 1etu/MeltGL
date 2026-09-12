import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

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

const CHROME_DEFAULTS = {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}

const PLAY_SECONDS = 4
const PLAY_DURATION = 8
const LIFETIME_COUNT = 200
const STAGE = 360
const SETTLE_TIMEOUT = 3000

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', fail)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => done(port))
    })
  })

const chromePath = () =>
  (process.env.MELTGL_CHROME ?? CHROME_DEFAULTS[process.platform] ?? 'google-chrome').replace(/\\/g, '/')

const bundlePage = async (temp) => {
  const result = await build({
    entryPoints: [resolve(here, 'harness.js')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    alias,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    write: false,
  })
  const code = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
  const teapot = await readFile(resolve(root, 'Website/teapot.png'))
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>meltgl benchmark</title>
<style>
body { margin: 0; background: #fff; font: 12px Helvetica, Arial, sans-serif; }
#room { margin-bottom: 270px; }
#stage { width: ${STAGE}px; height: ${STAGE}px; }
</style>
</head>
<body>
<img id="teapot" src="data:image/png;base64,${teapot.toString('base64')}" alt="" hidden>
<div id="room"><div id="stage"></div></div>
<script type="module">${code}</script>
</body>
</html>
`
  const file = join(temp, 'bench.html')
  await writeFile(file, page, 'utf8')
  return file
}

const launch = async (temp, port) => {
  const chrome = spawn(
    chromePath(),
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${join(temp, 'profile').replace(/\\/g, '/')}`,
      '--use-angle=d3d11',
      '--ignore-gpu-blocklist',
      '--window-size=760,1100',
      '--force-device-scale-factor=1',
      '--enable-precise-memory-info',
      '--hide-scrollbars',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      return { chrome, version: await response.json() }
    } catch {
      await sleep(250)
    }
  }
  chrome.kill()
  throw new Error('chrome did not expose the devtools endpoint')
}

const attach = async (webSocketDebuggerUrl) => {
  const socket = new WebSocket(webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    socket.onopen = () => done()
    socket.onerror = () => fail(new Error('devtools socket failed to open'))
  })
  let sequence = 0
  const pending = new Map()
  const exceptions = []
  const logs = []
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
      return
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      exceptions.push(`${details.text} ${details.exception?.description ?? ''}`.trim())
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      logs.push(message.params.args.map((argument) => argument.value ?? argument.description ?? '').join(' '))
    }
  }
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = ++sequence
      const timer = setTimeout(() => {
        pending.delete(id)
        fail(new Error(`${method} timed out`))
      }, 300000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        done(message)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const message = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    const body = message.result
    if (!body) throw new Error(`no result for ${expression}`)
    if (body.exceptionDetails) {
      const details = body.exceptionDetails
      throw new Error(`page threw: ${details.exception?.description ?? details.text}`)
    }
    return body.result?.value
  }
  return { socket, send, evaluate, exceptions, logs }
}

const settle = async (evaluate) => {
  let previous = -1
  let stable = 0
  let candidate = null
  let state = await evaluate('window.benchSeekState()')
  const start = Date.now()
  while (Date.now() - start < SETTLE_TIMEOUT) {
    const quiet = state.progress >= 0.999 && state.frames === previous && state.settled !== false
    if (quiet) {
      stable += 1
      if (candidate === null) candidate = state.elapsed
      if (stable >= 3) return { wall: candidate, settled: state.settled, quiet: true, draws: state.frames, state }
    } else {
      stable = 0
      candidate = null
    }
    previous = state.frames
    await sleep(50)
    state = await evaluate('window.benchSeekState()')
  }
  return { wall: null, settled: state.settled, quiet: false, draws: state.frames, state }
}

const row = (cells, widths) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ')

let temp = null
let browser = null
let connection = null

const cleanup = async () => {
  if (connection) connection.socket.close()
  if (browser) browser.kill()
  if (temp) await rm(temp, { recursive: true, force: true }).catch(() => undefined)
}

const main = async () => {
  temp = await mkdtemp(join(tmpdir(), 'meltgl-bench-'))
  const file = await bundlePage(temp)
  const port = await freePort()
  const { chrome, version } = await launch(temp, port)
  browser = chrome
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?file:///${file.replace(/\\/g, '/')}`, { method: 'PUT' })
  ).json()
  connection = await attach(target.webSocketDebuggerUrl)
  const { send, evaluate, exceptions, logs } = connection
  await send('Runtime.enable')
  await send('Page.enable')

  let loaded = false
  for (let attempt = 0; attempt < 100 && !loaded; attempt += 1) {
    loaded = (await evaluate('window.benchLoaded === true')) === true
    if (!loaded) await sleep(200)
  }
  if (!loaded) throw new Error('benchmark page did not load the harness')

  const source = await evaluate('window.benchReady()')
  const gpu = await evaluate('window.benchGpu()')
  const materials = await evaluate('window.benchMaterials()')

  const rows = []
  let backend = 'unknown'
  for (const material of materials) {
    const built = await evaluate(`window.benchBuild(${JSON.stringify(material)}, ${PLAY_DURATION})`)
    backend = built.backend
    await evaluate('window.benchPlay()')
    await sleep(PLAY_SECONDS * 1000)
    const played = await evaluate('window.benchFrames()')
    const seek = await evaluate('window.benchSeek()')
    const settled = await settle(evaluate)
    rows.push({
      material,
      fps: played.frames / PLAY_SECONDS,
      frames: played.frames,
      progress: played.progress,
      seek,
      wall: settled.wall,
      quiet: settled.quiet,
      draws: settled.draws,
      settled: settled.settled,
      last: settled.state,
    })
  }

  const remaining = await evaluate('window.benchRelease()')
  const lifetime = await evaluate(`window.benchLifetime("wax", ${LIFETIME_COUNT})`)

  const widths = [10, 7, 8, 11, 12, 9, 7]
  const header = row(['material', 'fps', 'frames', 'seek(1) ms', 'settled ms', 'progress', 'draws'], widths)
  console.log('')
  console.log(`gpu           ${gpu}`)
  console.log(`chrome        ${version['Browser']}`)
  console.log(`backend       ${backend}`)
  console.log(`source        ${source.width}x${source.height} teapot on a ${STAGE}x${STAGE} stage at dpr 1`)
  console.log(`play window   ${PLAY_SECONDS}s of real time at duration ${PLAY_DURATION}`)
  console.log('')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const entry of rows) {
    console.log(
      row(
        [
          entry.material,
          entry.fps.toFixed(1),
          entry.frames,
          entry.seek.toFixed(1),
          entry.quiet ? entry.wall.toFixed(1) : `>${SETTLE_TIMEOUT}`,
          entry.progress.toFixed(3),
          entry.draws,
        ],
        widths,
      ),
    )
  }
  console.log('')
  for (const entry of rows) {
    if (entry.quiet) continue
    console.log(
      `${entry.material} did not settle in ${SETTLE_TIMEOUT} ms: settled ${entry.settled} state ${entry.last.state} steps ${entry.last.steps} of ${entry.last.target}`,
    )
  }
  console.log(
    `lifetime      ${lifetime.created}/${LIFETIME_COUNT} created and disposed, canvases left in target ${lifetime.canvases}, children left ${lifetime.children}`,
  )
  if (lifetime.failure) console.log(`lifetime      stopped at ${lifetime.failure}`)
  console.log(
    lifetime.before === null
      ? 'heap          performance.memory unavailable'
      : `heap          ${(lifetime.before / 1048576).toFixed(1)} MB before, ${(lifetime.after / 1048576).toFixed(1)} MB after`,
  )
  console.log(`canvases after dispose of the last instance: ${remaining}`)
  if (logs.length > 0) console.log(`console errors\n${logs.join('\n')}`)
  if (exceptions.length > 0) console.log(`page exceptions\n${exceptions.join('\n')}`)

  const exposesSettled = rows.some((entry) => entry.settled !== null)
  const allQuiet = rows.every((entry) => entry.quiet)
  const settledNote = !exposesSettled
    ? '`renderer.settled` is not exposed, so settling is judged by the frame counter alone.'
    : allQuiet
      ? '`renderer.settled` is exposed and reported true once the seek finished.'
      : `\`renderer.settled\` is exposed but never reported true, and the renderer kept drawing frames for the whole ${SETTLE_TIMEOUT} ms window, so the settle time is a lower bound rather than a measurement.`
  const date = new Date().toISOString().slice(0, 10)
  const report = `# Benchmarks

Written by \`pnpm bench\` (\`Tools/Benchmark/src/bench.mjs\`). Every number below is measured in headless
Chrome over the DevTools protocol, not estimated.

- Date: ${date}
- GPU: ${gpu}
- Chrome: ${version['Browser']}
- Backend: ${backend}
- Stage: ${STAGE}x${STAGE} at device pixel ratio 1, \`ground: 'floor'\`, \`dripRoom: 0.75\`
- Source: the ${source.width}x${source.height} teapot
- Frame budget: 16.7 ms at 60 Hz. The melt should hold 60 fps for a ${STAGE}x${STAGE} stage at DPR 1 on a
  discrete GPU. A material below 60 fps in the table is over budget.

## Frame rate and scrubbing

\`fps\` counts \`progress\` events over ${PLAY_SECONDS} seconds of real-time playback at \`duration: ${PLAY_DURATION}\`.
\`seek(1) ms\` is the synchronous cost of \`melt.reset(); melt.seek(1)\` measured with \`performance.now()\`
inside the page. \`settled ms\` is the wall time from that call until \`progress\` is 1 and no further frames
are drawn, which is longer than the synchronous cost when the seek is budgeted across frames.

| Material | fps | Frames in ${PLAY_SECONDS}s | Progress reached | reset + seek(1) (ms) | Settled (ms) | Draws after the seek |
| --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (entry) =>
      `| ${entry.material} | ${entry.fps.toFixed(1)} | ${entry.frames} | ${entry.progress.toFixed(3)} | ${entry.seek.toFixed(1)} | ${entry.quiet ? entry.wall.toFixed(1) : `not settled within ${SETTLE_TIMEOUT}`} | ${entry.draws} |`,
  )
  .join('\n')}

${settledNote}

## Instance lifetime

${LIFETIME_COUNT} instances created and disposed one after another on the same target.

| Measure | Value |
| --- | --- |
| Created and disposed | ${lifetime.created} of ${LIFETIME_COUNT} |
| Canvases left in the target | ${lifetime.canvases} |
| Child elements left in the target | ${lifetime.children} |
| Heap before | ${lifetime.before === null ? 'unavailable' : `${(lifetime.before / 1048576).toFixed(1)} MB`} |
| Heap after | ${lifetime.after === null ? 'unavailable' : `${(lifetime.after / 1048576).toFixed(1)} MB`} |
${lifetime.failure ? `| Stopped at | ${lifetime.failure} |\n` : ''}
${lifetime.canvases === 0 ? 'The target is empty after the loop, so `dispose()` removes the canvas it added.' : 'The target still holds a canvas after the loop, so `dispose()` leaks its canvas.'}

## Page exceptions

${exceptions.length === 0 ? 'None.' : exceptions.map((entry) => `- ${entry}`).join('\n')}
`
  await writeFile(resolve(root, 'Documentation/Benchmarks.md'), report, 'utf8')
  console.log('wrote Documentation/Benchmarks.md')

  const failures = []
  if (exceptions.length > 0) failures.push(`${exceptions.length} page exception(s)`)
  if (lifetime.failure) failures.push('the lifetime loop did not finish')
  if (lifetime.canvases !== 0) failures.push('the target still holds a canvas after dispose')
  if (failures.length > 0) {
    console.error(`benchmark failed: ${failures.join(', ')}`)
    process.exitCode = 1
  }
}

try {
  await main()
} finally {
  await cleanup()
}
