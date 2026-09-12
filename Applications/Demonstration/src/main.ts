import { createMelt, MATERIALS } from 'meltgl'
import type { MaterialInput, MaterialName, MeltGL } from 'meltgl'

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error(`missing element ${id}`)
  return found as T
}

const support = element('support')
const note = element('note')
const stage = element<HTMLDivElement>('stage')
const room = element<HTMLDivElement>('room')
const teapot = element<HTMLImageElement>('teapot')
const feed = element<HTMLVideoElement>('feed')
const select = element<HTMLSelectElement>('material')
const ground = element<HTMLInputElement>('ground')
const progress = element<HTMLInputElement>('progress')
const progressValue = element('progressValue')

let probe: WebGL2RenderingContext | null = null
try {
  probe = document.createElement('canvas').getContext('webgl2')
} catch {
  probe = null
}
const floatTargets = !!probe && !!(probe.getExtension('EXT_color_buffer_float') || probe.getExtension('EXT_color_buffer_half_float'))
support.textContent = probe && floatTargets
  ? 'Running the simulation on WebGL 2.'
  : 'This browser has no WebGL 2 with float render targets, so this is the SVG filter fallback.'

interface Field {
  id: 'viscosity' | 'tension' | 'yield'
  log?: boolean
  scale?: number
}

const VISCOSITY: Field = { id: 'viscosity', log: true }
const TENSION: Field = { id: 'tension', scale: 100 }
const YIELD: Field = { id: 'yield', scale: 100 }
const FIELDS: Field[] = [VISCOSITY, TENSION, YIELD]

const fromSlider = (field: Field, raw: number): number =>
  field.log ? Math.pow(10, -3 + 4.7 * (raw / 1000)) : raw / (field.scale ?? 1)

const toSlider = (field: Field, value: number): number =>
  field.log ? ((Math.log10(value) + 3) / 4.7) * 1000 : value * (field.scale ?? 1)

const readField = (field: Field): number => {
  const value = fromSlider(field, Number(element<HTMLInputElement>(field.id).value))
  element(`${field.id}Value`).textContent = value.toFixed(field.log ? 3 : 2)
  return value
}

const readMaterial = (): MaterialInput => ({
  base: select.value as MaterialName,
  viscosity: readField(VISCOSITY),
  tension: readField(TENSION),
  yield: readField(YIELD),
})

const loadPreset = (): void => {
  const preset = MATERIALS[select.value as MaterialName]
  for (const field of FIELDS) {
    element<HTMLInputElement>(field.id).value = String(Math.round(toSlider(field, preset[field.id])))
  }
}

let melt: MeltGL | null = null
let objectUrl: string | null = null

const SIDE_ROOM = 0.15
const TOP_ROOM = 0.08
const STAGE_CAP = 260

const dripRoom = (): number => (ground.checked ? 0.75 : 0.6)

let sourceSize = { width: 1, height: 1 }

const layout = (): void => {
  const scale = Math.min(STAGE_CAP / sourceSize.width, STAGE_CAP / sourceSize.height)
  const width = Math.round(sourceSize.width * scale)
  const height = Math.round(sourceSize.height * scale)
  const side = Math.round(width * SIDE_ROOM)
  const top = Math.round(height * TOP_ROOM)
  const bottom = Math.round(height * dripRoom())
  room.style.width = `${width + side * 2}px`
  room.style.height = `${height + top + bottom}px`
  stage.style.left = `${side}px`
  stage.style.top = `${top}px`
  stage.style.width = `${width}px`
  stage.style.height = `${height}px`
}

const fit = (width: number, height: number): void => {
  sourceSize = { width: width || 1, height: height || 1 }
  layout()
}

const apply = (): void => {
  if (!melt) return
  layout()
  melt.configure({
    material: readMaterial(),
    ground: ground.checked ? 'floor' : 'open',
    dripRoom: dripRoom(),
  })
}

const build = async (source: HTMLImageElement | HTMLVideoElement, width: number, height: number): Promise<void> => {
  if (melt) {
    melt.dispose()
    melt = null
  }
  fit(width, height)
  note.textContent = ''
  try {
    melt = await createMelt({
      target: stage,
      source,
      material: readMaterial(),
      duration: 8,
      simulation: { ground: ground.checked ? 'floor' : 'open', dripRoom: dripRoom() },
    })
  } catch (error) {
    note.textContent = `Could not start: ${error instanceof Error ? error.message : String(error)}`
    console.error(error)
    return
  }
  melt.on('progress', (value) => {
    progress.value = String(Math.round(value * 1000))
    progressValue.textContent = value.toFixed(2)
  })
  progress.value = '0'
  progressValue.textContent = '0.00'
}

const releaseUrl = (): void => {
  if (!objectUrl) return
  URL.revokeObjectURL(objectUrl)
  objectUrl = null
}

const useImage = async (image: HTMLImageElement): Promise<void> => {
  await build(image, image.naturalWidth, image.naturalHeight)
}

const useVideoElement = async (video: HTMLVideoElement): Promise<void> => {
  if (video.readyState < 1) {
    await new Promise<void>((resolve) => video.addEventListener('loadedmetadata', () => resolve(), { once: true }))
  }
  await video.play().catch(() => undefined)
  await build(video, video.videoWidth || 300, video.videoHeight || 170)
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
    await useVideoElement(video)
    return
  }
  const image = new Image()
  image.src = objectUrl
  await image.decode().catch(() => undefined)
  if (!image.naturalWidth) {
    note.textContent = 'That file did not decode as an image.'
    return
  }
  await useImage(image)
}

const BARS = ['#c02020', '#d07a10', '#c8b400', '#309030', '#2060c0', '#5030a0']
const FEED_WIDTH = 300
const FEED_HEIGHT = 170

let feedStarted = false
const startFeed = (): boolean => {
  if (feedStarted) return true
  const canvas = document.createElement('canvas')
  canvas.width = FEED_WIDTH * 2
  canvas.height = FEED_HEIGHT * 2
  const context = canvas.getContext('2d')
  if (!context) {
    note.textContent = 'This browser has no 2d canvas, so the live video source is unavailable.'
    return false
  }
  context.setTransform(2, 0, 0, 2, 0, 0)
  const draw = (time: number): void => {
    context.fillStyle = '#101010'
    context.fillRect(0, 0, FEED_WIDTH, FEED_HEIGHT)
    const barWidth = FEED_WIDTH / BARS.length
    for (let i = 0; i < BARS.length; i += 1) {
      const offset = Math.sin(time / 700 + i * 0.7) * 14
      context.fillStyle = BARS[i] ?? '#fff'
      context.fillRect(i * barWidth, 24 + offset, barWidth - 2, FEED_HEIGHT - 48)
    }
    context.fillStyle = '#fff'
    context.font = '14px Helvetica, Arial, sans-serif'
    context.fillText(`frame ${Math.floor(time / 16)}`, 10, 16)
  }
  const loop = (time: number): void => {
    if (!document.hidden) draw(time)
    requestAnimationFrame(loop)
  }
  if (typeof canvas.captureStream !== 'function') {
    note.textContent = 'This browser cannot capture a canvas as a video stream. Pick a video file instead.'
    return false
  }
  draw(0)
  requestAnimationFrame(loop)
  feed.srcObject = canvas.captureStream(30)
  feedStarted = true
  return true
}

const fileInput = element<HTMLInputElement>('file')
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) void useFile(file)
})

room.addEventListener('dragover', (event) => {
  event.preventDefault()
  room.classList.add('over')
})
room.addEventListener('dragleave', () => room.classList.remove('over'))
room.addEventListener('drop', (event) => {
  event.preventDefault()
  room.classList.remove('over')
  const file = event.dataTransfer?.files?.[0]
  if (file) void useFile(file)
})

element('useTeapot').addEventListener('click', () => {
  releaseUrl()
  void useImage(teapot)
})
element('useVideo').addEventListener('click', () => {
  releaseUrl()
  if (startFeed()) void useVideoElement(feed)
})

element('play').addEventListener('click', () => {
  if (!melt) return
  if (melt.progress >= 0.999) melt.reverse()
  else melt.play()
})
element('reset').addEventListener('click', () => melt?.reset())
progress.addEventListener('input', () => melt?.seek(Number(progress.value) / 1000))

select.addEventListener('change', () => {
  loadPreset()
  apply()
})
ground.addEventListener('change', apply)
for (const field of FIELDS) element(field.id).addEventListener('input', apply)

loadPreset()
readMaterial()
if (teapot.complete && teapot.naturalWidth > 0) {
  void useImage(teapot)
} else {
  teapot.addEventListener('load', () => void useImage(teapot), { once: true })
}
