import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compareEvidenceReports, comparisonOutput, parseEvidenceReport } from '../../src/lib/reportComparison.mjs'

const make = (date, rows, repository='kobrymoataz/repoverity') => {
  const checks = rows.map(([id,status,evidence='sample'],index)=>({id,status,evidence,title:`Check ${id}`,section:'Governance',recommendation:'Investigate | reason',url:null}))
  return {schemaVersion:1,toolVersion:'1.9.0',recordedAt:date,repository:{name:repository,url:`https://github.com/${repository}`},
    summary:{pass:checks.filter(x=>x.status==='pass').length,review:checks.filter(x=>x.status==='review').length,unknown:checks.filter(x=>x.status==='unknown').length,info:checks.filter(x=>x.status==='info').length},checks}
}
const early='2026-10-23T10:00:00.000Z';const late='2026-10-24T10:00:00.000Z'
describe('conservative report comparison',()=>{
  it('detects only observed pass-to-review transitions as regressions',()=>{
    const result=compareEvidenceReports(make(early,[['a','pass'],['b','unknown'],['c','info']]),make(late,[['a','review'],['b','review'],['c','review']]))
    assert.equal(result.summary.regression,1)
    assert.equal(result.summary.new_review,2)
    assert.deepEqual(result.changes.map(x=>x.kind),['regression','new-review','new-review'])
  })
  it('does not claim an improvement when review evidence is lost',()=>{
    const result=compareEvidenceReports(make(early,[['a','review'],['b','review'],['c','pass']]),make(late,[['a','unknown'],['b','info'],['c','unknown']]))
    assert.equal(result.summary.resolved,0)
    assert.equal(result.summary.evidence_lost,3)
  })
  it('does not treat a previously passing result becoming informational as a success',()=>{
    const result=compareEvidenceReports(make(early,[['a','pass']]),make(late,[['a','info']]))
    assert.equal(result.summary.evidence_lost,1)
    assert.equal(result.summary.resolved,0)
  })
  it('recognizes a genuine resolved review',()=>{
    const result=compareEvidenceReports(make(early,[['a','review']]),make(late,[['a','pass']]))
    assert.equal(result.summary.resolved,1)
    assert.equal(result.summary.regression,0)
  })
  it('marks newly observed passes but never calls them resolutions',()=>{
    const result=compareEvidenceReports(make(early,[['a','unknown'],['b','info']]),make(late,[['a','pass'],['b','pass']]))
    assert.equal(result.summary.newly_observed,2)
    assert.equal(result.summary.resolved,0)
  })
  it('distinguishes added and removed checks from results',()=>{
    const result=compareEvidenceReports(make(early,[['a','pass']]),make(late,[['b','pass']]))
    assert.equal(result.summary.removed,1);assert.equal(result.summary.added,1)
  })
  it('detects evidence updates without inventing a status change',()=>{
    const result=compareEvidenceReports(make(early,[['a','pass','old']]),make(late,[['a','pass','new']]))
    assert.equal(result.summary.changed,1)
    assert.equal(result.summary.regression,0)
  })
  it('is stable when there are no changes',()=>{
    const result=compareEvidenceReports(make(early,[['a','pass']]),make(late,[['a','pass']]))
    assert.equal(result.summary.unchanged,1)
    assert.equal(result.summary.regression,0)
  })
  it('never compares two different repositories',()=>assert.throws(()=>compareEvidenceReports(make(early,[['a','pass']]),make(late,[['a','pass']],'another/repo')),/same public/))
  it('requires chronological order',()=>assert.throws(()=>compareEvidenceReports(make(late,[['a','pass']]),make(early,[['a','review']])),/later/))
  it('rejects mismatched summary numbers',()=>{const report=make(early,[['a','pass']]);report.summary.pass=2;assert.throws(()=>parseEvidenceReport(report),/summary/)} )
  it('rejects repeated and malicious check identifiers',()=>{
    const report=make(early,[['a','pass'],['a','review']]);assert.throws(()=>parseEvidenceReport(report),/Duplicate/)
    report.checks[1].id='__proto__';assert.throws(()=>parseEvidenceReport(report),/Duplicate|Invalid check identifier/)
  })
  it('rejects unsupported schema and invalid timestamps',()=>{
    const report=make(early,[['a','pass']]);report.schemaVersion=2;assert.throws(()=>parseEvidenceReport(report),/schema/)
    report.schemaVersion=1;report.recordedAt='tomorrow';assert.throws(()=>parseEvidenceReport(report),/UTC ISO/)
  })
  it('rejects huge, invalid or empty imported JSON',()=>{
    assert.throws(()=>parseEvidenceReport('x'.repeat(512_001)),/limit/)
    assert.throws(()=>parseEvidenceReport('{oops'),/valid JSON/)
    const report=make(early,[['a','pass']]);report.checks=[];report.summary.pass=0;assert.throws(()=>parseEvidenceReport(report),/checks/)
  })
  it('supports 150 checks but rejects 151',()=>{
    const r=make(early,Array.from({length:150},(_,i)=>[`check-${i}`,'pass']))
    assert.equal(parseEvidenceReport(r).checks.length,150)
    r.checks.push({...r.checks[0],id:'extra'});r.summary.pass++
    assert.throws(()=>parseEvidenceReport(r),/150/)
  })
  it('escapes untrusted Markdown cells',()=>{
    const previous=make(early,[['a','review']]);const current=make(late,[['a','pass']]);current.checks[0].title='bad | name <x>'
    current.checks[0].recommendation='do `oops` now'
    const result=compareEvidenceReports(previous,current)
    const md=comparisonOutput(result,'markdown')
    assert.match(md,/bad \\\| name &lt;x&gt;/)
    assert.match(md,/do \\`oops\\` now/)
    assert.ok(!md.includes('<x>'))
  })
  it('produces deterministic JSON for CLI and browser exports',()=>{
    const result=compareEvidenceReports(JSON.stringify(make(early,[['a','pass']])),JSON.stringify(make(late,[['a','review']])))
    assert.equal(JSON.parse(comparisonOutput(result,'json')).summary.regression,1)
    assert.throws(()=>comparisonOutput(result,'xml'),/Supported comparison/)
  })
})
