import { useEffect, useRef, useState } from 'react'
import { isIdleBlocked } from '../state/idle'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

// Watches for touches and mouse movement. If nobody touches the screen for
// `idleTimeoutSeconds`, shows "Still there?", then clears the session and
// returns to the home screen.
export function IdleWatcher(): React.JSX.Element | null {
  const { settings } = useSettings()
  const { screen, go } = useNav()
  const { resetSession } = useSession()

  const lastTouch = useRef(Date.now())
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  // The timer reads these through a ref, so it always sees the newest values
  // (it would otherwise be stuck with old copies from when it started).
  const live = useRef({ screenName: screen.name, go, resetSession })
  useEffect(() => {
    live.current = { screenName: screen.name, go, resetSession }
  })

  // Any touch, mouse movement or key press counts as "someone is here".
  useEffect(() => {
    const touch = (): void => {
      lastTouch.current = Date.now()
    }
    const events = ['pointerdown', 'pointermove', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, touch, true))
    return () => events.forEach((e) => window.removeEventListener(e, touch, true))
  }, [])

  useEffect(() => {
    const timeout = settings.idleTimeoutSeconds
    const warn = settings.idleWarningSeconds
    if (timeout <= 0) {
      setSecondsLeft(null)
      return
    }
    const timer = setInterval(() => {
      const { screenName, go: goTo, resetSession: reset } = live.current
      // Nothing to reset on the home screen, or while photos are being taken.
      if (screenName === 'home' || isIdleBlocked()) {
        lastTouch.current = Date.now()
        setSecondsLeft(null)
        return
      }
      const idle = (Date.now() - lastTouch.current) / 1000
      if (idle >= timeout + warn) {
        setSecondsLeft(null)
        lastTouch.current = Date.now()
        reset()
        goTo({ name: 'home' })
      } else if (idle >= timeout) {
        setSecondsLeft(Math.ceil(timeout + warn - idle))
      } else {
        setSecondsLeft(null)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [settings.idleTimeoutSeconds, settings.idleWarningSeconds])

  if (secondsLeft === null) return null
  return (
    <div
      className="idle-overlay"
      onPointerDown={() => {
        lastTouch.current = Date.now()
        setSecondsLeft(null)
      }}
    >
      <div className="idle-card">
        <h1>Still there?</h1>
        <p>Starting over in {secondsLeft}s</p>
        <p className="muted">Tap anywhere to keep going</p>
      </div>
    </div>
  )
}