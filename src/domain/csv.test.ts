import { describe, it, expect } from 'vitest'
import { escapeCsvField, parseCsvField, arrayToCsv, csvToArray } from './csv'

describe('escapeCsvField', () => {
  it('escapes fields containing commas', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"')
  })

  it('escapes fields containing double quotes', () => {
    expect(escapeCsvField('he said "hello"')).toBe('"he said ""hello"""')
  })

  it('escapes fields containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('escapes fields containing carriage returns', () => {
    expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"')
  })

  it('does not escape simple fields', () => {
    expect(escapeCsvField('hello')).toBe('hello')
    expect(escapeCsvField('123')).toBe('123')
    expect(escapeCsvField('')).toBe('')
  })

  it('handles fields that already have quotes', () => {
    expect(escapeCsvField('"quoted"')).toBe('"""quoted"""')
  })
})

describe('parseCsvField', () => {
  it('parses simple fields', () => {
    expect(parseCsvField('hello')).toBe('hello')
    expect(parseCsvField('123')).toBe('123')
    expect(parseCsvField('')).toBe('')
  })

  it('parses quoted fields with commas', () => {
    expect(parseCsvField('"hello, world"')).toBe('hello, world')
  })

  it('parses quoted fields with escaped quotes', () => {
    expect(parseCsvField('"he said ""hello"""')).toBe('he said "hello"')
  })

  it('parses quoted fields with newlines', () => {
    expect(parseCsvField('"line1\nline2"')).toBe('line1\nline2')
  })

  it('handles unquoted fields with quotes', () => {
    expect(parseCsvField('hello "world"')).toBe('hello "world"')
  })
})

describe('arrayToCsv', () => {
  it('converts array of arrays to CSV string', () => {
    const data = [
      ['Name', 'Phone', 'Status'],
      ['John Doe', '0412 345 678', 'Lead'],
      ['Jane Smith', '0400 111 222', 'Not Interested'],
    ]
    const expected = 'Name,Phone,Status\nJohn Doe,0412 345 678,Lead\nJane Smith,0400 111 222,Not Interested'
    expect(arrayToCsv(data)).toBe(expected)
  })

  it('escapes fields that need escaping', () => {
    const data = [
      ['Name', 'Notes'],
      ['John, Jr.', 'Said "hello"'],
    ]
    const expected = 'Name,Notes\n"John, Jr.","Said ""hello"""'
    expect(arrayToCsv(data)).toBe(expected)
  })

  it('handles empty arrays', () => {
    expect(arrayToCsv([])).toBe('')
  })

  it('handles single row', () => {
    expect(arrayToCsv([['a', 'b']])).toBe('a,b')
  })
})

describe('csvToArray', () => {
  it('parses simple CSV', () => {
    const csv = 'Name,Phone,Status\nJohn Doe,0412 345 678,Lead\nJane Smith,0400 111 222,Not Interested'
    const expected = [
      ['Name', 'Phone', 'Status'],
      ['John Doe', '0412 345 678', 'Lead'],
      ['Jane Smith', '0400 111 222', 'Not Interested'],
    ]
    expect(csvToArray(csv)).toEqual(expected)
  })

  it('parses CSV with escaped fields', () => {
    const csv = 'Name,Notes\n"John, Jr.","Said ""hello"""'
    const expected = [
      ['Name', 'Notes'],
      ['John, Jr.', 'Said "hello"'],
    ]
    expect(csvToArray(csv)).toEqual(expected)
  })

  it('handles empty CSV', () => {
    expect(csvToArray('')).toEqual([[]])
  })

  it('handles trailing newline', () => {
    const csv = 'a,b\nc,d\n'
    expect(csvToArray(csv)).toEqual([['a', 'b'], ['c', 'd']])
  })
})