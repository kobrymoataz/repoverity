import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {validateQueueFields,listQueue,upsertQueue,removeQueue,MAX_QUEUE_RECORDS} from '../maintainerQueue.ts'
import {handleRequest} from '../index.ts'
import {tokenHash} from '../auth.ts'
const origin='https://repoverity.example'
async function fixture(){
  const sql=new DatabaseSync(':memory:')
  for(const file of ['0001_initial.sql','0002_growth_history.sql','0003_maintainer_queue.sql'])sql.exec(readFileSync(new URL(`../../migrations/${file}`,import.meta.url),'utf8'))
  const now=Math.floor(Date.now()/1000)
  for(const id of [1,2])sql.prepare('INSERT INTO users(github_id,login,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?)').run(id,`user${id}`,'',now,now)
  const token='c'.repeat(64)
  sql.prepare('INSERT INTO sessions(token_hash,github_id,created_at,expires_at) VALUES (?,?,?,?)').run(await tokenHash(token),1,now,now+3600)
  const DB={prepare(q){let values=[];const stmt={bind(...items){values=items;return stmt},async first(){return sql.prepare(q).get(...values)??null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){const a=sql.prepare(q).run(...values);return {success:true,meta:{changes:Number(a.changes)}}}};return stmt}}
  const env={DB,APP_ORIGIN:origin,GITHUB_CLIENT_ID:'test',GITHUB_CLIENT_SECRET:'secret',ASSETS:{async fetch(){return new Response('static')}}}
  const req=(path,method='GET',body,authenticated=true,goodOrigin=true)=>new Request(origin+path,{method,headers:{...(authenticated?{Cookie:`__Host-rv_session=${token}`}:{}) ,...(method==='GET'?{}:{Origin:goodOrigin?origin:'https://outside.example','Content-Type':'application/json','X-RepoVerity-Action':'1'})},body:method==='GET'?undefined:JSON.stringify(body??{})})
  return {sql,DB,env,req}
}
const item={repo:'octocat/hello-world',kind:'issue',number:42,stage:'next',note:'Review reproduction'}
test('validates queue records before any database writes',()=>{
  assert.deepEqual(validateQueueFields(item),item)
  for(const bad of [{...item,repo:'https://evil.example/x'},{...item,number:0},{...item,stage:'admin'},{...item,note:'a'.repeat(601)},{...item,unknown:true}])assert.equal(validateQueueFields(bad),null)
})
test('users can store personal notes and update stages without duplicates',async()=>{
  const {DB,sql}=await fixture()
  assert.equal(await upsertQueue(DB,1,item,100),true)
  assert.equal(await upsertQueue(DB,1,{...item,stage:'waiting',note:'Follow up'},200),true)
  assert.equal((await listQueue(DB,1,item.repo)).length,1)
  assert.equal((await listQueue(DB,1,item.repo))[0].stage,'waiting')
  assert.equal((await listQueue(DB,2,item.repo)).length,0)
  assert.equal(await removeQueue(DB,2,item),false)
  assert.equal(await removeQueue(DB,1,item),true)
  sql.close()
})
test('global 150 record ceiling is enforced across repositories',async()=>{
  const {DB,sql}=await fixture()
  for(let i=1;i<=MAX_QUEUE_RECORDS;i++)assert.equal(await upsertQueue(DB,1,{...item,number:i},i),true)
  assert.equal(await upsertQueue(DB,1,{...item,number:MAX_QUEUE_RECORDS+1},200),false)
  assert.equal(await upsertQueue(DB,1,{...item,number:1,stage:'done'},201),true)
  assert.equal((await listQueue(DB,1,item.repo)).length,MAX_QUEUE_RECORDS)
  sql.close()
})
test('deleting account cascades to private worklist',async()=>{
  const {DB,sql}=await fixture()
  await upsertQueue(DB,1,item,100)
  sql.prepare('DELETE FROM users WHERE github_id=?').run(1)
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM maintainer_queue').get().n,0)
  sql.close()
})
test('API requires session, validates origin, and supports private lifecycle',async()=>{
  const {env,req,sql}=await fixture()
  const path='/api/v1/maintainer/queue'
  assert.equal((await handleRequest(req(path,'GET',null,false),env)).status,401)
  assert.equal((await handleRequest(req(path,'POST',item,false),env)).status,401)
  assert.equal((await handleRequest(req(path,'POST',item,true,false),env)).status,403)
  assert.equal((await handleRequest(req(path,'POST',{...item,number:-1}),env)).status,400)
  assert.equal((await handleRequest(req(path,'POST',item),env)).status,200)
  const response=await handleRequest(req(`${path}?repo=${encodeURIComponent(item.repo)}`),env)
  assert.equal(response.status,200)
  const list=await response.json()
  assert.equal(list.entries.length,1)
  assert.equal(list.entries[0].note,item.note)
  assert.equal((await handleRequest(req(path,'DELETE',item),env)).status,200)
  assert.equal((await handleRequest(req(path,'DELETE',item),env)).status,404)
  sql.close()
})
