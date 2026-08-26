export function escapeCsvField(field: string): string {
  const needsEscaping = /[",\n\r]/.test(field)

  if (!needsEscaping) {
    return field
  }

  const escaped = field.replace(/"/g, '""')
  return `"${escaped}"`
}

export function parseCsvField(field: string): string {
  if (field.length === 0) {
    return ''
  }

  if (field[0] === '"' && field[field.length - 1] === '"') {
    const inner = field.slice(1, -1)
    return inner.replace(/""/g, '"')
  }

  return field
}

export function arrayToCsv(rows: string[][]): string {
  if (rows.length === 0) {
    return ''
  }

  return rows
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\n')
}

export function csvToArray(csv: string): string[][] {
  if (csv.length === 0) {
    return [[]]
  }

  const lines = csv.split(/\r?\n/)
  const result: string[][] = []

  for (const line of lines) {
    if (line.length === 0 && lines.length > 1) {
      continue
    }

    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }

    fields.push(current)
    result.push(fields.map(parseCsvField))
  }

  return result
}