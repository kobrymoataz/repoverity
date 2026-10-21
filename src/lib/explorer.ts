import type { GitHubRepository } from '../types/github'

export type ExplorerStatus = 'all' | 'source' | 'fork' | 'active' | 'archived'
export type ExplorerSort = 'updated' | 'stars' | 'forks' | 'name'
export type ExplorerLayout = 'table' | 'cards'

export interface ExplorerFilters {
  search: string
  language: string
  topic: string
  status: ExplorerStatus
  sort: ExplorerSort
}

export const DEFAULT_EXPLORER_FILTERS: ExplorerFilters = {
  search: '', language: 'all', topic: 'all', status: 'all', sort: 'updated',
}

export const EXPLORER_STORAGE_KEY = 'repoverity:explorer-views:v1'
export const MAX_SAVED_VIEWS_PER_PROFILE = 12

export interface SavedExplorerView {
  id: string
  owner: string
  label: string
  filters: ExplorerFilters
}

const statusValues: readonly string[] = ['all', 'source', 'fork', 'active', 'archived']
const sortValues: readonly string[] = ['updated', 'stars', 'forks', 'name']
const DAY = 86_400_000

export function filterExplorerRepositories(
  repositories: readonly GitHubRepository[],
  filters: ExplorerFilters,
  now = Date.now(),
): GitHubRepository[] {
  const query = filters.search.trim().toLocaleLowerCase('en')
  const language = filters.language.toLocaleLowerCase('en')
  const topic = filters.topic.toLocaleLowerCase('en')
  const filtered = repositories.filter(repo => {
    if (language !== 'all' && (repo.language || 'Unspecified').toLocaleLowerCase('en') !== language) return false
    if (topic !== 'all' && !repo.topics.some(t => t.toLocaleLowerCase('en') === topic)) return false
    if (filters.status === 'source' && repo.fork) return false
    if (filters.status === 'fork' && !repo.fork) return false
    if (filters.status === 'archived' && !repo.archived) return false
    if (filters.status === 'active') {
      if (repo.archived || !repo.pushed_at) return false
      const lastPush = Date.parse(repo.pushed_at)
      if (!Number.isFinite(lastPush) || lastPush > now || lastPush < now - 90 * DAY) return false
    }
    if (!query) return true
    return [repo.name, repo.full_name, repo.description || '', repo.language || '', ...repo.topics]
      .some(value => value.toLocaleLowerCase('en').includes(query))
  })

  return filtered.sort((a, b) => {
    const primary = filters.sort === 'stars' ? b.stargazers_count - a.stargazers_count
      : filters.sort === 'forks' ? b.forks_count - a.forks_count
        : filters.sort === 'name' ? a.name.localeCompare(b.name)
          : timestamp(b.pushed_at) - timestamp(a.pushed_at)
    return primary || a.full_name.localeCompare(b.full_name)
  })
}

function timestamp(value: string | null): number {
  if (!value) return 0
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : 0
}

export function availableLanguages(repositories: readonly GitHubRepository[]): string[] {
  return [...new Set(repositories.map(repo => repo.language || 'Unspecified'))].sort((a, b) => a.localeCompare(b))
}

export function availableTopics(repositories: readonly GitHubRepository[]): string[] {
  const frequencies = new Map<string, number>()
  for (const repo of repositories) for (const topic of repo.topics) {
    frequencies.set(topic, (frequencies.get(topic) || 0) + 1)
  }
  return [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([topic]) => topic)
}

function validFilters(input: unknown): input is ExplorerFilters {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const x = input as Record<string, unknown>
  return typeof x.search === 'string' && x.search.length <= 200
    && typeof x.language === 'string' && x.language.length <= 100
    && typeof x.topic === 'string' && x.topic.length <= 100
    && typeof x.status === 'string' && statusValues.includes(x.status)
    && typeof x.sort === 'string' && sortValues.includes(x.sort)
}

export function parseSavedViews(raw: string | null): SavedExplorerView[] {
  if (!raw || raw.length > 50_000) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is SavedExplorerView => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
      const x = entry as Record<string, unknown>
      return typeof x.id === 'string' && x.id.length <= 80 && x.id.length > 0
        && typeof x.owner === 'string' && /^[a-z0-9-]{1,39}$/i.test(x.owner)
        && typeof x.label === 'string' && x.label.trim().length > 0 && x.label.length <= 50
        && validFilters(x.filters)
    }).slice(0, 100)
  } catch { return [] }
}

export function storeSavedView(existing: readonly SavedExplorerView[], view: SavedExplorerView): SavedExplorerView[] {
  const profile = view.owner.toLowerCase()
  const sameProfile = existing.filter(v => v.owner.toLowerCase() === profile && v.id !== view.id)
  const otherProfiles = existing.filter(v => v.owner.toLowerCase() !== profile)
  return [...otherProfiles, ...sameProfile.slice(-MAX_SAVED_VIEWS_PER_PROFILE + 1), view].slice(-100)
}

export function removeSavedView(existing: readonly SavedExplorerView[], id: string, owner: string): SavedExplorerView[] {
  return existing.filter(v => v.id !== id || v.owner.toLowerCase() !== owner.toLowerCase())
}

export function buildComparison(repositories: readonly GitHubRepository[], selectedIds: readonly number[]): GitHubRepository[] {
  const ids = [...new Set(selectedIds)].slice(0, 3)
  return ids.flatMap(id => {
    const found = repositories.find(repo => repo.id === id)
    return found ? [found] : []
  })
}

// Spreadsheet apps can interpret certain cell prefixes as formulas.
// Prefix unsafe cells with an apostrophe before CSV quoting.
function safeCsvCell(value: string | number | null): string {
  let text = String(value ?? '')
  if (/^[\s\t\r\n]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function explorerCsv(repositories: readonly GitHubRepository[]): string {
  const columns = ['Repository', 'Description', 'Language', 'Stars', 'Forks', 'Topics', 'Last push', 'URL']
  const rows = repositories.map(repo => [repo.full_name, repo.description || '', repo.language || '',
    repo.stargazers_count, repo.forks_count, repo.topics.join('; '), repo.pushed_at || '', repo.html_url])
  return [columns, ...rows].map(row => row.map(safeCsvCell).join(',')).join('\r\n') + '\r\n'
}
