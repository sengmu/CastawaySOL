# M3 v2 实施与未完成验收（2026-11-02）

依据用户「挖矿经营游戏不用结局」裁定，保留第 0–5 章步骤与顺序、第 4 章雷蒙德现状。

## 实施

- StorySystem 第六章改为 mainline_complete，由内部状态守卫完成；末步设置 isCompleted，任务栏显示「主线完成 · 自由经营」。完成后 update 幂等，不冻结营地与矿机。
- isCompleted 通过 StorySystem.serialize 存入现有 story 子块。读档时第六章直接迁移成完成态，清除旧 endedEndingId，彻底移除 endedEndingId 的更新阻断。
- 删除 StorySystem.triggerEnding（此前可经公开 story 对象调用）。UIManager 的结算页和 triggerSolanaEscapeEnding 原样保留。生产代码没有 triggerEnding / triggerSolanaEscapeEnding 调用；原 full_pipeline 工具里的 ED1/ED2/ED6/ED8 四个测试调用已替换成自由经营断言。木筏、船坞、海图、SOS 交互均未改。
- 黄金路径取消 knownRed，加入完成态、实际 DOM 文案、最终完整存档往返和旧第六章档迁移断言，严格要求 passed。收紧错误收集到 console.error 和 Log 错误。

## 实测

- tests/verify-*.mjs：18/20 通过（详细原始输出：docs/qa/m3-runtime/regressions.json）。M2 30,000 项检查通过。
- R8 失败：Chromium 启动 setsockopt: Operation not permitted，未能进入游戏。
- R9 失败：30 天余额 20.830000000000133，原断言范围 [227.2, 340.8]。本轮未改共振和经济数值，也未放宽断言。
- 新 M3 测试通过：主线完成、旧第六章（含旧 endedEndingId）迁移、100 次 update 幂等、生产结局调用为零；从当前 main.js 提取实际艾莉交互块，真实 StorySystem 完成唤醒→赠礼→care_partner 推进，好感实测 105；真实营地日结产出与矿机 update 算力推进正常。
- SaveSystem 专项通过：真实 StorySystem 完成后的全快照导出/导入深相等，旧第六章档经 SaveSystem 导入即完成。
- tools/verify_story_full_pipeline.mjs：28/28 断言通过。
- npm run build：成功，1829 modules，16.70 秒；有原有大 chunk 提示。
- npm run verify:golden：blocked at browser startup，同上沙箱错误，无各章本轮浏览器往返结果。
- tools/verify-m3-runtime-smoke.mjs：blocked，同上；未生成本轮截图，无法声称运行时零错误。保留旧截图，不充当新证据。
- 本环境访问 127.0.0.1:5173 连接失败；没有启动或重启服务器。

## 尚未解决

M2 报告的 undefined.story 在当前真实艾莉交互块及真实 StorySystem 回归中未复现。浏览器在启动前受阻，无法取得 care_partner 的异常堆栈，不能确认根因或宣称已修复。本轮未给生产代码添加掩盖错误的判空。需在能访问原 5173 且允许运行 Chromium 的环境重跑黄金路径，定位实际异常栈后继续修复。

因此本单尚未达到「全收尾验收通过」。

## 断言变更

1. 新增 M3 行为、迁移、幂等、结局无入口、真实伙伴交互、营地产出与矿机推进检查。
2. S1 增加真实 story 完成状态全快照深相等与旧档迁移检查，原断言保留。
3. M1 第六章精确预期由 final_escape/逃脱标题改为 mainline_complete/自由经营标题，第 0–5 章预期不改。
4. full_pipeline 的四种逃脱结算断言依据裁定撤销，替换成完成态、自由经营文案、无结局页断言。
5. 黄金路径取消 knownRed 属用户明确裁定，新增最终检查点、旧档迁移和 DOM 可见文案断言；错误采集收紧。没有新增兼容「或」分支放宽断言。

本轮代码文件：src/systems/StorySystem.js；tools/verify-golden-path.mjs；tools/verify_story_full_pipeline.mjs；新增 tools/verify-m3-runtime-smoke.mjs；tests/verify-m1-story-skeleton.mjs；tests/verify-save-schema-v2.mjs；新增 tests/verify-m3-freeplay.mjs。另更新本报告、docs/GOLDEN-PATH.md 及 QA 日志。SaveSystem.js、UIManager.js、main.js 的本轮前改动保持原样；未动 miningRig 存档块、钱包/共振页签、渲染、布局、数值。没有 git 提交、手机安装或新增 DAE。
