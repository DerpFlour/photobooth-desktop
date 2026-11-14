import { CSSProperties } from 'react'
import { fileUrl } from '../config/assets'

export type StripVariant = 'navy' | 'ocean' | 'sky' | 'cloud'

// The look of each sample strip (they match the new frames).
const LOOKS: Record<StripVariant, { bg: string; a: string; b: string; ink: string; edge: string }> = {
  navy: { bg: 'linear-gradient(180deg, #17387a, #0a1d46)', a: '#4a76b8', b: '#1f4584', ink: '#ffffff', edge: 'rgba(255,255,255,0.25)' },
  ocean: { bg: 'linear-gradient(180deg, #3a7ce2, #1d4fa8)', a: '#9cc5f7', b: '#4f8fe6', ink: '#ffffff', edge: 'rgba(255,255,255,0.35)' },
  sky: { bg: 'linear-gradient(180deg, #eef6ff, #bad6f6)', a: '#ffffff', b: '#a9c9ee', ink: '#0f2a5c', edge: 'rgba(255,255,255,0.8)' },
  cloud: { bg: 'linear-gradient(180deg, #ffffff, #e8f1fb)', a: '#dbe8f8', b: '#b0cbec', ink: '#0f2a5c', edge: 'rgba(176,201,235,0.7)' }
}

// A small DESIGNED strip: soft gradient "photos" with a hint of a person,
// plus the booth name. It uses no real photos, so nobody's privacy is involved.
export function SampleStrip({ variant, name }: { variant: StripVariant; name: string }): React.JSX.Element {
  const look = LOOKS[variant]
  const slot: CSSProperties = {
    background:
      'radial-gradient(circle at 50% 36%, rgba(255,255,255,0.62) 13%, transparent 14%), ' +
      'radial-gradient(ellipse 46% 40% at 50% 104%, rgba(255,255,255,0.5) 99%, transparent 100%), ' +
      `linear-gradient(145deg, ${look.a}, ${look.b})`
  }
  return (
    <div className="strip-card" style={{ background: look.bg, borderColor: look.edge }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="strip-slot" style={slot} />
      ))}
      <div className="strip-name" style={{ color: look.ink }}>
        {name.toLowerCase()}
      </div>
    </div>
  )
}

// A real guest strip (used when the admin picks "Recent" for the home sides).
export function RecentStrip({ record }: { record: SessionRecord }): React.JSX.Element {
  return (
    <div className="strip-card photo">
      <img src={fileUrl(record.thumbPath, record.createdAt)} alt="" draggable={false} />
    </div>
  )
}