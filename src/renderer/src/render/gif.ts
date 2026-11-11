import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { EditState, LayoutConfig, TemplateConfig } from '../types'
import { drawStrip, StripAssets } from './drawStrip'

const pause = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

type Composite = { data: ImageData; delay: number }

// Builds the animated strip: the finished strip's frame, filter and stickers,
// with EVERY photo window playing its own footage at the same time, ending on
// a pause with the finished photos. It reuses drawStrip(), the same drawing
// function as the editor preview and the saved strip, so the look is identical.
export async function renderClipGif(o: {
  layout: LayoutConfig
  template: TemplateConfig
  edit: EditState
  finalAssets: StripAssets // the finished photos, frame and stickers
  shots: Record<string, ImageData[]> // footage by photo id
  fps: number
  width: number // width of the animated strip in pixels
  holdMs: number // pause on the finished strip
  onProgress?: (label: string, done: number, total: number) => void
}): Promise<Uint8Array | null> {
  const { layout, template, edit, finalAssets, shots, fps, width, holdMs, onProgress } = o
  const ids = finalAssets.photoIds
  const longest = Math.max(0, ...ids.map((id) => shots[id]?.length ?? 0))
  if (longest === 0) return null // nothing was recorded

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  const read = (): ImageData => ctx.getImageData(0, 0, canvas.width, canvas.height)

  const frames: Composite[] = []
  const delay = Math.max(20, Math.round(1000 / fps))
  const total = longest + 1 // the footage, plus the finished strip

  // Frame t of the clip shows footage frame t in EVERY window at once.
  for (let t = 0; t < longest; t++) {
    const opened: ImageBitmap[] = []
    const photos = await Promise.all(
      ids.map(async (id, i) => {
        const list = shots[id]
        if (!list || list.length === 0) return finalAssets.photos[i] ?? null // no footage: show the still
        const bitmap = await createImageBitmap(list[Math.min(t, list.length - 1)])
        opened.push(bitmap)
        return bitmap
      })
    )
    drawStrip(canvas, { layout, template, edit, assets: { ...finalAssets, photos }, pixelWidth: width, useCache: false })
    frames.push({ data: read(), delay })
    opened.forEach((b) => b.close())
    onProgress?.('Creating your behind-the-scenes clip…', t + 1, total)
    await pause()
  }

  // The last frame: the finished strip, held for a moment.
  drawStrip(canvas, { layout, template, edit, assets: finalAssets, pixelWidth: width, useCache: false })
  frames.push({ data: read(), delay: Math.max(100, Math.round(holdMs)) })
  onProgress?.('Creating your behind-the-scenes clip…', total, total)

  // ONE shared palette for the whole clip (built from a sample of frames),
  // so colors don't flicker from frame to frame.
  const { width: w, height: h } = frames[0].data
  const sampleFrames = Math.min(6, frames.length)
  const stride = 3 // every 3rd pixel is plenty for choosing colors
  const perFrame = Math.ceil((w * h) / stride)
  const sample = new Uint8ClampedArray(sampleFrames * perFrame * 4)
  let n = 0
  for (let s = 0; s < sampleFrames; s++) {
    const d = frames[Math.floor((s * (frames.length - 1)) / Math.max(1, sampleFrames - 1))].data.data
    for (let p = 0; p < w * h; p += stride) {
      const i = p * 4
      sample[n++] = d[i]
      sample[n++] = d[i + 1]
      sample[n++] = d[i + 2]
      sample[n++] = d[i + 3]
    }
  }
  const palette = quantize(sample.subarray(0, n), 256)

  const gif = GIFEncoder()
  for (let i = 0; i < frames.length; i++) {
    const index = applyPalette(frames[i].data.data, palette)
    gif.writeFrame(index, w, h, { palette, delay: frames[i].delay, repeat: 0 }) // 0 = loop forever
    onProgress?.('Finishing your clip…', i + 1, frames.length)
    await pause()
  }
  gif.finish()
  return gif.bytes()
}