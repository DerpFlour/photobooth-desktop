import { useEffect, useRef, useState } from 'react'

type Props = {
  length: number // how many digits make a PIN
  title: string
  message: string
  onComplete: (pin: string) => void // called when the last digit is entered
  onCancel?: () => void
}

// An on-screen number pad (big keys for touch). The laptop's number keys and
// Backspace work too.
export function PinPad({ length, title, message, onComplete, onCancel }: Props): React.JSX.Element {
  // A ref holds the true entry so rapid taps never get lost between renders.
  const entryRef = useRef('')
  const [entry, setEntryState] = useState('')
  const setEntry = (value: string): void => {
    entryRef.current = value
    setEntryState(value)
  }

  const press = (digit: string): void => {
    const next = (entryRef.current + digit).slice(0, length)
    if (next.length >= length) {
      setEntry('')
      onComplete(next)
    } else {
      setEntry(next)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setEntry(entryRef.current.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="pin">
      <h1>{title}</h1>
      <div className="pin-dots">
        {Array.from({ length }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < entry.length ? 'filled' : ''}`} />
        ))}
      </div>
      <div className="pin-msg">{message}</div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="key small" onClick={onCancel} disabled={!onCancel}>
          {onCancel ? 'Cancel' : ''}
        </button>
        <button className="key" onClick={() => press('0')}>
          0
        </button>
        <button className="key" onClick={() => setEntry(entryRef.current.slice(0, -1))}>
          ⌫
        </button>
      </div>
    </div>
  )
}