import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
export async function browserSession(run) {
  const profile = await mkdtemp(join(tmpdir(), 'castaway-r10-'));
  const browser = spawn(process.env.CHROME_BIN || 'chromium', ['--headless','--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1280,900','about:blank']);
  let stderr='', ws;
  browser.stderr.on('data', b => stderr += b);
  const wait = ms => new Promise(r => setTimeout(r,ms));
  const errors=[];
  try {
    for(let i=0;i<200 && !stderr.includes('DevTools listening on') && browser.exitCode === null && browser.signalCode === null;i++) await wait(100);
    const endpoint=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    assert.ok(endpoint,stderr.slice(-3000));
    const pages=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json`)).json();
    const WS=globalThis.WebSocket || (await import('ws')).default;
    ws=new WS(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let seq=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'||m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params);};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject,timer:setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},60000)});ws.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
    await send('Runtime.enable');await send('Page.enable');await send('Log.enable');
    await send('Page.navigate',{url:process.env.GOLDEN_URL||'http://127.0.0.1:5173'});
    for(let i=0;i<180;i++){if(await evaluate('!!window.__game?.saveSystem && !document.getElementById("loading-screen")'))break;await wait(500);if(i===179)throw new Error('game init timeout');}
    return await run({evaluate,send,errors,wait});
  } finally {ws?.close();browser.kill('SIGTERM');await wait(300);await rm(profile,{recursive:true,force:true});}
}
