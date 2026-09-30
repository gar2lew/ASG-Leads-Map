import { semanticThemeTokens } from './theme/themeTokens'

export const APP_THEMES = ['light', 'dark', 'high-contrast'] as const

export type AppTheme = (typeof APP_THEMES)[number]

export const DEFAULT_THEME: AppTheme = 'light'

export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  for (const [key, value] of Object.entries(semanticThemeTokens[theme])) {
    const property = `--asg-theme-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
    root.style.setProperty(property, value)
  }
}

export function nextTheme(theme: AppTheme): AppTheme {
  const index = APP_THEMES.indexOf(theme)
  return APP_THEMES[(index + 1) % APP_THEMES.length] ?? DEFAULT_THEME
}

export function resolveInitialTheme(savedTheme: string | null): AppTheme {
  return APP_THEMES.includes(savedTheme as AppTheme)
    ? (savedTheme as AppTheme)
    : DEFAULT_THEME
}

export function initialiseTheme(): AppTheme {
  let savedTheme: string | null = null
  if (typeof window !== 'undefined') {
    try {
      savedTheme = window.localStorage.getItem('asg-theme')
    } catch {
      // Browsers may disable storage; the default theme still applies.
    }
  }
  const theme = resolveInitialTheme(savedTheme)

  if (typeof window !== 'undefined' && savedTheme !== theme) {
    try {
      window.localStorage.setItem('asg-theme', theme)
    } catch {
      // Keep the current session usable without persisted preferences.
    }
  }

  applyTheme(theme)

  return theme
}
