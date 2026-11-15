import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/**
 * ElevenLabs text-to-speech for cutscenes, transmissions and the MOONLINK app.
 * The key stays on the server (ELEVENLABS_API_KEY). Only the game's own voices
 * and short lines are accepted, every generated line is cached in memory and on
 * disk so it is paid for once, and each client is rate limited.
 */

const DEFAULT_VOICES = {
  moonlink: 'onwK4e9ZLuTAKqWW03F9',
  narrator: 'JBFqnCBsd6RMkjVDRZzb',
  stranger: 'N2lVS1w4EtoT3dr4eOWO',
  maya: '21m00Tcm4TlvDq8ikWAM',
  okoro: 'nPczCjzI2devNBz1zQrb',
  lena: 'EXAVITQu4vr4xnSDxMaL',
}

const MAX_CHARS = 320
const MODEL = 'eleven_turbo_v2_5'
const CACHE_DIR = resolve('.voice-cache')
const memory = new Map()
const MEMORY_LIMIT = 300
const hits = new Map()
const RATE_LIMIT = 40
const RATE_WINDOW = 60_000

function voiceId(name) {
  const override = process.env[`ELEVENLABS_VOICE_${name.toUpperCase()}`]
  return override || DEFAULT_VOICES[name]
}

function limited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW)
  list.push(now)
  hits.set(ip, list)
  return list.length > RATE_LIMIT
}

export async function speak({ text, voice, key, ip = 'local' }) {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  const name = String(voice ?? 'moonlink').toLowerCase()
  if (!line) return { status: 400, json: { error: 'NOTHING TO SAY' } }
  if (!(name in DEFAULT_VOICES)) return { status: 400, json: { error: 'UNKNOWN VOICE' } }
  if (!key) return { status: 503, json: { error: 'ELEVENLABS_API_KEY IS MISSING' } }

  const id = createHash('sha1').update(`${name}|${line}`).digest('hex')
  const hit = memory.get(id)
  if (hit) return { status: 200, audio: hit }
  const file = join(CACHE_DIR, `${id}.mp3`)
  if (existsSync(file)) {
    const audio = await readFile(file)
    remember(id, audio)
    return { status: 200, audio }
  }
  if (limited(ip)) return { status: 429, json: { error: 'TOO MANY VOICE LINES, SLOW DOWN' } }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId(name)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: line, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8 } }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`)
      return { status: 502, json: { error: `VOICE LINK FAILED (${res.status})` } }
    }
    const audio = Buffer.from(await res.arrayBuffer())
    remember(id, audio)
    try {
      if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
      await writeFile(file, audio)
    } catch {
      /* disk cache is optional */
    }
    return { status: 200, audio }
  } catch (err) {
    console.warn('ElevenLabs request failed', err)
    return { status: 502, json: { error: 'VOICE LINK FAILED' } }
  }
}

function remember(id, audio) {
  memory.set(id, audio)
  if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value)
}
