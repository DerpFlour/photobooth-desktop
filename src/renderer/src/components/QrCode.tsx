import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'

// Draws a QR code for a link. Black on white, with a quiet border, so
// phone cameras read it quickly.
export function QrCode({ value, size }: { value: string; size: number }): React.JSX.Element {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let alive = true
    toDataURL(value, {
      width: size * 2, // drawn at double size so it stays sharp
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [value, size])

  if (!src) return <div style={{ width: size, height: size }} />
  return <img src={src} width={size} height={size} alt="QR code" draggable={false} style={{ display: 'block' }} />
}