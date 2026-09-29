import { describe, expect, it } from 'vitest'
import { isAuthorizedLeadCron, isAuthorizedLeadOffice, isAuthorizedLeadSync } from './access.js'

describe('lead sync access', () => {
  it('allows active users only in their assigned office, except super-admins', () => {
    expect(isAuthorizedLeadOffice({ role: 'rep', officeId: 'perth', active: true }, 'perth')).toBe(true)
    expect(isAuthorizedLeadOffice({ role: 'manager', officeId: 'perth', active: true }, 'brisbane')).toBe(false)
    expect(isAuthorizedLeadOffice({ role: 'super_admin', active: true }, 'brisbane')).toBe(true)
    expect(isAuthorizedLeadOffice({ role: 'rep', officeId: 'perth', active: false }, 'perth')).toBe(false)
    expect(isAuthorizedLeadOffice({ role: 'viewer', officeId: 'perth', active: true }, 'perth')).toBe(false)
  })

  it('requires a configured cron secret and an exact bearer match', () => {
    expect(isAuthorizedLeadCron('Bearer correct', 'correct')).toBe(true)
    expect(isAuthorizedLeadCron('Bearer incorrect', 'correct')).toBe(false)
    expect(isAuthorizedLeadCron('Bearer correct', undefined)).toBe(false)
  })

  it('limits manual sync to active managers and super-admins in the requested office', () => {
    expect(isAuthorizedLeadSync({ role: 'manager', officeId: 'perth', active: true }, 'perth')).toBe(true)
    expect(isAuthorizedLeadSync({ role: 'rep', officeId: 'perth', active: true }, 'perth')).toBe(false)
    expect(isAuthorizedLeadSync({ role: 'super_admin', active: true }, 'brisbane')).toBe(true)
    expect(isAuthorizedLeadSync({ role: 'manager', officeId: 'perth', active: false }, 'perth')).toBe(false)
  })
})
