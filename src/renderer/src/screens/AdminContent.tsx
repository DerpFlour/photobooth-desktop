import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Confirm } from '../components/Confirm'
import { LayoutPreview } from '../components/LayoutPreview'
import { NumberRow } from '../components/SettingRows'
import { customToLayout, getAllLayouts, isCustomLayoutId, slotProblem } from '../config/layouts'
import { getAllTemplates, getTemplateById } from '../config/templates'
import { saveContent, useContent } from '../state/content'
import { LayoutConfig, TemplateConfig } from '../types'

// ---------------------------------------------------------------------------
// Shapes and starting points for new layouts
// ---------------------------------------------------------------------------
type Draft = {
  id?: string
  name: string
  canvasW: number
  canvasH: number
  columns: number
  rows: number
  margin: number
  gap: number
  footer: number
}

const NEW_DRAFT: Draft = { name: 'New layout', canvasW: 1200, canvasH: 1800, columns: 2, rows: 2, margin: 40, gap: 30, footer: 110 }

// Paper shapes at 300 dpi.
const CANVASES = [
  { label: 'Strip · 2×6 in', w: 600, h: 1800 },
  { label: '4×6 in portrait', w: 1200, h: 1800 },
  { label: '4×6 in landscape', w: 1800, h: 1200 },
  { label: '5×7 in portrait', w: 1500, h: 2100 },
  { label: '5×7 in landscape', w: 2100, h: 1500 }
]

const PRESETS: { label: string; draft: Omit<Draft, 'id'> }[] = [
  { label: '3-photo strip', draft: { name: '3-Photo Strip', canvasW: 600, canvasH: 1800, columns: 1, rows: 3, margin: 40, gap: 30, footer: 160 } },
  { label: '2×2 grid', draft: { name: '4-Photo Grid', canvasW: 1200, canvasH: 1800, columns: 2, rows: 2, margin: 40, gap: 30, footer: 110 } },
  { label: '6 photos (2×3)', draft: { name: '6-Photo Sheet', canvasW: 1200, canvasH: 1800, columns: 2, rows: 3, margin: 40, gap: 30, footer: 110 } },
  { label: 'Landscape 2×2', draft: { name: 'Landscape Grid', canvasW: 1800, canvasH: 1200, columns: 2, rows: 2, margin: 40, gap: 30, footer: 110 } }
]

const toCustom = (d: Draft): CustomLayout => ({ ...d, id: d.id ?? 'custom-preview' })

// ---------------------------------------------------------------------------
// Helpers: the guide picture and the frame check
// ---------------------------------------------------------------------------

// A picture showing where the photo windows are, to design a frame on top of.
async function guideBytes(layout: LayoutConfig): Promise<ArrayBuffer> {
  const canvas = document.createElement('canvas')
  canvas.width = layout.canvas.width
  canvas.height = layout.canvas.height
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = '#f2f6fb'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  layout.slots.forEach((s, i) => {
    ctx.beginPath()
    ctx.roundRect(s.x, s.y, s.width, s.height, 14)
    ctx.fillStyle = '#7fb2f0'
    ctx.fill()
    ctx.strokeStyle = '#2563c9'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = "bold 90px 'Segoe UI', sans-serif"
    ctx.fillText(String(i + 1), s.x + s.width / 2, s.y + s.height / 2 - 30)
    ctx.font = "28px 'Segoe UI', sans-serif"
    ctx.fillText(`${s.width}×${s.height} px`, s.x + s.width / 2, s.y + s.height / 2 + 50)
  })
  ctx.fillStyle = '#44556f'
  ctx.font = "24px 'Segoe UI', sans-serif"
  ctx.fillText(
    `${layout.name} · ${canvas.width}×${canvas.height} px · keep the blue windows TRANSPARENT`,
    canvas.width / 2,
    canvas.height - 28
  )
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the guide picture.'))), 'image/png')
  )
  return blob.arrayBuffer()
}

// Checks an imported frame: right shape, and every photo window transparent.
async function checkFrame(bytes: ArrayBuffer, layout: LayoutConfig): Promise<{ ok: boolean; message: string }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
  } catch {
    return { ok: false, message: 'That file is not a readable PNG picture.' }
  }
  const { width: w, height: h } = bitmap
  const want = layout.canvas.width / layout.canvas.height
  if (Math.abs(w / h / want - 1) > 0.015) {
    bitmap.close()
    return {
      ok: false,
      message: `This picture is ${w}×${h} px, but "${layout.name}" is ${layout.canvas.width}×${layout.canvas.height} px (a different shape). Make the frame the same shape. The guide image shows the exact size.`
    }
  }
  const scale = Math.min(1, 1200 / w)
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0, cw, ch)
  bitmap.close()
  const k = cw / layout.canvas.width
  const alphaAt = (x: number, y: number): number => ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data[3]
  const spots: [number, number][] = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
  for (let i = 0; i < layout.slots.length; i++) {
    const s = layout.slots[i]
    if (spots.some(([px, py]) => alphaAt(s.x + s.width * px, s.y + s.height * py) > 25)) {
      return {
        ok: false,
        message: `Photo window ${i + 1} is not transparent, so the photo would be hidden behind the frame. Erase the window area and export as a PNG with transparency.`
      }
    }
  }
  return { ok: true, message: `Looks good: ${w}×${h} px, and all ${layout.slots.length} photo windows are transparent.` }
}

// A preview of an imported frame over stand-in photos.
function FramePreview({ layout, url, height }: { layout: LayoutConfig; url: string; height: number }): React.JSX.Element {
  const k = height / layout.canvas.height
  return (
    <div className="lp" style={{ width: layout.canvas.width * k, height, background: '#fff' }}>
      {layout.slots.map((s, i) => (
        <div
          key={i}
          className="lp-slot"
          style={{
            left: s.x * k, top: s.y * k, width: s.width * k, height: s.height * k,
            borderRadius: 6, background: 'linear-gradient(145deg, #f2c9b0, #8f9bd6)'
          }}
        />
      ))}
      <img className="lp-frame" src={url} alt="" />
    </div>
  )
}

type Ask = { title: string; message: string; yes: string; run: () => Promise<void> }

// ---------------------------------------------------------------------------
// The tab
// ---------------------------------------------------------------------------
export function AdminContent(): React.JSX.Element {
  const content = useContent() // re-draw whenever the content changes
  const [view, setView] = useState<'list' | 'layout' | 'frame'>('list')
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT)
  const [note, setNote] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)

  const layouts = getAllLayouts()
  const templates = getAllTemplates()
  const sample = getTemplateById('white-solid')

  const save = async (next: ContentFile, done = ''): Promise<boolean> => {
    try {
      await saveContent(next)
      setNote(done)
      return true
    } catch (e) {
      setNote(`Could not save: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  const toggleLayout = (l: LayoutConfig): void => {
    const turnOn = !l.enabled
    if (!turnOn && layouts.filter((x) => x.enabled).length <= 1) {
      setNote('Keep at least one layout switched on.')
      return
    }
    void save({ ...content, layoutEnabled: { ...content.layoutEnabled, [l.id]: turnOn } })
  }

  const toggleTemplate = (t: TemplateConfig): void => {
    const turnOn = t.enabled === false
    if (!turnOn) {
      const remaining = templates.filter((x) => x.id !== t.id && x.enabled !== false)
      const stuck = layouts.find(
        (l) => l.enabled && !remaining.some((x) => x.layoutIds === 'all' || x.layoutIds.includes(l.id))
      )
      if (stuck) {
        setNote(`Keep at least one frame switched on for "${stuck.name}".`)
        return
      }
    }
    void save({ ...content, templateEnabled: { ...content.templateEnabled, [t.id]: turnOn } })
  }

  const saveGuide = async (l: LayoutConfig): Promise<void> => {
    try {
      await window.api.contentSaveGuide(l.id, await guideBytes(l))
      setNote('Guide image saved in Documents\\Click frame guides (the folder is open). Design your frame on top of it.')
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    }
  }

  const askDeleteLayout = (l: LayoutConfig): void =>
    setAsk({
      title: `Delete "${l.name}"?`,
      message: 'The layout and the frames you imported for it will be removed. Photos already taken with it are kept.',
      yes: 'Delete',
      run: async () => {
        const layoutEnabled = { ...content.layoutEnabled }
        delete layoutEnabled[l.id]
        const gone = content.customTemplates.filter((t) => t.layoutId === l.id).map((t) => t.id)
        const templateEnabled = { ...content.templateEnabled }
        gone.forEach((id) => delete templateEnabled[id])
        await save(
          {
            customLayouts: content.customLayouts.filter((x) => x.id !== l.id),
            customTemplates: content.customTemplates.filter((t) => t.layoutId !== l.id),
            layoutEnabled,
            templateEnabled
          },
          `Deleted "${l.name}".`
        )
      }
    })

  const askDeleteFrame = (t: TemplateConfig): void =>
    setAsk({
      title: `Delete the frame "${t.name}"?`,
      message: 'Photos already taken with it are kept.',
      yes: 'Delete',
      run: async () => {
        const templateEnabled = { ...content.templateEnabled }
        delete templateEnabled[t.id]
        await save(
          { ...content, customTemplates: content.customTemplates.filter((x) => x.id !== t.id), templateEnabled },
          `Deleted "${t.name}".`
        )
      }
    })

  const layoutName = (id: string): string => layouts.find((l) => l.id === id)?.name ?? id

  // ---------------- Layout builder ----------------
  if (view === 'layout') {
    const custom = toCustom(draft)
    const problem = slotProblem(custom)
    const preview = customToLayout(custom)
    const hasFrames = draft.id ? content.customTemplates.some((t) => t.layoutId === draft.id) : false
    const isDefaultName = !draft.name || draft.name === 'New layout' || PRESETS.some((p) => p.draft.name === draft.name)
    const set = (patch: Partial<Draft>): void => setDraft({ ...draft, ...patch })

    const submit = async (): Promise<void> => {
      const id = draft.id ?? `custom-${Math.random().toString(36).slice(2, 10)}`
      const entry: CustomLayout = { ...draft, id, name: draft.name.trim() || 'New layout' }
      const next = draft.id
        ? content.customLayouts.map((l) => (l.id === id ? entry : l))
        : [...content.customLayouts, entry]
      if (await save({ ...content, customLayouts: next }, `Saved "${entry.name}".`)) setView('list')
    }

    return (
      <div className="cm-split">
        <div className="cm-form">
          <h2 className="group-title" style={{ marginTop: 0 }}>{draft.id ? 'Edit layout' : 'New layout'}</h2>

          <div className="row-label" style={{ marginBottom: 8 }}>Start from</div>
          <div className="cm-chips">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="chip"
                onClick={() => setDraft({ ...draft, ...p.draft, name: isDefaultName ? p.draft.name : draft.name })}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="row">
            <div className="row-text"><div className="row-label">Name</div></div>
            <input className="text-input" value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div className="row-label" style={{ margin: '14px 0 8px' }}>Paper shape</div>
          <div className="cm-chips">
            {CANVASES.map((c) => (
              <button
                key={c.label}
                className={`chip ${draft.canvasW === c.w && draft.canvasH === c.h ? 'on' : ''}`}
                onClick={() => set({ canvasW: c.w, canvasH: c.h })}
              >
                {c.label}
              </button>
            ))}
          </div>

          <NumberRow label="Photos across" value={draft.columns} min={1} max={4} step={1} onChange={(v) => set({ columns: v })} />
          <NumberRow label="Photos down" value={draft.rows} min={1} max={6} step={1} onChange={(v) => set({ rows: v })} />
          <NumberRow label="Outer border" value={draft.margin} min={0} max={120} step={10} unit=" px" onChange={(v) => set({ margin: v })} />
          <NumberRow label="Space between photos" value={draft.gap} min={0} max={80} step={10} unit=" px" onChange={(v) => set({ gap: v })} />
          <NumberRow label="Space for the name at the bottom" value={draft.footer} min={0} max={300} step={10} unit=" px" onChange={(v) => set({ footer: v })} />

          {hasFrames && <div className="warn">Frames you imported for this layout may no longer line up with the new photo windows.</div>}
          {problem && <div className="warn">{problem}</div>}
          {note && <div className="notice">{note}</div>}

          <div className="admin-actions">
            <Button label="Cancel" variant="secondary" onClick={() => { setNote(''); setView('list') }} />
            <Button label="Save layout" disabled={!!problem} onClick={submit} />
          </div>
        </div>

        <div className="cm-preview">
          <LayoutPreview layout={preview} template={sample} height={Math.min(560, Math.floor(620 / (preview.canvas.width / preview.canvas.height)))} />
          <div className="row-hint" style={{ fontSize: 24 }}>
            {preview.photoCount} photos · each {preview.slots[0].width}×{preview.slots[0].height} px · paper {preview.canvas.width}×{preview.canvas.height} px
          </div>
        </div>
      </div>
    )
  }

  // ---------------- Frame import ----------------
  if (view === 'frame') {
    return (
      <FrameWizard
        layouts={layouts}
        content={content}
        onSave={save}
        onGuide={saveGuide}
        onClose={() => setView('list')}
        note={note}
        setNote={setNote}
      />
    )
  }

  // ---------------- The lists ----------------
  const firstLayoutFor = (t: TemplateConfig): LayoutConfig | undefined =>
    layouts.find((l) => t.layoutIds === 'all' || t.layoutIds.includes(l.id))

  return (
    <div>
      {note && <div className="notice" style={{ marginTop: 0, marginBottom: 12 }}>{note}</div>}

      <h2 className="group-title" style={{ marginTop: 0 }}>Layouts</h2>
      <div className="row">
        <div className="row-text">
          <div className="row-label">Build a new layout</div>
          <div className="row-hint">Choose the paper shape and how many photos, with a live preview</div>
        </div>
        <button className="chip" onClick={() => { setNote(''); setDraft(NEW_DRAFT); setView('layout') }}>New layout</button>
      </div>
      {layouts.map((l) => (
        <div className="row" key={l.id}>
          <div className="cm-thumb">
            <LayoutPreview layout={l} template={sample} height={Math.min(120, Math.floor(180 / (l.canvas.width / l.canvas.height)))} />
          </div>
          <div className="row-text">
            <div className="row-label">{l.name}</div>
            <div className="row-hint">
              {l.photoCount} photos · {l.canvas.width}×{l.canvas.height} px{isCustomLayoutId(l.id) ? ' · custom' : ' · built in'}
            </div>
          </div>
          <button className="chip" onClick={() => saveGuide(l)}>Guide image</button>
          {isCustomLayoutId(l.id) && (
            <>
              <button
                className="chip"
                onClick={() => {
                  const c = content.customLayouts.find((x) => x.id === l.id)
                  if (c) { setNote(''); setDraft({ ...c }); setView('layout') }
                }}
              >
                Edit
              </button>
              <button className="chip danger" onClick={() => askDeleteLayout(l)}>Delete</button>
            </>
          )}
          <button className={`switch ${l.enabled ? 'on' : ''}`} onClick={() => toggleLayout(l)} aria-label={`Show ${l.name} to guests`}>
            <span />
          </button>
        </div>
      ))}

      <h2 className="group-title">Frames</h2>
      <div className="row">
        <div className="row-text">
          <div className="row-label">Import your own frame</div>
          <div className="row-hint">A PNG with transparent photo windows, made for one layout</div>
        </div>
        <button className="chip" onClick={() => { setNote(''); setView('frame') }}>Import a frame</button>
      </div>
      {templates.map((t) => {
        const l = firstLayoutFor(t)
        return (
          <div className="row" key={t.id}>
            <div className="cm-thumb">
              {l && <LayoutPreview layout={l} template={t} height={Math.min(120, Math.floor(180 / (l.canvas.width / l.canvas.height)))} />}
            </div>
            <div className="row-text">
              <div className="row-label">{t.name}</div>
              <div className="row-hint">
                {t.layoutIds === 'all' ? 'Works with every layout' : `For: ${t.layoutIds.map(layoutName).join(', ')}`}
                {t.custom ? ' · imported' : ''}
              </div>
            </div>
            {t.custom && <button className="chip danger" onClick={() => askDeleteFrame(t)}>Delete</button>}
            <button className={`switch ${t.enabled !== false ? 'on' : ''}`} onClick={() => toggleTemplate(t)} aria-label={`Show ${t.name} to guests`}>
              <span />
            </button>
          </div>
        )
      })}

      {ask && (
        <Confirm
          title={ask.title}
          message={ask.message}
          yesLabel={ask.yes}
          danger
          onNo={() => setAsk(null)}
          onYes={async () => {
            const run = ask.run
            setAsk(null)
            await run()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Importing a frame
// ---------------------------------------------------------------------------
function FrameWizard(props: {
  layouts: LayoutConfig[]
  content: ContentFile
  onSave: (next: ContentFile, done?: string) => Promise<boolean>
  onGuide: (l: LayoutConfig) => Promise<void>
  onClose: () => void
  note: string
  setNote: (s: string) => void
}): React.JSX.Element {
  const { layouts, content, onSave, onGuide, onClose, note, setNote } = props
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? '')
  const [picked, setPicked] = useState<{ file: string; bytes: ArrayBuffer; url: string } | null>(null)
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('My frames')
  const [busy, setBusy] = useState(false)

  const layout = layouts.find((l) => l.id === layoutId) ?? layouts[0]

  // Re-check whenever the picture or the chosen layout changes.
  useEffect(() => {
    if (!picked || !layout) return
    let alive = true
    checkFrame(picked.bytes, layout).then((r) => alive && setCheck(r))
    return () => {
      alive = false
    }
  }, [picked, layout])

  // Free the preview picture when it's replaced or the screen closes.
  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.url)
    },
    [picked]
  )

  const choose = async (): Promise<void> => {
    setNote('')
    try {
      const result = await window.api.contentPickPng()
      if (!result) return
      setCheck(null)
      setName(result.name.replace(/\.png$/i, '').replace(/[-_]+/g, ' ').slice(0, 40))
      setPicked({
        file: result.name,
        bytes: result.bytes,
        url: URL.createObjectURL(new Blob([result.bytes], { type: 'image/png' }))
      })
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    }
  }

  const add = async (): Promise<void> => {
    if (!picked || !check?.ok || !layout) return
    setBusy(true)
    try {
      const file = await window.api.contentStoreFrame(picked.bytes)
      const template: CustomTemplate = {
        id: `frame-${Math.random().toString(36).slice(2, 10)}`,
        name: name.trim() || 'My frame',
        layoutId: layout.id,
        file,
        backgroundColor: '#FFFFFF',
        slotColor: '#E8EFF9',
        textColor: '#0F2A5C',
        category: category.trim() || 'My frames'
      }
      if (await onSave({ ...content, customTemplates: [...content.customTemplates, template] }, `Added "${template.name}".`)) {
        onClose()
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cm-split">
      <div className="cm-form">
        <h2 className="group-title" style={{ marginTop: 0 }}>Import a frame</h2>

        <div className="row-label" style={{ marginBottom: 8 }}>1. Which layout is it for?</div>
        <div className="pick-list">
          {layouts.map((l) => (
            <button key={l.id} className={`pick ${l.id === layoutId ? 'selected' : ''}`} onClick={() => setLayoutId(l.id)}>
              {l.name} · {l.canvas.width}×{l.canvas.height} px
            </button>
          ))}
        </div>

        <div className="row">
          <div className="row-text">
            <div className="row-label">2. Get the guide image (optional)</div>
            <div className="row-hint">Design your frame on top of it, then delete the blue windows so they are see-through, and export as PNG</div>
          </div>
          <button className="chip" onClick={() => layout && onGuide(layout)}>Save guide image</button>
        </div>

        <div className="row">
          <div className="row-text">
            <div className="row-label">3. Choose your frame (PNG)</div>
            <div className="row-hint">{picked ? picked.file : 'No file chosen yet'}</div>
          </div>
          <button className="chip" onClick={choose}>Choose file…</button>
        </div>

        {picked && (
          <>
            <div className="row">
              <div className="row-text"><div className="row-label">4. Name</div></div>
              <input className="text-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="row">
              <div className="row-text">
                <div className="row-label">5. Category</div>
                <div className="row-hint">Frames are grouped by category on the guest screen. Type a new one, or reuse a name like Light.</div>
              </div>
              <input className="text-input" value={category} maxLength={24} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </>
        )}

        {check && <div className={`cm-check ${check.ok ? 'ok' : 'bad'}`}>{check.message}</div>}
        {note && <div className="notice">{note}</div>}

        <div className="admin-actions">
          <Button label="Cancel" variant="secondary" onClick={() => { setNote(''); onClose() }} />
          <Button label={busy ? 'Adding…' : 'Add frame'} disabled={!check?.ok || busy} onClick={add} />
        </div>
      </div>

      <div className="cm-preview">
        {picked && layout ? (
          <FramePreview layout={layout} url={picked.url} height={Math.min(560, Math.floor(620 / (layout.canvas.width / layout.canvas.height)))} />
        ) : (
          <div className="row-hint" style={{ fontSize: 26, marginTop: 120 }}>A preview of your frame appears here.</div>
        )}
      </div>
    </div>
  )
}