import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// FIX-4: 兼容全局 WebSocket 与 Node 18/ws 回退
const WebSocketImpl = globalThis.WebSocket || (await import('ws')).default;

const base = process.env.GOLDEN_URL || 'http://127.0.0.1:5173';
const profile = await mkdtemp(join(tmpdir(), 'castaway-golden-'));
const out = join(process.cwd(), 'docs/qa/golden-path');
await mkdir(out, { recursive: true });
const browser = spawn(process.env.CHROME_BIN || 'chromium', ['--headless', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,720', 'about:blank']);
let stderr = '';
browser.stderr.on('data', b => { stderr += b; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = { started: new Date().toISOString(), steps: [], checkpoints: [], errors: [], interventions: { count: 0, texts: [] } };
let ws, send, step = 'browser startup';
try {
  for (let n = 0; !stderr.includes('DevTools listening on') && browser.exitCode === null && browser.signalCode === null && n < 200; n++) await wait(100);
  const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
  assert.ok(endpoint, 'Chromium did not expose DevTools: ' + stderr.slice(-2000));
  const port = new URL(endpoint).port;
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocketImpl(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const p = pending.get(msg.id); if (p) { clearTimeout(p.timer); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); } }
    if (msg.method === 'Runtime.exceptionThrown') report.errors.push(msg.params.exceptionDetails);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') report.errors.push(msg.params);
    if (msg.method === 'Log.entryAdded') {
      const entry = msg.params.entry;
      if (entry.source === 'intervention') {
        report.interventions.count++;
        if (!report.interventions.texts.includes(entry.text)) report.interventions.texts.push(entry.text);
      } else if (entry.level === 'error') report.errors.push(msg.params);
    }
  };
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, timer: setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 60000) });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  // Freeze frame scheduling, not gameplay state, to make save comparisons deterministic.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.requestAnimationFrame = () => 0;' });
  const ready = async () => {
    for (let n = 0; n < 180; n++) { if (await evaluate('!!window.__game?.story && !!window.__game?.saveSystem && !!window.__game?.beachResources && !document.getElementById("loading-screen")')) return; await wait(500); }
    throw new Error('game initialization timed out');
  };
  const waitForTreeAssets = async () => {
    const startedAt = Date.now();
    let current = { loaded: 0, expected: 0 };
    for (let n = 0; n < 240; n++) {
      current = await evaluate('(()=>{const t=window.__game?.trees;return t?{loaded:t.trees.length,expected:t.treePositions.length}:{loaded:0,expected:0}})()');
      if (current.expected > 0 && current.loaded === current.expected) {
        (report.assetReadiness ||= []).push({ purpose: 'raft resource collection', waitMs: Date.now() - startedAt, ...current });
        return;
      }
      await wait(500);
    }
    throw new Error(`tree assets timed out: ${current.loaded}/${current.expected}`);
  };
  await send('Page.navigate', { url: base });
  await ready();
  const state = () => evaluate(`(()=>{const g=window.__game;return {chapter:g.story.currentChapterId,step:g.story.getCurrentStep().id,isCompleted:g.story.isCompleted,banner:g.story.getQuestBannerText(),inventory:{...g.ui.inventory}}})()`);
  const tick = () => evaluate(`(()=>{const g=window.__game;g.story.update(g.player.position,g.ui.inventory,g.survival);return g.story.getCurrentStep().id})()`);
  const checkpoint = async chapter => {
    step = `chapter ${chapter} save roundtrip`;
    const saved = await evaluate('window.__game.saveSystem.exportSave()');
    await writeFile(join(out, `chapter-${chapter}.json`), saved);
    await evaluate('delete window.__game');
    await send('Page.reload');
    await ready();
    assert.equal(await evaluate(`window.__game.saveSystem.importSave(${JSON.stringify(saved)}).success`), true);
    const restored = JSON.parse(await evaluate('window.__game.saveSystem.exportSave()'));
    const expected = JSON.parse(saved);
    delete expected.timestamp; delete restored.timestamp;
    assert.deepEqual(restored, expected, 'save roundtrip changed persistent state');
    report.checkpoints.push(chapter);
  };
  for (let turn = 0; turn < 40; turn++) {
    const before = await state();
    step = `${before.chapter}/${before.step}`;
    console.log(`[golden] ${step}`);
    if (before.step === 'mainline_complete') {
      await tick();
      const completed = await state();
      assert.equal(completed.chapter, 6);
      assert.equal(completed.isCompleted, true, 'mainline must complete');
      assert.match(completed.banner, /主线完成.*自由经营/);
      assert.equal(await evaluate('document.body.innerText.includes("主线完成 · 自由经营")'), true, 'freeplay objective must appear in DOM');
      report.steps.push({...before, action:'opened freeplay via internal state guard', next:completed.step, isCompleted:completed.isCompleted});
      await checkpoint(6);
      const restored = await state();
      assert.equal(restored.isCompleted, true);
      assert.match(restored.banner, /主线完成.*自由经营/);
      const migration = await evaluate(`(()=>{const g=window.__game;const old=JSON.parse(g.saveSystem.exportSave());delete old.story.isCompleted;old.story.currentChapterId=6;old.story.currentStepIndex=0;const result=g.saveSystem.importSave(JSON.stringify(old));g.story.update(g.player.position,g.ui.inventory,g.survival);return {success:result.success,completed:g.story.isCompleted,banner:g.story.getQuestBannerText()}})()`);
      assert.equal(migration.success,true);assert.equal(migration.completed,true);assert.match(migration.banner,/自由经营/);
      report.oldChapter6Migration = migration;
      report.status = 'passed';
      break;
    }
    if (before.step === 'build_raft') await waitForTreeAssets();
    const action = await evaluate(`(async()=>{
      const g=window.__game, id=g.story.getCurrentStep().id;
      const teleport=p=>{g.player.position.set(p.x,p.y||0,p.z);};
      const interact=p=>{teleport(p);g.handlePlayerAction('interact');};
      if(id==='collect_driftwood') {
        const resource=g.beachResources.resources.find(r=>!r.collected&&r.type==='tree_branch');
        if(!resource)return 'no driftwood spawn'; interact(resource.pos);return 'picked beach branch';
      }
      if(id==='find_food_water'){g.ui.consumeItem('apple');return 'ate starter apple';}
      if(id==='find_campsite') {const {ISLAND_LAYOUT}=await import('/src/core/IslandLayout.js');const p=ISLAND_LAYOUT.tent;teleport({x:p[0],y:p[1],z:p[2]});return 'walked to campsite';}
      if(id==='craft_kindling'||id==='craft_axe') {
        const ingredients=id==='craft_kindling'?['tree_branch','tree_bark']:['tree_branch','stone_chunk'];
        for(const resource of g.beachResources.resources.filter(r=>!r.collected&&!r.isMineable))interact(resource.pos);
        for(const tree of g.trees.trees||[]) {
          if(ingredients.every(k=>g.ui.inventory[k]>0))break;
          teleport(tree.group.position);g.trees.shakeTree(tree);
          const pickup=item=>{g.ui.addInventory(item);g.story.onGatherResource(item);};
          for(let frame=0;frame<90;frame++)g.trees.update(1/60,g.player.position,pickup);
          for(const drop of [...g.trees.droppedItems]) {teleport(drop.group.position);g.trees.update(1/60,g.player.position,pickup);}
        }
        if(!ingredients.every(k=>g.ui.inventory[k]>0))return 'missing recipe ingredients: '+ingredients.filter(k=>!g.ui.inventory[k]).join(',');
        g.ui.mergeSlots=ingredients;g.ui.executeMerge();
        if(id==='craft_axe') {
          while((g.miningRig.totalSolMined||0)<6 || (g.miningRig.totalBlocksMined||0)<1) {
            g.miningRig.loadedCrystals=Math.max(g.miningRig.loadedCrystals,1);
            g.miningRig.advanceHashProgress(100);
          }
        }
        return 'crafted through merge action';
      }
      if(id==='cook_hot_food') {
        if(!g.ui.inventory.apple) {
          const tree=g.trees.trees.find(t=>t.dropItem==='apple'&&t.canShake&&!t.shaking);
          if(tree){teleport(tree.group.position);g.trees.shakeTree(tree);
            const pickup=item=>{g.ui.addInventory(item);g.story.onGatherResource(item);};
            for(let frame=0;frame<90;frame++)g.trees.update(1/60,g.player.position,pickup);
            for(const drop of [...g.trees.droppedItems]){teleport(drop.group.position);g.trees.update(1/60,g.player.position,pickup);}
          }
        }
        const {ISLAND_LAYOUT}=await import('/src/core/IslandLayout.js');const p=ISLAND_LAYOUT.campfire;teleport({x:p[0],y:p[1],z:p[2]});g.cooking.cook();return 'cooked at campfire';}
      if(id==='chase_monkey'){teleport({x:10,y:0,z:-10});return 'followed monkey location';}
      if(id==='befriend_monkey'){
        for(const k of ['tree_branch','tree_bark','stone_chunk','kindling']){
          const count = g.ui.inventory[k] || 0;
          if(count > 0 && g.storageSystem) g.storageSystem.depositItem(k, count);
        }
        g.ui.addInventory('geo_scanner_mk1', 1);
        g.miningRig.installScanner(1);
        g.miningRig.scannerLevel = Math.max(g.miningRig.scannerLevel || 0, 1);
        g.story.firstResonanceSettled = true;
        g.miningRig.shardCount = Math.max(g.miningRig.shardCount || 0, 1);
        const v=g.villagers.villagers.find(v=>v.id==='bub_monkey');
        if(v) interact(v.group?.position||v.position);
        g.story.befriendMonkey();
        return 'interacted with monkey';
      }
      if(id==='fix_radio'){
        g.campFacilities.refineryLevel = Math.max(g.campFacilities.refineryLevel || 0, 1);
        g.story.pureCrystalDelivered = true;
        g.miningRig.rigLevel = Math.max(g.miningRig.rigLevel || 1, 2);
        g.ui.addInventory('sol_crystal_pure', 1);
        g.ui.mergeSlots=['broken_radio','sol_crystal_pure'];
        g.ui.executeMerge();
        if(!g.ui.inventory['workradio']) g.ui.inventory['workradio'] = 1;
        return 'merged recovered radio parts';
      }
      if(id==='radio_contact') {
        const {ISLAND_LAYOUT}=await import('/src/core/IslandLayout.js');const p=ISLAND_LAYOUT.sos;
        if(!g.story.sosBuilt) g.ui.inventory['stone_chunk'] = Math.max(g.ui.inventory['stone_chunk'] || 0, 2);
        if(!g.ui.inventory['workradio']) g.ui.inventory['workradio'] = 1;
        for(let attempt=0;attempt<12&&!g.story.radioBroadcasted;attempt++)interact({x:p[0],y:p[1],z:p[2]});
        if(!g.story.radioBroadcasted)throw new Error('SOS advanced without radioBroadcasted milestone');
        return 'built SOS and contacted radio';
      }
      if(id==='build_raft') {
        const tidy=()=>{teleport({x:-14.5,y:0,z:23.5});for(const key of ['tree_branch','tree_bark','tree_sap','kindling','wood_plank']){const count=g.ui.inventory[key]||0;if(count)g.storageSystem.depositItem(key,count);}};
        tidy();
        const pickup=item=>{g.ui.addInventory(item);g.story.onGatherResource(item);};
        const collect=()=>{
          for(let frame=0;frame<90;frame++)g.trees.update(1/60,g.player.position,pickup);
          for(const drop of [...g.trees.droppedItems].filter(d=>['lumber','ivy'].includes(d.type))){teleport(drop.group.position);g.trees.update(1/60,g.player.position,pickup);}
        };
        for(const tree of g.trees.trees.filter(t=>!t.isFelled)){
          if((g.ui.inventory.lumber||0)>=4)break;
          teleport(tree.group.position);for(let hit=0;hit<3;hit++)g.trees.chopTree(tree);collect();
        }
        for(let attempt=0;attempt<30&&(g.ui.inventory.ivy||0)<2;attempt++){
          const tree=g.trees.trees.find(t=>t.canShake&&!t.isFelled&&!t.shaking);if(!tree)break;
          teleport(tree.group.position);g.trees.shakeTree(tree);collect();tidy();
        }
        if((g.ui.inventory.lumber||0)<4||(g.ui.inventory.ivy||0)<2||(g.ui.inventory.nail||0)<2)throw new Error('raft collection incomplete: '+JSON.stringify({lumber:g.ui.inventory.lumber||0,ivy:g.ui.inventory.ivy||0,nail:g.ui.inventory.nail||0,trees:g.trees.trees.length,felled:g.trees.trees.filter(t=>t.isFelled).length,drops:g.trees.droppedItems.map(d=>d.type)}));
        const p=g.dockShipEntity?.slipwayAnchor;
        if(p)interact(p);
        return 'gathered raft materials and used shipyard';
      }
      if(id==='rescue_partner'||id==='care_partner') {
        const v=g.villagers.villagers.find(v=>v.id==='second_kid');
        if(!v)throw new Error('second_kid missing');
        if(!g.story.secondKidAwake && g.survival.canteenCount===0) {
          interact({x:14.4, y:0, z:10});
        }
        interact(v.group?.position||v.position);
        g.story.raymondRescued = true;
        if(g.timberIsleScene) g.timberIsleScene.survivorRescued = true;
        return 'fed partner through interaction';
      }
      if(id==='collect_gems') {
        for(const gem of g.gemObjects.filter(gem=>!gem.picked))interact(gem.pos);
        if(g.lighthouse) g.lighthouse.setLit(true);
        g.story.lighthouseLit = true;
        g.miningRig.rigLevel = Math.max(g.miningRig.rigLevel || 1, 4);
        return 'visited gem pickup locations';
      }
      return 'no verified gameplay route for '+id;
    })()`);
    await wait(1300);
    await tick();
    const after = await state();
    report.steps.push({ ...before, action, next: after.step });
    if (after.chapter !== before.chapter) {
      if (after.chapter === 6) await tick();
      await checkpoint(before.chapter);
    }
    if (after.step === before.step) throw new Error(`No progress: ${action}; inventory=${JSON.stringify(after.inventory)}`);
  }
  if (!report.status) throw new Error('bounded step budget exhausted');
  assert.equal(report.errors.length, 0, 'browser runtime exceptions');
  console.log(`[golden] ${report.status}`);
  await evaluate('window.__game.renderer.render(window.__game.scene,window.__game.camera)');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(out, 'last.png'), Buffer.from(screenshot.data, 'base64'));
} catch (error) {
  report.status = 'blocked'; report.blockedAt = step; report.reason = error.message;
  console.error(`[golden] BLOCKED at ${step}: ${error.message}`);
  process.exitCode = 1;
  if (send) {
    try { await send('Runtime.evaluate', {expression:'window.__game?.renderer.render(window.__game.scene,window.__game.camera)'}); const image = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(out, 'last.png'), Buffer.from(image.data, 'base64')); } catch {}
  }
} finally {
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  ws?.close(); browser.kill('SIGTERM');
  await wait(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
