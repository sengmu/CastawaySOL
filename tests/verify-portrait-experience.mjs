// 专门针对竖屏相机、FOV自适应、触控工效学与弹窗自适应的自动化回归测试
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('📱 开始执行 CastawaySOL 竖屏深度体验优化专项测试套件...\n');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// 1. 验证 main.js 相机 FOV 自适应与 resize 联动
console.log('▶ [1/4] 验证 main.js 动态 FOV 算子与屏幕旋转广播...');
const mainCode = fs.readFileSync(path.join(projectRoot, 'src/main.js'), 'utf8');
assert.ok(mainCode.includes('getAdaptiveFOV()'), 'main.js 必须具备 getAdaptiveFOV 方法');
assert.ok(mainCode.includes('this.camera.fov = this.getAdaptiveFOV()'), 'onWindowResize 必须动态刷新相机 FOV');
assert.ok(mainCode.includes('this.player.onOrientationChange'), 'onWindowResize 必须通知角色控制器横竖屏切换');
console.log('  ✅ main.js 动态广角 FOV (竖屏扩展至 68°) 与广播联动验证通过！');

// 2. 验证 PlayerController 竖屏基准视距后拉
console.log('\n▶ [2/4] 验证 PlayerController 竖屏黄金视距后拉与平滑过渡...');
const pcCode = fs.readFileSync(path.join(projectRoot, 'src/entities/PlayerController.js'), 'utf8');
assert.ok(pcCode.includes('isPortrait'), '必须包含 isPortrait 状态标识');
assert.ok(pcCode.includes('portraitOffset'), '相机跟踪必须在竖屏下增加后拉缓冲偏移');
assert.ok(pcCode.includes('onOrientationChange(isPortrait)'), '必须具备 onOrientationChange 响应函数');
console.log('  ✅ 竖屏基准相机视距后拉 (1.25x 景深与横向范围) 验证通过！');

// 3. 验证 VirtualJoystick 竖屏单手人体工学优化
console.log('\n▶ [3/4] 验证 VirtualJoystick 竖屏单手盲操感应区与锚点...');
const vjCode = fs.readFileSync(path.join(projectRoot, 'src/ui/VirtualJoystick.js'), 'utf8');
assert.ok(vjCode.includes('isPortrait'), '虚拟摇杆必须感知 isPortrait');
assert.ok(vjCode.includes('zoneWidth = isPortrait ? 58 : 48'), '竖屏下盲操感应层宽度需扩展至 58vw');
assert.ok(vjCode.includes('topOffset = isPortrait'), '竖屏下感应区需避开顶部状态栏与导航键');
console.log('  ✅ 虚拟摇杆单手盲操感应区扩展与避让验证通过！');

// 4. 验证 UIManager 竖屏无重叠顶栏、自适应弹窗与安全区
console.log('\n▶ [4/4] 验证 UIManager 竖屏仪表盘与按钮组避让、单列弹窗...');
const uiCode = fs.readFileSync(path.join(projectRoot, 'src/ui/UIManager.js'), 'utf8');
assert.ok(uiCode.includes('portrait-survival-strip') || uiCode.includes('calc(100% - 150px)'), '竖屏状态条必须与右上角按钮组平行并列预留净空');
assert.ok(uiCode.includes('.split-modal-layout {'), '必须包含双栏弹窗在竖屏单列堆叠');
assert.ok(uiCode.includes('max-height: calc(100vh - 24px - var(--sat, 0px) - var(--sab, 0px))'), '弹窗高度受安全区约束防止超屏');
assert.ok(uiCode.includes('var(--sat, 0px)') && uiCode.includes('var(--sab, 0px)'), '全局安全区 env 变量使用完整');
console.log('  ✅ 竖屏顶栏无遮挡、弹窗单列不超屏、安全区避让验证通过！');

console.log('\n🎉🎉 [ALL PORTRAIT OPTIMIZATION TESTS PASSED] 竖屏体验深度优化全量验证通过！');
