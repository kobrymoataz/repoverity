/** Lightweight hash routing keeps project-hosted GitHub Pages refresh-safe. */
export const WORKSPACE_IDS = [
  'overview', 'repositories', 'analytics', 'growth', 'achievements',
  'contributions', 'advisor', 'maintainers', 'tools', 'cloud', 'privacy', 'about',
] as const

export type WorkspaceId = typeof WORKSPACE_IDS[number]

const allowed: ReadonlySet<string> = new Set(WORKSPACE_IDS)

export function workspaceFromHash(hash: string): WorkspaceId {
  let candidate = hash.trim().replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase()
  if (candidate === 'signals') candidate = 'analytics'
  if (candidate === 'main-content') candidate = 'overview'
  return allowed.has(candidate) ? candidate as WorkspaceId : 'overview'
}

export function workspaceHref(workspace: WorkspaceId): string {
  return `#/${workspace}`
}
