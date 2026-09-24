import { describe, expect, it } from 'vitest'
import { semanticThemeTokens } from './themeTokens'

describe('semantic theme tokens', () => {
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
