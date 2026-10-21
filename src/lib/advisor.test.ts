import { describe, expect, it } from 'vitest'
import { adviseRepository, analyzePortfolio, adviceAsMarkdown, isRecentPush } from './advisor'
import type { GitHubRepository } from '../types/github'

const now = Date.parse('2026-10-20T12:00:00Z')
const repo: GitHubRepository = {
  id: 1, name: 'tool', full_name: 'dev/tool', html_url: 'https://github.com/dev/tool',
  description: 'A helpful open-source developer tool for teams', language: 'TypeScript',
  stargazers_count: 3, forks_count: 2, topics: ['tools', 'typescript'],
  license: { key: 'mit', name: 'MIT License' }, archived: false, fork: false,
  pushed_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z', homepage: null,
}

describe('repository metadata advisor', () => {
  it('awards all four metadata checks to a sufficiently described, active licensed repository', () => {
    const result = adviseRepository(repo, now)
    expect(result.status).toBe('analyzed')
    expect(result.metadataCoverage).toBe(100)
    expect(result.actions).toEqual([])
  })
  it('prioritizes missing license, short description, old activity and missing topics', () => {
    const result = adviseRepository({ ...repo, description: '', license: null, topics: [], pushed_at: '2024-05-01T00:00:00Z' }, now)
    expect(result.metadataCoverage).toBe(0)
    expect(result.actions.map(action => action.id)).toEqual(['license','description','activity','topics'])
    expect(result.actions[0].priority).toBe('high')
  })
  it('does not treat future pushes or malformed timestamps as recent', () => {
    expect(isRecentPush({ ...repo, pushed_at: '2027-01-01T00:00:00Z' }, now)).toBe(false)
    expect(isRecentPush({ ...repo, pushed_at: 'not a date' }, now)).toBe(false)
    expect(isRecentPush({ ...repo, pushed_at: null }, now)).toBe(false)
  })
  it('excludes archives and forks from readiness ranking, even if metadata is incomplete', () => {
    expect(adviseRepository({ ...repo, archived: true }, now).metadataCoverage).toBeNull()
    expect(adviseRepository({ ...repo, fork: true }, now).actions).toHaveLength(0)
    const portfolio = analyzePortfolio([repo, { ...repo, id: 2, archived: true }], now)
    expect(portfolio.assessed).toBe(1)
    expect(portfolio.excluded).toBe(1)
    expect(portfolio.meanMetadataCoverage).toBe(100)
  })
  it('returns null mean when no eligible repositories exist', () => {
    expect(analyzePortfolio([], now).meanMetadataCoverage).toBeNull()
    expect(analyzePortfolio([{ ...repo, archived: true }], now).assessed).toBe(0)
  })
  it('ranks lowest metadata coverage first and records meaningful counts', () => {
    const incomplete = { ...repo, id: 3, name: 'incomplete', full_name: 'dev/incomplete', description: null, topics: [], license: null }
    const portfolio = analyzePortfolio([repo, incomplete], now)
    expect(portfolio.ranked[0].repo.name).toBe('incomplete')
    expect(portfolio.missingLicense).toBe(1)
    expect(portfolio.improvementCandidates).toBe(1)
    expect(portfolio.meanMetadataCoverage).toBe(63)
  })
  it('writes an explanatory markdown plan without pretending to scan code', () => {
    const incomplete = { ...repo, license: null }
    const plan = adviceAsMarkdown(incomplete, adviseRepository(incomplete, now))
    expect(plan).toContain('Clarify reuse permissions')
    expect(plan).toContain('not an audit of security')
  })
})
