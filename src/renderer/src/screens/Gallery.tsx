import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Overlay } from '../components/Overlay'
import { SwipeRow } from '../components/SwipeRow'
import { fileUrl } from '../config/assets'
import { useNav } from '../state/nav'
import { useSettings } from '../state/settings'

// Guests can look at other recent sessions (read only), newest first, with
// older ones a swipe away. At most 12 are shown. The admin can switch the
// button that opens this screen off, to keep photos private.
export function Gallery(): React.JSX.Element {
  const nav = useNav()
  const { settings } = useSettings()
  const [items, setItems] = useState<SessionRecord[] | null>(null)
  const [open, setOpen] = useState<SessionRecord | null>(null)

  const count = Math.min(12, Math.max(1, settings.homeGalleryCount))
  useEffect(() => {
    let alive = true
    window.api
      .listSessions(count)
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [count])

  return (
    <div className="screen">
      <h1 className="page-title">Recent sessions</h1>

      <div className="gal-stage">
        {items === null && <div className="gal-empty">Loading…</div>}
        {items !== null && items.length === 0 && <div className="gal-empty">No sessions yet. Be the first! ✨</div>}
        {items !== null && items.length > 0 && (
          <SwipeRow>
            {items.map((s) => (
              <button key={s.id} className="gal-card" onClick={() => setOpen(s)}>
                <img src={fileUrl(s.thumbPath, s.createdAt)} style={{ aspectRatio: s.width / s.height }} alt="" draggable={false} />
                <span>{new Date(s.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </button>
            ))}
          </SwipeRow>
        )}
      </div>

      <div className="footer" style={{ justifyContent: 'center' }}>
        <Button label="Back" variant="secondary" onClick={() => nav.go({ name: 'home' })} />
      </div>

      {open && (
        <Overlay onClick={() => setOpen(null)}>
          <div className="detail-row">
            <img src={fileUrl(open.stripPath, open.createdAt)} alt="" />
            {open.gifPath && <img src={fileUrl(open.gifPath, open.createdAt)} alt="" />}
          </div>
          <div className="modal-buttons" onClick={(e) => e.stopPropagation()}>
            <Button label="Close" onClick={() => setOpen(null)} />
          </div>
        </Overlay>
      )}
    </div>
  )
}