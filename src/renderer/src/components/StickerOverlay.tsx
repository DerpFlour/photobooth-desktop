import { PointerEvent, useRef } from 'react'
import { STICKER_BASE } from '../config/stickers'
import { StickerInstance } from '../types'
import { useStageScale } from './Stage'

type Props = {
  sticker: StickerInstance
  k: number // design pixels per canvas unit
  canvasW: number
  canvasH: number
  selected: boolean
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<StickerInstance>) => void
  onDelete: (id: string) => void
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

// An invisible touch area over one sticker (the sticker itself is drawn on
// the canvas). Drag = move. When selected, the corner handle resizes and
// rotates, and the X button deletes.
export function StickerOverlay({
  sticker, k, canvasW, canvasH, selected, onSelect, onChange, onDelete
}: Props): React.JSX.Element {
  const stageScale = useStageScale() // screen pixels per design pixel
  const move = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const grip = useRef<{ x: number; y: number; vx: number; vy: number; scale: number; rotation: number } | null>(null)

  const onMoveDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    move.current = { x: e.clientX, y: e.clientY, ox: sticker.x, oy: sticker.y }
    onSelect(sticker.id)
  }
  const onMoveMove = (e: PointerEvent<HTMLDivElement>): void => {
    const m = move.current
    if (!m) return
    // screen pixels -> design pixels -> canvas units
    const dx = (e.clientX - m.x) / stageScale / k
    const dy = (e.clientY - m.y) / stageScale / k
    onChange(sticker.id, { x: clamp(m.ox + dx, 0, canvasW), y: clamp(m.oy + dy, 0, canvasH) })
  }

  const onGripDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    // Where the corner handle is, relative to the sticker's center.
    const half = (STICKER_BASE * sticker.scale * k) / 2
    const cos = Math.cos(sticker.rotation)
    const sin = Math.sin(sticker.rotation)
    grip.current = {
      x: e.clientX, y: e.clientY,
      vx: half * (cos - sin), vy: half * (sin + cos),
      scale: sticker.scale, rotation: sticker.rotation
    }
  }
  const onGripMove = (e: PointerEvent<HTMLDivElement>): void => {
    const g = grip.current
    if (!g) return
    const vx = g.vx + (e.clientX - g.x) / stageScale
    const vy = g.vy + (e.clientY - g.y) / stageScale
    const d0 = Math.hypot(g.vx, g.vy) || 1
    // Distance from center changes size; angle around center changes rotation.
    onChange(sticker.id, {
      scale: clamp((g.scale * Math.hypot(vx, vy)) / d0, 0.25, 5),
      rotation: g.rotation + (Math.atan2(vy, vx) - Math.atan2(g.vy, g.vx))
    })
  }

  const size = STICKER_BASE * sticker.scale * k
  return (
    <div
      className={`sticker-box ${selected ? 'selected' : ''}`}
      onPointerDown={onMoveDown}
      onPointerMove={onMoveMove}
      onPointerUp={() => (move.current = null)}
      onPointerCancel={() => (move.current = null)}
      style={{
        width: size,
        height: size,
        left: sticker.x * k - size / 2,
        top: sticker.y * k - size / 2,
        transform: `rotate(${sticker.rotation}rad)`
      }}
    >
      {selected && (
        <>
          <div
            className="sticker-handle"
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={() => (grip.current = null)}
            onPointerCancel={() => (grip.current = null)}
          >
            ⤡
          </div>
          <div
            className="sticker-delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(sticker.id)}
          >
            ✕
          </div>
        </>
      )}
    </div>
  )
}