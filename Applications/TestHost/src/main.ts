import { createMelt, DEFAULT_SIMULATION_OPTIONS, MATERIALS } from 'meltgl'
import type { GroundMode, MaterialName, MeltBackend, MeltGL } from 'meltgl'

declare global {
  interface Window {
    meltgl: {
      createMelt: typeof createMelt
      MATERIALS: typeof MATERIALS
      DEFAULT_SIMULATION_OPTIONS: typeof DEFAULT_SIMULATION_OPTIONS
    }
    melt: MeltGL | null
  }
}

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error(`missing element ${id}`)
  return found as T
}

const stage = element<HTMLDivElement>('stage')
const teapot = element<HTMLImageElement>('teapot')
const fileInput = element<HTMLInputElement>('file')
const backendSelect = element<HTMLSelectElement>('backend')
const materialSelect = element<HTMLSelectElement>('material')
const progressInput = element<HTMLInputElement>('progress')
const groundInput = element<HTMLInputElement>('ground')
const status = element<HTMLParagraphElement>('status')

const materialNames = Object.keys(MATERIALS) as MaterialName[]
for (const name of materialNames) {
  const option = document.createElement('option')
  option.value = name
  option.textContent = name
  materialSelect.append(option)
}

const query = new URLSearchParams(window.location.search)

const backends: MeltBackend[] = ['auto', 'webgl2', 'svg']
const requestedBackend = query.get('backend')
if (requestedBackend && backends.includes(requestedBackend as MeltBackend)) backendSelect.value = requestedBackend

const requestedMaterial = query.get('material')
if (requestedMaterial && materialNames.includes(requestedMaterial as MaterialName)) materialSelect.value = requestedMaterial
else materialSelect.value = 'wax'

const requestedDuration = Number(query.get('duration'))
const duration = Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : 8

const requestedGround = query.get('ground')
if (requestedGround) groundInput.checked = requestedGround === 'floor' || requestedGround === '1' || requestedGround === 'true'

const autoplay = query.get('autoplay') === '1'
const respectReducedMotion = query.get('reducedMotion') !== '0'

const ground = (): GroundMode => (groundInput.checked ? 'floor' : 'open')

let melt: MeltGL | null = null
let objectUrl: string | null = null

window.meltgl = { createMelt, MATERIALS, DEFAULT_SIMULATION_OPTIONS }
window.melt = null

const report = (): void => {
  if (!melt) {
    status.textContent = 'no instance'
    return
  }
  status.textContent = `backend ${melt.backend}  state ${melt.state}  progress ${melt.progress.toFixed(3)}  duration ${duration}s  ground ${ground()}`
}

const releaseUrl = (): void => {
  if (!objectUrl) return
  URL.revokeObjectURL(objectUrl)
  objectUrl = null
}

const build = async (source: HTMLImageElement | HTMLVideoElement): Promise<void> => {
  if (melt) {
    melt.dispose()
    melt = null
    window.melt = null
  }
  try {
    melt = await createMelt({
      target: stage,
      source,
      backend: backendSelect.value as MeltBackend,
      material: materialSelect.value as MaterialName,
      duration,
      simulation: { ground: ground(), dripRoom: groundInput.checked ? 0.75 : 0.6 },
      respectReducedMotion,
    })
  } catch (error) {
    status.textContent = `failed: ${error instanceof Error ? error.message : String(error)}`
    return
  }
  window.melt = melt
  melt.on('progress', (value) => {
    progressInput.value = String(Math.round(value * 1000))
    report()
  })
  melt.on('statechange', report)
  progressInput.value = '0'
  report()
  if (autoplay) melt.play()
}

const useImage = async (image: HTMLImageElement): Promise<void> => {
  await image.decode().catch(() => undefined)
  await build(image)
}

const useVideo = async (video: HTMLVideoElement): Promise<void> => {
  if (video.readyState < 1) {
    await new Promise<void>((resolve) => video.addEventListener('loadedmetadata', () => resolve(), { once: true }))
  }
  await video.play().catch(() => undefined)
  await build(video)
}

const useFile = async (file: File): Promise<void> => {
  releaseUrl()
  objectUrl = URL.createObjectURL(file)
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.src = objectUrl
    await useVideo(video)
    return
  }
  const image = new Image()
  image.src = objectUrl
  await useImage(image)
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) void useFile(file)
})

element('teapotButton').addEventListener('click', () => {
  releaseUrl()
  void useImage(teapot)
})

element('play').addEventListener('click', () => melt?.play())
element('reverse').addEventListener('click', () => melt?.reverse())
element('reset').addEventListener('click', () => melt?.reset())

progressInput.addEventListener('input', () => melt?.seek(Number(progressInput.value) / 1000))

const rebuild = (): void => {
  releaseUrl()
  void useImage(teapot)
}

backendSelect.addEventListener('change', rebuild)
materialSelect.addEventListener('change', () => melt?.configure({ material: materialSelect.value as MaterialName }))
groundInput.addEventListener('change', () =>
  melt?.configure({ ground: ground(), dripRoom: groundInput.checked ? 0.75 : 0.6 }),
)

report()
void useImage(teapot)
