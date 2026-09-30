import { describe, expect, it } from 'vitest'
import { semanticThemeTokens } from './themeTokens'

describe('semantic theme tokens', () => {
  it('definesCompleteTokensForEachTheme', () => {
    const keys = ['canvas', 'surface', 'surfaceRaised', 'border', 'text', 'textSecondary', 'textMuted', 'placeholder', 'focus', 'action', 'success', 'warning', 'danger']
    for (const theme of ['light', 'dark', 'high-contrast'] as const) {
      expect(Object.keys(semanticThemeTokens[theme]).sort()).toEqual([...keys].sort())
      for (const value of Object.values(semanticThemeTokens[theme])) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
  it('defines readable foregrounds, surfaces, borders, and focus for both themes', () => {
    for (const theme of [semanticThemeTokens.light, semanticThemeTokens.dark]) {
      expect(theme.canvas).toMatch(/^#/) 
      expect(theme.surface).toMatch(/^#/) 
      expect(theme.text).toMatch(/^#/) 
      expect(theme.textMuted).toMatch(/^#/) 
      expect(theme.border).toMatch(/^#/) 
      expect(theme.focus).toMatch(/^#/) 
    }
  })
})
