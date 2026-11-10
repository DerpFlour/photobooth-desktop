import { Button } from '../components/Button'
import { LayoutPreview } from '../components/LayoutPreview'
import { getEnabledLayouts } from '../config/layouts'
import { useNav } from '../state/nav'
import { useSession } from '../state/session'

export function LayoutSelect(): React.JSX.Element {
  const nav = useNav()
  const { layoutId, chooseLayout, resetSession } = useSession()

  return (
    <div className="screen">
      <h1 className="page-title">Choose your layout</h1>

      {/* Reads from config: adding a layout there adds a card here automatically */}
      <div className="cards">
        {getEnabledLayouts().map((l) => (
          <button
            key={l.id}
            className={`card ${l.id === layoutId ? 'selected' : ''}`}
            onClick={() => chooseLayout(l.id)}
          >
            <LayoutPreview layout={l} height={560} />
            <h3>{l.name}</h3>
            <p>
              {l.photoCount} photos · {l.description}
            </p>
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