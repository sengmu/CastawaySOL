// 工坊双炉程序化低多边形黏土 3D 实体构建与高温冶炼配方定义
import * as THREE from 'three';

export const FURNACE_RECIPES = [
  {
    id: 'smelt_iron_ingot',
    name: '精炼铁锭冶炼',
    icon: '🧱',
    inputs: [{ key: 'iron_ore', count: 1, label: '铁矿石' }, { key: 'tree_branch', count: 1, label: '树枝' }],
    output: { key: 'iron_ingot', count: 1, label: '精炼铁锭' },
    batchOptions: [1, 5],
    desc: '鼓风高温还原富铁原矿，锻打成高硬度精炼铁锭（支持 ×1 / ×5 批量冶炼）。'
  },
  {
    id: 'smelt_bronze_plate',
    name: '沉船金属板熔铸',
    icon: '🛡️',
    requiresMonolith: true,
    inputs: [{ key: 'copper_ore', count: 2, label: '黄铜矿' }, { key: 'tree_sap', count: 1, label: '松脂' }],
    output: { key: 'metal_scrap', count: 1, label: '沉船金属板' },
    batchOptions: [1, 5],
    desc: '依循海蚀矿石岛古碑记载的青铜配比，熔铸抗蚀高强金属板（矿石岛拓片解锁）。'
  },
  {
    id: 'smelt_bio_battery',
    name: '生物质热电转化',
    icon: '🔋',
    inputs: [{ key: 'driftwood_or_plank', count: 2, label: '海滩浮木' }, { key: 'stone_chunk', count: 1, label: '碎石' }],
    output: { key: 'battery', count: 1, label: '应急电池' },
    batchOptions: [1, 5],
    desc: '利用热电温差片消纳过剩海滩浮木与火山碎石蓄热，封装充能应急电池。'
  }
];

// 构建耐火锻造熔炉 (furnace) 程序化低多边形网格
export function createProceduralFurnaceMesh(scale = 1.0) {
  const root = new THREE.Group();
  root.name = 'procedural-furnace';

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5c646d, roughness: 0.88, metalness: 0.08 });
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xa55233, roughness: 0.78, metalness: 0.06 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.5, metalness: 0.65 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6b2b,
    emissive: 0xff4500,
    emissiveIntensity: 1.35,
    roughness: 0.35
  });

  // 八角玄武岩隔热底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.28, 8), stoneMat);
  base.position.y = 0.14;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // 圆拱耐火红陶炉身
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.62, 0.78, 9), clayMat);
  dome.position.y = 0.65;
  dome.castShadow = true;
  dome.receiveShadow = true;
  root.add(dome);

  // 顶部锻铁箍圈与短烟囱
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.045, 6, 12), ironMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.92;
  root.add(collar);

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.46, 8), ironMat);
  chimney.position.set(0, 1.24, -0.06);
  chimney.castShadow = true;
  root.add(chimney);

  // 正面拱形炉门与炽热炭火核
  const archFrame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.22), ironMat);
  archFrame.position.set(0, 0.46, 0.48);
  root.add(archFrame);

  const emberCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), emberMat);
  emberCore.position.set(0, 0.43, 0.52);
  root.add(emberCore);

  // 侧面鼓风皮囊木柄
  const bellows = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.42, 7), clayMat);
  bellows.rotation.z = Math.PI / 2.4;
  bellows.position.set(0.62, 0.44, 0);
  root.add(bellows);

  root.userData.emberCore = emberCore;
  root.scale.setScalar(scale || 1.0);
  return root;
}

// 构建古法纯晶精炼炉 (crystal_refinery) 程序化低多边形网格：L1 石砌坩埚炉 / L2 双腔石英导流塔
export function createProceduralRefineryMesh(level = 1, scale = 1.0) {
  const lvl = Math.max(1, Number(level) || 1);
  const root = new THREE.Group();
  root.name = `procedural-crystal-refinery-L${lvl}`;

  const slateMat = new THREE.MeshStandardMaterial({ color: 0x4b535d, roughness: 0.85, metalness: 0.12 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc87d4b, roughness: 0.42, metalness: 0.62 });
  const quartzMat = new THREE.MeshStandardMaterial({
    color: 0x74f2ce,
    emissive: 0x00cec9,
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.18,
    transparent: true,
    opacity: 0.88
  });
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0x00f5d4,
    emissive: 0x00bbf9,
    emissiveIntensity: 1.5,
    roughness: 0.25
  });

  // L1 石砌坩埚基座与炉体
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.86, 0.3, 8), slateMat);
  plinth.position.y = 0.15;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  root.add(plinth);

  const crucible = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.66, 8), slateMat);
  crucible.position.y = 0.62;
  crucible.castShadow = true;
  root.add(crucible);

  const copperBand = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.045, 6, 12), copperMat);
  copperBand.rotation.x = Math.PI / 2;
  copperBand.position.y = 0.78;
  root.add(copperBand);

  // 中央石英提纯内胆
  const coreSpire = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), quartzMat);
  coreSpire.position.set(0, 1.12, 0);
  root.add(coreSpire);

  // 动态炉火组（随储物箱待炼库存动态亮灭）
  const fireGroup = new THREE.Group();
  const flameMain = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 6), fireMat);
  flameMain.position.set(0, 0.52, 0.56);
  fireGroup.add(flameMain);
  root.add(fireGroup);

  // L2 进阶形态：双腔石英导流塔 + 顶部集能铜环
  if (lvl >= 2) {
    for (const side of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 1.18, 6), quartzMat);
      tower.position.set(side * 0.52, 0.92, -0.08);
      tower.castShadow = true;
      root.add(tower);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.26, 6), copperMat);
      cap.position.set(side * 0.52, 1.62, -0.08);
      root.add(cap);
    }

    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.038, 6, 16), copperMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.set(0, 1.54, 0);
    root.add(crownRing);

    coreSpire.scale.set(1.25, 1.45, 1.25);
    coreSpire.position.y = 1.32;
  }

  root.userData.refineryLevel = lvl;
  root.userData.fireGroup = fireGroup;
  root.userData.coreSpire = coreSpire;
  root.userData.quartzMat = quartzMat;
  root.scale.setScalar(scale || 1.0);
  return root;
}
