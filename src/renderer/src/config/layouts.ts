import { LayoutConfig, PhotoSlot } from '../types'

// Evenly spaced photo slots in a grid.
function gridSlots(o: {
  canvasWidth: number
  canvasHeight: number
  columns: number
  rows: number
  margin: number
  gap: number
  footer: number // empty space at the bottom for branding text
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
const strip4Slots = gridSlots({
  canvasWidth: 600, canvasHeight: 1800, columns: 1, rows: 4, margin: 40, gap: 30, footer: 110
})
// 4x6 inch at 300 dpi = 1200 x 1800 px, 8 photos in 2 columns.
const grid8Slots = gridSlots({
  canvasWidth: 1200, canvasHeight: 1800, columns: 2, rows: 4, margin: 40, gap: 30, footer: 110
})

export const LAYOUTS: LayoutConfig[] = [
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

export const getEnabledLayouts = (): LayoutConfig[] => LAYOUTS.filter((l) => l.enabled)

export const getLayoutById = (id: string | null | undefined): LayoutConfig | undefined =>
  LAYOUTS.find((l) => l.id === id)