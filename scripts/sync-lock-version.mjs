import {readFileSync,writeFileSync} from 'node:fs'
const name='package-lock.json'
let lock
try{lock=JSON.parse(readFileSync(name,'utf8'))}
catch{console.error('package-lock.json is missing or not valid JSON. Run npm install --package-lock-only from the repository.');process.exit(1)}
if(!lock.packages || !lock.packages[''] || lock.packages[''].name!=='repoverity'){
  console.error('Lockfile is not for RepoVerity. No file changed.');process.exit(1)
}
const versions=[lock.version,lock.packages[''].version]
if(versions.some(value=>value!=='1.6.0' && value!=='1.7.0')){
  console.error('Unexpected lockfile version. No file changed.');process.exit(1)
}
lock.version='1.7.0'
lock.packages[''].version='1.7.0'
writeFileSync(name,JSON.stringify(lock,null,2)+'\n')
console.log('Synchronized npm lockfile metadata to 1.7.0. No dependencies changed.')
