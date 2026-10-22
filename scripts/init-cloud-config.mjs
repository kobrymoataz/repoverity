import {readFileSync,writeFileSync} from 'node:fs'
import {URL} from 'node:url'
const [databaseId,origin,clientId]=process.argv.slice(2)
const help='Usage: node scripts/init-cloud-config.mjs DATABASE_UUID https://worker.example.workers.dev GITHUB_OAUTH_CLIENT_ID'
if(!databaseId||!origin||!clientId){console.error(help);process.exit(1)}
if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(databaseId)){console.error('Invalid database UUID.');process.exit(1)}
try{
 const url=new URL(origin)
 if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('bad origin')
}catch{console.error('APP_ORIGIN must be an HTTPS origin with no path.');process.exit(1)}
if(!/^[A-Za-z0-9_.-]{8,120}$/.test(clientId)){console.error('Invalid GitHub Client ID.');process.exit(1)}
const config=JSON.parse(readFileSync('wrangler.example.jsonc','utf8'))
config.d1_databases[0].database_id=databaseId
config.vars.APP_ORIGIN=origin.replace(/\/$/,'')
config.vars.GITHUB_CLIENT_ID=clientId
try{writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600})}
catch{console.error('wrangler.jsonc already exists. No file was overwritten.');process.exit(1)}
console.log('Created local wrangler.jsonc. Never commit OAuth secrets. Next: npx wrangler secret put GITHUB_CLIENT_SECRET')
