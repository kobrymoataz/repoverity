/** Read-only discovery of real public GitHub Issues. No engagement automation. */
export type IssueLabel = 'good-first-issue' | 'help-wanted'
export type IssueLanguage = 'all' | 'TypeScript' | 'JavaScript' | 'Python' | 'Java' | 'Go' | 'Rust' | 'PHP'

export interface IssueSearchFilters {
  label: IssueLabel
  language: IssueLanguage
  keywords: string
}

export interface ContributionIssue {
  id: number
  title: string
  url: string
  repo: string
  number: number
  updatedAt: string
  comments: number
  labels: string[]
}

export interface ContributionSearchResult {
  total: number
  incomplete: boolean
  issues: ContributionIssue[]
  searchedAt: number
  query: string
}

export const DEFAULT_ISSUE_FILTERS: IssueSearchFilters = {
  label: 'good-first-issue', language: 'TypeScript', keywords: '',
}

const LANGUAGES: readonly IssueLanguage[] = ['all', 'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'PHP']
const LABELS: readonly IssueLabel[] = ['good-first-issue', 'help-wanted']
const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, ContributionSearchResult>()

export class ContributionSearchError extends Error {
  constructor(public kind: 'rate-limited' | 'network' | 'invalid-query' | 'other', message: string) {
    super(message)
    this.name = 'ContributionSearchError'
  }
}

function cleanKeywords(input: string): string {
  // Bound and escape free-text so user input cannot supply search operators.
  return input.replace(/[^\p{L}\p{N} ._-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 64).trim()
}

export function createIssueSearchQuery(filters: IssueSearchFilters): string {
  if (!LABELS.includes(filters.label) || !LANGUAGES.includes(filters.language)) {
    throw new ContributionSearchError('invalid-query', 'Choose a valid language and issue category.')
  }
  const parts = [
    'is:issue', 'is:open', 'archived:false', 'no:assignee',
    filters.label === 'good-first-issue' ? 'label:"good first issue"' : 'label:"help wanted"',
  ]
  if (filters.language !== 'all') parts.push(`language:${filters.language.toLowerCase()}`)
  const keywords = cleanKeywords(filters.keywords)
  if (keywords) parts.push(`"${keywords}" in:title`)
  return parts.join(' ')
}

export function buildGithubIssueSearchUrl(filters: IssueSearchFilters): string {
  const url = new URL('https://github.com/search')
  url.searchParams.set('q', createIssueSearchQuery(filters))
  url.searchParams.set('type', 'issues')
  return url.toString()
}

/** Rejects PRs and URLs outside GitHub instead of blindly trusting API payloads. */
export function normalizeContributionIssue(value: unknown): ContributionIssue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (item.pull_request || item.state !== 'open' || typeof item.title !== 'string'
    || !Number.isSafeInteger(item.id) || typeof item.html_url !== 'string') return null
  try {
    const url = new URL(item.html_url)
    const match = url.pathname.match(/^\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/issues\/(\d+)\/?$/)
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !match
      || url.search || url.hash || item.title.length > 400) return null
    const number = Number(match[3])
    if (!Number.isSafeInteger(number) || number < 1) return null
    const labels = Array.isArray(item.labels) ? item.labels.flatMap(label => {
      const candidate = label && typeof label === 'object' ? (label as { name?: unknown }).name : null
      return typeof candidate === 'string' ? [candidate.slice(0, 80)] : []
    }).slice(0, 5) : []
    const updatedAt = typeof item.updated_at === 'string' && Number.isFinite(Date.parse(item.updated_at))
      ? item.updated_at : ''
    return {
      id: item.id as number,
      title: item.title.trim(),
      url: url.toString(),
      repo: `${match[1]}/${match[2]}`,
      number,
      updatedAt,
      comments: typeof item.comments === 'number' && Number.isSafeInteger(item.comments) && item.comments >= 0 ? item.comments : 0,
      labels,
    }
  } catch { return null }
}

export async function findContributionIssues(filters: IssueSearchFilters, signal?: AbortSignal): Promise<ContributionSearchResult> {
  const query = createIssueSearchQuery(filters)
  const cached = cache.get(query)
  if (cached && Date.now() - cached.searchedAt < TTL_MS) return cached

  const url = new URL('https://api.github.com/search/issues')
  url.searchParams.set('q', query)
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', '18')

  let response: Response
  try {
    response = await fetch(url.toString(), { signal, headers: { Accept: 'application/vnd.github+json' } })
  } catch (reason) {
    if (signal?.aborted) throw reason
    throw new ContributionSearchError('network', 'Could not connect to GitHub. Please check your connection.')
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new ContributionSearchError('rate-limited', 'GitHub search is temporarily rate-limited. Wait a minute or open the search directly on GitHub.')
    }
    if (response.status === 422) {
      throw new ContributionSearchError('invalid-query', 'GitHub did not accept this search. Try simpler keywords.')
    }
    throw new ContributionSearchError('other', `GitHub search failed (HTTP ${response.status}).`)
  }

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ContributionSearchError('other', 'GitHub returned an unexpected response.')
  }
  const data = payload as { items?: unknown; total_count?: unknown; incomplete_results?: unknown }
  if (!Array.isArray(data.items)) {
    throw new ContributionSearchError('other', 'GitHub returned an unexpected issue list.')
  }
  const found = data.items.map(normalizeContributionIssue).filter((issue): issue is ContributionIssue => Boolean(issue))
  const total = typeof data.total_count === 'number' && Number.isSafeInteger(data.total_count) && data.total_count >= 0
    ? data.total_count : found.length
  const result: ContributionSearchResult = {
    total, incomplete: data.incomplete_results === true, issues: found,
    searchedAt: Date.now(), query,
  }
  cache.set(query, result)
  if (cache.size > 30) cache.delete(cache.keys().next().value!)
  return result
}
