import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession } from './lib/browser-session.mjs';
const out = new URL('../docs/qa/r10-e2/', import.meta.url);
await mkdir(out, { recursive: true });
const report = { status:'blocked', errors:[], panels:[] };
try {
 await browserSession(async ({ evaluate, send, errors, wait }) => {
  await wait(3000);
  assert.ok(await evaluate('window.__game.renderer.info.render.frame > 1'));
  for (const tab of ['decrypt','resonance','motherlode','odds']) {
   const state = await evaluate(`(() => {
    const g=window.__game;g.ui._rigModalTab=${JSON.stringify(tab)};g.ui.openMiningRigModal(g.miningRig);
    const body=document.getElementById('modal-body');
    return {text:body.textContent,npc:body.querySelectorAll('.npc-shares sup').length, upgrade:!!body.querySelector('#btn-rig-upgrade'), commit:body.querySelector('[data-seed="commit"]')?.textContent};
   })()`);
   assert.ok(state.text.includes('其他矿工均为模拟矿工（非真人）'));
   assert.equal(state.upgrade,['decrypt','resonance'].includes(tab));
   if(tab==='resonance')assert.equal(state.npc,25);
   if(tab==='odds'){assert.ok(state.text.includes('不承诺任何收益'));assert.ok(state.commit && state.commit!=='尚未生成');assert.ok(!state.text.includes('$'));}
   report.panels.push({tab,...state});
   const shot=await send('Page.captureScreenshot',{format:'png'});
   await writeFile(new URL(`${tab}.png`,out),Buffer.from(shot.data,'base64'));
  }
  report.errors=errors;
  assert.equal(errors.length,0,'控制台 / 运行时错误必须为零');
  report.status='passed';
 });
} catch(error) {report.reason=error.message;process.exitCode=1;}
await writeFile(new URL('runtime.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
