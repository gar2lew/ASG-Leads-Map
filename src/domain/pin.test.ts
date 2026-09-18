import { describe, expect, it } from 'vitest'
import { createPin } from './pin'
import { PinOutcome } from './pinOutcome'

describe('createPin', () => {
  it('preserves source metadata', () => {
    const pin = createPin(
      {
        latitude: -31.95,
        longitude: 115.86,
        outcome: PinOutcome.NotKnocked,
        address: undefined,
        notes: undefined,
        contactName: undefined,
        contactPhone: undefined,
        contactEmail: undefined,
        source: 'manual',
        externalId: 'submission-1',
      },
      'user-1',
    )

    expect(pin.source).toBe('manual')
    expect(pin.externalId).toBe('submission-1')
  })
})
