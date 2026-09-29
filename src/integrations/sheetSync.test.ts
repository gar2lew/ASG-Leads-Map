import { afterEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(async () => 'firebase-id-token') }))
vi.mock('../auth', () => ({ getAuthService: () => auth }))

import { confirmSheetBaseline, previewSheetBaseline, syncSheetNow } from './sheetSync'

describe('Google Sheets sync client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends authenticated preview and confirmation actions to the shared API', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ previewId: 'preview-1', counts: { inserted: 3 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { office: 'perth', inserted: 3 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)

    await expect(previewSheetBaseline('perth')).resolves.toMatchObject({ previewId: 'preview-1', counts: { inserted: 3 } })
    await expect(confirmSheetBaseline('perth', 'preview-1')).resolves.toMatchObject({ summary: { office: 'perth', inserted: 3 } })

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/leads', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer firebase-id-token' }),
    }))
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ action: 'previewBaseline', office: 'perth' })
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ action: 'confirmBaseline', office: 'perth', previewId: 'preview-1' })
  })

  it('surfaces structured invalid-row details and does not pretend a failed sync succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Some source rows need review.', invalidRows: [{ tabName: 'LEADS', sourceRow: 9, reason: 'Address missing' }],
    }), { status: 422 })))

    await expect(syncSheetNow('brisbane')).rejects.toMatchObject({
      message: 'Some source rows need review.', invalidRows: [{ tabName: 'LEADS', sourceRow: 9, reason: 'Address missing' }],
    })
  })
})
