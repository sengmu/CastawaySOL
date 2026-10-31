import { spawn } from 'child_process';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9357',
    '--disable-gpu-sandbox',
    '--window-size=1200,900',
    'http://localhost:5180/test_oak.html'
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9357/json');
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

  for (let i = 0; i < 20; i++) {
    const check = await sendCmd('Runtime.evaluate', { expression: '!!window.__ready' });
    if (check.result?.value) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  // 深入获取模型中所有 Mesh 的顶点坐标范围（X, Y, Z）和材质
  const data = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      try {
        const m = window.__model;
        if (!m) return 'No window.__model found';
        const res = [];
        m.traverse(c => {
          if (c.isMesh) {
            c.geometry.computeBoundingBox();
            const bb = c.geometry.boundingBox;
            res.push({
              name: c.name,
              visible: c.visible,
              isSkinned: !!c.isSkinnedMesh,
              parentName: c.parent ? c.parent.name : null,
              vertCount: c.geometry.attributes.position.count,
              min: [bb.min.x.toFixed(2), bb.min.y.toFixed(2), bb.min.z.toFixed(2)],
              max: [bb.max.x.toFixed(2), bb.max.y.toFixed(2), bb.max.z.toFixed(2)],
              center: [
                ((bb.min.x + bb.max.x)/2).toFixed(2),
                ((bb.min.y + bb.max.y)/2).toFixed(2),
                ((bb.min.z + bb.max.z)/2).toFixed(2)
              ]
            });
          }
        });
        return JSON.stringify(res, null, 2);
      } catch (err) {
        return err.stack || err.message;
      }
    })()`,
    returnByValue: true
  });

  console.log('Oak Model Mesh Analysis:\n', data.result?.value);

  ws.close();
  edge.kill();
}

main().catch(console.error);
