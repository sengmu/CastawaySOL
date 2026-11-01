// CastawaySOL - 全场景假阴影系统 (Full-scene Contact Fake Shadow System)
// 复用玩家脚下径向渐变贴图，做 1 个 InstancedMesh 统一渲染所有树木、石头、营地物件、村民、野兽脚底假阴影
import * as THREE from "three";

export class SceneContactShadows {
  constructor(scene) {
    this.scene = scene;
    this.maxInstances = 256;
    this.instancedMesh = null;
    this.dynamicEntries = []; // 会动对象：{ getter: () => { pos, scale }, index }
    this.currentIndex = 0;

    this.initMesh();
  }

  // 生成或复用径向渐变贴图
  static createTexture() {
    if (SceneContactShadows._sharedTexture) return SceneContactShadows._sharedTexture;
    if (typeof document === "undefined") {
      SceneContactShadows._sharedTexture = new THREE.Texture();
      return SceneContactShadows._sharedTexture;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, "rgba(12, 18, 14, 0.62)");
    grad.addColorStop(0.35, "rgba(14, 20, 16, 0.42)");
    grad.addColorStop(0.72, "rgba(16, 24, 18, 0.12)");
    grad.addColorStop(1, "rgba(16, 24, 18, 0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    SceneContactShadows._sharedTexture = tex;
    return tex;
  }

  initMesh() {
    const geo = new THREE.PlaneGeometry(1.0, 1.0);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: SceneContactShadows.createTexture(),
      transparent: true,
      opacity: 0.82,
      depthWrite: false
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.renderOrder = 3;
    this.instancedMesh.name = "SceneContactShadows";

    // 默认所有实例矩阵缩放为 0
    const dummy = new THREE.Matrix4();
    dummy.makeScale(0, 0, 0);
    for (let i = 0; i < this.maxInstances; i++) {
      this.instancedMesh.setMatrixAt(i, dummy);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.instancedMesh);
  }

  // 注册静态阴影（树、石头、营地设施等）
  addStatic(x, y, z, rx, rz = rx) {
    if (this.currentIndex >= this.maxInstances) return;
    const idx = this.currentIndex++;
    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3(x, y + 0.015, z);
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3(rx * 2, 1.0, rz * 2);
    mat4.compose(pos, quat, scl);
    this.instancedMesh.setMatrixAt(idx, mat4);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  // 注册动态实体（村民、野兽）
  registerDynamic(getter) {
    if (this.currentIndex >= this.maxInstances) return;
    const idx = this.currentIndex++;
    this.dynamicEntries.push({ getter, index: idx });
  }

  // 每帧仅更新动态实体的实例矩阵
  update() {
    if (!this.dynamicEntries.length || !this.instancedMesh) return;
    const mat4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const pos = new THREE.Vector3();

    for (let i = 0; i < this.dynamicEntries.length; i++) {
      const entry = this.dynamicEntries[i];
      const data = entry.getter();
      if (!data || !data.pos || data.visible === false) {
        mat4.makeScale(0, 0, 0);
      } else {
        pos.set(data.pos.x, (data.pos.y || 0) + 0.018, data.pos.z);
        const sx = (data.radiusX || data.radius || 0.6) * 2;
        const sz = (data.radiusZ || data.radius || 0.6) * 2;
        scl.set(sx, 1.0, sz);
        mat4.compose(pos, quat, scl);
      }
      this.instancedMesh.setMatrixAt(entry.index, mat4);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
