import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createActionWorkflow, normalizeActionRef, normalizeActionRepository } from '../../src/lib/actionWorkflow.mjs'

test('generates a manual read-only workflow with the published v1.9.0 tag', () => {
  const output = createActionWorkflow()
  assert.match(output, /workflow_dispatch:/)
  assert.match(output, /uses: kobrymoataz\/repoverity@v1\.9\.0/)
  assert.match(output, /repository: \$\{\{ github\.repository \}\}/)
  assert.match(output, /contents: read/)
  assert.doesNotMatch(output, /  push:/)
  assert.doesNotMatch(output, /actions: write|contents: write/)
})
test('main-branch trigger is opt-in and deterministic', () => {
  const value = createActionWorkflow({trigger:'main-push'})
  assert.match(value, /push:\n    branches: \[main\]/)
  assert.equal(value, createActionWorkflow({trigger:'main-push'}))
})
test('scoped workflow requests Actions read only for run sampling', () => {
  const defaultText = createActionWorkflow()
  const runsText = createActionWorkflow({includeRuns:true})
  assert.doesNotMatch(defaultText, /  actions: read/)
  assert.match(runsText, /  actions: read/)
  assert.match(runsText, /include_runs: 'true'/)
})
test('review failure is advisory unless the user selects strict', () => {
  assert.match(createActionWorkflow(), /fail_on_review: 'false'/)
  assert.match(createActionWorkflow({failOnReview:true}), /fail_on_review: 'true'/)
})
test('optional report artifact is explicitly requested, not the default', () => {
  assert.doesNotMatch(createActionWorkflow(), /upload-artifact/)
  const value=createActionWorkflow({uploadArtifact:true})
  assert.match(value, /if: always\(\)/)
  assert.match(value, /actions\/upload-artifact@v4/)
  assert.match(value, /retention-days: 7/)
})
test('repository normalization prevents YAML and expression injection', () => {
  for(const bad of ['owner/repo\npermissions:','other://host/foo','owner/repo # comment','owner/${{secrets.A}}','/repo','owner/','owner/..','owner/name.git','x/x/y']) {
    assert.equal(normalizeActionRepository(bad),null,bad)
    assert.throws(()=>createActionWorkflow({repository:bad}))
  }
  assert.equal(normalizeActionRepository('my-team/repo_1'), 'my-team/repo_1')
  assert.match(createActionWorkflow({repository:'my-team/repo_1'}), /repository: my-team\/repo_1/)
})
test('rejects untrusted tag ref syntax and accepts pinned commit SHA', () => {
  for(const bad of ['main','v2','@v2.0.0','v2.0.0\nrun: echo','latest',' v1.9.0','v2.0.0;hello','v2.01.0']) {
    assert.equal(normalizeActionRef(bad),null,bad)
    assert.throws(()=>createActionWorkflow({ref:bad}))
  }
  const sha = 'a'.repeat(40)
  assert.match(createActionWorkflow({ref:sha}),new RegExp(`@${sha}`))
})
test('an explicitly empty repository or SHA is not silently replaced with the default', () => {
  assert.equal(normalizeActionRepository(''),null)
  assert.equal(normalizeActionRef(''),null)
  assert.throws(()=>createActionWorkflow({repository:''}),/repository/)
  assert.throws(()=>createActionWorkflow({ref:''}),/tag|SHA/)
  assert.match(createActionWorkflow(),/uses: kobrymoataz\/repoverity@v1\.9\.0/)
})
test('invalid trigger or nonboolean flags fail closed', () => {
  assert.throws(()=>createActionWorkflow({trigger:'pull_request'}),/trigger/)
  assert.throws(()=>createActionWorkflow({uploadArtifact:'true'}),/uploadArtifact/)
  assert.throws(()=>createActionWorkflow({includeRuns:1}),/includeRuns/)
})
test('CLI supports stdout without touching the repository', () => {
  const output=spawnSync(process.execPath,['tools/workflow.mjs','--repo','owner/project','--include-runs','--strict'],{encoding:'utf8'})
  assert.equal(output.status,0,output.stderr)
  assert.match(output.stdout,/repository: owner\/project/)
  assert.match(output.stdout,/fail_on_review: 'true'/)
})
test('CLI refuses invalid options and arbitrary paths', () => {
  let output=spawnSync(process.execPath,['tools/workflow.mjs','--bad-option'],{encoding:'utf8'})
  assert.equal(output.status,1)
  output=spawnSync(process.execPath,['tools/workflow.mjs','--output','../../outside.yml'],{encoding:'utf8'})
  assert.equal(output.status,1)
})
test('CLI cannot write via symlinked output directories',()=>{
  const root=mkdtempSync(join(tmpdir(),'rv-cli-root-'))
  const outside=mkdtempSync(join(tmpdir(),'rv-cli-outside-'))
  try{
    symlinkSync(outside,join(root,'elsewhere'))
    const cli=new URL('../../tools/workflow.mjs',import.meta.url).pathname
    const testRun=spawnSync(process.execPath,[cli,'--output','elsewhere/a.yml'],{cwd:root,encoding:'utf8'})
    assert.equal(testRun.status,1)
    assert.match(testRun.stderr,/escapes/)
  }finally{rmSync(root,{force:true,recursive:true});rmSync(outside,{force:true,recursive:true})}
})
test('CLI file output avoids accidental overwrites',()=>{
  const folder=mkdtempSync(join(tmpdir(),'rv-action-'))
  try {
    const dest=join(folder,'example.yml')
    const first=spawnSync(process.execPath,['tools/workflow.mjs','--output',dest],{encoding:'utf8'})
    assert.equal(first.status,1,'absolute output paths must be rejected')
    const relativePath='release-test.yml'
    const ok=spawnSync(process.execPath,[new URL('../../tools/workflow.mjs',import.meta.url).pathname,'--output',relativePath],{cwd:folder,encoding:'utf8'})
    assert.equal(ok.status,0,ok.stderr)
    assert.match(readFileSync(join(folder,relativePath),'utf8'),/uses: kobrymoataz\/repoverity/)
    const retry=spawnSync(process.execPath,[new URL('../../tools/workflow.mjs',import.meta.url).pathname,'--output',relativePath],{cwd:folder,encoding:'utf8'})
    assert.equal(retry.status,1)
  }finally {rmSync(folder,{force:true,recursive:true})}
})
