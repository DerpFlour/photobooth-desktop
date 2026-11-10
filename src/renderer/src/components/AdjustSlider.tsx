import { PointerEvent, useRef } from 'react'

type Props = { value: number; min: number; max: number; onChange: (value: number) => void }

// A big, touch-friendly slider (works with a mouse or a finger). These
// sliders go from negative to positive, so the pink bar is drawn from the
// center (zero) out to the thumb.
export function AdjustSlider({ value, min, max, onChange }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const active = useRef(false)

  // The ratio uses the slider's on-screen size, so it works at any window size.
  const setFromX = (clientX: number): void => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onChange(Math.round(min + ratio * (max - min)))
  }

  const ratio = (value - min) / (max - min)
  const zero = Math.min(1, Math.max(0, (0 - min) / (max - min)))

  return (
    <div
      ref={ref}
      className="slider"
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        active.current = true
        setFromX(e.clientX)
      }}
      onPointerMove={(e) => active.current && setFromX(e.clientX)}
      onPointerUp={() => (active.current = false)}
      onPointerCancel={() => (active.current = false)}
    >
      <div className="slider-track" />
      <div
        className="slider-fill"
        style={{ left: `${Math.min(ratio, zero) * 100}%`, width: `${Math.abs(ratio - zero) * 100}%` }}
      />
      <div className="slider-zero" style={{ left: `${zero * 100}%` }} />
      <div className="slider-thumb" style={{ left: `${ratio * 100}%` }} />
    </div>
  )
}