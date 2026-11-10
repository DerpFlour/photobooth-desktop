import { PointerEvent, useRef, useState } from 'react'
import { useStageScale } from './Stage'

type Props = {
  url: string
  index: number // current position in the grid
  cols: number
  count: number
  w: number
  h: number
  gap: number
  onSwap: (from: number, to: number) => void
  onTap: (index: number) => void
}

// One thumbnail that can be tapped (enlarge) or dragged onto another one
// (swap places). Works the same with a mouse or a finger on the tablet.
// Positions come from the index, so after a swap the two photos trade places.
export function DraggablePhoto({ url, index, cols, count, w, h, gap, onSwap, onTap }: Props): React.JSX.Element {
  const scale = useStageScale()
  const start = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null)

  // Movement is measured on screen, but the design is scaled, so divide.
  const delta = (e: PointerEvent): { dx: number; dy: number } => ({
    dx: (e.clientX - (start.current?.x ?? 0)) / scale,
    dy: (e.clientY - (start.current?.y ?? 0)) / scale
  })

  const onDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setOffset({ dx: 0, dy: 0 })
  }
  const onMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (start.current) setOffset(delta(e))
  }
  const onUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (!start.current) return
    const { dx, dy } = delta(e)
    start.current = null
    setOffset(null)

    if (Math.hypot(dx, dy) < 10) {
      onTap(index) // barely moved: a tap
      return
    }
    // Where did the center of the thumbnail land? Find that grid cell.
    const cellW = w + gap
    const cellH = h + gap
    const rows = Math.ceil(count / cols)
    const cx = (index % cols) * cellW + w / 2 + dx
    const cy = Math.floor(index / cols) * cellH + h / 2 + dy
    const col = Math.min(cols - 1, Math.max(0, Math.floor(cx / cellW)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(cy / cellH)))
    const target = row * cols + col
    if (target < count && target !== index) onSwap(index, target)
  }
  const onCancel = (): void => {
    start.current = null
    setOffset(null)
  }

  const dragging = offset !== null
  return (
    <div
      className={`photo-cell ${dragging ? 'dragging' : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      style={{
        width: w,
        height: h,
        left: (index % cols) * (w + gap),
        top: Math.floor(index / cols) * (h + gap),
        zIndex: dragging ? 10 : 1,
        transform: dragging ? `translate(${offset.dx}px, ${offset.dy}px) scale(1.06)` : undefined
      }}
    >
      <img src={url} alt="" draggable={false} />
      <div className="badge">{index + 1}</div>
    </div>
  )
}