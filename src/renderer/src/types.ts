export type PhotoSlot = { x: number; y: number; width: number; height: number }

// A photo layout. Adding a new layout = adding one object of this type.
export type LayoutConfig = {
  id: string
  name: string
  description: string
  photoCount: number // always equals slots.length
  canvas: { width: number; height: number } // design space the slots use
  slots: PhotoSlot[]
  output: { width: number; height: number } // final exported pixel size
  enabled: boolean
}

// A frame/template. `overlays` maps a layout id to a transparent PNG file
// name inside src/renderer/src/assets/frames. No overlay = solid colors.
export type TemplateConfig = {
  id: string
  name: string
  layoutIds: string[] | 'all'
  backgroundColor: string
  slotColor: string
  textColor: string
  footerText: string
  overlays?: Record<string, string>
  custom?: boolean // imported by the admin (can be deleted)
  category?: string // the group shown in the category picker
}

// A photo taken by the camera. It lives in memory until the session ends.
export type CapturedPhoto = {
  id: string
  blob: Blob
  url: string // temporary address the screen can show (blob: URL)
  width: number
  height: number
}

// ---------- editing ----------

// Manual adjustments. Sliders use -100..100 (hue uses -180..180). 0 = no change.
export type Adjustments = {
  hue: number
  saturation: number
  lightness: number
  brightness: number
  contrast: number
}

// A sticker in the catalog. `file` is a PNG name in assets/stickers.
export type StickerDef = { id: string; name: string; file: string }

// One sticker placed on the strip. Position is its CENTER, in layout canvas units.
export type StickerInstance = {
  id: string // unique per placed sticker
  stickerId: string // which catalog sticker it is
  x: number
  y: number
  scale: number
  rotation: number // radians
  aboveFrame: boolean // false = drawn under the frame artwork
}

// Everything the guest changed in the editor.
export type EditState = {
  filterId: string
  adjustments: Adjustments
  stickers: StickerInstance[] // array order = layer order (last is on top)
}