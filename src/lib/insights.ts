import type { GitHubRepository } from '../types/github'

export type RepositorySort = 'stars' | 'recent' | 'forks'
export type RepositoryFilter = 'all' | 'starred' | 'active'

export interface Signal {
  label: string
  value: number
  count: number
  detail: string
}

export interface DashboardInsights {
  stars: number
  forks: number
  active90Days: number
  languages: { name: string; count: number; percent: number }[]
  signals: Signal[]
}

const DAY = 24 * 60 * 60 * 1000

export function activeWithinDays(repo: GitHubRepository, days: number, now = Date.now()): boolean {
  if (!repo.pushed_at) return false
  const pushed = Date.parse(repo.pushed_at)
  return Number.isFinite(pushed) && pushed <= now && pushed >= now - days * DAY
}

export function percentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

export function calculateInsights(repositories: GitHubRepository[], now = Date.now()): DashboardInsights {
  const total = repositories.length
  const countByLanguage = new Map<string, number>()
  for (const repo of repositories) {
    const language = repo.language || 'Unspecified'
    countByLanguage.set(language, (countByLanguage.get(language) ?? 0) + 1)
  }
  const languages = [...countByLanguage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, percent: percentage(count, total) }))

  const withDescription = repositories.filter(repo => Boolean(repo.description?.trim())).length
  const withTopics = repositories.filter(repo => repo.topics.length > 0).length
  const withLicense = repositories.filter(repo => Boolean(repo.license)).length
  const active90Days = repositories.filter(repo => activeWithinDays(repo, 90, now)).length

  return {
    stars: repositories.reduce((total, repo) => total + repo.stargazers_count, 0),
    forks: repositories.reduce((total, repo) => total + repo.forks_count, 0),
    active90Days,
    languages,
    signals: [
      { label: 'Descriptions', value: percentage(withDescription, total), count: withDescription, detail: 'Repos with a description' },
      { label: 'Topics added', value: percentage(withTopics, total), count: withTopics, detail: 'Repos with discovery tags' },
      { label: 'Licenses', value: percentage(withLicense, total), count: withLicense, detail: 'Repos with license metadata' },
      { label: 'Active in 90 days', value: percentage(active90Days, total), count: active90Days, detail: 'Repos with recent pushes' },
    ],
  }
}

export function filterRepositories(
  repositories: GitHubRepository[],
  search: string,
  filter: RepositoryFilter,
  sort: RepositorySort,
  now = Date.now(),
): GitHubRepository[] {
  const query = search.toLowerCase().trim()
  return repositories
    .filter(repo => {
      if (filter === 'starred' && repo.stargazers_count < 1) return false
      if (filter === 'active' && !activeWithinDays(repo, 90, now)) return false
      if (!query) return true
      return [repo.name, repo.description || '', repo.language || '', ...repo.topics]
        .some(text => text.toLowerCase().includes(query))
    })
    .sort((a, b) => {
      const result = sort === 'forks'
        ? b.forks_count - a.forks_count
        : sort === 'stars'
          ? b.stargazers_count - a.stargazers_count
          : Date.parse(b.pushed_at || b.updated_at) - Date.parse(a.pushed_at || a.updated_at)
      return result || a.name.localeCompare(b.name)
    })
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return 'N/A'
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function shortDate(date: string | null): string {
  if (!date) return 'No activity'
  const parsed = Date.parse(date)
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed)
    : 'Unknown'
}
