import { Button } from '../components/Button'
import { LayoutPreview } from '../components/LayoutPreview'
import { getEnabledLayouts } from '../config/layouts'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'

export function LayoutSelect(): React.JSX.Element {
  const nav = useNav()
  const { layoutId, chooseLayout, resetSession } = useSession()
  const layouts = getEnabledLayouts()

  // The more layouts there are, the smaller each card, so they all fit.
  const height = layouts.length <= 2 ? 560 : layouts.length === 3 ? 460 : layouts.length === 4 ? 380 : 300

  return (
    <div className="screen">
      <h1 className="page-title">Choose your layout</h1>

      {/* Reads from config: adding a layout in the admin adds a card here automatically */}
      <div className="cards">
        {layouts.map((l) => (
          <button
            key={l.id}
            className={`card ${l.id === layoutId ? 'selected' : ''}`}
            onClick={() => chooseLayout(l.id)}
          >
            <LayoutPreview layout={l} height={Math.min(height, Math.floor(640 / (l.canvas.width / l.canvas.height)))} />
            <h3>{l.name}</h3>
            <p>{l.photoCount} photos</p>
          </button>
        ))}
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