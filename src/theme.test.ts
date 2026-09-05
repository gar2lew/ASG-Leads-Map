import { beforeEach, describe, expect, it } from 'vitest'
import { initialiseTheme, nextTheme, resolveInitialTheme } from './theme'

describe('resolveInitialTheme', () => {
  it('defaults new users to high contrast', () => {
    expect(resolveInitialTheme(null)).toBe('high-contrast')
  })

  it.each(['light', 'dark', 'high-contrast'] as const)(
    'preserves a saved %s preference',
    (theme) => {
      expect(resolveInitialTheme(theme)).toBe(theme)
    },
  )

  it('falls back safely when a saved value is invalid', () => {
    expect(resolveInitialTheme('sepia')).toBe('high-contrast')
  })
})

describe('initialiseTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('applies and saves high contrast for a first-time user', () => {
    expect(initialiseTheme()).toBe('high-contrast')
    expect(document.documentElement).toHaveAttribute('data-theme', 'high-contrast')
    expect(localStorage.getItem('asg-theme')).toBe('high-contrast')
  })

  it('applies an existing valid preference without replacing it', () => {
    localStorage.setItem('asg-theme', 'dark')

    expect(initialiseTheme()).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('asg-theme')).toBe('dark')
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
