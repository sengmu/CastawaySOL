# UI 施工轮1 验收报告：设计令牌 + 双向 HUD（2026-11-02）

## 范围与裁决
- 依据 `docs/ui-art-spec.md` 与六面定版效果图 `docs/qa/ui-mockups/mock-*.png`。
- 用户裁决（覆盖效果图）：右下操作簇内背包↔互动换位——互动键坐右下角主位（黄色大主按钮），背包移入操作簇坐上方小钮位（普通奶油圆钮）；背包自右上导航组移出，id 与点击行为不变。
- 删除 `index.html` 的 `#orientation-hint`「请旋转手机至横屏」DOM 与死 CSS。

## 执行过程（如实记录）
- 网关工人轮先行：落下设计令牌、换位 DOM 结构、矿机/商店紫绿渐变清除、orientation-hint 删除；中途被网关 503 限流打断（All accounts rate-limited），且留下一处多余的模板闭合符导致构建失败。
- 主控接手：修复闭合符；补完两份 Cozy CSS 与 UIManager 基础层的奶油化；补横屏/基础层 `.is-urgent` 紧急态；新手引导卡翻奶油；`--cozy-hud-surface` 改用 `rgb(255, 246, 227)` 记法（与 a1 测试的字符串比对口径一致，同色值、非放宽断言）。

## 改动文件
- `src/ui/UIManager.js`：令牌 :root、基础层去渐变（面板/导航/主按钮/Toast 可可条）、矿机与商店去紫绿渐变、背包 DOM 移入操作簇、攻击键去渐变、缺水紧急态改走 CSS 类、新手引导卡奶油化、修复多余模板闭合符。
- `src/ui/CozyPortraitHud.css` / `src/ui/CozyLandscapeHud.css`：全局变量翻奶油系（面 #FFF6E3 / 卡 #FBEBC8 / 字 #6B4A32 / 边透明）、状态色对齐规范（生命 #F26B5B / 饱食 #FF9F43 / 水分 #6EC1E4 / 疲劳 #FFD25A / 轨道 #EADFCB）、主按钮黄 #FFD25A+厚度带、摇杆与快捷栏奶油化、选中态 #E3F4FB、总账抽屉浅色化、背包簇内定位（竖屏左列上位 / 横屏顶行左位）。
- `index.html`：删除 orientation-hint。
- `docs/qa/a1/*.png`：a1 测试按新皮重截的抽屉证据图。

## 验收（主控独立复跑）
- `npm run build` ✓
- `tests/verify-*.mjs` **24/24 全过**（a1 首跑曾因 NUC 网络抖动导致 Google Fonts 加载失败误报，重跑通过；控制台零错误断言在终轮冒烟中亦为 0）
- 运行时冒烟（DSF1）DOM 量测：
  - 竖屏 390×844：主按钮 bg rgb(255,210,90)、92×92、右下角（右边距 14px）；背包 bg rgb(251,235,200)、父容器 mobile-action-zone；状态条 ::before bg rgb(255,246,227)；任务条奶油；摇杆象牙。
  - 横屏 844×390：主按钮 bg rgb(255,210,90)、113×113 右下角；背包同上；仪表盘 bg rgb(255,246,227)；矿机钮象牙无渐变。
  - 动态文案在场（近水情境主按钮显示「甩竿海钓」），控制台错误 0。
- 截图：`docs/qa/ui-redesign/hud-portrait.png`、`hud-landscape.png`（主控已目检：整屏奶油语言统一，新手引导卡已翻浅）。

## 遗留（下一轮）
- 矿机弹窗与背包弹窗（.modal-card 等）仍为旧深色——轮2 处理（竖屏底部抽屉 / 横屏居中双栏浮卡）。
- 对话框 `.animal-dialog` 保持原浅色绿边设计，未在本轮范围。
