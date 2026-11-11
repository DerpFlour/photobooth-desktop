import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { fileUrl } from '../config/assets'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

export function Home(): React.JSX.Element {
  const nav = useNav()
  const { settings } = useSettings()
  const { resetSession } = useSession()
  const hold = useRef<number | null>(null)
  const [recent, setRecent] = useState<SessionRecord[]>([])

  // Load the newest saved strips every time the home screen appears.
  useEffect(() => {
    if (!settings.showRecentOnHome || settings.homeGalleryCount <= 0) {
      setRecent([])
      return
    }
    let alive = true
    window.api
      .listSessions(settings.homeGalleryCount)
      .then((rows) => alive && setRecent(rows))
      .catch((e) => console.warn('[home] could not load sessions', e))
    return () => {
      alive = false
    }
  }, [settings.showRecentOnHome, settings.homeGalleryCount])

  // Press and hold the title for 2 seconds to open the admin (asks for the PIN).
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

  const showGallery = settings.showRecentOnHome && settings.homeGalleryCount > 0

  return (
    <div className="screen home">
      <div className="home-left">
        <h1
          className="home-title"
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onPointerCancel={holdEnd}
        >
          Photo
          <br />
          Booth ♡
        </h1>
        <p className="home-sub">Strike a pose. Make memories.</p>
        <Button label="Start" large onClick={start} />
      </div>

      {showGallery && (
        <div className="home-right">
          <h2 className="section-title">Recent photo strips</h2>
          {recent.length === 0 ? (
            <p className="home-empty">Your photo strips will appear here ✨</p>
          ) : (
            <div className="gallery">
              {recent.map((r) => (
                <div key={r.id} className="gallery-card">
                  <img
                    src={fileUrl(r.thumbPath, r.createdAt)}
                    style={{ aspectRatio: r.width / r.height }}
                    alt=""
                    draggable={false}
                  />
                  <span>{new Date(r.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}