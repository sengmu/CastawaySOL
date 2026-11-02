// CastawaySOL - 主线重排轮运行时冒烟截图工具
// 依据 docs/MAINLINE-SPINE.md 规范：
// 捕获六章章节门与核心系统UI截图至 docs/qa/mainline-spine/
// 校验控制台 0 运行时错误

import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { browserSession } from './lib/browser-session.mjs';

const outDir = join(process.cwd(), 'docs/qa/mainline-spine');

console.log('📸 开始执行 CastawaySOL 主线矿业脊柱运行时冒烟与多章门 UI 截图...\n');

await browserSession(async ({ evaluate, send, errors, wait }) => {
  // 辅助截图函数
  const capture = async (filename) => {
    await evaluate(`window.__game?.renderer?.render(window.__game.scene, window.__game.camera)`);
    await wait(300);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(outDir, filename), Buffer.from(screenshot.data, 'base64'));
    console.log(`  📸 截图已保存: ${filename}`);
  };

  // 1. Chapter 0: 序章 - 初始晶石与矿机雏形
  console.log('▶ [1/7] 捕获序章 Chapter 0 矿机雏形与主线目标 HUD...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 0;
    g.story.currentStepIndex = 0;
    g.player.position.set(-14.0, 0, 18.0);
    g.camera.position.set(-14.0, 5.0, 26.0);
    g.camera.lookAt(-14.0, 1.0, 18.0);
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.showToast('⛏️ 序章目标：拾得第一块晶石 + 拼出矿机雏形', 'important');
  })()`);
  await capture('chapter-0-prologue.png');

  // 2. Chapter 1: 第一章 - 矿机首次出块与累计达标 (6 SOL)，北崖灯塔遗迹初现
  console.log('▶ [2/7] 捕获第一章 Chapter 1 矿机出块与远眺北崖灯塔遗迹...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 1;
    g.story.currentStepIndex = 2; // craft_axe
    g.miningRig.totalBlocksMined = 1;
    g.miningRig.totalSolMined = 6;
    g.player.position.set(-5.0, 1.0, 5.0);
    g.camera.position.set(-5.0, 8.0, 18.0);
    g.camera.lookAt(24, 6.0, -26); // 望向北崖灯塔
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.showToast('⛏️ 第一章门达成：出块 #1，累计挖矿产出 6 SOL，北崖灯塔遗迹显现！', 'important');
  })()`);
  await capture('chapter-1-mining-gate.png');

  // 3. Chapter 2: 第二章 - 扫描仪 Mk1 装配与共振勘探面板
  console.log('▶ [3/7] 捕获第二章 Chapter 2 扫描仪与共振勘探面板...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 2;
    g.story.currentStepIndex = 1;
    g.miningRig.scannerLevel = 1;
    g.story.firstResonanceSettled = true;
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.openMiningRigModal(g.miningRig);
  })()`);
  await capture('chapter-2-resonance-scanner.png');

  // 关闭矿机弹窗
  await evaluate(`(() => {
    const modal = document.querySelector('.mining-rig-modal');
    if (modal) modal.remove();
    document.body.classList.remove('hud-modal-open');
  })()`);
  await wait(200);

  // 4. Chapter 3: 第三章 - 精炼厂开工、纯晶交付与矿机 L2
  console.log('▶ [4/7] 捕获第三章 Chapter 3 精炼厂纯晶与矿机 L2 篇章突破...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 3;
    g.story.currentStepIndex = 0;
    g.campFacilities.refineryLevel = 1;
    g.miningRig.rigLevel = 2;
    g.story.pureCrystalDelivered = true;
    g.ui.inventory['sol_crystal_pure'] = 2;
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.showToast('💎 第三章门达成：精炼厂开工，首块纯晶交付完毕，矿机晋升 L2！', 'important');
  })()`);
  await capture('chapter-3-refinery-gate.png');

  // 5. Chapter 4: 第四章 - 船体建造精炼材料与雷蒙德远航营救
  console.log('▶ [5/7] 捕获第四章 Chapter 4 出海船只精炼升级面板...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 4;
    g.story.currentStepIndex = 1;
    g.story.secondKidAwake = true;
    g.story.raymondRescued = true;
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.openShipUpgradeModal(g.shipUpgradeSystem);
  })()`);
  await capture('chapter-4-shipyard-gate.png');

  // 关闭船坞弹窗
  await evaluate(`(() => {
    const modal = document.querySelector('.ship-upgrade-modal');
    if (modal) modal.remove();
    document.body.classList.remove('hud-modal-open');
  })()`);
  await wait(200);

  // 6. Chapter 5: 第五章 - 北崖灯塔一期大工程点亮运转与旋转光束
  console.log('▶ [6/7] 捕获第五章 Chapter 5 北崖灯塔一期交付点亮与探照光束...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 5;
    g.story.currentStepIndex = 0;
    g.lighthouse.setLit(true);
    g.story.lighthouseLit = true;
    g.miningRig.rigLevel = 4;
    g.player.position.set(24, 2.0, -18.0);
    g.camera.position.set(24, 7.0, -8.0);
    g.camera.lookAt(24, 10.0, -26.0);
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.showToast('🌟 第五章门达成：北崖灯塔一期大工程点亮！矿机解封 L4 升级！', 'important');
  })()`);
  await capture('chapter-5-lighthouse-lit.png');

  // 7. Chapter 6: 第六章 - 自由经营与营地每日订单板
  console.log('▶ [7/7] 捕获第六章 Chapter 6 营地求生与算力每日订单板...');
  await evaluate(`(() => {
    const g = window.__game;
    g.story.currentChapterId = 6;
    g.story.isCompleted = true;
    g.ui.updateObjective(g.story.getQuestBannerText());
    g.ui.openOrderBoardModal();
  })()`);
  await capture('chapter-6-order-board.png');

  // 校验控制台错误数量
  console.log('\n▶ 校验浏览器控制台错误...');
  const realErrors = errors.filter(e => {
    const str = JSON.stringify(e);
    return !str.includes('favicon.ico') && !str.includes('404');
  });
  assert.equal(realErrors.length, 0, '浏览器运行时必须 0 控制台错误: ' + JSON.stringify(realErrors));
  console.log('  ✅ 运行时控制台零错误！');
});

console.log('\n🎉🎉🎉 [MAINLINE SMOKE CAPTURE COMPLETED] 七大章节门与核心 UI 截图捕获全部完成！\n');
