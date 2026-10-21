import { describe, expect, it } from 'vitest'
import { directoryEvidence, inspectRepository, inspectionRecommendations, RepositoryInspectionError, validateRepositoryName } from './repositoryAudit'

const entry = (name: string, type: 'file' | 'dir' = 'file') => ({ name, type })

describe('optional GitHub public file inspection', () => {
  it('rejects external URLs and unsafe path segments', () => {
    for (const candidate of ['https://evil.com/x/y', '../foo', 'owner/..', 'owner/repo/extra', 'owner/a?query=1']) {
      expect(() => validateRepositoryName(candidate)).toThrow(RepositoryInspectionError)
    }
    expect(validateRepositoryName('dev/my.repo')).toEqual(['dev', 'my.repo'])
  })
  it('detects root and .github policies using explicit file paths', () => {
    const evidence = directoryEvidence(
      [entry('README.md'), entry('LICENSE'), entry('.gitignore'), entry('.github', 'dir'), entry('docs', 'dir')],
      [entry('SECURITY.md'), entry('workflows', 'dir'), entry('dependabot.yml')],
      [entry('ci.yml')], [entry('CHANGELOG.md')],
    )
    expect(evidence.find(item => item.id === 'readme')?.present).toBe(true)
    expect(evidence.find(item => item.id === 'ci')?.present).toBe(true)
    expect(evidence.find(item => item.id === 'security')?.present).toBe(true)
    expect(evidence.find(item => item.id === 'dependabot')?.present).toBe(true)
    expect(evidence.find(item => item.id === 'contributing')?.present).toBe(false)
    expect(evidence.find(item => item.id === 'changelog')?.present).toBe(false)
  })
  it('does not count a directory called SECURITY.md as a security file', () => {
    const evidence = directoryEvidence([entry('SECURITY.md', 'dir')], [], [], [])
    expect(evidence.find(item => item.id === 'security')?.present).toBe(false)
    expect(evidence.find(item => item.id === 'readme')?.present).toBe(false)
  })
  it('only suggests optional improvements after reliable inspection', () => {
    const empty = directoryEvidence([], [], [], [])
    const result = inspectionRecommendations({ repository: 'dev/a', inspectedAt: 0, source: 'public GitHub Contents API', evidence: empty })
    expect(result[0].id).toBe('readme')
    expect(result.some(action => action.id === 'security')).toBe(true)
    expect(result.some(action => action.id === 'ci')).toBe(true)
  })
  it('fetches root, .github, docs and workflows, and never reads file contents', async () => {
    const urls: string[] = []
    const fetcher = (async (url: string) => {
      urls.push(url)
      let files = [entry('README.md'), entry('LICENSE'), entry('.github', 'dir'), entry('docs', 'dir')]
      if (url.endsWith('/.github')) files = [entry('workflows', 'dir'), entry('SECURITY.md')]
      if (url.endsWith('/docs')) files = [entry('CHANGELOG.md')]
      if (url.endsWith('/.github/workflows')) files = [entry('ci.yaml')]
      return { ok: true, json: async () => files } as Response
    }) as typeof fetch
    const result = await inspectRepository('my-org/an-app', undefined, { fetcher, refresh: true })
    expect(urls).toHaveLength(4)
    expect(result.evidence.find(item => item.id === 'ci')?.present).toBe(true)
    expect(result.evidence.find(item => item.id === 'security')?.present).toBe(true)
  })
  it('does not silently classify private or failed listings as absent policies', async () => {
    const fetcher = (async () => ({ ok: false, status: 404 }) as Response) as typeof fetch
    await expect(inspectRepository('my-org/unavailable', undefined, { fetcher, refresh: true }))
      .rejects.toMatchObject({ kind: 'not-found' })
  })
  it('reports rate limiting explicitly instead of returning missing indicators', async () => {
    const fetcher = (async () => ({ ok: false, status: 403 }) as Response) as typeof fetch
    await expect(inspectRepository('my-org/limited', undefined, { fetcher, refresh: true }))
      .rejects.toMatchObject({ kind: 'rate-limited' })
  })
})
