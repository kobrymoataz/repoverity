import type { GitHubRepository, GitHubSnapshot, GitHubUser } from '../types/github'

const API_ROOT = 'https://api.github.com'
const USERNAME_PATTERN = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/
const MAX_REPOS = 100

export type GithubErrorKind = 'invalid-name' | 'not-found' | 'rate-limited' | 'network' | 'unknown'

export class GithubApiError extends Error {
  constructor(
    public kind: GithubErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'GithubApiError'
  }
}

/** Accept a username, @username, or a link to the user's GitHub profile. */
export function normalizeUsername(input: string): string {
  let username = input.trim().replace(/^@/, '')
  if (/^https?:\/\//i.test(username)) {
    try {
      const url = new URL(username)
      if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
        throw new Error('Not GitHub')
      }
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length !== 1) throw new Error('Not a user profile')
      username = parts[0]
    } catch {
      throw new GithubApiError('invalid-name', 'Enter a GitHub username or profile URL.')
    }
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new GithubApiError('invalid-name', 'Enter a valid GitHub username (up to 39 letters, numbers or hyphens).')
  }
  return username
}

async function getJson<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_ROOT}${endpoint}`, {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new GithubApiError('network', 'Could not connect to GitHub. Check your connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new GithubApiError('not-found', 'No public GitHub account was found under this username.', 404)
    }
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
      throw new GithubApiError('rate-limited', 'GitHub API limit reached. Please try again later.', response.status)
    }
    throw new GithubApiError('unknown', `GitHub could not complete this request (HTTP ${response.status}).`, response.status)
  }
  return response.json() as Promise<T>
}

/** Uses public REST endpoints: no API key or login required. */
export async function fetchGitHubSnapshot(usernameInput: string, signal?: AbortSignal): Promise<GitHubSnapshot> {
  const username = normalizeUsername(usernameInput)
  const user = await getJson<GitHubUser>(`/users/${encodeURIComponent(username)}`, signal)
  // Only the 100 most recently updated owner repositories are analyzed in V0.1.
  const repositories = await getJson<GitHubRepository[]>(
    `/users/${encodeURIComponent(user.login)}/repos?type=owner&sort=updated&direction=desc&per_page=${MAX_REPOS}`,
    signal,
  )
  return { user, repositories, fetchedAt: Date.now() }
}

const SNAPSHOT_TTL_MS = 2 * 60 * 1000
const cache = new Map<string, GitHubSnapshot>()

export async function getCachedSnapshot(username: string, signal?: AbortSignal, refresh = false): Promise<GitHubSnapshot> {
  const clean = normalizeUsername(username)
  const key = clean.toLowerCase()
  const existing = cache.get(key)
  if (!refresh && existing && Date.now() - existing.fetchedAt < SNAPSHOT_TTL_MS) {
    return existing
  }
  const snapshot = await fetchGitHubSnapshot(clean, signal)
  cache.set(key, snapshot)
  return snapshot
}
