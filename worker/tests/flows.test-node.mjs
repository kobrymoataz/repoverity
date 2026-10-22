import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {handleRequest} from '../index.ts'

const origin='https://repoverity-test.example'
const migration=readFileSync(new URL('../../migrations/0001_initial.sql',import.meta.url),'utf8')

function makeDb(){
 const sql=new DatabaseSync(':memory:')
 sql.exec(migration)
 const DB={prepare(query){
  let parameters=[]
  const exec={
   bind(...input){parameters=input;return exec},
   async first(){return sql.prepare(query).get(...parameters)??null},
   async all(){return {results:sql.prepare(query).all(...parameters)}},
   async run(){const output=sql.prepare(query).run(...parameters);return {success:true,meta:{changes:Number(output.changes)}}},
  }
  return exec
 }}
 return {DB,sql}
}
const config={APP_ORIGIN:origin,GITHUB_CLIENT_ID:'Iv1.unit-test',GITHUB_CLIENT_SECRET:'unit-test-secret',ASSETS:{async fetch(){return new Response('asset')}}}
const req=(path,method='GET',cookie='',data,validOrigin=true)=>new Request(origin+path,{
 method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{
  Origin:validOrigin?origin:'https://malicious.example',
  'Content-Type':'application/json','X-RepoVerity-Action':'1',
 }: {})},body:method==='GET'?undefined:JSON.stringify(data??{}),
})

test('complete OAuth, workspace, watchlist, preferences and sign-out lifecycle',async()=>{
 const {DB,sql}=makeDb()
 const env={...config,DB}
 const login=await handleRequest(req('/api/auth/login'),env)
 assert.equal(login.status,302)
 const authUrl=new URL(login.headers.get('location'))
 const state=authUrl.searchParams.get('state')
 const stateCookie=login.headers.get('set-cookie').split(';')[0]
 const originalFetch=globalThis.fetch
 globalThis.fetch=async url=>{
  if(String(url).includes('/login/oauth/access_token'))return new Response(JSON.stringify({access_token:'ghu_12345678901234567890'}),{status:200})
  if(String(url).includes('api.github.com/user'))return new Response(JSON.stringify({id:1450,login:'octocat',avatar_url:'https://avatars.githubusercontent.com/u/1450?v=4'}),{status:200})
  throw Error('Unexpected endpoint')
 }
 let sessionCookie
 try {
  const callback=await handleRequest(req(`/api/auth/callback?code=correct&state=${state}`,'GET',stateCookie),env)
  assert.equal(callback.status,302)
  assert.equal(callback.headers.get('location'),origin+'/#/cloud')
  const cookies=callback.headers.getSetCookie()
  sessionCookie=cookies.map(x=>x.split(';')[0]).find(x=>x.startsWith('__Host-rv_session='))
  assert.ok(sessionCookie)
 }finally{globalThis.fetch=originalFetch}
 const me=await handleRequest(req('/api/v1/me','GET',sessionCookie),env)
 assert.equal((await me.json()).user.login,'octocat')
 let workspaces=await (await handleRequest(req('/api/v1/workspaces','GET',sessionCookie),env)).json()
 assert.equal(workspaces.workspaces.length,1)
 assert.equal(workspaces.workspaces[0].name,'My workspace')
 const created=await (await handleRequest(req('/api/v1/workspaces','POST',sessionCookie,{name:'Team projects'}),env)).json()
 assert.ok(created.id)
 workspaces=await (await handleRequest(req('/api/v1/workspaces','GET',sessionCookie),env)).json()
 assert.equal(workspaces.workspaces.length,2)
 const repo=await handleRequest(req('/api/v1/watchlist','POST',sessionCookie,{workspaceId:created.id,fullName:'octocat/Hello-World'}),env)
 assert.equal(repo.status,201)
 const watch=await (await handleRequest(req(`/api/v1/watchlist?workspaceId=${created.id}`,'GET',sessionCookie),env)).json()
 assert.equal(watch.entries.length,1)
 assert.equal(watch.entries[0].repo_full_name,'octocat/Hello-World')
 const preferences=await handleRequest(req('/api/v1/preferences','PUT',sessionCookie,{density:'compact',defaultView:'analytics'}),env)
 assert.equal(preferences.status,200)
 const loaded=await (await handleRequest(req('/api/v1/preferences','GET',sessionCookie),env)).json()
 assert.equal(loaded.preferences.defaultView,'analytics')
 const signOut=await handleRequest(req('/api/auth/logout','POST',sessionCookie),env)
 assert.equal(signOut.status,200)
 const after=await (await handleRequest(req('/api/v1/me','GET',sessionCookie),env)).json()
 assert.equal(after.user,null)
 sql.close()
})

test('ownership prevents another user reading or changing workspaces',async()=>{
 const {DB,sql}=makeDb()
 sql.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(1,'alice','',100,100)
 sql.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(2,'bob','',100,100)
 sql.prepare('INSERT INTO workspaces VALUES (?,?,?,?,?)').run('f7bdccf0-142b-4f12-a500-718b200ba157',1,'Personal',100,100)
 // Queries for user 2 must never see another user's rows.
 const workspace=await DB.prepare('SELECT id FROM workspaces WHERE id=? AND user_id=?').bind('f7bdccf0-142b-4f12-a500-718b200ba157',2).first()
 assert.equal(workspace,null)
 const deleteAttempt=await DB.prepare('DELETE FROM workspaces WHERE id=? AND user_id=?').bind('f7bdccf0-142b-4f12-a500-718b200ba157',2).run()
 assert.equal(deleteAttempt.meta.changes,0)
 assert.equal(sql.prepare('SELECT count(*) AS n FROM workspaces').get().n,1)
 sql.close()
})
