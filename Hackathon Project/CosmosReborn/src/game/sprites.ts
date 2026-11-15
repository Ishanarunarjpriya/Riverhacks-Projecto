export interface AnimatedSprite {
  frames: CanvasImageSource[]
  durations: number[]
  width: number
  height: number
}

interface DecodedFrame {
  image: { displayWidth: number; displayHeight: number; duration: number | null; close(): void }
}

interface Decoder {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null }
  decode(options: { frameIndex: number }): Promise<DecodedFrame>
  close(): void
}

type DecoderCtor = new (init: { data: ArrayBuffer; type: string }) => Decoder

function loadStatic(url: string, into: AnimatedSprite): void {
  const img = new Image()
  img.onload = () => {
    into.frames = [img]
    into.durations = [1]
    into.width = img.width
    into.height = img.height
  }
  img.src = url
}

export function loadAnimated(url: string, type = 'image/gif'): AnimatedSprite {
  const sprite: AnimatedSprite = { frames: [], durations: [], width: 0, height: 0 }
  const ImageDecoderCtor = (globalThis as unknown as { ImageDecoder?: DecoderCtor }).ImageDecoder
  if (!ImageDecoderCtor) {
    loadStatic(url, sprite)
    return sprite
  }
  void (async () => {
    try {
      const data = await (await fetch(url)).arrayBuffer()
      const decoder = new ImageDecoderCtor({ data, type })
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack?.frameCount ?? 1
      const frames: CanvasImageSource[] = []
      const durations: number[] = []
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i })
        const canvas = document.createElement('canvas')
        canvas.width = image.displayWidth
        canvas.height = image.displayHeight
        canvas.getContext('2d')?.drawImage(image as unknown as CanvasImageSource, 0, 0)
        frames.push(canvas)
        durations.push(Math.max(0.04, (image.duration ?? 100_000) / 1_000_000))
        sprite.width = canvas.width
        sprite.height = canvas.height
        image.close()
      }
      decoder.close()
      sprite.frames = frames
      sprite.durations = durations
    } catch {
      loadStatic(url, sprite)
    }
  })()
  return sprite
}

export function spriteFrame(sprite: AnimatedSprite, time: number): CanvasImageSource | null {
  if (sprite.frames.length === 0) return null
  const total = sprite.durations.reduce((a, b) => a + b, 0) || 1
  let t = time % total
  for (let i = 0; i < sprite.frames.length; i++) {
    t -= sprite.durations[i]
    if (t < 0) return sprite.frames[i]
  }
  return sprite.frames[sprite.frames.length - 1]
}

/** Loads a horizontal PNG sprite sheet. PNG transparency works the same in every browser, unlike GIF frames. */
export function loadSheet(url: string, frameWidth: number, frameDuration: number): AnimatedSprite {
  const sprite: AnimatedSprite = { frames: [], durations: [], width: 0, height: 0 }
  const img = new Image()
  img.onload = () => {
    const count = Math.max(1, Math.floor(img.width / frameWidth))
    const frames: CanvasImageSource[] = []
    for (let i = 0; i < count; i++) {
      const canvas = document.createElement('canvas')
      canvas.width = frameWidth
      canvas.height = img.height
      canvas.getContext('2d')?.drawImage(img, i * frameWidth, 0, frameWidth, img.height, 0, 0, frameWidth, img.height)
      frames.push(canvas)
    }
    sprite.width = frameWidth
    sprite.height = img.height
    sprite.durations = frames.map(() => frameDuration)
    sprite.frames = frames
  }
  img.src = url
  return sprite
}

export const SHIP_SPRITE = loadSheet(`${import.meta.env.BASE_URL}ui/ship-sheet.png`, 80, 0.08)
