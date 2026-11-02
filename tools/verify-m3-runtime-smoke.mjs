import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './lib/browser-session.mjs';
const out = 'docs/qa/m3-runtime';
await mkdir(out,{recursive:true});
const report = {errors:[]};
try {
 await browserSession(async ({evaluate,send,errors,wait}) => {
  const saved = await evaluate('window.__game.saveSystem.exportSave()');
  const old = JSON.parse(saved); old.story.currentChapterId=6;old.story.currentStepIndex=0;delete old.story.isCompleted;
  assert.equal(await evaluate(`window.__game.saveSystem.importSave(${JSON.stringify(JSON.stringify(old))}).success`),true);
  const before = await evaluate('({frame:window.__game.renderer.info.render.frame,story:window.__game.story.serialize()})');
  await wait(10000);
  report.runtime = await evaluate(`(()=>{const g=window.__game;return {frame:g.renderer.info.render.frame,completed:g.story.isCompleted,banner:g.story.getQuestBannerText(),visible:document.body.innerText.includes('主线完成 · 自由经营'),camp:!!g.campFacilities,mining:!!g.miningRig}})()`);
  assert.ok(report.runtime.frame>before.frame);
  assert.equal(report.runtime.completed,true);assert.equal(report.runtime.visible,true);
  report.errors = errors;assert.equal(errors.length,0);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${out}/last.png`,Buffer.from(screenshot.data,'base64'));
 });
 report.status='passed';
} catch(error) {report.status='blocked';report.reason=error.message;process.exitCode=1;}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
