// Minimal typing for the "gifenc" package (it ships without types).
declare module 'gifenc' {
  export type Palette = number[][]
  type Pixels = Uint8Array | Uint8ClampedArray

  export function quantize(
    rgba: Pixels,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }
  ): Palette

  export function applyPalette(rgba: Pixels, palette: Palette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: Palette; delay?: number; repeat?: number }
    ): void
    finish(): void
    bytes(): Uint8Array
  }
}