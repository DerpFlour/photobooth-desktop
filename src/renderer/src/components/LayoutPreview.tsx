import { overlayFor } from '../config/templates'
import { LayoutConfig, TemplateConfig } from '../types'

type Props = {
  layout: LayoutConfig
  template?: TemplateConfig
  height: number // drawn this tall; width follows automatically
  photos?: (string | null)[] // optional photo addresses, one per slot
}

// A miniature of a layout using the SAME slot data the final export will use.
// If the template has PNG artwork, it is drawn over the photos.
export function LayoutPreview({ layout, template, height, photos }: Props): React.JSX.Element {
  const k = height / layout.canvas.height
  const width = layout.canvas.width * k
  const overlay = overlayFor(template, layout.id)

  return (
    <div className="lp" style={{ width, height, background: template?.backgroundColor ?? '#fff' }}>
      {layout.slots.map((s, i) => {
        const url = photos?.[i]
        return (
          <div
            key={i}
            className="lp-slot"
            style={{
              left: s.x * k, top: s.y * k, width: s.width * k, height: s.height * k,
              background: template?.slotColor ?? '#e6e6e6', borderRadius: 8 * (k * 4 + 0.5),
              color: template?.textColor ?? '#999', fontSize: Math.max(12, 70 * k)
            }}
          >
            {url ? <img src={url} alt="" draggable={false} /> : <span style={{ opacity: 0.6 }}>{i + 1}</span>}
          </div>
        )
      })}
      {overlay ? (
        <img className="lp-frame" src={overlay} alt="" draggable={false} />
      ) : (
        template && (
          <div className="lp-footer" style={{ color: template.textColor, fontSize: Math.max(10, 44 * k), bottom: 22 * k }}>
            {template.footerText}
          </div>
        )
      )}
    </div>
  )
}