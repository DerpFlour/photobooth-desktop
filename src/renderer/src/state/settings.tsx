import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type SettingsState = {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => Promise<void>
}
const SettingsContext = createContext<SettingsState | null>(null)

// Loads the saved settings from the main process before showing anything.
export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

    useEffect(() => {
    if (!window.api) {
      setError('The preload script did not load (window.api is missing).')
      return
    }
    window.api
      .getSettings()
      .then(setSettings)
      .catch((e) => setError(String(e)))
  }, [])

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(await window.api.updateSettings(patch))
  }, [])

  const value = useMemo(() => (settings ? { settings, update } : null), [settings, update])

  if (error) return <div className="center-msg">Could not load settings<p>{error}</p></div>
  if (!value) return <div className="center-msg">Starting booth…</div>
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}