import type { LeadOffice, LeadSourceField } from '../domain/leadRegister.js'
import type { ReconciliationConflict } from '../domain/sheetsReconciliation.js'
import { getAuthService } from '../auth'

export interface SheetSyncCounts {
  inserted: number
  updated: number
  unchanged: number
  invalid: number
  duplicates: number
  conflicts: number
}

export interface SheetSyncIssue {
  tabName: string
  sourceRow: number
  reason: string
}

export interface SheetSyncPreview {
  previewId: string
  office: LeadOffice
  source: string
  counts: SheetSyncCounts
  conflicts: ReconciliationConflict[]
  invalidRows: SheetSyncIssue[]
  duplicates: Array<{ identity: string; tabName: string; sourceRow: number }>
}

export interface SheetSyncResult {
  summary: SheetSyncCounts & { office: LeadOffice; source: string; syncedAt: string }
  conflicts: ReconciliationConflict[]
  duplicates?: SheetSyncPreview['duplicates']
}

export interface SheetSyncStatus {
  office: LeadOffice
  source: string
  url: string
  baselineConfirmed: boolean
  lastSyncAt?: string
  lastSyncStatus?: 'success' | 'failed'
  lastSyncError?: string
  lastSyncCounts?: SheetSyncCounts
  conflicts: ReconciliationConflict[]
}

export class SheetSyncError extends Error {
  invalidRows?: SheetSyncIssue[]
  duplicates?: SheetSyncPreview['duplicates']
  invalidTabs?: Array<{ tabName: string; reason: string }>
}

async function requestSync<T>(body: Record<string, unknown>): Promise<T> {
  const token = await getAuthService().getAccessToken()
  if (!token) throw new Error('Your sign-in has expired. Sign in again before syncing the live register.')
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const error = new SheetSyncError(typeof payload['error'] === 'string' ? payload['error'] : 'The live register sync failed.')
    if (Array.isArray(payload['invalidRows'])) error.invalidRows = payload['invalidRows'] as SheetSyncIssue[]
    if (Array.isArray(payload['duplicates'])) error.duplicates = payload['duplicates'] as SheetSyncPreview['duplicates']
    if (Array.isArray(payload['invalidTabs'])) error.invalidTabs = payload['invalidTabs'] as NonNullable<SheetSyncError['invalidTabs']>
    throw error
  }
  return payload as T
}

export function getSheetSyncStatus(office: LeadOffice): Promise<SheetSyncStatus> {
  return requestSync({ action: 'status', office })
}

export function previewSheetBaseline(office: LeadOffice): Promise<SheetSyncPreview> {
  return requestSync({ action: 'previewBaseline', office })
}

export function confirmSheetBaseline(office: LeadOffice, previewId: string): Promise<SheetSyncResult> {
  return requestSync({ action: 'confirmBaseline', office, previewId })
}

export function syncSheetNow(office: LeadOffice): Promise<SheetSyncResult> {
  return requestSync({ action: 'syncNow', office })
}

export function resolveSheetConflict(input: {
  office: LeadOffice
  recordId: string
  field: LeadSourceField
  resolution: 'firestore' | 'sheets'
}): Promise<{ resolved: true; recordId: string; field: LeadSourceField; resolution: 'firestore' | 'sheets' }> {
  return requestSync({ action: 'resolveConflict', ...input })
}
