import { useEffect, useState } from 'react'

type RowProps = { label: string; hint?: string }

function Text({ label, hint }: RowProps): React.JSX.Element {
  return (
    <div className="row-text">
      <div className="row-label">{label}</div>
      {hint ? <div className="row-hint">{hint}</div> : null}
    </div>
  )
}

// A number with big − and + buttons.
export function NumberRow(
  props: RowProps & {
    value: number
    min: number
    max: number
    step: number
    unit?: string
    onChange: (value: number) => void
  }
): React.JSX.Element {
  const { value, min, max, step, unit = '', onChange } = props
  const set = (v: number): void => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className="row">
      <Text label={props.label} hint={props.hint} />
      <div className="stepper">
        <button className="step-btn" onClick={() => set(value - step)}>−</button>
        <div className="step-value">
          {value}
          {unit}
        </div>
        <button className="step-btn" onClick={() => set(value + step)}>+</button>
      </div>
    </div>
  )
}

// An on/off switch.
export function ToggleRow(
  props: RowProps & { value: boolean; onChange: (value: boolean) => void }
): React.JSX.Element {
  return (
    <div className="row">
      <Text label={props.label} hint={props.hint} />
      <button
        className={`switch ${props.value ? 'on' : ''}`}
        onClick={() => props.onChange(!props.value)}
        aria-label={props.label}
      >
        <span />
      </button>
    </div>
  )
}

// Pick one of a few options.
export function ChoiceRow<T extends string>(
  props: RowProps & { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }
): React.JSX.Element {
  return (
    <div className="row">
      <Text label={props.label} hint={props.hint} />
      <div className="seg">
        {props.options.map((o) => (
          <button key={o.value} className={props.value === o.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// A text box with a Save button (type with the laptop's keyboard).
export function TextRow(
  props: RowProps & { value: string; placeholder?: string; secret?: boolean; onSave: (value: string) => void }
): React.JSX.Element {
  const [text, setText] = useState(props.value)
  useEffect(() => {
    setText(props.value)
  }, [props.value])
  return (
    <div className="row">
      <Text label={props.label} hint={props.hint} />
      <input
        className="text-input"
        type={props.secret ? 'password' : 'text'}
        value={text}
        placeholder={props.placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      <button className="chip" disabled={text === props.value} onClick={() => props.onSave(text.trim())}>
        Save
      </button>
    </div>
  )
}