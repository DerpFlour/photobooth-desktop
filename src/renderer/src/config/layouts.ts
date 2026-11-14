import { getContent } from '../state/content'
import { LayoutConfig, PhotoSlot } from '../types'

// Evenly spaced photo slots in a grid. Used by the built-in layouts AND by
// every layout the admin builds.
export function gridSlots(o: {
  canvasWidth: number
  canvasHeight: number
  columns: number
  rows: number
  margin: number
  gap: number
  footer: number // empty space at the bottom for branding
}): PhotoSlot[] {
  const slotW = Math.round((o.canvasWidth - 2 * o.margin - o.gap * (o.columns - 1)) / o.columns)
  const slotH = Math.round((o.canvasHeight - o.margin - o.footer - o.gap * (o.rows - 1)) / o.rows)
  const slots: PhotoSlot[] = []
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.columns; c++) {
      slots.push({
        x: o.margin + c * (slotW + o.gap),
        y: o.margin + r * (slotH + o.gap),
        width: slotW,
        height: slotH
      })
    }
  }
  return slots
}

// 2x6 inch strip at 300 dpi = 600 x 1800 px, 4 photos stacked.
const strip4Slots = gridSlots({ canvasWidth: 600, canvasHeight: 1800, columns: 1, rows: 4, margin: 40, gap: 30, footer: 110 })
// 4x6 inch at 300 dpi = 1200 x 1800 px, 8 photos in 2 columns.
const grid8Slots = gridSlots({ canvasWidth: 1200, canvasHeight: 1800, columns: 2, rows: 4, margin: 40, gap: 30, footer: 110 })

// The layouts that ship with the app. They can be switched off, not deleted.
const BUILT_IN: LayoutConfig[] = [
  {
    id: 'strip-4',
    name: '4-Photo Strip',
    description: 'Classic vertical strip',
    photoCount: strip4Slots.length,
    canvas: { width: 600, height: 1800 },
    slots: strip4Slots,
    output: { width: 600, height: 1800 },
    enabled: true
  },
  {
    id: 'grid-8',
    name: '8-Photo Layout',
    description: '2 columns, 4 rows',
    photoCount: grid8Slots.length,
    canvas: { width: 1200, height: 1800 },
    slots: grid8Slots,
    output: { width: 1200, height: 1800 },
    enabled: true
  }
]

export const isCustomLayoutId = (id: string): boolean => id.startsWith('custom-')

export function customToLayout(c: CustomLayout, enabled = true): LayoutConfig {
  const slots = gridSlots({
    canvasWidth: c.canvasW, canvasHeight: c.canvasH, columns: c.columns, rows: c.rows,
    margin: c.margin, gap: c.gap, footer: c.footer
  })
  return {
    id: c.id,
    name: c.name,
    description: `${slots.length} photos`,
    photoCount: slots.length,
    canvas: { width: c.canvasW, height: c.canvasH },
    slots,
    output: { width: c.canvasW, height: c.canvasH },
    enabled
  }
}

// Returns a plain-words problem if a layout can't work, or null if it's fine.
export function slotProblem(c: CustomLayout): string | null {
  const slots = gridSlots({
    canvasWidth: c.canvasW, canvasHeight: c.canvasH, columns: c.columns, rows: c.rows,
    margin: c.margin, gap: c.gap, footer: c.footer
  })
  if (slots.length > 12) return 'That is too many photos (the most is 12).'
  const s = slots[0]
  if (s.width < 150 || s.height < 150) {
    return 'The photos would be too small. Use fewer photos, smaller spacing, or a bigger paper size.'
  }
  return null
}

// Built-in + custom layouts, with the admin's on/off switches applied.
// The list is rebuilt only when the content changes, so it stays the same
// object between renders (which keeps the screens calm).
let cachedFor: ContentFile | null = null
let cached: LayoutConfig[] = []

export function getAllLayouts(): LayoutConfig[] {
  const content = getContent()
  if (cachedFor !== content) {
    cached = [
      ...BUILT_IN.map((l) => ({ ...l, enabled: content.layoutEnabled[l.id] ?? true })),
      ...content.customLayouts.map((c) => customToLayout(c, content.layoutEnabled[c.id] ?? true))
    ]
    cachedFor = content
  }
  return cached
}

export const getEnabledLayouts = (): LayoutConfig[] => getAllLayouts().filter((l) => l.enabled)

// Finds any layout, even a switched-off one (older sessions may use it).
export const getLayoutById = (id: string | null | undefined): LayoutConfig | undefined =>
  getAllLayouts().find((l) => l.id === id)