import { useEffect, useMemo, useState } from 'react'
import { AdjustSlider } from '../components/AdjustSlider'
import { Button } from '../components/Button'
import { FilterThumb } from '../components/FilterThumb'
import { StickerOverlay } from '../components/StickerOverlay'
import { StripCanvas } from '../components/StripCanvas'
import { stickerUrl } from '../config/assets'
import { getLayoutById } from '../config/layouts'
import { STICKERS } from '../config/stickers'
import { getTemplateById } from '../config/templates'
import { buildPhotoMatrix, FILTERS } from '../render/colorMatrix'
import { StripAssets } from '../render/drawStrip'
import { loadFrame, loadPhotos, loadStickers } from '../render/loaders'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { Adjustments } from '../types'

type Tab = 'filters' | 'adjust' | 'stickers'

const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'hue', label: 'Hue', min: -180, max: 180 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'lightness', label: 'Lightness', min: -100, max: 100 },
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 }
]

export function Edit(): React.JSX.Element | null {
  const nav = useNav()
  const session = useSession()
  const { layoutId, templateId, photos, edit } = session
  const layout = getLayoutById(layoutId)
  const template = getTemplateById(templateId)

  const [tab, setTab] = useState<Tab>('filters')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bitmaps, setBitmaps] = useState<(ImageBitmap | null)[]>([])
  const [frame, setFrame] = useState<HTMLImageElement | null>(null)
  const [stickerImgs, setStickerImgs] = useState<Record<string, HTMLImageElement>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Decode the photos and the frame once when the editor opens.
  useEffect(() => {
    if (!layout || !template) {
      nav.go({ name: 'home' })
      return
    }
    let alive = true
    let loaded: (ImageBitmap | null)[] = []
    ;(async () => {
      try {
        loaded = await loadPhotos(photos)
        const f = await loadFrame(template, layout.id)
        if (!alive) {
          loaded.forEach((b) => b?.close())
          return
        }
        setBitmaps(loaded)
        setFrame(f)
        setLoading(false)
      } catch (e) {
        if (alive) setError(String(e))
      }
    })()
    return () => {
      alive = false
      loaded.forEach((b) => b?.close()) // free the memory
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load sticker pictures whenever a new kind of sticker is added.
  const stickerKey = edit.stickers.map((s) => s.stickerId).join(',')
  useEffect(() => {
    let alive = true
    loadStickers(edit.stickers.map((s) => s.stickerId))
      .then((imgs) => alive && setStickerImgs(imgs))
      .catch((e) => alive && setError(String(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickerKey])

  const assets = useMemo<StripAssets>(
    () => ({ photos: bitmaps, photoIds: photos.map((p) => p?.id ?? ''), frame, stickers: stickerImgs }),
    [bitmaps, photos, frame, stickerImgs]
  )
  // Recomputed only when the filter or sliders change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const matrix = useMemo(() => buildPhotoMatrix(edit), [edit.filterId, edit.adjustments])
  void matrix

  if (!layout || !template) return null

  // Fit the preview into the left side of the 1920x1080 design.
  const previewH = 960
  const previewW = Math.min(1100, (previewH * layout.canvas.width) / layout.canvas.height)
  const k = previewW / layout.canvas.width
  const selected = edit.stickers.find((s) => s.id === selectedId) ?? null

  return (
    <div className="screen edit">
      <div className="edit-preview">
        {error ? (
          <div className="center-msg">
            Could not load the editor
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="muted" style={{ fontSize: 36 }}>Loading editor…</div>
        ) : (
          <div className="edit-stage" style={{ width: previewW, height: previewH }}>
            <StripCanvas layout={layout} template={template} edit={edit} assets={assets} cssWidth={previewW} />
            {/* Touching empty space clears the selection */}
            <div className="deselect" onPointerDown={() => setSelectedId(null)} />
            {edit.stickers.map((s) => (
              <StickerOverlay
                key={s.id}
                sticker={s}
                k={k}
                canvasW={layout.canvas.width}
                canvasH={layout.canvas.height}
                selected={s.id === selectedId}
                onSelect={setSelectedId}
                onChange={session.updateSticker}
                onDelete={(id) => {
                  session.removeSticker(id)
                  setSelectedId(null)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="edit-panel">
        <div className="tabs">
          {(['filters', 'adjust', 'stickers'] as Tab[]).map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'filters' ? 'Filters' : t === 'adjust' ? 'Adjust' : 'Stickers'}
            </button>
          ))}
        </div>

        <div className="panel-content">
          {tab === 'filters' && (
            <div className="filter-grid">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`filter-card ${edit.filterId === f.id ? 'selected' : ''}`}
                  onClick={() => session.setFilter(f.id)}
                >
                  <FilterThumb photo={bitmaps[0] ?? null} matrix={f.matrix} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'adjust' && (
            <div>
              {SLIDERS.map((s) => (
                <div key={s.key} className="slider-block">
                  <div className="slider-head">
                    {/* tap the name to reset just this slider */}
                    <span onClick={() => session.setAdjustment(s.key, 0)}>{s.label}</span>
                    <span className="muted">{Math.round(edit.adjustments[s.key])}</span>
                  </div>
                  <AdjustSlider
                    min={s.min}
                    max={s.max}
                    value={edit.adjustments[s.key]}
                    onChange={(v) => session.setAdjustment(s.key, v)}
                  />
                </div>
              ))}
              <div className="chip-row">
                <button className="chip" onClick={session.resetAdjustments}>Reset sliders</button>
                <button className="chip" onClick={session.resetLook}>Original look</button>
              </div>
              <p className="note">Tip: tap a slider&apos;s name to reset just that one.</p>
            </div>
          )}

          {tab === 'stickers' && (
            <div>
              {selected ? (
                <div className="chip-row" style={{ marginBottom: 18 }}>
                  <button className="chip" onClick={() => session.moveSticker(selected.id, 'forward')}>Forward</button>
                  <button className="chip" onClick={() => session.moveSticker(selected.id, 'backward')}>Backward</button>
                  <button
                    className="chip"
                    onClick={() => session.updateSticker(selected.id, { aboveFrame: !selected.aboveFrame })}
                  >
                    {selected.aboveFrame ? 'Behind frame' : 'In front'}
                  </button>
                  <button
                    className="chip danger"
                    onClick={() => {
                      session.removeSticker(selected.id)
                      setSelectedId(null)
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <p className="note" style={{ marginBottom: 18 }}>
                  Tap a sticker to add it. Tap one on the strip to move, resize, or rotate it.
                </p>
              )}
              <div className="sticker-grid">
                {STICKERS.map((s) => (
                  <button key={s.id} className="sticker-cell" onClick={() => setSelectedId(session.addSticker(s.id))}>
                    <img src={stickerUrl(s.file)} alt={s.name} draggable={false} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="edit-buttons">
          <Button label="Back" variant="secondary" onClick={() => nav.go({ name: 'review' })} />
          <Button label="Done" onClick={() => nav.go({ name: 'result' })} />
        </div>
      </div>
    </div>
  )
}