import { Button } from '../components/Button'
import { LayoutPreview } from '../components/LayoutPreview'
import { SwipeRow } from '../components/SwipeRow'
import { getEnabledLayouts } from '../config/layouts'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'

export function LayoutSelect(): React.JSX.Element {
  const nav = useNav()
  const { layoutId, chooseLayout, resetSession } = useSession()
  const layouts = getEnabledLayouts()

  return (
    <div className="screen">
      <h1 className="page-title">Choose your layout</h1>

      {/* One row: swipe it with a finger, or drag it with the mouse. */}
      <div className="layout-stage">
        <SwipeRow>
          {layouts.map((l) => (
            <button
              key={l.id}
              className={`card ${l.id === layoutId ? 'selected' : ''}`}
              onClick={() => chooseLayout(l.id)}
            >
              <LayoutPreview layout={l} height={Math.min(500, Math.floor(600 / (l.canvas.width / l.canvas.height)))} />
              <h3>{l.name}</h3>
              <p>{l.photoCount} photos</p>
            </button>
          ))}
        </SwipeRow>
      </div>

      <div className="footer">
        <Button
          label="Back"
          variant="secondary"
          onClick={() => {
            resetSession()
            nav.go({ name: 'home' })
          }}
        />
        <Button label="Next" disabled={!layoutId} onClick={() => nav.go({ name: 'template' })} />
      </div>
    </div>
  )
}