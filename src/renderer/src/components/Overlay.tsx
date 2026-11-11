import { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useStageScale } from './Stage'

type Props = {
  children: ReactNode
  background?: string // the dim color that covers the whole window
  zIndex?: number
  onClick?: () => void
  onPointerDown?: () => void
}

// Use this for ANYTHING that must cover the whole window (dialogs, warnings,
// enlarged photos...). The app lives inside a scaled 1920x1080 stage, and a
// scaled box traps anything "fixed" inside it. So the dim layer is drawn
// directly on the window (via a portal), and the content is placed back at
// the same scale and position as the rest of the design.
export function Overlay({ children, background = 'rgba(0, 0, 0, 0.88)', zIndex = 1000, onClick, onPointerDown }: Props): React.JSX.Element {
  const scale = useStageScale()
  return createPortal(
    <div className="overlay" style={{ background, zIndex }} onClick={onClick} onPointerDown={onPointerDown}>
      <div className="overlay-content" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>,
    document.body
  )
}