import { describe, it, expect } from 'vitest'
import { PinOutcome } from './pinOutcome'
import {
  requiresContactDetails,
  requiresContactName,
  requiresContactMobile,
  requiresLeadIntegration,
  OUTCOME_FIELD_REQUIREMENTS,
  outcomeFieldRequirements,
  outcomeNote,
} from './outcomeRules'

describe('requiresContactDetails', () => {
  it('returns true ONLY for Lead', () => {
    expect(requiresContactDetails(PinOutcome.Lead)).toBe(true)
    expect(requiresContactDetails(PinOutcome.Knocked)).toBe(false)
    expect(requiresContactDetails(PinOutcome.NotKnocked)).toBe(false)
    expect(requiresContactDetails(PinOutcome.NotInterested)).toBe(false)
    expect(requiresContactDetails(PinOutcome.DidNotQualify)).toBe(false)
  })
})

describe('requiresContactName', () => {
  it('returns true only for Lead', () => {
    expect(requiresContactName(PinOutcome.Lead)).toBe(true)
    expect(requiresContactName(PinOutcome.Knocked)).toBe(false)
    expect(requiresContactName(PinOutcome.NotKnocked)).toBe(false)
    expect(requiresContactName(PinOutcome.NotInterested)).toBe(false)
    expect(requiresContactName(PinOutcome.DidNotQualify)).toBe(false)
  })
})

describe('requiresContactMobile', () => {
  it('returns true only for Lead', () => {
    expect(requiresContactMobile(PinOutcome.Lead)).toBe(true)
    expect(requiresContactMobile(PinOutcome.Knocked)).toBe(false)
    expect(requiresContactMobile(PinOutcome.NotKnocked)).toBe(false)
    expect(requiresContactMobile(PinOutcome.NotInterested)).toBe(false)
    expect(requiresContactMobile(PinOutcome.DidNotQualify)).toBe(false)
  })
})

describe('requiresLeadIntegration', () => {
  it('returns true only for Lead', () => {
    expect(requiresLeadIntegration(PinOutcome.Lead)).toBe(true)
    expect(requiresLeadIntegration(PinOutcome.Knocked)).toBe(false)
    expect(requiresLeadIntegration(PinOutcome.NotKnocked)).toBe(false)
    expect(requiresLeadIntegration(PinOutcome.NotInterested)).toBe(false)
    expect(requiresLeadIntegration(PinOutcome.DidNotQualify)).toBe(false)
  })
})

describe('OUTCOME_FIELD_REQUIREMENTS', () => {
  it('covers every outcome', () => {
    expect(Object.keys(OUTCOME_FIELD_REQUIREMENTS).sort()).toEqual(
      Object.values(PinOutcome).sort()
    )
  })

  it('requires only address/confirmation/coordinates for non-Lead outcomes', () => {
    const nonLeadOutcomes = [PinOutcome.Knocked, PinOutcome.NotKnocked, PinOutcome.NotInterested, PinOutcome.Revisit, PinOutcome.WrongNumber, PinOutcome.DidNotQualify]
    nonLeadOutcomes.forEach((outcome) => {
      const requirements = OUTCOME_FIELD_REQUIREMENTS[outcome]
      expect(requirements.required).toEqual(['address', 'addressConfirmed', 'coordinates'])
      expect(requirements.optional).toEqual(['notes'])
      expect(requirements.leadIntegration).toBe(false)
    })
  })

  it('requires contact fields for Lead', () => {
    const requirements = OUTCOME_FIELD_REQUIREMENTS[PinOutcome.Lead]
    expect(requirements.required).toEqual(['address', 'addressConfirmed', 'coordinates', 'contactName', 'contactMobile'])
    expect(requirements.optional).toEqual(['email', 'notes'])
    expect(requirements.leadIntegration).toBe(true)
  })
})

describe('outcomeFieldRequirements', () => {
  it('returns the requirements for a valid outcome', () => {
    expect(outcomeFieldRequirements(PinOutcome.Lead)).toBe(OUTCOME_FIELD_REQUIREMENTS[PinOutcome.Lead])
  })

  it('throws for an invalid outcome', () => {
    expect(() => outcomeFieldRequirements('invalid' as PinOutcome)).toThrow(/Invalid pin outcome/)
  })
})

describe('outcomeNote', () => {
  it('returns a note for Not Interested', () => {
    expect(outcomeNote(PinOutcome.NotInterested)).toBe('Do not revisit this property.')
  })

  it('returns no note for other outcomes', () => {
    expect(outcomeNote(PinOutcome.Lead)).toBeUndefined()
    expect(outcomeNote(PinOutcome.Knocked)).toBeUndefined()
    expect(outcomeNote(PinOutcome.NotKnocked)).toBeUndefined()
    expect(outcomeNote(PinOutcome.DidNotQualify)).toBeUndefined()
  })
})
