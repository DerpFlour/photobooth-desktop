import { StickerDef } from '../types'

// Stickers are drawn this many canvas units wide (at scale 1).
export const STICKER_BASE = 150

// To add a sticker: put a transparent PNG in assets/stickers and add a line.
export const STICKERS: StickerDef[] = [
  { id: 'heart-pink', name: 'Pink heart', file: 'heart-pink.png' },
  { id: 'heart-red', name: 'Red heart', file: 'heart-red.png' },
  { id: 'star', name: 'Star', file: 'star.png' },
  { id: 'sparkle', name: 'Sparkle', file: 'sparkle.png' },
  { id: 'sparkles', name: 'Sparkles', file: 'sparkles.png' },
  { id: 'flower', name: 'Flower', file: 'flower.png' },
  { id: 'smiley', name: 'Smiley', file: 'smiley.png' },
  { id: 'cloud', name: 'Cloud', file: 'cloud.png' },
  { id: 'rainbow', name: 'Rainbow', file: 'rainbow.png' },
  { id: 'bow', name: 'Bow', file: 'bow.png' },
  { id: 'crown', name: 'Crown', file: 'crown.png' },
  { id: 'cherries', name: 'Cherries', file: 'cherries.png' }
]

export const getStickerById = (id: string): StickerDef | undefined => STICKERS.find((s) => s.id === id)