import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// FIX-4: 兼容全局 WebSocket 与 Node 18/ws 回退
const WebSocketImpl = globalThis.WebSocket || (await import('ws')).default;

const base = process.env.GOLDEN_URL || 'http://127.0.0.1:5173';
const profile = await mkdtemp(join(tmpdir(), 'castaway-golden-'));
const out = join(process.cwd(), 'docs/qa/m2-runtime');
await mkdir(out, { recursive: true });
const browser = spawn(process.env.CHROME_BIN || 'chromium', ['--headless', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,720', 'about:blank']);
let stderr = '';
browser.stderr.on('data', b => { stderr += b; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = { started: new Date().toISOString(), steps: [], checkpoints: [], errors: [], kind: 'M2 normal animation runtime smoke' };
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
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') report.errors.push(msg.params.args);
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') report.errors.push(msg.params.entry);
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
  const ready = async () => {
    for (let n = 0; n < 180; n++) { if (await evaluate('!!window.__game?.story && !!window.__game?.saveSystem && !!window.__game?.beachResources && !document.getElementById("loading-screen")')) return; await wait(500); }
    throw new Error('game initialization timed out');
  };
  await send('Page.navigate', { url: base });
  await ready();
  await wait(10000);
  report.runtime = await evaluate(`(()=>{const g=window.__game;return {step:g.story.getCurrentStep().id,canvas:!!g.renderer.domElement,frame:g.renderer.info.render.frame,objective:g.story.getQuestBannerText(),onboarding:g.story.getOnboardingHint()}})()`);
  assert.ok(report.runtime.frame > 1, 'normal animation loop must render frames');
  assert.equal(report.runtime.step, 'collect_driftwood', 'idle runtime cannot skip first action');
  assert.equal(report.errors.length, 0, 'console / runtime errors');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(out, 'last.png'), Buffer.from(screenshot.data, 'base64'));
  report.status = 'passed';
  console.log(JSON.stringify(report, null, 2));
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
