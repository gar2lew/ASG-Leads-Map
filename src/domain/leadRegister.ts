export type LeadOffice = 'perth' | 'brisbane'
export type LeadQualification = 'new' | 'qualified' | 'callback' | 'not_interested' | 'archived'
export type LeadActivityKind = 'call' | 'door_knock'

export interface LeadActivity {
  id: string
  leadId: string
  kind: LeadActivityKind
  occurredAt: string
  repName: string
  outcome: string
  notes: string
  followUpDate?: string
}

export interface LeadRecord {
  id: string
  date: string
  leadName: string
  address: string
  phone: string
  notes: string
  updateLead: boolean
  renterOwner: string
  superannuation: string
  repName: string
  leadStatus: string
  callTimestamp: string
  callResult: string
  leadId: string
  office?: LeadOffice
  qualification: LeadQualification
  followUpDate?: string
  lastActivityAt?: string
  timelySynced: boolean
  timelySyncedAt?: string
  timelySyncedBy?: string
  activities: LeadActivity[]
}

type LegacyLeadInput = Partial<LeadRecord> & { id: string }

function nowDate() {
  return new Date().toISOString().slice(0, 10)
}

function nowDateTime() {
  return new Date().toISOString().slice(0, 16)
}

export function migrateLeadRecord(input: LegacyLeadInput): LeadRecord {
  const leadStatus = input.leadStatus || 'New'
  const qualification = input.qualification || (leadStatus === 'Qualified' ? 'qualified' : leadStatus === 'Not Interested' ? 'not_interested' : 'new')
  return {
    id: input.id,
    date: input.date || nowDate(),
    leadName: input.leadName || '',
    address: input.address || '',
    phone: input.phone || '',
    notes: input.notes || '',
    updateLead: input.updateLead ?? false,
    renterOwner: input.renterOwner || 'Owner',
    superannuation: input.superannuation || '$75-150k',
    repName: input.repName || '',
    leadStatus,
    callTimestamp: input.callTimestamp || nowDateTime(),
    callResult: input.callResult || '',
    leadId: input.leadId || input.id,
    office: input.office,
    qualification,
    followUpDate: input.followUpDate,
    lastActivityAt: input.lastActivityAt,
    timelySynced: input.timelySynced ?? false,
    timelySyncedAt: input.timelySyncedAt,
    timelySyncedBy: input.timelySyncedBy,
    activities: [...(input.activities || [])],
  }
}

export function appendActivity(record: LeadRecord, activity: LeadActivity): LeadRecord {
  return {
    ...record,
    activities: [...record.activities, activity],
    lastActivityAt: activity.occurredAt,
    callTimestamp: activity.kind === 'call' ? activity.occurredAt.slice(0, 16) : record.callTimestamp,
    callResult: activity.kind === 'call' ? activity.outcome : record.callResult,
    notes: activity.notes || record.notes,
    followUpDate: activity.followUpDate || record.followUpDate,
  }
}

interface LeadFilters {
  query?: string
  status?: string
  rep?: string
  office?: string
  timely?: 'all' | 'sent' | 'pending'
  callbackDue?: boolean
}

export function filterLeadRecords(records: LeadRecord[], filters: LeadFilters, today: string): LeadRecord[] {
  const query = filters.query?.trim().toLowerCase() || ''
  return records.filter((record) => {
    const searchable = [record.leadName, record.address, record.phone, record.notes, record.repName, record.leadStatus, record.callResult].join(' ').toLowerCase()
    if (query && !searchable.includes(query)) return false
    if (filters.status && filters.status !== 'all' && record.leadStatus !== filters.status) return false
    if (filters.rep && filters.rep !== 'all' && record.repName !== filters.rep) return false
    if (filters.office && filters.office !== 'all' && record.office !== filters.office) return false
    if (filters.timely === 'sent' && !record.timelySynced) return false
    if (filters.timely === 'pending' && record.timelySynced) return false
    if (filters.callbackDue && (!record.followUpDate || record.followUpDate > today || record.qualification !== 'callback')) return false
    return true
  })
}
