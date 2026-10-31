import { spawn } from 'child_process';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9352',
    '--disable-gpu-sandbox',
    '--window-size=1000,1000',
    'http://localhost:5180'
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9352/json');
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

  // 把相机调到用户的截图位置：
  // 观察用户截图：
  // 树在正中偏右，树后方水平横穿小溪，小溪左边有石块，右边有悬崖斜坡
  // 这说明：相机在西南方（X ~ 4, Z ~ -3），朝向东北（X ~ 8.5, Z ~ -6.5）
  const info = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const game = window.__game;
      const targetTree = game.trees.trees.find(t => Math.abs(t.group.position.x - 8.5) < 0.1);

      // 放置相机
      game.camera.position.set(5.2, 2.2, -3.2);
      game.camera.lookAt(8.5, 1.8, -6.5);

      // 打印这棵树的所有 mesh 信息
      const meshData = [];
      targetTree.model.traverse(c => {
        if (c.isMesh) {
          meshData.push({
            name: c.name,
            visible: c.visible,
            frustumCulled: c.frustumCulled,
            parent: c.parent ? c.parent.name : null,
            vertCount: c.geometry ? c.geometry.attributes.position.count : 0,
            hasNormal: !!(c.geometry && c.geometry.attributes.normal),
            hasUV: !!(c.geometry && c.geometry.attributes.uv),
            matSide: c.material ? c.material.side : null,
            matTransparent: c.material ? c.material.transparent : null,
            matAlphaTest: c.material ? c.material.alphaTest : null,
            matDepthWrite: c.material ? c.material.depthWrite : null
          });
        }
      });
      return JSON.stringify(meshData, null, 2);
    })()`,
    returnByValue: true
  });

  console.log('Target Tree Meshes:\n', info.result.value);

  await new Promise((r) => setTimeout(r, 600));
  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('E:/CastawaySOL/exact_user_view.png', Buffer.from(shot.data, 'base64'));
  console.log('Screenshot saved to E:/CastawaySOL/exact_user_view.png');

  ws.close();
  edge.kill();
}

main().catch(console.error);
