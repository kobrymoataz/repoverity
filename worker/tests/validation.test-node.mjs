import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validWorkspaceName,validFullName,validPreferences,parseCookie,allowedOrigin,validPublicOrigin,validWorkspaceId } from '../validation.ts'

test('workspace names are bounded and control characters are rejected',()=>{
 assert.equal(validWorkspaceName('  Open  source '),'Open source')
 assert.equal(validWorkspaceName(''),null)
 assert.equal(validWorkspaceName('x'.repeat(49)),null)
 assert.equal(validWorkspaceName('hi\nthere'),null)
})
test('repository names require owner and repository',()=>{
 assert.equal(validFullName('octocat/Hello-World'),'octocat/Hello-World')
 assert.equal(validFullName('https://github.com/a/b'),null)
 assert.equal(validFullName('../oops'),null)
 assert.equal(validFullName('a/b?x=1'),null)
})
test('preferences are a strict whitelist',()=>{
 assert.deepEqual(validPreferences({defaultView:'analytics',density:'compact'}),{defaultView:'analytics',density:'compact'})
 assert.equal(validPreferences({defaultView:'analytics',density:'compact',admin:true}),null)
 assert.equal(validPreferences({defaultView:'fake',density:'compact'}),null)
})
test('cookies match exact key, not substring',()=>{
 assert.equal(parseCookie('abc_token=one; rv_token=two','rv_token'),'two')
 assert.equal(parseCookie('rv_token=','rv_token'),null)
})
test('CSRF origin comparison requires exact origin',()=>{
 assert.equal(allowedOrigin('https://repo.example','https://repo.example'),true)
 assert.equal(allowedOrigin('https://repo.example.attacker.test','https://repo.example'),false)
 assert.equal(allowedOrigin(null,'https://repo.example'),false)
})
test('public origin enforces HTTPS except local development',()=>{
 assert.equal(validPublicOrigin('https://repo.example'),true)
 assert.equal(validPublicOrigin('http://localhost:8787'),true)
 assert.equal(validPublicOrigin('http://repo.example'),false)
 assert.equal(validPublicOrigin('https://repo.example/path'),false)
})
test('workspaces require UUID keys',()=>{
 assert.equal(validWorkspaceId('db81c277-a410-4685-8e79-6991f2c93f5a'),'db81c277-a410-4685-8e79-6991f2c93f5a')
 assert.equal(validWorkspaceId('drop table sessions'),null)
})
