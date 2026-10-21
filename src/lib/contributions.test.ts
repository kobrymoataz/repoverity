import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildGithubIssueSearchUrl, createIssueSearchQuery, DEFAULT_ISSUE_FILTERS,
  findContributionIssues, normalizeContributionIssue,
  type IssueSearchFilters,
} from './contributions'

const issue = {
  id: 42, html_url: 'https://github.com/example/project/issues/23',
  title: 'Improve documentation', state: 'open',
  labels: [{ name: 'good first issue' }], comments: 2,
  updated_at: '2026-10-20T12:00:00Z',
}

afterEach(() => vi.unstubAllGlobals())

describe('contribution finder', () => {
  it('uses open, unassigned, public issue query constraints', () => {
    const query = createIssueSearchQuery(DEFAULT_ISSUE_FILTERS)
    expect(query).toContain('is:issue is:open archived:false no:assignee')
    expect(query).toContain('label:"good first issue"')
    expect(query).toContain('language:typescript')
  })
  it('supports help wanted, language All and safe text input', () => {
    const filters: IssueSearchFilters = { label: 'help-wanted', language: 'all', keywords: 'help:>0 react' }
    const q = createIssueSearchQuery(filters)
    expect(q).toContain('label:"help wanted"')
    expect(q).not.toContain('language:')
    expect(q).toContain('"help 0 react" in:title')
    expect(q).not.toContain('help:>0')
    const url = new URL(buildGithubIssueSearchUrl(filters))
    expect(url.hostname).toBe('github.com')
    expect(url.searchParams.get('type')).toBe('issues')
  })
  it('rejects unexpected filter values', () => {
    expect(() => createIssueSearchQuery({ ...DEFAULT_ISSUE_FILTERS, language: 'fake' as never })).toThrow()
  })
  it('normalizes only open issues on github.com', () => {
    expect(normalizeContributionIssue(issue)).toMatchObject({ repo: 'example/project', number: 23, comments: 2 })
    expect(normalizeContributionIssue({ ...issue, pull_request: { url: 'foo' } })).toBeNull()
    expect(normalizeContributionIssue({ ...issue, state: 'closed' })).toBeNull()
    expect(normalizeContributionIssue({ ...issue, html_url: 'https://github.com.evil.test/a/b/issues/2' })).toBeNull()
    expect(normalizeContributionIssue({ ...issue, html_url: 'javascript:alert(1)' })).toBeNull()
  })
  it('returns parsed public GitHub search results', async () => {
    const mock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true, status: 200,
      json: async () => ({ total_count: 12, incomplete_results: false, items: [issue] }),
    }))
    vi.stubGlobal('fetch', mock)
    const result = await findContributionIssues({ ...DEFAULT_ISSUE_FILTERS, language: 'Go', keywords: 'documentation' })
    expect(result.issues).toHaveLength(1)
    expect(result.total).toBe(12)
    expect(mock).toHaveBeenCalledOnce()
    expect(String(mock.mock.calls[0][0])).toContain('search/issues')
  })
  it('reports rate limits clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    await expect(findContributionIssues({ ...DEFAULT_ISSUE_FILTERS, language: 'Rust', keywords: 'timeout' }))
      .rejects.toMatchObject({ kind: 'rate-limited' })
  })
  it('reports unexpected data instead of presenting invented issues', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ invalid: true }) })))
    await expect(findContributionIssues({ ...DEFAULT_ISSUE_FILTERS, language: 'Java', keywords: 'cache' }))
      .rejects.toMatchObject({ kind: 'other' })
  })
})
