import type { GitHubRepository } from '../types/github'
import { normalizeUsername } from './github'

export const REPOSITORY_PAGE_SIZE = 100

export type RepositoryPageErrorKind = 'rate-limit' | 'network' | 'response'

export class RepositoryPageError extends Error {
  constructor(public kind: RepositoryPageErrorKind, message: string) {
    super(message)
    this.name = 'RepositoryPageError'
  }
}

export interface RepositoryPageState {
  repositories: GitHubRepository[]
  nextPage: number
  hasMore: boolean
  pagesLoaded: number
  message: string | null
}

export function firstRepositoryPage(repositories: readonly GitHubRepository[]): RepositoryPageState {
  return {
    repositories: [...repositories],
    nextPage: 2,
    hasMore: repositories.length === REPOSITORY_PAGE_SIZE,
    pagesLoaded: 1,
    message: null,
  }
}

export function appendRepositoryPage(
  previous: RepositoryPageState,
  nextPage: readonly GitHubRepository[],
): RepositoryPageState {
  const byId = new Map(previous.repositories.map(repo => [repo.id, repo]))
  for (const repo of nextPage) if (!byId.has(repo.id)) byId.set(repo.id, repo)
  const newCount = byId.size - previous.repositories.length
  return {
    repositories: [...byId.values()],
    nextPage: previous.nextPage + 1,
    pagesLoaded: previous.pagesLoaded + 1,
    hasMore: nextPage.length === REPOSITORY_PAGE_SIZE && newCount > 0,
    message: newCount === 0 && nextPage.length > 0
      ? 'GitHub returned only repositories that were already loaded. Refresh the account to restart pagination.'
      : null,
  }
}

/** Additional pages are fetched only when the user requests them. No token is stored. */
export async function fetchRepositoryPage(
  usernameInput: string,
  page: number,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<GitHubRepository[]> {
  const username = normalizeUsername(usernameInput)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) {
    throw new RepositoryPageError('response', 'Invalid repository page.')
  }
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=${REPOSITORY_PAGE_SIZE}&page=${page}`
  let response: Response
  try {
    response = await fetcher(url, { signal, headers: { Accept: 'application/vnd.github+json' } })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new RepositoryPageError('network', 'Could not load more repositories. Check your connection and retry.')
  }
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    throw new RepositoryPageError('rate-limit', 'GitHub API limit reached. Try again after the limit resets.')
  }
  if (!response.ok) {
    throw new RepositoryPageError('response', `GitHub could not load this page (HTTP ${response.status}).`)
  }
  let payload: unknown
  try { payload = await response.json() } catch {
    throw new RepositoryPageError('response', 'GitHub returned an unreadable repository response.')
  }
  if (!Array.isArray(payload) || payload.length > REPOSITORY_PAGE_SIZE ||
    payload.some(repo => !repo || typeof repo !== 'object' ||
      !Number.isSafeInteger(repo.id) || typeof repo.name !== 'string' ||
      typeof repo.full_name !== 'string' || typeof repo.html_url !== 'string' ||
      !Array.isArray(repo.topics))) {
    throw new RepositoryPageError('response', 'GitHub returned an unexpected repository format.')
  }
  return payload as GitHubRepository[]
}
