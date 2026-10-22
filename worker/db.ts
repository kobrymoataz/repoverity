/** Minimal D1 types keep the public Vite frontend independent of Cloudflare packages. */
export interface D1Query {
  bind(...params: (string | number | null)[]): D1Query
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>
}
export interface D1Database {
  prepare(sql: string): D1Query
}
export interface CloudEnv {
  DB: D1Database
  ASSETS: { fetch(request: Request): Promise<Response> }
  APP_ORIGIN: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  GITHUB_PUBLIC_READ_TOKEN?: string
}

export type CloudUser = { github_id: number; login: string; avatar_url: string }
export type CloudWorkspace = {
  id: string; name: string; created_at: number; updated_at: number; watch_count: number
}
export type WatchEntry = { repo_full_name: string; added_at: number }

export async function saveUser(db: D1Database, githubId: number, login: string, avatar: string, now: number) {
  await db.prepare(`INSERT INTO users (github_id,login,avatar_url,created_at,updated_at)
    VALUES (?,?,?,?,?) ON CONFLICT(github_id) DO UPDATE SET
    login=excluded.login, avatar_url=excluded.avatar_url, updated_at=excluded.updated_at`)
    .bind(githubId, login, avatar, now, now).run()
}

export async function createSession(db: D1Database, id: number, hash: string, expiresAt: number, now: number) {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run()
  await db.prepare(`INSERT INTO sessions (token_hash,github_id,created_at,expires_at) VALUES (?,?,?,?)`)
    .bind(hash, id, now, expiresAt).run()
  // Keep up to five devices signed in. Older sessions are revoked first.
  await db.prepare(`DELETE FROM sessions WHERE token_hash IN
    (SELECT token_hash FROM sessions WHERE github_id=? ORDER BY created_at DESC, token_hash DESC LIMIT -1 OFFSET 5)`)
    .bind(id).run()
}

export async function findSession(db: D1Database, hash: string, now: number): Promise<CloudUser | null> {
  return db.prepare(`SELECT users.github_id,users.login,users.avatar_url
    FROM sessions JOIN users ON sessions.github_id=users.github_id
    WHERE token_hash=? AND sessions.expires_at>?`).bind(hash,now).first<CloudUser>()
}

export async function revokeSession(db: D1Database, hash: string) {
  await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hash).run()
}

export async function ensureDefaultWorkspace(db: D1Database, userId: number, now: number) {
  await db.prepare(`INSERT INTO workspaces (id,user_id,name,created_at,updated_at)
    SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE user_id=?)`)
    .bind(crypto.randomUUID(),userId,'My workspace',now,now,userId).run()
}

export async function listWorkspaces(db: D1Database, userId: number): Promise<CloudWorkspace[]> {
  const result=await db.prepare(`SELECT w.id,w.name,w.created_at,w.updated_at,
    (SELECT COUNT(*) FROM watchlist WHERE workspace_id=w.id) AS watch_count
    FROM workspaces w WHERE w.user_id=? ORDER BY w.created_at ASC`)
    .bind(userId).all<CloudWorkspace>()
  return result.results
}

export async function createWorkspace(db: D1Database, userId: number, name: string, now: number, limit: number) {
  const id = crypto.randomUUID()
  const result = await db.prepare(`INSERT INTO workspaces (id,user_id,name,created_at,updated_at)
    SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM workspaces WHERE user_id=?) < ?`)
    .bind(id,userId,name,now,now,userId,limit).run()
  return result.meta?.changes ? id : null
}

export async function renameWorkspace(db: D1Database,userId:number,id:string,name:string,now:number):Promise<boolean> {
  const result=await db.prepare('UPDATE workspaces SET name=?,updated_at=? WHERE id=? AND user_id=?')
    .bind(name,now,id,userId).run()
  return Boolean(result.meta?.changes)
}

export async function deleteWorkspace(db: D1Database,userId:number,id:string):Promise<boolean> {
  // Always retain at least one workspace.
  const result=await db.prepare(`DELETE FROM workspaces WHERE id=? AND user_id=?
    AND (SELECT COUNT(*) FROM workspaces WHERE user_id=?)>1`).bind(id,userId,userId).run()
  return Boolean(result.meta?.changes)
}

export async function listWatchlist(db:D1Database,userId:number,workspaceId:string):Promise<WatchEntry[]|null> {
  const workspace=await db.prepare('SELECT id FROM workspaces WHERE id=? AND user_id=?')
    .bind(workspaceId,userId).first<{id:string}>()
  if (!workspace) return null
  const result=await db.prepare('SELECT repo_full_name,added_at FROM watchlist WHERE workspace_id=? ORDER BY added_at DESC')
    .bind(workspaceId).all<WatchEntry>()
  return result.results
}

export async function addWatchlist(db:D1Database,userId:number,workspaceId:string,fullName:string,now:number,limit:number):Promise<boolean> {
  const result=await db.prepare(`INSERT INTO watchlist(workspace_id,repo_full_name,added_at)
    SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id=? AND user_id=?)
    AND (SELECT COUNT(*) FROM watchlist WHERE workspace_id=?) < ?
    ON CONFLICT(workspace_id,repo_full_name) DO NOTHING`)
    .bind(workspaceId,fullName,now,workspaceId,userId,workspaceId,limit).run()
  return Boolean(result.meta?.changes)
}

export async function removeWatchlist(db:D1Database,userId:number,workspaceId:string,fullName:string):Promise<boolean> {
  const result=await db.prepare(`DELETE FROM watchlist WHERE workspace_id=? AND repo_full_name=?
    AND EXISTS (SELECT 1 FROM workspaces WHERE id=? AND user_id=?)`)
    .bind(workspaceId,fullName,workspaceId,userId).run()
  return Boolean(result.meta?.changes)
}

export async function readPreferences(db:D1Database,userId:number):Promise<string|null> {
  const row=await db.prepare('SELECT content FROM preferences WHERE user_id=?').bind(userId).first<{content:string}>()
  return row?.content ?? null
}

export async function savePreferences(db:D1Database,userId:number,content:string,now:number) {
  await db.prepare(`INSERT INTO preferences (user_id,content,updated_at) VALUES (?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at`)
    .bind(userId,content,now).run()
}

export async function removeAccount(db:D1Database,userId:number) {
  // D1 enforces foreign keys; sessions, workspaces, watchlists and preferences cascade.
  await db.prepare('DELETE FROM users WHERE github_id=?').bind(userId).run()
}
