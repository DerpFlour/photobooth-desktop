import { createContext, ReactNode, useContext, useMemo, useState } from 'react'

// Which screen is showing. A tiny router: no URLs needed in a kiosk.
export type Screen =
  | { name: 'home' }
  | { name: 'gallery' }
  | { name: 'layout' }
  | { name: 'template' }
  | { name: 'capture'; retake?: number } // retake = slot number to redo
  | { name: 'review' }
  | { name: 'edit' }
  | { name: 'result' }
  | { name: 'cameraSetup' }
  | { name: 'admin'; unlocked?: boolean } // unlocked = already entered the PIN

type NavState = { screen: Screen; go: (screen: Screen) => void }
const NavContext = createContext<NavState | null>(null)

export function NavProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const value = useMemo<NavState>(() => ({ screen, go: setScreen }), [screen])
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): NavState {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>')
  return ctx
}