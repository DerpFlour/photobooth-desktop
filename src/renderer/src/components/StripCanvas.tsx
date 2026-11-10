import { useEffect, useRef } from 'react'
import { drawStrip, StripAssets } from '../render/drawStrip'
import { EditState, LayoutConfig, TemplateConfig } from '../types'
import { useStageScale } from './Stage'

type Props = {
  layout: LayoutConfig
  template: TemplateConfig
  edit: EditState
  assets: StripAssets
  cssWidth: number // width on the 1920x1080 design, in design pixels
}

// The live preview. It calls the SAME drawStrip() that export uses, just at
// screen size, so what the guest sees is what they get.
export function StripCanvas({ layout, template, edit, assets, cssWidth }: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const scale = useStageScale()

  // Draw at the real number of screen pixels so it stays sharp.
  const pixelWidth = Math.min(
    layout.output.width,
    Math.max(200, Math.round(cssWidth * scale * (window.devicePixelRatio || 1)))
  )
  const cssHeight = (cssWidth * layout.canvas.height) / layout.canvas.width

  useEffect(() => {
    if (ref.current) drawStrip(ref.current, { layout, template, edit, assets, pixelWidth, useCache: true })
  }, [layout, template, edit, assets, pixelWidth])

  return <canvas ref={ref} style={{ width: cssWidth, height: cssHeight, display: 'block' }} />
}