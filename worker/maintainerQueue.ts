import type { D1Database } from './db.ts'
import { validFullName } from './validation.ts'

export type QueueKind = 'issue' | 'pull'
export type QueueStage = 'inbox' | 'next' | 'waiting' | 'done'
export type QueueRecord = {
  repo: string; kind: QueueKind; number: number; stage: QueueStage; note: string; updated_at: number
}
export const MAX_QUEUE_RECORDS = 150
const STAGES: QueueStage[] = ['inbox','next','waiting','done']

export function validateQueueFields(body: Record<string, unknown> | null): Omit<QueueRecord,'updated_at'> | null {
  if (!body || Object.keys(body).some(key => !['repo','kind','number','stage','note'].includes(key))) return null
  const repo = validFullName(body.repo)?.toLowerCase()
  const kind = body.kind
  const number = body.number
  const stage = body.stage
  const note = body.note
  if (!repo || repo.endsWith('/..') || repo.endsWith('/.') || !['issue','pull'].includes(String(kind)) || typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0 || number > 999999999 || !STAGES.includes(stage as QueueStage) || typeof note !== 'string' || note.length > 600 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(note)) return null
  return {repo, kind: kind as QueueKind, number, stage:stage as QueueStage, note}
}
export function validateQueueIdentity(input: {repo: unknown;kind:unknown;number:unknown}):{repo:string;kind:QueueKind;number:number}|null {
  const repo = validFullName(input.repo)?.toLowerCase()
  const kind = input.kind
  const num = input.number
  if(!repo || repo.endsWith('/..') || repo.endsWith('/.') || (kind!=='issue'&&kind!=='pull') || typeof num!=='number' || !Number.isSafeInteger(num) || num<1 || num>999999999) return null
  return {repo,kind,number:num}
}
export async function listQueue(db:D1Database, userId:number,repo:string):Promise<QueueRecord[]> {
  const rows=await db.prepare(`SELECT repo_full_name AS repo,kind,item_number AS number,stage,note,updated_at
    FROM maintainer_queue WHERE user_id=? AND repo_full_name=? ORDER BY updated_at DESC LIMIT ?`)
    .bind(userId,repo,MAX_QUEUE_RECORDS).all<QueueRecord>()
  return rows.results
}
export async function upsertQueue(db:D1Database,userId:number,item:Omit<QueueRecord,'updated_at'>,now:number):Promise<boolean> {
  const result=await db.prepare(`INSERT INTO maintainer_queue(user_id,repo_full_name,kind,item_number,stage,note,updated_at)
    SELECT ?,?,?,?,?,?,? WHERE
    (SELECT COUNT(*) FROM maintainer_queue WHERE user_id=?) < ?
    OR EXISTS (SELECT 1 FROM maintainer_queue WHERE user_id=? AND repo_full_name=? AND kind=? AND item_number=?)
    ON CONFLICT(user_id,repo_full_name,kind,item_number)
    DO UPDATE SET stage=excluded.stage,note=excluded.note,updated_at=excluded.updated_at`)
    .bind(userId,item.repo,item.kind,item.number,item.stage,item.note,now,userId,MAX_QUEUE_RECORDS,userId,item.repo,item.kind,item.number).run()
  return Boolean(result.meta?.changes)
}
export async function removeQueue(db:D1Database,userId:number,item:{repo:string;kind:QueueKind;number:number}):Promise<boolean> {
  const result=await db.prepare(`DELETE FROM maintainer_queue WHERE user_id=? AND repo_full_name=? AND kind=? AND item_number=?`)
    .bind(userId,item.repo,item.kind,item.number).run()
  return Boolean(result.meta?.changes)
}
