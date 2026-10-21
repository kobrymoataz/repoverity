import { describe, expect, it } from 'vitest'
import type { GitHubRepository } from '../types/github'
import { buildAuditReport } from './auditPro'
import { decodeContents, fetchAuditEvidence, parseCommunity, parseRuns, parseWorkflows } from './auditProApi'

const repo: GitHubRepository = {
  id: 2, name: 'proj', full_name: 'sample-org/proj', html_url: 'https://github.com/sample-org/proj',
  description: null, language: 'TypeScript', stargazers_count: 1, forks_count: 0, topics: [], license: null,
  archived: false, fork: false, pushed_at: null, updated_at: '2026-10-21T00:00:00Z', homepage: null,
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

function b64(text: string): object {
  return { encoding: 'base64', content: btoa(text) }
}

describe('auditProApi', () => {
  it('parses community presence without assuming unsupported keys exist', () => {
    const value = parseCommunity({ files: { readme: { name: 'README.md' }, contributing: null,
      license: { key: 'mit' } } })
    expect(value.readme).toBe(true)
    expect(value.contributing).toBe(false)
    expect(value.license).toBe(true)
    expect(value.security).toBeNull()
    expect(parseCommunity({ files: { security: undefined } }).security).toBeNull()
  })

  it('parses workflows and capped runs', () => {
    expect(parseWorkflows({ total_count: 3, workflows: [{ state: 'active' }, { state: 'disabled_manually' }, { state: 'active' }] }))
      .toEqual({ total: 3, active: 2, disabled: 1 })
    const runs = parseRuns({ workflow_runs: [{ id: 4, status: 'completed', conclusion: 'failure',
      html_url: 'https://example.com/phishing', created_at: '2026-10-21T00:00:00Z' }] })
    expect(runs).toHaveLength(1)
    expect(runs[0].htmlUrl).toBe('')
    expect(() => parseRuns({ workflow_runs: [{ status: 'completed' }] })).toThrow('incomplete')
  })

  it('decodes bounded Unicode README content safely', () => {
    expect(decodeContents(b64('Some text'))).toBe('Some text')
    expect(decodeContents(b64(''))).toBe('')
    expect(() => decodeContents({ encoding: 'base64', content: 'A'.repeat(120_000) })).toThrow('too large')
    expect(() => decodeContents({ encoding: 'utf-8', content: 'hello' })).toThrow('base64')
  })

  it('makes bounded explicit public requests and supports partial failures', async () => {
    const paths: string[] = []
    const fetcher = (async (url: string) => {
      paths.push(url)
      if (url.endsWith('/community/profile')) return json({ files: { readme: {}, contributing: null,
        code_of_conduct: null, license: null } })
      if (url.endsWith('/readme')) return json(b64('# Hello\n## Usage\nRun the program.'))
      if (url.includes('/actions/workflows')) return json({ total_count: 1, workflows: [{ state: 'active' }] })
      if (url.includes('/actions/runs')) return json({ message: 'limited' }, 403)
      if (url.endsWith('/contents/package.json')) return json(b64('{"scripts":{"test":"vitest"}}'))
      return json({ message: 'no' }, 404)
    }) as unknown as typeof fetch
    const result = await fetchAuditEvidence(repo, undefined, { refresh: true, fetcher })
    expect(paths).toHaveLength(5)
    expect(result.readme.state).toBe('available')
    expect(result.runs.state).toBe('unavailable')
    const report = buildAuditReport(repo, result)
    expect(report.findings.find(f => f.id === 'recent-runs')?.status).toBe('unknown')
    expect(report.findings.find(f => f.id === 'test-script')?.status).toBe('observed')
  })

  it('represents a missing manifest as missing, not a vulnerability', async () => {
    const fetcher = (async (url: string) => {
      if (url.includes('/contents/package.json') || url.endsWith('/readme')) return json({ message: 'Not Found' }, 404)
      if (url.includes('community')) return json({ files: { license: null } })
      if (url.includes('workflows')) return json({ total_count: 0, workflows: [] })
      return json({ total_count: 0, workflow_runs: [] })
    }) as unknown as typeof fetch
    const result = await fetchAuditEvidence({ ...repo, full_name: 'sample-org/missing-manifest' }, undefined,
      { fetcher, refresh: true })
    expect(result.manifest?.state).toBe('missing')
    expect(result.readme.state).toBe('missing')
    expect(result.workflows.state).toBe('available')
  })

  it('rejects invalid repository names before making requests', async () => {
    await expect(fetchAuditEvidence({ ...repo, full_name: '../invalid' })).rejects.toThrow('valid public GitHub repository')
  })
})
