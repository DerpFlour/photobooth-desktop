import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { QrCode } from '../components/QrCode'
import { fileUrl } from '../config/assets'
import { getLayoutById } from '../config/layouts'
import { getTemplateById } from '../config/templates'
import { canvasToBlob, drawStrip, makeThumbnail } from '../render/drawStrip'
import { renderClipGif } from '../render/gif'
import { loadFrame, loadPhotos, loadStickers } from '../render/loaders'
import { countPrint, printSession, printsUsed } from '../render/printing'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { useSettings } from '../state/settings'

type State =
  | { status: 'saving'; step: string }
  | { status: 'done'; record: SessionRecord; ms: number }
  | { status: 'error'; message: string }

const toBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

// What the guest sees under the QR code.
const statusText = (c: CloudInfo): string =>
  c.status === 'ready'
    ? '✓ Ready! Scan to download'
    : c.status === 'uploading'
      ? 'Uploading your photos…'
      : c.status === 'failed'
        ? 'No internet right now. Your photos will upload automatically.'
        : 'Getting your photos ready…'

export function Result(): React.JSX.Element | null {
  const nav = useNav()
  const { settings } = useSettings()
  const { sessionId, layoutId, templateId, photos, edit, clipShots, resetSession } = useSession()
  const [state, setState] = useState<State>({ status: 'saving', step: 'Rendering at full resolution' })
  const [gifUrl, setGifUrl] = useState<string | null>(null) // the clip, shown beside the strip
  const [clipNote, setClipNote] = useState('')
  const [cloud, setCloud] = useState<CloudInfo | null | undefined>(undefined) // undefined = still loading
  const [printing, setPrinting] = useState(false)
  const [printMsg, setPrintMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [printedCount, setPrintedCount] = useState(sessionId ? printsUsed(sessionId) : 0)
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
              maxBytes: settings.gifMaxMB * 1024 * 1024,
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

  // Once saved: ask the booth for the guest's link (instant, even offline),
  // then watch the upload until the photos are online.
  const doneId = state.status === 'done' ? state.record.id : null
  useEffect(() => {
    if (!doneId || !settings.cloudEnabled) return
    let alive = true
    let timer: number | undefined
    const poll = async (): Promise<void> => {
      try {
        const info = await window.api.cloudStatus(doneId)
        if (!alive) return
        setCloud(info)
        if (info && info.status !== 'ready') timer = window.setTimeout(poll, 2000)
      } catch (e) {
        console.error('[cloud] status check failed', e)
      }
    }
    ;(async () => {
      try {
        const info = await window.api.cloudShare(doneId)
        if (!alive) return
        setCloud(info)
        if (info && info.status !== 'ready') timer = window.setTimeout(poll, 2000)
      } catch (e) {
        console.error('[cloud] could not start sharing', e)
        if (alive) setCloud(null)
      }
    })()
    return () => {
      alive = false
      if (timer) window.clearTimeout(timer)
    }
  }, [doneId, settings.cloudEnabled])

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

  // Printing: each press sends the settings' number of sheets to the printer.
  const limit = settings.printMaxPerSession
  const limitReached = limit > 0 && printedCount >= limit
  const doPrint = async (): Promise<void> => {
    if (printing || limitReached) return
    setPrinting(true)
    setPrintMsg(null)
    const result = await printSession(record, settings)
    setPrinting(false)
    if (result.ok) {
      countPrint(record.id)
      setPrintedCount(printsUsed(record.id))
    }
    setPrintMsg({ ok: result.ok, text: result.message })
  }
  const printLabel = printing
    ? 'Printing…'
    : limitReached
      ? 'All prints used'
      : printedCount > 0
        ? 'Print another'
        : 'Print my photos'

  // Size the pictures so they ALWAYS leave room for the QR column.
  const aspect = record.width / record.height
  const figures = gifUrl ? 2 : 1
  const figH = Math.min(800, Math.floor((1740 - 520 - 60 * figures) / (figures * aspect)))

  return (
    <div className="screen">
      <div className="result-body">
        <div className="result-figure">
          <img
            src={fileUrl(record.stripPath, record.createdAt)}
            style={{ height: figH, aspectRatio: aspect }}
            alt="Your photo strip"
          />
          <span>Your strip</span>
        </div>

        {/* The clip appears automatically beside the strip */}
        {gifUrl && (
          <div className="result-figure">
            <img src={gifUrl} style={{ height: figH }} alt="Behind-the-scenes clip" />
            <span>Behind the scenes</span>
          </div>
        )}

        <div className="result-info">
          <h1 className="result-title">Your photos are ready ✨</h1>

          {settings.cloudEnabled && (
            <div className="qr-block">
              {cloud === undefined ? (
                <div className="qr-sub">Preparing your link…</div>
              ) : cloud === null ? (
                <div className="qr-sub">QR download isn’t set up yet. Please ask the booth operator.</div>
              ) : (
                <>
                  <div className="qr-card">
                    <QrCode value={cloud.url} size={300} />
                  </div>
                  <div className="qr-title">Scan with your phone</div>
                  <div className="qr-sub">to download your strip and clip</div>
                  <div className={`qr-status ${cloud.status === 'ready' ? 'ok' : 'wait'}`}>{statusText(cloud)}</div>
                </>
              )}
            </div>
          )}

          {printMsg && <div className={`print-msg ${printMsg.ok ? 'ok' : 'bad'}`}>{printMsg.text}</div>}

          <div className="result-meta">
            {limit > 0 && settings.printEnabled && !limitReached && `${limit - printedCount} print${limit - printedCount === 1 ? '' : 's'} left`}
            {limit > 0 && settings.printEnabled && !limitReached && <br />}
            {record.width} × {record.height} px · {(record.bytes / 1024).toFixed(0)} KB · {state.ms} ms
            <br />✓ Saved on this computer
            {clipNote && (
              <>
                <br />
                {clipNote}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="footer">
        <Button label="Back" variant="secondary" onClick={() => nav.go({ name: 'edit' })} />
        {/* TEST AID: opens Windows Explorer with the saved file selected */}
        <Button label="Show file (test)" variant="secondary" onClick={() => window.api.showInFolder(record.stripPath)} />
        {settings.printEnabled && (
          <Button label={printLabel} disabled={printing || limitReached} onClick={doPrint} />
        )}
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