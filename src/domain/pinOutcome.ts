export const PinOutcome = {
  Knocked: 'knocked',
  NotKnocked: 'not_knocked',
  NotInterested: 'not_interested',
  DidNotQualify: 'did_not_qualify',
  Lead: 'lead',
} as const

export type PinOutcome = (typeof PinOutcome)[keyof typeof PinOutcome]

export const pinOutcomeOrder: PinOutcome[] = [
  PinOutcome.Knocked,
  PinOutcome.NotKnocked,
  PinOutcome.NotInterested,
  PinOutcome.DidNotQualify,
  PinOutcome.Lead,
]

export function isValidPinOutcome(value: string): value is PinOutcome {
  return Object.values(PinOutcome).includes(value as PinOutcome)
}

const pinOutcomeLabels: Record<PinOutcome, string> = {
  [PinOutcome.Knocked]: 'Knocked',
  [PinOutcome.NotKnocked]: 'Not Knocked',
  [PinOutcome.NotInterested]: 'Not Interested',
  [PinOutcome.DidNotQualify]: 'Did Not Qualify',
  [PinOutcome.Lead]: 'Lead',
}

export function pinOutcomeLabel(outcome: PinOutcome): string {
  const label = pinOutcomeLabels[outcome]
  if (!label) {
    throw new Error(`Invalid pin outcome: ${outcome}`)
  }
  return label
}

const pinOutcomeColors: Record<PinOutcome, string> = {
  [PinOutcome.Knocked]: '#3B82F6',
  [PinOutcome.NotKnocked]: '#9CA3AF',
  [PinOutcome.NotInterested]: '#EF4444',
  [PinOutcome.DidNotQualify]: '#F59E0B',
  [PinOutcome.Lead]: '#10B981',
}

export function pinOutcomeColor(outcome: PinOutcome): string {
  const color = pinOutcomeColors[outcome]
  if (!color) {
    throw new Error(`Invalid pin outcome: ${outcome}`)
  }
  return color
}