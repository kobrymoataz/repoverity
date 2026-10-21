import type { GitHubRepository } from '../types/github'

export type EvidenceState<T> =
  | { state: 'available'; value: T }
  | { state: 'missing' }
  | { state: 'unavailable'; reason: string }

export interface CommunityEvidence {
  readme: boolean | null
  contributing: boolean | null
  license: boolean | null
  codeOfConduct: boolean | null
  issueTemplate: boolean | null
  pullTemplate: boolean | null
  security: boolean | null
}

export interface WorkflowEvidence {
  total: number
  active: number
  disabled: number
}

export interface RunEvidence {
  id: number
  status: string
  conclusion: string | null
  htmlUrl: string
  createdAt: string
}

export interface ManifestEvidence {
  path: string
  content: string
}

export interface AuditEvidence {
  community: EvidenceState<CommunityEvidence>
  readme: EvidenceState<string>
  workflows: EvidenceState<WorkflowEvidence>
  runs: EvidenceState<RunEvidence[]>
  manifest: EvidenceState<ManifestEvidence> | null
  inspectedAt: number
}

export type FindingStatus = 'observed' | 'review' | 'unknown' | 'informational'
export type AuditCategory = 'Documentation' | 'Governance' | 'Automation' | 'Dependencies'

export interface AuditFinding {
  id: string
  title: string
  category: AuditCategory
  status: FindingStatus
  detail: string
  recommendation: string
  sourceUrl: string
}

export interface AuditReport {
  repository: string
  inspectedAt: number
  findings: AuditFinding[]
  summary: { observed: number; review: number; unknown: number; informational: number }
  methodology: string
}

const METHODOLOGY = 'Read-only public GitHub observations. Not a vulnerability scan, security rating, license legal review or compliance certification.'

function knownFile(value: boolean | null | undefined): FindingStatus {
  return value === true ? 'observed' : value === false ? 'review' : 'unknown'
}

function isKnownFile(value: EvidenceState<CommunityEvidence>, key: keyof CommunityEvidence): boolean | null {
  return value.state === 'available' ? value.value[key] : null
}

function docSignal(content: string, cues: RegExp): boolean {
  return cues.test(content.slice(0, 50_000))
}

function checkCommunity(
  community: EvidenceState<CommunityEvidence>, key: keyof CommunityEvidence,
  finding: Omit<AuditFinding, 'status'>,
): AuditFinding {
  const presence = isKnownFile(community, key)
  return {
    ...finding,
    status: knownFile(presence),
    detail: presence === null ? 'GitHub did not return enough public evidence to determine presence.' :
      presence ? finding.detail : `Not reported in the public community profile. ${finding.detail}`,
  }
}

export function buildAuditReport(repo: GitHubRepository, evidence: AuditEvidence): AuditReport {
  const base = repo.html_url.startsWith('https://github.com/')
    ? repo.html_url.replace(/\/$/, '') : `https://github.com/${encodeURIComponent(repo.full_name.split('/')[0])}/${encodeURIComponent(repo.name)}`
  const findings: AuditFinding[] = []
  const add = (item: AuditFinding) => findings.push(item)

  add({
    id: 'readme', category: 'Documentation', title: 'Public README', sourceUrl: `${base}#readme`,
    status: evidence.readme.state === 'available' ? 'observed' : evidence.readme.state === 'missing' ? 'review' : 'unknown',
    detail: evidence.readme.state === 'available' ? 'GitHub returned readable README content.' :
      evidence.readme.state === 'missing' ? 'GitHub did not find a README in the supported locations.' : evidence.readme.reason,
    recommendation: 'Explain the purpose, prerequisites, setup, usage and how to contribute.',
  })
  if (evidence.readme.state === 'available') {
    const hasSetup = docSignal(evidence.readme.value, /(?:^|\n)\s*#{1,5}\s*(?:installation|install|getting started|quick ?start|setup|usage|how to run|running|examples?|utilisation|instalaci[oó]n|استخدام)\b/im)
    add({ id: 'readme-setup', category: 'Documentation', title: 'Setup or usage guidance',
      status: hasSetup ? 'observed' : 'review', sourceUrl: `${base}#readme`,
      detail: hasSetup ? 'A recognizable setup or usage heading was found.' : 'No common setup or usage heading was detected in the sampled README text. Alternative wording may exist.',
      recommendation: 'Add a clear installation or usage section with a working example, where relevant.' })
  } else {
    add({ id: 'readme-setup', category: 'Documentation', title: 'Setup or usage guidance', status: 'unknown',
      detail: 'README content was unavailable for inspection.', recommendation: 'Check the README manually.', sourceUrl: `${base}#readme` })
  }

  add(checkCommunity(evidence.community, 'contributing', {
    id: 'contributing', category: 'Documentation', title: 'Contribution instructions',
    detail: 'GitHub checked its recognized community file locations.',
    recommendation: 'Provide build, test, issue and pull request instructions if the project welcomes contributions.',
    sourceUrl: `${base}/community`,
  }))

  const licensePresent = Boolean(repo.license) || isKnownFile(evidence.community, 'license') === true
  add({ id: 'license', category: 'Governance', title: 'Recognized license',
    status: licensePresent ? 'observed' : evidence.community.state === 'available' ? 'review' : 'unknown',
    detail: licensePresent ? 'GitHub reports recognized license metadata.' : 'A recognized license could not be confirmed from the available public data.',
    recommendation: 'If distributing reusable code, choose a suitable license and verify ownership and compatibility.',
    sourceUrl: `${base}/community`,
  })

  add(checkCommunity(evidence.community, 'codeOfConduct', {
    id: 'conduct', category: 'Governance', title: 'Code of conduct',
    detail: 'GitHub checked recognized community file locations.',
    recommendation: 'Document expected conduct and reporting channels when accepting community contributions.',
    sourceUrl: `${base}/community`,
  }))

  add(checkCommunity(evidence.community, 'security', {
    id: 'security-policy', category: 'Governance', title: 'Security disclosure policy',
    detail: 'This is a document-presence observation, not an evaluation of security.',
    recommendation: 'Provide a private vulnerability reporting route and supported-version policy when appropriate.',
    sourceUrl: `${base}/security/policy`,
  }))

  if (evidence.workflows.state === 'available') {
    const { active, disabled, total } = evidence.workflows.value
    add({ id: 'workflows', category: 'Automation', title: 'GitHub Actions workflows',
      status: active > 0 ? 'observed' : 'review',
      detail: `${total} GitHub Actions workflows returned, ${active} active and ${disabled} disabled. Other CI providers are not included.`,
      recommendation: 'For software repositories, consider an active workflow that checks tests and builds on pull requests.',
      sourceUrl: `${base}/actions`,
    })
  } else {
    add({ id: 'workflows', category: 'Automation', title: 'GitHub Actions workflows', status: 'unknown',
      detail: evidence.workflows.state === 'unavailable' ? evidence.workflows.reason : 'GitHub did not provide workflow information.',
      recommendation: 'Inspect the repository Actions tab and any external CI provider.', sourceUrl: `${base}/actions` })
  }
  if (evidence.runs.state === 'available') {
    const completed = evidence.runs.value.filter(run => run.status === 'completed')
    const failures = completed.filter(run => run.conclusion === 'failure' || run.conclusion === 'timed_out')
    add({ id: 'recent-runs', category: 'Automation', title: 'Recent workflow executions',
      status: failures.length ? 'review' : completed.length ? 'observed' : 'informational',
      detail: `${completed.length} completed runs in up to 10 recently returned runs; ${failures.length} failed or timed out. This is not full CI history and may include multiple branches.`,
      recommendation: failures.length ? 'Inspect recent failures in GitHub Actions and resolve relevant regressions.' : 'Check recent workflows for required checks on the default branch.',
      sourceUrl: `${base}/actions`,
    })
  } else {
    add({ id: 'recent-runs', category: 'Automation', title: 'Recent workflow executions', status: 'unknown',
      detail: evidence.runs.state === 'unavailable' ? evidence.runs.reason : 'Recent workflow runs were not available.',
      recommendation: 'Inspect the Actions tab. An unavailable API result is not evidence of a failed build.', sourceUrl: `${base}/actions` })
  }
  if (evidence.manifest) {
    const manifestPath = evidence.manifest.state === 'available' ? evidence.manifest.value.path :
      expectedManifest(repo.language) || 'dependency manifest'
    if (evidence.manifest.state === 'available') {
      add({ id: 'manifest', category: 'Dependencies', title: 'Root dependency manifest', status: 'observed',
        detail: `GitHub returned ${manifestPath} at the repository root. Dependency versions were not checked against vulnerability databases.`,
        recommendation: 'Review version constraints and use a dependency auditing service where appropriate.',
        sourceUrl: `${base}/blob/HEAD/${manifestPath}` })
      if (manifestPath === 'package.json') {
        let scripts: Record<string, unknown> | null = null
        try {
          const parsed: unknown = JSON.parse(evidence.manifest.value.content)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const value = (parsed as Record<string, unknown>).scripts
            if (value && typeof value === 'object' && !Array.isArray(value)) scripts = value as Record<string, unknown>
          }
        } catch { /* A malformed JSON document is not a confirmed absence of tests. */ }
        add({ id: 'test-script', category: 'Dependencies', title: 'npm test script',
          status: scripts === null ? 'unknown' : typeof scripts.test === 'string' && scripts.test.trim() ? 'observed' : 'review',
          detail: scripts === null ? 'Could not parse scripts from the root package.json.' :
            typeof scripts.test === 'string' && scripts.test.trim() ? 'A test script is declared. This does not confirm tests pass.' : 'No test script was declared in the root package.json.',
          recommendation: 'For a JavaScript or TypeScript project, add meaningful automated tests and run them in CI.',
          sourceUrl: `${base}/blob/HEAD/package.json` })
      }
    } else {
      add({ id: 'manifest', category: 'Dependencies', title: 'Root dependency manifest',
        status: evidence.manifest.state === 'missing' ? 'informational' : 'unknown',
        detail: evidence.manifest.state === 'missing' ? `No ${manifestPath} was returned at the root. Monorepos may place manifests elsewhere.` : evidence.manifest.reason,
        recommendation: 'Inspect the actual project layout before deciding whether dependency automation applies.',
        sourceUrl: base })
    }
  }

  const summary = { observed: 0, review: 0, unknown: 0, informational: 0 }
  for (const finding of findings) summary[finding.status]++
  return { repository: repo.full_name, inspectedAt: evidence.inspectedAt, findings, summary, methodology: METHODOLOGY }
}

export function expectedManifest(language: string | null): string | null {
  const mapping: Record<string, string> = {
    TypeScript: 'package.json', JavaScript: 'package.json', Python: 'pyproject.toml',
    Rust: 'Cargo.toml', Go: 'go.mod', PHP: 'composer.json', Ruby: 'Gemfile', Java: 'pom.xml',
  }
  return language ? mapping[language] || null : null
}

function cleanText(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f]/g, '').replace(/[<>{}\[\]`]/g, '').trim().slice(0, 450)
}

export function auditAsMarkdown(report: AuditReport): string {
  const lines = [`# RepoVerity evidence review: ${cleanText(report.repository)}`, '',
    `Observed at: ${new Date(report.inspectedAt).toISOString()}`,
    `Observed: ${report.summary.observed}; Review: ${report.summary.review}; Unknown: ${report.summary.unknown}; Informational: ${report.summary.informational}`, '',
    `Scope: ${report.methodology}`, '', '## Findings', '']
  for (const finding of report.findings) {
    lines.push(`### ${cleanText(finding.title)} (${finding.status})`, '',
      `Category: ${finding.category}`, `Evidence: ${cleanText(finding.detail)}`,
      `Suggested next step: ${cleanText(finding.recommendation)}`, `Source: ${finding.sourceUrl}`, '')
  }
  return lines.join('\n') + '\n'
}
