# 主线黄金路径（M3：完成主线后自由经营）

对已经运行的 5173 服务器执行 `npm run verify:golden`。需要 Node.js 22 和 Chromium，可用 `CHROME_BIN` 与 `GOLDEN_URL` 指定浏览器和已有服务；脚本不启动或重启服务器。

脚本使用独立临时配置，从新档通过采集、烹饪、合成、伙伴交互与宝石拾取完成第 0–5 章。允许传送，不直接写背包或主线里程碑。造筏前等待树木资源就绪。暂停自动帧调度以隔离时间漂移，通过原系统推进动作。

第六章 `mainline_complete` 由内部守卫开启自由经营；严格断言主线完成、`isCompleted === true`、任务文案与实际 DOM 出现自由经营。第 0–6 检查点均执行导出→刷新→导入→导出，除顶层 timestamp 外完整深相等；进入第六章后先执行完成守卫，再保存第 5 章检查点，确保该快照为稳定漫游态。最终还导入没有 isCompleted 的旧第六章档，断言迁移成功。

已删除 final_escape 的 knownRed 与提前退出。只有完成以上检查且运行时错误为零才写 `status: passed`。异常、console.error 和浏览器日志错误均计入失败。

产物在 `docs/qa/golden-path/`。本轮实测被沙箱阻断于 Chromium 启动（setsockopt: Operation not permitted），没有取得浏览器通过证据；旧截图与旧章节快照不代表本轮验收。详见 `docs/M3-IMPLEMENTATION-RESULT.md`。
