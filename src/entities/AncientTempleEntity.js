// CastawaySOL - 后山神秘古代神殿 3D 实体与遗迹场景 (Ancient Temple Entity)
// 位于主岛后山北部高地 (0, 0, -26)
// 包含：三层古老青苔台阶、4 根发光符文石柱、太阳神兽雕像、密封玄铁青铜石门与日冕交互祭坛
import * as THREE from 'three';

export class AncientTempleEntity {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ancient-temple-group';

    // 锚点位于后山北侧山麓台地
    this.anchorPosition = new THREE.Vector3(0, 0, -26);
    this.group.position.copy(this.anchorPosition);

    // 交互点祭坛位置 (世界坐标: 0, 0.4, -22.5)
    this.altarWorldPos = new THREE.Vector3(0, 0.4, -22.5);

    this.isDoorOpen = false;
    this.doorMesh = null;
    this.altarGlowMesh = null;
    this.crystalLight = null;

    this.buildTempleArchitecture();
    this.scene.add(this.group);
  }

  buildTempleArchitecture() {
    // 材质定义：古代青灰石料、青苔石砖与发光金珀
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x576574,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true
    });

    const mossStoneMat = new THREE.MeshStandardMaterial({
      color: 0x3d5a45,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    const runeMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });

    const bronzeDoorMat = new THREE.MeshStandardMaterial({
      color: 0x2c3a47,
      metalness: 0.7,
      roughness: 0.35,
      flatShading: true
    });

    // 1. 三层渐进式青苔石阶基座
    for (let i = 0; i < 3; i++) {
      const w = 18 - i * 2.2;
      const d = 16 - i * 1.8;
      const h = 0.45;
      const stepGeo = new THREE.BoxGeometry(w, h, d);
      const stepMesh = new THREE.Mesh(stepGeo, i % 2 === 0 ? stoneMat : mossStoneMat);
      stepMesh.position.set(0, (i + 0.5) * h, 0);
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      this.group.add(stepMesh);
    }

    const baseTopY = 3 * 0.45; // 1.35 米

    // 2. 神殿后方巍峨玄武岩后壁与拱顶框架
    const backWallGeo = new THREE.BoxGeometry(13.5, 7.5, 1.8);
    const backWall = new THREE.Mesh(backWallGeo, stoneMat);
    backWall.position.set(0, baseTopY + 3.75, -5.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // 左右护壁
    const sideWallGeo = new THREE.BoxGeometry(1.6, 6.0, 9.0);
    const leftWall = new THREE.Mesh(sideWallGeo, mossStoneMat);
    leftWall.position.set(-6.0, baseTopY + 3.0, -1.0);
    leftWall.castShadow = true;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, mossStoneMat);
    rightWall.position.set(6.0, baseTopY + 3.0, -1.0);
    rightWall.castShadow = true;
    this.group.add(rightWall);

    // 3. 门楣与古代太阳神浮雕徽章
    const lintelGeo = new THREE.BoxGeometry(14.0, 1.4, 2.2);
    const lintel = new THREE.Mesh(lintelGeo, stoneMat);
    lintel.position.set(0, baseTopY + 6.8, -4.5);
    lintel.castShadow = true;
    this.group.add(lintel);

    const sunEmblemGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 8);
    sunEmblemGeo.rotateX(Math.PI / 2);
    const sunEmblem = new THREE.Mesh(sunEmblemGeo, runeMat);
    sunEmblem.position.set(0, baseTopY + 7.0, -3.3);
    this.group.add(sunEmblem);

    // 4. 四根庄严古朴多边形立柱与发光符文环
    const pillarPositions = [
      [-4.5, 2.0], [4.5, 2.0],
      [-4.5, -2.5], [4.5, -2.5]
    ];

    pillarPositions.forEach(([px, pz]) => {
      // 柱基
      const baseGeo = new THREE.BoxGeometry(1.3, 0.6, 1.3);
      const pillarBase = new THREE.Mesh(baseGeo, stoneMat);
      pillarBase.position.set(px, baseTopY + 0.3, pz);
      pillarBase.castShadow = true;
      this.group.add(pillarBase);

      // 主柱身
      const colGeo = new THREE.CylinderGeometry(0.5, 0.58, 5.5, 7);
      const col = new THREE.Mesh(colGeo, mossStoneMat);
      col.position.set(px, baseTopY + 0.6 + 2.75, pz);
      col.castShadow = true;
      this.group.add(col);

      // 符文光环
      const ringGeo = new THREE.TorusGeometry(0.62, 0.08, 6, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, runeMat);
      ring.position.set(px, baseTopY + 3.5, pz);
      this.group.add(ring);
    });

    // 5. 密封玄铁青铜石门 (可向两侧滑动或升起)
    const doorGeo = new THREE.BoxGeometry(5.2, 5.2, 0.6);
    this.doorMesh = new THREE.Mesh(doorGeo, bronzeDoorMat);
    this.doorMesh.position.set(0, baseTopY + 2.6, -4.6);
    this.doorMesh.castShadow = true;
    this.group.add(this.doorMesh);

    // 石门中央巨大太阳图腾纹路
    const doorSunGeo = new THREE.RingGeometry(0.4, 1.0, 12);
    const doorSun = new THREE.Mesh(doorSunGeo, runeMat);
    doorSun.position.set(0, baseTopY + 2.6, -4.28);
    this.group.add(doorSun);

    // 6. 前台日冕石盘与交互石碑 (交互核心点)
    const altarBaseGeo = new THREE.CylinderGeometry(1.4, 1.8, 0.8, 8);
    const altarBase = new THREE.Mesh(altarBaseGeo, stoneMat);
    altarBase.position.set(0, baseTopY + 0.4, 3.5);
    altarBase.castShadow = true;
    this.group.add(altarBase);

    // 日冕光环盘
    const dialGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16);
    const dialMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3, metalness: 0.8 });
    const dial = new THREE.Mesh(dialGeo, dialMat);
    dial.position.set(0, baseTopY + 0.9, 3.5);
    this.group.add(dial);

    // 日冕中央跳动的金光聚能水晶
    const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
    this.altarGlowMesh = new THREE.Mesh(crystalGeo, runeMat);
    this.altarGlowMesh.position.set(0, baseTopY + 1.45, 3.5);
    this.group.add(this.altarGlowMesh);

    // 暖金色点光源
    this.crystalLight = new THREE.PointLight(0xffaa00, 2.2, 14, 1.5);
    this.crystalLight.position.set(0, baseTopY + 1.6, 3.5);
    this.group.add(this.crystalLight);

    // 7. 左右两尊远古太阳守护兽雕像
    this.createGuardianBeast(-3.8, baseTopY + 0.3, 4.0, 0.4);
    this.createGuardianBeast(3.8, baseTopY + 0.3, 4.0, -0.4);
  }

  // 构建远古护法雕像
  createGuardianBeast(x, y, z, rotY) {
    const beastGroup = new THREE.Group();
    beastGroup.position.set(x, y, z);
    beastGroup.rotation.y = rotY;

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x485460, roughness: 0.8, flatShading: true });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00cec9 });

    // 底座
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.5), stoneMat);
    base.position.y = 0.25;
    beastGroup.add(base);

    // 身躯
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 1.1), stoneMat);
    body.position.set(0, 0.9, -0.1);
    beastGroup.add(body);

    // 狮面神兽首级
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.8), stoneMat);
    head.position.set(0, 1.6, 0.2);
    beastGroup.add(head);

    // 幽蓝发光双眸
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
    eyeL.position.set(-0.2, 1.65, 0.62);
    beastGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
    eyeR.position.set(0.2, 1.65, 0.62);
    beastGroup.add(eyeR);

    this.group.add(beastGroup);
  }

  // 打开古代石门 (滑升动画)
  openTempleDoor() {
    this.isDoorOpen = true;
    if (this.doorMesh) {
      // 门缓缓升入顶槽
      this.doorMesh.position.y += 5.5;
    }
  }

  // 帧动画更新水晶浮动与光晕
  update(delta) {
    if (this.altarGlowMesh) {
      this.altarGlowMesh.rotation.y += delta * 1.5;
      this.altarGlowMesh.rotation.z += delta * 0.8;
      this.altarGlowMesh.position.y = 3 * 0.45 + 1.45 + Math.sin(Date.now() * 0.003) * 0.08;
    }
    if (this.crystalLight) {
      this.crystalLight.intensity = 2.0 + Math.sin(Date.now() * 0.004) * 0.5;
    }
  }
}
