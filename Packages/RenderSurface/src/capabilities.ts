import type { RenderBackend } from '@meltgl/common'

export interface Capabilities {
  readonly backend: RenderBackend
  readonly maxTextureSize: number
  readonly maxRenderbufferSize: number
  readonly colorBufferFloat: boolean
  readonly colorBufferHalfFloat: boolean
  readonly vendor: string
  readonly renderer: string
}

export const probeCapabilities = (gl: WebGL2RenderingContext): Capabilities => {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    backend: 'webgl2',
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    colorBufferFloat: gl.getExtension('EXT_color_buffer_float') !== null,
    colorBufferHalfFloat: gl.getExtension('EXT_color_buffer_half_float') !== null,
    vendor: debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR)),
    renderer: debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER)),
  }
}

export const hasRenderableFloat = (gl: WebGL2RenderingContext): boolean =>
  gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null

export const FLOAT_TARGET_EXTENSIONS = 'EXT_color_buffer_float or EXT_color_buffer_half_float'

export const preferredBackend = (): Extract<RenderBackend, 'webgl2' | 'svg'> => {
  if (typeof document === 'undefined') return 'svg'
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return 'svg'
    const renderable = hasRenderableFloat(gl)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return renderable ? 'webgl2' : 'svg'
  } catch {
    return 'svg'
  }
}
