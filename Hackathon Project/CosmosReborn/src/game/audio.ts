import { setTypingOutput } from './typing'
export type SoundName =
  | 'step'
  | 'jump'
  | 'land'
  | 'pickup'
  | 'build'
  | 'hit'
  | 'break'
  | 'complete'
  | 'quest'
  | 'clue'
  | 'discover'
  | 'inspect'
  | 'deny'
  | 'tabletOpen'
  | 'tabletClose'
  | 'select'
  | 'alarm'
  | 'rumble'
  | 'crash'
  | 'shoot'
  | 'enemyShoot'
  | 'hurt'
  | 'enemyHit'
  | 'enemyDie'
  | 'turret'
  | 'warning'
  | 'helmetCrack'

const PENTATONIC = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33]

export class GameAudio {
  muted = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private music: GainNode | null = null
  private noise: AudioBuffer | null = null
  private bellTimer = 0

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.8
    this.master.connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.7
    this.sfx.connect(this.master)
    this.music = ctx.createGain()
    this.music.gain.value = 0.22
    this.music.connect(this.master)
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.startDrone()
    setTypingOutput(ctx, this.sfx)
  }

  close(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.sfx = null
    this.music = null
  }

  toggleMute(): void {
    this.muted = !this.muted
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05)
  }

  update(dt: number): void {
    if (!this.ctx || !this.music) return
    this.bellTimer -= dt
    if (this.bellTimer <= 0) {
      this.bellTimer = 3 + Math.random() * 5
      const f = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]
      this.tone(f, 2.8, 'sine', 0.12, 0, this.music)
      this.tone(f * 2.01, 1.6, 'sine', 0.03, 0.02, this.music)
    }
  }

  private clips = new Map<string, Promise<AudioBuffer | null>>()

  /** Fetches and decodes a recorded clip once so it can play instantly later. */
  preloadClip(url: string): void {
    const ctx = this.ctx
    if (!ctx || this.clips.has(url)) return
    this.clips.set(
      url,
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null),
    )
  }

  /** Plays a recorded clip (a voice line) through the game's audio, so mute applies to it. */
  playClip(url: string, volume = 1): void {
    const ctx = this.ctx
    if (!ctx || !this.sfx) return
    this.preloadClip(url)
    const out = this.sfx
    void this.clips.get(url)?.then((buffer) => {
      if (!buffer) return
      const node = ctx.createBufferSource()
      node.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = volume / 0.7
      node.connect(gain)
      gain.connect(out)
      node.start()
    })
  }

  play(name: SoundName): void {
    if (!this.ctx) return
    switch (name) {
      case 'step':
        this.burst(0.05, 500, 0.05, 'lowpass')
        break
      case 'jump':
        this.sweep(200, 520, 0.16, 'square', 0.05)
        break
      case 'land':
        this.burst(0.14, 280, 0.16, 'lowpass')
        break
      case 'pickup':
        this.tone(880, 0.07, 'square', 0.05)
        this.tone(1320, 0.09, 'square', 0.05, 0.07)
        break
      case 'build':
        for (const [i, f] of [392, 494, 587, 784].entries()) this.tone(f, 0.4, 'triangle', 0.08, i * 0.05)
        this.burst(0.12, 900, 0.1, 'bandpass')
        break
      case 'hit':
        this.burst(0.08, 1400, 0.18, 'bandpass')
        this.tone(110, 0.06, 'square', 0.06)
        break
      case 'break':
        this.burst(0.35, 600, 0.25, 'lowpass')
        this.sweep(140, 50, 0.3, 'sine', 0.2)
        break
      case 'complete':
        for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) this.tone(f, 0.22, 'triangle', 0.09, i * 0.09)
        break
      case 'quest':
        this.tone(392, 0.15, 'triangle', 0.07)
        this.tone(523.25, 0.3, 'triangle', 0.07, 0.12)
        break
      case 'clue':
        this.sweep(740, 520, 0.9, 'sine', 0.08)
        this.sweep(745, 528, 0.9, 'sine', 0.05)
        break
      case 'discover':
        for (const [i, f] of [440, 554.37, 659.25].entries()) this.tone(f, 0.25, 'sine', 0.08, i * 0.1)
        break
      case 'inspect':
        this.tone(600, 0.05, 'square', 0.04)
        this.tone(900, 0.05, 'square', 0.04, 0.06)
        break
      case 'deny':
        this.tone(140, 0.14, 'square', 0.06)
        break
      case 'tabletOpen':
        this.sweep(300, 900, 0.12, 'sine', 0.07)
        break
      case 'tabletClose':
        this.sweep(900, 300, 0.12, 'sine', 0.07)
        break
      case 'select':
        this.tone(1200, 0.03, 'square', 0.03)
        break
      case 'alarm':
        for (let i = 0; i < 4; i++) this.tone(i % 2 ? 660 : 880, 0.18, 'square', 0.05, i * 0.22)
        break
      case 'rumble':
        this.burst(1.6, 160, 0.2, 'lowpass')
        break
      case 'shoot':
        this.sweep(1400, 300, 0.12, 'square', 0.06)
        break
      case 'enemyShoot':
        this.sweep(600, 180, 0.18, 'sawtooth', 0.04)
        break
      case 'hurt':
        this.burst(0.15, 900, 0.18, 'bandpass')
        this.tone(90, 0.15, 'square', 0.08)
        break
      case 'enemyHit':
        this.tone(320, 0.05, 'square', 0.05)
        break
      case 'enemyDie':
        this.sweep(500, 60, 0.45, 'sawtooth', 0.07)
        this.burst(0.3, 500, 0.15, 'lowpass')
        break
      case 'turret':
        this.sweep(1800, 600, 0.08, 'square', 0.03)
        break
      case 'warning':
        for (let i = 0; i < 3; i++) this.tone(520, 0.12, 'square', 0.05, i * 0.2)
        break
      case 'helmetCrack': {
        // Glass splitting: three sharp snaps with glassy pings, then air hissing out.
        const snap = (delay: number, pitch: number) => {
          setTimeout(() => this.burst(0.05, 5200, 0.32, 'highpass'), delay * 1000)
          this.tone(pitch, 0.09, 'triangle', 0.05, delay)
          this.tone(pitch * 1.34, 0.07, 'sine', 0.035, delay + 0.01)
        }
        snap(0, 2600)
        snap(0.13, 3100)
        snap(0.3, 2200)
        setTimeout(() => this.burst(1.3, 7000, 0.07, 'highpass'), 420)
        break
      }
      case 'crash':
        this.burst(1.4, 900, 0.5, 'lowpass')
        this.sweep(120, 30, 1.2, 'sine', 0.5)
        break
    }
  }

  private startDrone(): void {
    const { ctx, music } = this
    if (!ctx || !music) return
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.connect(music)
    for (const [f, detune] of [[55, -6], [82.41, 5], [110, 3]]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      osc.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = 0.07
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.05 + Math.random() * 0.08
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.04
      lfo.connect(lfoGain).connect(g.gain)
      osc.connect(g).connect(filter)
      osc.start()
      lfo.start()
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0, out = this.sfx): void {
    const { ctx } = this
    if (!ctx || !out) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(volume, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  private sweep(from: number, to: number, duration: number, type: OscillatorType, volume: number): void {
    const { ctx, sfx } = this
    if (!ctx || !sfx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(volume, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g).connect(sfx)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  private burst(duration: number, cutoff: number, volume: number, type: BiquadFilterType): void {
    const { ctx, sfx, noise } = this
    if (!ctx || !sfx || !noise) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(volume, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter).connect(g).connect(sfx)
    src.start(t, Math.random() * 0.5)
    src.stop(t + duration + 0.05)
  }
}
