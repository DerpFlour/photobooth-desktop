import { overlayFor } from '../config/templates'
import { getStickerById } from '../config/stickers'
import { stickerUrl } from '../config/assets'
import { CapturedPhoto, TemplateConfig } from '../types'

const cache = new Map<string, Promise<HTMLImageElement>>()

// Loads an image once and remembers it (used for frames and stickers).
export function loadImage(url: string): Promise<HTMLImageElement> {
  let promise = cache.get(url)
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        cache.delete(url) // allow a retry
        reject(new Error(`Could not load image: ${url}`))
      }
      img.src = url
    })
    cache.set(url, promise)
  }
  return promise
}

export async function loadFrame(template: TemplateConfig, layoutId: string): Promise<HTMLImageElement | null> {
  const url = overlayFor(template, layoutId)
  return url ? loadImage(url) : null
}

export async function loadStickers(ids: string[]): Promise<Record<string, HTMLImageElement>> {
  const out: Record<string, HTMLImageElement> = {}
  for (const id of Array.from(new Set(ids))) {
    const def = getStickerById(id)
    const url = def ? stickerUrl(def.file) : undefined
    if (url) out[id] = await loadImage(url)
  }
  return out
}

// Decodes the captured photos into a form the canvas can draw quickly.
// Remember to call .close() on each when you're done with them.
export function loadPhotos(photos: (CapturedPhoto | null)[]): Promise<(ImageBitmap | null)[]> {
  return Promise.all(photos.map((p) => (p ? createImageBitmap(p.blob) : Promise.resolve(null))))
}