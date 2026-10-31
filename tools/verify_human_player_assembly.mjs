// 验证人类主角装配与多部件骨骼动画
import * as THREE from 'three';

console.log('Testing Human Player multi-part assembly logic...');

// 模拟骨骼映射与驱动
const bones = {
  legL: [],
  legR: [],
  kneeL: [],
  kneeR: [],
  armL: [],
  armR: [],
  head: [],
  spine: []
};

const initialRotations = new Map();

function registerBone(key, bone) {
  if (!bones[key]) bones[key] = [];
  bones[key].push(bone);
  initialRotations.set(bone, bone.rotation.clone());
}

// 模拟创建身体骨骼与短裤骨骼
const bodyLegL = new THREE.Bone();
bodyLegL.name = 'Leg_1_L';
const pantsLegL = new THREE.Bone();
pantsLegL.name = 'Leg_1_L';

registerBone('legL', bodyLegL);
registerBone('legL', pantsLegL);

console.log('legL registered count:', bones.legL.length);

// 步态驱动测试
const walkCycle = 1.5;
const legSwing = Math.sin(walkCycle) * 0.48;

bones.legL.forEach(b => {
  const init = initialRotations.get(b);
  b.rotation.x = init.x + legSwing;
});

console.log('bodyLegL rotX:', bodyLegL.rotation.x);
console.log('pantsLegL rotX:', pantsLegL.rotation.x);

if (Math.abs(bodyLegL.rotation.x - pantsLegL.rotation.x) < 1e-6) {
  console.log('✅ Dual-bone synchronization verified successfully!');
} else {
  console.error('❌ Dual-bone synchronization failed');
  process.exit(1);
}
