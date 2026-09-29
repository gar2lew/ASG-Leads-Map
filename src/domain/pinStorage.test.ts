import { describe, expect, it } from 'vitest'
import { PinOutcome } from './pinOutcome'
import { getLeadSyncTarget } from './pinStorage'
import type { Pin } from './pin'

describe('pin lead sync target', () => {
  it('reconciles a linked lead even when its map outcome is no longer Lead', () => {
    const pin = { id: 'pin-1', linkedLeadId: 'lead-1', outcome: PinOutcome.Knocked } as Pin
    expect(getLeadSyncTarget(pin)).toEqual({ id: 'lead-1', createIfMissing: false })
  })

  it('creates a shared lead only for new manual lead pins', () => {
    const pin = { id: 'pin-2', source: 'manual', outcome: PinOutcome.Lead } as Pin
    expect(getLeadSyncTarget(pin)).toEqual({ id: 'pin-2', createIfMissing: true })
  })

  it('does not create a shared lead for an unlinked non-lead pin', () => {
    const pin = { id: 'pin-3', source: 'manual', outcome: PinOutcome.Knocked } as Pin
    expect(getLeadSyncTarget(pin)).toBeNull()
  })
})
