// CastawaySOL - 第 A1 轮：算力总账 UI 自动化测试套件
// 依据 audit-plan-1102 与 A1 规格要求编写
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { browserSession } from '../tools/lib/browser-session.mjs';
import { LEDGER_SOURCES, LEDGER_SINKS } from '../src/systems/EconomyLedger.js';
import { ODDS_TABLE } from '../src/systems/resonance/ResonanceEngine.js';

console.log('📊 开始执行 CastawaySOL 第 A1 轮：算力总账 UI 自动化验收测试套件...\n');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'docs/qa/a1');
fs.mkdirSync(outDir, { recursive: true });

// ========================================================
// 1. 静态代码与枚举翻译完整性检查
// ========================================================
console.log('▶ [1/5] 验证账本 source/sink 枚举到中文翻译完整性...');

const uiSource = fs.readFileSync(path.join(projectRoot, 'src/ui/UIManager.js'), 'utf8');
const match = uiSource.match(/export const LEDGER_LABELS = Object\.freeze\((\{[\s\S]*?\})\);/);
assert.ok(match, 'UIManager.js 必须导出 LEDGER_LABELS 常量映射');
const LEDGER_LABELS = (new Function(`return ${match[1]}`))();

// 确保 LEDGER_SOURCES 和 LEDGER_SINKS 中所有枚举键在 LEDGER_LABELS 中均有中文翻译
const allSources = Object.values(LEDGER_SOURCES).flat();
const allSinks = Object.values(LEDGER_SINKS).flat();
const allEnums = [...new Set([...allSources, ...allSinks])];

for (const key of allEnums) {
  assert.ok(LEDGER_LABELS[key], `账本枚举【${key}】必须在 LEDGER_LABELS 中有中文翻译`);
  assert.ok(/[一-龥]/.test(LEDGER_LABELS[key]), `账本枚举【${key}】的翻译【${LEDGER_LABELS[key]}】必须包含中文字符`);
}

// 检查 prompt 中明确要求的重点翻译
assert.equal(LEDGER_LABELS['decrypt'], '矿机解密');
assert.equal(LEDGER_LABELS['resonance_main'], '共振主池');
assert.equal(LEDGER_LABELS['resonance_ml'], '母晶池');
assert.equal(LEDGER_LABELS['checkin'], '每日签到');
assert.equal(LEDGER_LABELS['shop'], '营地商城');
assert.equal(LEDGER_LABELS['ship'], '船只');
assert.equal(LEDGER_LABELS['scanner'], '扫描仪');
assert.equal(LEDGER_LABELS['rig_upgrade'], '矿机升级');
assert.equal(LEDGER_LABELS['refinery'], '精炼');

console.log(`  ✅ 账本全部 ${allEnums.length} 个枚举项均已完成中文翻译映射！`);

// ========================================================
// 2. 检查 CSS 样式选择器与 Cozy 规范约束
// ========================================================
console.log('\n▶ [2/5] 验证 CozyPortraitHud.css 与 CozyLandscapeHud.css 中抽屉样式...');
const portraitCss = fs.readFileSync(path.join(projectRoot, 'src/ui/CozyPortraitHud.css'), 'utf8');
const landscapeCss = fs.readFileSync(path.join(projectRoot, 'src/ui/CozyLandscapeHud.css'), 'utf8');

// 竖屏底部抽屉约束
assert.ok(portraitCss.includes('.ledger-drawer'), 'CozyPortraitHud.css 必须包含 .ledger-drawer');
assert.ok(portraitCss.includes('max-height: 60vh'), '竖屏抽屉高度必须 ≤ 60vh');
assert.ok(portraitCss.includes('border-top-left-radius: 24px'), '竖屏抽屉上圆角必须为 24px');
assert.ok(portraitCss.includes('--cozy-hud-surface'), '抽屉背景必须使用 --cozy-hud-surface 变量');
assert.ok(portraitCss.includes('--cozy-hud-border'), '抽屉边框必须使用 --cozy-hud-border 变量');

// 横屏右侧抽屉约束
assert.ok(landscapeCss.includes('.ledger-drawer'), 'CozyLandscapeHud.css 必须包含 .ledger-drawer');
assert.ok(landscapeCss.includes('border-top-left-radius: 24px'), '横屏抽屉左上圆角必须为 24px');
assert.ok(landscapeCss.includes('right: 0'), '横屏抽屉必须停靠在右侧');

console.log('  ✅ 抽屉样式完全符合竖屏底部 (≤60vh)、横屏右侧及 24px 圆角 Cozy 规范！');

// ========================================================
// 3. 无头浏览器：注入固定账本，验证抽屉数值严格相等与视觉样式
// ========================================================
console.log('\n▶ [3/5] 在无头浏览器中注入固定账本，验证数值与账本严格相等...');

// 构造固定测试账本数据（Day 1, 2, 3）
const fixedLedgerData = {
  days: [
    {
      day: 1,
      inflow: {
        sol_token: { decrypt: 20, checkin: 5 },
        sol_crystal: { vein_mine: 12, camp_miner: 4 }
      },
      outflow: {
        sol_token: { shop: 8, rig_upgrade: 10 },
        sol_crystal: { decrypt_consume: 5, resonance_commit: 6 }
      },
      transfers: {}
    },
    {
      day: 2,
      inflow: {
        sol_token: { decrypt: 35, resonance_main: 15, resonance_ml: 10 },
        sol_crystal: { vein_mine: 15, tidal_spawn: 3, resonance_calib: 2 }
      },
      outflow: {
        sol_token: { scanner: 25, ship: 15 },
        sol_crystal: { resonance_commit: 14 }
      },
      transfers: {}
    },
    {
      day: 3, // 当前日
      inflow: {
        sol_token: { decrypt: 40, resonance_main: 22, checkin: 5 },
        sol_crystal: { vein_mine: 20, flotsam_manual: 6, shard_condense: 2, resonance_free: 3 }
      },
      outflow: {
        sol_token: { refinery: 12, shop: 18 },
        sol_crystal: { decrypt_consume: 8, resonance_commit: 10, refinery_consume: 4 }
      },
      transfers: {}
    }
  ]
};

const fixedMotherlode = {
  pool: 150,
  injected: 80,
  paid: 45,
  burned: 30
};

await browserSession(async ({ evaluate, send, errors, wait }) => {
  // 3.1 注入固定账本与母晶池数据
  await evaluate(`(() => {
    const g = window.__game;
    g.survival.day = 3; // 设置当前游戏日为 Day 3

    // 注入固定账本
    g.economyLedger.days = ${JSON.stringify(fixedLedgerData.days)};

    // 注入固定母晶池数据
    if (!g.miningRig) g.miningRig = {};
    g.miningRig.motherlode = ${JSON.stringify(fixedMotherlode)};
  })()`);

  // 3.2 测试入口：点击顶部状态带代币数量显示 #txt-hud-sol-token
  const clickResult = await evaluate(`(() => {
    const solTokenEl = document.getElementById('txt-hud-sol-token');
    const quickMiningBtn = document.getElementById('btn-quick-mining');

    let rigModalOpened = false;
    const origOpenRig = window.__game.ui.openMiningRigModal;
    window.__game.ui.openMiningRigModal = () => { rigModalOpened = true; };

    // 点击代币元素
    solTokenEl.click();

    const drawer = document.getElementById('ledger-drawer');
    const isOpen = drawer && drawer.classList.contains('open');
    const isModalOpen = document.body.classList.contains('hud-modal-open');

    window.__game.ui.openMiningRigModal = origOpenRig;
    return { isOpen, isModalOpen, rigModalOpened };
  })()`);

  assert.ok(clickResult.isOpen, '点击代币元素后抽屉必须处于打开状态 (.open)');
  assert.ok(clickResult.isModalOpen, '抽屉打开时 document.body 必须带有 hud-modal-open 以暂停 NoticeCenter');
  assert.equal(clickResult.rigModalOpened, false, '点击代币元素必须阻止事件冒泡，不触发矿机弹窗');
  console.log('  ✅ 代币元素独立点击入口与 NoticeCenter 暂停联动验证通过！');

  // 3.3 验证抽屉内各项数值严格等于账本数据
  const drawerValues = await evaluate(`(() => {
    const summary = window.__game.ui.getLedgerSummary();
    const drawer = document.getElementById('ledger-drawer');

    const tokenInflow = Number(drawer.querySelector('#ledger-token-inflow')?.dataset.val);
    const tokenOutflow = Number(drawer.querySelector('#ledger-token-outflow')?.dataset.val);
    const tokenNet = Number(drawer.querySelector('#ledger-token-net')?.dataset.val);

    const crystalInflow = Number(drawer.querySelector('#ledger-crystal-inflow')?.dataset.val);
    const crystalOutflow = Number(drawer.querySelector('#ledger-crystal-outflow')?.dataset.val);
    const crystalNet = Number(drawer.querySelector('#ledger-crystal-net')?.dataset.val);

    const chartBars = [...drawer.querySelectorAll('.ledger-drawer-chart-col')].map(col => ({
      day: Number(col.dataset.day),
      net: Number(col.dataset.net)
    }));

    const resCommitted = Number(drawer.querySelector('#ledger-res-committed')?.dataset.val);
    const resEquiv = Number(drawer.querySelector('#ledger-res-equiv')?.dataset.val);
    const resRecovered = Number(drawer.querySelector('#ledger-res-recovered')?.dataset.val);
    const mlInjected = Number(drawer.querySelector('#ledger-ml-injected')?.dataset.val);
    const mlPaid = Number(drawer.querySelector('#ledger-ml-paid')?.dataset.val);
    const mlBurned = Number(drawer.querySelector('#ledger-ml-burned')?.dataset.val);

    const disclaimer = drawer.querySelector('#ledger-drawer-disclaimer')?.textContent.trim();
    const simRowText = drawer.querySelector('#ledger-ml-burned')?.closest('.ledger-drawer-resonance-row')?.textContent;

    // 获取 computed style
    const cs = window.getComputedStyle(drawer);
    const rootCs = window.getComputedStyle(document.documentElement);

    return {
      summary,
      tokenInflow, tokenOutflow, tokenNet,
      crystalInflow, crystalOutflow, crystalNet,
      chartBars,
      resCommitted, resEquiv, resRecovered,
      mlInjected, mlPaid, mlBurned,
      disclaimer,
      simRowText,
      bgColor: cs.backgroundColor,
      borderColor: cs.borderColor,
      borderRadius: cs.borderTopLeftRadius,
      rootSurface: rootCs.getPropertyValue('--cozy-hud-surface').trim(),
      rootBorder: rootCs.getPropertyValue('--cozy-hud-border').trim()
    };
  })()`);

  // [段落 1: 今日]
  // sol_token 今日流入: 40(decrypt) + 22(resonance_main) + 5(checkin) = 67
  assert.equal(drawerValues.tokenInflow, 67, '今日算力代币流入严格等于 67');
  // sol_token 今日流出: 12(refinery) + 18(shop) = 30
  assert.equal(drawerValues.tokenOutflow, 30, '今日算力代币流出严格等于 30');
  assert.equal(drawerValues.tokenNet, 37, '今日算力代币净流入严格等于 37');

  // sol_crystal 今日流入: 20(vein_mine) + 6(flotsam_manual) + 2(shard_condense) + 3(resonance_free) = 31
  assert.equal(drawerValues.crystalInflow, 31, '今日晶石流入严格等于 31');
  // sol_crystal 今日流出: 8(decrypt_consume) + 10(resonance_commit) + 4(refinery_consume) = 22
  assert.equal(drawerValues.crystalOutflow, 22, '今日晶石流出严格等于 22');
  assert.equal(drawerValues.crystalNet, 9, '今日晶石净流入严格等于 9');

  // [段落 2: 近 7 日净流入迷你柱图]
  assert.ok(drawerValues.chartBars.length <= 7, '柱图柱数必须 ≤ 7');
  assert.equal(drawerValues.chartBars.length, 3, 'Day 1..3 对应 3 根柱');
  // Day 1: 25 - 18 = 7
  assert.equal(drawerValues.chartBars[0].day, 1);
  assert.equal(drawerValues.chartBars[0].net, 7);
  // Day 2: 60 - 40 = 20
  assert.equal(drawerValues.chartBars[1].day, 2);
  assert.equal(drawerValues.chartBars[1].net, 20);
  // Day 3: 67 - 30 = 37
  assert.equal(drawerValues.chartBars[2].day, 3);
  assert.equal(drawerValues.chartBars[2].net, 37);

  // [段落 3: 共振专项]
  // 本次会话投入晶石数: 6(D1) + 14(D2) + 10(D3) = 30
  assert.equal(drawerValues.resCommitted, 30, '投入晶石数严格等于 30');
  // 折合代币: 30 * 1.35 = 40.5
  assert.equal(drawerValues.resEquiv, 40.5, '折合代币严格等于 40.5');
  // 回收代币: 15(D2 main) + 10(D2 ml) + 22(D3 main) = 47
  assert.equal(drawerValues.resRecovered, 47, '回收代币严格等于 47');
  // 母晶池注入/派发/销毁
  assert.equal(drawerValues.mlInjected, 80, '母晶池累计注入严格等于 80');
  assert.equal(drawerValues.mlPaid, 45, '母晶池累计派发严格等于 45');
  assert.equal(drawerValues.mlBurned, 30, '模拟矿工分走严格等于 30');

  // [模拟矿工标签校验]
  assert.ok(drawerValues.simRowText.includes('模拟'), '模拟矿工行必须明确包含「模拟」二字标签');

  // [免责声明原文在场]
  const expectedDisclaimer = '算力代币是游戏内道具，不能兑换 SOL 或 SKR，不承诺任何收益。';
  assert.equal(drawerValues.disclaimer, expectedDisclaimer, '底部固定免责声明必须一字不差');

  // [Cozy 样式变量校验]
  assert.ok(drawerValues.bgColor.includes('28, 43, 40') || drawerValues.bgColor === drawerValues.rootSurface, '抽屉背景色必须等于 --cozy-hud-surface 取值');
  assert.ok(drawerValues.borderRadius === '24px', '抽屉圆角必须为 24px');

  console.log('  ✅ 抽屉今日收支、7日柱图、共振专项数值 100% 吻合账本，模拟标签与免责声明原文在场！');

  // 3.4 验证抽屉关闭逻辑
  const closeResult = await evaluate(`(() => {
    const closeBtn = document.getElementById('btn-ledger-close');
    closeBtn.click();
    const drawer = document.getElementById('ledger-drawer');
    return {
      isOpen: drawer.classList.contains('open'),
      isModalOpen: document.body.classList.contains('hud-modal-open')
    };
  })()`);
  assert.equal(closeResult.isOpen, false, '点击关闭按钮后抽屉必须收起');
  assert.equal(closeResult.isModalOpen, false, '抽屉收起后 hud-modal-open 必须移除');
  console.log('  ✅ 抽屉关闭与遮罩状态恢复逻辑验证通过！');

  // ========================================================
  // 4. 无头截图生成 (竖屏 390x844 与 横屏 844x390)
  // ========================================================
  console.log('\n▶ [4/5] 捕获竖屏 (390×844) 与横屏 (844×390) 抽屉打开态无头截图...');

  // 4.1 竖屏截图 (390x844)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: { angle: 0, type: 'portraitPrimary' }
  });
  await evaluate('window.__game.ui.openLedgerDrawer()');
  await wait(500); // 等待抽屉滑动入场动画完成
  const portraitShot = await send('Page.captureScreenshot', { format: 'png' });
  const portraitShotPath = path.join(outDir, 'portrait.png');
  await writeFile(portraitShotPath, Buffer.from(portraitShot.data, 'base64'));
  console.log(`  📸 竖屏截图已保存: ${portraitShotPath}`);

  // 4.2 横屏截图 (844x390)
  await evaluate('window.__game.ui.closeLedgerDrawer()');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: { angle: 90, type: 'landscapePrimary' }
  });
  await evaluate('window.__game.ui.openLedgerDrawer()');
  await wait(500); // 等待抽屉滑动入场动画完成
  const landscapeShot = await send('Page.captureScreenshot', { format: 'png' });
  const landscapeShotPath = path.join(outDir, 'landscape.png');
  await writeFile(landscapeShotPath, Buffer.from(landscapeShot.data, 'base64'));
  console.log(`  📸 横屏截图已保存: ${landscapeShotPath}`);

  // 关闭抽屉收尾
  await evaluate('window.__game.ui.closeLedgerDrawer()');

  // ========================================================
  // 5. 控制台零错误断言
  // ========================================================
  console.log('\n▶ [5/5] 校验运行时控制台与异常日志...');
  const realErrors = errors.filter(e => e.entry?.source !== 'intervention');
  assert.equal(realErrors.length, 0, `运行期间控制台必须零错误，实际发现: ${JSON.stringify(realErrors)}`);
  console.log('  ✅ 运行期间控制台零错误！');
});

console.log('\n🎉🎉 [A1 COMPUTE LEDGER UI PASSED] 第 A1 轮算力总账 UI 验收标准 100% 达成！\n');
