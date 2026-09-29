import type { LeadOffice } from '../../src/domain/leadRegister.js'

export interface LeadSyncProfile {
  role?: unknown
  officeId?: unknown
  active?: unknown
}

export function isAuthorizedLeadOffice(profile: LeadSyncProfile, office: LeadOffice): boolean {
  if (profile.active === false) return false
  if (!['super_admin', 'manager', 'rep'].includes(String(profile.role))) return false
  return profile.role === 'super_admin' || profile.officeId === office
}

export function isAuthorizedLeadSync(profile: LeadSyncProfile, office: LeadOffice): boolean {
  if (profile.active === false || !['super_admin', 'manager'].includes(String(profile.role))) return false
  return profile.role === 'super_admin' || profile.officeId === office
}

export function isAuthorizedLeadCron(authorization: string | undefined, secret: string | undefined): boolean {
  return Boolean(secret && authorization === `Bearer ${secret}`)
}
