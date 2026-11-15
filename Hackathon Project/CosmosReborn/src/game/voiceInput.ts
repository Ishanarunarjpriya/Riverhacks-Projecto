import { voicePlaying } from './voice'

export type VoiceStatus = 'off' | 'starting' | 'listening' | 'hearing' | 'transcribing' | 'error'

interface VoiceOptions {
  onStatus: (status: VoiceStatus, note: string) => void
  /** Returns false when the game cannot open the A.I. screen right now. */
  onQuery: (query: string) => boolean
}

const WAKE = /^\s*(?:hey|hi|okay|ok)[,.!]?\s+(?:a\.?i\.?|moonlink)\b[\s,.:;!?-]*(.*)$/i
const MAX_UTTERANCE_MS = 12_000
const MIN_START_LEVEL = 0.05
const MIN_STOP_LEVEL = 0.02
const SILENCE_TICKS = 14
const TICK_MS = 60
const CALIBRATION_TICKS = 9

/** Split "Hey AI, how do I make air?" into the wake flag and the question. */
export function parseWake(text: string): { woken: boolean; question: string } {
  const clean = text.replace(/\s+/g, ' ').trim()
  const match = clean.match(WAKE)
  if (!match) return { woken: false, question: clean }
  return { woken: true, question: match[1].trim() }
}

function micMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'MIC BLOCKED - ALLOW MIC ACCESS'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'NO MICROPHONE FOUND'
  if (error instanceof Error && error.message) return error.message.toUpperCase()
  return 'MIC UNAVAILABLE'
}

/**
 * Always-listening microphone with a local energy gate. It records one
 * utterance, sends it to /api/stt, and only acts when the transcript starts
 * with "Hey AI" (or after a bare wake phrase, the next utterance).
 */
export class VoiceInput {
  private options: VoiceOptions
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples: Uint8Array<ArrayBuffer> | null = null
  private recorder: MediaRecorder | null = null
  private timer: number | null = null
  private recording = false
  private loud = 0
  private silence = 0
  private startedAt = 0
  private cooldownUntil = 0
  private armed = false
  private calibrating = 0
  private noiseFloor = 0.01
  active = false

  constructor(options: VoiceOptions) {
    this.options = options
  }

  async enable(): Promise<void> {
    if (this.active) return
    this.active = true
    this.options.onStatus('starting', 'ALLOW THE MICROPHONE')

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO MICROPHONE API')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
      if (!this.active) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream

      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) throw new Error('NO AUDIO SUPPORT')
      const context = new Ctor()
      await context.resume()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      this.context = context
      this.analyser = analyser
      this.samples = new Uint8Array(new ArrayBuffer(analyser.fftSize))
      this.calibrating = CALIBRATION_TICKS
      this.noiseFloor = 0
      this.timer = window.setInterval(() => this.tick(), TICK_MS)
      this.options.onStatus('listening', 'SAY "HEY AI ..."')
    } catch (error) {
      this.active = false
      this.release()
      this.options.onStatus('error', micMessage(error))
    }
  }

  disable(): void {
    this.active = false
    this.armed = false
    this.release()
    this.options.onStatus('off', '')
  }

  private release(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.discard()
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.context) {
      void this.context.close().catch(() => undefined)
      this.context = null
    }
    this.analyser = null
    this.samples = null
    this.calibrating = 0
  }

  private discard(): void {
    const recorder = this.recorder
    this.recorder = null
    this.recording = false
    this.loud = 0
    this.silence = 0
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* already stopped */
      }
    }
  }

  private tick(): void {
    if (!this.active || !this.analyser || !this.samples) return

    // Never record the answer that MOONLINK is speaking out loud.
    if (voicePlaying()) {
      if (this.recording) this.discard()
      return
    }

    this.analyser.getByteTimeDomainData(this.samples)
    let power = 0
    for (let i = 0; i < this.samples.length; i++) {
      const v = (this.samples[i] - 128) / 128
      power += v * v
    }
    const level = Math.sqrt(power / this.samples.length)
    const now = performance.now()

    // Sample the room first so a fan or the game's own audio does not look like speech.
    if (this.calibrating > 0) {
      this.noiseFloor = Math.max(this.noiseFloor, level)
      this.calibrating--
      if (this.calibrating === 0) this.noiseFloor = Math.min(0.04, Math.max(0.01, this.noiseFloor))
      return
    }

    if (!this.recording) {
      if (now < this.cooldownUntil) return
      if (level > Math.max(MIN_START_LEVEL, this.noiseFloor * 2.5)) {
        this.loud++
        if (this.loud >= 3) this.begin()
      } else {
        this.loud = 0
      }
      return
    }

    if (level < Math.max(MIN_STOP_LEVEL, this.noiseFloor * 1.4)) this.silence++
    else this.silence = 0

    if (this.silence >= SILENCE_TICKS || now - this.startedAt > MAX_UTTERANCE_MS) this.end()
  }

  private begin(): void {
    if (!this.stream || this.recording) return
    if (typeof MediaRecorder === 'undefined') {
      this.options.onStatus('error', 'NO AUDIO RECORDER')
      this.disable()
      return
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
    if (!mime) {
      this.options.onStatus('error', 'NO AUDIO RECORDER')
      this.disable()
      return
    }

    const chunks: Blob[] = []
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(this.stream, { mimeType: mime })
    } catch {
      this.options.onStatus('error', 'NO AUDIO RECORDER')
      this.disable()
      return
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    recorder.onstop = () => {
      this.recording = false
      this.recorder = null
      if (this.active) void this.transcribe(new Blob(chunks, { type: mime }))
    }

    try {
      recorder.start()
    } catch {
      this.options.onStatus('error', 'MIC DID NOT START')
      this.disable()
      return
    }

    this.recorder = recorder
    this.recording = true
    this.startedAt = performance.now()
    this.silence = 0
    this.loud = 0
    this.options.onStatus('hearing', 'SPEAK NOW')
  }

  private end(): void {
    if (!this.recording || !this.recorder) return
    this.recording = false
    try {
      this.recorder.stop()
    } catch {
      this.recorder = null
    }
  }

  private async transcribe(blob: Blob): Promise<void> {
    if (!this.active) return
    if (blob.size < 1200) {
      this.resume('I DID NOT CATCH THAT')
      return
    }

    this.options.onStatus('transcribing', 'RELAYING THROUGH THE WRECK...')
    try {
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      })
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? `TRANSCRIBE ${res.status}`)
      const text = String(data.text ?? '').replace(/\s+/g, ' ').trim()
      if (!text) {
        this.resume('I DID NOT CATCH THAT')
        return
      }
      this.handle(text)
    } catch (error) {
      console.warn('Voice transcription failed', error)
      this.resume(error instanceof Error ? error.message.toUpperCase() : 'TRANSCRIBE FAILED')
    }
  }

  private handle(text: string): void {
    const { woken, question } = parseWake(text)
    let query = ''

    if (woken) {
      if (!question) {
        this.armed = true
        this.resume('ASK ME ANYTHING')
        return
      }
      query = question
      this.armed = false
    } else if (this.armed) {
      query = text
      this.armed = false
    } else {
      this.resume('SAY "HEY AI ..." FIRST')
      return
    }

    if (query.length < 2) {
      this.resume('I DID NOT CATCH THAT')
      return
    }

    const accepted = this.options.onQuery(query)
    if (!accepted) {
      this.resume('THE LANDER IS NOT READY')
      return
    }

    this.cooldownUntil = performance.now() + 5000
    this.options.onStatus('listening', 'SENT TO MOONLINK')
  }

  private resume(note: string): void {
    if (!this.active) return
    this.cooldownUntil = performance.now() + 700
    this.options.onStatus('listening', note)
  }
}
