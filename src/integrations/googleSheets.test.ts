import { describe, expect, it } from 'vitest'
import { googleSheetSources } from './googleSheets'

describe('Google Sheets sources', () => {
  it('keeps both live lead registers addressable by office', () => {
    expect(googleSheetSources.map((source) => source.office)).toEqual(['perth', 'brisbane'])
    expect(googleSheetSources.every((source) => source.sheetNames.includes('LEADS') && source.sheetNames.includes('NO ANSWER'))).toBe(true)
  })
})
