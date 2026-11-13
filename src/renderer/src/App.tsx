import { useEffect } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IdleWatcher } from './components/IdleWatcher'
import { Stage } from './components/Stage'
import { NavProvider, useNav } from './state/nav'
import { SessionProvider } from './state/session'
import { SettingsProvider } from './state/settings'
import { Admin } from './screens/Admin'
import { CameraSetup } from './screens/CameraSetup'
import { Capture } from './screens/Capture'
import { Edit } from './screens/Edit'
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

  // The area around the 1920x1080 design takes the current screen's color,
  // so the dark camera screen fills the whole window at any size.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--page-bg',
      screen.name === 'capture' ? '#1a1216' : '#fff5f8'
    )
  }, [screen.name])

  switch (screen.name) {
    case 'home':
      return <Home />
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