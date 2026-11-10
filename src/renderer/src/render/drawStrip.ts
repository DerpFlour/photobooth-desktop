import { STICKER_BASE } from '../config/stickers'
import { EditState, LayoutConfig, StickerInstance, TemplateConfig } from '../types'
import { applyMatrix, buildPhotoMatrix, Matrix, matrixKey } from './colorMatrix'

// Everything the drawing needs, already loaded.
export type StripAssets = {
  photos: (ImageBitmap | null)[] // one per slot
  photoIds: string[] // used to remember processed photos
  frame: HTMLImageElement | null // the template's transparent PNG, if any
  stickers: Record<string, HTMLImageElement> // by sticker id
}

// "Cover" crop: the part of an image that fills a box of the given shape.
export function coverSource(
  imgW: number,
  imgH: number,
  boxAspect: number
): { sx: number; sy: number; sw: number; sh: number } {
  let sw: number
  let sh: number
  if (imgW / imgH > boxAspect) {
    sh = imgH
    sw = imgH * boxAspect
  } else {
    sw = imgW
    sh = imgW / boxAspect
  }
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh }
}

// Photos that were already cropped + color-processed for a given size.
// Makes dragging stickers smooth: only the colors need recalculating when a
// slider moves, not when a sticker moves.
const slotCache = new Map<string, HTMLCanvasElement>()
export const clearSlotCache = (): void => slotCache.clear()

function processedSlot(
  img: ImageBitmap,
  id: string,
  tw: number,
  th: number,
  matrix: Matrix | null,
  useCache: boolean
): HTMLCanvasElement {
  const key = `${id}|${tw}x${th}|${matrix ? matrixKey(matrix) : 'none'}`
  if (useCache) {
    const hit = slotCache.get(key)
    if (hit) return hit
  }
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d', { willReadFrequently: matrix !== null }) as CanvasRenderingContext2D
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const { sx, sy, sw, sh } = coverSource(img.width, img.height, tw / th)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th)
  if (matrix) {
    const data = ctx.getImageData(0, 0, tw, th)
    applyMatrix(data.data, matrix)
    ctx.putImageData(data, 0, 0)
  }
  if (useCache) {
    if (slotCache.size > 80) slotCache.clear()
    slotCache.set(key, canvas)
  }
  return canvas
}

function drawStickers(
  ctx: CanvasRenderingContext2D,
  list: StickerInstance[],
  images: Record<string, HTMLImageElement>
): void {
  for (const s of list) {
    const img = images[s.stickerId]
    if (!img) continue
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(s.rotation)
    ctx.scale(s.scale, s.scale)
    ctx.drawImage(img, -STICKER_BASE / 2, -STICKER_BASE / 2, STICKER_BASE, STICKER_BASE)
    ctx.restore()
  }
}

// Draws the whole strip onto a canvas, `pixelWidth` pixels wide. The editor
// calls this small; export calls it at full print size. SAME code, so the
// preview always matches the file.
export function drawStrip(
  canvas: HTMLCanvasElement,
  o: {
    layout: LayoutConfig
    template: TemplateConfig
    edit: EditState
    assets: StripAssets
    pixelWidth: number
    useCache?: boolean
  }
): void {
  const { layout, template, edit, assets } = o
  const cw = layout.canvas.width
  const ch = layout.canvas.height
  const w = Math.max(1, Math.round(o.pixelWidth))
  const h = Math.max(1, Math.round((w * ch) / cw))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a drawing surface.')
  const k = w / cw // from here on we draw in layout "canvas" units
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.setTransform(k, 0, 0, k, 0, 0)

  // 1. Background
  ctx.fillStyle = template.backgroundColor
  ctx.fillRect(0, 0, cw, ch)

  // 2. Photos (with the guest's color edits)
  const hasFrame = assets.frame !== null
  const bleed = hasFrame ? 3 : 0 // extend under the frame to avoid hairline gaps
  const radius = hasFrame ? 16 : 14
  const matrix = buildPhotoMatrix(edit)

  layout.slots.forEach((s, i) => {
    const rx = s.x - bleed
    const ry = s.y - bleed
    const rw = s.width + bleed * 2
    const rh = s.height + bleed * 2
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(rx, ry, rw, rh, radius)
    ctx.clip()
    const img = assets.photos[i]
    if (img) {
      const tw = Math.max(1, Math.round(rw * k))
      const th = Math.max(1, Math.round(rh * k))
      const slot = processedSlot(img, assets.photoIds[i] || String(i), tw, th, matrix, o.useCache ?? false)
      ctx.drawImage(slot, rx, ry, rw, rh)
    } else {
      ctx.fillStyle = template.slotColor
      ctx.fillRect(rx, ry, rw, rh)
    }
    ctx.restore()
  })

  // 3. Stickers UNDER the frame artwork (visible through the windows)
  drawStickers(ctx, edit.stickers.filter((s) => !s.aboveFrame), assets.stickers)

  // 4. Frame artwork, or footer text for solid-color templates
  if (assets.frame) {
    ctx.drawImage(assets.frame, 0, 0, cw, ch)
  } else if (template.footerText) {
    ctx.fillStyle = template.textColor
    ctx.font = "bold 44px 'Segoe UI', sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(template.footerText, cw / 2, ch - 45)
  }

  // 5. Stickers in FRONT of the frame
  drawStickers(ctx, edit.stickers.filter((s) => s.aboveFrame), assets.stickers)
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the picture.'))), type, quality)
  )
}

// A small JPEG copy for galleries, so the home screen never loads big files.
export function makeThumbnail(source: HTMLCanvasElement, maxHeight = 360): Promise<Blob> {
  const k = Math.min(1, maxHeight / source.height)
  const t = document.createElement('canvas')
  t.width = Math.max(1, Math.round(source.width * k))
  t.height = Math.max(1, Math.round(source.height * k))
  const ctx = t.getContext('2d') as CanvasRenderingContext2D
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, t.width, t.height)
  return canvasToBlob(t, 'image/jpeg', 0.8)
}