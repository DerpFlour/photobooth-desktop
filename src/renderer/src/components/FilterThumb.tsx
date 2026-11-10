import { useEffect, useRef } from 'react'
import { coverSource } from '../render/drawStrip'
import { applyMatrix, Matrix } from '../render/colorMatrix'

// A small sample of the first photo with one filter applied.
export function FilterThumb({
  photo,
  matrix,
  width = 192,
  height = 144
}: {
  photo: ImageBitmap | null
  matrix: Matrix
  width?: number
  height?: number
}): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !photo) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    const { sx, sy, sw, sh } = coverSource(photo.width, photo.height, width / height)
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, width, height)
    const data = ctx.getImageData(0, 0, width, height)
    applyMatrix(data.data, matrix)
    ctx.putImageData(data, 0, 0)
  }, [photo, matrix, width, height])

  return <canvas ref={ref} width={width} height={height} />
}