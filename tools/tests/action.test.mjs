import test from 'node:test'
import assert from 'node:assert/strict'
import { runAction } from '../../action/index.mjs'
const repo={full_name:'octocat/demo', default_branch:'main', private:false, visibility:'public', html_url:'https://github.com/octocat/demo', owner:{login:'octocat'}, description:'Demo', license:{spdx_id:'MIT'}, archived:false, stargazers_count:2, forks_count:1}
function fixture() { return { fetcher:async url=>({ok:true,status:200,json:async()=>url.includes('/community/profile')?{files:{readme:null,contributing:null,security:null,issue_template:null,code_of_conduct:null}}:url.includes('/actions/workflows')?{total_count:1,workflows:[{state:'active'}]}:repo}) } }
test('Action respects workspace file bounds and emits summary and outputs', async () => {
  const f = fixture(), saves = [], appends = []
  const env = { GITHUB_REPOSITORY: 'octocat/demo', GITHUB_WORKSPACE: '/tmp/repotest', GITHUB_OUTPUT:'/tmp/github-output', GITHUB_STEP_SUMMARY:'/tmp/github-summary', INPUT_OUTPUT_PATH:'reports/audit.json', INPUT_FAIL_ON_REVIEW:'false' }
  const result = await runAction(env, { fetcher: f.fetcher, writeFile: async (...args)=>saves.push(args), appendFile: async (...args)=>appends.push(args) })
  assert.equal(result, 0)
  assert.equal(saves[0][0], '/tmp/repotest/reports/audit.json')
  assert.equal(appends.length, 2)
  assert.ok(appends[1][1].includes('review_count='))
})
test('Action refuses files outside repository workspace', async () => {
  const env = { GITHUB_REPOSITORY:'octocat/demo', GITHUB_WORKSPACE:'/tmp/repotest', INPUT_OUTPUT_PATH:'../secret.json' }
  await assert.rejects(runAction(env, { fetcher: fixture().fetcher }), /destination is invalid/)
})
test('Action review gate only fails when explicitly enabled', async () => {
  const base = { GITHUB_REPOSITORY: 'octocat/demo', GITHUB_WORKSPACE: '/tmp/repotest', INPUT_OUTPUT_PATH: 'audit.json', INPUT_FAIL_ON_REVIEW: 'true' }
  const code = await runAction(base, { fetcher: fixture().fetcher, writeFile: async () => {} })
  assert.equal(code, 2)
})
