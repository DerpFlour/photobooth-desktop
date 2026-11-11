import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { fileUrl } from '../config/assets'
import { getLayoutById } from '../config/layouts'
import { getTemplateById } from '../config/templates'
import { canvasToBlob, drawStrip, makeThumbnail } from '../render/drawStrip'
import { renderClipGif } from '../render/gif'
import { loadFrame, loadPhotos, loadStickers } from '../render/loaders'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

type State =
  | { status: 'saving'; step: string }
  | { status: 'done'; record: SessionRecord; ms: number }
  | { status: 'error'; message: string }

const toBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

export function Result(): React.JSX.Element | null {
  const nav = useNav()
  const { settings } = useSettings()
  const { sessionId, layoutId, templateId, photos, edit, clipShots, resetSession } = useSession()
  const [state, setState] = useState<State>({ status: 'saving', step: 'Rendering at full resolution' })
  const [gifUrl, setGifUrl] = useState<string | null>(null) // the clip, shown beside the strip
  const [clipNote, setClipNote] = useState('')
  const urlRef = useRef<string | null>(null)

  const layout = getLayoutById(layoutId)
  const template = getTemplateById(templateId)

  // Free the clip's memory when leaving the screen.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  // Render at full print size, build the clip, and save everything, once.
  useEffect(() => {
    if (!layout || !template || !sessionId) {
      nav.go({ name: 'home' })
      return
    }
    let alive = true
    const step = (s: string): void => {
      if (alive) setState({ status: 'saving', step: s })
    }
    ;(async () => {
      const started = performance.now()
      let bitmaps: (ImageBitmap | null)[] = []
      try {
        bitmaps = await loadPhotos(photos) // the full-resolution originals
        const assets = {
          photos: bitmaps,
          photoIds: photos.map((p) => p?.id ?? ''),
          frame: await loadFrame(template, layout.id),
          stickers: await loadStickers(edit.stickers.map((s) => s.stickerId))
        }

        // Same drawing function as the editor preview, at full size.
        const canvas = document.createElement('canvas')
        drawStrip(canvas, {
          layout, template, edit, assets,
          pixelWidth: Math.round(layout.output.width * settings.exportScale)
        })
        const isPng = settings.exportFormat === 'png'
        const strip = await canvasToBlob(canvas, isPng ? 'image/png' : 'image/jpeg', settings.exportQuality / 100)
        const thumb = await makeThumbnail(canvas)
        const originals = settings.keepOriginalPhotos
          ? await Promise.all(photos.filter((p) => p !== null).map((p) => p.blob.arrayBuffer()))
          : []

        // The animated strip. If it fails, the strip is still saved.
        let gif: ArrayBuffer | undefined
        if (settings.gifEnabled && Object.keys(clipShots).length > 0) {
          try {
            step('Creating your behind-the-scenes clip…')
            const bytes = await renderClipGif({
              layout, template, edit,
              finalAssets: assets,
              shots: clipShots,
              fps: settings.gifFps,
              width: settings.gifWidth,
              holdMs: settings.gifHoldSeconds * 1000,
              onProgress: (label, done, total) => step(`${label} ${done}/${total}`)
            })
            if (bytes) gif = toBuffer(bytes)
          } catch (e) {
            console.error('[clip] failed', e)
            if (alive) setClipNote('The clip could not be created, but your photo strip is saved.')
          }
        }

        step('Saving…')
        const record = await window.api.saveSession({
          id: sessionId,
          layoutId: layout.id,
          templateId: template.id,
          width: canvas.width,
          height: canvas.height,
          photoCount: layout.photoCount,
          ext: isPng ? 'png' : 'jpg',
          strip: await strip.arrayBuffer(),
          thumb: await thumb.arrayBuffer(),
          gif,
          originals
        })

        if (gif && alive) {
          urlRef.current = URL.createObjectURL(new Blob([gif], { type: 'image/gif' }))
          setGifUrl(urlRef.current)
        }
        if (alive) setState({ status: 'done', record, ms: Math.round(performance.now() - started) })
      } catch (e) {
        console.error('[save] failed', e)
        if (alive) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      } finally {
        bitmaps.forEach((b) => b?.close())
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!layout || !template || !sessionId) return null

  if (state.status === 'saving') {
    return (
      <div className="screen">
        <div className="center-msg">
          Creating your photo strip…
          <p>{state.step}</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="screen">
        <div className="center-msg">
          Something went wrong
          <p>{state.message}</p>
          <Button label="Back" onClick={() => nav.go({ name: 'edit' })} style={{ marginTop: 24 }} />
        </div>
      </div>
    )
  }

  const { record } = state
  return (
    <div className="screen">
      <div className="result-body">
        <div className="result-figure">
          <img
            src={fileUrl(record.stripPath, record.createdAt)}
            style={{ aspectRatio: record.width / record.height }}
            alt="Your photo strip"
          />
          <span>Your strip</span>
        </div>

        {/* The clip appears automatically beside the strip */}
        {gifUrl && (
          <div className="result-figure">
            <img src={gifUrl} alt="Behind-the-scenes clip" />
            <span>Behind the scenes</span>
          </div>
        )}

        <div className="result-info">
          <h1 className="result-title">Your strip is ready ✨</h1>
          <p>
            {record.width} × {record.height} px
            <br />≈ {(record.width / 300).toFixed(1)} × {(record.height / 300).toFixed(1)} in at 300 dpi
            <br />
            {(record.bytes / 1024).toFixed(0)} KB saved · {state.ms} ms
          </p>
          <p className="saved">✓ Saved on this computer</p>
          {clipNote && <p className="note">{clipNote}</p>}
          <p className="note">QR code and printing arrive in later phases.</p>
        </div>
      </div>

      <div className="footer">
        <Button label="Back" variant="secondary" onClick={() => nav.go({ name: 'edit' })} />
        {/* TEST AID: opens Windows Explorer with the saved file selected */}
        <Button label="Show file (test)" variant="secondary" onClick={() => window.api.showInFolder(record.stripPath)} />
        <Button
          label="New session"
          onClick={() => {
            resetSession()
            nav.go({ name: 'home' })
          }}
        />
      </div>
    </div>
  )
}