import { normalizeRepository, type MaintainerContributor, type MaintainerIssue, type MaintainerKind } from './maintainer'

export type MaintainerPage = { items: MaintainerIssue[]; hasMore: boolean; page: number }
export type MaintainerOverview = {
  issues: MaintainerPage | null
  pulls: MaintainerPage | null
  contributors: MaintainerContributor[] | null
  errors: { issues?: string; pulls?: string; contributors?: string }
}
const PER_PAGE = 40
export const MAX_API_PAGES = 3
export class MaintainerApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'MaintainerApiError' }
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function count(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0 }
function names(value: unknown): string[] {
  return Array.isArray(value) ? value.slice(0, 15).map(x => text(object(x)?.name ?? object(x)?.login)).filter(Boolean) : []
}
function itemFromApi(raw: unknown, kind: MaintainerKind): MaintainerIssue | null {
  const x = object(raw)
  if (!x || !Number.isSafeInteger(x.number) || Number(x.number) < 1 ||
    !/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+$/.test(text(x.html_url))) return null
  const author = object(x.user)
  return {
    kind, number: Number(x.number), title: text(x.title).slice(0, 350), url: text(x.html_url),
    author: text(author?.login), updated_at: text(x.updated_at), created_at: text(x.created_at),
    comments: count(x.comments), labels: names(x.labels), assignees: names(x.assignees),
    draft: kind === 'pull' && x.draft === true,
  }
}
async function api(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal, cache: 'no-store',
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new MaintainerApiError('GitHub could not be reached.', 503)
  }
  if (response.status === 403 || response.status === 429) throw new MaintainerApiError('GitHub API rate limit or access restriction. Try again later.', response.status)
  if (response.status === 404) throw new MaintainerApiError('Public repository not found.', 404)
  if (!response.ok) throw new MaintainerApiError('GitHub could not load this resource.', response.status)
  try {
    const value: unknown = await response.json()
    if (!Array.isArray(value)) throw new Error('Expected an array')
    return value
  } catch { throw new MaintainerApiError('GitHub returned an unexpected response.', 502) }
}
export async function loadMaintainerPage(repoInput: string, kind: MaintainerKind, page: number, signal?: AbortSignal): Promise<MaintainerPage> {
  const repo = normalizeRepository(repoInput)
  if (!repo || !Number.isInteger(page) || page < 1 || page > MAX_API_PAGES) throw new MaintainerApiError('Invalid repository or page.', 400)
  const route = kind === 'issue' ? 'issues' : 'pulls'
  const raw = await api(`/repos/${repo}/${route}?state=open&sort=updated&direction=desc&per_page=${PER_PAGE}&page=${page}`, signal) as unknown[]
  return { items: raw.filter(x => kind === 'pull' || !object(x)?.pull_request).map(x => itemFromApi(x, kind)).filter((x): x is MaintainerIssue => x !== null), hasMore: raw.length === PER_PAGE && page < MAX_API_PAGES, page }
}
export async function loadMaintainerContributors(repoInput: string, signal?: AbortSignal): Promise<MaintainerContributor[]> {
  const repo = normalizeRepository(repoInput)
  if (!repo) throw new MaintainerApiError('Invalid repository.', 400)
  const raw = await api(`/repos/${repo}/contributors?per_page=40&page=1`, signal) as unknown[]
  return raw.map(item => {
    const x = object(item)
    if (!x || !text(x.login) || !/^https:\/\/github\.com\//.test(text(x.html_url))) return null
    return { login: text(x.login), url: text(x.html_url), avatar_url: text(x.avatar_url), contributions: count(x.contributions) }
  }).filter((item): item is MaintainerContributor => item !== null)
}
export async function loadMaintainerOverview(repo: string, signal?: AbortSignal): Promise<MaintainerOverview> {
  const results = await Promise.allSettled([
    loadMaintainerPage(repo, 'issue', 1, signal),
    loadMaintainerPage(repo, 'pull', 1, signal),
    loadMaintainerContributors(repo, signal),
  ])
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const reason = (index: number): string => {
    const result = results[index]
    return result.status === 'rejected'
      ? result.reason instanceof Error ? result.reason.message : 'Request failed.'
      : ''
  }
  return {
    issues: results[0].status === 'fulfilled' ? results[0].value : null,
    pulls: results[1].status === 'fulfilled' ? results[1].value : null,
    contributors: results[2].status === 'fulfilled' ? results[2].value : null,
    errors: { issues: reason(0) || undefined, pulls: reason(1) || undefined, contributors: reason(2) || undefined },
  }
}
