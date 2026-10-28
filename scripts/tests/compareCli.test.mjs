import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../../tools/compare.mjs',import.meta.url))
const sample=(date,status)=>({schemaVersion:1,recordedAt:date,repository:{name:'kobrymoataz/repoverity'},summary:{pass:status==='pass'?1:0,review:status==='review'?1:0,unknown:status==='unknown'?1:0,info:status==='info'?1:0},checks:[{id:'readme',title:'README',section:'Docs',status,evidence:'Sample',recommendation:'Fix documentation'}]})
function fixture(before='pass',after='review'){
  const dir=mkdtempSync(join(tmpdir(),'rv-cmp-'))
  writeFileSync(join(dir,'before.json'),JSON.stringify(sample('2026-10-22T12:00:00.000Z',before)))
  writeFileSync(join(dir,'after.json'),JSON.stringify(sample('2026-10-24T12:00:00.000Z',after)))
  return {dir,run:(more=[])=>spawnSync(process.execPath,[root,'before.json','after.json',...more],{cwd:dir,encoding:'utf8'})}
}
describe('offline report comparison CLI',()=>{
  it('prints an advisory Markdown report with exit 0 by default',()=>{
    const f=fixture();const r=f.run()
    assert.equal(r.status,0);assert.match(r.stdout,/Regressions: 1/)
  })
  it('supports explicit fail-on-regressions with exit 2',()=>{
    const f=fixture();const r=f.run(['--fail-on-regressions'])
    assert.equal(r.status,2);assert.match(r.stderr,/Review required/)
  })
  it('never fails strict mode for only unknown evidence',()=>{
    const f=fixture('review','unknown');const r=f.run(['--fail-on-regressions'])
    assert.equal(r.status,0)
  })
  it('writes JSON once and refuses overwriting it',()=>{
    const f=fixture();const r=f.run(['--format','json','--output','comparison.json'])
    assert.equal(r.status,0);assert.equal(JSON.parse(readFileSync(join(f.dir,'comparison.json'),'utf8')).summary.regression,1)
    assert.equal(f.run(['--output','comparison.json']).status,1)
  })
  it('rejects path traversal and symlinked output directories',()=>{
    const f=fixture()
    assert.equal(f.run(['--output','../outside.md']).status,1)
    const dest=join(f.dir,'safe');mkdirSync(dest);symlinkSync(dest,join(f.dir,'unsafe'))
    assert.equal(f.run(['--output','unsafe/out.md']).status,1)
  })
  it('rejects invalid options without writing anything',()=>{
    const f=fixture();const r=f.run(['--delete'])
    assert.equal(r.status,1);assert.match(r.stderr,/Unknown option/)
  })
  it('prints usage with --help',()=>{
    const f=fixture();const r=spawnSync(process.execPath,[root,'--help'],{cwd:f.dir,encoding:'utf8'})
    assert.equal(r.status,0);assert.match(r.stdout,/Usage:/)
  })
})
