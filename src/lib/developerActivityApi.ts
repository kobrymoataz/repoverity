import type { PublicActivitySample, ContributorSummary, ReleaseSummary, IssueSummary, PullSummary } from './developerAnalytics'

export type ActivitySection = 'contributors' | 'releases' | 'issues' | 'pulls'
export const ACTIVITY_PAGE_LIMITS: Record<ActivitySection, number> = {
  contributors: 20, releases: 15, issues: 30, pulls: 30,
}
const CACHE_TTL_MS = 5 * 60_000
const cache = new Map<string, PublicActivitySample>()

export function publicRepositoryPath(fullName: string): string {
  const parts = fullName.split('/')
  if (parts.length !== 2 || !/^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/.test(parts[0]) ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(parts[1]) || parts[1] === '.' || parts[1] === '..') {
    throw new Error('Select a valid GitHub repository.')
  }
  return parts.map(encodeURIComponent).join('/')
}

function gitHubUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : ''
  } catch { return '' }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0
}

function parseContributors(values: unknown[]): ContributorSummary[] {
  return values.flatMap(value => {
    const item = record(value)
    if (!item || typeof item.login !== 'string' || !item.login || !gitHubUrl(item.html_url)) return []
    return [{ login: item.login, contributions: positive(item.contributions), html_url: gitHubUrl(item.html_url),
      avatar_url: typeof item.avatar_url === 'string' && item.avatar_url.startsWith('https://avatars.githubusercontent.com/') ? item.avatar_url : '' }]
  })
}

function parseReleases(values: unknown[]): ReleaseSummary[] {
  return values.flatMap(value => {
    const item = record(value)
    if (!item || typeof item.tag_name !== 'string' || typeof item.published_at !== 'string' ||
      !Number.isFinite(Date.parse(item.published_at)) || !gitHubUrl(item.html_url)) return []
    return [{ id: positive(item.id), tag_name: item.tag_name.slice(0, 120),
      name: typeof item.name === 'string' ? item.name.slice(0, 200) : item.tag_name,
      published_at: item.published_at, html_url: gitHubUrl(item.html_url), prerelease: item.prerelease === true }]
  })
}

function parseIssues(values: unknown[]): IssueSummary[] {
  return values.flatMap(value => {
    const item = record(value)
    if (!item || item.pull_request || typeof item.title !== 'string' || !gitHubUrl(item.html_url)) return []
    return [{ number: positive(item.number), title: item.title.slice(0, 300), html_url: gitHubUrl(item.html_url),
      state: item.state === 'open' ? 'open' : 'closed', updated_at: typeof item.updated_at === 'string' ? item.updated_at : '' }]
  })
}

function parsePulls(values: unknown[]): PullSummary[] {
  return values.flatMap(value => {
    const item = record(value)
    if (!item || typeof item.title !== 'string' || !gitHubUrl(item.html_url)) return []
    return [{ number: positive(item.number), title: item.title.slice(0, 300), html_url: gitHubUrl(item.html_url),
      state: item.state === 'open' ? 'open' : 'closed', updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
      merged_at: typeof item.merged_at === 'string' ? item.merged_at : null }]
  })
}

async function readEndpoint(path: string, endpoint: ActivitySection, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<unknown[]> {
  const perPage = ACTIVITY_PAGE_LIMITS[endpoint]
  const query = endpoint === 'issues' || endpoint === 'pulls'
    ? `?state=all&sort=updated&direction=desc&per_page=${perPage}` : `?per_page=${perPage}`
  let response: Response
  try {
    response = await fetcher(`https://api.github.com/repos/${path}/${endpoint}${query}`, {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new Error('Network unavailable. Check your connection and try again.')
  }
  if (response.status === 202) throw new Error('GitHub is preparing these statistics. Try again shortly.')
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    throw new Error('GitHub API rate limit reached. Retry after the limit resets.')
  }
  if (!response.ok) throw new Error(`GitHub could not load ${endpoint} (HTTP ${response.status}).`)
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error(`GitHub returned invalid ${endpoint} data.`) }
  if (!Array.isArray(payload) || payload.length > perPage) throw new Error(`Unexpected ${endpoint} response from GitHub.`)
  return payload
}

/** Four independent public requests, triggered only by an explicit user action. */
export async function fetchPublicActivity(
  repository: string, signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<PublicActivitySample> {
  const path = publicRepositoryPath(repository)
  const sections: ActivitySection[] = ['contributors', 'releases', 'issues', 'pulls']
  const result = await Promise.allSettled(sections.map(section => readEndpoint(path, section, signal, fetcher)))
  if (signal?.aborted) throw new Error('Activity request was canceled.')
  const sample: PublicActivitySample = {
    contributors: null, releases: null, issues: null, pulls: null, failures: {}, inspectedAt: Date.now(),
  }
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index]
    const response = result[index]
    if (response.status === 'rejected') {
      sample.failures[section] = response.reason instanceof Error ? response.reason.message : `Unable to load ${section}.`
      continue
    }
    if (section === 'contributors') sample.contributors = parseContributors(response.value)
    if (section === 'releases') sample.releases = parseReleases(response.value)
    if (section === 'issues') sample.issues = parseIssues(response.value)
    if (section === 'pulls') sample.pulls = parsePulls(response.value)
  }
  return sample
}

/** Bounded, memory-only caching to avoid repetitive unauthenticated API calls. */
export async function getPublicActivity(
  repository: string, signal?: AbortSignal, forceRefresh = false, fetcher: typeof fetch = fetch,
): Promise<PublicActivitySample> {
  const key = publicRepositoryPath(repository).toLowerCase()
  const existing = cache.get(key)
  if (!forceRefresh && existing && Date.now() - existing.inspectedAt < CACHE_TTL_MS) return existing
  const sample = await fetchPublicActivity(repository, signal, fetcher)
  if (Object.keys(sample.failures).length < 4 && !signal?.aborted) {
    cache.delete(key)
    cache.set(key, sample)
    if (cache.size > 20) cache.delete(cache.keys().next().value!)
  }
  return sample
}
