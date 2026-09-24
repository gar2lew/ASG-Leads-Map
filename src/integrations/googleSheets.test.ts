import { describe, expect, it } from 'vitest'
import { googleSheetCsvUrl, googleSheetSources } from './googleSheets'

describe('Google Sheets sources', () => {
  it('keeps both live lead registers addressable by office', () => {
    expect(googleSheetSources.map((source) => source.office)).toEqual(['perth', 'brisbane'])
    expect(googleSheetCsvUrl(googleSheetSources[0]!)).toContain('/gviz/tq?tqx=out:csv&sheet=LEADS')
  })
})
