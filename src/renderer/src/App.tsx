import { useEffect } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IdleWatcher } from './components/IdleWatcher'
import { Stage } from './components/Stage'
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
  'listPrinters', 'printSheet', 'readSessionFile', 'saveSheetFile'
] as const

function missingApi(): string[] {
  const api = window.api as unknown as Record<string, unknown> | undefined
  if (!api) return ['the connection to the booth program']
  return REQUIRED_API.filter((name) => typeof api[name] !== 'function')
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
          <NavProvider>
            <SessionProvider>
              <Router />
              <IdleWatcher />
            </SessionProvider>
          </NavProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </Stage>
  )
}