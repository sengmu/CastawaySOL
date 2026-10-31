import * as THREE from 'three';
import { ACNH_ASSETS } from '../core/AssetRegistry.js';
import { modelLoader } from '../core/ModelLoader.js';
import { soundEngine } from '../core/AudioSystem.js';

export class BuildSystem {
  constructor(scene, camera, domElement, game = null) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.game = game;

    this.isBuildMode = false;
    this.selectedItem = null;
    this.previewModel = null;
    this.currentRotation = 0;

    this.placedFurniture = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 网格辅助线
    this.gridHelper = new THREE.GridHelper(70, 70, 0x5a9e32, 0x88cc55);
    this.gridHelper.position.y = 0.05;
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);

    // 鼠标射线检测
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hoverPos = new THREE.Vector3();

    this.initEvents();
    this.loadSavedData();
  }

  initEvents() {
    this.domElement.addEventListener('mousemove', (e) => {
      if (!this.isBuildMode || !this.selectedItem) return;
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersection = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) {
        const snapX = Math.round(intersection.x);
        const snapZ = Math.round(intersection.z);
        this.hoverPos.set(snapX, 0, snapZ);

        if (this.previewModel) {
          this.previewModel.position.copy(this.hoverPos);
          this.previewModel.rotation.y = this.currentRotation;
        }
      }
    });

    this.domElement.addEventListener('click', (e) => {
      if (!this.isBuildMode || !this.selectedItem || e.button !== 0) return;
      this.placeCurrentFurniture();
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isBuildMode) return;
      if (e.code === 'KeyR') {
        this.currentRotation += Math.PI / 2;
        if (this.previewModel) {
          this.previewModel.rotation.y = this.currentRotation;
        }
        soundEngine.playItemDrop();
      }
    });
  }

  toggleBuildMode() {
    this.isBuildMode = !this.isBuildMode;
    this.gridHelper.visible = this.isBuildMode;

    if (!this.isBuildMode && this.previewModel) {
      this.scene.remove(this.previewModel);
      this.previewModel = null;
    }
    soundEngine.playPlaceFurniture();
    return this.isBuildMode;
  }

  // 检查是否具备足够的建造原材料 (背包 + 营地储物箱联动)
  canAfford(itemConf) {
    if (!itemConf || !itemConf.cost) return true;
    if (!this.game || !this.game.ui) return true;

    const inv = this.game.ui.inventory || {};
    const storage = this.game.storageSystem ? this.game.storageSystem.storageInventory : {};

    for (const [mat, needCount] of Object.entries(itemConf.cost)) {
      const haveCount = (inv[mat] || 0) + (storage[mat] || 0);
      if (haveCount < needCount) {
        return false;
      }
    }
    return true;
  }

  // 扣除建造所需原材料 (优先扣除背包物资，不足时联动扣除储物箱储备)
  deductCost(itemConf) {
    if (!itemConf || !itemConf.cost) return true;
    if (!this.game || !this.game.ui) return true;

    const inv = this.game.ui.inventory || {};
    const storage = this.game.storageSystem ? this.game.storageSystem.storageInventory : {};

    for (const [mat, needCount] of Object.entries(itemConf.cost)) {
      let remain = needCount;
      // 1. 优先扣背包
      if (inv[mat]) {
        const take = Math.min(inv[mat], remain);
        inv[mat] -= take;
        remain -= take;
        if (inv[mat] <= 0) delete inv[mat];
      }
      // 2. 差额扣储物箱
      if (remain > 0 && storage[mat]) {
        const take = Math.min(storage[mat], remain);
        storage[mat] -= take;
        remain -= take;
        if (storage[mat] <= 0) delete storage[mat];
      }
    }

    this.game.ui.renderInventory();
    return true;
  }

  async selectFurniture(item) {
    this.selectedItem = item;
    if (this.previewModel) {
      this.scene.remove(this.previewModel);
      this.previewModel = null;
    }

    const model = await modelLoader.loadModel(item.path, {
      scale: item.scale || 1.0,
      castShadow: true,
      receiveShadow: true
    });

    const affordable = this.canAfford(item);
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.65;
        // 若原材料不足，预览模型泛红警示
        if (!affordable) {
          child.material.color.set(0xff4757);
        }
      }
    });

    this.previewModel = model;
    this.previewModel.position.copy(this.hoverPos);
    this.previewModel.rotation.y = this.currentRotation;
    this.scene.add(this.previewModel);
  }

  async placeCurrentFurniture() {
    if (!this.selectedItem || !this.previewModel) return;

    const itemConf = this.selectedItem;

    // 严格检查原材料，材料不足拒绝建造
    if (!this.canAfford(itemConf)) {
      if (this.game && this.game.ui) {
        const costStr = Object.entries(itemConf.cost).map(([k, v]) => `${k} x${v}`).join(', ');
        this.game.ui.showToast(`❌ 材料不足！建造【${itemConf.name}】需要：${costStr}`);
      }
      return;
    }

    const pos = this.hoverPos.clone();
    const rot = this.currentRotation;

    const realModel = await modelLoader.loadModel(itemConf.path, {
      scale: itemConf.scale || 1.0,
      castShadow: true,
      receiveShadow: true
    });

    realModel.position.copy(pos);
    realModel.rotation.y = rot;
    realModel.userData.movementBox = true;
    this.group.add(realModel);

    // 扣除材料
    this.deductCost(itemConf);

    this.placedFurniture.push({
      id: itemConf.id,
      name: itemConf.name,
      isStorage: Boolean(itemConf.isStorage),
      isWaterPurifier: Boolean(itemConf.isWaterPurifier),
      isBed: Boolean(itemConf.isBed),
      path: itemConf.path,
      scale: itemConf.scale || 1.0,
      pos: [pos.x, pos.y, pos.z],
      rot: rot,
      mesh: realModel
    });

    soundEngine.playPlaceFurniture();
    if (this.game && this.game.ui) {
      this.game.ui.showToast(`🔨 成功建造了【${itemConf.name}】！`);
    }
    this.saveData();
  }

  // 检测玩家走近已放置的功能设施 (储物箱、净水器、床位)
  getNearestInteractable(playerPos, maxDist = 2.4) {
    let nearest = null;
    let minDist = maxDist;
    for (const f of this.placedFurniture) {
      if (!f.isStorage && !f.isWaterPurifier && !f.isBed) continue;
      const d = Math.hypot(playerPos.x - f.pos[0], playerPos.z - f.pos[2]);
      if (d < minDist) {
        minDist = d;
        nearest = f;
      }
    }
    return nearest;
  }

  saveData() {
    const data = this.placedFurniture.map(f => ({
      id: f.id,
      path: f.path,
      scale: f.scale,
      pos: f.pos,
      rot: f.rot
    }));
    try {
      localStorage.setItem('castaway_island_furniture_v2', JSON.stringify(data));
    } catch (e) {
      console.warn('保存存档失败', e);
    }
  }

  async loadSavedData() {
    let saved = null;
    try {
      // 读取规范化存档
      const raw = localStorage.getItem('castaway_island_furniture_v2');
      if (raw) saved = JSON.parse(raw);
    } catch (e) {}

    // 默认唯美海岛景观布局：错落有致，远离主角出生点中央
    if (!saved || saved.length === 0) {
      saved = [];
    }

    for (const item of saved) {
      const model = await modelLoader.loadModel(item.path, {
        scale: item.scale,
        castShadow: true,
        receiveShadow: true
      });
      model.position.set(item.pos[0], item.pos[1], item.pos[2]);
      model.rotation.y = item.rot;
      model.userData.movementBox = true;
      this.group.add(model);

      this.placedFurniture.push({
        ...item,
        mesh: model
      });
    }
  }
}
