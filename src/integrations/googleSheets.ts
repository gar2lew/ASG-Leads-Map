import type { LeadOffice } from '../domain/leadRegister'

export interface GoogleSheetSource {
  office: LeadOffice
  label: string
  spreadsheetId: string
  sheetName: string
  url: string
}

export const googleSheetSources: GoogleSheetSource[] = [
  { office: 'perth', label: 'Perth live leads', spreadsheetId: '15bh3bkAMpwIhi3MJ2-INA8njG3spgUW8CGVb_ckJ26I', sheetName: 'LEADS', url: 'https://docs.google.com/spreadsheets/d/15bh3bkAMpwIhi3MJ2-INA8njG3spgUW8CGVb_ckJ26I/edit?gid=0#gid=0' },
  { office: 'brisbane', label: 'Brisbane live leads', spreadsheetId: '1AO6VZzJXr6btECVZrWFTKFXPBNMkjmuDsKiCisrjcrM', sheetName: 'LEADS', url: 'https://docs.google.com/spreadsheets/d/1AO6VZzJXr6btECVZrWFTKFXPBNMkjmuDsKiCisrjcrM/edit?gid=1838236201#gid=1838236201' },
]

export function googleSheetCsvUrl(source: GoogleSheetSource) {
  return `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(source.sheetName)}`
}

export async function fetchGoogleSheetCsv(source: GoogleSheetSource, fetcher: typeof fetch = fetch) {
  const response = await fetcher(googleSheetCsvUrl(source))
  if (!response.ok) throw new Error(`Unable to read ${source.label}. Make the sheet accessible to the app or configure the Google Sheets service connection.`)
  return response.text()
}
