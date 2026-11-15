export interface AssistResult {
  title: string
  snippet: string
  source: string
  link: string
}

export type AssistBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'code'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] }

export interface AssistAnswer {
  query: string
  blocks: AssistBlock[]
  /** Plain prose, used only when Gemini sent no usable text blocks. */
  answer: string | null
  results: AssistResult[]
  followUps: string[]
}

/**
 * MOONLINK: the lander's surviving assistant, backed by Google Gemini through
 * SerpApi's google_gemini engine. The SerpApi key stays on the server; the thread
 * token keeps the conversation going between questions.
 */
let threadToken: string | null = null
let contextProvider: (() => string) | null = null

export function setAssistantContext(provider: (() => string) | null): void {
  contextProvider = provider
}

export function forgetThread(): void {
  threadToken = null
}

export async function askAssistant(query: string): Promise<AssistAnswer> {
  const params = new URLSearchParams({ q: query })
  if (threadToken) params.set('token', threadToken)
  const context = contextProvider?.()
  if (context) params.set('ctx', context.slice(0, 1200))
  const res = await fetch(`/api/assist?${params.toString()}`)
  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    throw new Error(res.ok ? 'THE LINK RETURNED NOTHING' : `LINK ERROR ${res.status}`)
  }
  const body = payload as Partial<AssistAnswer> & { error?: string; token?: string | null }
  if (!res.ok || body.error) throw new Error((body.error ?? `LINK ERROR ${res.status}`).toUpperCase())
  threadToken = body.token ?? null
  return {
    query: body.query ?? query,
    blocks: body.blocks ?? [],
    answer: body.answer ?? null,
    results: body.results ?? [],
    followUps: body.followUps ?? [],
  }
}
