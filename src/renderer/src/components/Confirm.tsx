import { Button } from './Button'

type Props = {
  title: string
  message: string
  yesLabel: string
  danger?: boolean
  onYes: () => void
  onNo: () => void
}

// An in-app "Are you sure?" box (big buttons, works with touch).
export function Confirm({ title, message, yesLabel, danger, onYes, onNo }: Props): React.JSX.Element {
  return (
    <div className="modal" style={{ zIndex: 80 }}>
      <div className="confirm">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-buttons" style={{ justifyContent: 'center' }}>
          <Button label="Cancel" variant="secondary" onClick={onNo} />
          <Button label={yesLabel} onClick={onYes} style={danger ? { background: '#e53e3e' } : undefined} />
        </div>
      </div>
    </div>
  )
}