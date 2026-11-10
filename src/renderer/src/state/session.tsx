import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getLayoutById } from '../config/layouts'
import { clearSlotCache } from '../render/drawStrip'
import { Adjustments, CapturedPhoto, EditState, StickerInstance } from '../types'

const NO_ADJUSTMENTS: Adjustments = { hue: 0, saturation: 0, lightness: 0, brightness: 0, contrast: 0 }
export const DEFAULT_EDIT: EditState = { filterId: 'original', adjustments: NO_ADJUSTMENTS, stickers: [] }

const newSessionId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type SessionState = {
  sessionId: string | null // one per guest session; names its saved folder
  layoutId: string | null
  templateId: string | null
  photos: (CapturedPhoto | null)[] // one per slot, in slot order; null = not taken yet
  edit: EditState
  chooseLayout: (id: string) => void
  chooseTemplate: (id: string) => void
  setPhoto: (index: number, photo: CapturedPhoto) => void
  swapPhotos: (a: number, b: number) => void
  clearPhotos: () => void
  setFilter: (id: string) => void
  setAdjustment: (key: keyof Adjustments, value: number) => void
  resetAdjustments: () => void // sliders only
  resetLook: () => void // filter + sliders
  addSticker: (stickerId: string) => string // returns the new sticker's id
  updateSticker: (id: string, patch: Partial<StickerInstance>) => void
  removeSticker: (id: string) => void
  moveSticker: (id: string, direction: 'forward' | 'backward') => void
  resetSession: () => void
}
const SessionContext = createContext<SessionState | null>(null)

// Photos live in memory as blobs. Release a photo's temporary address when
// it's no longer needed so memory doesn't grow over a long event.
const release = (list: (CapturedPhoto | null)[]): void =>
  list.forEach((p) => p && URL.revokeObjectURL(p.url))

export function SessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [layoutId, setLayoutId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<(CapturedPhoto | null)[]>([])
  const [edit, setEdit] = useState<EditState>(DEFAULT_EDIT)

  // The capture loop runs for many seconds, so it needs the NEWEST photos.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  })

  const value = useMemo<SessionState>(
    () => ({
      sessionId,
      layoutId,
      templateId,
      photos,
      edit,
      chooseLayout: (id) => {
        release(photosRef.current)
        clearSlotCache()
        setSessionId(newSessionId())
        setLayoutId(id)
        setTemplateId(null)
        setPhotos(Array(getLayoutById(id)?.photoCount ?? 0).fill(null))
        setEdit(DEFAULT_EDIT) // sticker positions depend on the layout
      },
      chooseTemplate: setTemplateId,
      setPhoto: (index, photo) => {
        const old = photosRef.current[index]
        if (old) URL.revokeObjectURL(old.url) // a retake replaces the old photo
        setPhotos((prev) => prev.map((p, i) => (i === index ? photo : p)))
      },
      // Swapping (never deleting) is what makes reordering safe.
      swapPhotos: (a, b) =>
        setPhotos((prev) => {
          const next = [...prev]
          ;[next[a], next[b]] = [next[b], next[a]]
          return next
        }),
      clearPhotos: () => {
        release(photosRef.current)
        setPhotos((prev) => prev.map(() => null))
      },

      setFilter: (filterId) => setEdit((prev) => ({ ...prev, filterId })),
      setAdjustment: (key, v) =>
        setEdit((prev) => ({ ...prev, adjustments: { ...prev.adjustments, [key]: v } })),
      resetAdjustments: () => setEdit((prev) => ({ ...prev, adjustments: NO_ADJUSTMENTS })),
      resetLook: () => setEdit((prev) => ({ ...prev, filterId: 'original', adjustments: NO_ADJUSTMENTS })),

      addSticker: (stickerId) => {
        const layout = getLayoutById(layoutId)
        const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
        const jitter = (): number => (Math.random() - 0.5) * 80 // so new stickers don't stack exactly
        const sticker: StickerInstance = {
          id,
          stickerId,
          x: (layout?.canvas.width ?? 600) / 2 + jitter(),
          y: (layout?.canvas.height ?? 1800) / 2 + jitter(),
          scale: 1,
          rotation: 0,
          aboveFrame: true
        }
        setEdit((prev) => ({ ...prev, stickers: [...prev.stickers, sticker] }))
        return id
      },
      updateSticker: (id, patch) =>
        setEdit((prev) => ({
          ...prev,
          stickers: prev.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s))
        })),
      removeSticker: (id) =>
        setEdit((prev) => ({ ...prev, stickers: prev.stickers.filter((s) => s.id !== id) })),
      moveSticker: (id, direction) =>
        setEdit((prev) => {
          const list = [...prev.stickers]
          const i = list.findIndex((s) => s.id === id)
          const j = direction === 'forward' ? i + 1 : i - 1
          if (i < 0 || j < 0 || j >= list.length) return prev
          ;[list[i], list[j]] = [list[j], list[i]]
          return { ...prev, stickers: list }
        }),

      resetSession: () => {
        release(photosRef.current)
        clearSlotCache()
        setSessionId(null)
        setLayoutId(null)
        setTemplateId(null)
        setPhotos([])
        setEdit(DEFAULT_EDIT)
      }
    }),
    [sessionId, layoutId, templateId, photos, edit]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}