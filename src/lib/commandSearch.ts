import type { WorkspaceId } from './navigation'

export interface CommandItem {
  id: WorkspaceId
  label: string
  category: string
  keywords: string
}

export const WORKSPACE_COMMANDS: CommandItem[] = [
  { id: 'overview', label: 'Overview', category: 'Workspace', keywords: 'profile account summary dashboard' },
  { id: 'repositories', label: 'Repositories', category: 'Workspace', keywords: 'projects search sort fork star' },
  { id: 'analytics', label: 'Profile insights', category: 'Workspace', keywords: 'languages metadata portfolio statistics' },
  { id: 'growth', label: 'Growth history', category: 'Workspace', keywords: 'followers snapshots trends charts milestones' },
  { id: 'advisor', label: 'Repository advisor', category: 'Developer tools', keywords: 'quality documentation audit files security' },
  { id: 'contributions', label: 'Find contributions', category: 'Developer tools', keywords: 'issues open source good first issue help wanted' },
  { id: 'achievements', label: 'Achievements', category: 'Developer tools', keywords: 'badges pull shark starstruck goals' },
  { id: 'maintainers', label: 'Maintainer desk', category: 'Developer tools', keywords: 'issues pull requests review contributors triage priority queue team community' },
  { id: 'cloud', label: 'Cloud workspaces', category: 'Workspace', keywords: 'cloud login github oauth sync watchlist saved workspace' },
  { id: 'privacy', label: 'Data & privacy', category: 'Project', keywords: 'backup export import delete json preferences' },
  { id: 'about', label: 'About RepoVerity', category: 'Project', keywords: 'source license methodology documentation' },
]

export function searchCommands(query: string, items = WORKSPACE_COMMANDS): CommandItem[] {
  const normalized = query.trim().toLowerCase().slice(0, 100)
  if (!normalized) return items
  const terms = normalized.split(/\s+/).filter(Boolean)
  return items
    .map(item => {
      const label = item.label.toLowerCase()
      const text = `${label} ${item.category} ${item.keywords}`.toLowerCase()
      if (!terms.every(term => text.includes(term))) return null
      const score = terms.reduce((sum, term) => sum + (label.startsWith(term) ? 4 : label.includes(term) ? 2 : 0), 0)
      return { item, score }
    })
    .filter((match): match is { item: CommandItem; score: number } => match !== null)
    .sort((a, b) => b.score - a.score)
    .map(match => match.item)
}
