import { arrayToCsv, csvToArray } from './csv'
import { appendActivity, migrateLeadRecord, type LeadActivity, type LeadRecord } from './leadRegister'

const STORAGE_KEY = 'asg-call-log'
const HEADERS = ['Date', 'Lead Name', 'Address', 'Contact Number', 'Notes', 'Update Lead', 'Renter/Owner', 'Superannuation', 'Rep Name', 'Lead Status', 'Call Timestamp', 'Call Result', 'LeadID', 'Office', 'Qualification', 'Follow-up Date', 'Timely CRM', 'Timely CRM At', 'Timely CRM By']

type ImportResult = { records: LeadRecord[]; skipped: number }

function id() {
  return crypto.randomUUID()
}

function read(storage: Storage): LeadRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map((row) => migrateLeadRecord({ ...row, id: row.id || id() })) : []
  } catch {
    return []
  }
}

function write(storage: Storage, records: LeadRecord[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function at(headers: string[], name: string) {
  return headers.findIndex((header) => header.trim().toLowerCase() === name.toLowerCase())
}

export function createLeadRegisterRepository(storage: Storage = localStorage) {
  return {
    async loadLeadRecords() {
      return read(storage)
    },
    async saveLeadRecords(records: Array<Partial<LeadRecord> & { id: string }>) {
      const migrated = records.map(migrateLeadRecord)
      write(storage, migrated)
      return migrated
    },
    async addLeadActivity(recordId: string, activity: LeadActivity) {
      const records = read(storage)
      const next = records.map((record) => record.id === recordId ? appendActivity(record, activity) : record)
      write(storage, next)
      return next
    },
    async setTimelyHandoff(recordId: string, sent: boolean, user: string, timestamp = new Date().toISOString()) {
      const records = read(storage)
      const next = records.map((record) => record.id === recordId ? {
        ...record,
        timelySynced: sent,
        timelySyncedAt: sent ? timestamp : undefined,
        timelySyncedBy: sent ? user : undefined,
      } : record)
      write(storage, next)
      return next
    },
    async importLeadCsv(text: string): Promise<ImportResult> {
      const rows = csvToArray(text)
      const headers = rows.shift()?.map((header) => header.trim()) || []
      const records: LeadRecord[] = []
      let skipped = 0
      for (const cells of rows) {
        const get = (name: string) => {
          const index = at(headers, name)
          return index >= 0 ? cells[index] || '' : ''
        }
        if (!get('Lead Name').trim() && !get('Address').trim()) {
          skipped++
          continue
        }
        records.push(migrateLeadRecord({
          id: id(), date: get('Date'), leadName: get('Lead Name'), address: get('Address'), phone: get('Contact Number'), notes: get('Notes'),
          updateLead: get('Update Lead').toLowerCase() === 'true', renterOwner: get('Renter/Owner'), superannuation: get('Superannuation'), repName: get('Rep Name'),
          leadStatus: get('Lead Status'), callTimestamp: get('Call Timestamp'), callResult: get('Call Result'), leadId: get('LeadID'), office: (get('Office') || undefined) as LeadRecord['office'],
          qualification: (get('Qualification') || undefined) as LeadRecord['qualification'], followUpDate: get('Follow-up Date') || undefined,
          timelySynced: get('Timely CRM').toLowerCase() === 'true', timelySyncedAt: get('Timely CRM At') || undefined, timelySyncedBy: get('Timely CRM By') || undefined,
        }))
      }
      const combined = [...records, ...read(storage)]
      write(storage, combined)
      return { records, skipped }
    },
    exportLeadCsv(records: LeadRecord[]) {
      return arrayToCsv([HEADERS, ...records.map((record) => [
        record.date, record.leadName, record.address, record.phone, record.notes, String(record.updateLead), record.renterOwner, record.superannuation, record.repName, record.leadStatus,
        record.callTimestamp, record.callResult, record.leadId, record.office || '', record.qualification, record.followUpDate || '', String(record.timelySynced), record.timelySyncedAt || '', record.timelySyncedBy || '',
      ])])
    },
  }
}
