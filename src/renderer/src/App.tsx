import { ReactNode, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IdleWatcher } from './components/IdleWatcher'
import { Stage } from './components/Stage'
import { loadContent } from './state/content'
import { NavProvider, useNav } from './state/nav'
import { SessionProvider } from './state/session'
import { SettingsProvider, useSettings } from './state/settings'
import { applyTheme } from './theme'
import { Admin } from './screens/Admin'
import { CameraSetup } from './screens/CameraSetup'
import { Capture } from './screens/Capture'
import { Edit } from './screens/Edit'
import { Gallery } from './screens/Gallery'
import { Home } from './screens/Home'
import { LayoutSelect } from './screens/LayoutSelect'
import { Result } from './screens/Result'
import { Review } from './screens/Review'
import { TemplateSelect } from './screens/TemplateSelect'

// The screens update instantly, but the connection to the booth program only
// updates when the app is fully restarted. If they don't match, say so.
const REQUIRED_API = [
  'cloudShare', 'cloudStatus', 'cloudTest', 'cloudQueue', 'cloudRetry',
  'listPrinters', 'printSheet', 'readSessionFile', 'saveSheetFile',
  'contentGet', 'contentSet', 'contentPickPng', 'contentStoreFrame', 'contentSaveGuide'
] as const

function missingApi(): string[] {
  const api = window.api as unknown as Record<string, unknown> | undefined
  if (!api) return ['the connection to the booth program']
  return REQUIRED_API.filter((name) => typeof api[name] !== 'function')
}

// Loads the admin's layouts and frames before any screen needs them.
function ContentGate({ children }: { children: ReactNode }): React.JSX.Element {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    loadContent()
      .catch((e) => console.warn('[content] could not load, using the built-in layouts', e))
      .finally(() => setReady(true))
  }, [])
  if (!ready) return <div className="center-msg">Starting booth…</div>
  return <>{children}</>
}

function Router(): React.JSX.Element | null {
  const { screen } = useNav()
  const { settings } = useSettings()

  // Colors for the chosen theme (the booth name and look live in the settings).
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  // The area around the 1920x1080 design takes the screen's own background,
  // so it fills the whole window at any size.
  useEffect(() => {
    const background =
      screen.name === 'capture'
        ? 'var(--capture-bg)'
        : screen.name === 'home'
          ? 'linear-gradient(180deg, var(--grad-a), var(--grad-b))'
          : 'var(--bg)'
    document.documentElement.style.setProperty('--page-bg', background)
  }, [screen.name, settings.theme])

  switch (screen.name) {
    case 'home':
      return <Home />
    case 'gallery':
      return <Gallery />
    case 'layout':
      return <LayoutSelect />
    case 'template':
      return <TemplateSelect />
    case 'capture':
      return <Capture key={screen.retake ?? 'all'} retake={screen.retake} />
    case 'review':
      return <Review />
    case 'edit':
      return <Edit />
    case 'result':
      return <Result />
    case 'cameraSetup':
      return <CameraSetup />
    case 'admin':
      return <Admin initiallyUnlocked={screen.unlocked ?? false} />
    default:
      return null
  }
}

export default function App(): React.JSX.Element {
  const missing = missingApi()
  if (missing.length > 0) {
    return (
      <Stage>
        <div className="center-msg">
          The booth program needs a full restart
          <p>Close this window, press Ctrl+C in the terminal, then run npm run dev again.</p>
          <p style={{ fontSize: 22, color: '#9b8790' }}>Out of date: {missing.join(', ')}</p>
        </div>
      </Stage>
    )
  }

  return (
    <Stage>
      <ErrorBoundary>
        <SettingsProvider>
          <ContentGate>
            <NavProvider>
              <SessionProvider>
                <Router />
                <IdleWatcher />
              </SessionProvider>
            </NavProvider>
          </ContentGate>
        </SettingsProvider>
      </ErrorBoundary>
    </Stage>
  )
}