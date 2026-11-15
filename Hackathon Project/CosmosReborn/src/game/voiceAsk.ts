/** A tiny bridge from the mic listener to the MOONLINK React panel. */
const pending: string[] = []
const listeners = new Set<(query: string) => void>()

export function submitVoiceQuery(query: string): void {
  const text = query.trim()
  if (!text) return
  if (listeners.size === 0) {
    pending.push(text)
    return
  }
  for (const listener of listeners) listener(text)
}

export function takePendingVoiceQuery(): string | null {
  return pending.shift() ?? null
}

export function subscribeVoiceQueries(listener: (query: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
