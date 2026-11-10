import { CSSProperties } from 'react'

type Props = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  large?: boolean
  disabled?: boolean
  style?: CSSProperties
}

export function Button({ label, onClick, variant = 'primary', large, disabled, style }: Props): React.JSX.Element {
  return (
    <button
      className={`btn ${variant} ${large ? 'large' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {label}
    </button>
  )
}