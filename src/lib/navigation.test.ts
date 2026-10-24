import { describe, expect, it } from 'vitest'
import { workspaceFromHash, workspaceHref, WORKSPACE_IDS } from './navigation'

describe('workspace routing', () => {
  it('handles GitHub Pages safe hash links', () => {
    for (const workspace of WORKSPACE_IDS) {
      expect(workspaceFromHash(workspaceHref(workspace))).toBe(workspace)
    }
  })
  it('accepts old section bookmarks', () => {
    expect(workspaceFromHash('#growth')).toBe('growth')
    expect(workspaceFromHash('#signals')).toBe('analytics')
    expect(workspaceFromHash('#main-content')).toBe('overview')
  })
  it('handles unknown routes without a missing page', () => {
    expect(workspaceFromHash('')).toBe('overview')
    expect(workspaceFromHash('#/unrecognized')).toBe('overview')
    expect(workspaceFromHash('#/analytics/extra')).toBe('overview')
  })
  it('supports case-insensitive and trailing-slash bookmarks', () => {
    expect(workspaceFromHash('#/GROWTH/')).toBe('growth')
    expect(workspaceFromHash('#/Repositories')).toBe('repositories')
    expect(workspaceFromHash('#/launch')).toBe('launch')
  })
})
