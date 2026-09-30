export interface SemanticThemeTokens {
  canvas: string
  surface: string
  surfaceRaised: string
  border: string
  text: string
  textSecondary: string
  textMuted: string
  placeholder: string
  focus: string
  action: string
  success: string
  warning: string
  danger: string
}

export const semanticThemeTokens: Record<'light' | 'dark' | 'high-contrast', SemanticThemeTokens> = {
  light: {
    canvas: '#f4f1ea', surface: '#fffdf8', surfaceRaised: '#ffffff', border: '#d6c8ad', text: '#172235', textSecondary: '#475569', textMuted: '#64748b', placeholder: '#718096', focus: '#c9972f',
    action: '#a97d22', success: '#059669', warning: '#d97706', danger: '#dc2626',
  },
  dark: {
    canvas: '#07111d', surface: '#0d1b2a', surfaceRaised: '#14253d', border: '#38516f', text: '#ffffff', textSecondary: '#e6edf5', textMuted: '#b9c7d8', placeholder: '#9fb0c4', focus: '#ffd700',
    action: '#d4b87a', success: '#6ee7b7', warning: '#fde68a', danger: '#fca5a5',
  },
  'high-contrast': {
    canvas: '#07111d', surface: '#0d1b2a', surfaceRaised: '#14253d', border: '#38516f', text: '#ffffff', textSecondary: '#e6edf5', textMuted: '#b9c7d8', placeholder: '#9fb0c4', focus: '#ffd700',
    action: '#ffcc00', success: '#66ff66', warning: '#ffcc00', danger: '#ff6666',
  },
}
