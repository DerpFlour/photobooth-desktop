import { setIdleBlocked } from '../state/idle'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { getLayoutById } from '../config/layouts'
import { useCamera } from '../state/camera'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export function Capture({ retake }: { retake?: number }): React.JSX.Element | null {
  const nav = useNav()
  const { settings } = useSettings()
  const session = useSession()
  const layout = getLayoutById(session.layoutId)
  const { videoRef, state, grab } = useCamera(settings.cameraDeviceId, settings.cameraWidth, settings.cameraHeight)

  const cancelled = useRef(false) // lets the capture loop stop when we leave
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState(retake ?? 0)
  const [count, setCount] = useState<number | null>(null)
  const [shot, setShot] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  
  // Don't auto-reset to the home screen while photos are being taken.
  useEffect(() => {
    setIdleBlocked(running)
    return () => setIdleBlocked(false)
  }, [running])

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  useEffect(() => {
    if (!layout) nav.go({ name: 'home' })
  }, [layout, nav])
  if (!layout) return null

  // The camera window has the same shape as a photo slot, so what guests see
  // matches what will appear in the frame.
  const slot = layout.slots[0]
  const aspect = slot.width / slot.height
  const boxH = Math.min(740, 1500 / aspect)
  const boxW = boxH * aspect

  const run = async (): Promise<void> => {
    if (running) return
    // Works for ANY layout: one pass per slot (or just the retaken slot).
    const indices = retake !== undefined ? [retake] : layout.slots.map((_, i) => i)
    setRunning(true)
    try {
      for (const idx of indices) {
        setCurrent(idx)

        // Countdown: 3, 2, 1
        for (let s = settings.countdownSeconds; s >= 1; s--) {
          setCount(s)
          await sleep(1000)
          if (cancelled.current) return
        }
        setCount(null)

        // Flash + take the picture
        setFlashKey((k) => k + 1)
        const photo = await grab(settings.mirrorPhotos)
        if (cancelled.current) {
          URL.revokeObjectURL(photo.url)
          return
        }
        session.setPhoto(idx, photo)

        // Show the shot briefly before the next countdown.
        setShot(photo.url)
        await sleep(settings.previewAfterShotMs)
        setShot(null)
        if (cancelled.current) return
      }
      nav.go({ name: 'review' })
    } catch (e) {
      setCount(null)
      setShot(null)
      alert(`Camera problem: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRunning(false)
    }
  }

  const cancel = (): void => {
    cancelled.current = true
    if (retake === undefined) {
      session.clearPhotos() // fresh session: discard partial photos
      nav.go({ name: 'template' })
    } else {
      nav.go({ name: 'review' }) // retake: keep the old photo
    }
  }

  if (state.status === 'error') {
    return (
<div className="screen capture">
        <div className="center-msg">
          Camera problem
          <p>{state.message}</p>
          <div className="cap-buttons" style={{ marginTop: 24 }}>
            <Button label="Back" variant="secondary" onClick={cancel} />
            <Button label="Operator setup" onClick={() => nav.go({ name: 'admin' })} />
          </div>
        </div>
      </div>
    )
  }

  const title =
    retake !== undefined
      ? `Retaking photo ${retake + 1}`
      : running
        ? `Photo ${current + 1} of ${layout.photoCount}`
        : 'Get ready!'

  return (
    <div className="screen capture">
      <h1 className="cap-title">{title}</h1>

      <div className="cam-box" style={{ width: boxW, height: boxH }}>
        <video
          ref={videoRef}
          className="cam-video"
          muted
          playsInline
          style={{ transform: settings.mirrorPreview ? 'scaleX(-1)' : undefined }}
        />
        {shot && <img className="shot" src={shot} alt="" />}
        {count !== null && (
          <div className="count" key={`count-${count}`}>
            {count}
          </div>
        )}
        {flashKey > 0 && <div className="flash" key={`flash-${flashKey}`} />}
      </div>

      {/* Progress dots: filled once a slot has a photo */}
      <div className="dots">
        {layout.slots.map((_, i) => (
          <div
            key={i}
            className={`dot ${session.photos[i] ? 'filled' : ''} ${running && i === current ? 'active' : ''}`}
          />
        ))}
      </div>

      <div className="cap-buttons">
        <Button label="Cancel" variant="secondary" onClick={cancel} />
        {!running && (
          <Button
            label={state.status === 'ready' ? (retake !== undefined ? 'Retake' : 'Start') : 'Starting camera…'}
            disabled={state.status !== 'ready'}
            onClick={run}
          />
        )}
      </div>
    </div>
  )
}