import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

const DESIGN_W = 1920
const DESIGN_H = 1080

// How much the 1920x1080 design is shrunk or grown to fit the window.
// Dragging code must divide mouse/touch movement by this number.
const ScaleContext = createContext(1)
export const useStageScale = (): number => useContext(ScaleContext)

const fit = (): number => Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)

// Every screen is designed on a fixed 1920x1080 canvas. This scales it to
// fit any window or monitor, centered, so it looks identical everywhere.
export function Stage({ children }: { children: ReactNode }): React.JSX.Element {
  const [scale, setScale] = useState(fit)

  useEffect(() => {
    const onResize = (): void => setScale(fit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <ScaleContext.Provider value={scale}>
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </ScaleContext.Provider>
  )
}