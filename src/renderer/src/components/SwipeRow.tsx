import { PointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useStageScale } from './Stage'

type Drag = { id: number; x: number; start: number; moved: boolean; lastX: number; lastT: number; v: number }

// A row you swipe with a finger or drag with the mouse (no scrollbar).
// Small arrows appear when there is more to see. Cards fit in the middle
// when there are only a few; a long row starts at the left.
export function SwipeRow({
  children,
  className = '',
  resetKey
}: {
  children: ReactNode
  className?: string
  resetKey?: string // when this changes, the row jumps back to the start
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const scale = useStageScale() // movement is measured on screen, the design is scaled
  const drag = useRef<Drag | null>(null)
  const justDragged = useRef(false)
  const glide = useRef(0)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback((): void => {
    const el = ref.current
    if (!el) return
    const next = {
      left: el.scrollLeft > 6,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 6
    }
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])

  useEffect(() => {
    measure() // the contents may have changed
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(glide.current)
    }
  }, [measure])

  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0
  }, [resetKey])

  const onDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    cancelAnimationFrame(glide.current)
    drag.current = {
      id: e.pointerId, x: e.clientX, start: e.currentTarget.scrollLeft,
      moved: false, lastX: e.clientX, lastT: performance.now(), v: 0
    }
  }

  const onMove = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    // Only start dragging after a small move, so a plain tap still works.
    if (!d.moved && Math.abs(dx) > 10) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    e.currentTarget.scrollLeft = d.start - dx / scale
    const now = performance.now()
    const instant = (e.clientX - d.lastX) / Math.max(1, now - d.lastT)
    d.v = d.v * 0.7 + instant * 0.3
    d.lastX = e.clientX
    d.lastT = now
  }

  const onEnd = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    // A drag must not also count as a tap on the card underneath.
    justDragged.current = true
    window.setTimeout(() => (justDragged.current = false), 80)
    const el = e.currentTarget
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)

    // A short glide after letting go.
    let velocity = performance.now() - d.lastT > 100 ? 0 : (-d.v * 16) / scale
    const step = (): void => {
      velocity *= 0.94
      const before = el.scrollLeft
      el.scrollLeft += velocity
      if (Math.abs(velocity) > 0.4 && el.scrollLeft !== before) glide.current = requestAnimationFrame(step)
    }
    glide.current = requestAnimationFrame(step)
  }

  const nudge = (direction: 1 | -1): void => {
    const el = ref.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={`swipe-wrap ${className}`}>
      <div
        ref={ref}
        className="swipe"
        onScroll={measure}
        onLoadCapture={measure}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onClickCapture={(e) => {
          if (justDragged.current) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        {children}
      </div>
      {edges.left && (
        <button className="swipe-arrow left" onClick={() => nudge(-1)} aria-label="Show earlier">
          ‹
        </button>
      )}
      {edges.right && (
        <button className="swipe-arrow right" onClick={() => nudge(1)} aria-label="Show more">
          ›
        </button>
      )}
    </div>
  )
}