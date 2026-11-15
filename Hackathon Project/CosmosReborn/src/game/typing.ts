/**
 * Loops the typewriter clip while transmission text is being typed out.
 * Plays through the game's own AudioContext (unlocked on the first key press),
 * which Safari allows; a plain <audio> element started mid-game can be blocked there.
 */
let ctx: AudioContext | null = null
let out: AudioNode | null = null
let buffer: AudioBuffer | null = null
let loading = false
let source: AudioBufferSourceNode | null = null
let lastActive = 0
let muted = false
let timer: number | null = null

export function setTypingOutput(context: AudioContext, destination: AudioNode): void {
  ctx = context
  out = destination
  if (!buffer && !loading) {
    loading = true
    fetch(`${import.meta.env.BASE_URL}sfx/typewriter.mp3`)
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((decoded) => {
        buffer = decoded
      })
      .catch(() => {
        loading = false
      })
  }
}

function stop(): void {
  if (source) {
    try {
      source.stop()
    } catch {
      /* already stopped */
    }
    source = null
  }
}

/** Call every frame text is being typed; the sound stops by itself once calls stop. */
export function typingFrame(): void {
  if (muted || !ctx || !out || !buffer) return
  lastActive = performance.now()
  if (!source) {
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.5
    node.connect(gain)
    gain.connect(out)
    node.start()
    source = node
  }
  if (timer === null) {
    timer = window.setInterval(() => {
      if (performance.now() - lastActive > 120) {
        stop()
        if (timer !== null) window.clearInterval(timer)
        timer = null
      }
    }, 60)
  }
}

export function setTypingMuted(value: boolean): void {
  muted = value
  if (muted) stop()
}
