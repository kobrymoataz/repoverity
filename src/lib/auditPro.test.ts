import { describe, expect, it } from 'vitest'
import type { GitHubRepository } from '../types/github'
import { auditAsMarkdown, buildAuditReport, expectedManifest, type AuditEvidence } from './auditPro'

const repository: GitHubRepository = {
  id: 11, name: 'example', full_name: 'example/example', html_url: 'https://github.com/example/example',
  description: 'A public tool', language: 'TypeScript', stargazers_count: 10, forks_count: 2, topics: [],
  license: { key: 'mit', name: 'MIT' }, archived: false, fork: false,
  pushed_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', homepage: null,
}

function evidence(): AuditEvidence {
  return {
    inspectedAt: Date.parse('2026-10-21T12:00:00Z'),
    community: { state: 'available', value: { readme: true, contributing: true, license: true,
      codeOfConduct: false, issueTemplate: true, pullTemplate: true, security: null } },
    readme: { state: 'available', value: '# Example\n## Installation\nnpm ci\n' },
    workflows: { state: 'available', value: { total: 2, active: 1, disabled: 1 } },
    runs: { state: 'available', value: [{ id: 1, status: 'completed', conclusion: 'success',
      htmlUrl: 'https://github.com/example/example/actions/runs/1', createdAt: '2026-10-21T10:00:00Z' }] },
    manifest: { state: 'available', value: { path: 'package.json', content: '{"scripts":{"test":"vitest run"}}' } },
  }
}

describe('auditPro', () => {
  it('reports evidence as observed, never as a security score', () => {
    const report = buildAuditReport(repository, evidence())
    expect(report.repository).toBe('example/example')
    expect(report.findings.find(f => f.id === 'readme-setup')?.status).toBe('observed')
    expect(report.findings.find(f => f.id === 'workflows')?.status).toBe('observed')
    expect(report.findings.find(f => f.id === 'test-script')?.status).toBe('observed')
    expect(report.findings.find(f => f.id === 'conduct')?.status).toBe('review')
    expect(report.findings.find(f => f.id === 'security-policy')?.status).toBe('unknown')
    expect(report.summary.review).toBe(1)
    expect(report.methodology.toLowerCase()).toContain('not a vulnerability scan')
  })

  it('does not label API denials as missing security documentation', () => {
    const input = evidence()
    input.community = { state: 'unavailable', reason: 'GitHub API rate limit reached' }
    input.workflows = { state: 'unavailable', reason: 'GitHub API rate limit reached' }
    input.runs = { state: 'unavailable', reason: 'GitHub API rate limit reached' }
    const report = buildAuditReport({ ...repository, license: null }, input)
    expect(report.findings.find(f => f.id === 'security-policy')?.status).toBe('unknown')
    expect(report.findings.find(f => f.id === 'contributing')?.status).toBe('unknown')
    expect(report.findings.find(f => f.id === 'workflows')?.status).toBe('unknown')
    expect(report.findings.find(f => f.id === 'license')?.status).toBe('unknown')
  })

  it('explains that no common README section is not proof of missing instructions', () => {
    const input = evidence()
    input.readme = { state: 'available', value: '# Hello\nRun things with scripts.\n' }
    const finding = buildAuditReport(repository, input).findings.find(item => item.id === 'readme-setup')
    expect(finding?.status).toBe('review')
    expect(finding?.detail).toContain('Alternative wording may exist')
  })

  it('treats missing optional language manifests as informational, not risk', () => {
    const input = evidence()
    input.manifest = { state: 'missing' }
    const finding = buildAuditReport(repository, input).findings.find(item => item.id === 'manifest')
    expect(finding?.status).toBe('informational')
    expect(finding?.detail).toContain('Monorepos')
  })

  it('treats failing recent runs as review needs without claiming a failed default branch', () => {
    const input = evidence()
    input.runs = { state: 'available', value: [{ id: 1, status: 'completed', conclusion: 'failure', htmlUrl: '', createdAt: '' }] }
    const finding = buildAuditReport(repository, input).findings.find(item => item.id === 'recent-runs')
    expect(finding?.status).toBe('review')
    expect(finding?.detail).toContain('may include multiple branches')
  })

  it('exports evidence-backed Markdown, strips newlines in user-controlled strings', () => {
    const report = buildAuditReport(repository, evidence())
    report.findings[0].detail = 'Bad\n### Injected'
    const markdown = auditAsMarkdown(report)
    expect(markdown).not.toContain('Bad\n### Injected')
    expect(markdown).toContain('Bad ### Injected')
    expect(markdown).toContain('Scope: Read-only public GitHub observations')
  })

  it('recognizes only known language manifests', () => {
    expect(expectedManifest('TypeScript')).toBe('package.json')
    expect(expectedManifest('Go')).toBe('go.mod')
    expect(expectedManifest('Haskell')).toBeNull()
  })
})
