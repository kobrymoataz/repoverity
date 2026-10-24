import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { inspectReleaseBuild } from '../verify-release-build.mjs'
function fixture(fn) {
 const root=mkdtempSync(join(tmpdir(),'rv-budget-'))
 try {mkdirSync(join(root,'assets'));writeFileSync(join(root,'assets/index-test.js'),'console.log(1)');writeFileSync(join(root,'assets/index-test.css'),'body{}');
 writeFileSync(join(root,'index.html'),'<html><head><meta name="description"><meta name="referrer"><link rel="canonical" href="x"><link rel="stylesheet" href="/repoverity/assets/index-test.css"></head><body><script src="/repoverity/assets/index-test.js"></script></body></html>');fn(root)} finally{rmSync(root,{recursive:true,force:true})}
}
test('accepts a small compiled Pages artifact',()=>fixture(root=>assert.deepEqual(inspectReleaseBuild(root).issues,[])))
test('blocks leaked Cloudflare deployment configuration',()=>fixture(root=>{writeFileSync(join(root,'wrangler.json'),'{}');assert.match(inspectReleaseBuild(root).issues.join(';'),/wrangler\.json/)}))
test('rejects missing assets rather than passing on HTML alone',()=>fixture(root=>{rmSync(join(root,'assets/index-test.js'));assert.match(inspectReleaseBuild(root).issues.join(';'),/Missing JavaScript/)}))
test('enforces gzip budgets for the main JavaScript asset',()=>fixture(root=>{writeFileSync(join(root,'assets/index-test.js'),randomBytes(230*1024));assert.match(inspectReleaseBuild(root).issues.join(';'),/budget/)}))
