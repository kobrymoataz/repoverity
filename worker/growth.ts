import type { CloudEnv, D1Database } from './db.ts'
import { validFullName } from './validation.ts'

export const MAX_GROWTH_TARGETS = 20
export const GROWTH_RETENTION_DAYS = 730
export const GROWTH_JOB_LIMIT = 18
export const GROWTH_MANUAL_COOLDOWN = 6 * 3600
export const GROWTH_INTERVAL = 24 * 3600
const MILESTONES = [10,25,50,100,250,500,1000,2500,5000,10000,25000,50000,100000,250000,500000,1000000]

type GrowthKind = 'profile' | 'repository'
type GrowthStatus = 'pending' | 'ok' | 'limited' | 'not_found' | 'error'
export type GrowthTarget = {
  id: string; user_id: number; kind: GrowthKind; resource: string; created_at: number;
  next_due_at: number; last_attempt_at: number | null; last_success_at: number | null;
  last_status: GrowthStatus;
}
export type GrowthObservation = {
  observed_day: string; observed_at: number; followers: number | null;
  public_repos: number | null; stars: number | null; forks: number | null;
}
export type GrowthMilestone = { metric: 'followers' | 'stars'; threshold: number; observed_at: number }
export type GrowthHistory = { target: GrowthTarget; observations: GrowthObservation[]; milestones: GrowthMilestone[] }
export type CaptureOutcome = { status: 'ok'|'limited'|'not_found'|'error'; observed_day?:string }

export function validGrowthResource(kind: unknown, raw: unknown): { kind: GrowthKind; resource: string } | null {
  if (kind !== 'profile' && kind !== 'repository') return null
  if (typeof raw !== 'string') return null
  const input = raw.trim()
  if (kind === 'profile') {
    if (input.length > 39 || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(input)) return null
    if (input.includes('--')) return null
    return { kind, resource: input.toLowerCase() }
  }
  const valid = validFullName(input)
  return valid ? { kind, resource: valid.toLowerCase() } : null
}

export function validGrowthId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw)
    ? raw.toLowerCase() : null
}

export async function listGrowthTargets(db: D1Database, userId: number): Promise<GrowthTarget[]> {
  const result = await db.prepare(`SELECT id,user_id,kind,resource,created_at,next_due_at,last_attempt_at,last_success_at,last_status
    FROM growth_targets WHERE user_id=? ORDER BY created_at ASC LIMIT ?`)
    .bind(userId,MAX_GROWTH_TARGETS).all<GrowthTarget>()
  return result.results
}

export async function createGrowthTarget(db:D1Database, userId:number, kind:GrowthKind, resource:string, now:number):Promise<GrowthTarget|null> {
  const id = crypto.randomUUID()
  const result = await db.prepare(`INSERT INTO growth_targets(id,user_id,kind,resource,created_at,next_due_at)
    SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM growth_targets WHERE user_id=?) < ?
    ON CONFLICT(user_id,kind,resource) DO NOTHING`)
    .bind(id,userId,kind,resource,now,now,userId,MAX_GROWTH_TARGETS).run()
  if(!result.meta?.changes) return null
  return db.prepare(`SELECT id,user_id,kind,resource,created_at,next_due_at,last_attempt_at,last_success_at,last_status
    FROM growth_targets WHERE id=? AND user_id=?`).bind(id,userId).first<GrowthTarget>()
}

export async function deleteGrowthTarget(db:D1Database,userId:number,id:string):Promise<boolean> {
  const result = await db.prepare('DELETE FROM growth_targets WHERE id=? AND user_id=?').bind(id,userId).run()
  return Boolean(result.meta?.changes)
}

export async function readGrowthHistory(db:D1Database,userId:number,id:string):Promise<GrowthHistory|null> {
  const target = await db.prepare(`SELECT id,user_id,kind,resource,created_at,next_due_at,last_attempt_at,last_success_at,last_status
    FROM growth_targets WHERE id=? AND user_id=?`).bind(id,userId).first<GrowthTarget>()
  if(!target)return null
  const observations = await db.prepare(`SELECT observed_day,observed_at,followers,public_repos,stars,forks
    FROM growth_observations WHERE target_id=? AND observed_at>=? ORDER BY observed_day ASC LIMIT ?`)
    .bind(id,Math.floor(Date.now()/1000)-GROWTH_RETENTION_DAYS*86400,GROWTH_RETENTION_DAYS+1).all<GrowthObservation>()
  const milestones = await db.prepare(`SELECT metric,threshold,observed_at FROM growth_milestones
    WHERE target_id=? ORDER BY observed_at DESC,threshold DESC LIMIT 30`)
    .bind(id).all<GrowthMilestone>()
  return {target,observations:observations.results,milestones:milestones.results}
}

async function claimTarget(db:D1Database,id:string,userId:number|null,now:number):Promise<GrowthTarget|null> {
  const check = userId === null ? 'next_due_at<=?' : '(last_attempt_at IS NULL OR last_attempt_at<=?) AND user_id=?'
  const params = userId === null ? [now,now+GROWTH_INTERVAL,id,now] : [now,now+GROWTH_INTERVAL,id,now-GROWTH_MANUAL_COOLDOWN,userId]
  const result = await db.prepare(`UPDATE growth_targets SET last_attempt_at=?,next_due_at=? WHERE id=? AND ${check}`)
    .bind(...params).run()
  if(!result.meta?.changes)return null
  return db.prepare(`SELECT id,user_id,kind,resource,created_at,next_due_at,last_attempt_at,last_success_at,last_status
    FROM growth_targets WHERE id=?`).bind(id).first<GrowthTarget>()
}

export async function claimManualGrowth(db:D1Database,userId:number,id:string,now:number):Promise<GrowthTarget|null> {
  return claimTarget(db,id,userId,now)
}

function safeCount(value:unknown):number|null {
  return typeof value==='number' && Number.isSafeInteger(value) && value>=0 ? value : null
}

async function requestPublicSnapshot(env:CloudEnv,target:GrowthTarget, fetcher:typeof fetch):Promise<
  {status:'ok'; values:{followers:number|null;public_repos:number|null;stars:number|null;forks:number|null}}|
  {status:'limited'|'not_found'|'error'}> {
  const parts=target.resource.split('/')
  const apiPath=target.kind==='profile'
    ? `/users/${encodeURIComponent(parts[0])}`
    : `/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`
  const headers:Record<string,string>={
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'RepoVerity-Cloud/1.7',
  }
  if(env.GITHUB_PUBLIC_READ_TOKEN)headers.Authorization=`Bearer ${env.GITHUB_PUBLIC_READ_TOKEN}`
  let response:Response
  try { response=await fetcher('https://api.github.com'+apiPath,{headers,signal:AbortSignal.timeout(8000)}) }
  catch {return {status:'error'}}
  if(response.status===404)return {status:'not_found'}
  if(response.status===429 || response.status===403)return {status:'limited'}
  if(!response.ok)return {status:'error'}
  let payload:unknown
  try {payload=await response.json()} catch{return {status:'error'}}
  if(!payload || typeof payload!=='object' || Array.isArray(payload))return {status:'error'}
  const obj=payload as Record<string,unknown>
  if(target.kind==='profile') {
    const followers=safeCount(obj.followers), publicRepos=safeCount(obj.public_repos)
    if(followers===null || publicRepos===null)return {status:'error'}
    return {status:'ok',values:{followers,public_repos:publicRepos,stars:null,forks:null}}
  }
  const stars=safeCount(obj.stargazers_count),forks=safeCount(obj.forks_count)
  if(stars===null || forks===null)return {status:'error'}
  return {status:'ok',values:{followers:null,public_repos:null,stars,forks}}
}

async function recordCapture(db:D1Database,target:GrowthTarget,now:number,fetcher:typeof fetch,env:CloudEnv):Promise<CaptureOutcome> {
  const snapshot=await requestPublicSnapshot(env,target,fetcher)
  const day = new Date(now*1000).toISOString().slice(0,10)
  if(snapshot.status!=='ok') {
    const retry=snapshot.status==='not_found'?7*GROWTH_INTERVAL:snapshot.status==='limited'?GROWTH_INTERVAL:GROWTH_INTERVAL
    await db.prepare('UPDATE growth_targets SET last_status=?,next_due_at=? WHERE id=?')
      .bind(snapshot.status,now+retry,target.id).run()
    return {status:snapshot.status}
  }
  const previous=await db.prepare(`SELECT followers,stars FROM growth_observations
    WHERE target_id=? ORDER BY observed_day DESC LIMIT 1`)
    .bind(target.id).first<{followers:number|null;stars:number|null}>()
  const v=snapshot.values
  await db.prepare(`INSERT INTO growth_observations
    (target_id,observed_day,observed_at,followers,public_repos,stars,forks) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(target_id,observed_day) DO UPDATE SET
      observed_at=excluded.observed_at,followers=excluded.followers,public_repos=excluded.public_repos,
      stars=excluded.stars,forks=excluded.forks`)
    .bind(target.id,day,now,v.followers,v.public_repos,v.stars,v.forks).run()
  const metric=target.kind==='profile'?'followers':'stars'
  const oldCount=metric==='followers'?previous?.followers:previous?.stars
  const newCount=metric==='followers'?v.followers:v.stars
  if(oldCount!==null && oldCount!==undefined && newCount!==null) {
    for(const threshold of MILESTONES){
      if(oldCount<threshold && newCount>=threshold) {
        await db.prepare(`INSERT INTO growth_milestones(target_id,metric,threshold,observed_at)
          VALUES (?,?,?,?) ON CONFLICT(target_id,metric,threshold) DO NOTHING`)
          .bind(target.id,metric,threshold,now).run()
      }
    }
  }
  const beforeDay=new Date((now-GROWTH_RETENTION_DAYS*86400)*1000).toISOString().slice(0,10)
  await db.prepare('DELETE FROM growth_observations WHERE target_id=? AND observed_day<?').bind(target.id,beforeDay).run()
  await db.prepare(`UPDATE growth_targets SET last_status='ok',last_success_at=?,next_due_at=? WHERE id=?`)
    .bind(now,now+GROWTH_INTERVAL,target.id).run()
  return {status:'ok',observed_day:day}
}

export async function captureGrowth(db:D1Database,env:CloudEnv,target:GrowthTarget,now:number,fetcher:typeof fetch=fetch):Promise<CaptureOutcome> {
  return recordCapture(db,target,now,fetcher,env)
}

export type ScheduledGrowthResult={attempted:number;success:number;limited:boolean;errors:number}
export async function runScheduledGrowth(env:CloudEnv, now:number,fetcher:typeof fetch=fetch):Promise<ScheduledGrowthResult> {
  await env.DB.prepare('DELETE FROM growth_observations WHERE observed_at<?')
    .bind(now-GROWTH_RETENTION_DAYS*86400).run()
  const due=await env.DB.prepare(`SELECT id FROM growth_targets WHERE next_due_at<=?
    ORDER BY next_due_at ASC,created_at ASC LIMIT ?`).bind(now,GROWTH_JOB_LIMIT).all<{id:string}>()
  const result={attempted:0,success:0,limited:false,errors:0}
  for(const row of due.results){
    const target=await claimTarget(env.DB,row.id,null,now)
    if(!target)continue
    result.attempted++
    const outcome=await captureGrowth(env.DB,env,target,now,fetcher)
    if(outcome.status==='ok')result.success++
    else if(outcome.status==='limited'){result.limited=true;break}
    else result.errors++
  }
  return result
}
