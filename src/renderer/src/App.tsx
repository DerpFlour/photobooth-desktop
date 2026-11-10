import { useEffect } from 'react'
import { Stage } from './components/Stage'
import { NavProvider, useNav } from './state/nav'
import { SessionProvider } from './state/session'
import { SettingsProvider } from './state/settings'
import { CameraSetup } from './screens/CameraSetup'
import { Capture } from './screens/Capture'
import { Edit } from './screens/Edit'
import { Home } from './screens/Home'
import { LayoutSelect } from './screens/LayoutSelect'
import { Result } from './screens/Result'
import { Review } from './screens/Review'
import { TemplateSelect } from './screens/TemplateSelect'

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
    default:
      return null
  }
}

export default function App(): React.JSX.Element {
  return (
    <Stage>
      <SettingsProvider>
        <NavProvider>
          <SessionProvider>
            <Router />
          </SessionProvider>
        </NavProvider>
      </SettingsProvider>
    </Stage>
  )
}