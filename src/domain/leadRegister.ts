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
  followUpDate?: string | undefined
}

export type LeadSourceField = 'date' | 'leadName' | 'address' | 'phone' | 'notes' |
  'updateLead' | 'renterOwner' | 'superannuation' | 'repName' | 'leadStatus' |
  'callTimestamp' | 'callResult'

export type LeadSourceSnapshot = Partial<Pick<LeadRecord, LeadSourceField>>

export interface LeadSourceConflict {
  sourceValue: string | boolean
  operationalValue: string | boolean
  detectedAt: string
}

export interface LeadSourceMetadata {
  spreadsheetId: string
  tabName: string
  sourceRow: number
  leadId?: string | undefined
  lastSeenAt: string
  snapshot: LeadSourceSnapshot
  conflicts: Partial<Record<LeadSourceField, LeadSourceConflict>>
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
  office?: LeadOffice | undefined
  qualification: LeadQualification
  followUpDate?: string | undefined
  lastActivityAt?: string | undefined
  timelySynced: boolean
  timelySyncedAt?: string | undefined
  timelySyncedBy?: string | undefined
  activities: LeadActivity[]
  source?: LeadSourceMetadata | undefined
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
    source: input.source ? {
      ...input.source,
      snapshot: { ...input.source.snapshot },
      conflicts: { ...input.source.conflicts },
    } : undefined,
  }
}

function normaliseIdentityPart(value: string): string {
  return value.toLocaleLowerCase('en-AU').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function leadSourceIdentityKey(
  office: LeadOffice,
  leadId: string | undefined,
  address: string,
  leadName: string,
): string | undefined {
  const sourceId = leadId?.trim()
  if (sourceId) return JSON.stringify([office, 'leadId', sourceId.toLocaleLowerCase('en-AU')])
  const addressKey = normaliseIdentityPart(address)
  const nameKey = normaliseIdentityPart(leadName)
  return addressKey && nameKey ? JSON.stringify([office, 'addressName', addressKey, nameKey]) : undefined
}

const SOURCE_FIELDS: LeadSourceField[] = [
  'date', 'leadName', 'address', 'phone', 'notes', 'updateLead', 'renterOwner',
  'superannuation', 'repName', 'leadStatus', 'callTimestamp', 'callResult',
]

export function mergeLeadSource(record: LeadRecord, incoming: LeadSourceMetadata): LeadRecord {
  const previous = record.source?.snapshot
  const next: LeadRecord = { ...record }
  const conflicts = { ...record.source?.conflicts }
  for (const field of SOURCE_FIELDS) {
    const sourceValue = incoming.snapshot[field]
    if (sourceValue === undefined || sourceValue === '') continue
    const operationalValue = record[field]
    const previousValue = previous?.[field]
    if (operationalValue === sourceValue || operationalValue === previousValue || (previousValue === undefined && operationalValue === '')) {
      // The field was not edited in the app, or was empty, so the sheet can refresh it.
      Object.assign(next, { [field]: sourceValue })
      delete conflicts[field]
    } else {
      conflicts[field] = {
        sourceValue,
        operationalValue,
        detectedAt: conflicts[field]?.sourceValue === sourceValue
          ? conflicts[field].detectedAt : incoming.lastSeenAt,
      }
    }
  }
  next.source = {
    ...incoming,
    snapshot: { ...previous, ...incoming.snapshot },
    conflicts,
  }
  return next
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

export interface LeadFilters {
  query?: string
  status?: string
  rep?: string
  office?: LeadOffice | 'all' | undefined
  timely?: 'all' | 'sent' | 'pending' | undefined
  callbackDue?: boolean
}

export function filterLeadRecords(records: LeadRecord[], filters: LeadFilters, today: string): LeadRecord[] {
  const query = filters.query?.trim().toLowerCase() || ''
  return records.filter((record) => {
    const searchable = [record.leadName, record.address, record.phone, record.notes, record.repName, record.leadStatus, record.callResult].join(' ').toLowerCase()
    if (query && !searchable.includes(query)) return false
    if (filters.status && filters.status !== 'all' && record.leadStatus !== filters.status && record.qualification !== filters.status.toLowerCase().replace(' ', '_')) return false
    if (filters.rep && filters.rep !== 'all' && record.repName !== filters.rep) return false
    if (filters.office && filters.office !== 'all' && record.office !== filters.office) return false
    if (filters.timely === 'sent' && !record.timelySynced) return false
    if (filters.timely === 'pending' && record.timelySynced) return false
    if (filters.callbackDue && (!record.followUpDate || record.followUpDate > today || record.qualification !== 'callback')) return false
    return true
  })
}
