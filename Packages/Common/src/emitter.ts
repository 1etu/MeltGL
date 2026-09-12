import type { Listener, Unsubscribe } from './types.js'

type AnyListener = (payload: never) => void

export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<AnyListener>>()

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    let bucket = this.listeners.get(event)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(event, bucket)
    }
    bucket.add(listener as AnyListener)
    return () => this.off(event, listener)
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe()
      listener(payload)
    })
    return unsubscribe
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as AnyListener)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const bucket = this.listeners.get(event)
    if (!bucket || bucket.size === 0) return
    for (const listener of [...bucket]) (listener as Listener<Events[K]>)(payload)
  }

  clear(): void {
    this.listeners.clear()
  }
}
