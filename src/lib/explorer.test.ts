import { describe, expect, it } from 'vitest'
import type { GitHubRepository } from '../types/github'
import {
  availableLanguages, availableTopics, buildComparison, DEFAULT_EXPLORER_FILTERS,
  explorerCsv, filterExplorerRepositories, MAX_SAVED_VIEWS_PER_PROFILE,
  parseSavedViews, removeSavedView, storeSavedView, type SavedExplorerView,
} from './explorer'

function repo(id: number, changes: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id, name: `project-${id}`, full_name: `test/project-${id}`,
    html_url: `https://github.com/test/project-${id}`, description: 'Example project',
    language: 'TypeScript', stargazers_count: 0, forks_count: 0,
    topics: ['dashboard'], license: null, archived: false, fork: false,
    pushed_at: '2026-10-20T12:00:00Z', updated_at: '2026-10-20T12:00:00Z', homepage: null,
    ...changes,
  }
}

const repos = [repo(1, { stargazers_count: 9, forks_count: 3, topics: ['react', 'ui'] }),
  repo(2, { fork: true, language: 'Python', topics: ['cli'], stargazers_count: 12 }),
  repo(3, { archived: true, language: null, topics: [] }),
  repo(4, { pushed_at: '2025-01-01T00:00:00Z', topics: ['react'] })]

describe('Repository Explorer filters', () => {
  it('filters by language, topic and source status', () => {
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, language: 'Python' }).map(r => r.id)).toEqual([2])
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, topic: 'react' }).map(r => r.id)).toEqual([1, 4])
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, status: 'source' }).map(r => r.id)).toEqual([1, 3, 4])
  })
  it('matches public descriptions and topics case insensitively', () => {
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, search: 'CLI' }).map(r => r.id)).toEqual([2])
  })
  it('excludes future pushes, archived and old repos from recently active filter', () => {
    expect(filterExplorerRepositories([...repos, repo(5, { pushed_at: '2027-01-01T00:00:00Z' })],
      { ...DEFAULT_EXPLORER_FILTERS, status: 'active' }, Date.parse('2026-10-21T00:00:00Z')).map(r => r.id)).toEqual([1, 2])
  })
  it('sorts by stars, forks and name with deterministic ties', () => {
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, sort: 'stars' }).map(r => r.id)).toEqual([2, 1, 3, 4])
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, sort: 'forks' }).map(r => r.id)).toEqual([1, 2, 3, 4])
    expect(filterExplorerRepositories(repos, { ...DEFAULT_EXPLORER_FILTERS, sort: 'name' }).map(r => r.id)).toEqual([1, 2, 3, 4])
  })
  it('returns sorted distinct languages and common topics', () => {
    expect(availableLanguages(repos)).toEqual(['Python', 'TypeScript', 'Unspecified'])
    expect(availableTopics(repos)).toEqual(['react', 'cli', 'ui'])
  })
})

describe('Saved views and compare', () => {
  function view(i: number, owner = 'tester'): SavedExplorerView {
    return { id: `view${i}`, owner, label: `View ${i}`, filters: { ...DEFAULT_EXPLORER_FILTERS } }
  }
  it('validates saved data, rejects malformed input and unexpected types', () => {
    expect(parseSavedViews('oops')).toEqual([])
    expect(parseSavedViews(JSON.stringify([{ ...view(1), filters: { status: 'made-up' } }, view(2)]))).toEqual([view(2)])
    expect(parseSavedViews('a'.repeat(50_001))).toEqual([])
  })
  it('caps saved views by profile and retains other profiles', () => {
    let state: SavedExplorerView[] = [view(0, 'other')]
    for (let i = 0; i < 25; i++) state = storeSavedView(state, view(i))
    expect(state.filter(s => s.owner === 'tester')).toHaveLength(MAX_SAVED_VIEWS_PER_PROFILE)
    expect(state.some(s => s.owner === 'other')).toBe(true)
    state = removeSavedView(state, 'view24', 'TESTER')
    expect(state.some(s => s.id === 'view24')).toBe(false)
  })
  it('builds comparison with at most three unique, known repository ids', () => {
    expect(buildComparison(repos, [2, 2, 4, 1, 3, 999]).map(r => r.id)).toEqual([2, 4, 1])
  })
})

describe('CSV export', () => {
  it('quotes commas and prevents spreadsheet formula interpretation', () => {
    const csv = explorerCsv([repo(9, { description: '=HYPERLINK("bad", "click"), unsafe' })])
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain('""bad""')
    expect(csv).toContain('test/project-9')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
