import { Adjustments } from '../types'

// A color matrix is 20 numbers (4 rows x 5 columns) that turn every pixel's
// red/green/blue/alpha into new values. The 5th column is an "add" amount
// (0..1). The preview AND the export both use this same math.
export type Matrix = number[]

export const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]

// Combine two matrices: result = apply `first`, then `second`.
export function chain(first: Matrix, second: Matrix): Matrix {
  const out: Matrix = new Array(20).fill(0)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = 0
      for (let i = 0; i < 4; i++) v += second[r * 5 + i] * first[i * 5 + c]
      if (c === 4) v += second[r * 5 + 4]
      out[r * 5 + c] = v
    }
  }
  return out
}
const chainAll = (...ms: Matrix[]): Matrix => ms.reduce((acc, m) => chain(acc, m), IDENTITY)

const LR = 0.2126
const LG = 0.7152
const LB = 0.0722 // how bright each color looks

// s: 1 = unchanged, 0 = black & white, 2 = very colorful
export const saturation = (s: number): Matrix => [
  LR * (1 - s) + s, LG * (1 - s), LB * (1 - s), 0, 0,
  LR * (1 - s), LG * (1 - s) + s, LB * (1 - s), 0, 0,
  LR * (1 - s), LG * (1 - s), LB * (1 - s) + s, 0, 0,
  0, 0, 0, 1, 0
]

// Rotate all colors around the color wheel (standard hue-rotate formula).
export const hueRotate = (deg: number): Matrix => {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0,
    0, 0, 0, 1, 0
  ]
}

// Multiply brightness: 1 = unchanged.
export const gain = (g: number): Matrix => [g, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, 1, 0]

// Contrast around mid-gray: 1 = unchanged.
export const contrast = (f: number): Matrix => {
  const o = 0.5 * (1 - f)
  return [f, 0, 0, 0, o, 0, f, 0, 0, o, 0, 0, f, 0, o, 0, 0, 0, 1, 0]
}

// Lightness: t > 0 blends toward white, t < 0 toward black (t is -0.5..0.5).
export const lift = (t: number): Matrix => {
  const s = 1 - Math.abs(t)
  const o = t > 0 ? t : 0
  return [s, 0, 0, 0, o, 0, s, 0, 0, o, 0, 0, s, 0, o, 0, 0, 0, 1, 0]
}

// Per-channel color cast: multiply and/or add to red, green, blue.
export const tint = (r: number, g: number, b: number, ro = 0, go = 0, bo = 0): Matrix => [
  r, 0, 0, 0, ro, 0, g, 0, 0, go, 0, 0, b, 0, bo, 0, 0, 0, 1, 0
]

const SEPIA: Matrix = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0
]
const mix = (a: Matrix, b: Matrix, t: number): Matrix => a.map((v, i) => v * (1 - t) + b[i] * t)

export type FilterDef = { id: string; name: string; matrix: Matrix }

// Photobooth-style presets. To add one, add a line here. It appears in the app.
export const FILTERS: FilterDef[] = [
  { id: 'original', name: 'Original', matrix: IDENTITY },
  { id: 'warm', name: 'Warm', matrix: chainAll(tint(1.1, 1.02, 0.88), saturation(1.1)) },
  { id: 'cool', name: 'Cool', matrix: chainAll(tint(0.9, 1.0, 1.12), saturation(1.05)) },
  { id: 'vintage', name: 'Vintage', matrix: chainAll(mix(IDENTITY, SEPIA, 0.6), contrast(0.88), lift(0.04)) },
  { id: 'bw', name: 'Black & White', matrix: chainAll(saturation(0), contrast(1.12)) },
  { id: 'pastel', name: 'Soft Pastel', matrix: chainAll(saturation(0.75), contrast(0.86), lift(0.1), tint(1.03, 0.99, 1.04)) },
  { id: 'rosy', name: 'Rosy', matrix: chainAll(tint(1.07, 0.95, 1.03), saturation(1.12), lift(0.03)) },
  { id: 'vivid', name: 'Vivid', matrix: chainAll(saturation(1.4), contrast(1.15)) },
  { id: 'fade', name: 'Film Fade', matrix: chainAll(saturation(0.85), contrast(0.88), tint(1, 1, 1, 0.04, 0.04, 0.05)) },
  { id: 'dreamy', name: 'Dreamy', matrix: chainAll(gain(1.1), contrast(0.82), saturation(0.9), tint(1.04, 1.0, 1.07)) },
  { id: 'noir', name: 'Noir', matrix: chainAll(saturation(0), contrast(1.4), gain(0.92)) }
]

const isIdentity = (m: Matrix): boolean => m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-6)

// THE single source of truth: preview and export both call this.
// Order: filter preset first, then the guest's sliders on top.
// Returns null when nothing changes (so we skip the work entirely).
export function buildPhotoMatrix(edit: { filterId: string; adjustments: Adjustments }): Matrix | null {
  const filter = FILTERS.find((f) => f.id === edit.filterId) ?? FILTERS[0]
  const a = edit.adjustments
  const m = chainAll(
    filter.matrix,
    hueRotate(a.hue),
    saturation(1 + a.saturation / 100),
    lift(a.lightness / 200),
    gain(1 + a.brightness / 100),
    contrast(1 + a.contrast / 100)
  )
  return isIdentity(m) ? null : m
}

// A short text label for a matrix (used to remember already-processed photos).
export const matrixKey = (m: Matrix): string => m.map((v) => v.toFixed(4)).join(',')

// Applies a matrix to canvas pixel data (red, green, blue, alpha in 0..255).
export function applyMatrix(data: Uint8ClampedArray, m: Matrix): void {
  const o0 = m[4] * 255
  const o1 = m[9] * 255
  const o2 = m[14] * 255
  const o3 = m[19] * 255
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    // Uint8ClampedArray keeps every result inside 0..255 automatically.
    data[i] = m[0] * r + m[1] * g + m[2] * b + m[3] * a + o0
    data[i + 1] = m[5] * r + m[6] * g + m[7] * b + m[8] * a + o1
    data[i + 2] = m[10] * r + m[11] * g + m[12] * b + m[13] * a + o2
    data[i + 3] = m[15] * r + m[16] * g + m[17] * b + m[18] * a + o3
  }
}