export type ThemeKey = 'calm' | 'sky' | 'rose'

// Every color the screens use lives in these variables, so switching the theme
// recolors the whole booth instantly.
export const THEMES: Record<ThemeKey, { label: string; vars: Record<string, string> }> = {
  calm: {
    label: 'Calm navy & blue',
    vars: {
      '--bg': '#f3f8ff', '--card': '#ffffff',
      '--primary': '#2563c9', '--primary-2': '#4a8fe7', '--primary-dark': '#0f2a5c',
      '--text': '#0f2347', '--muted': '#6b7fa3', '--border': '#d5e3f5', '--accent': '#7fb2f0',
      '--grad-a': '#f8fbff', '--grad-b': '#d9e9fb', '--capture-bg': '#0b1a33'
    }
  },
  sky: {
    label: 'Fresh sky blue',
    vars: {
      '--bg': '#f2faff', '--card': '#ffffff',
      '--primary': '#1e88e5', '--primary-2': '#4fc3f7', '--primary-dark': '#0d3b66',
      '--text': '#0d2b45', '--muted': '#6a8aa6', '--border': '#d2e8f7', '--accent': '#81d4fa',
      '--grad-a': '#f7fcff', '--grad-b': '#cfe9fb', '--capture-bg': '#0a2236'
    }
  },
  rose: {
    label: 'Rose pink (original)',
    vars: {
      '--bg': '#fff5f8', '--card': '#ffffff',
      '--primary': '#ff6b9d', '--primary-2': '#ff8fb5', '--primary-dark': '#e64d84',
      '--text': '#3b2a33', '--muted': '#9b8790', '--border': '#f3d5e0', '--accent': '#ffc2d6',
      '--grad-a': '#fff8fb', '--grad-b': '#ffe3ee', '--capture-bg': '#1a1216'
    }
  }
}

export function applyTheme(key: string): void {
  const theme = THEMES[key as ThemeKey] ?? THEMES.calm
  const style = document.documentElement.style
  for (const [name, value] of Object.entries(theme.vars)) style.setProperty(name, value)
}