import { useCallback, useEffect, useRef, useState } from 'react'
import { CapturedPhoto } from '../types'

export type CameraState =
  | { status: 'starting' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

// Turns a browser camera error into something an operator can act on.
function describe(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError')
    return 'Camera access is blocked. In Windows open Settings > Privacy & security > Camera and allow desktop apps to use the camera.'
  if (name === 'NotFoundError') return 'No camera was found. Check that it is plugged in.'
  if (name === 'NotReadableError')
    return 'The camera is being used by another program (Zoom, Teams, the Camera app...). Close it and try again.'
  return `The camera could not start: ${e instanceof Error ? e.message : String(e)}`
}

// Opens the webcam and attaches it to a <video> element.
export function useCamera(deviceId: string, width: number, height: number) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>({ status: 'starting' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'starting' })

    const open = (id: string): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: width },
          height: { ideal: height },
          ...(id ? { deviceId: { exact: id } } : {})
        }
      })

    ;(async () => {
      try {
        let stream: MediaStream
        try {
          stream = await open(deviceId)
        } catch (e) {
          // The saved camera may be unplugged: fall back to the default one.
          const name = e instanceof DOMException ? e.name : ''
          if (deviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
            stream = await open('')
          } else {
            throw e
          }
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        setState({ status: 'ready' })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: describe(e) })
      }
    })()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop()) // release the camera
      streamRef.current = null
    }
  }, [deviceId, width, height])

  // Takes one full-resolution picture from the live video.
  const grab = useCallback(async (mirror: boolean, quality = 0.92): Promise<CapturedPhoto> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) throw new Error('The camera is not ready yet.')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create a drawing surface.')
    if (mirror) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo.'))), 'image/jpeg', quality)
    )
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      blob,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height
    }
  }, [])

  return { videoRef, state, grab }
}