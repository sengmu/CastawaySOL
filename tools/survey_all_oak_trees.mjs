import { spawn } from 'child_process';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9346',
    '--disable-gpu-sandbox',
    '--window-size=1200,900',
    'http://localhost:5180'
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9346/json');
  const list = await res.json();
  const page = list.find((t) => t.type === 'page');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let msgId = 1;
  const sendCmd = (method, params = {}) =>
    new Promise((resolve) => {
      const id = msgId++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await new Promise((r) => setTimeout(r, 4500));

  // 获取所有 apple_tree 的坐标
  const trees = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const game = window.__game;
      return game.trees.trees.filter(t => t.id === 'apple_tree').map((t, idx) => ({
        idx,
        pos: { x: t.group.position.x, y: t.group.position.y, z: t.group.position.z }
      }));
    })()`,
    returnByValue: true
  });

  console.log('Found apple trees:', trees.result.value);

  // 寻找最靠近小溪的树 (x 约为 8.5 或 10.5)
  for (const t of trees.result.value) {
    if (t.pos.x > 5) {
      console.log(`Checking tree near river at x=${t.pos.x}, z=${t.pos.z}`);
      // 移动主角到这棵树的西侧面向东截一张
      await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const game = window.__game;
          game.player.position.set(${t.pos.x - 3.5}, 0, ${t.pos.z});
          game.player.cameraAngleH = -Math.PI / 2; // 面向东
          game.player.cameraAngleV = 0.65;
          game.player.cameraDistance = 7.0;
        })()`
      });
      await new Promise((r) => setTimeout(r, 800));
      const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`E:/CastawaySOL/river_tree_${t.idx}.png`, Buffer.from(shot.data, 'base64'));
      console.log(`Saved E:/CastawaySOL/river_tree_${t.idx}.png`);
    }
  }

  ws.close();
  edge.kill();
}

main().catch(console.error);
