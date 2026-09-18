import { describe, expect, it } from 'vitest'
import { PinOutcome } from './pinOutcome'
import type { Pin } from './pin'
import { exportReportToCsv, filterPinsForReport, summarizePins, compareReportPeriods } from './reporting'

function pin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    latitude: -31.95,
    longitude: 115.86,
    outcome: PinOutcome.NotKnocked,
    address: '1 Test St',
    notes: undefined,
    contactName: undefined,
    contactPhone: undefined,
    contactEmail: undefined,
    createdAt: '2026-09-17T01:00:00.000Z',
    updatedAt: '2026-09-17T01:00:00.000Z',
    createdBy: 'rep-1',
    synced: true,
    syncAttempts: 0,
    ...overrides,
  }
}

describe('summarizePins', () => {
  it('returns zeroed metrics for an empty collection', () => {
    expect(summarizePins([])).toEqual({
      totalPins: 0,
      leadsGenerated: 0,
      conversionRate: 0,
      activeReps: 0,
      outcomeDistribution: [],
      repActivity: [],
    })
  })

  it('aggregates outcomes, lead conversion, and rep activity', () => {
    const report = summarizePins([
      pin({ id: '1', outcome: PinOutcome.Lead, createdBy: 'rep-1' }),
      pin({ id: '2', outcome: PinOutcome.Knocked, createdBy: 'rep-1' }),
      pin({ id: '3', outcome: PinOutcome.Lead, createdBy: 'rep-2' }),
    ])

    expect(report.totalPins).toBe(3)
    expect(report.leadsGenerated).toBe(2)
    expect(report.conversionRate).toBe(66.7)
    expect(report.activeReps).toBe(2)
    expect(report.outcomeDistribution).toEqual([
      { outcome: PinOutcome.Knocked, count: 1 },
      { outcome: PinOutcome.Lead, count: 2 },
    ])
    expect(report.repActivity).toEqual([
      { repId: 'rep-1', count: 2 },
      { repId: 'rep-2', count: 1 },
    ])
  })

  it('filters by office and inclusive ISO date range', () => {
    const pins = [
      pin({ id: '1', officeId: 'perth', createdAt: '2026-09-01T01:00:00.000Z' }),
      pin({ id: '2', officeId: 'brisbane', createdAt: '2026-09-05T01:00:00.000Z' }),
      pin({ id: '3', officeId: 'perth', createdAt: '2026-09-10T01:00:00.000Z' }),
    ]

    expect(filterPinsForReport(pins, { officeId: 'perth', dateFrom: '2026-09-01', dateTo: '2026-09-10' }))
      .toHaveLength(2)
  })

  it('compares a selected period with the immediately preceding period', () => {
    const pins = [
      pin({ id: 'current', outcome: PinOutcome.Lead, createdAt: '2026-09-10T01:00:00.000Z' }),
      pin({ id: 'previous', outcome: PinOutcome.Knocked, createdAt: '2026-09-09T01:00:00.000Z' }),
    ]

    const comparison = compareReportPeriods(pins, { dateFrom: '2026-09-10', dateTo: '2026-09-10' })

    expect(comparison.current.totalPins).toBe(1)
    expect(comparison.previous.totalPins).toBe(1)
    expect(comparison.changes.totalPins).toBe(0)
    expect(comparison.changes.leadsGenerated).toBe(100)
  })
})

describe('exportReportToCsv', () => {
  it('exports a stable summary table', () => {
    const csv = exportReportToCsv(summarizePins([
      pin({ outcome: PinOutcome.Lead }),
    ]))

    expect(csv).toBe([
      'metric,value',
      'totalPins,1',
      'leadsGenerated,1',
      'conversionRate,100',
      'activeReps,1',
      '',
      'outcome,count',
      'Lead,1',
      '',
      'repId,count',
      'rep-1,1',
    ].join('\n'))
  })
})
