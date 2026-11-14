import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStageScale } from '../components/Stage'
import { RecentStrip, SampleStrip, StripVariant } from '../components/SampleStrip'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

// x = how far the strip's outer edge sits from that side of the WINDOW (design
// pixels; negative = partly off-screen). top = the strip's top on the 1920x1080
// design. A tilt of 14 degrees is a 76 degree angle. The strips are 180 x 540.
type Spot = { side: 'left' | 'right'; x: number; top: number; tilt: number; dur: number; delay: number; variant: StripVariant }
const SPOTS: Spot[] = [
  { side: 'left', x: -130, top: -70, tilt: 14, dur: 6.2, delay: 0, variant: 'navy' },
  { side: 'left', x: 170, top: 360, tilt: 14, dur: 5.4, delay: -2, variant: 'sky' },
  { side: 'left', x: -135, top: 690, tilt: 14, dur: 6.8, delay: -4, variant: 'ocean' },
  { side: 'right', x: -135, top: -30, tilt: -14, dur: 5.8, delay: -1, variant: 'ocean' },
  { side: 'right', x: 175, top: 330, tilt: -14, dur: 6.5, delay: -3, variant: 'cloud' },
  { side: 'right', x: -140, top: 670, tilt: -14, dur: 5.2, delay: -5, variant: 'navy' }
]

export function Home(): React.JSX.Element {
  const nav = useNav()
  const { settings } = useSettings()
  const { resetSession } = useSession()
  const scale = useStageScale()
  const hold = useRef<number | null>(null)
  const [recent, setRecent] = useState<SessionRecord[]>([])

  // Real recent strips for the sides (only if the admin chose that, and only
  // tall strips, so they fit the strip-shaped spots).
  useEffect(() => {
    if (settings.homeStrips !== 'recent') {
      setRecent([])
      return
    }
    let alive = true
    window.api
      .listSessions(40)
      .then((rows) => {
        if (alive) setRecent(rows.filter((r) => r.width / r.height < 0.5).slice(0, SPOTS.length))
      })
      .catch((e) => console.warn('[home] could not load sessions', e))
    return () => {
      alive = false
    }
  }, [settings.homeStrips])

  // Press and hold the logo for 2 seconds to open the admin (asks for the PIN).
  const holdStart = (): void => {
    hold.current = window.setTimeout(() => nav.go({ name: 'admin' }), 2000)
  }
  const holdEnd = (): void => {
    if (hold.current) window.clearTimeout(hold.current)
    hold.current = null
  }

  const start = async (): Promise<void> => {
    try {
      const { ok, freeMB } = await window.api.ensureStorage()
      if (!ok) {
        alert(`Storage almost full: only ${Math.round(freeMB)} MB is free. Please ask the booth operator.`)
        return
      }
    } catch (e) {
      console.warn('[home] storage check failed', e) // don't block guests on a failed check
    }
    resetSession()
    nav.go({ name: 'layout' })
  }

  // Long names get a smaller logo so they always fit between the side strips.
  const name = settings.brandName || 'Click'
  const logoSize = Math.max(90, Math.min(230, Math.floor(1000 / (name.length * 0.62))))

  return (
    <div className="screen home">
      {/* The strips live on their own layer behind everything, fixed to the real
          window edges (not the 1920x1080 design area), so they fill any window
          shape with no cut-off edge. */}
      {createPortal(
        <div className="decor">
          {SPOTS.map((spot, i) => (
            <div
              key={i}
              className="strip-bob"
              style={{
                ...(spot.side === 'left' ? { left: spot.x * scale } : { right: spot.x * scale }),
                top: `calc(50% + ${(spot.top - 540) * scale}px)`,
                animationDuration: `${spot.dur}s`,
                animationDelay: `${spot.delay}s`
              }}
            >
              <div style={{ width: 180 * scale, height: 540 * scale, transform: `rotate(${spot.tilt}deg)` }}>
                <div style={{ width: 180, height: 540, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  {recent[i] ? <RecentStrip record={recent[i]} /> : <SampleStrip variant={spot.variant} name={name} />}
                </div>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      <div className="home2">
        <h1
          className="brand"
          style={{ fontSize: logoSize }}
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onPointerCancel={holdEnd}
        >
          {name}
        </h1>
        <div className="brand-rule" />
        <p className="brand-instructions">{settings.brandInstructions}</p>
        <button className="hero-btn" onClick={start}>
          {settings.brandButton || 'Take pictures'}
        </button>
        {settings.showRecentOnHome && (
          <button className="ghost-btn" onClick={() => nav.go({ name: 'gallery' })}>
            View recent sessions
          </button>
        )}
      </div>
    </div>
  )
}