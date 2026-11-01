# P1 修复单（主控审计 2026-11-01 21:2x，用户转交执行）

背景：P1 五项主控已逐项核过——①锁主网、⑤先存档后发放已过；②③④有下列缺口。本单只修这些缺口，不扩大范围：不碰相机/FOV/画面与 UI 布局，不做主网真实支付测试，不新增 DAE 引用，不重启 5173，不装手机，不 git 提交。

## FIX-1（④功能缺口，最重要）浮标回收不得产晶石

- 位置：`src/systems/FlotsamSalvageSystem.js` 的 `performAutoSalvage()`（约 L286–303），现状是把 `spec.drops` 原样入储物箱，其中 `flotsam_crate` 的掉落表（约 L50）含 `sol_crystal`。
- 改法：**自动打捞路径**发放掉落时过滤掉 `sol_crystal`（付费浮标不得产晶石）。玩家手动按 E 打捞自然漂流箱的路径**不动**，晶石保留为自然来源。
- 验收（必须新增断言，建议加进 `tools/smoke_check_p1.mjs`）：浮标已解锁时自动回收一个板条箱 → 储物箱 `sol_crystal` 增量为 0、其余掉落正常入账；手动打捞板条箱仍可出晶石。

## FIX-2（③文案）代币名称统一 + 清除 $SOL 混称

- 现状：游戏代币（`sol_token`）玩家可见名称不统一——商店/船只处叫「算力代币」，每日打卡奖励文案（`src/ui/UIManager.js` 约 L3159–3160）叫「贝壳」；`src/systems/ShipUpgradeSystem.js` L39–40、L61–62 的升级说明写「8 $SOL / 18 $SOL 黑市图纸」，而这两处实际扣除的是 `sol_token`（同文件约 L188），属把游戏代币标成 $SOL。
- 改法：玩家可见文案中代币统一称「算力代币」（已用得最多的名字；如用户另行指定以用户为准）；上述两处说明改为消耗算力代币的表述；全仓 UI 文案再搜一遍 `$SOL`，只允许出现在指真实 SOL 价格/余额的语境，注释里的 `$SOL 代币` 一并改掉。真实 SOL 的价格标注（priceSOL）不动，SKR 折算价仍只许标在真实 SOL 商品旁。

## FIX-3（②接线）收款地址做成真配置项（只建接口，不填地址）

- 现状：`src/core/SolanaBridge.js` 有 `setTreasuryAddress()`（约 L89）但全仓无人调用，也没有配置文件，`treasuryAddress` 恒为 null——收款功能整体未开放（付款按钮锁死是靠这个空状态兜底的）。
- 改法：新增 `src/config/payment.js`，导出 `TREASURY_ADDRESS = ''`（**保持空字符串，禁止编造或填入任何默认地址**）；游戏启动时读取并调用 `setTreasuryAddress(TREASURY_ADDRESS)`。空值时行为与现状完全一致：付款按钮禁用、支付函数拒绝执行、不回退任何地址。最终地址由用户后续提供后只改这一处。

## FIX-4（工具坑）黄金路径/P1 冒烟在默认 Node 下可直接跑

- 现状：系统默认 Node 为 v18（无全局 WebSocket），`node tools/verify-golden-path.mjs` 与 `tools/smoke_check_p1.mjs` 直接报 `WebSocket is not defined` 而 BLOCKED；目前只能靠 nvm 的 Node 22 跑。
- 改法：两个脚本在全局 WebSocket 不存在时回退用仓库已有的 `ws` 包（`node_modules` 里已有，不要新装依赖）；或等效方案。验收：用系统默认 `node` 直接跑，黄金路径结论与 Node 22 下一致（passed_except_known_red），P1 冒烟全过。

## 已知残留（本轮不处理，不要动）

- 打包产物 dist 里含 `@solana/web3.js` 库自带的主网 RPC 地址常量表——不是本应用入口，`setNetwork` 已在应用层拒绝主网。**禁止**为此 patch node_modules 或改库代码；此项等用户单独裁定。

## 收尾验收（全做完才算完）

1. 全部回归测试通过（tests/ 下 12 套）+ `npm run build` 成功；
2. 黄金路径除已知红 final_escape 外全绿，运行时错误 0；
3. `tools/smoke_check_p1.mjs` 全过，且已含 FIX-1 的新断言；
4. 中文总结逐项对照本单四条 FIX，改动文件清单如实列出；断言只许加严不许放宽，改了断言必须明说。
