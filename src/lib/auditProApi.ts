import type { GitHubRepository } from '../types/github'
import { expectedManifest, type AuditEvidence, type CommunityEvidence, type EvidenceState, type ManifestEvidence,
  type RunEvidence, type WorkflowEvidence } from './auditPro'
import { validateRepositoryName } from './repositoryAudit'

const API = 'https://api.github.com'
const CACHE_MS = 8 * 60_000
const MAX_BASE64_SIZE = 110_000
const cache = new Map<string, AuditEvidence>()

type JsonResult = { ok: true; body: unknown } | { ok: false; missing: boolean; reason: string }
type AnyObject = Record<string, unknown>

function object(value: unknown): AnyObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyObject : null
}

function toKnownFile(files: AnyObject, name: string): boolean | null {
  if (!Object.prototype.hasOwnProperty.call(files, name)) return null
  if (files[name] === null) return false
  return object(files[name]) ? true : null
}

export function parseCommunity(input: unknown): CommunityEvidence {
  const root = object(input)
  const files = object(root?.files)
  if (!files) throw new Error('GitHub returned an unrecognized community profile.')
  return {
    readme: toKnownFile(files, 'readme'),
    contributing: toKnownFile(files, 'contributing'),
    license: toKnownFile(files, 'license'),
    codeOfConduct: toKnownFile(files, 'code_of_conduct'),
    issueTemplate: toKnownFile(files, 'issue_template'),
    pullTemplate: toKnownFile(files, 'pull_request_template'),
    security: toKnownFile(files, 'security'),
  }
}

export function parseWorkflows(input: unknown): WorkflowEvidence {
  const root = object(input)
  if (!root || !Array.isArray(root.workflows)) throw new Error('GitHub returned unexpected workflow data.')
  let active = 0
  let disabled = 0
  for (const workflow of root.workflows.slice(0, 100)) {
    const state = object(workflow)?.state
    if (state === 'active') active++
    else if (typeof state === 'string' && state.startsWith('disabled')) disabled++
  }
  const count = root.total_count
  return { total: typeof count === 'number' && Number.isFinite(count) && count >= 0 ? Math.trunc(count) : root.workflows.length,
    active, disabled }
}

function trustedGithubUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : ''
  } catch { return '' }
}

export function parseRuns(input: unknown): RunEvidence[] {
  const root = object(input)
  if (!root || !Array.isArray(root.workflow_runs)) throw new Error('GitHub returned unexpected workflow history.')
  const results = root.workflow_runs.slice(0, 10).flatMap(value => {
    const item = object(value)
    if (!item || typeof item.id !== 'number' || !Number.isFinite(item.id)) return []
    return [{ id: item.id, status: typeof item.status === 'string' ? item.status : 'unknown',
      conclusion: typeof item.conclusion === 'string' ? item.conclusion : null,
      htmlUrl: trustedGithubUrl(item.html_url), createdAt: typeof item.created_at === 'string' ? item.created_at : '' }]
  })
  if (results.length !== Math.min(10, root.workflow_runs.length)) throw new Error('GitHub returned incomplete workflow run records.')
  return results
}

export function decodeContents(input: unknown): string {
  const root = object(input)
  if (!root || root.encoding !== 'base64' || typeof root.content !== 'string') {
    throw new Error('GitHub did not provide inline base64 content for this file.')
  }
  const encoded = root.content.replace(/\s/g, '')
  if (encoded.length > MAX_BASE64_SIZE || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error('File contents were missing, too large or not valid base64.')
  }
  let bytes: Uint8Array
  try { bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)) }
  catch { throw new Error('Could not decode GitHub file contents.') }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

async function readJson(path: string, allowMissing: boolean, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<JsonResult> {
  let response: Response
  try {
    response = await fetcher(`${API}${path}`, { signal, headers: { Accept: 'application/vnd.github+json' } })
  } catch (reason) {
    if (signal?.aborted) throw reason
    return { ok: false, missing: false, reason: 'GitHub could not be reached. Check your connection.' }
  }
  if (response.status === 404 && allowMissing) return { ok: false, missing: true, reason: 'No file was found at the requested path.' }
  if (response.status === 403 || response.status === 429) return { ok: false, missing: false,
    reason: 'GitHub denied the public request or the API limit was reached. No absence is inferred.' }
  if (!response.ok) return { ok: false, missing: false, reason: `GitHub API returned HTTP ${response.status}.` }
  const length = Number(response.headers.get('content-length') || 0)
  if (length > 350_000) return { ok: false, missing: false, reason: 'GitHub response exceeded the inspection size limit.' }
  try { return { ok: true, body: await response.json() as unknown } }
  catch { return { ok: false, missing: false, reason: 'GitHub returned unreadable data.' } }
}

async function section<T>(path: string, allowMissing: boolean, parser: (value: unknown) => T,
  signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<EvidenceState<T>> {
  const result = await readJson(path, allowMissing, signal, fetcher)
  if (!result.ok) return result.missing ? { state: 'missing' } : { state: 'unavailable', reason: result.reason }
  try { return { state: 'available', value: parser(result.body) } }
  catch (reason) { return { state: 'unavailable', reason: reason instanceof Error ? reason.message : 'Unrecognized API response.' } }
}

/** Public GitHub API reads only. All requests are initiated by the visitor. No tokens or persistent collection. */
export async function fetchAuditEvidence(
  repository: GitHubRepository,
  signal?: AbortSignal,
  options: { fetcher?: typeof fetch; refresh?: boolean } = {},
): Promise<AuditEvidence> {
  const [owner, name] = validateRepositoryName(repository.full_name)
  const key = `${owner}/${name}`.toLowerCase()
  const saved = cache.get(key)
  if (!options.refresh && saved && Date.now() - saved.inspectedAt < CACHE_MS) return saved
  const fetcher = options.fetcher ?? fetch
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
  const manifestPath = expectedManifest(repository.language)
  const manifest = manifestPath ? section(`${repoPath}/contents/${encodeURIComponent(manifestPath)}`, true,
    value => ({ path: manifestPath, content: decodeContents(value) } satisfies ManifestEvidence), signal, fetcher) : null
  const [community, readme, workflows, runs, manifestResult] = await Promise.all([
    section(`${repoPath}/community/profile`, false, parseCommunity, signal, fetcher),
    section(`${repoPath}/readme`, true, decodeContents, signal, fetcher),
    section(`${repoPath}/actions/workflows?per_page=100`, false, parseWorkflows, signal, fetcher),
    section(`${repoPath}/actions/runs?per_page=10`, false, parseRuns, signal, fetcher),
    manifest,
  ])
  if (signal?.aborted) throw new Error('Repository evidence request was canceled.')
  const evidence: AuditEvidence = { community, readme, workflows, runs, manifest: manifestResult, inspectedAt: Date.now() }
  cache.delete(key)
  cache.set(key, evidence)
  if (cache.size > 24) cache.delete(cache.keys().next().value!)
  return evidence
}
