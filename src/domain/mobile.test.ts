import { describe, it, expect } from 'vitest'
import { normaliseAustralianMobile, formatAustralianMobile, isValidAustralianMobile } from './mobile'

describe('normaliseAustralianMobile', () => {
  it('normalises standard Australian mobile formats', () => {
    expect(normaliseAustralianMobile('0412 345 678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('0412345678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('+61 412 345 678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('+61412345678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('61 412 345 678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('61412345678')).toBe('+61412345678')
  })

  it('handles various spacing and separators', () => {
    expect(normaliseAustralianMobile('0412-345-678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('0412.345.678')).toBe('+61412345678')
    expect(normaliseAustralianMobile('  0412 345 678  ')).toBe('+61412345678')
  })

  it('returns null for invalid numbers', () => {
    expect(normaliseAustralianMobile('0412 345 67')).toBeNull()
    expect(normaliseAustralianMobile('0412 345 6789')).toBeNull()
    expect(normaliseAustralianMobile('03 1234 5678')).toBeNull()
    expect(normaliseAustralianMobile('+1 555 123 4567')).toBeNull()
    expect(normaliseAustralianMobile('')).toBeNull()
    expect(normaliseAustralianMobile('not a number')).toBeNull()
  })

  it('handles 1300/1800 numbers as invalid mobile', () => {
    expect(normaliseAustralianMobile('1300 123 456')).toBeNull()
    expect(normaliseAustralianMobile('1800 123 456')).toBeNull()
  })
})

describe('formatAustralianMobile', () => {
  it('formats normalised numbers for display', () => {
    expect(formatAustralianMobile('+61412345678')).toBe('0412 345 678')
    expect(formatAustralianMobile('+61400000000')).toBe('0400 000 000')
  })

  it('returns original string for non-normalised input', () => {
    expect(formatAustralianMobile('0412 345 678')).toBe('0412 345 678')
    expect(formatAustralianMobile('invalid')).toBe('invalid')
  })
})

describe('isValidAustralianMobile', () => {
  it('returns true for valid Australian mobiles', () => {
    expect(isValidAustralianMobile('0412 345 678')).toBe(true)
    expect(isValidAustralianMobile('+61412345678')).toBe(true)
    expect(isValidAustralianMobile('61412345678')).toBe(true)
  })

  it('returns false for invalid numbers', () => {
    expect(isValidAustralianMobile('0412 345 67')).toBe(false)
    expect(isValidAustralianMobile('03 1234 5678')).toBe(false)
    expect(isValidAustralianMobile('+1 555 123 4567')).toBe(false)
    expect(isValidAustralianMobile('')).toBe(false)
  })
})