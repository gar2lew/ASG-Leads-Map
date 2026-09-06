import { describe, it, expect } from 'vitest'
import { PinOutcome, pinOutcomeOrder, isValidPinOutcome, pinOutcomeLabel, pinOutcomeColor } from './pinOutcome'

describe('PinOutcome', () => {
  it('defines all five required outcomes', () => {
    expect(PinOutcome.Knocked).toBe('knocked')
    expect(PinOutcome.NotKnocked).toBe('not_knocked')
    expect(PinOutcome.NotInterested).toBe('not_interested')
    expect(PinOutcome.DidNotQualify).toBe('did_not_qualify')
    expect(PinOutcome.Lead).toBe('lead')
  })

  it('has exactly 7 outcomes', () => {
    expect(Object.keys(PinOutcome).length).toBe(7)
  })
})

describe('pinOutcomeOrder', () => {
  it('orders outcomes in the correct display sequence', () => {
    expect(pinOutcomeOrder).toEqual([
      PinOutcome.Knocked,
      PinOutcome.NotKnocked,
      PinOutcome.NotInterested,
      PinOutcome.DidNotQualify,
      PinOutcome.Lead,
    ])
  })
})

describe('isValidPinOutcome', () => {
  it('returns true for all valid outcomes', () => {
    expect(isValidPinOutcome(PinOutcome.Knocked)).toBe(true)
    expect(isValidPinOutcome(PinOutcome.NotKnocked)).toBe(true)
    expect(isValidPinOutcome(PinOutcome.NotInterested)).toBe(true)
    expect(isValidPinOutcome(PinOutcome.DidNotQualify)).toBe(true)
    expect(isValidPinOutcome(PinOutcome.Lead)).toBe(true)
  })

  it('returns false for invalid strings', () => {
    expect(isValidPinOutcome('invalid')).toBe(false)
    expect(isValidPinOutcome('')).toBe(false)
    expect(isValidPinOutcome('Knocked')).toBe(false)
    expect(isValidPinOutcome('NOT_KNOCKED')).toBe(false)
  })
})

describe('pinOutcomeLabel', () => {
  it('returns human-readable labels', () => {
    expect(pinOutcomeLabel(PinOutcome.Knocked)).toBe('Knocked')
    expect(pinOutcomeLabel(PinOutcome.NotKnocked)).toBe('Not Knocked')
    expect(pinOutcomeLabel(PinOutcome.NotInterested)).toBe('Not Interested')
    expect(pinOutcomeLabel(PinOutcome.DidNotQualify)).toBe('Did Not Qualify')
    expect(pinOutcomeLabel(PinOutcome.Lead)).toBe('Lead')
  })

  it('throws for invalid outcome', () => {
    expect(() => pinOutcomeLabel('invalid' as PinOutcome)).toThrow()
  })
})

describe('pinOutcomeColor', () => {
  it('returns distinct colors for each outcome', () => {
    const colors = pinOutcomeOrder.map(pinOutcomeColor)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(5)
  })

  it('returns valid hex color strings', () => {
    pinOutcomeOrder.forEach((outcome) => {
      const color = pinOutcomeColor(outcome)
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })
})
