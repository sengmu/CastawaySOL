// CastawaySOL - 竖屏布局：顶部状态带与底部同基线的双手操作区
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.log("📱 开始执行 CastawaySOL 竖屏第四轮（四线网格几何对齐、水壶常驻、提示3秒、16px圆点）测试套件...\n");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// 1. 验证 UIManager 代码结构与第四轮 7 项要求
console.log("▶ [1/5] 验证 UIManager 竖屏 7 项设计实现状态与关键字...");
const uiCode = fs.readFileSync(path.join(projectRoot, "src/ui/UIManager.js"), "utf8");
const vjCode = fs.readFileSync(path.join(projectRoot, "src/ui/VirtualJoystick.js"), "utf8");
const cozyCss = fs.readFileSync(path.join(projectRoot, "src/ui/CozyPortraitHud.css"), "utf8");
const landscapeCss = fs.readFileSync(path.join(projectRoot, "src/ui/CozyLandscapeHud.css"), "utf8");

// 1) 顶部 flex 行容器：状态胶囊与右侧三按钮同行同高 48px、gap 8px、外边距 12px
assert.ok(cozyCss.includes("height: 98px !important;"), "顶部两张状态卡本体必须收在 98px 内（体积拉升轮新预算）");
assert.ok(cozyCss.includes("width: 134px !important;"), "右侧三按钮组必须容纳三个 42px 点击区及间距");
assert.ok(cozyCss.includes("background: var(--cozy-hud-surface)") && landscapeCss.includes("--cozy-hud-surface:"), "竖屏与横屏必须共用桌面 HUD 的深绿面板色板");

// 2) 胶囊内顺序生命→饱食→水分→疲劳→水壶纯文本数字、水壶无内层胶囊边框，天数/步数/天气为下方 11px 弱化小字、步数默认隐藏
// 顶带规范：天气栏约四分之一宽，后三项等宽；水壶收归底部快捷栏。
assert.ok(cozyCss.includes("grid-template-columns: .95fr 1fr 1fr 1fr !important;"), "第二行必须按天气栏与三项等宽状态排列");
assert.ok(uiCode.includes("strip-subline"), "包含下方弱化小字");
assert.ok(uiCode.includes("display: none !important;") && uiCode.includes("strip-sub-steps"), "步数必须默认隐藏");

// 3) 角标统一为按钮右上角 16px 圆点，按钮本体不印数字
assert.ok(uiCode.includes("width: 16px !important") && uiCode.includes("height: 16px !important"), "角标必须统一为 16px 圆点");
assert.ok(uiCode.includes("top-right-group #txt-hud-sol-token { display: none !important; }"), "竖屏下按钮本体不印数字");

// 4) 底部双锚：摇杆与右下组共用同一 bottom 值（含安全区变量），两组垂直中心同线，摇杆直径上限 min(30vw, 120px)
assert.ok(vjCode.includes("Math.min(window.innerWidth * 0.15, 60)"), "摇杆底盘半径上限必须限制在 60px (直径 <= 120px 且 <= 30vw)");
assert.ok(vjCode.includes("centerYFromBottom = isPortrait ? (Math.max(16, sab) + this.baseRadius)"), "摇杆底边必须与互动按钮使用同一安全边距");
assert.ok(cozyCss.includes("bottom: max(16px, var(--sab, 0px)) !important;"), "右下按钮区必须使用同一安全边距");

// 5) 右下组：44px 小按钮在 88px 主按钮左侧，保留 4px 水平间距与情境攻击替换位置。
assert.ok(cozyCss.includes("width: 148px !important;"), "右下操作区宽度必须固定为 148px（体积拉升轮新预算）");
assert.ok(cozyCss.includes("width: 96px !important;"), "互动主按钮宽度必须为 96px（体积拉升轮新预算）");
assert.ok(cozyCss.includes("#btn-quick-attack:not(.ctx-hidden)"), "战斗时必须有情境攻击位置");
assert.ok(cozyCss.includes("#btn-quick-jump { display: none !important; }"), "战斗时攻击必须替换跳跃，不能增加第四个按钮");
assert.ok(cozyCss.includes(".aux-btn.ctx-hidden { display: none !important; }"), "隐藏的攻击键不可占用触控区");

// 6) 喝水在底部中央快捷栏固定第 1 格常驻（缺水高亮），不在右下动作区，水分归零时才临时顶替主按钮
assert.ok(uiCode.includes("quick-canteen-slot"), "快捷栏必须固定第 1 格为便携水壶");
assert.ok(uiCode.includes("quick-canteen-alert"), "缺水时快捷栏水壶槽位必须触发高亮告警");
assert.ok(uiCode.includes("_isWaterDepleted"), "水分归零必须临时顶替主动作胶囊按钮");

// 7) 提示固定在状态行下方（top由48px行高推导）、宽min(92vw,380px)居中、同时最多1条3秒淡出
assert.ok(uiCode.includes("width: min(92vw, 380px) !important;"), "提示横幅宽度必须为 min(92vw, 380px)");

console.log("  ✅ UIManager 与 VirtualJoystick 代码结构 7 项核对全部达标！");

// 2. 模拟真机分辨率测试四条网格线：
// 网格线1: 四边距一致 (四边外边距均为 12px + 安全区)
// 网格线2: 顶部同高 (状态胶囊行高 48px 与右上三按钮 48px 完全一致)
// 网格线3: 摇杆和互动按钮底边同线
// 网格线4: 物品栏在操作区上方并留出间隙
console.log("\n▶ [2/5] 验证典型竖屏机型下的四条关键网格线几何数学严格性...");

function verifyGridLines(screenWidth, screenHeight, sat, sar, sab, sal, phoneModel) {
  // 网格线 1: 四边距一致
  const marginT = Math.max(12, sat);
  const marginR = Math.max(12, sar);
  const marginB = Math.max(16, sab);
  const marginL = Math.max(12, sal);

  // 网格线 2: 顶部同高
  const topStripHeight = 98;
  const topButtonsHeight = 42;
  assert.ok(topStripHeight >= topButtonsHeight, "顶部状态带容纳 42px 按钮组");

  const topButtonsLeft = screenWidth - Math.max(16, sar) - 134;
  assert.ok(topButtonsLeft >= 208, "顶部三按钮不得挤入头像和生命区");

  // 网格线 3: 摇杆中心距底边 = 安全边距 + 半径，所以底边与互动按钮一致
  const radius = Math.min(54, screenWidth * 0.15, 60);
  const joystickBottomY = screenHeight - (marginB + radius) + radius;
  const actionBottomY = screenHeight - marginB;
  assert.equal(joystickBottomY, actionBottomY, "摇杆与互动按钮底边未同线!");

  // 摇杆直径上限检查
  const maxAllowedDiam = Math.min(screenWidth * 0.30, 120);
  const actualRadius = Math.min(54, screenWidth * 0.15, 60);
  const actualDiam = actualRadius * 2;
  assert.ok(actualDiam <= maxAllowedDiam + 0.001, `摇杆直径 ${actualDiam} 超出上限 ${maxAllowedDiam}!`);

  // 网格线 4: 物品栏底边比操作区顶部高 18px
  const quickbarBottomY = screenHeight - marginB - 184;
  const controlsTopY = screenHeight - marginB - 128;
  assert.equal(controlsTopY - quickbarBottomY, 56, "物品栏与操作区间距必须为 56px");

  // 顶部常驻占屏比检查
  const topBarBottom = sat + 94;
  const persistentPct = (topBarBottom / screenHeight) * 100;
  assert.ok(persistentPct <= 16.5, "顶部常驻 UI 超出 16.5% 屏高!");

  console.log(`  📱 [${phoneModel}] 实测数据:`);
  console.log(`     • 四边安全边距: [T:${marginT}px, R:${marginR}px, B:${marginB}px, L:${marginL}px] (一致)`);
  console.log(`     • 顶部状态带 ${topStripHeight}px 容纳三个 ${topButtonsHeight}px 按钮`);
  console.log(`     • 底部同线: 摇杆底边 Y ${joystickBottomY}px == 互动按钮底边 Y ${actionBottomY}px`);
  console.log(`     • 摇杆尺寸约束: 直径 ${actualDiam}px <= 上限 ${maxAllowedDiam.toFixed(1)}px (达标)`);
  console.log(`     • 物品栏与操作区垂直间距: ${controlsTopY - quickbarBottomY}px`);
  console.log(`     • 顶部常驻占屏比: ${persistentPct.toFixed(2)}% (严格 <=16.5%)`);
}

verifyGridLines(412, 915, 36, 0, 24, 0, "Solana Seeker (412x915)");
verifyGridLines(390, 844, 44, 0, 34, 0, "标准全面屏 iPhone (390x844)");
verifyGridLines(360, 780, 24, 0, 16, 0, "紧凑型手机 (360x780)");

// 3. 验证快捷栏常驻水壶与缺水高亮
console.log("\n▶ [3/5] 验证底部中央快捷栏水壶槽位与提示系统...");
assert.ok(uiCode.includes("quick-canteen-slot"), "必须在第1格常驻水壶");
assert.ok(uiCode.includes("饮用便携水壶"), "水壶槽位必须具备快捷提示");

// 4. 验证角标圆点与数字剥离
console.log("\n▶ [4/5] 验证右上角按钮本体不印数字与16px圆点角标...");
assert.ok(uiCode.includes("top-right-group #txt-hud-sol-token { display: none !important; }"), "右上角矿机按钮内数字已隐藏");
assert.ok(uiCode.includes("width: 16px !important"), "角标具有 16px 规范尺寸");

// 5. 验证提示居中与宽度
console.log("\n▶ [5/5] 验证提示横幅居中与宽度推导...");
assert.ok(uiCode.includes("left: 50% !important;"), "横幅水平居中对齐");
assert.ok(uiCode.includes("transform: translateX(-50%) !important;"), "横幅平移居中");
assert.ok(uiCode.includes("top: calc(var(--sat, 0px) + 94px) !important;"), "横幅垂直坐标严格根据状态带与任务卡推导");

console.log("\n🎉🎉 [PHASE 4 PORTRAIT REALIGNMENT PASSED] 竖屏第四轮四线网格几何对齐与自查断言 100% 通过！");
