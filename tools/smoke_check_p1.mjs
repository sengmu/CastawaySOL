import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// FIX-4: 兼容全局 WebSocket 与 Node 18/ws 回退
const WebSocketImpl = globalThis.WebSocket || (await import('ws')).default;

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const profile = await mkdtemp(join(tmpdir(), 'castaway-smoke-p1-'));
const out = join(process.cwd(), 'docs/qa');
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

try {
  for (let n = 0; !stderr.includes('DevTools listening on') && n < 200; n++) await wait(100);
  const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
  assert.ok(endpoint, 'Chromium did not expose DevTools');
  const port = new URL(endpoint).port;
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocketImpl(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let seq = 0;
  const pending = new Map();
  const runtimeErrors = [];
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
      runtimeErrors.push(msg.params.exceptionDetails);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
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
  await send('Page.navigate', { url: base });

  // Wait for game ready
  for (let n = 0; n < 120; n++) {
    const ready = await evaluate('!!window.__game?.story && !document.getElementById("loading-screen")');
    if (ready) break;
    await wait(500);
  }

  console.log('▶ [1/5] 验证运行时控制台无未捕获异常...');
  assert.equal(runtimeErrors.length, 0, `存在控制台运行时未捕获异常: ${JSON.stringify(runtimeErrors)}`);
  console.log('  ✅ 控制台 0 错误通过！');

  console.log('▶ [2/5] 验证钱包弹窗中 Mainnet 彻底不存在且仅保留测试网络...');
  await evaluate('window.__game.ui.openSolanaModal()');
  await wait(300);
  const selectHtml = await evaluate('document.getElementById("wallet-network-select")?.innerHTML || ""');
  assert.ok(!selectHtml.includes('mainnet'), '钱包网络选项中绝不可出现 mainnet');
  assert.ok(selectHtml.includes('devnet'), '必须包含 devnet');
  assert.ok(selectHtml.includes('testnet'), '必须包含 testnet');
  console.log('  ✅ 钱包网络选项已锁死，mainnet 彻底不可见！');

  console.log('▶ [3/5] 验证国库收款地址未配置时，商城 SOL 结账按钮必须安全禁用（暂未开放）...');
  await evaluate('window.__game.ui.closeModal()');
  await wait(200);
  await evaluate('window.__game.shopManager.open()');
  await wait(300);
  const buyBtnDisabled = await evaluate('document.querySelector(".shop-buy-btn")?.disabled');
  const buyBtnText = await evaluate('document.querySelector(".shop-buy-btn")?.textContent?.trim()');
  assert.equal(buyBtnDisabled, true, '收款地址未配置时，SOL 结账按钮必须被 disabled');
  assert.equal(buyBtnText, '暂未开放', '按钮文本必须显示「暂未开放」');
  console.log('  ✅ 商城 SOL 结账按钮安全锁死拦截生效！');

  console.log('▶ [4/5] 验证代币严格区分显示，杜绝 $SOL 混称...');
  const shopContent = await evaluate('document.getElementById("shop-modal-backdrop")?.innerHTML || ""');
  assert.ok(shopContent.includes('算力代币'), '代币兑换处必须明确标识为算力代币');
  console.log('  ✅ 算力代币与真实 SOL 严格分离！');

  console.log('▶ [5/5] 验证自动打捞浮标绝不产出晶石 (FIX-1)，手动自然打捞保留晶石...');
  const buoyResult = await evaluate(`(()=>{
    const g = window.__game;
    const fs = g.flotsamSalvage;
    const st = g.storageSystem.storageInventory;
    const initCrystals = st['sol_crystal'] || 0;
    const initPlanks = st['wood_plank'] || 0;

    // 构造或选取一个板条箱
    let crate = fs.flotsamList.find(f => f.spec.type === 'flotsam_crate' && !f.collected);
    if (!crate) {
      fs.createFlotsamItem('test_crate_smoke', 2, 0, 30, -0.2);
      crate = fs.flotsamList.find(f => f.id === 'test_crate_smoke');
    }

    // 执行自动打捞
    const oldFind = fs.flotsamList.find;
    fs.flotsamList.find = (fn) => crate;
    fs.performAutoSalvage();
    fs.flotsamList.find = oldFind;

    const autoCrystalInc = (st['sol_crystal'] || 0) - initCrystals;
    const autoPlankInc = (st['wood_plank'] || 0) - initPlanks;

    // 手动打捞测试 (使用真实的 flotsam_crate 坐标)
    let manualDrops = [];
    const crateItem = fs.flotsamList.find(f => f.spec.type === 'flotsam_crate');
    if (crateItem) {
      crateItem.collected = false;
      fs.checkSalvage(crateItem.group.position, (item) => manualDrops.push(item));
    }

    return {
      autoCrystalInc,
      autoPlankInc,
      manualHasCrystal: manualDrops.includes('sol_crystal')
    };
  })()`);

  assert.equal(buoyResult.autoCrystalInc, 0, '自动打捞浮标存入储物箱的晶石增量必须严格为 0');
  assert.ok(buoyResult.autoPlankInc > 0, '自动打捞浮标其他建材（木板等）应正常入库');
  assert.equal(buoyResult.manualHasCrystal, true, '自然手动打捞板条箱仍必须可产出晶石');
  console.log('  ✅ 自动打捞浮标 0 晶石防线生效，手动自然打捞保留晶石！');

  // 截屏存档
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(out, 'p1-smoke.png'), Buffer.from(screenshot.data, 'base64'));
  console.log('📸 冒烟截图已保存至 docs/qa/p1-smoke.png');

  ws.close();
  browser.kill('SIGTERM');
  console.log('\n🎉 [P1 SMOKE ALL PASSED] 支付止血与合规加固冒烟验收 100% 成功！');
} catch (e) {
  console.error('❌ [P1 SMOKE FAILED]:', e);
  process.exitCode = 1;
} finally {
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
