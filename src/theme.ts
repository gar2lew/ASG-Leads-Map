export const APP_THEMES = ['light', 'dark', 'high-contrast'] as const

export type AppTheme = (typeof APP_THEMES)[number]

export const DEFAULT_THEME: AppTheme = 'high-contrast'

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
  const savedTheme = typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('asg-theme')
  const theme = resolveInitialTheme(savedTheme)

  if (typeof window !== 'undefined' && savedTheme !== theme) {
    window.localStorage.setItem('asg-theme', theme)
  }

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }

  return theme
}
