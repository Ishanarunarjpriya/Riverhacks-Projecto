export type VoiceName = 'moonlink' | 'narrator' | 'stranger' | 'maya' | 'okoro' | 'lena'

const STORAGE_KEY = 'cosmos-reborn-voices'
const urls = new Map<string, Promise<string | null>>()
let current: HTMLAudioElement | null = null
let available = true
let muted = false

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = readEnabled()

export function voicesEnabled(): boolean {
  return enabled && available
}

export function toggleVoices(): boolean {
  enabled = !enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    /* preference is optional */
  }
  if (!enabled) stopVoice()
  return enabled
}

export function setVoiceMuted(value: boolean): void {
  muted = value
  if (muted) stopVoice()
}

let probing: Promise<void> | null = null

function load(text: string, voice: VoiceName): Promise<string | null> {
  const key = `${voice}|${text}`
  let pending = urls.get(key)
  if (!pending) {
    const run = async (): Promise<string | null> => {
      if (probing) await probing
      if (!available) return null
      const request = fetch(`/api/tts?voice=${voice}&text=${encodeURIComponent(text)}`)
      if (!probing) probing = request.then((res) => {
        if (res.status === 503) available = false
      }, () => undefined)
      try {
        const res = await request
        if (res.status === 503) available = false
        if (!res.ok) return null
        return URL.createObjectURL(await res.blob())
      } catch {
        return null
      }
    }
    pending = run()
    urls.set(key, pending)
    pending.then((url) => {
      if (!url) urls.delete(key)
    })
  }
  return pending
}

export function preloadVoice(text: string, voice: VoiceName): void {
  if (voicesEnabled()) void load(clean(text), voice)
}

export function speak(text: string, voice: VoiceName, volume = 1): void {
  if (!voicesEnabled() || muted) return
  const line = clean(text)
  if (!line) return
  void load(line, voice).then((url) => {
    if (!url || !voicesEnabled() || muted) return
    stopVoice()
    const audio = new Audio(url)
    audio.volume = volume
    current = audio
    audio.play().catch(() => {})
  })
}

export function stopVoice(): void {
  if (current) {
    current.pause()
    current = null
  }
}

function clean(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^[A-Z ]+:\s*/, '')
    .replace(/[*'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
}

export function voiceForSpeaker(text: string): VoiceName {
  const t = text.toUpperCase()
  if (t.startsWith('MAYA')) return 'maya'
  if (t.startsWith('OKORO')) return 'okoro'
  if (t.startsWith('LENA')) return 'lena'
  if (t.startsWith('MOONLINK') || t.startsWith('TABLET')) return 'moonlink'
  return 'narrator'
}
