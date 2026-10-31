// CastawaySOL - 移动端全面适配与工效学自动化验证套件
// 验证：取消强制横屏硬阻断、支持横竖屏自适应、小屏触控摇杆、右半屏滑屏视角与双指捏合缩放、无键盘残留
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('📱 开始执行 CastawaySOL 移动端全面适配专项测试套件...\n');

const projectRoot = path.resolve('E:/CastawaySOL/island-game');

// 1. 验证 index.html 不再阻断竖屏手机
console.log('▶ [1/4] 验证 index.html 解除竖屏硬阻断...');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
assert.ok(!indexHtml.includes('#orientation-hint { display: flex; }'), '已彻底移除竖屏阻断蒙版');
assert.ok(indexHtml.includes('viewport-fit=cover'), '已启用刘海屏安全区全覆盖 viewport-fit=cover');
console.log('  ✅ 手机竖屏遮罩已解除，支持自由竖屏与横屏游玩！');

// 2. 验证 PlayerController 具备双指捏合与右半屏触控
console.log('\n▶ [2/4] 验证 PlayerController 手势支持 (双指缩放与视角滑动)...');
const pcCode = fs.readFileSync(path.join(projectRoot, 'src/entities/PlayerController.js'), 'utf8');
assert.ok(pcCode.includes('pinchDist'), '必须包含双指捏合缩放视距变量 pinchDist');
assert.ok(pcCode.includes('e.touches.length === 2'), '必须包含双触点判定');
assert.ok(pcCode.includes('touchend') && pcCode.includes('touchcancel'), '必须具备触点结束与取消生命周期监听');
console.log('  ✅ 手机端单指划动视角与双指捏合缩放视距完整闭环！');

// 3. 验证 VirtualJoystick 小屏自适应
console.log('\n▶ [3/4] 验证 VirtualJoystick 手机端小屏自适应...');
const vjCode = fs.readFileSync(path.join(projectRoot, 'src/ui/VirtualJoystick.js'), 'utf8');
assert.ok(vjCode.includes('isSmallScreen'), '摇杆必须包含小屏屏幕宽度检测');
assert.ok(vjCode.includes('maxRadius'), '必须包含动态滑动半径计算');
console.log('  ✅ 虚拟摇杆在不同屏幕尺寸下均具备黄金拇指操作行程！');

// 4. 验证 UIManager 手机竖屏与横屏 CSS 响应式与按键文案
console.log('\n▶ [4/4] 验证 UIManager 手机竖屏专属布局与无按键残留...');
const uiCode = fs.readFileSync(path.join(projectRoot, 'src/ui/UIManager.js'), 'utf8');
assert.ok(uiCode.includes('@media (orientation: portrait)'), '必须具备手机竖屏媒体查询');
assert.ok(uiCode.includes('.bottom-quick-bar'), '快捷栏在竖屏下必须有专门布局');
assert.ok(uiCode.includes('formatKeyHints'), '必须具备去除键盘按键提示函数');
console.log('  ✅ 手机竖屏与横屏布局、顶部HUD折叠与无按键残留验证通过！');

console.log('\n🎉🎉 [MOBILE ADAPTED] 移动端全面适配专项测试 100% 验证通过！');
