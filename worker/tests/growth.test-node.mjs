import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {
  MAX_GROWTH_TARGETS,GROWTH_MANUAL_COOLDOWN,validGrowthResource,validGrowthId,
  listGrowthTargets,createGrowthTarget,deleteGrowthTarget,readGrowthHistory,
  claimManualGrowth,captureGrowth,runScheduledGrowth,
} from '../growth.ts'

function makeDb(){
  const sql=new DatabaseSync(':memory:')
  for(const migration of ['0001_initial.sql','0002_growth_history.sql']){
    sql.exec(readFileSync(new URL(`../../migrations/${migration}`,import.meta.url),'utf8'))
  }
  for(const id of [1,2])sql.prepare('INSERT INTO users(github_id,login,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?)').run(id,`tester${id}`,'',100,100)
  const DB={prepare(q){let params=[];const stmt={bind(...values){params=values;return stmt},async first(){return sql.prepare(q).get(...params)??null},async all(){return {results:sql.prepare(q).all(...params)}},async run(){const x=sql.prepare(q).run(...params);return {success:true,meta:{changes:Number(x.changes)}}}};return stmt}}
  return {DB,sql,env:{DB,GITHUB_CLIENT_ID:'test',GITHUB_CLIENT_SECRET:'secret',APP_ORIGIN:'https://example.test',ASSETS:{async fetch(){return new Response('asset')}}}}
}
const now=1792800000
const makeFetch=(json,status=200,headers={})=>async()=>new Response(JSON.stringify(json),{status,headers})

test('strict profile and repository targets prevent arbitrary URLs',()=>{
  assert.deepEqual(validGrowthResource('profile',' OctoCat '),{kind:'profile',resource:'octocat'})
  assert.deepEqual(validGrowthResource('repository','OctoCat/Hello-World'),{kind:'repository',resource:'octocat/hello-world'})
  for(const bad of ['https://example.com','test--foo','space name','../../../secret',''])assert.equal(validGrowthResource('profile',bad),null)
  assert.equal(validGrowthResource('repository','../a'),null)
  assert.equal(validGrowthResource('organization','test'),null)
  assert.equal(validGrowthId('secret'),null)
})

test('targets are opt-in and are isolated by numeric GitHub user id',async()=>{
  const {DB,sql}=makeDb()
  const added=await createGrowthTarget(DB,1,'profile','octocat',now)
  assert.ok(added?.id)
  assert.equal((await listGrowthTargets(DB,2)).length,0)
  assert.equal(await readGrowthHistory(DB,2,added.id),null)
  assert.equal(await deleteGrowthTarget(DB,2,added.id),false)
  assert.equal(await createGrowthTarget(DB,1,'profile','octocat',now),null)
  assert.equal((await listGrowthTargets(DB,1)).length,1)
  assert.equal(await deleteGrowthTarget(DB,1,added.id),true)
  sql.close()
})

test('per-account target creation is strictly limited',async()=>{
  const {DB,sql}=makeDb()
  for(let i=0;i<MAX_GROWTH_TARGETS;i++)assert.ok(await createGrowthTarget(DB,1,'profile',`user${i}`,now))
  assert.equal(await createGrowthTarget(DB,1,'profile','overflow',now),null)
  sql.close()
})

test('a first capture creates one real day of history and does not invent milestones',async()=>{
  const {DB,sql,env}=makeDb()
  const t=await createGrowthTarget(DB,1,'profile','octocat',now)
  let called=''
  const fetcher=async url=>{called=String(url);return makeFetch({followers:24,public_repos:4})()}
  const claimed=await claimManualGrowth(DB,1,t.id,now)
  assert.ok(claimed)
  assert.equal((await captureGrowth(DB,env,claimed,now,fetcher)).status,'ok')
  assert.equal(called,'https://api.github.com/users/octocat')
  const history=await readGrowthHistory(DB,1,t.id)
  assert.equal(history.observations.length,1)
  assert.equal(history.observations[0].followers,24)
  assert.equal(history.observations[0].stars,null)
  assert.deepEqual(history.milestones,[])
  assert.equal(await claimManualGrowth(DB,1,t.id,now+GROWTH_MANUAL_COOLDOWN-1),null)
  sql.close()
})

test('next-day capture records deltas and crossed milestones exactly once',async()=>{
  const {DB,sql,env}=makeDb()
  const t=await createGrowthTarget(DB,1,'profile','octocat',now)
  const one=await claimManualGrowth(DB,1,t.id,now)
  await captureGrowth(DB,env,one,now,makeFetch({followers:24,public_repos:3}))
  const next=await claimManualGrowth(DB,1,t.id,now+86400)
  await captureGrowth(DB,env,next,now+86400,makeFetch({followers:53,public_repos:4}))
  const history=await readGrowthHistory(DB,1,t.id)
  assert.equal(history.observations.length,2)
  assert.deepEqual(history.milestones.map(x=>x.threshold).sort((a,b)=>a-b),[25,50])
  const same=await claimManualGrowth(DB,1,t.id,now+86400+GROWTH_MANUAL_COOLDOWN)
  await captureGrowth(DB,env,same,now+86400+GROWTH_MANUAL_COOLDOWN,makeFetch({followers:53,public_repos:4}))
  assert.equal((await readGrowthHistory(DB,1,t.id)).observations.length,2)
  assert.equal((await readGrowthHistory(DB,1,t.id)).milestones.length,2)
  sql.close()
})

test('repository snapshots use stars and forks and never substitute followers',async()=>{
  const {DB,sql,env}=makeDb()
  const t=await createGrowthTarget(DB,1,'repository','octocat/test-project',now)
  let path=''
  const claim=await claimManualGrowth(DB,1,t.id,now)
  await captureGrowth(DB,env,claim,now,async input=>{path=String(input);return makeFetch({stargazers_count:3,forks_count:2})()})
  assert.equal(path,'https://api.github.com/repos/octocat/test-project')
  const h=await readGrowthHistory(DB,1,t.id)
  assert.equal(h.observations[0].stars,3)
  assert.equal(h.observations[0].followers,null)
  sql.close()
})

test('GitHub 404 and malformed data never insert false zero observations',async()=>{
  const {DB,sql,env}=makeDb()
  const t=await createGrowthTarget(DB,1,'repository','octocat/private-repo',now)
  const claim=await claimManualGrowth(DB,1,t.id,now)
  assert.equal((await captureGrowth(DB,env,claim,now,makeFetch({message:'Not found'},404))).status,'not_found')
  assert.equal((await readGrowthHistory(DB,1,t.id)).observations.length,0)
  const next=await claimManualGrowth(DB,1,t.id,now+GROWTH_MANUAL_COOLDOWN)
  assert.equal((await captureGrowth(DB,env,next,now+GROWTH_MANUAL_COOLDOWN,makeFetch({stargazers_count:'42',forks_count:5}))).status,'error')
  assert.equal((await readGrowthHistory(DB,1,t.id)).observations.length,0)
  sql.close()
})

test('rate limited scheduled collections stop without hammering GitHub',async()=>{
  const {DB,sql,env}=makeDb()
  await createGrowthTarget(DB,1,'profile','firstuser',now)
  await createGrowthTarget(DB,1,'profile','seconduser',now)
  let requests=0
  const run=await runScheduledGrowth(env,now,async()=>{requests++;return makeFetch({message:'rate limited'},403,{'x-ratelimit-remaining':'0'})()})
  assert.equal(requests,1)
  assert.equal(run.attempted,1)
  assert.equal(run.limited,true)
  assert.equal((await listGrowthTargets(DB,1)).filter(t=>t.last_status==='pending').length,1)
  sql.close()
})

test('deleting a target or account cascades its observations and milestones',async()=>{
  const {DB,sql,env}=makeDb()
  const t=await createGrowthTarget(DB,1,'profile','octocat',now)
  await captureGrowth(DB,env,await claimManualGrowth(DB,1,t.id,now),now,makeFetch({followers:10,public_repos:2}))
  await captureGrowth(DB,env,await claimManualGrowth(DB,1,t.id,now+86400),now+86400,makeFetch({followers:25,public_repos:3}))
  assert.equal(sql.prepare('SELECT count(*) AS n FROM growth_milestones').get().n,1)
  sql.prepare('DELETE FROM users WHERE github_id=?').run(1)
  for(const table of ['growth_targets','growth_observations','growth_milestones'])assert.equal(sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0)
  sql.close()
})

test('scheduled collection respects the fixed global request cap',async()=>{
  const {DB,sql,env}=makeDb()
  for(let i=0;i<MAX_GROWTH_TARGETS;i++)await createGrowthTarget(DB,1,'profile',`testuser${i}`,now)
  let calls=0
  const result=await runScheduledGrowth(env,now,async()=>{calls++;return makeFetch({followers:2,public_repos:1})()})
  assert.equal(calls,18)
  assert.equal(result.attempted,18)
  assert.equal(result.success,18)
  assert.equal(sql.prepare("SELECT count(*) AS n FROM growth_targets WHERE last_status='pending'").get().n,2)
  sql.close()
})

test('expired measurements are not returned and are pruned on cron runs',async()=>{
  const {DB,sql,env}=makeDb()
  const current=Math.floor(Date.now()/1000)
  const target=await createGrowthTarget(DB,1,'profile','octocat',current+86400)
  const old=current-732*86400
  const oldDay=new Date(old*1000).toISOString().slice(0,10)
  sql.prepare('INSERT INTO growth_observations(target_id,observed_day,observed_at,followers,public_repos) VALUES (?,?,?,?,?)').run(target.id,oldDay,old,3,2)
  assert.equal((await readGrowthHistory(DB,1,target.id)).observations.length,0)
  const response=await runScheduledGrowth(env,current,async()=>{throw Error('Should not fetch, no target is due')})
  assert.equal(response.attempted,0)
  assert.equal(sql.prepare('SELECT count(*) AS n FROM growth_observations').get().n,0)
  sql.close()
})
