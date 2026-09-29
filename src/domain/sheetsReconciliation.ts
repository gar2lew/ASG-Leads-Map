import { leadSourceIdentityKey, mergeLeadSource, migrateLeadRecord, type LeadOffice, type LeadRecord, type LeadSourceField, type LeadSourceMetadata, type LeadSourceSnapshot } from './leadRegister.js'
import { validateLeadInput } from './leadValidation.js'

export interface SheetLeadSourceInput {
  office: LeadOffice
  spreadsheetId: string
  tabName: string
  sourceRow: number
  leadId?: string | undefined
  lastSeenAt: string
  fields: Partial<Record<LeadSourceField, unknown>>
}

function projectSheetLeadSource(input: SheetLeadSourceInput): { identityKey: string | undefined; source: LeadSourceMetadata } {
  const snapshot: LeadSourceSnapshot = {}
  const validStatuses = new Map([
    ['new', 'New'], ['lead', 'Lead'], ['qualified', 'Qualified'], ['callback', 'Callback'],
    ['appointment set', 'Appointment Set'], ['not interested', 'Not Interested'], ['no answer', 'No Answer'],
    ['revisit', 'Revisit'], ['wrong number', 'Wrong Number'], ['booked', 'Booked'],
  ])
  for (const [field, raw] of Object.entries(input.fields) as Array<[LeadSourceField, unknown]>) {
    if (field === 'updateLead') {
      if (typeof raw === 'boolean') snapshot.updateLead = raw
      else if (typeof raw === 'string' && /^(true|false)$/i.test(raw.trim())) snapshot.updateLead = raw.trim().toLowerCase() === 'true'
      continue
    }
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (!value) continue
    if (field === 'leadStatus') {
      const status = validStatuses.get(value.toLocaleLowerCase('en-AU').replace(/\s+/g, ' '))
      if (status) snapshot.leadStatus = status
      continue
    }
    if (field === 'date' && !isValidSourceDate(value)) continue
    if (field === 'callTimestamp' && !isValidSourceTimestamp(value)) continue
    if (field === 'renterOwner' && !/^(owner|renter|tenant)$/i.test(value)) continue
    if (field === 'phone' && validateLeadInput({ address: 'source row', contactName: 'source contact', contactPhone: value }).contactPhone) continue
    Object.assign(snapshot, { [field]: value })
  }
  const leadId = input.leadId?.trim() || undefined
  return {
    identityKey: leadSourceIdentityKey(input.office, leadId, snapshot.address || '', snapshot.leadName || ''),
    source: { spreadsheetId: input.spreadsheetId, tabName: input.tabName, sourceRow: input.sourceRow, leadId, lastSeenAt: input.lastSeenAt, snapshot, conflicts: {} },
  }
}

function isValidSourceDate(value: string): boolean {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const au = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  const year = Number(iso?.[1] || au?.[3])
  const month = Number(iso?.[2] || au?.[2])
  const day = Number(iso?.[3] || au?.[1])
  if (!iso && !au) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isValidSourceTimestamp(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/i.exec(value)
  if (!match?.[1] || !isValidSourceDate(match[1])) return false
  const offsetHours = match[5] === undefined ? 0 : Number(match[5])
  const offsetMinutes = match[6] === undefined ? 0 : Number(match[6])
  return Number(match[2]) < 24 && Number(match[3]) < 60 && (match[4] === undefined || Number(match[4]) < 60) &&
    offsetHours <= 14 && offsetMinutes < 60 && (offsetHours < 14 || offsetMinutes === 0)
}

export type SheetLeadRow = SheetLeadSourceInput

export interface SheetTabInput extends Omit<SheetLeadSourceInput, 'sourceRow' | 'leadId' | 'fields'> {
  values: string[][]
  firstRowNumber?: number
}

export interface ReconciliationConflict {
  leadId: string
  recordId: string
  field: string
  sourceValue: string | boolean
  operationalValue: string | boolean
}

export interface ReconciliationPreview {
  inserts: LeadRecord[]
  updates: LeadRecord[]
  unchanged: LeadRecord[]
  invalidRows: Array<{ tabName: string; sourceRow: number; reason: string }>
  duplicates: Array<{ identity: string; tabName: string; sourceRow: number }>
  deletions: []
  conflicts: ReconciliationConflict[]
}

function officeIsValid(office: unknown): office is LeadOffice {
  return office === 'perth' || office === 'brisbane'
}

function normaliseHeader(value: string): string {
  return value.toLocaleLowerCase('en-AU').replace(/[^a-z0-9]+/g, '')
}

const HEADER_FIELDS: Record<string, keyof SheetLeadSourceInput['fields'] | 'leadId'> = {
  date: 'date', leadname: 'leadName', name: 'leadName', address: 'address', propertyaddress: 'address',
  contactnumber: 'phone', contactphone: 'phone', phone: 'phone', notes: 'notes', fieldnotes: 'notes',
  updatelead: 'updateLead', renterowner: 'renterOwner', occupancy: 'renterOwner', superannuation: 'superannuation',
  repname: 'repName', rep: 'repName', leadstatus: 'leadStatus', status: 'leadStatus',
  calltimestamp: 'callTimestamp', callresult: 'callResult', leadid: 'leadId',
}

const TAB_STATUS: Record<string, string> = {
  leads: 'Lead', 'no answer': 'No Answer', booked: 'Booked', revisit: 'Revisit',
  'not interested': 'Not Interested', 'wrong number': 'Wrong Number',
}

export function parseSheetTabRows(input: SheetTabInput): { rows: SheetLeadRow[]; error?: string } {
  const headerRow = input.values[0]
  if (!headerRow?.length) return { rows: [], error: 'The tab has no header row.' }
  const headers = headerRow.map((header) => HEADER_FIELDS[normaliseHeader(header)] || undefined)
  const addressColumn = headers.indexOf('address')
  const nameColumn = headers.indexOf('leadName')
  const leadIdColumn = headers.indexOf('leadId')
  if (addressColumn < 0 || (nameColumn < 0 && leadIdColumn < 0)) {
    return { rows: [], error: 'The tab is missing required Address and Lead Name or LeadID headers.' }
  }
  const rows: SheetLeadRow[] = []
  for (const [index, cells] of input.values.slice(1).entries()) {
    if (!cells.some((cell) => cell.trim())) continue
    const fields: SheetLeadRow['fields'] = {}
    let leadId: string | undefined
    headers.forEach((field, column) => {
      if (!field) return
      const value = cells[column] || ''
      if (field === 'leadId') leadId = value.trim() || undefined
      else Object.assign(fields, { [field]: value })
    })
    if (!String(fields.leadStatus || '').trim()) fields.leadStatus = TAB_STATUS[input.tabName.toLocaleLowerCase('en-AU')] || 'Lead'
    rows.push({
      office: input.office, spreadsheetId: input.spreadsheetId, tabName: input.tabName,
      sourceRow: (input.firstRowNumber || 1) + index + 1, lastSeenAt: input.lastSeenAt,
      ...(leadId ? { leadId } : {}), fields,
    })
  }
  return { rows }
}

function qualificationFromStatus(status: string | undefined): LeadRecord['qualification'] {
  const value = status?.trim().toLocaleLowerCase('en-AU')
  if (value === 'qualified' || value === 'appointment set' || value === 'booked') return 'qualified'
  if (value === 'callback' || value === 'revisit' || value === 'no answer') return 'callback'
  if (value === 'not interested' || value === 'wrong number') return 'not_interested'
  if (value === 'archived') return 'archived'
  return 'new'
}

function newRecord(source: SheetLeadSourceInput, identity: string): LeadRecord {
  const projected = projectSheetLeadSource(source)
  const snapshot = projected.source.snapshot
  const key = source.leadId?.trim() || `${String(snapshot.address || '').toLocaleLowerCase('en-AU')}|${String(snapshot.leadName || '').toLocaleLowerCase('en-AU')}`
  const stablePart = encodeURIComponent(key).slice(0, 900)
  return migrateLeadRecord({
    id: `sheet-${source.office}-${stablePart || encodeURIComponent(identity).slice(0, 900)}`,
    office: source.office,
    leadId: source.leadId?.trim() || `sheet:${identity}`,
    date: typeof snapshot.date === 'string' ? snapshot.date : source.lastSeenAt.slice(0, 10),
    leadName: snapshot.leadName || '',
    address: snapshot.address || '',
    phone: snapshot.phone || '',
    notes: snapshot.notes || '',
    updateLead: snapshot.updateLead ?? false,
    renterOwner: snapshot.renterOwner || 'Owner',
    superannuation: snapshot.superannuation || '$75-150k',
    repName: snapshot.repName || '',
    leadStatus: snapshot.leadStatus || 'New',
    callTimestamp: snapshot.callTimestamp || `${source.lastSeenAt.slice(0, 10)}T00:00`,
    callResult: snapshot.callResult || '',
    qualification: qualificationFromStatus(snapshot.leadStatus),
    timelySynced: false,
    activities: [],
    source: projected.source,
  })
}

function sourceChanged(previous: LeadRecord, next: LeadRecord): boolean {
  const previousSource = previous.source
  const nextSource = next.source
  if (!previousSource || !nextSource) return true
  const previousMeta = { ...previousSource, lastSeenAt: '' }
  const nextMeta = { ...nextSource, lastSeenAt: '' }
  return JSON.stringify(previousMeta) !== JSON.stringify(nextMeta)
}

function leadSourceValuesChanged(previous: LeadRecord, next: LeadRecord): boolean {
  const fields = ['date', 'leadName', 'address', 'phone', 'notes', 'updateLead', 'renterOwner', 'superannuation', 'repName', 'leadStatus', 'callTimestamp', 'callResult'] as const
  return fields.some((field) => previous[field] !== next[field])
}

function sourceSnapshotsEqual(left: LeadSourceSnapshot, right: LeadSourceSnapshot): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)] as Array<keyof LeadSourceSnapshot>)
  return [...keys].every((key) => left[key] === right[key])
}

export function reconcileSheetRows(input: {
  rows: SheetLeadRow[]
  currentRecords: LeadRecord[]
}): ReconciliationPreview {
  const preview: ReconciliationPreview = {
    inserts: [], updates: [], unchanged: [], invalidRows: [], duplicates: [], deletions: [], conflicts: [],
  }
  const currentByIdentity = new Map<string, LeadRecord[]>()
  const currentByAddressName = new Map<string, LeadRecord[]>()
  const currentById = new Map(input.currentRecords.map((record) => [record.id, record]))
  for (const record of input.currentRecords) {
    if (!officeIsValid(record.office)) continue
    const identity = leadSourceIdentityKey(record.office, record.source ? record.source.leadId : record.leadId, record.address, record.leadName)
    if (identity) currentByIdentity.set(identity, [...(currentByIdentity.get(identity) || []), record])
    const addressNameIdentity = leadSourceIdentityKey(record.office, undefined, record.address, record.leadName)
    if (addressNameIdentity) currentByAddressName.set(addressNameIdentity, [...(currentByAddressName.get(addressNameIdentity) || []), record])
  }
  const seen = new Set<string>()
  const seenByIdentity = new Map<string, SheetLeadRow>()
  const seenByAddressName = new Map<string, SheetLeadRow>()

  for (const row of input.rows) {
    if (!officeIsValid(row.office)) {
      preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'Office is missing or invalid.' })
      continue
    }
    const projected = projectSheetLeadSource(row)
    const snapshot = projected.source.snapshot
    if (!snapshot.address?.trim()) {
      preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'Property address is missing or invalid.' })
      continue
    }
    const identity = projected.identityKey
    if (!identity) {
      preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'A LeadID or lead name and address are required.' })
      continue
    }
    const addressNameIdentity = leadSourceIdentityKey(row.office, undefined, snapshot.address || '', snapshot.leadName || '')
    const previousAddressRow = addressNameIdentity ? seenByAddressName.get(addressNameIdentity) : undefined
    if (seen.has(identity)) {
      preview.duplicates.push({ identity, tabName: row.tabName, sourceRow: row.sourceRow })
      const previousIdentityRow = seenByIdentity.get(identity)
      const previousSnapshot = previousIdentityRow ? projectSheetLeadSource(previousIdentityRow).source.snapshot : undefined
      if (previousSnapshot && !sourceSnapshotsEqual(previousSnapshot, snapshot)) {
        preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'Duplicate source LeadIDs contain conflicting field values across tabs; resolve them before syncing.' })
      }
      continue
    }
    if (previousAddressRow && (!row.leadId?.trim() || !previousAddressRow.leadId?.trim() || row.leadId.trim() !== previousAddressRow.leadId.trim())) {
      preview.duplicates.push({ identity, tabName: row.tabName, sourceRow: row.sourceRow })
      preview.invalidRows.push({
        tabName: row.tabName, sourceRow: row.sourceRow,
        reason: 'The same office/name/address appears more than once with missing or conflicting LeadIDs; resolve the source rows before syncing.',
      })
      continue
    }
    seen.add(identity)
    seenByIdentity.set(identity, row)
    if (addressNameIdentity) seenByAddressName.set(addressNameIdentity, row)

    const identityMatches = currentByIdentity.get(identity) || []
    const addressMatches = addressNameIdentity ? currentByAddressName.get(addressNameIdentity) || [] : []
    if (row.leadId?.trim() && addressMatches.some((record) => {
      const existingSourceId = record.source?.leadId || (record.leadId !== record.id && !record.leadId.startsWith('sheet:') ? record.leadId : undefined)
      return existingSourceId && existingSourceId.toLocaleLowerCase('en-AU') !== row.leadId?.trim().toLocaleLowerCase('en-AU')
    })) {
      preview.duplicates.push({ identity, tabName: row.tabName, sourceRow: row.sourceRow })
      preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'This lead matches a Firestore record with a different source LeadID; resolve the identity before syncing.' })
      continue
    }
    // A source LeadID may be added after a baseline import. Reuse an existing
    // no-ID record only when its office/address/name match is unique. Never
    // merge two records whose authoritative source IDs disagree.
    const eligibleAddressMatches = row.leadId?.trim()
      ? addressMatches.filter((record) => !record.source?.leadId && (record.leadId === record.id || record.leadId.startsWith('sheet:')))
      : addressMatches
    const existing = identityMatches.length
      ? identityMatches
      : eligibleAddressMatches
    if (existing.length > 1) {
      preview.duplicates.push({ identity, tabName: row.tabName, sourceRow: row.sourceRow })
      preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'More than one Firestore lead matches this office/source identity; resolve the duplicate first.' })
      continue
    }
    const current = existing[0]
    if (!current) {
      const proposed = newRecord(row, identity)
      const idCollision = currentById.get(proposed.id)
      if (idCollision) {
        preview.invalidRows.push({ tabName: row.tabName, sourceRow: row.sourceRow, reason: 'A Firestore document ID collision prevents a safe insert.' })
        continue
      }
      preview.inserts.push(proposed)
      continue
    }

    const merged = mergeLeadSource(current, projected.source)
    const conflictFields = Object.keys(merged.source?.conflicts || {}) as Array<keyof NonNullable<LeadRecord['source']>['conflicts']>
    for (const field of conflictFields) {
      const conflict = merged.source?.conflicts[field]
      if (!conflict) continue
      preview.conflicts.push({ leadId: current.leadId, recordId: current.id, field: String(field), sourceValue: conflict.sourceValue, operationalValue: conflict.operationalValue })
    }
    if (leadSourceValuesChanged(current, merged) || sourceChanged(current, merged)) preview.updates.push(merged)
    else preview.unchanged.push(current)
  }
  return preview
}
