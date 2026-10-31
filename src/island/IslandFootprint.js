import * as THREE from 'three';

// 共享的自然有机岛屿轮廓算法 (用于主岛草坪、沙滩、外侧浅滩与海岸浪花线，采用 X/Z 平面坐标)
export function islandOutline(width, depth, inset = 0) {
  const points = [];
  for (let i = 0; i < 128; i++) {
    const angle = (i / 128) * Math.PI * 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    // 自然低多边形随机起伏变化
    const variation = 0.965 + 0.018 * Math.sin(angle * 3 + 0.4) + 0.014 * Math.sin(angle * 7);
    let x = (width - inset) * Math.sign(c) * Math.sqrt(Math.abs(c)) * variation;
    let z = (depth - inset) * Math.sign(s) * Math.sqrt(Math.abs(s)) * variation;

    // 1. 南岸海难出生点浅水海湾柔和微凹 (避免笔直生硬的海岸线)
    if (z > 25) {
      z -= Math.exp(-Math.pow((x + 10) / 12, 2)) * 0.8;
    }

    // 2. 西北部月牙海蚀浅湾 (西北象限 X<0, Z<0，对齐海岛规划图的自然内凹海蚀湾)
    const nwCenter = Math.PI * 1.24;
    const nwDiff = Math.abs(angle - nwCenter);
    const nwSpan = 0.42; // 月牙湾弧度跨度
    if (nwDiff < nwSpan) {
      // 余弦平滑过渡曲线，向岛屿中心内凹
      const factor = Math.cos((nwDiff / nwSpan) * Math.PI * 0.5);
      const indent = factor * factor * (11.5 - inset * 0.18);
      x += indent * 0.72;
      z += indent * 0.68;
    }

    points.push(new THREE.Vector2(x, z));
  }
  return points;
}

export function islandShape(width, depth) {
  return new THREE.Shape(islandOutline(width, depth));
}
