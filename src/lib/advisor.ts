import type { GitHubRepository } from '../types/github'

/** Transparent, deterministic metadata recommendations; never a security rating. */
export type AdvicePriority = 'high' | 'medium' | 'low'
export type AdviceCategory = 'Documentation' | 'Discoverability' | 'Maintenance' | 'Governance'

export interface AdviceCheck {
  id: 'description' | 'topics' | 'license' | 'activity'
  title: string
  passed: boolean
  explanation: string
}

export interface RepositoryAction {
  id: string
  category: AdviceCategory
  priority: AdvicePriority
  title: string
  detail: string
  nextStep: string
}

export interface RepositoryAdvice {
  repository: string
  status: 'analyzed' | 'archived' | 'fork'
  /** Percentage of four public metadata checks, not a measure of code quality or security. */
  metadataCoverage: number | null
  checks: AdviceCheck[]
  actions: RepositoryAction[]
}

export interface PortfolioAdvice {
  assessed: number
  excluded: number
  totalSampled: number
  meanMetadataCoverage: number | null
  missingLicense: number
  improvementCandidates: number
  ranked: { repo: GitHubRepository; advice: RepositoryAdvice }[]
}

const DAY_MS = 86_400_000
const PRIORITY: Record<AdvicePriority, number> = { high: 0, medium: 1, low: 2 }

export function isRecentPush(repo: GitHubRepository, now = Date.now(), maxAgeDays = 365): boolean {
  if (!repo.pushed_at) return false
  const pushedAt = Date.parse(repo.pushed_at)
  return Number.isFinite(pushedAt) && pushedAt <= now && pushedAt >= now - maxAgeDays * DAY_MS
}

/** Forks and archived repos are skipped: the owner may not control these aspects. */
export function adviseRepository(repo: GitHubRepository, now = Date.now()): RepositoryAdvice {
  const status: RepositoryAdvice['status'] = repo.archived ? 'archived' : repo.fork ? 'fork' : 'analyzed'
  if (status !== 'analyzed') return { repository: repo.full_name, status, metadataCoverage: null, checks: [], actions: [] }

  const description = (repo.description ?? '').trim()
  const topics = Array.isArray(repo.topics) ? repo.topics : []
  const checks: AdviceCheck[] = [
    { id: 'description', title: 'Useful description', passed: description.length >= 25,
      explanation: 'At least 25 characters in the public repository description.' },
    { id: 'topics', title: 'Discovery topics', passed: topics.length >= 2,
      explanation: 'At least two GitHub repository topics.' },
    { id: 'license', title: 'License metadata', passed: Boolean(repo.license),
      explanation: 'GitHub recognizes a license. This is not a legal assessment.' },
    { id: 'activity', title: 'Recent push', passed: isRecentPush(repo, now),
      explanation: 'A push was recorded within 365 days; not a judgement about maintenance needs.' },
  ]
  const actions: RepositoryAction[] = []
  if (!checks[2].passed) actions.push({ id: 'license', category: 'Governance', priority: 'high',
    title: 'Clarify reuse permissions', detail: 'GitHub does not report recognized license metadata for this repository.',
    nextStep: 'If appropriate, choose and add a license. Confirm that you have permission to license the content.' })
  if (!checks[0].passed) actions.push({ id: 'description', category: 'Documentation', priority: 'medium',
    title: 'Explain what this project does', detail: 'The public description is missing or too short to convey the purpose.',
    nextStep: 'Add a concise problem statement, primary user and key benefit to the repository description.' })
  if (!checks[3].passed) actions.push({ id: 'activity', category: 'Maintenance', priority: 'medium',
    title: 'Clarify current maintenance status', detail: 'No push within the last 365 days is visible in public metadata.',
    nextStep: 'If maintained, update the roadmap or make useful changes. If stable, say so in README; never make filler commits.' })
  if (!checks[1].passed) actions.push({ id: 'topics', category: 'Discoverability', priority: 'low',
    title: 'Improve repository discovery', detail: 'Fewer than two topics describe this project.',
    nextStep: 'Add two or more accurate technology, audience or use-case topics in repository settings.' })

  actions.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority])
  return {
    repository: repo.full_name, status, checks, actions,
    metadataCoverage: Math.round(checks.filter(check => check.passed).length / checks.length * 100),
  }
}

/** Analysis covers only repositories that the profile API has actually returned. */
export function analyzePortfolio(repositories: GitHubRepository[], now = Date.now()): PortfolioAdvice {
  const evaluated = repositories.map(repo => ({ repo, advice: adviseRepository(repo, now) }))
  const ranked = evaluated.filter(item => item.advice.status === 'analyzed')
    .sort((a, b) => {
      const coverage = (a.advice.metadataCoverage ?? 100) - (b.advice.metadataCoverage ?? 100)
      return coverage || b.repo.stargazers_count - a.repo.stargazers_count || a.repo.name.localeCompare(b.repo.name)
    })
  const assessed = ranked.length
  return {
    assessed,
    excluded: evaluated.length - assessed,
    totalSampled: evaluated.length,
    meanMetadataCoverage: assessed ? Math.round(ranked.reduce((total, item) => total + (item.advice.metadataCoverage ?? 0), 0) / assessed) : null,
    missingLicense: ranked.filter(({ advice }) => advice.checks.some(check => check.id === 'license' && !check.passed)).length,
    improvementCandidates: ranked.filter(({ advice }) => advice.actions.length > 0).length,
    ranked,
  }
}

export function adviceAsMarkdown(repo: GitHubRepository, advice: RepositoryAdvice, extra: RepositoryAction[] = []): string {
  const plain = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/[`*_\[\]<>]/g, '').trim().slice(0, 300)
  const actions = [...advice.actions, ...extra].sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority])
  return [
    `# Improvement plan: ${plain(repo.full_name)}`,
    '',
    `Repository: ${repo.html_url}`,
    `Metadata coverage: ${advice.metadataCoverage === null ? 'Not assessed' : `${advice.metadataCoverage}% (four public checks)`}`,
    `Status: ${advice.status}`,
    '',
    '## Recommended actions',
    ...(actions.length ? actions.flatMap((action, i) => [
      `${i + 1}. **${plain(action.title)}** (${action.priority}, ${action.category})`,
      `   - Evidence: ${plain(action.detail)}`,
      `   - Next: ${plain(action.nextStep)}`,
    ]) : ['No improvements suggested from the available public checks.']),
    '',
    '## Scope',
    'These are public metadata and file-presence observations, not an audit of security, code quality, vulnerabilities or legal compliance.',
    'Generated by RepoVerity V0.5 from a public GitHub snapshot and optional repository-file inspection.',
    '',
  ].join('\n')
}
