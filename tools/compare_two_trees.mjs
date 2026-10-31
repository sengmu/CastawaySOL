import { spawn } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9347',
    '--disable-gpu-sandbox',
    'http://localhost:5180'
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9347/json');
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

  const compare = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const game = window.__game;
      const tree0 = game.trees.trees[0]; // 正常完整的苹果树 (-3.8, 0, -3.0)
      const tree2 = game.trees.trees.find(t => t.group.position.x === 8.5); // 破碎的树 (8.5, 0, -6.5)

      const getTreeStats = (tree) => {
        const meshes = [];
        tree.model.traverse(c => {
          if (c.isMesh) {
            meshes.push({
              name: c.name,
              visible: c.visible,
              renderOrder: c.renderOrder,
              count: c.geometry.attributes.position.count,
              box: {
                min: c.geometry.boundingBox ? c.geometry.boundingBox.min : null,
                max: c.geometry.boundingBox ? c.geometry.boundingBox.max : null
              },
              scale: { x: c.scale.x, y: c.scale.y, z: c.scale.z },
              rot: { x: c.rotation.x, y: c.rotation.y, z: c.rotation.z },
              isSkinned: !!c.isSkinnedMesh,
              skeletonBones: c.skeleton ? c.skeleton.bones.length : 0
            });
          }
        });
        return {
          wrapperPos: tree.group.position,
          wrapperRot: tree.group.rotation,
          fruitCount: tree.fruits.length,
          fruitPositions: tree.fruits.map(f => f.position),
          meshes
        };
      };

      return JSON.stringify({
        tree0: getTreeStats(tree0),
        tree2: getTreeStats(tree2)
      }, null, 2);
    })()`,
    returnByValue: true
  });

  console.log('Comparison:\n', compare.result.value);

  ws.close();
  edge.kill();
}

main().catch(console.error);
