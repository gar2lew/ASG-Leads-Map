import type { LeadOffice, LeadRecord } from './leadRegister'

const officeTimezones: Record<LeadOffice, string> = {
  perth: 'Australia/Perth',
  brisbane: 'Australia/Brisbane',
}

function localDate(value: Date): string {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
}

function dateInOffice(value: Date, office?: LeadOffice): string {
  if (!office) return localDate(value)
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: officeTimezones[office], year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function activityDate(occurredAt: string, office?: LeadOffice): string | undefined {
  // Existing date-time-local values have no offset and already represent office wall time.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(occurredAt)) return /^\d{4}-\d{2}-\d{2}/.exec(occurredAt)?.[0]
  const date = new Date(occurredAt)
  return Number.isNaN(date.getTime()) ? undefined : dateInOffice(date, office)
}

export function countCallsToday(records: LeadRecord[], now: Date = new Date()): number {
  return records.reduce((total, record) => {
    const today = dateInOffice(now, record.office)
    return total + record.activities.filter((activity) => activity.kind === 'call' && activityDate(activity.occurredAt, record.office) === today).length
  }, 0)
}

export function countCallbacksDue(records: LeadRecord[], now: Date = new Date()): number {
  return records.filter((record) => record.qualification === 'callback' && record.followUpDate && record.followUpDate <= dateInOffice(now, record.office)).length
}

function queuePriority(record: LeadRecord, now: Date): [number, string] {
  if (record.qualification === 'archived' || record.qualification === 'not_interested') return [5, '']
  const today = dateInOffice(now, record.office)
  if (record.qualification === 'callback' && record.followUpDate) {
    if (record.followUpDate < today) return [0, record.followUpDate]
    if (record.followUpDate === today) return [1, record.followUpDate]
    return [3, record.followUpDate]
  }
  if (record.qualification === 'new' && !record.activities.some((activity) => activity.kind === 'call')) return [2, '']
  return [4, '']
}

export function orderCallerQueue(records: LeadRecord[], now: Date = new Date()): LeadRecord[] {
  return records.map((record, index) => ({ record, index, priority: queuePriority(record, now) }))
    .sort((a, b) => a.priority[0] - b.priority[0] || a.priority[1].localeCompare(b.priority[1]) || a.index - b.index)
    .map(({ record }) => record)
}

export function phoneHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 3) return null
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`
}
