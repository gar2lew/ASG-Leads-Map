import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isLeadIntegrationConfigured, submitLead } from './leads'
import type { Pin } from '../domain/pin'

const samplePin: Pin = {
  id: 'pin-1',
  latitude: -31.9523,
  longitude: 115.8613,
  outcome: 'lead',
  address: '42 Smith Street, Joondalup WA 6027',
  contactName: 'Jane Doe',
  contactPhone: '0412 345 678',
  contactEmail: 'jane@example.com',
  notes: 'Interested in solar',
  createdBy: 'dev-admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  synced: false,
  syncAttempts: 0,
}

describe('lead integration boundary', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('reports the integration as not configured', () => {
    expect(isLeadIntegrationConfigured()).toBe(false)
  })

  it('rejects submission because Jotform is not implemented', async () => {
    await expect(submitLead(samplePin)).rejects.toThrow(/not implemented|not configured/i)
  })

  it('never fakes a successful submission', async () => {
    const result = submitLead(samplePin).then(
      () => 'resolved',
      () => 'rejected'
    )
    expect(await result).toBe('rejected')
  })
})