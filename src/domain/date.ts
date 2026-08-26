const AU_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

export function formatAustralianDate(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input)

  if (isNaN(date.getTime())) {
    return ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

export function parseAustralianDate(input: string): Date | null {
  const match = input.trim().match(AU_DATE_PATTERN)

  if (!match || !match[1] || !match[2] || !match[3]) {
    return null
  }

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function isValidAustralianDate(input: string): boolean {
  return parseAustralianDate(input) !== null
}

export function toISODate(input: string): string {
  const date = parseAustralianDate(input)

  if (!date) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}