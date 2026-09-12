import { createMelt, DEFAULT_SIMULATION_OPTIONS, MATERIALS } from 'meltgl'

const stage = document.getElementById('stage')
const teapot = document.getElementById('teapot')

let frames = 0
let seekStart = 0

const renderer = () => (window.melt ? window.melt.renderer : null)

const settled = () => {
  const current = renderer()
  if (!current || typeof current.settled === 'undefined') return null
  return !!current.settled
}

const simulation = () => {
  const current = renderer()
  return current && current.simulation ? current.simulation : null
}

const release = () => {
  if (!window.melt) return
  window.melt.dispose()
  window.melt = null
}

const spawn = (material, duration) =>
  createMelt({
    target: stage,
    source: teapot,
    material,
    duration,
    simulation: { ground: 'floor', dripRoom: 0.75 },
    respectReducedMotion: false,
    maxPixelRatio: 1,
  })

window.meltgl = { createMelt, MATERIALS, DEFAULT_SIMULATION_OPTIONS }
window.melt = null

window.benchMaterials = () => Object.keys(MATERIALS)

window.benchReady = async () => {
  await teapot.decode()
  return { width: teapot.naturalWidth, height: teapot.naturalHeight }
}

window.benchBuild = async (material, duration) => {
  release()
  const melt = await spawn(material, duration)
  melt.on('progress', () => {
    frames += 1
  })
  window.melt = melt
  return { backend: melt.backend, canvases: stage.querySelectorAll('canvas').length }
}

window.benchPlay = () => {
  window.melt.reset()
  frames = 0
  window.melt.play()
}

window.benchFrames = () => ({ frames, progress: window.melt.progress, state: window.melt.state })

window.benchSeek = () => {
  window.melt.pause()
  window.melt.reset()
  frames = 0
  seekStart = performance.now()
  window.melt.seek(1)
  return performance.now() - seekStart
}

window.benchSeekState = () => {
  const sim = simulation()
  return {
    elapsed: performance.now() - seekStart,
    progress: window.melt.progress,
    state: window.melt.state,
    frames,
    settled: settled(),
    steps: sim ? sim.steps : null,
    target: sim ? sim.target : null,
  }
}

window.benchLifetime = async (material, count) => {
  release()
  const before = performance.memory ? performance.memory.usedJSHeapSize : null
  let created = 0
  let failure = null
  for (let i = 0; i < count; i += 1) {
    try {
      const instance = await spawn(material, 1)
      instance.dispose()
      created += 1
    } catch (error) {
      failure = `${i}: ${error && error.message ? error.message : String(error)}`
      break
    }
  }
  const after = performance.memory ? performance.memory.usedJSHeapSize : null
  return {
    created,
    failure,
    before,
    after,
    canvases: stage.querySelectorAll('canvas').length,
    children: stage.childElementCount,
  }
}

window.benchGpu = () => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2')
  if (!gl) return 'no webgl2 context'
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown renderer'
  const lose = gl.getExtension('WEBGL_lose_context')
  if (lose) lose.loseContext()
  return name
}

window.benchRelease = () => {
  release()
  return stage.querySelectorAll('canvas').length
}

window.benchLoaded = true
