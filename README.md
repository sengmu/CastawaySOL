# CastawaySOL

手机横屏优先的Three.js海岛游戏。标准机型 Solana Seeker，横屏约 914×411，DPR 2.625。先阅读 HANDOFF.md、docs/GAMEPLAY.md、docs/ROADMAP.md，以及上级 AGENTS.md。

当前是本地单人原型；群岛、生产和多人属于待实现规划。

运行：npm run dev（端口5173）；构建：npm run build；预览：npm run preview。依赖缺失时才需npm install。入口index.html → src/main.js。归档和ZIP不是当前开发源码。

## 本地回归验证

在仓库根目录运行全部现有专项检查（任一失败立即停止）：

```bash
for test in tests/verify-*.mjs; do
  node "$test" || exit 1
done
npm run build
```

这些脚本覆盖系统逻辑和部分源码结构约束，不能代替真实浏览器画面、手机触控、真实钱包签名或 Android 真机验收。
