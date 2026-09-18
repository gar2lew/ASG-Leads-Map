import { useEffect, useState } from 'react'
import { PinOutcome, pinOutcomeColor, pinOutcomeLabel, canViewReports, compareReportPeriods, exportReportToCsv, filterPinsForReport, getAllPins, summarizePins, type ReportSummary, type Pin } from '../domain'
import type { OfficeId } from '../domain/roles'
import { getUserAdminService, useCurrentUser, type UserProfileRecord } from '../auth'
import './DashboardPage.css'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: { value: number; label: string }
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

function StatCard({ title, value, icon, trend, variant = 'primary' }: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${variant}`}>
      <div className="stat-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="stat-card__content">
        <p className="stat-card__title">{title}</p>
        <p className="stat-card__value">{value}</p>
        {trend && (
          <p className={`stat-card__trend ${trend.value >= 0 ? 'stat-card__trend--up' : 'stat-card__trend--down'}`}>
            <span aria-hidden="true">{trend.value >= 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}% {trend.label}</span>
          </p>
        )}
      </div>
    </article>
  )
}

const outcomeBadgeVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  [PinOutcome.Knocked]: 'success',
  [PinOutcome.NotKnocked]: 'secondary',
  [PinOutcome.NotInterested]: 'danger',
  [PinOutcome.DidNotQualify]: 'warning',
  [PinOutcome.Lead]: 'info',
}

export function DashboardPage() {
  const currentUser = useCurrentUser()
  const hasReportAccess = canViewReports(currentUser.role)
  const [pins, setPins] = useState<Pin[]>([])
  const [repNames, setRepNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(hasReportAccess)
  const [officeFilter, setOfficeFilter] = useState<'all' | OfficeId>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!hasReportAccess) {
      return
    }

    async function loadReportData() {
      try {
        const loadedPins = await getAllPins()
        setPins(loadedPins)
        try {
          const users = await getUserAdminService().listUsers()
          setRepNames(toRepNameMap(users))
        } catch (error) {
          console.error('Failed to load report user names:', error)
        }
      } catch (error) {
        console.error('Failed to load report data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadReportData()
  }, [hasReportAccess])

  const reportPins = filterPinsForReport(pins, {
    officeId: officeFilter === 'all' ? undefined : officeFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const report = summarizePins(reportPins)
  const comparison = dateFrom && dateTo
    ? compareReportPeriods(pins, { officeId: officeFilter === 'all' ? undefined : officeFilter, dateFrom, dateTo })
    : null
  const recentActivity = [...reportPins]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5)

  if (!hasReportAccess) {
    return (
      <div className="dashboard-page">
        <header className="page__header">
          <div>
            <h1 className="page__title">Dashboard</h1>
          </div>
        </header>
        <section className="card">
          <div className="card__content">
            <p className="empty-state__description">You do not have permission to view reports.</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__subtitle">Overview of field sales activity for your office</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--primary" type="button" disabled={isLoading} onClick={() => handleExportReport(report)}>
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Export Report
          </button>
        </div>
      </header>

      <section className="dashboard-page__stats" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="visually-hidden">Key Statistics</h2>
        <div className="stats-grid">
          <StatCard title="Total Pins" value={report.totalPins} {...(comparison ? { trend: { value: comparison.changes.totalPins, label: 'vs previous period' } } : {})} variant="primary" icon={<span aria-hidden="true">●</span>} />
          <StatCard title="Leads Generated" value={report.leadsGenerated} {...(comparison ? { trend: { value: comparison.changes.leadsGenerated, label: 'vs previous period' } } : {})} variant="success" icon={<span aria-hidden="true">✓</span>} />
          <StatCard title="Conversion Rate" value={`${report.conversionRate}%`} {...(comparison ? { trend: { value: comparison.changes.conversionRate, label: 'vs previous period' } } : {})} variant="warning" icon={<span aria-hidden="true">%</span>} />
          <StatCard title="Active Reps" value={report.activeReps} {...(comparison ? { trend: { value: comparison.changes.activeReps, label: 'vs previous period' } } : {})} variant="info" icon={<span aria-hidden="true">♟</span>} />
        </div>
      </section>

      <section className="dashboard-page__filters card" aria-labelledby="filters-heading">
        <div className="card__header">
          <h2 className="card__title" id="filters-heading">Report Filters</h2>
        </div>
        <div className="card__content dashboard-filters">
          <label>Office<select value={officeFilter} onChange={(event) => setOfficeFilter(event.target.value as 'all' | OfficeId)}><option value="all">All offices</option><option value="perth">Perth</option><option value="brisbane">Brisbane</option></select></label>
          <label>From<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label>To<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          {(dateFrom || dateTo || officeFilter !== 'all') && <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setOfficeFilter('all'); setDateFrom(''); setDateTo('') }}>Clear filters</button>}
        </div>
      </section>

      <section className="dashboard-page__charts card" aria-labelledby="charts-heading">
        <div className="card__header">
          <h2 className="card__title" id="charts-heading">Outcomes Distribution</h2>
        </div>
        <div className="card__content">
          <div className="charts-grid">
            <div className="chart-placeholder">
              <p className="empty-state__description">Chart: Outcomes by Type (Bar Chart)</p>
              <div className="outcome-summary">
                {report.outcomeDistribution.map(({ outcome, count }) => (
                  <div key={outcome} className="outcome-summary__item">
                    <span
                      className="outcome-summary__color"
                      style={{ backgroundColor: pinOutcomeColor(outcome) }}
                      aria-hidden="true"
                    ></span>
                    <span className="outcome-summary__label">{pinOutcomeLabel(outcome)}</span>
                    <span className="outcome-summary__count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-placeholder">
              <p className="empty-state__description">Chart: Activity by Rep (Horizontal Bar)</p>
              <div className="rep-activity">
                {report.repActivity.map((rep) => (
                  <div key={rep.repId} className="rep-activity__item">
                    <span className="rep-activity__name">{repNames[rep.repId] ?? rep.repId}</span>
                    <div className="rep-activity__bar">
                      <div
                        className="rep-activity__fill"
                        style={{ width: `${report.totalPins === 0 ? 0 : (rep.count / report.totalPins) * 100}%`, backgroundColor: 'var(--asg-color-accent-gold)' }}
                      />
                    </div>
                    <span className="rep-activity__count">{rep.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-page__activity card" aria-labelledby="activity-heading">
        <div className="card__header">
          <h2 className="card__title" id="activity-heading">Recent Activity</h2>
          <a href="/activity" className="btn btn--ghost btn--sm">View All</a>
        </div>
        <div className="card__content" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Rep</th>
                <th scope="col">Action</th>
                <th scope="col">Address</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((activity) => (
                <tr key={activity.id}>
                  <td><time dateTime={activity.createdAt}>{formatRelativeTime(activity.createdAt)}</time></td>
                  <td>{repNames[activity.createdBy] ?? activity.createdBy}</td>
                  <td>Marked as {pinOutcomeLabel(activity.outcome)}</td>
                  <td>{activity.address ?? '—'}</td>
                  <td>
                    <span className={`badge badge--${outcomeBadgeVariant[activity.outcome] ?? 'secondary'}`}>
                      {pinOutcomeLabel(activity.outcome)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function handleExportReport(report: ReportSummary): void {
  const blob = new Blob([exportReportToCsv(report)], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `asg-leads-report-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

function formatRelativeTime(createdAt: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  if (elapsedMinutes < 1) return 'Just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`
  return `${Math.floor(elapsedHours / 24)} day${Math.floor(elapsedHours / 24) === 1 ? '' : 's'} ago`
}

function toRepNameMap(users: UserProfileRecord[]): Record<string, string> {
  return Object.fromEntries(users.map((user) => [user.uid, user.displayName]))
}
