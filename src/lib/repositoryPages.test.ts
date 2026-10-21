import { describe, expect, it, vi } from 'vitest'
import type { GitHubRepository } from '../types/github'
import {
  appendRepositoryPage, fetchRepositoryPage, firstRepositoryPage,
  RepositoryPageError, REPOSITORY_PAGE_SIZE,
} from './repositoryPages'

const makeRepo = (id: number): GitHubRepository => ({
  id, name: `repo${id}`, full_name: `example/repo${id}`,
  html_url: `https://github.com/example/repo${id}`, description: null,
  language: null, stargazers_count: 0, forks_count: 0, topics: [],
  license: null, archived: false, fork: false, pushed_at: null,
  updated_at: '2026-10-20T00:00:00Z', homepage: null,
})

describe('Repository pagination', () => {
  it('seeds the first 100 without refetching and reveals pagination only for a full page', () => {
    const full = firstRepositoryPage(Array.from({ length: REPOSITORY_PAGE_SIZE }, (_, i) => makeRepo(i)))
    expect(full.nextPage).toBe(2)
    expect(full.hasMore).toBe(true)
    expect(firstRepositoryPage([makeRepo(1)]).hasMore).toBe(false)
  })
  it('deduplicates overlapping pages and stops after a short page', () => {
    const first = firstRepositoryPage(Array.from({ length: 100 }, (_, i) => makeRepo(i)))
    const next = appendRepositoryPage(first, [makeRepo(99), makeRepo(100)])
    expect(next.repositories).toHaveLength(101)
    expect(next.hasMore).toBe(false)
    expect(next.pagesLoaded).toBe(2)
  })
  it('stops when a repeated full page makes no progress', () => {
    const initial = firstRepositoryPage(Array.from({ length: 100 }, (_, i) => makeRepo(i)))
    const duplicate = appendRepositoryPage(initial, [...initial.repositories])
    expect(duplicate.hasMore).toBe(false)
    expect(duplicate.message).toContain('already loaded')
  })
  it('requests the correct GitHub page and accepts valid repository data', async () => {
    const fakeFetch = vi.fn(async (_: string) => new Response(JSON.stringify([makeRepo(101)]), { status: 200 }))
    const result = await fetchRepositoryPage('example', 2, undefined, fakeFetch as typeof fetch)
    expect(result).toHaveLength(1)
    expect(fakeFetch.mock.calls[0][0]).toContain('per_page=100&page=2')
  })
  it('does not accept invalid page numbers or non-array data', async () => {
    await expect(fetchRepositoryPage('example', 0)).rejects.toBeInstanceOf(RepositoryPageError)
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ error: 'not array' }), { status: 200 }))
    await expect(fetchRepositoryPage('example', 2, undefined, fakeFetch)).rejects.toThrow('unexpected repository format')
  })
  it('surfaces API rate limits without inventing empty results', async () => {
    const fakeFetch = vi.fn(async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }))
    await expect(fetchRepositoryPage('example', 2, undefined, fakeFetch)).rejects.toMatchObject({ kind: 'rate-limit' })
  })
  it('reports network failures and preserves abort errors', async () => {
    const fakeFetch = vi.fn(async () => { throw new TypeError('offline') })
    await expect(fetchRepositoryPage('example', 2, undefined, fakeFetch)).rejects.toMatchObject({ kind: 'network' })
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(fetchRepositoryPage('example', 2, ctrl.signal, fakeFetch)).rejects.toBeInstanceOf(TypeError)
  })
})
