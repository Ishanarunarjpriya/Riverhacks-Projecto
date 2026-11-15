/**
 * ElevenLabs Scribe speech-to-text proxy. The microphone audio is recorded in
 * the browser and posted here; the API key stays on the server.
 */

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'
const MAX_BYTES = 2.5 * 1024 * 1024
const RATE_LIMIT = 20
const RATE_WINDOW = 60_000

const EXTENSIONS = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
}

const hits = new Map()

function limited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW)
  list.push(now)
  hits.set(ip, list)
  return list.length > RATE_LIMIT
}

/**
 * @param {{ audio: Buffer, type?: string, key?: string, ip?: string }} request
 * @returns {Promise<{ status: number, json: { text?: string, error?: string } }>}
 */
export async function transcribe({ audio, type, key, ip = 'local' }) {
  if (!key) return { status: 503, json: { error: 'ELEVENLABS_API_KEY IS MISSING' } }
  if (!audio?.length) return { status: 400, json: { error: 'NO AUDIO' } }
  if (audio.length > MAX_BYTES) return { status: 413, json: { error: 'AUDIO TOO LARGE' } }

  const mime = String(type ?? '').split(';')[0].trim().toLowerCase()
  if (!mime.startsWith('audio/')) return { status: 415, json: { error: 'SEND AUDIO' } }
  if (limited(ip)) return { status: 429, json: { error: 'TOO MANY QUESTIONS, SLOW DOWN' } }

  const form = new FormData()
  form.append('file', new Blob([audio], { type: mime }), `speech.${EXTENSIONS[mime] ?? 'webm'}`)
  form.append('model_id', 'scribe_v2')
  form.append('language_code', 'eng')
  form.append('tag_audio_events', 'false')

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn(`ElevenLabs STT ${res.status}: ${detail.slice(0, 200)}`)
      return { status: 502, json: { error: `TRANSCRIBE FAILED (${res.status})` } }
    }
    const data = await res.json()
    return { status: 200, json: { text: String(data?.text ?? '').trim() } }
  } catch (err) {
    console.warn('ElevenLabs STT request failed', err)
    return { status: 502, json: { error: 'TRANSCRIBE FAILED' } }
  }
}
