import { PinOutcome } from './pinOutcome'

/**
 * Central outcome workflow rules.
 *
 * Only Lead exposes and requires contact fields. All other outcomes are
 * address + confirmation + coordinates with optional notes.
 */

export function requiresContactDetails(outcome: PinOutcome): boolean {
  return outcome === PinOutcome.Lead
}

/** Lead is the only outcome that requires a contact name. */
export function requiresContactName(outcome: PinOutcome): boolean {
  return requiresContactDetails(outcome)
}

/** Lead is the only outcome that requires a mobile number. */
export function requiresContactMobile(outcome: PinOutcome): boolean {
  return requiresContactDetails(outcome)
}

/** Lead is the only outcome that should later be sent to the lead integration. */
export function requiresLeadIntegration(outcome: PinOutcome): boolean {
  return outcome === PinOutcome.Lead
}

export interface OutcomeFieldRequirements {
  required: string[]
  optional: string[]
  leadIntegration: boolean
}

export const OUTCOME_FIELD_REQUIREMENTS: Record<PinOutcome, OutcomeFieldRequirements> = {
  [PinOutcome.NotKnocked]: {
    required: ['address', 'addressConfirmed', 'coordinates'],
    optional: ['notes'],
    leadIntegration: false,
  },
  [PinOutcome.Knocked]: {
    required: ['address', 'addressConfirmed', 'coordinates'],
    optional: ['notes'],
    leadIntegration: false,
  },
  [PinOutcome.NotInterested]: {
    required: ['address', 'addressConfirmed', 'coordinates'],
    optional: ['notes'],
    leadIntegration: false,
  },
  [PinOutcome.DidNotQualify]: {
    required: ['address', 'addressConfirmed', 'coordinates'],
    optional: ['notes'],
    leadIntegration: false,
  },
  [PinOutcome.Lead]: {
    required: ['address', 'addressConfirmed', 'coordinates', 'contactName', 'contactMobile'],
    optional: ['email', 'notes'],
    leadIntegration: true,
  },
}

export function outcomeFieldRequirements(outcome: PinOutcome): OutcomeFieldRequirements {
  const requirements = OUTCOME_FIELD_REQUIREMENTS[outcome]
  if (!requirements) {
    throw new Error(`Invalid pin outcome: ${outcome}`)
  }
  return requirements
}

/**
 * Compact, professional messaging shown per outcome.
 * Keep conservative - do not add aggressive warning UI.
 */
export function outcomeNote(outcome: PinOutcome): string | undefined {
  switch (outcome) {
    case PinOutcome.NotInterested:
      return 'Do not revisit this property.'
    default:
      return undefined
  }
}