// CastawaySOL - 动森 UI 图标接线与注册表自动化测试套件
// 验证项：
// 1. 26 个新增 HUD 图标全量注册于 AVAILABLE 且通过 iconPath 可解析
// 2. 26 个图标均在 public/icons/hud/ 存在实际文件且有对应 UI_EMOJI 兜底
// 3. 四维状态映射函数 / 渲染输出包含对应 hud/ (health, food, water, energy) 路径
// 4. 四种天气映射函数 / 渲染输出包含对应 hud/ (weather_clear, weather_cloudy, weather_rain, weather_typhoon) 路径，未知天气回退 emoji
// 5. UIManager 与 InteractionFeedbackSystem 中关键渲染点接线断言

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('🎨 开始执行 CastawaySOL 动森新图标接线与注册表自动化测试套件...\n');

// 导入图标注册表
const {
  iconPath,
  iconEmoji,
  hasIcon,
  iconHTML,
  SURVIVAL_ICON_MAP,
  getSurvivalIconHtml,
  WEATHER_ICON_MAP,
  WEATHER_EMOJI_FALLBACK,
  getWeatherIconHtml
} = await import('../src/ui/IconRegistry.js');

// 26 个新增图标清单
const NEW_26_ICONS = [
  'hud/health', 'hud/food', 'hud/water', 'hud/energy',
  'hud/weather_clear', 'hud/weather_cloudy', 'hud/weather_rain', 'hud/weather_typhoon',
  'hud/motherlode', 'hud/shard', 'hud/score_rs',
  'hud/prompt_crystal', 'hud/prompt_monkey', 'hud/prompt_heart', 'hud/prompt_crab',
  'hud/prompt_fire', 'hud/prompt_tracks', 'hud/prompt_boss', 'hud/prompt_generic',
  'hud/quest', 'hud/quest_flag', 'hud/solana', 'hud/close', 'hud/check', 'hud/warn', 'hud/lock'
];

// ==========================================
// 1. 验证 26 个新增 ID 全部 iconPath 可解析且物理文件存在
// ==========================================
console.log('▶ [1/4] 验证 26 个新增 HUD 图标解析与物理文件存在性...');
assert.strictEqual(NEW_26_ICONS.length, 26, '必须包含 26 个新增图标');

for (const id of NEW_26_ICONS) {
  const resolvedPath = iconPath(id);
  assert.strictEqual(resolvedPath, id, `图标 id ${id} 必须能被 iconPath 准确解析为其本身路径`);
  assert.strictEqual(hasIcon(id), true, `hasIcon(${id}) 必须为 true`);

  const filePath = path.join(projectRoot, 'public', 'icons', `${id}.png`);
  assert.ok(fs.existsSync(filePath), `物理文件 public/icons/${id}.png 必须存在`);

  const emoji = iconEmoji(id);
  assert.ok(emoji && emoji !== '📦', `图标 ${id} 必须在 UI_EMOJI 配置对应 fallback emoji (当前: ${emoji})`);

  const html = iconHTML(id, 20);
  assert.ok(html.includes(`src="/icons/${id}.png"`), `iconHTML(${id}) 生成的 HTML 必须包含正确 src 路径`);
  assert.ok(html.includes(`data-icon="${id}"`), `iconHTML(${id}) 必须包含正确的 data-icon 属性`);
}
console.log('  ✅ 全部 26 个新增图标 iconPath 解析、文件存在性与 emoji 兜底 100% 验证通过！');

// ==========================================
// 2. 验证四维状态映射函数与渲染输出包含对应 hud/ 路径
// ==========================================
console.log('\n▶ [2/4] 验证四维生存状态映射函数与渲染输出...');
const survivalStats = [
  { key: 'health', path: 'hud/health', aliases: ['life'] },
  { key: 'food', path: 'hud/food', aliases: ['hunger'] },
  { key: 'water', path: 'hud/water', aliases: [] },
  { key: 'energy', path: 'hud/energy', aliases: ['fatigue'] }
];

for (const stat of survivalStats) {
  assert.strictEqual(SURVIVAL_ICON_MAP[stat.key], stat.path, `SURVIVAL_ICON_MAP[${stat.key}] 必须映射为 ${stat.path}`);
  const html = getSurvivalIconHtml(stat.key, 24);
  assert.ok(html.includes(`src="/icons/${stat.path}.png"`), `getSurvivalIconHtml(${stat.key}) 输出必须包含 ${stat.path}`);

  for (const alias of stat.aliases) {
    assert.strictEqual(SURVIVAL_ICON_MAP[alias], stat.path, `SURVIVAL_ICON_MAP 别名 ${alias} 必须映射为 ${stat.path}`);
    const aliasHtml = getSurvivalIconHtml(alias, 24);
    assert.ok(aliasHtml.includes(`src="/icons/${stat.path}.png"`), `getSurvivalIconHtml(${alias}) 输出必须包含 ${stat.path}`);
  }
}
console.log('  ✅ 四维生存状态映射函数与渲染输出包含对应 hud/ 路径断言 100% 通过！');

// ==========================================
// 3. 验证天气四种映射函数与渲染输出包含对应 hud/ 路径及未知回退
// ==========================================
console.log('\n▶ [3/4] 验证四种天气映射函数、渲染输出与未知天气回退...');
const weatherTypes = [
  { key: 'clear', path: 'hud/weather_clear' },
  { key: 'cloudy', path: 'hud/weather_cloudy' },
  { key: 'rain', path: 'hud/weather_rain' },
  { key: 'typhoon', path: 'hud/weather_typhoon' }
];

for (const w of weatherTypes) {
  assert.strictEqual(WEATHER_ICON_MAP[w.key], w.path, `WEATHER_ICON_MAP[${w.key}] 必须映射为 ${w.path}`);
  const html = getWeatherIconHtml(w.key, 22);
  assert.ok(html.includes(`src="/icons/${w.path}.png"`), `getWeatherIconHtml(${w.key}) 输出必须包含 ${w.path}`);
}

// 验证未知天气回退为原 emoji
const unknownOutput = getWeatherIconHtml('unknown_storm');
assert.strictEqual(unknownOutput, '☀️', '未知天气必须安全回退原 emoji (☀️)');
console.log('  ✅ 四种天气映射输出包含对应 hud/ 路径与未知回退断言 100% 通过！');

// ==========================================
// 4. 验证 UIManager、InteractionFeedbackSystem 与 CozyLandscapeHud.css 接线结构
// ==========================================
console.log('\n▶ [4/4] 验证核心系统源码接线锚点...');
const uiCode = fs.readFileSync(path.join(projectRoot, 'src/ui/UIManager.js'), 'utf8');
const ifsCode = fs.readFileSync(path.join(projectRoot, 'src/systems/InteractionFeedbackSystem.js'), 'utf8');
const cozyLandscapeCss = fs.readFileSync(path.join(projectRoot, 'src/ui/CozyLandscapeHud.css'), 'utf8');

// 4.1 四维状态栏与天气接线
assert.ok(uiCode.includes("getSurvivalIconHtml('health', 24)"), 'UIManager 横屏生命状态必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getSurvivalIconHtml('food', 24)"), 'UIManager 横屏饱食状态必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getSurvivalIconHtml('water', 24)"), 'UIManager 横屏饮水状态必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getSurvivalIconHtml('energy', 24)"), 'UIManager 横屏疲劳状态必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getWeatherIconHtml('clear', 22)"), 'UIManager 横屏天气符号必须接入 getWeatherIconHtml');
assert.ok(uiCode.includes("getWeatherIconHtml('clear', 20)"), 'UIManager 竖屏天气符号必须接入 getWeatherIconHtml');
assert.ok(uiCode.includes("getSurvivalIconHtml('food', 18)"), 'UIManager 竖屏饱食图标必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getSurvivalIconHtml('water', 18)"), 'UIManager 竖屏饮水图标必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getSurvivalIconHtml('energy', 18)"), 'UIManager 竖屏疲劳图标必须接入 getSurvivalIconHtml');
assert.ok(uiCode.includes("getWeatherIconHtml(ws.currentWeather, 22)"), 'UIManager 动态天气刷新必须接入 getWeatherIconHtml');
assert.ok(uiCode.includes("getWeatherIconHtml(ws.currentWeather, 20)"), 'UIManager 动态竖屏天气刷新必须接入 getWeatherIconHtml');

// 4.2 CozyLandscapeHud.css 不再强制伪元素覆盖
assert.ok(cozyLandscapeCss.includes(".dashboard-panel .gauge-label-row > span:first-child::before { content: none !important; }"), '横屏 HUD 不得用 ::before 强塞 emoji 盖住黏土图标');

// 4.3 共振面板三处显示接线
assert.ok(uiCode.includes("iconHTML('hud/motherlode'"), '共振面板必须接入 hud/motherlode');
assert.ok(uiCode.includes("iconHTML('hud/shard'"), '共振面板必须接入 hud/shard');
assert.ok(uiCode.includes("iconHTML('hud/score_rs'"), '共振面板必须接入 hud/score_rs');

// 4.4 交互提示浮标 (InteractionFeedbackSystem & UIManager)
const promptIcons = [
  'hud/prompt_crystal', 'hud/prompt_monkey', 'hud/prompt_heart', 'hud/prompt_crab',
  'hud/prompt_fire', 'hud/prompt_tracks', 'hud/prompt_boss', 'hud/prompt_generic'
];
for (const p of promptIcons) {
  assert.ok(ifsCode.includes(p), `InteractionFeedbackSystem 必须包含情境映射 ${p}`);
  assert.ok(uiCode.includes(p), `UIManager clayCtx 必须包含情境映射 ${p}`);
}

// 4.5 通用图标接线 (quest, solana, close, check, lock)
assert.ok(uiCode.includes("iconHTML('hud/quest'"), '任务栏必须接入 hud/quest');
assert.ok(uiCode.includes("iconHTML('hud/solana'"), 'Solana 按钮与状态必须接入 hud/solana');
assert.ok(uiCode.includes("iconHTML('hud/close'"), '弹窗关闭按钮必须接入 hud/close');
assert.ok(uiCode.includes("iconHTML('hud/lock'"), '共振锁定状态必须接入 hud/lock');
assert.ok(uiCode.includes("iconHTML('hud/check'"), '共振锁定/完成必须接入 hud/check');

console.log('  ✅ 核心系统源码接线锚点断言 100% 验证通过！');

console.log('\n🎉🎉🎉 [ALL ICON WIRING TESTS PASSED] 26 个动森新图标接线与注册表验证 100% 成功！');
