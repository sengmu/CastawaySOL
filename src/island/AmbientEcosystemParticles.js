import * as THREE from 'three';

export class AmbientEcosystemParticles {
  constructor(scene, getDayNightMode = () => 'day') {
    this.scene = scene;
    this.getDayNightMode = getDayNightMode;
    this.group = new THREE.Group();
    this.time = 0;
    this.currentNightOpacity = 0;

    // 1. 初始化林间漫舞飘落微叶粒子
    this.initDriftingLeaves();

    // 2. 初始化黄昏与夜间灵动萤火虫微光粒子
    this.initFireflies();

    this.scene.add(this.group);
  }

  // 1. 林间随风飘转的翠润微叶 (大幅精简数量至 12 枚，降低视觉杂乱感，避免误认为下雪)
  initDriftingLeaves() {
    this.leafCount = 12;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -0.12);
    leafShape.quadraticCurveTo(0.07, -0.03, 0.06, 0.06);
    leafShape.quadraticCurveTo(0.02, 0.14, 0, 0.18);
    leafShape.quadraticCurveTo(-0.02, 0.14, -0.06, 0.06);
    leafShape.quadraticCurveTo(-0.07, -0.03, 0, -0.12);

    const leafGeo = new THREE.ShapeGeometry(leafShape);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32, // 鲜明热带常绿叶色，彻底摆脱泛白粉灰感
      roughness: 0.65,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      emissive: new THREE.Color(0x0e2a0e)
    });

    this.leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, this.leafCount);
    this.leafMesh.castShadow = false;
    this.leafMesh.receiveShadow = false;

    // 预设主要树林活跃区域 (营地苹果树绿障、西北果园区、东北悬崖雪松林)
    const forestZones = [
      { cx: -17.0, cz: 20.0, radius: 6.0, spawnY: 4.6 }, // 营地后方苹果果林
      { cx: -16.0, cz: -3.0, radius: 7.5, spawnY: 4.8 }, // 西北丰盛果林小径
      { cx: 22.0, cz: -22.0, radius: 8.0, spawnY: 6.0 }, // 东北雪松深林
      { cx: 5.0, cz: 6.0, radius: 5.0, spawnY: 4.2 }     // 中央小溪漫步林带
    ];

    this.leavesData = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.leafCount; i++) {
      const zone = forestZones[i % forestZones.length];
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * zone.radius;

      const p = {
        zone,
        x: zone.cx + Math.cos(angle) * r,
        y: 0.6 + Math.random() * (zone.spawnY - 0.6),
        z: zone.cz + Math.sin(angle) * r,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        speedY: 0.45 + Math.random() * 0.45,
        swaySpeed: 1.6 + Math.random() * 1.8,
        swayAmp: 0.32 + Math.random() * 0.38,
        rotSpeed: (Math.random() - 0.5) * 2.8,
        scale: 0.45 + Math.random() * 0.35
      };

      this.leavesData.push(p);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      this.leafMesh.setMatrixAt(i, dummy.matrix);
    }

    this.leafMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.leafMesh);
  }

  // 2. 黄昏与夜间温暖治愈的发光萤火虫微光 (Fireflies 精炼为 22 处)
  initFireflies() {
    this.fireflyCount = 22;
    const fireflyGeo = new THREE.SphereGeometry(0.06, 6, 5);
    const fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xd4ff55, // 温润荧光金绿
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.fireflyMesh = new THREE.InstancedMesh(fireflyGeo, fireflyMat, this.fireflyCount);

    // 散落在全岛生态丰富地带
    const habitats = [
      { x: -16.0, z: -8.0, r: 9.0 },  // 营地树荫与帐篷旁
      { x: 3.0, z: 2.0, r: 7.0 },     // 营地中央野花草地
      { x: 14.0, z: 4.0, r: 8.0 },    // 泉潭溪边润泽湿地
      { x: 22.0, z: -20.0, r: 10.0 }, // 东北高台雪松深林
      { x: -5.0, z: 16.0, r: 7.0 }    // 南岸草地过渡带
    ];

    this.firefliesData = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.fireflyCount; i++) {
      const hab = habitats[i % habitats.length];
      const ang = Math.random() * Math.PI * 2;
      const d = Math.random() * hab.r;

      const f = {
        baseX: hab.x + Math.cos(ang) * d,
        baseZ: hab.z + Math.sin(ang) * d,
        baseY: 0.45 + Math.random() * 1.8,
        wanderRadiusX: 1.2 + Math.random() * 1.5,
        wanderRadiusZ: 1.2 + Math.random() * 1.5,
        wanderSpeedX: 0.6 + Math.random() * 0.7,
        wanderSpeedZ: 0.5 + Math.random() * 0.6,
        phaseX: Math.random() * Math.PI * 2,
        phaseZ: Math.random() * Math.PI * 2,
        blinkSpeed: 2.5 + Math.random() * 3.0,
        blinkPhase: Math.random() * Math.PI * 2,
        baseScale: 0.7 + Math.random() * 0.6
      };

      this.firefliesData.push(f);
      dummy.position.set(f.baseX, f.baseY, f.baseZ);
      dummy.scale.setScalar(f.baseScale);
      dummy.updateMatrix();
      this.fireflyMesh.setMatrixAt(i, dummy.matrix);
    }

    this.fireflyMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.fireflyMesh);
  }

  update(delta, playerPos) {
    this.time += delta;
    const dummy = new THREE.Object3D();

    // 1. 更新飘落微叶物理运动与循环
    if (this.leafMesh && this.leavesData) {
      for (let i = 0; i < this.leavesData.length; i++) {
        const p = this.leavesData[i];
        p.y -= p.speedY * delta;
        p.x += Math.sin(this.time * p.swaySpeed + i) * p.swayAmp * delta;
        p.z += (Math.cos(this.time * 0.9 + i) * 0.15 + 0.1) * delta; // 海风整体偏南向微移
        p.rotX += p.rotSpeed * delta;
        p.rotZ += p.rotSpeed * 0.65 * delta;

        // 触地后平滑重置至树梢上方
        if (p.y <= 0.08) {
          p.y = p.zone.spawnY + Math.random() * 0.8;
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * p.zone.radius;
          p.x = p.zone.cx + Math.cos(angle) * r;
          p.z = p.zone.cz + Math.sin(angle) * r;
        }

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        this.leafMesh.setMatrixAt(i, dummy.matrix);
      }
      this.leafMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. 更新灵动萤火虫游移与呼吸闪烁
    if (this.fireflyMesh && this.firefliesData) {
      const mode = this.getDayNightMode();
      let targetOpacity = 0.0;
      if (mode === 'night') targetOpacity = 0.95;
      else if (mode === 'sunset') targetOpacity = 0.65;
      else if (mode === 'sunrise') targetOpacity = 0.15;

      // 平滑渐变昼夜透明度
      this.currentNightOpacity = THREE.MathUtils.lerp(this.currentNightOpacity, targetOpacity, 3.0 * delta);
      this.fireflyMesh.material.opacity = this.currentNightOpacity;

      if (this.currentNightOpacity > 0.02) {
        for (let i = 0; i < this.firefliesData.length; i++) {
          const f = this.firefliesData[i];
          const currX = f.baseX + Math.sin(this.time * f.wanderSpeedX + f.phaseX) * f.wanderRadiusX;
          const currZ = f.baseZ + Math.cos(this.time * f.wanderSpeedZ + f.phaseZ) * f.wanderRadiusZ;
          const currY = f.baseY + Math.sin(this.time * 1.5 + f.blinkPhase) * 0.35;

          // 呼吸闪烁微缩放
          const blink = (Math.sin(this.time * f.blinkSpeed + f.blinkPhase) + 1.0) * 0.5;
          const scale = f.baseScale * (0.45 + blink * 0.85);

          dummy.position.set(currX, currY, currZ);
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          this.fireflyMesh.setMatrixAt(i, dummy.matrix);
        }
        this.fireflyMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
