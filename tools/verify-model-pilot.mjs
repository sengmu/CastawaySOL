import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const WebSocketImpl = globalThis.WebSocket || (await import('ws')).default;
const base = process.env.GOLDEN_URL || 'http://127.0.0.1:5173';
const profile = await mkdtemp(join(tmpdir(), 'castaway-pilot-'));
const out = join(process.cwd(), 'docs/qa/model-pilot');
await mkdir(out, { recursive: true });

const browser = spawn(process.env.CHROME_BIN || 'chromium', [
  '--headless',
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--window-size=1280,720',
  'about:blank'
]);

let stderr = '';
browser.stderr.on('data', b => { stderr += b; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = {
  started: new Date().toISOString(),
  errors: [],
  modelChecks: {},
  animationChecks: {}
};

let ws, send;
try {
  for (let n = 0; !stderr.includes('DevTools listening on') && browser.exitCode === null && browser.signalCode === null && n < 200; n++) {
    await wait(100);
  }
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
    if (msg.id) {
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      report.errors.push(msg.params.exceptionDetails);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      report.errors.push(msg.params);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      report.errors.push(msg.params.entry);
    }
  };

  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, {
      resolve,
      reject,
      timer: setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 60000)
    });
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

  await send('Page.navigate', { url: base });

  // 1. Wait for game and player model to initialize
  console.log('[pilot] Waiting for game initialization and player model load...');
  for (let n = 0; n < 120; n++) {
    const ready = await evaluate(`(()=>{
      const g = window.__game;
      return !!(g && g.player && g.player.model && g.player.skeletons && g.player.skeletons.length > 0 && !document.getElementById("loading-screen"));
    })()`);
    if (ready) break;
    await wait(500);
  }

  // Verify model loading and skeletal mapping
  const modelInfo = await evaluate(`(()=>{
    const p = window.__game.player;
    const bones = p.bones;
    const mappedBones = {};
    for (const [k, v] of Object.entries(bones)) {
      mappedBones[k] = v ? v.name : null;
    }
    return {
      hasModel: !!p.model,
      skeletonsCount: p.skeletons.length,
      mappedBones,
      position: { x: p.position.x, y: p.position.y, z: p.position.z },
      rotation: p.rotation
    };
  })()`);

  console.log('[pilot] Model info:', JSON.stringify(modelInfo, null, 2));
  assert.ok(modelInfo.hasModel, 'Player model must be loaded');
  assert.ok(modelInfo.skeletonsCount >= 1, 'Player must have at least 1 skeleton');
  assert.ok(modelInfo.mappedBones.legL, 'legL bone must be mapped');
  assert.ok(modelInfo.mappedBones.legR, 'legR bone must be mapped');
  assert.ok(modelInfo.mappedBones.armL, 'armL bone must be mapped');
  assert.ok(modelInfo.mappedBones.armR, 'armR bone must be mapped');
  assert.ok(modelInfo.mappedBones.head, 'head bone must be mapped');
  assert.ok(modelInfo.mappedBones.spine, 'spine bone must be mapped');
  report.modelChecks = modelInfo;

  // Let renderer complete a few frames
  await wait(1000);
  await evaluate(`window.__game.renderer.render(window.__game.scene, window.__game.camera)`);

  // 2. Capture spawn point screenshot
  const spawnScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(out, 'spawn.png'), Buffer.from(spawnScreenshot.data, 'base64'));
  console.log('[pilot] Spawn screenshot saved to docs/qa/model-pilot/spawn.png');

  // Turn camera slightly to see player from front-diagonal for clear arm & leg swing verification
  await evaluate(`(()=>{
    const g = window.__game;
    // Set camera to look directly towards player front
    g.player.rotation = Math.PI * 0.15;
    g.player.cameraAngleH = Math.PI * 0.15;
  })()`);

  // 3. Drive procedural animation: Walk Phase 1 (Left Leg Forward)
  console.log('[pilot] Driving procedural animation to Walk Phase 1...');
  const phase1Info = await evaluate(`(()=>{
    const g = window.__game;
    const p = g.player;

    // Zoom camera in close for clear inspection of limbs
    p.targetCameraDistance = 3.2;
    p.cameraDistance = 3.2;
    p.cameraAngleV = 0.32;
    p.cameraAngleH = 0.35;
    for (let i = 0; i < 30; i++) p.updateCamera(0.016);

    p.isMoving = true;
    p.movementWeight = 1.0;
    p.walkCycle = Math.PI * 0.5; // Left leg forward, right leg back

    p._origUpdate = p.update;
    p.update = function(delta) {
      this.isMoving = true;
      this.movementWeight = 1.0;
      this.walkCycle = Math.PI * 0.5;
      this.animateSkeletalLocomotion(delta);
      this.updateCamera(delta);
    };

    p.animateSkeletalLocomotion(0.016);
    g.renderer.render(g.scene, g.camera);

    return {
      walkCycle: p.walkCycle,
      legL_rotX: p.bones.legL?.rotation.x,
      legR_rotX: p.bones.legR?.rotation.x,
      armL_rotX: p.bones.armL?.rotation.x,
      armR_rotX: p.bones.armR?.rotation.x
    };
  })()`);
  console.log('[pilot] Phase 1 bone angles:', phase1Info);

  await wait(200);
  const phase1Screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(out, 'walk_phase_1.png'), Buffer.from(phase1Screenshot.data, 'base64'));
  console.log('[pilot] Phase 1 screenshot saved to docs/qa/model-pilot/walk_phase_1.png');

  // 4. Drive procedural animation: Walk Phase 2 (Right Leg Forward)
  console.log('[pilot] Driving procedural animation to Walk Phase 2...');
  const phase2Info = await evaluate(`(()=>{
    const g = window.__game;
    const p = g.player;

    p.isMoving = true;
    p.movementWeight = 1.0;
    p.walkCycle = Math.PI * 1.5; // Left leg backward, right leg forward

    p.update = function(delta) {
      this.isMoving = true;
      this.movementWeight = 1.0;
      this.walkCycle = Math.PI * 1.5;
      this.animateSkeletalLocomotion(delta);
      this.updateCamera(delta);
    };

    p.animateSkeletalLocomotion(0.016);
    g.renderer.render(g.scene, g.camera);

    return {
      walkCycle: p.walkCycle,
      legL_rotX: p.bones.legL?.rotation.x,
      legR_rotX: p.bones.legR?.rotation.x,
      armL_rotX: p.bones.armL?.rotation.x,
      armR_rotX: p.bones.armR?.rotation.x
    };
  })()`);
  console.log('[pilot] Phase 2 bone angles:', phase2Info);

  await wait(200);
  const phase2Screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(out, 'walk_phase_2.png'), Buffer.from(phase2Screenshot.data, 'base64'));
  console.log('[pilot] Phase 2 screenshot saved to docs/qa/model-pilot/walk_phase_2.png');

  // Reset player state to idle
  await evaluate(`(()=>{
    const p = window.__game.player;
    if (p._origUpdate) p.update = p._origUpdate;
    p.targetCameraDistance = 8.5;
    p.cameraDistance = 8.5;
    p.isMoving = false;
    p.movementWeight = 0.0;
    p.walkCycle = 0;
    p.animateSkeletalLocomotion(1/60);
  })()`);

  // Verify bone swing delta
  const legDelta = Math.abs(phase1Info.legL_rotX - phase2Info.legL_rotX);
  const armDelta = Math.abs(phase1Info.armL_rotX - phase2Info.armL_rotX);
  console.log(`[pilot] Leg Swing Delta: ${legDelta.toFixed(3)} rad, Arm Swing Delta: ${armDelta.toFixed(3)} rad`);
  assert.ok(legDelta > 0.4, `Leg swing delta (${legDelta}) must be noticeable (>0.4 rad)`);
  assert.ok(armDelta > 0.4, `Arm swing delta (${armDelta}) must be noticeable (>0.4 rad)`);

  report.animationChecks = {
    phase1: phase1Info,
    phase2: phase2Info,
    legDelta,
    armDelta,
    verified: true
  };

  // 5. Verify console errors
  console.log(`[pilot] Total browser runtime errors: ${report.errors.length}`);
  assert.equal(report.errors.length, 0, `Browser runtime errors: ${JSON.stringify(report.errors)}`);

  report.status = 'passed';
  console.log('[pilot] Model Pilot in-engine verification PASSED!');
} catch (err) {
  report.status = 'failed';
  report.reason = err.message;
  console.error('[pilot] FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await writeFile(join(out, 'runtime.json'), JSON.stringify(report, null, 2));
  ws?.close();
  browser.kill('SIGTERM');
  await wait(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
