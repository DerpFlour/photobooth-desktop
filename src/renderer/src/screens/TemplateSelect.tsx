import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { LayoutPreview } from '../components/LayoutPreview'
import { SwipeRow } from '../components/SwipeRow'
import { getLayoutById } from '../config/layouts'
import { getTemplateById, getTemplatesForLayout } from '../config/templates'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'
import { TemplateConfig } from '../types'

const categoryOf = (t: TemplateConfig): string => t.category ?? 'More'

export function TemplateSelect(): React.JSX.Element | null {
  const nav = useNav()
  const { layoutId, templateId, chooseTemplate } = useSession()
  const [category, setCategory] = useState('All')
  const layout = getLayoutById(layoutId)

  // Safety: if someone lands here without a layout, go home.
  useEffect(() => {
    if (!layout) nav.go({ name: 'home' })
  }, [layout, nav])
  if (!layout) return null

  const all = getTemplatesForLayout(layout.id)
  const categories = Array.from(new Set(all.map(categoryOf)))
  const showChips = categories.length > 1
  const shown = category === 'All' || !categories.includes(category) ? all : all.filter((t) => categoryOf(t) === category)
  const selected = getTemplateById(templateId)

  // Sized from the space that is really there, so nothing is ever cut off.
  const aspect = layout.canvas.width / layout.canvas.height
  const bigHeight = Math.min(640, Math.floor(600 / aspect))
  const thumbHeight = Math.min(420, Math.floor(300 / aspect))

  return (
    <div className="screen">
      <div className="tpl2">
        <div className="tpl2-left">
          <LayoutPreview layout={layout} template={selected} height={bigHeight} />
          <div className="name">{selected ? selected.name : 'Swipe and pick a frame →'}</div>
        </div>

        <div className="tpl2-right">
          <h2>Choose your frame</h2>
          {showChips && (
            <div className="tpl2-chips">
              {['All', ...categories].map((c) => (
                <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="tpl2-carousel">
            <SwipeRow resetKey={category}>
              {shown.map((t) => (
                <button
                  key={t.id}
                  className={`frame-card ${t.id === templateId ? 'selected' : ''}`}
                  onClick={() => chooseTemplate(t.id)}
                >
                  <LayoutPreview layout={layout} template={t} height={thumbHeight} />
                  <span>{t.name}</span>
                </button>
              ))}
            </SwipeRow>
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