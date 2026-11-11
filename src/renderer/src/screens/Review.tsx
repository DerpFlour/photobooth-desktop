import { Overlay } from '../components/Overlay'
import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { DraggablePhoto } from '../components/DraggablePhoto'
import { LayoutPreview } from '../components/LayoutPreview'
import { getLayoutById } from '../config/layouts'
import { getTemplateById } from '../config/templates'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'

export function Review(): React.JSX.Element | null {
  const nav = useNav()
  const { layoutId, templateId, photos, swapPhotos, clearPhotos, resetSession } = useSession()
  const [selected, setSelected] = useState<number | null>(null) // enlarged photo

  const layout = getLayoutById(layoutId)
  const template = getTemplateById(templateId)

  useEffect(() => {
    if (!layout || !template) nav.go({ name: 'home' })
  }, [layout, template, nav])
  if (!layout || !template) return null

  // Thumbnail grid: two rows, sized to fit the left half of the screen.
  const gap = 18
  const cols = Math.ceil(layout.photoCount / 2)
  const rows = Math.ceil(layout.photoCount / cols)
  const w = Math.min(340, Math.floor((860 - gap * (cols - 1)) / cols))
  const h = Math.round(w * 0.75)
  const gridW = cols * w + (cols - 1) * gap
  const gridH = rows * h + (rows - 1) * gap

  const enlarged = selected !== null ? photos[selected] : null

  return (
    <div className="screen">
      <h1 className="page-title">Review your photos</h1>

      <div className="review-body" style={{ top: 170 }}>
        {/* Left: draggable thumbnails */}
        <div className="review-left">
          <div className="grid-area" style={{ width: gridW, height: gridH }}>
            {photos.map((p, i) =>
              p ? (
                <DraggablePhoto
                  key={p.id} // keyed by photo, so a swap moves the photo itself
                  url={p.url}
                  index={i}
                  cols={cols}
                  count={layout.photoCount}
                  w={w}
                  h={h}
                  gap={gap}
                  onSwap={swapPhotos}
                  onTap={setSelected}
                />
              ) : null
            )}
          </div>
          <div className="hint">Tap to enlarge · Press and drag onto another photo to swap</div>
        </div>

        {/* Right: photos inside the chosen frame */}
        <div className="review-right">
          <LayoutPreview
            layout={layout}
            template={template}
            height={740}
            photos={photos.map((p) => p?.url ?? null)}
          />
        </div>
      </div>

      <div className="footer">
        <Button
          label="Start over"
          variant="secondary"
          onClick={() => {
            clearPhotos()
            nav.go({ name: 'capture' })
          }}
        />
        <Button
          label="Cancel session"
          variant="secondary"
          onClick={() => {
            resetSession()
            nav.go({ name: 'home' })
          }}
        />
        <Button label="Edit & decorate →" onClick={() => nav.go({ name: 'edit' })} />
      </div>

      {/* Enlarged photo + retake (covers the whole window) */}
      {enlarged && (
        <Overlay onClick={() => setSelected(null)}>
          <img src={enlarged.url} alt="" />
          <div className="modal-buttons" onClick={(e) => e.stopPropagation()}>
            <Button label="Close" variant="secondary" onClick={() => setSelected(null)} />
            <Button
              label="Retake this photo"
              onClick={() => {
                const index = selected
                setSelected(null)
                if (index !== null) nav.go({ name: 'capture', retake: index })
              }}
            />
          </div>
        </Overlay>
      )}
    </div>
  )
}
      