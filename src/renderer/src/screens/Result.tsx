import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { fileUrl } from '../config/assets'
import { getLayoutById } from '../config/layouts'
import { getTemplateById } from '../config/templates'
import { canvasToBlob, drawStrip, makeThumbnail } from '../render/drawStrip'
import { loadFrame, loadPhotos, loadStickers } from '../render/loaders'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

type State =
  | { status: 'saving' }
  | { status: 'done'; record: SessionRecord; ms: number }
  | { status: 'error'; message: string }

export function Result(): React.JSX.Element | null {
  const nav = useNav()
  const { settings } = useSettings()
  const { sessionId, layoutId, templateId, photos, edit, resetSession } = useSession()
  const [state, setState] = useState<State>({ status: 'saving' })

  const layout = getLayoutById(layoutId)
  const template = getTemplateById(templateId)

  // Render at full print size and save, once, when the screen opens.
  useEffect(() => {
    if (!layout || !template || !sessionId) {
      nav.go({ name: 'home' })
      return
    }
    let alive = true
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
          originals
        })
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
          <p>Rendering at full resolution and saving</p>
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
        <img
          className="result-image"
          src={fileUrl(record.stripPath, record.createdAt)}
          style={{ aspectRatio: record.width / record.height }}
          alt="Your photo strip"
        />
        <div className="result-info">
          <h1 className="result-title">Your strip is ready ✨</h1>
          <p>
            {record.width} × {record.height} px
            <br />≈ {(record.width / 300).toFixed(1)} × {(record.height / 300).toFixed(1)} in at 300 dpi
            <br />
            {(record.bytes / 1024).toFixed(0)} KB saved · {state.ms} ms
          </p>
          <p className="saved">✓ Saved on this computer</p>
          <p className="note">QR code, GIF and printing arrive in later phases.</p>
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