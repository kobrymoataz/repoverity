import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const timeoutMs = 15000
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(process.env.RV_E2E_DIST || join(repoRoot, 'dist'))
const chromeCandidates = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean)
const mime = { '.html':'text/html;charset=utf-8', '.js':'text/javascript;charset=utf-8', '.css':'text/css;charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png' }

function serve() {
  return createServer((req,res)=>{
    try {
      const url=new URL(req.url || '/', 'http://127.0.0.1')
      if (!['GET','HEAD'].includes(req.method) || !url.pathname.startsWith('/repoverity/')) {res.writeHead(404);res.end();return}
      const suffix=decodeURIComponent(url.pathname.slice('/repoverity/'.length))
      const path=resolve(dist, suffix || 'index.html')
      if (path !== dist && !path.startsWith(dist+sep)) {res.writeHead(403);res.end();return}
      if (!existsSync(path)) {res.writeHead(404);res.end();return}
      const data=readFileSync(path)
      res.writeHead(200, {'Content-Type':mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'})
      res.end(req.method==='HEAD' ? undefined : data)
    } catch {res.writeHead(400);res.end()}
  })
}
function getChrome() { const bin=chromeCandidates.find(existsSync); if (!bin) throw Error('Chrome or Chromium is required. Set CHROME_BIN to the local browser executable.');return bin }
async function startChrome(profile){
  const args=['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--no-proxy-server','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank']
  if(typeof process.getuid==='function' && process.getuid()===0) args.unshift('--no-sandbox')
  const child=spawn(getChrome(),args,{stdio:'ignore'})
  child.once('error',err=>{throw err})
  const path=join(profile,'DevToolsActivePort')
  let port
  for(let i=0;i<150;i++){
    if(child.exitCode!==null) throw Error(`Chromium exited during startup (${child.exitCode})`)
    if(existsSync(path)){const str=readFileSync(path,'utf8').split('\n')[0];port=Number(str);if(port>0)break}
    await sleep(100)
  }
  if(!port) throw Error('Chromium DevTools endpoint did not start')
  return {child,port}
}
async function openCDP(port,url){
  const reply=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})
  if(!reply.ok)throw Error(`Chromium target failed with HTTP ${reply.status}`)
  const info=await reply.json()
  const ws=new WebSocket(info.webSocketDebuggerUrl)
  const pending=new Map();const exceptions=[]
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
  let counter=0
  ws.addEventListener('message',event=>{
    try{const msg=JSON.parse(event.data)
      if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.text || 'JavaScript exception')
      if(msg.id && pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(Error(msg.error.message)):resolve(msg.result)}
    }catch(e){exceptions.push(String(e))}
  })
  function send(method,params={}){return new Promise((resolve,reject)=>{
    const id=++counter; pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error(`${method} timed out`))}},timeoutMs).unref?.()
  })}
  async function evaluate(expression){const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.text||'Browser JavaScript evaluation failed');return response.result?.value}
  async function waitFor(expression,ms=timeoutMs){const until=Date.now()+ms;let value;let lastError;while(Date.now()<until){try{value=await evaluate(expression);if(value)return value}catch(err){lastError=String(err)}await sleep(120)}const page=await evaluate('({href:location.href,title:document.title,text:document.body?.innerText.slice(0,250),ready:document.readyState})').catch(err=>String(err));throw Error(`Browser state not reached: ${expression.slice(0,110)}; page: ${JSON.stringify(page)}; last error: ${lastError}`)}
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  // The initial view and the new launch workspace must render without public network dependencies.
  await send('Network.setBlockedURLs',{urls:['https://api.github.com/*','https://avatars.githubusercontent.com/*']})
  return {ws,send,evaluate,waitFor,exceptions}
}
async function main(){
  if(!existsSync(join(dist,'index.html')))throw Error('Missing dist/index.html: run npm run build:pages first')
  const dir=mkdtempSync(join(tmpdir(),'repoverity-e2e-'))
  let chrome
  const server=serve()
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
    const port=server.address().port
    chrome=await startChrome(dir)
    const startUrl = process.env.RV_E2E_FIXTURE_URL || `http://127.0.0.1:${port}/repoverity/#/launch`
    const target=await openCDP(chrome.port,startUrl)
    const {ws,send,evaluate,waitFor,exceptions}=target
    await waitFor("document.querySelector('main#main-content h1')?.textContent === 'Launch readiness'")
    console.log('PASS: Production app boots on the launch workspace')
    await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Run public checks'))")
    const manual=await evaluate("document.querySelectorAll('.rv-launch input[type=checkbox]').length")
    if(manual<5) throw Error('Manual release checklist did not render')
    console.log('PASS: Read-only diagnostic controls and manual checklist render')
    await evaluate("document.querySelector('.rv-launch input[type=checkbox]').click()")
    await waitFor("document.querySelector('.rv-launch input[type=checkbox]')?.checked === true")
    await send('Page.reload',{ignoreCache:true})
    await waitFor("document.querySelector('main#main-content h1')?.textContent === 'Launch readiness'")
    await waitFor("document.querySelector('.rv-launch input[type=checkbox]')?.checked === true")
    console.log('PASS: Opt-in checklist persists on this device')
    await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Run public checks')).click()")
    await waitFor("Array.from(document.querySelectorAll('.rv-launch-status')).some(n=>n.textContent.includes('Unknown'))",9000)
    console.log('PASS: Blocked public network calls are labeled unknown')
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await sleep(350)
    const width=await evaluate('({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth})')
    if(width.scroll>width.viewport+4)throw Error(`Mobile layout overflows (${width.scroll} > ${width.viewport})`)
    console.log('PASS: 390px viewport has no horizontal page overflow')
    await evaluate("window.location.hash='#/tools'")
    await waitFor("document.querySelector('main#main-content h1')?.textContent === 'Developer tools'")
    await waitFor("document.querySelector('.rv-action-preview pre')?.textContent.includes('kobrymoataz/repoverity@v1.9.0')")
    console.log('PASS: V2.1 workflow wizard renders a published Action reference')
    await evaluate("document.querySelector('.rv-action-toggles input[type=checkbox]').click()")
    await waitFor("document.querySelector('.rv-action-preview pre')?.textContent.includes('actions: read')")
    const wizardWidth=await evaluate('({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth})')
    if(wizardWidth.scroll>wizardWidth.viewport+4)throw Error(`Mobile workflow wizard overflows (${wizardWidth.scroll} > ${wizardWidth.viewport})`)
    console.log('PASS: Workflow permissions follow options without mobile overflow')
    await evaluate("window.location.hash='#/overview'")
    await waitFor("document.querySelector('main#main-content h1')?.textContent === 'Overview'")
    console.log('PASS: Existing tools and overview navigation remain accessible')
    if(exceptions.length)throw Error(`Browser JavaScript exceptions: ${exceptions.slice(0,2).join('; ')}`)
    console.log('PASS: No uncaught browser JavaScript exceptions')
    ws.close()
  } finally {if(chrome){chrome.child.kill('SIGTERM');await sleep(220);if(chrome.child.exitCode===null)chrome.child.kill('SIGKILL')}; await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true})}
}
main().catch(error=>{console.error('FAIL: '+(error instanceof Error?error.message:String(error)));process.exitCode=1})
