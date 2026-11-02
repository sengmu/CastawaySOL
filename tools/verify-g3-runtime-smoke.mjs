import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './lib/browser-session.mjs';
const out='docs/qa/g3/runtime';await mkdir(out,{recursive:true});
const report={errors:[]};
try{
 await browserSession(async({evaluate,send,errors,wait})=>{
  const before=await evaluate('window.__game.renderer.info.render.frame');
  await wait(3000);
  report.runtime=await evaluate(`(()=>{const g=window.__game;return {frame:g.renderer.info.render.frame,ledger:g.economyLedger.serialize(),snapshot:g.saveSystem.createSnapshot().economyLedger,schema:g.saveSystem.createSnapshot().schemaVersion};})()`);
  assert.ok(report.runtime.frame>before);assert.equal(report.runtime.schema,2);
  assert.deepEqual(report.runtime.ledger,report.runtime.snapshot);
  report.errors=[...errors];assert.equal(report.errors.length,0);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(out+'/last.png',Buffer.from(shot.data,'base64'));
 });report.status='passed';
}catch(error){report.status='blocked';report.reason=error.message;process.exitCode=1;}
await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
