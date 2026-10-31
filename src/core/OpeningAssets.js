import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ISLAND_LAYOUT } from './IslandLayout.js';

const loader = new GLTFLoader();
export async function placeOpeningAsset(parent, pack, name, position, width, rotation = 0, solid = true) {
  const { scene } = await loader.loadAsync(`/models/kenney/${pack}/${name}.glb`);
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

export async function populateOpening(parent) {
  const results = await Promise.allSettled([
    placeOpeningAsset(parent, 'pirate', 'ship-wreck', [-19, -0.15, 39.5], 4.5, 0.2),
    placeOpeningAsset(parent, 'pirate', 'crate', [-15.5, -0.15, 39.5], 0.8, -0.1),
    placeOpeningAsset(parent, 'pirate', 'barrel', [-15.8, -0.15, 40.5], 0.65, 0.15),
    placeOpeningAsset(parent, 'survival', 'tent-canvas', ISLAND_LAYOUT.tent, 2.8, 0.5),
    placeOpeningAsset(parent, 'survival', 'bedroll', [-17, 0, 25.5], 1.5, 0.5, false),
    placeOpeningAsset(parent, 'survival', 'workbench', [-20, 0, 23], 1.7, 0.5),
    placeOpeningAsset(parent, 'survival', 'resource-wood', [-20, 0, 25], 1.0, 0.5),
    // 营地篝火旁初始坚固储物木箱 (支持玩家开局直接存取材料)
    placeOpeningAsset(parent, 'pirate', 'crate', [-14.5, 0, 23.5], 1.05, 0.25),
  ]);
  results.forEach(result => { if (result.status === 'rejected') console.error('Opening asset load failed', result.reason); });
  return results;
}
