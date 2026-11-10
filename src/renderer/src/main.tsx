import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// A long press on a touchscreen acts like a right-click. Block the menu.
window.addEventListener('contextmenu', (e) => e.preventDefault())

createRoot(document.getElementById('root') as HTMLElement).render(<App />)