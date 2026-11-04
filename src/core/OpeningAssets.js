import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ISLAND_LAYOUT } from './IslandLayout.js';

const loader = new GLTFLoader();

// 通用 GLB 摆放：按目标宽度等比缩放、XZ 居中、底部落位到 y=0，保留模型自带材质与贴图。

// 自研模型色彩校正（placeModelAsset 专用）：AI 生成 PBR 资产自带烘焙 AO/贴图，
// 在本场景 Neutral 色调映射 + 漫反射光照下会比原画明显偏暗，此处按实测档位提亮对齐原画。
const CUSTOM_GRADE = { toneMapped: false, emissive: 0.85, boost: [1.25, 1.12, 0.9], occ: 0.35 }; // GRADE-LINE
function applyCustomGrade(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach(mat => {
    if (!mat || !mat.isMeshStandardMaterial) return;
    if (CUSTOM_GRADE.toneMapped === false) mat.toneMapped = false;
    if (CUSTOM_GRADE.emissive > 0 && mat.map) {
      mat.emissiveMap = mat.map;
      mat.emissive = new THREE.Color(CUSTOM_GRADE.emissive, CUSTOM_GRADE.emissive, CUSTOM_GRADE.emissive);
    }
    if (CUSTOM_GRADE.boost) mat.color.setRGB(CUSTOM_GRADE.boost[0], CUSTOM_GRADE.boost[1], CUSTOM_GRADE.boost[2]);
    if (typeof CUSTOM_GRADE.occ === 'number' && 'occlusionStrength' in mat) mat.occlusionStrength = CUSTOM_GRADE.occ;
    mat.needsUpdate = true;
  });
}

async function placeGltfAsset(parent, url, name, position, width, rotation = 0, solid = true, grade = false) {
  const { scene } = await loader.loadAsync(url);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = width / Math.max(size.x, size.z, 0.001);
  scene.scale.setScalar(scale);
  scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  scene.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (grade) applyCustomGrade(child);
      // Preserve supplied PBR materials and palette textures.
    }
  });
  const group = new THREE.Group();
  group.name = `opening-${name}`;
  group.add(scene);
  group.position.fromArray(position);
  group.rotation.y = rotation;
  group.userData.movementBox = solid;
  parent.add(group);
  return group;
}

export async function placeOpeningAsset(parent, pack, name, position, width, rotation = 0, solid = true) {
  return placeGltfAsset(parent, `/models/kenney/${pack}/${name}.glb`, name, position, width, rotation, solid);
}

// 自研模型（非 Kenney 包）：直接给完整 URL。
export async function placeModelAsset(parent, url, name, position, width, rotation = 0, solid = true) {
  return placeGltfAsset(parent, url, name, position, width, rotation, solid, true);
}

export async function populateOpening(parent) {
  const results = await Promise.allSettled([
    placeOpeningAsset(parent, 'pirate', 'ship-wreck', [-19, -0.15, 39.5], 4.5, 0.2),
    placeOpeningAsset(parent, 'pirate', 'crate', [-15.5, -0.15, 39.5], 0.8, -0.1),
    placeOpeningAsset(parent, 'pirate', 'barrel', [-15.8, -0.15, 40.5], 0.65, 0.15),
    // PILOT（2026-11-04）：营地小屋试点——用自研 AI 生成网格替换 Kenney 帐篷（Pixal3D 单图出网格 → 减面 12,411 面 + 1024 贴图版）。
    // 锚点与睡眠判定不变（ISLAND_LAYOUT.tent），宽度按模型规范小屋墙宽 4.0；回退：删本行、恢复下一行注释即可。
    placeModelAsset(parent, '/models/custom/cabin.glb', 'cabin', ISLAND_LAYOUT.tent, 4.0, 0.5),
    // placeOpeningAsset(parent, 'survival', 'tent-canvas', ISLAND_LAYOUT.tent, 2.8, 0.5),
    placeOpeningAsset(parent, 'survival', 'bedroll', [-17, 0, 25.5], 1.5, 0.5, false),
    placeOpeningAsset(parent, 'survival', 'workbench', [-20, 0, 23], 1.7, 0.5),
    placeOpeningAsset(parent, 'survival', 'resource-wood', [-20, 0, 25], 1.0, 0.5),
    // 营地篝火旁初始坚固储物木箱 (支持玩家开局直接存取材料)
    placeOpeningAsset(parent, 'pirate', 'crate', [-14.5, 0, 23.5], 1.05, 0.25),
  ]);
  results.forEach(result => { if (result.status === 'rejected') console.error('Opening asset load failed', result.reason); });
  return results;
}
