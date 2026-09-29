import type { LeadOffice } from '../domain/leadRegister'
import { arrayToCsv } from '../domain/csv'

export interface GoogleSheetSource {
  office: LeadOffice
  label: string
  spreadsheetId: string
  sheetNames: string[]
  url: string
}

export const googleSheetSources: GoogleSheetSource[] = [
  { office: 'perth', label: 'Perth live leads', spreadsheetId: '15bh3bkAMpwIhi3MJ2-INA8njG3spgUW8CGVb_ckJ26I', sheetNames: ['LEADS', 'NO ANSWER', 'BOOKED', 'REVISIT', 'NOT INTERESTED', 'WRONG NUMBER'], url: 'https://docs.google.com/spreadsheets/d/15bh3bkAMpwIhi3MJ2-INA8njG3spgUW8CGVb_ckJ26I/edit?gid=0#gid=0' },
  { office: 'brisbane', label: 'Brisbane live leads', spreadsheetId: '1AO6VZzJXr6btECVZrWFTKFXPBNMkjmuDsKiCisrjcrM', sheetNames: ['LEADS', 'NO ANSWER', 'BOOKED', 'REVISIT', 'NOT INTERESTED', 'WRONG NUMBER'], url: 'https://docs.google.com/spreadsheets/d/1AO6VZzJXr6btECVZrWFTKFXPBNMkjmuDsKiCisrjcrM/edit?gid=1838236201#gid=1838236201' },
]

export async function fetchGoogleSheetCsv(source: GoogleSheetSource, token: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`/api/integrations/google-sheets?office=${source.office}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json() as { values?: string[][]; error?: string }
  if (!response.ok) throw new Error(body.error || `Unable to read ${source.label}.`)
  return arrayToCsv(body.values ?? [])
}
