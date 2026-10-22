/** Shared, side-effect-free input guards for the Cloud API. */
export const MAX_WORKSPACES = 12
export const MAX_WATCHLIST_ITEMS = 100
export const MAX_JSON_BYTES = 8_192

export type CloudPreferences = {
  defaultView: 'overview' | 'repositories' | 'analytics' | 'growth'
  density: 'comfortable' | 'compact'
}

export const DEFAULT_PREFERENCES: CloudPreferences = {
  defaultView: 'overview',
  density: 'comfortable',
}

export function validWorkspaceName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  const clean = value.trim().replace(/\s+/g, ' ')
  if (clean.length < 1 || clean.length > 48) return null
  return clean
}

export function validFullName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 140) return null
  const match = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/([A-Za-z0-9_.-]{1,100})$/.exec(value.trim())
  return match ? `${match[1]}/${match[2]}` : null
}

export function validWorkspaceId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(value)
    ? value : null
}

export function validPreferences(input: unknown): CloudPreferences | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  if (!['overview','repositories','analytics','growth'].includes(String(value.defaultView))) return null
  if (!['comfortable','compact'].includes(String(value.density))) return null
  if (Object.keys(value).some(key => !['defaultView','density'].includes(key))) return null
  return {defaultView: value.defaultView as CloudPreferences['defaultView'],density: value.density as CloudPreferences['density']}
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index >= 0 && part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim()
      return value.length > 0 && value.length <= 256 ? value : null
    }
  }
  return null
}

export function allowedOrigin(candidate: string | null, expected: string): boolean {
  if (!candidate) return false
  try { return new URL(candidate).origin === new URL(expected).origin }
  catch { return false }
}

export function validPublicOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin)
    return !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
      (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) &&
      parsed.pathname === '/'
  } catch { return false }
}
