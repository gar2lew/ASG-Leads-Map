import { describe, it, expect } from 'vitest'
import { formatAustralianDate, parseAustralianDate, isValidAustralianDate, toISODate } from './date'

describe('formatAustralianDate', () => {
  it('formats Date objects as DD/MM/YYYY', () => {
    expect(formatAustralianDate(new Date('2026-08-26'))).toBe('26/08/2026')
    expect(formatAustralianDate(new Date('2026-01-05'))).toBe('05/01/2026')
    expect(formatAustralianDate(new Date('2026-12-31'))).toBe('31/12/2026')
  })

  it('formats ISO date strings as DD/MM/YYYY', () => {
    expect(formatAustralianDate('2026-08-26')).toBe('26/08/2026')
    expect(formatAustralianDate('2026-01-05')).toBe('05/01/2026')
  })

  it('handles timestamps', () => {
    // 2026-08-26 in local timezone
    const date = new Date(2026, 7, 26)
    expect(formatAustralianDate(date.getTime())).toBe('26/08/2026')
  })

  it('returns empty string for invalid dates', () => {
    expect(formatAustralianDate('invalid')).toBe('')
    expect(formatAustralianDate(new Date('invalid'))).toBe('')
  })
})

describe('parseAustralianDate', () => {
  it('parses DD/MM/YYYY strings to Date', () => {
    const date = parseAustralianDate('26/08/2026')
    expect(date).toBeInstanceOf(Date)
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(7)
    expect(date?.getDate()).toBe(26)
  })

  it('parses D/M/YYYY strings to Date', () => {
    const date = parseAustralianDate('5/1/2026')
    expect(date).toBeInstanceOf(Date)
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(0)
    expect(date?.getDate()).toBe(5)
  })

  it('returns null for invalid formats', () => {
    expect(parseAustralianDate('2026-08-26')).toBeNull()
    expect(parseAustralianDate('26-08-2026')).toBeNull()
    expect(parseAustralianDate('26/08/26')).toBeNull()
    expect(parseAustralianDate('invalid')).toBeNull()
    expect(parseAustralianDate('')).toBeNull()
  })

  it('returns null for invalid dates', () => {
    expect(parseAustralianDate('31/02/2026')).toBeNull()
    expect(parseAustralianDate('32/01/2026')).toBeNull()
  })
})

describe('isValidAustralianDate', () => {
  it('returns true for valid DD/MM/YYYY', () => {
    expect(isValidAustralianDate('26/08/2026')).toBe(true)
    expect(isValidAustralianDate('05/01/2026')).toBe(true)
    expect(isValidAustralianDate('31/12/2026')).toBe(true)
  })

  it('returns true for valid D/M/YYYY', () => {
    expect(isValidAustralianDate('5/1/2026')).toBe(true)
    expect(isValidAustralianDate('1/1/2026')).toBe(true)
  })

  it('returns false for invalid formats', () => {
    expect(isValidAustralianDate('2026-08-26')).toBe(false)
    expect(isValidAustralianDate('26-08-2026')).toBe(false)
    expect(isValidAustralianDate('invalid')).toBe(false)
    expect(isValidAustralianDate('')).toBe(false)
  })

  it('returns false for invalid dates', () => {
    expect(isValidAustralianDate('31/02/2026')).toBe(false)
    expect(isValidAustralianDate('29/02/2025')).toBe(false)
  })
})

describe('toISODate', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(toISODate('26/08/2026')).toBe('2026-08-26')
    expect(toISODate('05/01/2026')).toBe('2026-01-05')
  })

  it('converts D/M/YYYY to YYYY-MM-DD', () => {
    expect(toISODate('5/1/2026')).toBe('2026-01-05')
  })

  it('returns empty string for invalid input', () => {
    expect(toISODate('invalid')).toBe('')
    expect(toISODate('')).toBe('')
    expect(toISODate('2026-08-26')).toBe('')
  })
})