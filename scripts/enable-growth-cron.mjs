import {readFileSync,writeFileSync,existsSync,copyFileSync,renameSync,unlinkSync,constants} from 'node:fs'
const name='wrangler.jsonc'
const cron='15 7 * * *'
if(!existsSync(name)){
  console.error('wrangler.jsonc does not exist. Configure the Cloudflare Worker first; see docs/CLOUD_V1_6.md.')
  process.exit(1)
}
let original,config
try{
  original=readFileSync(name,'utf8')
  config=JSON.parse(original)
}catch{
  console.error('Could not safely parse your custom Wrangler JSONC. Add triggers.crons manually; no file was changed.')
  process.exit(1)
}
if(!config || typeof config!=='object' || !config.d1_databases?.some?.(db=>db.binding==='DB')){
  console.error('Expected a Wrangler D1 binding named DB. No file was changed.')
  process.exit(1)
}
if(config.triggers && (!Array.isArray(config.triggers.crons) || config.triggers.crons.some(item=>typeof item!=='string'))){
  console.error('Unexpected triggers configuration. No file was changed.')
  process.exit(1)
}
config.triggers??={crons:[]}
if(config.triggers.crons.includes(cron)){
  console.log('Daily 07:15 UTC growth trigger is already configured. No changes needed.')
  process.exit(0)
}
config.triggers.crons.push(cron)
try{
  // Write a private backup, then replace the original through an atomic rename.
  copyFileSync(name,name+'.growth-backup',constants.COPYFILE_EXCL)
  writeFileSync(name+'.growth-next',JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600})
  renameSync(name+'.growth-next',name)
}catch{
  try{if(existsSync(name+'.growth-next'))unlinkSync(name+'.growth-next')}catch{}
  console.error('Could not safely update the private Wrangler config. Check for a previous backup.')
  process.exit(1)
}
console.log('Added UTC Cron Trigger to gitignored wrangler.jsonc. Review and redeploy the Worker.')
