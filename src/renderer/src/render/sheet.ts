export type PaperKey = '4r' | '5x7' | 'a6' | 'a4' | 'letter'

// Paper sizes in millimetres. Prints are made at 300 dpi
// (4R = 101.6 x 152.4 mm = 1200 x 1800 pixels).
export const PAPERS: Record<PaperKey, { label: string; mmW: number; mmH: number }> = {
  '4r': { label: '4R · 4×6 in', mmW: 101.6, mmH: 152.4 },
  '5x7': { label: '5×7 in', mmW: 127, mmH: 177.8 },
  a6: { label: 'A6', mmW: 105, mmH: 148 },
  a4: { label: 'A4', mmW: 210, mmH: 297 },
  letter: { label: 'Letter', mmW: 215.9, mmH: 279.4 }
}

export const paperOf = (key: string): { label: string; mmW: number; mmH: number } =>
  PAPERS[key as PaperKey] ?? PAPERS['4r']

const DPI = 300
const mmToPx = (mm: number): number => Math.round((mm / 25.4) * DPI)

export type Sheet = { canvas: HTMLCanvasElement; copies: number; widthMm: number; heightMm: number }

// Lays copies of the finished strip out on a sheet of paper:
//  - a 2x6 strip fills a 4x6 sheet TWICE, side by side (cut down the middle)
//  - an 8-photo layout fills the whole 4x6 sheet by itself
//  - bigger paper (A4...) gets as many copies as fit
//  - a landscape layout on portrait paper (or the reverse) is turned a
//    quarter turn when that lets it print bigger
// natW/natH is the strip's natural size at 300 dpi.
export function buildSheet(o: {
  strip: ImageBitmap
  natW: number
  natH: number
  paper: string
  fill: boolean
  marginMm: number
}): Sheet {
  const paper = paperOf(o.paper)
  const W = mmToPx(paper.mmW)
  const H = mmToPx(paper.mmH)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const m = mmToPx(o.marginMm)

  // For a copy of size w x h: how many fit edge to edge, and how much the
  // block must shrink to respect the safe margin (or a too-big strip).
  const plan = (w: number, h: number): { cols: number; rows: number; scale: number; area: number } => {
    const cols = o.fill ? Math.max(1, Math.floor(W / w)) : 1
    const rows = o.fill ? Math.max(1, Math.floor(H / h)) : 1
    const scale = Math.min(1, (W - 2 * m) / (cols * w), (H - 2 * m) / (rows * h))
    return { cols, rows, scale, area: cols * rows * scale * scale * w * h }
  }
  const upright = plan(o.natW, o.natH)
  const sideways = plan(o.natH, o.natW)
  const turned = sideways.area > upright.area * 1.05
  const p = turned ? sideways : upright

  const cw = (turned ? o.natH : o.natW) * p.scale // one copy's width on the paper
  const ch = (turned ? o.natW : o.natH) * p.scale
  const x0 = (W - p.cols * cw) / 2
  const y0 = (H - p.rows * ch) / 2

  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const x = x0 + c * cw
      const y = y0 + r * ch
      if (!turned) {
        ctx.drawImage(o.strip, x, y, cw, ch)
      } else {
        // A quarter turn clockwise.
        ctx.save()
        ctx.translate(x + cw, y)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(o.strip, 0, 0, ch, cw)
        ctx.restore()
      }
    }
  }
  return { canvas, copies: p.cols * p.rows, widthMm: paper.mmW, heightMm: paper.mmH }
}

// A test page for checking that the paper size and edges come out right.
export function buildTestSheet(paperKey: string, marginMm: number): Sheet {
  const paper = paperOf(paperKey)
  const W = mmToPx(paper.mmW)
  const H = mmToPx(paper.mmH)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // A black border right at the paper's edge: if a side is missing, the printer cuts it off.
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, W - 6, H - 6)

  // The "safe margin" outline, if one is set.
  const m = mmToPx(marginMm)
  if (m > 0) {
    ctx.strokeStyle = '#e64d84'
    ctx.lineWidth = 3
    ctx.setLineDash([24, 16])
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m)
    ctx.setLineDash([])
  }

  // Center cross (the vertical line is where a two-strip print gets cut).
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2, 0)
  ctx.lineTo(W / 2, H)
  ctx.moveTo(0, H / 2)
  ctx.lineTo(W, H / 2)
  ctx.stroke()

  // A ruler along the top and left (a long tick every 50 mm, short every 10 mm).
  for (let mm = 10; mm <= paper.mmW; mm += 10) {
    const x = mmToPx(mm)
    ctx.beginPath()
    ctx.moveTo(x, 6)
    ctx.lineTo(x, mm % 50 === 0 ? 70 : 36)
    ctx.stroke()
  }
  for (let mm = 10; mm <= paper.mmH; mm += 10) {
    const y = mmToPx(mm)
    ctx.beginPath()
    ctx.moveTo(6, y)
    ctx.lineTo(mm % 50 === 0 ? 70 : 36, y)
    ctx.stroke()
  }

  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  const lines: [string, number][] = [
    ['Photo Booth test print', 64],
    [`${paper.label} · ${W} × ${H} px`, 40],
    ['You should see ALL FOUR sides', 40],
    ['of the black border.', 40],
    ['If a side is missing, raise the', 36],
    ['"Safe margin" in the admin.', 36],
    ['The vertical line = the cut line', 36],
    ['for a two-strip print.', 36]
  ]
  let y = Math.round(H * 0.18)
  for (const [text, size] of lines) {
    ctx.font = `bold ${size}px 'Segoe UI', sans-serif`
    ctx.fillText(text, W / 2, y)
    y += size + 22
  }
  return { canvas, copies: 1, widthMm: paper.mmW, heightMm: paper.mmH }
}