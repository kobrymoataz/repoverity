import { readFileSync, writeFileSync } from 'node:fs'
const filename = 'package-lock.json'
let lock, pkg
try { lock = JSON.parse(readFileSync(filename,'utf8')); pkg = JSON.parse(readFileSync('package.json','utf8')) }
catch { console.error('Missing or invalid package files. No changes made.'); process.exit(1) }
const versions=['1.9.0','2.0.0','2.1.0']
if (pkg.name !== 'repoverity' || pkg.version !== '2.1.0' || lock.name !== 'repoverity' || lock.packages?.['']?.name !== 'repoverity' || !versions.includes(lock.version) || !versions.includes(lock.packages[''].version)) {
  console.error('Unexpected package identity or starting version. No changes made.'); process.exit(1)
}
for (const group of ['dependencies','devDependencies']) {
  const left=pkg[group] ?? {}, right=lock.packages[''][group] ?? {}
  if (JSON.stringify(Object.entries(left).sort()) !== JSON.stringify(Object.entries(right).sort())) {
    console.error(`Dependency mismatch in ${group}. No changes made.`);process.exit(1)
  }
}
lock.version='2.1.0';lock.packages[''].version='2.1.0'
writeFileSync(filename,JSON.stringify(lock,null,2)+'\n')
console.log('Synchronized package-lock.json version to 2.1.0. Dependencies unchanged.')
