import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, createSign, randomUUID } from 'node:crypto'
import { googleSheetSources } from '../../src/domain/googleSheetSources.js'
import { leadSourceIdentityKey, mergeLeadSource, migrateLeadRecord, type LeadOffice, type LeadRecord } from '../../src/domain/leadRegister.js'
import { parseSheetTabRows, reconcileSheetRows, type ReconciliationPreview, type SheetLeadRow } from '../../src/domain/sheetsReconciliation.js'
import { isAuthorizedLeadCron, isAuthorizedLeadOffice, isAuthorizedLeadSync } from './access.js'

const SHEET_SOURCE = Object.fromEntries(googleSheetSources.map((source) => [source.office, source])) as Record<LeadOffice, typeof googleSheetSources[number]>

function encodeBase64Url(value: string) { return Buffer.from(value).toString('base64url') }

async function getSheetsAccessToken() {
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const encodedKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64
  if (encodedKey) privateKey = Buffer.from(encodedKey, 'base64').toString('utf8')
  if (!email || !privateKey) throw new Error('Google Sheets server credentials are missing.')
  privateKey = privateKey.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${encodeBase64Url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new Error('Unable to authorize the Google Sheets service account.')
  const result = await response.json() as { access_token?: string }
  if (!result.access_token) throw new Error('Google did not return a Sheets access token.')
  return { accessToken: result.access_token, serviceAccountEmail: email }
}

async function authenticateOffice(req: VercelRequest, office: LeadOffice) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return { error: { status: 401, message: 'Sign in to access this office register.' } }

  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const decoded = await (await getAdminAuth()).verifyIdToken(authorization.slice(7).trim())
    const db = await getAdminDb()
    const profileSnapshot = await db.collection('users').doc(decoded.uid).get()
    const profile = profileSnapshot.data()
    if (!profileSnapshot.exists || !profile || !isAuthorizedLeadOffice(profile, office)) {
      return { error: { status: 403, message: 'Your account is not allowed to access this office register.' } }
    }
    return { uid: decoded.uid, profile, db }
  } catch {
    return { error: { status: 401, message: 'Your sign-in could not be verified. Sign in again and retry.' } }
  }
}

function isOffice(value: unknown): value is LeadOffice {
  return value === 'perth' || value === 'brisbane'
}

function parseOfficeRows(office: LeadOffice, valueRanges: Array<{ values?: string[][] }>, lastSeenAt = new Date().toISOString()) {
  const source = SHEET_SOURCE[office]
  const rows: SheetLeadRow[] = []
  const invalidTabs: Array<{ tabName: string; reason: string }> = []
  source.sheetNames.forEach((tabName, index) => {
    const parsed = parseSheetTabRows({
      office, spreadsheetId: source.spreadsheetId, tabName, lastSeenAt,
      values: valueRanges[index]?.values || [],
    })
    if (parsed.error) invalidTabs.push({ tabName, reason: parsed.error })
    rows.push(...parsed.rows)
  })
  return { rows, invalidTabs }
}

async function readOfficeSheetRows(office: LeadOffice) {
  const { accessToken, serviceAccountEmail } = await getSheetsAccessToken()
  const source = SHEET_SOURCE[office]
  const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' })
  source.sheetNames.forEach((tab) => params.append('ranges', `'${tab}'!A1:M10000`))
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 403 || response.status === 404) {
    throw Object.assign(new Error(`Share this office register with ${serviceAccountEmail} as a Viewer, then retry.`), { status: 424 })
  }
  if (!response.ok) throw Object.assign(new Error('Google Sheets could not return the lead register. Try again shortly.'), { status: 502 })
  const data = await response.json() as { valueRanges?: Array<{ values?: string[][] }> }
  return { valueRanges: data.valueRanges || [], ...parseOfficeRows(office, data.valueRanges || []) }
}

function toLeadRecord(id: string, data: Record<string, unknown>): LeadRecord {
  const office = data['officeId'] === 'perth' || data['officeId'] === 'brisbane' ? data['officeId'] : undefined
  return migrateLeadRecord({ ...data, id, office } as Partial<LeadRecord> & { id: string })
}

function withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

async function loadOfficeLeads(db: Awaited<ReturnType<typeof import('../_lib/admin.js')['getAdminDb']>>, office: LeadOffice) {
  const snapshot = await db.collection('leads').where('officeId', '==', office).get()
  return snapshot.docs.map((document) => toLeadRecord(document.id, document.data()))
}

function previewCounts(preview: ReconciliationPreview) {
  return {
    inserted: preview.inserts.length, updated: preview.updates.length, unchanged: preview.unchanged.length,
    invalid: preview.invalidRows.length, duplicates: preview.duplicates.length, conflicts: preview.conflicts.length,
  }
}

function hashRows(rows: SheetLeadRow[]): string {
  return createHash('sha256').update(JSON.stringify(rows.map(({ lastSeenAt: _lastSeenAt, ...row }) => row))).digest('hex')
}

async function writeReconciliation(db: Awaited<ReturnType<typeof import('../_lib/admin.js')['getAdminDb']>>, office: LeadOffice, preview: ReconciliationPreview) {
  const proposed = [...preview.inserts, ...preview.updates]
  for (let offset = 0; offset < proposed.length; offset += 20) {
    const chunk = proposed.slice(offset, offset + 20)
    await Promise.all(chunk.map(async (record) => {
    const reference = db.collection('leads').doc(record.id)
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      let next = record
      if (snapshot.exists) {
        const current = toLeadRecord(snapshot.id, snapshot.data() as Record<string, unknown>)
        if (current.office !== office) throw new Error('Lead ID belongs to a different office; reconciliation stopped.')
        const source = record.source
        if (!source) throw new Error('Source snapshot is missing; reconciliation stopped.')
        const incomingIdentity = leadSourceIdentityKey(office, source.leadId, String(source.snapshot.address || ''), String(source.snapshot.leadName || ''))
        const currentSourceLeadId = current.source?.leadId
        const currentHasAuthoritativeId = currentSourceLeadId || (current.leadId !== current.id && !current.leadId.startsWith('sheet:') ? current.leadId : undefined)
        const currentIdentity = leadSourceIdentityKey(office, currentSourceLeadId || current.leadId, String(current.source?.snapshot.address || current.address), String(current.source?.snapshot.leadName || current.leadName))
        const addressFallback = (!source.leadId || !currentHasAuthoritativeId)
          && leadSourceIdentityKey(office, undefined, String(current.source?.snapshot.address || current.address), String(current.source?.snapshot.leadName || current.leadName))
            === leadSourceIdentityKey(office, undefined, String(source.snapshot.address || ''), String(source.snapshot.leadName || ''))
        if (incomingIdentity !== currentIdentity && !addressFallback) throw new Error('Lead ID collision detected; reconciliation stopped.')
        next = mergeLeadSource(current, { ...source, conflicts: {} })
      }
      const { id: _id, office: _office, ...fields } = next
      const data = withoutUndefined({ ...fields, officeId: office, updatedAt: new Date().toISOString(), ...(!snapshot.exists ? { createdAt: new Date().toISOString() } : {}) })
      transaction.set(reference, data, { merge: true })
    })
    }))
  }
}

async function previewBaseline(db: Awaited<ReturnType<typeof import('../_lib/admin.js')['getAdminDb']>>, office: LeadOffice, uid: string, res: VercelResponse) {
  const state = await db.collection('leadSyncState').doc(office).get()
  if (state.data()?.['baselineConfirmed'] === true) return res.status(409).json({ error: 'This office already has a confirmed baseline. Use manual sync instead.' })
  const fetched = await readOfficeSheetRows(office)
  if (fetched.invalidTabs.length) return res.status(422).json({ error: 'One or more source tabs have invalid headers.', invalidTabs: fetched.invalidTabs })
  const current = await loadOfficeLeads(db, office)
  const preview = reconcileSheetRows({ rows: fetched.rows, currentRecords: current })
  const previewId = randomUUID()
  await db.collection('leadSyncPreviews').doc(previewId).set({
    office, uid, baseline: true, rowsHash: hashRows(fetched.rows), createdAt: new Date().toISOString(), expiresAt: Date.now() + 30 * 60 * 1000,
  })
  return res.status(200).json({ previewId, office, source: SHEET_SOURCE[office].label, counts: previewCounts(preview), conflicts: preview.conflicts, invalidRows: preview.invalidRows, duplicates: preview.duplicates })
}

async function runOfficeSync(db: Awaited<ReturnType<typeof import('../_lib/admin.js')['getAdminDb']>>, office: LeadOffice, baseline = false) {
  const fetched = await readOfficeSheetRows(office)
  if (fetched.invalidTabs.length) throw Object.assign(new Error('One or more source tabs have invalid headers.'), { status: 422, invalidTabs: fetched.invalidTabs })
  const current = await loadOfficeLeads(db, office)
  const preview = reconcileSheetRows({ rows: fetched.rows, currentRecords: current })
  if (preview.invalidRows.length) throw Object.assign(new Error('Some source rows need review; no changes were synced for this office.'), { status: 422, invalidRows: preview.invalidRows, duplicates: preview.duplicates })
  await writeReconciliation(db, office, preview)
  const summary = { office, source: SHEET_SOURCE[office].label, ...previewCounts(preview), syncedAt: new Date().toISOString() }
  await db.collection('leadSyncState').doc(office).set({
    ...(baseline ? { baselineConfirmed: true, baselineConfirmedAt: summary.syncedAt } : {}),
    lastSyncAt: summary.syncedAt, lastSyncStatus: 'success', lastSyncCounts: previewCounts(preview),
  }, { merge: true })
  return { summary, preview }
}

async function recordSyncFailure(db: Awaited<ReturnType<typeof import('../_lib/admin.js')['getAdminDb']>>, office: LeadOffice, error: unknown) {
  await db.collection('leadSyncState').doc(office).set({
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: 'failed',
    lastSyncError: error instanceof Error ? error.message : 'Lead sync failed.',
  }, { merge: true })
}

async function importOfficeSheet(req: VercelRequest, res: VercelResponse, office: LeadOffice) {
  try {
    const auth = await authenticateOffice(req, office)
    if ('error' in auth && auth.error) return res.status(auth.error.status).json({ error: auth.error.message })
    const { accessToken, serviceAccountEmail } = await getSheetsAccessToken()
    const source = SHEET_SOURCE[office]
    const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' })
    source.sheetNames.forEach((tab) => params.append('ranges', `'${tab}'!A1:M10000`))
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values:batchGet?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.status === 403 || response.status === 404) return res.status(424).json({ error: `Share this office register with ${serviceAccountEmail} as a Viewer, then retry.` })
    if (!response.ok) return res.status(502).json({ error: 'Google Sheets could not return the lead register. Try again shortly.' })
    const data = await response.json() as { valueRanges?: Array<{ values?: string[][] }> }
    const values: string[][] = []
    for (const range of data.valueRanges ?? []) {
      const rows = range.values ?? []
      if (!rows.length) continue
      if (!values.length) values.push(rows[0] ?? [])
      values.push(...rows.slice(1))
    }
    return res.status(200).json({ office, values })
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      const failure = error as { status: number; message?: string }
      return res.status(failure.status).json({ error: failure.message || 'Unable to access this office register.' })
    }
    console.error('Google Sheets register import failed:', error instanceof Error ? error.message : 'unknown error')
    const message = error instanceof Error && error.message.includes('credentials')
      ? 'Google Sheets server credentials are missing. Check the Firebase Admin service account settings in Vercel.'
      : 'Unable to connect to Google Sheets. Check the server credentials and try again.'
    return res.status(500).json({ error: message })
  }
}

async function manualSync(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { action?: unknown; office?: unknown; previewId?: unknown } | undefined
  if (!body || !isOffice(body.office)) return res.status(400).json({ error: 'A valid office is required.' })
  const office = body.office
  let syncDb: Awaited<ReturnType<typeof import('../_lib/admin.js')['getAdminDb']>> | undefined
  try {
    const auth = await authenticateOffice(req, office)
    if ('error' in auth && auth.error) return res.status(auth.error.status).json({ error: auth.error.message })
    if (!isAuthorizedLeadSync(auth.profile, office)) return res.status(403).json({ error: 'Manager or super-admin access is required to synchronize registers.' })
    syncDb = auth.db
    const action = body?.action
    if (action === 'previewBaseline') return previewBaseline(auth.db, office, auth.uid, res)
    if (action === 'confirmBaseline') {
      if (typeof body.previewId !== 'string') return res.status(400).json({ error: 'A baseline preview is required.' })
      const previewRef = auth.db.collection('leadSyncPreviews').doc(body.previewId)
      const previewSnapshot = await previewRef.get()
      const stored = previewSnapshot.data()
      const state = await auth.db.collection('leadSyncState').doc(office).get()
      if (!previewSnapshot.exists || stored?.['office'] !== office || stored?.['uid'] !== auth.uid || stored?.['baseline'] !== true || stored?.['usedAt'] || Number(stored?.['expiresAt']) < Date.now() || state.data()?.['baselineConfirmed'] === true) {
        return res.status(410).json({ error: 'This baseline preview expired or is not available to your account. Preview again.' })
      }
      const fetched = await readOfficeSheetRows(office)
      if (fetched.invalidTabs.length || hashRows(fetched.rows) !== stored?.['rowsHash']) return res.status(409).json({ error: 'The register changed since preview. Create a new preview before confirming.', invalidTabs: fetched.invalidTabs })
      const current = await loadOfficeLeads(auth.db, office)
      const reconciliation = reconcileSheetRows({ rows: fetched.rows, currentRecords: current })
      if (reconciliation.invalidRows.length) return res.status(422).json({ error: 'Some rows cannot be safely imported. Resolve them and preview again.', invalidRows: reconciliation.invalidRows })
      await writeReconciliation(auth.db, office, reconciliation)
      const summary = { office, source: SHEET_SOURCE[office].label, ...previewCounts(reconciliation), syncedAt: new Date().toISOString() }
      await auth.db.collection('leadSyncState').doc(office).set({ baselineConfirmed: true, baselineConfirmedAt: summary.syncedAt, lastSyncAt: summary.syncedAt, lastSyncStatus: 'success', lastSyncCounts: previewCounts(reconciliation) }, { merge: true })
      await previewRef.set({ usedAt: summary.syncedAt }, { merge: true })
      return res.status(200).json({ summary, conflicts: reconciliation.conflicts })
    }
    if (action === 'syncNow') {
      const state = await auth.db.collection('leadSyncState').doc(office).get()
      if (state.data()?.['baselineConfirmed'] !== true) return res.status(409).json({ error: 'Confirm the initial Sheets baseline before syncing.' })
      const result = await runOfficeSync(auth.db, office)
      return res.status(200).json({ summary: result.summary, conflicts: result.preview.conflicts, duplicates: result.preview.duplicates })
    }
    return res.status(400).json({ error: 'Unknown lead sync action.' })
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status: unknown }).status) : 500
    if (syncDb && status >= 422) await recordSyncFailure(syncDb, office, error).catch(() => undefined)
    const details = error && typeof error === 'object' ? error as { invalidRows?: unknown; duplicates?: unknown; invalidTabs?: unknown } : {}
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Lead sync failed.',
      ...(details.invalidRows ? { invalidRows: details.invalidRows } : {}),
      ...(details.duplicates ? { duplicates: details.duplicates } : {}),
      ...(details.invalidTabs ? { invalidTabs: details.invalidTabs } : {}),
    })
  }
}

async function scheduledSync(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorizedLeadCron(req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized scheduled sync.' })
  try {
    const { getAdminDb } = await import('../_lib/admin.js')
    const db = await getAdminDb()
    const results: Array<{ office: LeadOffice; status: string; summary?: Record<string, unknown>; error?: string; invalidRows?: unknown[]; duplicates?: unknown[] }> = []
    for (const office of ['perth', 'brisbane'] as const) {
      const state = await db.collection('leadSyncState').doc(office).get()
      if (state.data()?.['baselineConfirmed'] !== true) {
        results.push({ office, status: 'baseline_required' })
        continue
      }
      try {
        const result = await runOfficeSync(db, office)
        results.push({ office, status: 'success', summary: result.summary })
      } catch (error) {
        await recordSyncFailure(db, office, error).catch(() => undefined)
        const details = error && typeof error === 'object' ? error as { invalidRows?: unknown; duplicates?: unknown } : {}
        results.push({
          office, status: 'failed', error: error instanceof Error ? error.message : 'Lead sync failed.',
          ...(Array.isArray(details.invalidRows) ? { invalidRows: details.invalidRows } : {}),
          ...(Array.isArray(details.duplicates) ? { duplicates: details.duplicates } : {}),
        })
      }
    }
    return res.status(results.some((result) => result.status === 'failed') ? 500 : 200).json({ results })
  } catch {
    return res.status(500).json({ error: 'Scheduled lead sync failed.' })
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method === 'GET' && isAuthorizedLeadCron(request.headers.authorization, process.env.CRON_SECRET)) return scheduledSync(request, response)
  if (request.method === 'GET' && isOffice(request.query.office)) {
    return importOfficeSheet(request, response, request.query.office)
  }
  if (request.method === 'POST') return manualSync(request, response)
  return response.status(405).json({ error: 'Method not allowed.' })
}
