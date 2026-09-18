import type { Pin } from './pin'
import { PinOutcome, pinOutcomeLabel, pinOutcomeOrder } from './pinOutcome'
import { arrayToCsv } from './csv'
import type { OfficeId } from './roles'

export interface OutcomeSummary {
  outcome: Pin['outcome']
  count: number
}

export interface RepActivitySummary {
  repId: string
  count: number
}

export interface ReportSummary {
  totalPins: number
  leadsGenerated: number
  conversionRate: number
  activeReps: number
  outcomeDistribution: OutcomeSummary[]
  repActivity: RepActivitySummary[]
}

export interface ReportPeriod {
  dateFrom?: string | undefined
  dateTo?: string | undefined
}

export interface ReportFilters extends ReportPeriod {
  officeId?: OfficeId | undefined
}

export interface ReportComparison {
  current: ReportSummary
  previous: ReportSummary
  changes: Pick<ReportSummary, 'totalPins' | 'leadsGenerated' | 'conversionRate' | 'activeReps'>
}

export function filterPinsForReport(pins: Pin[], filters: ReportFilters): Pin[] {
  return pins.filter((pin) => {
    if (filters.officeId && pin.officeId !== filters.officeId) return false
    const createdDate = pin.createdAt.slice(0, 10)
    if (filters.dateFrom && createdDate < filters.dateFrom) return false
    if (filters.dateTo && createdDate > filters.dateTo) return false
    return true
  })
}

export function compareReportPeriods(pins: Pin[], period: { dateFrom: string; dateTo: string; officeId?: OfficeId | undefined }): ReportComparison {
  const current = filterPinsForReport(pins, period)
  const start = parseISODate(period.dateFrom)
  const end = parseISODate(period.dateTo)
  const duration = end.getTime() - start.getTime() + 86_400_000
  const previousStart = new Date(start.getTime() - duration)
  const previousEnd = new Date(start.getTime() - 86_400_000)
  const previous = filterPinsForReport(pins, {
    officeId: period.officeId,
    dateFrom: toISODate(previousStart),
    dateTo: toISODate(previousEnd),
  })
  const currentReport = summarizePins(current)
  const previousReport = summarizePins(previous)

  return {
    current: currentReport,
    previous: previousReport,
    changes: {
      totalPins: percentageChange(currentReport.totalPins, previousReport.totalPins),
      leadsGenerated: percentageChange(currentReport.leadsGenerated, previousReport.leadsGenerated),
      conversionRate: percentageChange(currentReport.conversionRate, previousReport.conversionRate),
      activeReps: percentageChange(currentReport.activeReps, previousReport.activeReps),
    },
  }
}

export function summarizePins(pins: Pin[]): ReportSummary {
  const outcomeCounts = new Map<Pin['outcome'], number>()
  const repCounts = new Map<string, number>()

  for (const pin of pins) {
    outcomeCounts.set(pin.outcome, (outcomeCounts.get(pin.outcome) ?? 0) + 1)
    repCounts.set(pin.createdBy, (repCounts.get(pin.createdBy) ?? 0) + 1)
  }

  const outcomeDistribution = [...outcomeCounts.entries()]
    .sort(([first], [second]) => outcomeSortIndex(first) - outcomeSortIndex(second))
    .map(([outcome, count]) => ({ outcome, count }))
  const repActivity = [...repCounts.entries()]
    .sort(([, first], [, second]) => second - first)
    .map(([repId, count]) => ({ repId, count }))
  const leadsGenerated = outcomeCounts.get(PinOutcome.Lead) ?? 0

  return {
    totalPins: pins.length,
    leadsGenerated,
    conversionRate: pins.length === 0 ? 0 : roundPercentage((leadsGenerated / pins.length) * 100),
    activeReps: repCounts.size,
    outcomeDistribution,
    repActivity,
  }
}

export function exportReportToCsv(report: ReportSummary): string {
  return arrayToCsv([
    ['metric', 'value'],
    ['totalPins', String(report.totalPins)],
    ['leadsGenerated', String(report.leadsGenerated)],
    ['conversionRate', String(report.conversionRate)],
    ['activeReps', String(report.activeReps)],
    [],
    ['outcome', 'count'],
    ...report.outcomeDistribution.map(({ outcome, count }) => [pinOutcomeLabel(outcome), String(count)]),
    [],
    ['repId', 'count'],
    ...report.repActivity.map(({ repId, count }) => [repId, String(count)]),
  ])
}

function outcomeSortIndex(outcome: Pin['outcome']): number {
  const index = pinOutcomeOrder.indexOf(outcome)
  return index === -1 ? pinOutcomeOrder.length + Object.values(PinOutcome).indexOf(outcome) : index
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return roundPercentage(((current - previous) / previous) * 100)
}

function parseISODate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10)
}
