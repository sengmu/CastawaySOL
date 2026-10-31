import { spawn } from 'child_process';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9341',
    '--disable-gpu-sandbox',
    '--window-size=1200,800',
    'http://localhost:5180'
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9341/json');
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

  // 在浏览器里聚焦观察第一棵 apple_tree
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const game = window.__game;
      const oak = game.trees.trees.find(t => t.id === 'apple_tree');
      // 把相机直接对准 oak
      game.camera.position.set(oak.group.position.x, 2.5, oak.group.position.z + 5.0);
      game.camera.lookAt(oak.group.position.x, 2.0, oak.group.position.z);

      // 检查 oak 的叶片几何体是否有 morphTarget 或者 skinning
      const leafMesh = oak.model.getObjectByName('L01_01__mTreeOakLeaf');
      return {
        isSkinned: !!leafMesh.isSkinnedMesh,
        hasSkeleton: !!leafMesh.skeleton,
        parentName: leafMesh.parent.name,
        grandParentName: leafMesh.parent.parent.name
      };
    })()`,
    returnByValue: true
  }).then(r => console.log('Leaf inspect:', r.result.value));

  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('E:/CastawaySOL/oak_debug_close.png', Buffer.from(shot.data, 'base64'));
  console.log('Close-up saved to E:/CastawaySOL/oak_debug_close.png');

  ws.close();
  edge.kill();
}

main().catch(console.error);
