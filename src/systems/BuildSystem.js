import * as THREE from 'three';
import { GAME_ASSETS } from '../core/AssetRegistry.js';
import { ISLAND_LAYOUT } from '../core/IslandLayout.js';
import { islandOutline } from '../island/IslandFootprint.js';
import { modelLoader } from '../core/ModelLoader.js';
import { soundEngine } from '../core/AudioSystem.js';
import {
  FURNACE_RECIPES,
  createProceduralFurnaceMesh,
  createProceduralRefineryMesh
} from './WorkshopMeshes.js';

export const LEGACY_FURNITURE_STORAGE_KEY = 'castaway_island_furniture_v2';
export const DEFAULT_REFINERY_POS = Object.freeze([-16.5, 0.02, 26.5]);

// 按家具 id 从资产表与程序化设施表回填完整元数据，根治读档后功能标志位失忆
export function hydrateFurnitureMeta(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const catalog = Array.isArray(GAME_ASSETS.furniture) ? GAME_ASSETS.furniture : [];
  const def = catalog.find((it) => it.id === rawItem.id) || {};
  const pos = Array.isArray(rawItem.pos) && rawItem.pos.length >= 3
    ? [Number(rawItem.pos[0]) || 0, Number(rawItem.pos[1]) || 0, Number(rawItem.pos[2]) || 0]
    : [0, 0, 0];

  return {
    id: rawItem.id || def.id || 'unknown_furniture',
    name: def.name || rawItem.name || rawItem.id || '营地家具',
    category: def.category || rawItem.category || '营地设施',
    drawerCategory: def.drawerCategory || rawItem.drawerCategory || 'decor',
    icon: def.icon || rawItem.icon || '🪵',
    path: def.proceduralType ? null : (def.path || rawItem.path || null),
    proceduralType: def.proceduralType || rawItem.proceduralType || null,
    scale: typeof rawItem.scale === 'number' ? rawItem.scale : (def.scale || 1.0),
    pos,
    rot: typeof rawItem.rot === 'number' ? rawItem.rot : 0,
    isStorage: Boolean(def.isStorage ?? rawItem.isStorage),
    isWaterPurifier: Boolean(def.isWaterPurifier ?? rawItem.isWaterPurifier),
    isBed: Boolean(def.isBed ?? rawItem.isBed),
    isFurnace: Boolean(def.isFurnace ?? rawItem.isFurnace),
    isRefinery: Boolean(def.isRefinery ?? rawItem.isRefinery),
    comfortScore: typeof def.comfortScore === 'number' ? def.comfortScore : (Number(rawItem.comfortScore) || 0),
    bonusStorageSlots: typeof def.bonusStorageSlots === 'number' ? def.bonusStorageSlots : 0,
    cost: def.cost ? { ...def.cost } : (rawItem.cost ? { ...rawItem.cost } : {}),
    containerItems: rawItem.containerItems && typeof rawItem.containerItems === 'object' ? { ...rawItem.containerItems } : null
  };
}

function snapHalfMeter(val) {
  return Math.round(Number(val || 0) * 2) / 2;
}

function isPointInPolygonXZ(x, z, polyPoints) {
  let inside = false;
  for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
    const xi = polyPoints[i].x, zi = polyPoints[i].y;
    const xj = polyPoints[j].x, zj = polyPoints[j].y;
    const intersect = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-6) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export class BuildSystem {
  constructor(scene, camera, domElement, game = null) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.game = game;

    this.isBuildMode = false;
    this.selectedItem = null;
    this.editingEntry = null;
    this.relocatingEntry = null;
    this.previewModel = null;
    this.currentRotation = 0;
    this.lastValidation = { valid: true, reason: '' };

    this.placedFurniture = [];
    this.group = new THREE.Group();
    this.group.name = 'camp-placed-furniture';
    this.furnitureGroup = this.group;
    if (this.scene) this.scene.add(this.group);

    // 主岛可建造陆地轮廓缓存（内缩浅滩边缘防止入海）
    this.landPolygon = islandOutline(46.8, 39.8);

    // 0.5m 精度轻量化营建网格
    this.gridHelper = new THREE.GridHelper(70, 140, 0x4cd137, 0x7bed9f);
    this.gridHelper.position.y = 0.04;
    this.gridHelper.visible = false;
    if (this.gridHelper.material) {
      this.gridHelper.material.transparent = true;
      this.gridHelper.material.opacity = 0.32;
    }
    if (this.scene) this.scene.add(this.gridHelper);

    // 脚底四重合法性光圈（新建/移位预览）与选中高亮圈（编辑态）
    const ringGeo = new THREE.RingGeometry(0.62, 0.86, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.validityRingMat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.validityRing = new THREE.Mesh(ringGeo, this.validityRingMat);
    this.validityRing.visible = false;
    if (this.scene) this.scene.add(this.validityRing);

    const selGeo = new THREE.RingGeometry(0.72, 0.94, 28);
    selGeo.rotateX(-Math.PI / 2);
    this.selectionRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    this.selectionRing = new THREE.Mesh(selGeo, this.selectionRingMat);
    this.selectionRing.visible = false;
    if (this.scene) this.scene.add(this.selectionRing);

    this.raycaster = new THREE.Raycaster();
    this.groundRay = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hoverPos = new THREE.Vector3(-15.0, 0, 26.0);
    this._isPointerDragging = false;
    this._animClock = 0;
    this._restoreToken = 0;

    if (this.domElement && typeof this.domElement.addEventListener === 'function') {
      this.initEvents();
    }
  }

  initEvents() {
    const updateRayFromClient = (clientX, clientY) => {
      const rect = this.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      return true;
    };

    const aimAtGround = (clientX, clientY) => {
      if (!updateRayFromClient(clientX, clientY)) return;
      const hitPoint = new THREE.Vector3();
      const surfaces = this._collectWalkSurfaces();
      const hits = surfaces.length > 0 ? this.raycaster.intersectObjects(surfaces, false) : [];
      if (hits.length > 0) {
        hitPoint.copy(hits[0].point);
      } else if (!this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint)) {
        return;
      }
      this.setPreviewPosition(hitPoint.x, hitPoint.z);
    };

    this.domElement.addEventListener('pointerdown', (e) => {
      if (!this.isBuildMode) return;
      if (e.button !== undefined && e.button !== 0) return;

      // 若未处于移位态，优先检测是否点选了已有营地家具进入编辑态
      if (!this.relocatingEntry && updateRayFromClient(e.clientX, e.clientY)) {
        const picked = this._pickPlacedFurniture();
        if (picked && (!this.selectedItem || picked !== this.editingEntry)) {
          this.selectPlacedFurniture(picked);
          return;
        }
      }

      if (this.selectedItem || this.relocatingEntry) {
        this._isPointerDragging = true;
        aimAtGround(e.clientX, e.clientY);
      }
    });

    this.domElement.addEventListener('pointermove', (e) => {
      if (!this.isBuildMode) return;
      if (!this.selectedItem && !this.relocatingEntry) return;
      if (e.pointerType === 'mouse' || this._isPointerDragging) {
        aimAtGround(e.clientX, e.clientY);
      }
    });

    const endDrag = () => { this._isPointerDragging = false; };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    window.addEventListener('keydown', (e) => {
      if (!this.isBuildMode) return;
      if (e.code === 'KeyR') {
        if (this.editingEntry && !this.relocatingEntry && !this.selectedItem) {
          this.rotateSelectedFurniture(1);
        } else {
          this.rotatePreview(1);
        }
      } else if (e.code === 'Escape') {
        this.exitBuildMode();
      }
    });
  }

  _collectWalkSurfaces() {
    const surfaces = [];
    if (!this.scene || typeof this.scene.traverse !== 'function') return surfaces;
    this.scene.traverse((obj) => {
      if (obj.visible && (obj.userData?.walkSurface || obj.userData?.movementSurface)) {
        surfaces.push(obj);
      }
    });
    return surfaces;
  }

  _pickPlacedFurniture() {
    const meshes = this.placedFurniture.map((f) => f.mesh).filter(Boolean);
    if (meshes.length === 0) return null;
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    let node = hits[0].object;
    while (node) {
      const found = this.placedFurniture.find((f) => f.mesh === node);
      if (found) return found;
      node = node.parent;
    }
    return null;
  }

  // 采样地形海拔、坡度与水域判定
  sampleGroundAndSlope(x, z) {
    const inLand = isPointInPolygonXZ(x, z, this.landPolygon);
    // 溪流河道禁建带近似保护
    const inRiver = (x > -8.5 && x < -1.5 && z > -14 && z < 28 && Math.abs(x - (-5.0 + Math.sin(z * 0.12) * 1.6)) < 1.8);
    const surfaces = this._collectWalkSurfaces();
    if (surfaces.length === 0) {
      return { y: 0, slope: 0, inWater: !inLand || inRiver };
    }
    const groundAt = (gx, gz) => {
      this.groundRay.set(new THREE.Vector3(gx, 25, gz), new THREE.Vector3(0, -1, 0));
      const hit = this.groundRay.intersectObjects(surfaces, false)[0];
      return hit ? hit.point.y : -1;
    };
    const centerY = groundAt(x, z);
    const step = 0.6;
    const samples = [groundAt(x + step, z), groundAt(x - step, z), groundAt(x, z + step), groundAt(x, z - step)];
    const maxDiff = Math.max(...samples.map((sy) => Math.abs(sy - centerY)));
    const inWater = !inLand || inRiver || centerY < -0.03;
    return { y: Math.max(0, centerY), slope: maxDiff, inWater };
  }

  // 汇总核心世界锚点 2.5m 禁建保护圈
  getProtectedWorldAnchors() {
    const g = this.game;
    const anchors = [
      { name: '露营主帐篷', x: ISLAND_LAYOUT.tent[0], z: ISLAND_LAYOUT.tent[2], radius: 2.5 },
      { name: '营地中央篝火', x: ISLAND_LAYOUT.campfire[0], z: ISLAND_LAYOUT.campfire[2], radius: 2.5 },
      { name: '营地原生储物箱', x: -14.5, z: 23.5, radius: 2.5 },
      { name: '码头船只与栈桥', x: ISLAND_LAYOUT.raft[0], z: ISLAND_LAYOUT.raft[2], radius: 2.5 },
      { name: '浅滩船坞码头', x: ISLAND_LAYOUT.pier[0], z: ISLAND_LAYOUT.pier[2], radius: 2.5 },
      { name: '沙滩求救信标', x: ISLAND_LAYOUT.sos[0], z: ISLAND_LAYOUT.sos[2], radius: 2.5 }
    ];
    if (g?.miningRig?.anchor) anchors.push({ name: '绿色解密矿机', x: g.miningRig.anchor.x, z: g.miningRig.anchor.z, radius: 2.5 });
    if (g?.campEntities?.anchors) {
      const a = g.campEntities.anchors;
      if (a.noticeboard) anchors.push({ name: '营地经营告示板', x: a.noticeboard.x, z: a.noticeboard.z, radius: 2.5 });
      if (a.orderBoard) anchors.push({ name: '日常订单板', x: a.orderBoard.x, z: a.orderBoard.z, radius: 2.5 });
      if (a.radioTerminal) anchors.push({ name: '无线电终端', x: a.radioTerminal.x, z: a.radioTerminal.z, radius: 2.5 });
      if (a.waterPurifier) anchors.push({ name: '原生净水台', x: a.waterPurifier.x, z: a.waterPurifier.z, radius: 2.5 });
    }
    if (g?.tidalTrap?.smokerAnchor) anchors.push({ name: '营地熏烤架', x: g.tidalTrap.smokerAnchor.x, z: g.tidalTrap.smokerAnchor.z, radius: 2.5 });
    if (g?.petCompanion?.nestAnchor) anchors.push({ name: '随行异兽暖巢', x: g.petCompanion.nestAnchor.x, z: g.petCompanion.nestAnchor.z, radius: 2.5 });
    if (g?.ancientTemple?.altarWorldPos) anchors.push({ name: '后山神殿门扉与先民祭坛', x: g.ancientTemple.altarWorldPos.x, z: g.ancientTemple.altarWorldPos.z, radius: 2.5 });
    else anchors.push({ name: '后山神殿门扉与先民祭坛', x: 0, z: -22.5, radius: 2.5 });
    if (g?.lighthouse?.anchor) anchors.push({ name: '北崖古灯塔', x: g.lighthouse.anchor.x, z: g.lighthouse.anchor.z, radius: 2.5 });
    return anchors;
  }

  // 四重合法性实时校验（地形入水与陡坡 / 家具间距 < 1.2m / 核心锚点 2.5m 禁建圈 / 材料充足度）
  validatePlacement(x, z, itemConf = this.selectedItem, ignoreEntry = this.relocatingEntry) {
    const sx = snapHalfMeter(x);
    const sz = snapHalfMeter(z);
    const terrainInfo = this.sampleGroundAndSlope(sx, sz);

    if (terrainInfo.inWater) {
      return { valid: false, code: 'water', reason: '不可在海水或溪流中建造', x: sx, y: terrainInfo.y, z: sz };
    }
    if (terrainInfo.slope > 0.42) {
      return { valid: false, code: 'slope', reason: '地面坡度过陡，请移至平坦营地', x: sx, y: terrainInfo.y, z: sz };
    }

    for (const anchor of this.getProtectedWorldAnchors()) {
      const dist = Math.hypot(sx - anchor.x, sz - anchor.z);
      if (dist < (anchor.radius || 2.5)) {
        return { valid: false, code: 'anchor_protected', reason: `距离【${anchor.name}】过近（需保持 2.5m 净空）`, x: sx, y: terrainInfo.y, z: sz };
      }
    }

    for (const f of this.placedFurniture) {
      if (ignoreEntry && f === ignoreEntry) continue;
      const dist = Math.hypot(sx - f.pos[0], sz - f.pos[2]);
      if (dist < 1.2) {
        return { valid: false, code: 'furniture_overlap', reason: `与【${f.name || f.id}】间距不足 1.2m`, x: sx, y: terrainInfo.y, z: sz };
      }
    }

    if (!ignoreEntry && itemConf) {
      if (itemConf.isRefinery) {
        const existingRef = this.placedFurniture.find((f) => f.isRefinery);
        if (existingRef) {
          return { valid: false, code: 'unique_refinery', reason: '纯晶精炼炉已建成，请点选炉体执行移位', x: sx, y: terrainInfo.y, z: sz };
        }
        const refLvl = this.game?.campFacilities?.refineryLevel || 0;
        if (refLvl === 0 && (this.game?.story?.currentChapterId ?? 0) < 3) {
          return { valid: false, code: 'chapter_locked', reason: '需进入第 3 章解锁古法纯晶精炼炉', x: sx, y: terrainInfo.y, z: sz };
        }
        if (refLvl === 0 && !this.canAfford(itemConf)) {
          return { valid: false, code: 'insufficient_materials', reason: '建造纯晶精炼炉所需建材或算力不足', x: sx, y: terrainInfo.y, z: sz };
        }
      } else if (!this.canAfford(itemConf)) {
        return { valid: false, code: 'insufficient_materials', reason: '随身背包与营地储物箱建材合计不足', x: sx, y: terrainInfo.y, z: sz };
      }
    }

    return { valid: true, code: 'ok', reason: '位置平整，可安心放置', x: sx, y: terrainInfo.y, z: sz };
  }

  // 计算玩家正前方 2.2m 的 0.5m 网格对齐默认落点
  snapToPlayerFront(distance = 2.2) {
    const p = this.game?.player;
    if (!p || !p.position) {
      this.setPreviewPosition(-15.0, 26.0);
      return this.hoverPos;
    }
    const rot = typeof p.rotation === 'number' ? p.rotation : (p.mesh?.rotation?.y || 0);
    const fx = p.position.x + Math.sin(rot) * distance;
    const fz = p.position.z + Math.cos(rot) * distance;
    this.setPreviewPosition(fx, fz);
    return this.hoverPos;
  }

  setPreviewPosition(x, z) {
    const check = this.validatePlacement(x, z, this.selectedItem || this.relocatingEntry, this.relocatingEntry);
    this.lastValidation = check;
    this.hoverPos.set(check.x, check.y, check.z);

    if (this.previewModel) {
      this.previewModel.position.copy(this.hoverPos);
      this.previewModel.rotation.y = this.currentRotation;
    }
    if (this.validityRing) {
      const showRing = this.isBuildMode && Boolean(this.selectedItem || this.relocatingEntry);
      this.validityRing.visible = showRing;
      this.validityRing.position.set(check.x, check.y + 0.045, check.z);
      this.validityRingMat.color.setHex(check.valid ? 0x00e676 : 0xff4757);
    }
    this.game?.ui?.refreshBuildOverlayState?.();
    return check;
  }

  enterBuildMode(initialCategory = 'facility') {
    if (this.game && this.game.currentIslandId && this.game.currentIslandId !== 'main_island') {
      this.game.ui?.showToast?.('⛵ 仅可在主岛大本营开启营地规划与建造！', 'medium');
      return false;
    }
    this.isBuildMode = true;
    this.gridHelper.visible = true;
    this.editingEntry = null;
    this.relocatingEntry = null;
    this.selectionRing.visible = false;
    this.snapToPlayerFront(2.2);
    soundEngine.playPlaceFurniture();
    this.game?.ui?.openBuildDrawer?.(initialCategory);
    return true;
  }

  exitBuildMode() {
    if (!this.isBuildMode && !this.previewModel) return false;
    this.isBuildMode = false;
    this.selectedItem = null;
    this.editingEntry = null;
    this.relocatingEntry = null;
    this.gridHelper.visible = false;
    this.validityRing.visible = false;
    this.selectionRing.visible = false;
    if (this.previewModel) {
      this.scene?.remove(this.previewModel);
      this.previewModel = null;
    }
    this.game?.ui?.closeBuildDrawer?.();
    return false;
  }

  toggleBuildMode() {
    if (this.isBuildMode) {
      this.exitBuildMode();
      return false;
    }
    return this.enterBuildMode('facility');
  }

  // 检查是否具备足够的建造原材料（随身背包 + 营地储物箱联合统计；算力代币仅统计背包）
  getCombinedCount(matKey) {
    const inv = this.game?.ui?.inventory || {};
    const storage = this.game?.storageSystem?.storageInventory || {};
    if (matKey === 'sol_token') return inv['sol_token'] || 0;
    if (matKey === 'driftwood_or_plank') {
      return (inv['driftwood'] || 0) + (storage['driftwood'] || 0) + (inv['wood_plank'] || 0) + (storage['wood_plank'] || 0);
    }
    return (inv[matKey] || 0) + (storage[matKey] || 0);
  }

  canAfford(itemConf) {
    if (!itemConf || !itemConf.cost) return true;
    if (itemConf.isRefinery && (this.game?.campFacilities?.refineryLevel || 0) > 0) {
      return true;
    }
    for (const [mat, needCount] of Object.entries(itemConf.cost)) {
      if (this.getCombinedCount(mat) < needCount) return false;
    }
    return true;
  }

  // 联合扣减“随身背包 + 营地储物箱”建材（先扣背包，差额自动扣储物箱）
  deductCost(itemConf, multiplier = 1) {
    if (!itemConf || !itemConf.cost) return true;
    if (!this.game || !this.game.ui) return true;

    const inv = this.game.ui.inventory || {};
    const storage = this.game.storageSystem ? this.game.storageSystem.storageInventory : {};

    for (const [mat, baseNeed] of Object.entries(itemConf.cost)) {
      const needCount = baseNeed * multiplier;
      if (this.getCombinedCount(mat) < needCount) return false;
    }

    for (const [mat, baseNeed] of Object.entries(itemConf.cost)) {
      let remain = baseNeed * multiplier;
      const keys = mat === 'driftwood_or_plank' ? ['driftwood', 'wood_plank'] : [mat];
      for (const k of keys) {
        if (remain <= 0) break;
        if (inv[k]) {
          const take = Math.min(inv[k], remain);
          inv[k] -= take;
          remain -= take;
          if (inv[k] <= 0) delete inv[k];
        }
        if (remain > 0 && storage[k] && k !== 'sol_token') {
          const take = Math.min(storage[k], remain);
          storage[k] -= take;
          remain -= take;
          if (storage[k] <= 0) delete storage[k];
        }
      }
    }

    this.game.ui.renderInventory?.();
    return true;
  }

  async _createEntityModel(meta, overrideRefineryLevel = null) {
    const hydrated = hydrateFurnitureMeta(meta);
    if (hydrated.proceduralType === 'furnace' || hydrated.isFurnace) {
      return createProceduralFurnaceMesh(hydrated.scale || 1.0);
    }
    if (hydrated.proceduralType === 'crystal_refinery' || hydrated.isRefinery) {
      const lvl = overrideRefineryLevel || this.game?.campFacilities?.refineryLevel || 1;
      return createProceduralRefineryMesh(lvl, hydrated.scale || 1.0);
    }
    if (!hydrated.path) {
      const fallback = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 })
      );
      box.position.y = 0.3;
      fallback.add(box);
      return fallback;
    }
    return modelLoader.loadModel(hydrated.path, {
      scale: hydrated.scale || 1.0,
      castShadow: true,
      receiveShadow: true
    });
  }

  async selectFurniture(item) {
    const hydrated = hydrateFurnitureMeta(item);
    if (!hydrated) return;
    this.editingEntry = null;
    this.relocatingEntry = null;
    this.selectionRing.visible = false;
    this.selectedItem = hydrated;

    if (this.previewModel) {
      this.scene?.remove(this.previewModel);
      this.previewModel = null;
    }

    this.snapToPlayerFront(2.2);
    const model = await this._createEntityModel(hydrated);
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.68;
      }
    });

    this.previewModel = model;
    this.scene?.add(this.previewModel);
    this.setPreviewPosition(this.hoverPos.x, this.hoverPos.z);
  }

  rotatePreview(stepSign = 1) {
    this.currentRotation = (this.currentRotation + (stepSign >= 0 ? 1 : -1) * (Math.PI / 2)) % (Math.PI * 2);
    if (this.previewModel) {
      this.previewModel.rotation.y = this.currentRotation;
    }
    soundEngine.playItemDrop();
    this.game?.ui?.refreshBuildOverlayState?.();
  }

  selectPlacedFurniture(entry) {
    if (!entry) return;
    if (this.previewModel) {
      this.scene?.remove(this.previewModel);
      this.previewModel = null;
    }
    this.selectedItem = null;
    this.relocatingEntry = null;
    this.editingEntry = entry;
    this.validityRing.visible = false;
    this.selectionRing.visible = true;
    this.selectionRing.position.set(entry.pos[0], (entry.pos[1] || 0) + 0.05, entry.pos[2]);
    soundEngine.playItemDrop();
    this.game?.ui?.refreshBuildOverlayState?.();
  }

  async startRelocateSelected() {
    if (!this.editingEntry) return false;
    const entry = this.editingEntry;
    this.relocatingEntry = entry;
    this.selectedItem = null;
    this.currentRotation = entry.rot || 0;
    this.selectionRing.visible = false;

    if (this.previewModel) {
      this.scene?.remove(this.previewModel);
      this.previewModel = null;
    }
    const model = await this._createEntityModel(entry);
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.68;
      }
    });
    this.previewModel = model;
    this.scene?.add(this.previewModel);
    this.setPreviewPosition(entry.pos[0], entry.pos[2]);
    return true;
  }

  rotateSelectedFurniture(stepSign = 1) {
    const target = this.editingEntry;
    if (!target) return false;
    target.rot = ((target.rot || 0) + (stepSign >= 0 ? 1 : -1) * (Math.PI / 2)) % (Math.PI * 2);
    if (target.mesh) target.mesh.rotation.y = target.rot;
    soundEngine.playPlaceFurniture();
    this._persistAfterChange('rotate_furniture');
    this.game?.ui?.refreshBuildOverlayState?.();
    return true;
  }

  // 拆卸选中设施：100% 返还建材，并执行非空容器防丢物保护
  dismantleSelected(targetEntry = this.editingEntry) {
    if (!targetEntry) return { ok: false, msg: '未选中任何营地设施' };
    const idx = this.placedFurniture.indexOf(targetEntry);
    if (idx === -1) return { ok: false, msg: '目标设施不存在' };

    // 1. 独立容器物品非空保护
    if (targetEntry.containerItems && Object.values(targetEntry.containerItems).some((v) => v > 0)) {
      const msg = `⚠️ 【${targetEntry.name}】内部尚存物资，请先清空容器后再拆卸！`;
      this.game?.ui?.showToast?.(msg, 'medium');
      return { ok: false, code: 'non_empty_container', msg };
    }

    // 2. 储物木箱容量溢出防丢物保护
    if (targetEntry.isStorage && this.game?.storageSystem) {
      const bonusSlots = targetEntry.bonusStorageSlots || 4;
      const used = this.game.storageSystem.usedSlots;
      const capAfter = Math.max(16, this.game.storageSystem.maxCapacity - bonusSlots);
      const otherBoxes = this.placedFurniture.filter((f) => f !== targetEntry && f.isStorage).length;
      if (used > capAfter || (otherBoxes === 0 && used > this.game.storageSystem.baseCapacity)) {
        const msg = `⚠️ 储物箱内存有 ${used} 类物资，拆卸将超出剩余容量（${capAfter} 格），请先取出部分物资！`;
        this.game?.ui?.showToast?.(msg, 'medium');
        return { ok: false, code: 'non_empty_storage', msg };
      }
      if (this.game.storageSystem.bonusCapacity >= bonusSlots) {
        this.game.storageSystem.bonusCapacity -= bonusSlots;
      }
    }

    // 3. 纯晶精炼炉待炼原料非空保护（保留已解锁精炼炉等级，避免损坏 EconomyLedger）
    if (targetEntry.isRefinery) {
      const st = this.game?.storageSystem?.storageInventory || {};
      const queued = Math.min(Math.floor((st['sol_crystal'] || 0) / 2), st['tree_sap'] || 0);
      if (queued > 0) {
        const msg = `⚠️ 纯晶精炼炉尚有 ${queued} 批待提纯原料在队列中，请等待过夜提纯或取出后再收起！`;
        this.game?.ui?.showToast?.(msg, 'medium');
        return { ok: false, code: 'non_empty_refinery', msg };
      }
      if (targetEntry.mesh) this.group.remove(targetEntry.mesh);
      this.placedFurniture.splice(idx, 1);
      this.editingEntry = null;
      this.selectionRing.visible = false;
      this._persistAfterChange('store_refinery');
      this.game?.ui?.showToast?.('💠 已收起【古法纯晶精炼炉】（工坊等级完整保留，可随时免费重新摆放）！', 'medium');
      this.game?.ui?.refreshBuildOverlayState?.();
      return { ok: true, storedRefinery: true };
    }

    // 4. 净水台蓄水非空保护（若场内仅剩自建净水台且尚有蓄水）
    if (targetEntry.isWaterPurifier && !this.game?.campEntities && (this.game?.campFacilities?.purifierWaterLevel || 0) > 0) {
      const msg = '⚠️ 净水滴滤台内仍有未取用的纯净水，请先灌装取空后再拆卸！';
      this.game?.ui?.showToast?.(msg, 'medium');
      return { ok: false, code: 'non_empty_purifier', msg };
    }

    // 5. 移除 3D 网格并 100% 返还全部建材（优先返还背包，满格自动转入营地储物箱）
    if (targetEntry.mesh) this.group.remove(targetEntry.mesh);
    this.placedFurniture.splice(idx, 1);

    const hydrated = hydrateFurnitureMeta(targetEntry);
    const refunded = {};
    for (const [mat, count] of Object.entries(hydrated.cost || {})) {
      if (count <= 0 || mat === 'sol_token') continue;
      this._grantMaterialSafe(mat, count);
      refunded[mat] = count;
    }

    this.editingEntry = null;
    this.selectionRing.visible = false;
    soundEngine.playPlaceFurniture();
    this.game?.ui?.renderInventory?.();
    this._persistAfterChange('dismantle_furniture');
    this.game?.ui?.showToast?.(`♻️ 已拆卸【${hydrated.name}】，100% 建材已原数返还！`, 'medium');
    this.game?.ui?.refreshBuildOverlayState?.();
    return { ok: true, refunded };
  }

  _grantMaterialSafe(itemKey, count) {
    if (!this.game?.ui) return;
    const inv = this.game.ui.inventory;
    const canBag = !this.game.ui.isInventoryFull || !this.game.ui.isInventoryFull(itemKey) || (inv && inv[itemKey] > 0);
    if (canBag && this.game.ui.addInventory) {
      this.game.ui.addInventory(itemKey, count);
    } else if (this.game.storageSystem?.storageInventory) {
      const st = this.game.storageSystem.storageInventory;
      st[itemKey] = (st[itemKey] || 0) + count;
    } else if (inv) {
      inv[itemKey] = (inv[itemKey] || 0) + count;
    }
  }

  async placeCurrentFurniture() {
    // 分支 A：正在移位已有设施
    if (this.relocatingEntry) {
      const check = this.validatePlacement(this.hoverPos.x, this.hoverPos.z, this.relocatingEntry, this.relocatingEntry);
      if (!check.valid) {
        this.game?.ui?.showToast?.(`❌ 无法移至此处：${check.reason}`, 'medium');
        return { ok: false, reason: check.reason };
      }
      const entry = this.relocatingEntry;
      entry.pos = [check.x, check.y, check.z];
      entry.rot = this.currentRotation;
      if (entry.mesh) {
        entry.mesh.position.set(check.x, check.y, check.z);
        entry.mesh.rotation.y = entry.rot;
      }
      if (this.previewModel) {
        this.scene?.remove(this.previewModel);
        this.previewModel = null;
      }
      this.relocatingEntry = null;
      this.validityRing.visible = false;
      this.selectPlacedFurniture(entry);
      soundEngine.playPlaceFurniture();
      this._persistAfterChange('relocate_furniture');
      this.game?.ui?.showToast?.(`✅ 【${entry.name}】已移位安放妥当！`, 'medium');
      return { ok: true, relocated: true, entry };
    }

    // 分支 B：新建放置
    if (!this.selectedItem) return { ok: false, reason: '未选择要建造的设施' };
    const itemConf = hydrateFurnitureMeta(this.selectedItem);
    const check = this.validatePlacement(this.hoverPos.x, this.hoverPos.z, itemConf, null);
    if (!check.valid) {
      this.game?.ui?.showToast?.(`❌ 无法放置：${check.reason}`, 'medium');
      return { ok: false, code: check.code, reason: check.reason };
    }

    // 若为纯晶精炼炉且尚未解锁等级，走 CampFacilitiesSystem 统一扣费建炉逻辑
    if (itemConf.isRefinery) {
      const refLvl = this.game?.campFacilities?.refineryLevel || 0;
      if (refLvl === 0) {
        const res = this.game?.campFacilities?.buildRefinery?.({ skipAutoSpawn: true });
        if (!res || !res.ok) return { ok: false, reason: res?.msg || '精炼炉建造失败' };
      }
    } else {
      this.deductCost(itemConf, 1);
    }

    const pos = [check.x, check.y, check.z];
    const rot = this.currentRotation;
    const realModel = await this._createEntityModel(itemConf);
    realModel.position.set(pos[0], pos[1], pos[2]);
    realModel.rotation.y = rot;
    realModel.userData.movementBox = true;
    this.group.add(realModel);

    const record = {
      ...itemConf,
      pos,
      rot,
      mesh: realModel
    };
    this.placedFurniture.push(record);

    if (itemConf.isStorage && this.game?.storageSystem && itemConf.bonusStorageSlots > 0) {
      this.game.storageSystem.bonusCapacity += itemConf.bonusStorageSlots;
    }

    soundEngine.playPlaceFurniture();
    this._persistAfterChange('place_furniture');
    this.setPreviewPosition(this.hoverPos.x, this.hoverPos.z);
    this.game?.ui?.showToast?.(`🔨 成功建造了【${itemConf.name}】！`, 'medium');
    this.game?.ui?.refreshBuildDrawerCosts?.();
    return { ok: true, entry: record };
  }

  // 与 CampFacilitiesSystem 双向同步纯晶精炼炉 3D 实体（建造 L1 / 升级 L2 时自动生成或热升级双腔石英塔）
  async syncRefineryEntity(level = this.game?.campFacilities?.refineryLevel || 0) {
    if (level <= 0) return null;
    let existing = this.placedFurniture.find((f) => f.isRefinery);
    if (!existing) {
      const pos = this._findSafeWorkshopSpot(DEFAULT_REFINERY_POS[0], DEFAULT_REFINERY_POS[2]);
      const meta = hydrateFurnitureMeta({ id: 'crystal_refinery', pos: [pos.x, pos.y, pos.z], rot: 0 });
      const mesh = await this._createEntityModel(meta, level);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData.movementBox = true;
      this.group.add(mesh);
      existing = { ...meta, mesh };
      this.placedFurniture.push(existing);
    } else if (existing.mesh?.userData?.refineryLevel !== level) {
      if (existing.mesh) this.group.remove(existing.mesh);
      const nextMesh = await this._createEntityModel(existing, level);
      nextMesh.position.set(existing.pos[0], existing.pos[1], existing.pos[2]);
      nextMesh.rotation.y = existing.rot || 0;
      nextMesh.userData.movementBox = true;
      this.group.add(nextMesh);
      existing.mesh = nextMesh;
    }
    this.updateWorkshopVisuals(0);
    return existing;
  }

  _findSafeWorkshopSpot(prefX, prefZ) {
    const candidates = [
      [prefX, prefZ],
      [-16.5, 26.5],
      [-18.0, 26.5],
      [-15.0, 27.5],
      [-8.0, 24.5],
      [-8.5, 21.5]
    ];
    for (const [cx, cz] of candidates) {
      const res = this.validatePlacement(cx, cz, null, null);
      if (res.valid) return { x: res.x, y: res.y, z: res.z };
    }
    return { x: prefX, y: 0.02, z: prefZ };
  }

  // 每帧更新工坊双炉动态火光（纯晶精炼炉炉火随储物箱待炼库存亮灭）
  update(delta = 0.016) {
    this.updateWorkshopVisuals(delta);
  }

  updateWorkshopVisuals(delta = 0.016) {
    this._animClock += delta;
    const st = this.game?.storageSystem?.storageInventory || {};
    const hasRefineryStock = (this.game?.campFacilities?.refineryLevel || 0) > 0 &&
      (st['sol_crystal'] || 0) >= 2 && (st['tree_sap'] || 0) >= 1;

    for (const f of this.placedFurniture) {
      if (!f.mesh) continue;
      if (f.isRefinery) {
        const fireGroup = f.mesh.userData?.fireGroup;
        const spire = f.mesh.userData?.coreSpire;
        const qMat = f.mesh.userData?.quartzMat;
        if (fireGroup) {
          fireGroup.visible = hasRefineryStock;
          if (hasRefineryStock) {
            const pulse = 0.92 + Math.sin(this._animClock * 7.5) * 0.12;
            fireGroup.scale.set(pulse, 0.9 + Math.cos(this._animClock * 9.0) * 0.16, pulse);
          }
        }
        if (spire) spire.rotation.y += delta * (hasRefineryStock ? 1.8 : 0.45);
        if (qMat) qMat.emissiveIntensity = hasRefineryStock ? (0.85 + Math.sin(this._animClock * 5) * 0.2) : 0.22;
      } else if (f.isFurnace) {
        const ember = f.mesh.userData?.emberCore;
        if (ember?.material) {
          ember.material.emissiveIntensity = 1.15 + Math.sin(this._animClock * 6.0) * 0.25;
        }
      }
    }
  }

  // C3：耐火锻造熔炉高温冶炼配方查询与执行
  getFurnaceRecipes() {
    const monolithUnlocked = Boolean(this.game?.quarryIsleScene?.monolithRead);
    return FURNACE_RECIPES.map((r) => {
      const unlocked = !r.requiresMonolith || monolithUnlocked;
      const maxBatch = Math.min(
        ...r.inputs.map((inp) => Math.floor(this.getCombinedCount(inp.key) / inp.count))
      );
      return {
        ...r,
        unlocked,
        maxBatch: Math.max(0, maxBatch),
        inputsStatus: r.inputs.map((inp) => ({
          ...inp,
          have: this.getCombinedCount(inp.key)
        }))
      };
    });
  }

  smeltInFurnace(recipeId, batchCount = 1) {
    const count = Math.max(1, Math.floor(Number(batchCount) || 1));
    const recipe = FURNACE_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return { ok: false, msg: '未知的冶炼配方' };

    if (recipe.requiresMonolith && !this.game?.quarryIsleScene?.monolithRead) {
      const msg = '🔒 尚未解锁该配方！请先前往【海蚀矿石岛】研读先民青铜冶炼石碑。';
      this.game?.ui?.showToast?.(msg, 'medium');
      return { ok: false, code: 'monolith_locked', msg };
    }

    const costMap = {};
    for (const inp of recipe.inputs) costMap[inp.key] = inp.count;
    if (!this.deductCost({ cost: costMap }, count)) {
      const msg = `❌ 原材料不足，无法批量冶炼【${recipe.output.label}】×${count}！`;
      this.game?.ui?.showToast?.(msg, 'medium');
      return { ok: false, code: 'insufficient_materials', msg };
    }

    const outTotal = recipe.output.count * count;
    this._grantMaterialSafe(recipe.output.key, outTotal);
    soundEngine.playCooking();
    this.game?.ui?.renderInventory?.();
    this.game?.story?.collectItem?.(recipe.output.key);
    this._persistAfterChange('furnace_smelt');
    const okMsg = `🔥 熔炉烈焰淬炼完成！获得【${recipe.output.label}】×${outTotal}！`;
    this.game?.ui?.showToast?.(okMsg, 'medium');
    return { ok: true, outputKey: recipe.output.key, outputCount: outTotal, msg: okMsg };
  }

  // C4：营地舒适度（按营地内不重复家具种类计分，满分 100，Lv.1~Lv.4；严格遵守 R3 隔离）
  getComfortOverview() {
    const uniqueMap = new Map();
    for (const f of this.placedFurniture) {
      const hydrated = hydrateFurnitureMeta(f);
      if (hydrated && !uniqueMap.has(hydrated.id)) {
        uniqueMap.set(hydrated.id, hydrated.comfortScore || 0);
      }
    }
    if ((this.game?.campFacilities?.refineryLevel || 0) > 0 && !uniqueMap.has('crystal_refinery')) {
      const refMeta = hydrateFurnitureMeta({ id: 'crystal_refinery' });
      uniqueMap.set('crystal_refinery', refMeta?.comfortScore || 12);
    }

    let rawScore = 0;
    for (const pts of uniqueMap.values()) rawScore += pts;
    const score = Math.min(100, rawScore);

    let level = 1;
    let title = 'Lv.1 简陋营帐';
    let nextThreshold = 20;
    if (score >= 80) {
      level = 4;
      title = 'Lv.4 世外桃源';
      nextThreshold = 100;
    } else if (score >= 50) {
      level = 3;
      title = 'Lv.3 温馨聚落';
      nextThreshold = 80;
    } else if (score >= 20) {
      level = 2;
      title = 'Lv.2 整洁营地';
      nextThreshold = 50;
    }

    return {
      score,
      maxScore: 100,
      level,
      title,
      uniqueTypes: uniqueMap.size,
      uniqueIds: Array.from(uniqueMap.keys()),
      nextThreshold,
      sleepLifeBonus: level >= 2 ? 15 : 0,
      sleepFatigueBonus: level >= 2 ? 15 : 0,
      gatherYieldMultiplier: level >= 3 ? 1.15 : 1.0,
      dailyBreakfastGift: level >= 4 ? 1 : 0,
      // R3 差分隔离：对晶石产出、纯晶日上限、矿机算力与赛季声望 RS 影响严格为 0
      solCrystalBonus: 0,
      pureCrystalCapBonus: 0,
      rigHashBonus: 0,
      rsBonus: 0
    };
  }

  // 检测玩家走近已放置的功能设施（储物箱、净水台、床位、耐火熔炉、纯晶精炼炉）
  getNearestInteractable(playerPos, maxDist = 2.6) {
    if (!playerPos) return null;
    let nearest = null;
    let minDist = maxDist;
    for (const f of this.placedFurniture) {
      if (!f.isStorage && !f.isWaterPurifier && !f.isBed && !f.isFurnace && !f.isRefinery) continue;
      const d = Math.hypot(playerPos.x - f.pos[0], playerPos.z - f.pos[2]);
      if (d < minDist) {
        minDist = d;
        nearest = f;
      }
    }
    return nearest;
  }

  // C2：标准序列化接口（供 SaveSystem 单一数据源统一保存与恢复）
  serialize() {
    return this.placedFurniture.map((f) => {
      const h = hydrateFurnitureMeta(f);
      const item = {
        id: h.id,
        pos: [Number(h.pos[0]) || 0, Number(h.pos[1]) || 0, Number(h.pos[2]) || 0],
        rot: Number(h.rot) || 0,
        scale: h.scale || 1.0
      };
      if (h.path) item.path = h.path;
      if (h.proceduralType) item.proceduralType = h.proceduralType;
      if (h.containerItems) item.containerItems = { ...h.containerItems };
      return item;
    });
  }

  clearPlacedFurniture() {
    for (const f of this.placedFurniture) {
      if (f.mesh) this.group.remove(f.mesh);
    }
    this.placedFurniture = [];
    this.editingEntry = null;
    this.relocatingEntry = null;
    this.selectionRing.visible = false;
  }

  async deserialize(furnitureList) {
    const token = ++this._restoreToken;
    this.clearPlacedFurniture();

    let source = Array.isArray(furnitureList) ? furnitureList : null;
    if ((!source || source.length === 0) && typeof localStorage !== 'undefined') {
      try {
        const legacyRaw = localStorage.getItem(LEGACY_FURNITURE_STORAGE_KEY);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed) && parsed.length > 0) source = parsed;
        }
      } catch (e) {}
    }

    const hydratedList = (source || []).map((raw) => hydrateFurnitureMeta(raw)).filter(Boolean);

    // 先同步写入元数据列表，保证读档后第一帧 getBedCapacity() / hasWaterPurifier() / getComfortOverview() 立即可用
    this.placedFurniture = hydratedList.map((h) => ({ ...h, mesh: null }));

    for (let i = 0; i < this.placedFurniture.length; i++) {
      if (token !== this._restoreToken) return this.placedFurniture;
      const entry = this.placedFurniture[i];
      const model = await this._createEntityModel(entry);
      if (token !== this._restoreToken) return this.placedFurniture;
      model.position.set(entry.pos[0], entry.pos[1], entry.pos[2]);
      model.rotation.y = entry.rot || 0;
      model.userData.movementBox = true;
      this.group.add(model);
      entry.mesh = model;
    }

    if ((this.game?.campFacilities?.refineryLevel || 0) > 0) {
      await this.syncRefineryEntity(this.game.campFacilities.refineryLevel);
    }
    this.updateWorkshopVisuals(0);
    return this.placedFurniture;
  }

  _persistAfterChange(reason = 'furniture_change') {
    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame(reason);
    } else {
      this.saveData();
    }
  }

  saveData() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LEGACY_FURNITURE_STORAGE_KEY, JSON.stringify(this.serialize()));
    } catch (e) {}
  }
}
