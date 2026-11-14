import { useEffect } from 'react'
import { Button } from '../components/Button'
import { LayoutPreview } from '../components/LayoutPreview'
import { getLayoutById } from '../config/layouts'
import { getTemplateById, getTemplatesForLayout } from '../config/templates'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'

export function TemplateSelect(): React.JSX.Element | null {
  const nav = useNav()
  const { layoutId, templateId, chooseTemplate } = useSession()
  const layout = getLayoutById(layoutId)

  // Safety: if someone lands here without a layout, go home.
  useEffect(() => {
    if (!layout) nav.go({ name: 'home' })
  }, [layout, nav])
  if (!layout) return null

  const selected = getTemplateById(templateId)

  return (
    <div className="screen">
      <div className="tpl-body">
        <div className="tpl-preview">
          <LayoutPreview layout={layout} template={selected} height={Math.min(780, Math.floor(720 / (layout.canvas.width / layout.canvas.height)))} />
          <div className="name">{selected ? selected.name : 'Pick a frame →'}</div>
        </div>
        <div className="tpl-list">
          <h2>Choose your frame</h2>
          <div className="tpl-grid">
            {getTemplatesForLayout(layout.id).map((t) => (
              <button
                key={t.id}
                className={`thumb ${t.id === templateId ? 'selected' : ''}`}
                onClick={() => chooseTemplate(t.id)}
              >
                <LayoutPreview layout={layout} template={t} height={300} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="footer">
        <Button label="Back" variant="secondary" onClick={() => nav.go({ name: 'layout' })} />
        <Button label="Start Photos" disabled={!selected} onClick={() => nav.go({ name: 'capture' })} />
      </div>
    </div>
  )
}