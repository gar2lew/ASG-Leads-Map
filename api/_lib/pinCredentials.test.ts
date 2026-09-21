import { describe, expect, it } from 'vitest'
import { createPinCredentials, isSixDigitPin, matchesPin } from './pinCredentials'

describe('admin PIN credentials', () => {
  it('verifies only the original PIN', () => {
    const credentials = createPinCredentials('123456')
    expect(matchesPin('123456', credentials)).toBe(true)
    expect(matchesPin('123457', credentials)).toBe(false)
  })

  it('accepts exactly six digits', () => {
    expect(isSixDigitPin('123456')).toBe(true)
    expect(isSixDigitPin('12345')).toBe(false)
    expect(isSixDigitPin('1234567')).toBe(false)
    expect(isSixDigitPin('12a456')).toBe(false)
  })
})
