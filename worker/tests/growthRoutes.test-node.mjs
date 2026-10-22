import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import worker, {handleRequest} from '../index.ts'
import {tokenHash} from '../auth.ts'

const origin='https://repoverity-api.example'
async function fixture(){
  const sql=new DatabaseSync(':memory:')
  for(const path of ['0001_initial.sql','0002_growth_history.sql'])sql.exec(readFileSync(new URL(`../../migrations/${path}`,import.meta.url),'utf8'))
  const now=Math.floor(Date.now()/1000)
  sql.prepare('INSERT INTO users (github_id,login,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?)').run(1,'octocat','',now,now)
  sql.prepare('INSERT INTO users (github_id,login,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?)').run(2,'outsider','',now,now)
  const token='a'.repeat(64),hash=await tokenHash(token)
  sql.prepare('INSERT INTO sessions (token_hash,github_id,created_at,expires_at) VALUES (?,?,?,?)').run(hash,1,now,now+3600)
  const DB={prepare(q){let params=[];const stmt={bind(...values){params=values;return stmt},async first(){return sql.prepare(q).get(...params)??null},async all(){return {results:sql.prepare(q).all(...params)}},async run(){const x=sql.prepare(q).run(...params);return {success:true,meta:{changes:Number(x.changes)}}}};return stmt}}
  const env={DB,APP_ORIGIN:origin,GITHUB_CLIENT_ID:'github_id',GITHUB_CLIENT_SECRET:'github_secret',ASSETS:{async fetch(){return new Response('asset')}}}
  const req=(path,method='GET',data,authenticated=true,validOrigin=true)=>new Request(origin+path,{method,headers:{...(authenticated?{Cookie:`__Host-rv_session=${token}`}:{}) ,...(method==='GET'?{}:{Origin:validOrigin?origin:'https://evil.example','X-RepoVerity-Action':'1','Content-Type':'application/json'})},body:method==='GET'?undefined:JSON.stringify(data??{})})
  return {env,req,sql}
}

test('unauthenticated growth endpoints require a session',async()=>{
  const {env,req,sql}=await fixture()
  assert.equal((await handleRequest(req('/api/v1/growth/targets','GET',undefined,false),env)).status,401)
  assert.equal((await handleRequest(req('/api/v1/growth/targets','POST',{kind:'profile',resource:'octocat'},false),env)).status,401)
  sql.close()
})

test('growth endpoints reject cross-site mutations',async()=>{
  const {env,req,sql}=await fixture()
  assert.equal((await handleRequest(req('/api/v1/growth/targets','POST',{kind:'profile',resource:'octocat'},true,false),env)).status,403)
  sql.close()
})

test('growth target lifecycle works and validates resource input',async()=>{
  const {env,req,sql}=await fixture()
  assert.equal((await handleRequest(req('/api/v1/growth/targets','POST',{kind:'profile',resource:'https://evil.example'}),env)).status,400)
  const created=await handleRequest(req('/api/v1/growth/targets','POST',{kind:'profile',resource:'OctoCat'}),env)
  assert.equal(created.status,201)
  const target=(await created.json()).target
  assert.equal(target.resource,'octocat')
  const list=await (await handleRequest(req('/api/v1/growth/targets'),env)).json()
  assert.equal(list.targets.length,1)
  const history=await (await handleRequest(req(`/api/v1/growth/targets/${target.id}/history`),env)).json()
  assert.equal(history.history.observations.length,0)
  assert.equal((await handleRequest(req(`/api/v1/growth/targets/${target.id}`,'DELETE'),env)).status,200)
  assert.equal((await handleRequest(req(`/api/v1/growth/targets/${target.id}/history`),env)).status,404)
  sql.close()
})

test('failed live API capture records no invented history and honors cooldown',async()=>{
  const {env,req,sql}=await fixture()
  const {target}=await (await handleRequest(req('/api/v1/growth/targets','POST',{kind:'repository',resource:'octocat/hello-world'}),env)).json()
  const savedFetch=globalThis.fetch
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Not Found'}),{status:404})
  try {
    const captured=await handleRequest(req(`/api/v1/growth/targets/${target.id}/capture`,'POST'),env)
    assert.equal(captured.status,200)
    assert.equal((await captured.json()).outcome.status,'not_found')
    assert.equal((await handleRequest(req(`/api/v1/growth/targets/${target.id}/capture`,'POST'),env)).status,409)
    assert.equal((await (await handleRequest(req(`/api/v1/growth/targets/${target.id}/history`),env)).json()).history.observations.length,0)
  }finally{globalThis.fetch=savedFetch;sql.close()}
})

test('other users cannot capture or delete someone else target',async()=>{
  const {env,req,sql}=await fixture()
  const {target}=await (await handleRequest(req('/api/v1/growth/targets','POST',{kind:'profile',resource:'octocat'}),env)).json()
  const token='b'.repeat(64),now=Math.floor(Date.now()/1000)
  sql.prepare('INSERT INTO sessions (token_hash,github_id,created_at,expires_at) VALUES (?,?,?,?)').run(await tokenHash(token),2,now,now+3600)
  const req2=(path,method)=>new Request(origin+path,{method,headers:{Cookie:`__Host-rv_session=${token}`,Origin:origin,'X-RepoVerity-Action':'1'}})
  assert.equal((await handleRequest(req2(`/api/v1/growth/targets/${target.id}/capture`,'POST'),env)).status,409)
  assert.equal((await handleRequest(req2(`/api/v1/growth/targets/${target.id}`,'DELETE'),env)).status,404)
  assert.equal((await handleRequest(req2(`/api/v1/growth/targets/${target.id}/history`,'GET'),env)).status,404)
  sql.close()
})


test('Cloudflare scheduled handler records a real public observation',async()=>{
  const {env,req,sql}=await fixture()
  const {target}=await (await handleRequest(req('/api/v1/growth/targets','POST',{kind:'profile',resource:'octocat'}),env)).json()
  const original=globalThis.fetch
  let requests=0
  globalThis.fetch=async ()=>{requests++;return new Response(JSON.stringify({followers:7,public_repos:2}),{status:200})}
  try {
    await worker.scheduled({cron:'15 7 * * *',scheduledTime:Date.now()},env)
    assert.equal(requests,1)
    const history=await (await handleRequest(req(`/api/v1/growth/targets/${target.id}/history`),env)).json()
    assert.equal(history.history.observations.length,1)
    assert.equal(history.history.observations[0].followers,7)
  }finally{globalThis.fetch=original;sql.close()}
})
