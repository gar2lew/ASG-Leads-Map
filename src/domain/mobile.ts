export function normaliseAustralianMobile(input: string): string | null {
  const cleaned = input.replace(/[\s\-().]/g, '')

  if (cleaned.startsWith('+614') && cleaned.length === 12) {
    return cleaned
  }

  if (cleaned.startsWith('614') && cleaned.length === 11) {
    return `+${cleaned}`
  }

  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return `+61${cleaned.slice(1)}`
  }

  return null
}

export function formatAustralianMobile(normalised: string): string {
  if (!normalised.startsWith('+614') || normalised.length !== 12) {
    return normalised
  }

  const national = `0${normalised.slice(3)}`
  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`
}

export function isValidAustralianMobile(input: string): boolean {
  return normaliseAustralianMobile(input) !== null
}