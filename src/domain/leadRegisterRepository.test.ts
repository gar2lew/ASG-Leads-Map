import { beforeEach, describe, expect, it } from 'vitest'
import { createLeadRegisterRepository } from './leadRegisterRepository'

describe('local lead register repository', () => {
  beforeEach(() => localStorage.clear())

  it('migrates legacy rows from the existing storage key', async () => {
    localStorage.setItem('asg-call-log', JSON.stringify([{ id: 'legacy-1', leadName: 'Ava', address: '1 Main St' }]))

    const repository = createLeadRegisterRepository()
    const rows = await repository.loadLeadRecords()

    expect(rows).toHaveLength(1)
    expect(rows[0]?.leadName).toBe('Ava')
    expect(rows[0]?.timelySynced).toBe(false)
  })

  it('round-trips quoted CSV fields and ignores incomplete identity rows', async () => {
    const repository = createLeadRegisterRepository()
    const imported = await repository.importLeadCsv('Date,Lead Name,Address,Notes\n2026-09-24,Ava,1 Main St,"Spoke, qualified"\n2026-09-24,,,Missing identity')

    expect(imported.records).toHaveLength(1)
    expect(imported.records[0]?.notes).toBe('Spoke, qualified')
    expect(imported.skipped).toBe(1)

    const csv = repository.exportLeadCsv(imported.records)
    expect(csv).toContain('Spoke, qualified')
  })

  it('records and clears Timely CRM handoff metadata', async () => {
    const repository = createLeadRegisterRepository()
    await repository.saveLeadRecords([{ id: 'lead-1', leadName: 'Ava', address: '1 Main St' }])

    const sent = await repository.setTimelyHandoff('lead-1', true, 'Jordan', '2026-09-24T10:00')
    expect(sent[0]).toMatchObject({ timelySynced: true, timelySyncedAt: '2026-09-24T10:00', timelySyncedBy: 'Jordan' })

    const cleared = await repository.setTimelyHandoff('lead-1', false, 'Jordan', '2026-09-24T11:00')
    expect(cleared[0]?.timelySynced).toBe(false)
    expect(cleared[0]?.timelySyncedAt).toBeUndefined()
    expect(cleared[0]?.timelySyncedBy).toBeUndefined()
  })
})
