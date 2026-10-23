import { describe, expect, it } from 'vitest'
import { searchCommands, WORKSPACE_COMMANDS } from './commandSearch'

describe('workspace search', () => {
  it('includes all twelve available workspaces when empty', () => {
    expect(searchCommands('')).toHaveLength(12)
    expect(new Set(WORKSPACE_COMMANDS.map(item => item.id)).size).toBe(12)
  })
  it('matches labels and descriptive keywords', () => {
    expect(searchCommands('starstruck').map(item => item.id)).toEqual(['achievements'])
    expect(searchCommands('repo').map(item => item.id)[0]).toBe('repositories')
    expect(searchCommands('issue help').map(item => item.id)).toEqual(['contributions'])
  })
  it('ignores case, repeated spacing and harmless misses', () => {
    expect(searchCommands('  DATA   BACKUP ').map(item => item.id)).toEqual(['privacy'])
    expect(searchCommands('unavailable-command')).toEqual([])
  })
  it('does not mutate the command list when filtering', () => {
    const ids = WORKSPACE_COMMANDS.map(item => item.id)
    searchCommands('repository')
    expect(WORKSPACE_COMMANDS.map(item => item.id)).toEqual(ids)
  })
})
