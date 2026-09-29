import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateKeyPairSync } from 'node:crypto'

const { store, adminDb, adminAuth, sheetData } = vi.hoisted(() => {
  const store = new Map<string, Map<string, Record<string, unknown>>>()
  const sheetData = { invalid: false, phone: '0412 345 678' }
  const collection = (name: string) => {
    const documents = store.get(name) || new Map<string, Record<string, unknown>>()
    store.set(name, documents)
    const ref = (id: string) => ({
      id,
      get: async () => {
        const data = documents.get(id)
        return { exists: Boolean(data), data: () => data }
      },
      set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
        documents.set(id, options?.merge ? { ...documents.get(id), ...data } : data)
      },
    })
    return {
      doc: ref,
      where: (field: string, _operator: '==', value: unknown) => ({
        get: async () => ({
          docs: [...documents.entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id, data]) => ({ id, data: () => data })),
        }),
      }),
    }
  }
  const adminDb = {
    collection,
    runTransaction: async (callback: (transaction: {
      get: (reference: ReturnType<ReturnType<typeof collection>['doc']>) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
      set: (reference: ReturnType<ReturnType<typeof collection>['doc']>, data: Record<string, unknown>, options?: { merge?: boolean }) => void
    }) => Promise<unknown>) => {
      const writes: Array<() => Promise<void>> = []
      const result = await callback({
        get: (reference) => reference.get(),
        set: (reference, data, options) => writes.push(async () => { await reference.set(data, options) }),
      })
      await Promise.all(writes.map((write) => write()))
      return result
    },
  }
  const adminAuth = { verifyIdToken: vi.fn(async () => ({ uid: 'admin-1' })) }
  return { store, adminDb, adminAuth, sheetData }
})

vi.mock('../_lib/admin.js', () => ({
  getAdminAuth: async () => adminAuth,
  getAdminDb: async () => adminDb,
}))

import handler from './index.js'

function responseRecorder() {
  const result: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined }
  const response = {
    status(code: number) { result.statusCode = code; return this },
    json(body: unknown) { result.body = body; return this },
    end() { return this },
    setHeader() { return this },
  }
  return { response: response as unknown as VercelResponse, result }
}

async function post(body: unknown) {
  const { response, result } = responseRecorder()
  await handler({
    method: 'POST', headers: { authorization: 'Bearer test-token' }, body, query: {},
  } as unknown as VercelRequest, response)
  return result
}

describe('Sheets reconciliation API', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }
  const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  beforeEach(() => {
    store.clear()
    store.set('users', new Map([['admin-1', { role: 'super_admin', active: true, officeId: 'perth' }]]))
    sheetData.invalid = false
    sheetData.phone = '0412 345 678'
    vi.clearAllMocks()
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'sheets-reader@example.iam.gserviceaccount.com'
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = privateKey
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'sheets-access-token' }), { status: 200 })
      const office = url.includes('15bh3bk') ? 'perth' : 'brisbane'
      const rows = sheetData.invalid
        ? [['LeadID', 'Lead Name', 'Address', 'Contact Number', 'Lead Status'], ['L-1', 'Ava Smith', '', '0412 345 678', 'New']]
        : office === 'perth'
          ? [['LeadID', 'Lead Name', 'Address', 'Contact Number', 'Lead Status'], ['L-1', 'Ava Smith', '1 Main Street', sheetData.phone, 'New']]
          : [['LeadID', 'Lead Name', 'Address', 'Contact Number', 'Lead Status'], ['L-1', 'Noah Jones', '2 River Road', sheetData.phone, 'New']]
      return new Response(JSON.stringify({ valueRanges: [{ values: rows }, ...Array.from({ length: 5 }, () => ({ values: [['Lead Name', 'Address']] }))] }), { status: 200 })
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
  })

  it('keeps baseline preview read-only until explicitly confirmed, then repeat sync is idempotent', async () => {
    const previewResult = await post({ action: 'previewBaseline', office: 'perth' })
    const previewBody = previewResult.body as { previewId: string; counts: { inserted: number } }
    expect(previewResult.statusCode).toBe(200)
    expect(previewBody.counts.inserted).toBe(1)
    expect(store.get('leads')?.size || 0).toBe(0)

    const confirmResult = await post({ action: 'confirmBaseline', office: 'perth', previewId: previewBody.previewId })
    expect(confirmResult.statusCode).toBe(200)
    expect(store.get('leads')?.size).toBe(1)
    expect(store.get('leadSyncState')?.get('perth')?.['baselineConfirmed']).toBe(true)

    const syncResult = await post({ action: 'syncNow', office: 'perth' })
    expect(syncResult.statusCode).toBe(200)
    expect((syncResult.body as { summary: { inserted: number; updated: number } }).summary).toMatchObject({ inserted: 0, updated: 0 })
    expect(store.get('leads')?.size).toBe(1)
  })

  it('keeps the same source LeadID isolated between offices', async () => {
    const perth = await post({ action: 'previewBaseline', office: 'perth' })
    const brisbane = await post({ action: 'previewBaseline', office: 'brisbane' })
    const perthPreview = perth.body as { previewId: string }
    const brisbanePreview = brisbane.body as { previewId: string }
    await post({ action: 'confirmBaseline', office: 'perth', previewId: perthPreview.previewId })
    await post({ action: 'confirmBaseline', office: 'brisbane', previewId: brisbanePreview.previewId })

    expect(store.get('leads')?.size).toBe(2)
    expect([...store.get('leads')!.values()].map((lead) => lead['officeId']).sort()).toEqual(['brisbane', 'perth'])
  })

  it('blocks a scheduled/manual refresh with invalid source rows and records the failure', async () => {
    const preview = await post({ action: 'previewBaseline', office: 'perth' })
    const previewId = (preview.body as { previewId: string }).previewId
    await post({ action: 'confirmBaseline', office: 'perth', previewId })
    const originalLead = [...store.get('leads')!.values()][0]
    sheetData.invalid = true

    const syncResult = await post({ action: 'syncNow', office: 'perth' })

    expect(syncResult.statusCode).toBe(422)
    expect((syncResult.body as { invalidRows: unknown[] }).invalidRows).toHaveLength(1)
    expect([...store.get('leads')!.values()]).toEqual([originalLead])
    expect(store.get('leadSyncState')?.get('perth')?.['lastSyncStatus']).toBe('failed')
  })

  it('requires an explicit, audited choice to resolve an app-versus-Sheets conflict', async () => {
    const preview = await post({ action: 'previewBaseline', office: 'perth' })
    const previewId = (preview.body as { previewId: string }).previewId
    await post({ action: 'confirmBaseline', office: 'perth', previewId })
    const [recordId, original] = [...store.get('leads')!.entries()][0]!
    store.get('leads')!.set(recordId, { ...original, phone: '0400 000 000' })
    sheetData.phone = '0412 999 888'

    const sync = await post({ action: 'syncNow', office: 'perth' })
    expect((sync.body as { conflicts: Array<{ field: string }> }).conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'phone' })]))
    expect(store.get('leads')!.get(recordId)?.['phone']).toBe('0400 000 000')

    const resolved = await post({ action: 'resolveConflict', office: 'perth', recordId, field: 'phone', resolution: 'sheets' })

    expect(resolved.statusCode).toBe(200)
    expect(store.get('leads')!.get(recordId)?.['phone']).toBe('0412 999 888')
    const source = store.get('leads')!.get(recordId)?.['source'] as { conflicts: Record<string, unknown> } | undefined
    expect(source?.conflicts).not.toHaveProperty('phone')
    expect(source).not.toHaveProperty('resolutions')
    expect(store.get('leadSyncAudit')?.size).toBe(1)
  })

  it('preserves a keep-Firestore choice until the source value changes again', async () => {
    const preview = await post({ action: 'previewBaseline', office: 'perth' })
    const previewId = (preview.body as { previewId: string }).previewId
    await post({ action: 'confirmBaseline', office: 'perth', previewId })
    const [recordId, original] = [...store.get('leads')!.entries()][0]!
    store.get('leads')!.set(recordId, { ...original, phone: '0400 000 000' })
    sheetData.phone = '0412 999 888'
    await post({ action: 'syncNow', office: 'perth' })

    const keepResult = await post({ action: 'resolveConflict', office: 'perth', recordId, field: 'phone', resolution: 'firestore' })
    expect(keepResult.statusCode).toBe(200)
    expect(store.get('leads')!.get(recordId)?.['phone']).toBe('0400 000 000')

    const unchangedSource = await post({ action: 'syncNow', office: 'perth' })
    expect((unchangedSource.body as { conflicts: unknown[] }).conflicts).toEqual([])
    expect(store.get('leads')!.get(recordId)?.['phone']).toBe('0400 000 000')

    sheetData.phone = '0412 000 999'
    const changedSource = await post({ action: 'syncNow', office: 'perth' })
    expect((changedSource.body as { conflicts: Array<{ field: string }> }).conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'phone' })]))
    expect(store.get('leads')!.get(recordId)?.['phone']).toBe('0400 000 000')
  })
})
