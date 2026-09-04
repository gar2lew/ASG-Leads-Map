import { PinOutcome, pinOutcomeColor, pinOutcomeLabel, canViewReports } from '../domain'
import { useCurrentUser } from '../auth'
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

// Static demo data (replace with real data from API)
const stats = [
  {
    title: 'Total Pins',
    value: '1,234',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
        <path d="M3 14h18" />
        <path d="M12 14v8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    trend: { value: 12, label: 'vs last week' },
    variant: 'primary' as const,
  },
  {
    title: 'Leads Generated',
    value: '87',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    trend: { value: 23, label: 'vs last week' },
    variant: 'success' as const,
  },
  {
    title: 'Conversion Rate',
    value: '7.1%',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    ),
    trend: { value: -2, label: 'vs last week' },
    variant: 'warning' as const,
  },
  {
    title: 'Active Reps',
    value: '12',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    trend: { value: 0, label: 'vs last week' },
    variant: 'info' as const,
  },
]

const recentActivity = [
  { time: '2 min ago', rep: 'Sarah Chen', action: 'Marked as Lead', address: '123 Hay St, Perth', outcome: PinOutcome.Lead },
  { time: '15 min ago', rep: 'James Wilson', action: 'Knocked - Not Interested', address: '456 Murray St, Perth', outcome: PinOutcome.NotInterested },
  { time: '32 min ago', rep: 'Emma Davis', action: 'Did Not Qualify', address: '789 Wellington St, Perth', outcome: PinOutcome.DidNotQualify },
  { time: '1 hour ago', rep: 'Sarah Chen', action: 'Knocked', address: '321 Barrack St, Perth', outcome: PinOutcome.Knocked },
  { time: '2 hours ago', rep: 'Michael Brown', action: 'Not Knocked', address: '654 St Georges Tce, Perth', outcome: PinOutcome.NotKnocked },
]

const outcomeBadgeVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  [PinOutcome.Knocked]: 'success',
  [PinOutcome.NotKnocked]: 'secondary',
  [PinOutcome.NotInterested]: 'danger',
  [PinOutcome.DidNotQualify]: 'warning',
  [PinOutcome.Lead]: 'info',
}

// Static demo data for charts
const outcomeDistribution = [
  { outcome: PinOutcome.Knocked, count: 342 },
  { outcome: PinOutcome.NotKnocked, count: 156 },
  { outcome: PinOutcome.NotInterested, count: 89 },
  { outcome: PinOutcome.DidNotQualify, count: 67 },
  { outcome: PinOutcome.Lead, count: 87 },
]

const repActivity = [
  { name: 'Sarah Chen', count: 87, percentage: 75 },
  { name: 'James Wilson', count: 72, percentage: 62 },
  { name: 'Emma Davis', count: 58, percentage: 50 },
  { name: 'Michael Brown', count: 45, percentage: 39 },
  { name: 'Lisa Park', count: 33, percentage: 28 },
]

export function DashboardPage() {
  const currentUser = useCurrentUser()
  const hasReportAccess = canViewReports(currentUser.role)

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
          <button className="btn btn--primary" type="button">
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
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
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
                {outcomeDistribution.map(({ outcome, count }) => (
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
                {repActivity.map((rep, i) => (
                  <div key={i} className="rep-activity__item">
                    <span className="rep-activity__name">{rep.name}</span>
                    <div className="rep-activity__bar">
                      <div
                        className="rep-activity__fill"
                        style={{ width: `${rep.percentage}%`, backgroundColor: 'var(--asg-color-accent-gold)' }}
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
              {recentActivity.map((activity, index) => (
                <tr key={index}>
                  <td><time>{activity.time}</time></td>
                  <td>{activity.rep}</td>
                  <td>{activity.action}</td>
                  <td>{activity.address}</td>
                  <td>
                    <span className={`badge badge--${outcomeBadgeVariant[activity.outcome]}`}>
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
