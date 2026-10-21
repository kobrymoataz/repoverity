import { describe, expect, it } from 'vitest'
import { fetchPublicActivity, publicRepositoryPath } from './developerActivityApi'

const goodUrl = 'https://github.com/acme/repo'
function mockResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

describe('read-only public activity fetching', () => {
  it('rejects invalid repository names before making requests', () => {
    for (const value of ['', 'acme', 'acme/repo/more', 'acme/%0A', '../secret', 'evil.com/repo']) {
      expect(() => publicRepositoryPath(value)).toThrow()
    }
    expect(publicRepositoryPath('acme/repo.example')).toBe('acme/repo.example')
  })
  it('requests four bounded public endpoints and labels sampled results', async () => {
    const requested: string[] = []
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/contributors?')) return mockResponse([{ login: 'alice', contributions: 13,
        html_url: 'https://github.com/alice', avatar_url: 'https://avatars.githubusercontent.com/u/1' }])
      if (url.includes('/releases?')) return mockResponse([{ id: 1, tag_name: 'v1', name: 'First',
        published_at: '2026-10-01T00:00:00Z', html_url: `${goodUrl}/releases/tag/v1`, prerelease: false }])
      if (url.includes('/issues?')) return mockResponse([{ number: 1, title: 'bug', state: 'open',
        html_url: `${goodUrl}/issues/1` }, { number: 2, pull_request: {}, title: 'PR', html_url: `${goodUrl}/pull/2` }])
      return mockResponse([{ number: 2, title: 'PR', state: 'closed', merged_at: '2026-10-10T00:00:00Z',
        html_url: `${goodUrl}/pull/2` }])
    }) as typeof fetch
    const result = await fetchPublicActivity('acme/repo', undefined, fetcher)
    expect(requested).toHaveLength(4)
    expect(requested.every(url => url.startsWith('https://api.github.com/repos/acme/repo/'))).toBe(true)
    expect(result.contributors?.[0].contributions).toBe(13)
    expect(result.releases).toHaveLength(1)
    expect(result.issues).toHaveLength(1)
    expect(result.pulls?.[0].merged_at).toBeTruthy()
    expect(Object.keys(result.failures)).toHaveLength(0)
  })
  it('reports partial failures without changing missing values to zero', async () => {
    const fetcher = (async (input: string | URL | Request) => {
      if (String(input).includes('/releases?')) return mockResponse({ error: 'limited' }, 403, { 'x-ratelimit-remaining': '0' })
      return mockResponse([])
    }) as typeof fetch
    const result = await fetchPublicActivity('acme/repo', undefined, fetcher)
    expect(result.releases).toBe(null)
    expect(result.failures.releases).toMatch(/rate limit/i)
    expect(result.issues).toEqual([])
  })
  it('skips hostile URLs from API responses', async () => {
    const fetcher = (async (input: string | URL | Request) => {
      if (String(input).includes('/contributors?')) return mockResponse([{ login: 'bad', html_url: 'https://evil.example/profile', contributions: 10 }])
      return mockResponse([])
    }) as typeof fetch
    const result = await fetchPublicActivity('acme/repo', undefined, fetcher)
    expect(result.contributors).toEqual([])
  })
})
