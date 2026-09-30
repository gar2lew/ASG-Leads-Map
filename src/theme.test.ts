import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, initialiseTheme, nextTheme, resolveInitialTheme } from './theme'
import { semanticThemeTokens } from './theme/themeTokens'

describe('resolveInitialTheme', () => {
  it('defaults new users to light', () => {
    expect(resolveInitialTheme(null)).toBe('light')
  })

  it.each(['light', 'dark', 'high-contrast'] as const)(
    'preserves a saved %s preference',
    (theme) => {
      expect(resolveInitialTheme(theme)).toBe(theme)
    },
  )

  it('falls back safely when a saved value is invalid', () => {
    expect(resolveInitialTheme('sepia')).toBe('light')
  })
})

describe('initialiseTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('initialiseThemeDefaultsToLight', () => {
    expect(initialiseTheme()).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('asg-theme')).toBe('light')
  })

  it('applies an existing valid preference without replacing it', () => {
    localStorage.setItem('asg-theme', 'dark')

    expect(initialiseTheme()).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('asg-theme')).toBe('dark')
  })

  it('applies the default theme when browser storage is unavailable', () => {
    const storage = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('Storage blocked') } })
    try {
      expect(initialiseTheme()).toBe('light')
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    } finally {
      if (storage) Object.defineProperty(window, 'localStorage', storage)
    }
  })
})

describe('applyTheme', () => {
  it('applyThemeSetsSelectedSemanticProperties', () => {
    for (const theme of ['light', 'dark', 'high-contrast'] as const) {
      applyTheme(theme)
      expect(document.documentElement).toHaveAttribute('data-theme', theme)
      for (const [key, value] of Object.entries(semanticThemeTokens[theme])) {
        const property = `--asg-theme-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
        expect(document.documentElement.style.getPropertyValue(property)).toBe(value)
      }
    }
  })
})

describe('initialiseTheme system preference', () => {
  it('initialiseThemePreservesSavedChoiceRegardlessOfSystemPreference', () => {
    const originalMatchMedia = window.matchMedia
    try {
      for (const systemPrefersDark of [false, true]) {
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: systemPrefersDark }) })
        for (const savedTheme of ['dark', 'high-contrast'] as const) {
          localStorage.setItem('asg-theme', savedTheme)
          expect(initialiseTheme()).toBe(savedTheme)
          expect(document.documentElement).toHaveAttribute('data-theme', savedTheme)
          expect(document.documentElement.style.getPropertyValue('--asg-theme-canvas')).toBe(semanticThemeTokens[savedTheme].canvas)
          expect(localStorage.getItem('asg-theme')).toBe(savedTheme)
        }
      }
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
    }
  })
})

describe('nextTheme', () => {
  it.each([
    ['light', 'dark'],
    ['dark', 'high-contrast'],
    ['high-contrast', 'light'],
  ] as const)('cycles %s to %s', (current, expected) => {
    expect(nextTheme(current)).toBe(expected)
  })
})
