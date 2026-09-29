import { googleSheetSources, type GoogleSheetSource } from '../domain/googleSheetSources'
import { arrayToCsv } from '../domain/csv'

export { googleSheetSources }

export async function fetchGoogleSheetCsv(source: GoogleSheetSource, token: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`/api/leads?office=${source.office}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json() as { values?: string[][]; error?: string }
  if (!response.ok) throw new Error(body.error || `Unable to read ${source.label}.`)
  return arrayToCsv(body.values ?? [])
}
