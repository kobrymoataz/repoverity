import type { RepositoryAction } from './advisor'

/** Read-only check of public directory listings. Presence never proves a workflow ran or that a project is secure. */
export interface FileEvidence {
  id: 'readme' | 'license' | 'contributing' | 'security' | 'conduct' | 'ci' | 'dependabot' | 'changelog' | 'gitignore'
  title: string
  present: boolean
  detail: string
}

export interface RepositoryInspection {
  repository: string
  inspectedAt: number
  evidence: FileEvidence[]
  source: 'public GitHub Contents API'
}

export class RepositoryInspectionError extends Error {
  constructor(public kind: 'invalid-repo' | 'rate-limited' | 'not-found' | 'network' | 'other', message: string) {
    super(message)
    this.name = 'RepositoryInspectionError'
  }
}

const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, RepositoryInspection>()

type Entry = { name: string; type: 'file' | 'dir' }

export function validateRepositoryName(value: string): [string, string] {
  const match = /^([a-zA-Z0-9-]{1,39})\/([a-zA-Z0-9_.-]{1,100})$/.exec(value)
  if (!match || match[1].startsWith('-') || match[1].endsWith('-') || match[2] === '.' || match[2] === '..') {
    throw new RepositoryInspectionError('invalid-repo', 'Select a valid public GitHub repository.')
  }
  return [match[1], match[2]]
}

function normalizedEntries(payload: unknown): Entry[] {
  if (!Array.isArray(payload)) throw new RepositoryInspectionError('other', 'GitHub returned an unexpected directory listing.')
  return payload.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const entry = item as Record<string, unknown>
    return typeof entry.name === 'string' && (entry.type === 'file' || entry.type === 'dir')
      ? [{ name: entry.name, type: entry.type }] : []
  })
}

export function directoryEvidence(root: Entry[], github: Entry[], workflows: Entry[], docs: Entry[]): FileEvidence[] {
  const file = (entries: Entry[], pattern: RegExp) => entries.some(entry => entry.type === 'file' && pattern.test(entry.name))
  const dir = (entries: Entry[], name: string) => entries.some(entry => entry.type === 'dir' && entry.name.toLowerCase() === name)
  const readme = file(root, /^readme(?:\.(?:md|markdown|rst|txt))?$/i)
  const license = file(root, /^(?:licen[sc]e|copying)(?:\.(?:md|txt|rst))?$/i)
  const contributing = file(root, /^contributing(?:\.(?:md|txt|rst))?$/i) || file(github, /^contributing(?:\.(?:md|txt|rst))?$/i)
  const security = file(root, /^security\.md$/i) || file(github, /^security\.md$/i) || file(docs, /^security\.md$/i)
  const conduct = file(root, /^code_of_conduct\.md$/i) || file(github, /^code_of_conduct\.md$/i)
  const ci = workflows.some(entry => entry.type === 'file' && /\.ya?ml$/i.test(entry.name))
    || file(root, /^(?:\.travis\.yml|azure-pipelines\.ya?ml|\.gitlab-ci\.yml|Jenkinsfile)$/i)
    || dir(root, '.circleci')
  const dependabot = file(github, /^dependabot\.ya?ml$/i)
  const changelog = file(root, /^(?:changelog|changes|history)(?:\.(?:md|txt|rst))?$/i)
  const gitignore = file(root, /^\.gitignore$/i)
  return [
    { id: 'readme', title: 'README file', present: readme, detail: 'Recognized README in the repository root' },
    { id: 'license', title: 'License file', present: license, detail: 'Common license or COPYING file in the root; no legal validation' },
    { id: 'contributing', title: 'Contribution guide', present: contributing, detail: 'CONTRIBUTING file in root or .github' },
    { id: 'security', title: 'Security policy', present: security, detail: 'SECURITY.md in root, .github or docs; does not imply secure code' },
    { id: 'conduct', title: 'Code of conduct', present: conduct, detail: 'CODE_OF_CONDUCT.md in root or .github' },
    { id: 'ci', title: 'CI configuration', present: ci, detail: 'Recognized CI file or workflow directory listing; status was not checked' },
    { id: 'dependabot', title: 'Dependabot configuration', present: dependabot, detail: 'Configuration file present, but enablement and effectiveness were not checked' },
    { id: 'changelog', title: 'Changelog', present: changelog, detail: 'CHANGELOG, CHANGES or HISTORY in root' },
    { id: 'gitignore', title: 'Git ignore file', present: gitignore, detail: 'A .gitignore file exists; contents were not examined' },
  ]
}

/** Generates optional action suggestions only when a complete directory inspection succeeded. */
export function inspectionRecommendations(report: RepositoryInspection): RepositoryAction[] {
  const missing = (id: FileEvidence['id']) => report.evidence.find(item => item.id === id)?.present === false
  const actions: RepositoryAction[] = []
  if (missing('readme')) actions.push({ id: 'readme', category: 'Documentation', priority: 'high',
    title: 'Add a useful README', detail: 'No recognized README was found in the root directory listing.',
    nextStep: 'Describe purpose, setup, usage, requirements, examples and how to contribute.' })
  if (missing('security')) actions.push({ id: 'security', category: 'Governance', priority: 'medium',
    title: 'Document vulnerability reporting', detail: 'No SECURITY.md was found in supported public locations.',
    nextStep: 'Consider a SECURITY.md policy with supported versions and a private reporting contact.' })
  if (missing('ci')) actions.push({ id: 'ci', category: 'Maintenance', priority: 'medium',
    title: 'Add automated quality checks', detail: 'No recognized CI config was visible in checked directories.',
    nextStep: 'For software projects, consider CI that runs tests and build checks on pull requests.' })
  if (missing('contributing')) actions.push({ id: 'contributing', category: 'Documentation', priority: 'low',
    title: 'Make contributing approachable', detail: 'No CONTRIBUTING guide was visible.',
    nextStep: 'Explain how to report issues, run tests and propose pull requests.' })
  if (missing('dependabot')) actions.push({ id: 'dependabot', category: 'Maintenance', priority: 'low',
    title: 'Consider dependency update automation', detail: 'No Dependabot config was visible in .github.',
    nextStep: 'If your project uses dependencies, consider a dependabot.yml configuration.' })
  return actions
}

async function fetchDirectory(
  owner: string, repository: string, directory: string, signal: AbortSignal | undefined, fetcher: typeof fetch,
): Promise<Entry[]> {
  const suffix = directory ? (directory.startsWith('/') ? directory : `/${directory}`) : ''
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents${suffix}`
  let response: Response
  try {
    response = await fetcher(url, { signal, headers: { Accept: 'application/vnd.github+json' } })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new RepositoryInspectionError('network', 'Could not reach GitHub to inspect this repository.')
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new RepositoryInspectionError('rate-limited', 'GitHub may have rate-limited anonymous file checks. Try again later.')
    }
    if (response.status === 404) {
      throw new RepositoryInspectionError('not-found', 'This repository or directory was not available for public inspection.')
    }
    throw new RepositoryInspectionError('other', `GitHub inspection failed (HTTP ${response.status}).`)
  }
  let payload: unknown
  try { payload = await response.json() } catch {
    throw new RepositoryInspectionError('other', 'GitHub returned unreadable directory data.')
  }
  return normalizedEntries(payload)
}

/** At most four read-only Contents requests; only requested for one selected repository. */
export async function inspectRepository(
  name: string,
  signal?: AbortSignal,
  options: { refresh?: boolean; fetcher?: typeof fetch } = {},
): Promise<RepositoryInspection> {
  const [owner, repository] = validateRepositoryName(name)
  const key = `${owner}/${repository}`.toLowerCase()
  const saved = cache.get(key)
  if (!options.refresh && saved && Date.now() - saved.inspectedAt < CACHE_MS) return saved

  const apiFetch = options.fetcher ?? fetch
  const root = await fetchDirectory(owner, repository, '', signal, apiFetch)
  const hasDirectory = (items: Entry[], key: string) => items.some(item => item.type === 'dir' && item.name.toLowerCase() === key)
  const github = hasDirectory(root, '.github') ? await fetchDirectory(owner, repository, '/.github', signal, apiFetch) : []
  const docs = hasDirectory(root, 'docs') ? await fetchDirectory(owner, repository, '/docs', signal, apiFetch) : []
  const workflows = hasDirectory(github, 'workflows') ? await fetchDirectory(owner, repository, '/.github/workflows', signal, apiFetch) : []

  const report: RepositoryInspection = {
    repository: `${owner}/${repository}`, inspectedAt: Date.now(), source: 'public GitHub Contents API',
    evidence: directoryEvidence(root, github, workflows, docs),
  }
  cache.set(key, report)
  if (cache.size > 30) cache.delete(cache.keys().next().value!)
  return report
}
