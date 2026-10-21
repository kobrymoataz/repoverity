import type { GitHubRepository, GitHubSnapshot } from '../types/github'

const DAY_MS = 86_400_000

export interface MonthlyPushBucket {
  key: string
  label: string
  count: number
}

export interface PortfolioAnalytics {
  login: string
  followers: number
  following: number
  publicRepositories: number
  sampleSize: number
  starsInSample: number
  forksInSample: number
  active30: number
  active90: number
  originalRepositories: number
  archivedRepositories: number
  coveragePercent: number
  buckets: MonthlyPushBucket[]
  languages: { name: string; count: number }[]
  mostStarred: GitHubRepository[]
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function pushTime(repository: GitHubRepository): number | null {
  if (!repository.pushed_at) return null
  const time = Date.parse(repository.pushed_at)
  return Number.isFinite(time) ? time : null
}

/** One repository contributes at most one observation: its most recent push date. */
export function lastPushDistribution(repositories: readonly GitHubRepository[], now = Date.now(), months = 6): MonthlyPushBucket[] {
  const safeMonths = Math.max(1, Math.min(12, Math.trunc(months) || 6))
  const reference = new Date(now)
  const lastMonth = reference.getUTCFullYear() * 12 + reference.getUTCMonth()
  const startMonth = lastMonth - safeMonths + 1
  const buckets = Array.from({ length: safeMonths }, (_, index) => {
    const month = startMonth + index
    const date = new Date(Date.UTC(Math.floor(month / 12), month % 12, 1))
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      count: 0,
    }
  })
  if (!Number.isFinite(now)) return buckets
  for (const repository of repositories) {
    const time = pushTime(repository)
    if (time === null || time > now) continue
    const date = new Date(time)
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth()
    const index = month - startMonth
    if (index >= 0 && index < buckets.length) buckets[index].count += 1
  }
  return buckets
}

export function portfolioAnalytics(snapshot: GitHubSnapshot, now = Date.now()): PortfolioAnalytics {
  const { user, repositories } = snapshot
  const source = repositories.filter(repo => !repo.fork)
  const isActive = (repo: GitHubRepository, days: number) => {
    const time = pushTime(repo)
    return time !== null && time <= now && time >= now - days * DAY_MS
  }
  const languageCounts = new Map<string, number>()
  for (const repo of repositories) {
    if (repo.language) languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1)
  }
  const total = count(user.public_repos)
  return {
    login: user.login,
    followers: count(user.followers),
    following: count(user.following),
    publicRepositories: total,
    sampleSize: repositories.length,
    starsInSample: repositories.reduce((sum, repo) => sum + count(repo.stargazers_count), 0),
    forksInSample: repositories.reduce((sum, repo) => sum + count(repo.forks_count), 0),
    active30: repositories.filter(repo => isActive(repo, 30)).length,
    active90: repositories.filter(repo => isActive(repo, 90)).length,
    originalRepositories: source.length,
    archivedRepositories: repositories.filter(repo => repo.archived).length,
    coveragePercent: total === 0 ? 0 : Math.min(100, Math.round(100 * repositories.length / total)),
    buckets: lastPushDistribution(repositories, now),
    languages: [...languageCounts].map(([name, value]) => ({ name, count: value }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6),
    mostStarred: [...source].sort((a, b) => count(b.stargazers_count) - count(a.stargazers_count) || a.name.localeCompare(b.name)).slice(0, 5),
  }
}

/** CSV protection for importing reports into spreadsheet applications. */
export function analyticsCsvCell(value: string | number): string {
  let input = String(value)
  if (/^[\s\t\r\n]*[=+@-]/.test(input)) input = `'${input}`
  return `"${input.replace(/"/g, '""')}"`
}

export function portfolioAnalyticsCsv(data: PortfolioAnalytics): string {
  const metrics: [string, string | number][] = [
    ['GitHub username', data.login],
    ['Followers (GitHub account)', data.followers],
    ['Following (GitHub account)', data.following],
    ['Public repositories (GitHub account)', data.publicRepositories],
    ['Repositories loaded (sample)', data.sampleSize],
    ['Sample coverage percent', data.coveragePercent],
    ['Stars (sample only)', data.starsInSample],
    ['Forks (sample only)', data.forksInSample],
    ['Active in last 30 days (sample only)', data.active30],
    ['Active in last 90 days (sample only)', data.active90],
  ]
  for (const item of data.buckets) metrics.push([`Most recent push in ${item.key} (sample only)`, item.count])
  return [['Metric', 'Value'], ...metrics]
    .map(row => row.map(analyticsCsvCell).join(',')).join('\r\n') + '\r\n'
}

export interface ContributorSummary { login: string; contributions: number; html_url: string; avatar_url: string }
export interface ReleaseSummary { id: number; tag_name: string; name: string; published_at: string; html_url: string; prerelease: boolean }
export interface IssueSummary { number: number; title: string; html_url: string; state: string; updated_at: string }
export interface PullSummary extends IssueSummary { merged_at: string | null }

export interface PublicActivitySample {
  contributors: ContributorSummary[] | null
  releases: ReleaseSummary[] | null
  issues: IssueSummary[] | null
  pulls: PullSummary[] | null
  failures: Partial<Record<'contributors' | 'releases' | 'issues' | 'pulls', string>>
  inspectedAt: number
}

export function publishedReleaseIntervalDays(releases: readonly ReleaseSummary[]): number | null {
  const times = releases.filter(r => !r.prerelease).map(r => Date.parse(r.published_at))
    .filter(Number.isFinite).sort((a, b) => b - a)
  if (times.length < 2) return null
  const gaps = times.slice(1).map((time, index) => (times[index] - time) / DAY_MS)
    .filter(gap => gap >= 0).sort((a, b) => a - b)
  if (gaps.length === 0) return null
  const center = Math.floor(gaps.length / 2)
  return Math.round(gaps.length % 2 === 1 ? gaps[center] : (gaps[center - 1] + gaps[center]) / 2)
}
