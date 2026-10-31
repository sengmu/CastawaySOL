import { spawn } from 'child_process';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9348',
    '--disable-gpu-sandbox',
    '--window-size=800,800',
    'http://localhost:5180'
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9348/json');
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

  for (let deg = 0; deg < 360; deg += 90) {
    const rad = deg * Math.PI / 180;
    const dist = 6.0;
    const camX = -3.8 + Math.sin(rad) * dist;
    const camZ = -3.0 + Math.cos(rad) * dist;
    await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const game = window.__game;
        game.camera.position.set(${camX}, 2.2, ${camZ});
        game.camera.lookAt(-3.8, 1.8, -3.0);
      })()`
    });
    await new Promise((r) => setTimeout(r, 600));
    const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`E:/CastawaySOL/tree_angle_${deg}.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved E:/CastawaySOL/tree_angle_${deg}.png`);
  }

  ws.close();
  edge.kill();
}

main().catch(console.error);
