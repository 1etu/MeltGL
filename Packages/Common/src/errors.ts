export type MeltErrorCode =
  | 'context-unavailable'
  | 'shader-compile'
  | 'program-link'
  | 'framebuffer-incomplete'
  | 'source-unavailable'
  | 'invalid-options'
  | 'disposed'

export class MeltError extends Error {
  readonly code: MeltErrorCode

  constructor(code: MeltErrorCode, message: string) {
    super(`[MeltGL:${code}] ${message}`)
    this.name = 'MeltError'
    this.code = code
  }
}

export function assert(condition: unknown, code: MeltErrorCode, message: string): asserts condition {
  if (!condition) throw new MeltError(code, message)
}
