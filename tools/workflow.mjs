#!/usr/bin/env node
import { openSync, writeFileSync, closeSync, realpathSync } from 'node:fs'
import { resolve, relative, isAbsolute, sep, extname, dirname } from 'node:path'
import { createActionWorkflow } from '../src/lib/actionWorkflow.mjs'

const help = `RepoVerity workflow generator
Usage: node tools/workflow.mjs [--repo owner/repo] [--ref v1.9.0|SHA] [--trigger manual|main-push] [--include-runs] [--strict] [--artifact] [--output relative.yml]
Without --output, the YAML is printed to stdout. Files are never overwritten.
`
function main(args) {
  const settings = {}
  let output = null
  for (let i=0; i<args.length; i++) {
    const key = args[i]
    if (key==='--help' || key==='-h') {process.stdout.write(help);return}
    if (key==='--include-runs') {settings.includeRuns=true;continue}
    if (key==='--strict') {settings.failOnReview=true;continue}
    if (key==='--artifact') {settings.uploadArtifact=true;continue}
    if (['--repo','--ref','--trigger','--output'].includes(key)) {
      const value=args[++i]
      if(!value || value.startsWith('--'))throw Error(`Missing value for ${key}`)
      if(key==='--repo') settings.repository=value
      if(key==='--ref') settings.ref=value
      if(key==='--trigger') settings.trigger=value
      if(key==='--output') output=value
      continue
    }
    throw Error(`Unknown option: ${key}`)
  }
  const text=createActionWorkflow(settings)
  if(output===null){process.stdout.write(text);return}
  if(isAbsolute(output)||output.startsWith('-') || output.includes('\\'))throw Error('The output must be a safe relative .yml/.yaml path.')
  const dest=resolve(process.cwd(),output)
  const rel=relative(process.cwd(),dest)
  if(!rel || rel==='..'||rel.startsWith('..'+sep)||extname(dest)!=='.yml'&&extname(dest)!=='.yaml')throw Error('Use a relative .yml/.yaml path inside the current directory.')
  const physicalRoot = realpathSync(process.cwd())
  const physicalParent = realpathSync(dirname(dest))
  if (physicalParent !== physicalRoot && !physicalParent.startsWith(physicalRoot + sep)) throw Error('Output directory escapes the current workspace.')
  let fd
  try{fd=openSync(dest,'wx',0o644);writeFileSync(fd,text,'utf8')}
  finally{if(fd!==undefined)closeSync(fd)}
  process.stdout.write(`Generated ${rel}\n`)
}
try{main(process.argv.slice(2))}catch(error){console.error(error.message);process.exitCode=1}
