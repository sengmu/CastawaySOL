import * as THREE from 'three';

export class DayNightCycle {
  constructor(scene, renderer, quality = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.waterUniforms = null;

    this.modes = ['day', 'sunset', 'night', 'sunrise'];
    this.currentMode = 'day';

    // 主平行光（暖金明媚太阳光，优雅 48 度黄金侧射角，投射舒展婆娑树影）
    this.dirLight = new THREE.DirectionalLight(0xfff5e6, 2.1);
    this.lightOffset = new THREE.Vector3(-42, 54, 32);
    this.dirLight.position.copy(this.lightOffset);
    this.dirLight.castShadow = true;

    // 独立光照 Target 实体以支持动态跟随玩家
    this.dirLight.target = new THREE.Object3D();
    this.scene.add(this.dirLight.target);

    const shadowSize = quality.shadowMapSize || 2048; // 低档 1024，中/高档 2048
    this.dirLight.shadow.mapSize.width = shadowSize;
    this.dirLight.shadow.mapSize.height = shadowSize;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 160;

    // 阴影相机正交范围：从全岛 52 米优化为紧凑聚焦的 30 米，贴图分辨率利用率翻 3 倍
    const d = 30;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.035;
    this.dirLight.shadow.radius = 2.0;
    this.scene.add(this.dirLight);

    // 半球环境光 (天顶蔚蓝天光 + 地表生机草绿漫反弹，温润柔和)
    this.hemiLight = new THREE.HemisphereLight(0xb4e8fc, 0x426e22, 0.85);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 适度漫反射补光 (保留暗部通透细节，杜绝过曝与发白)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.32);
    this.scene.add(this.ambientLight);

    // 夜空星辰粒子
    this.stars = null;
    this.createStars();

    this.setMode('day');
  }

  createStars() {
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 350;
      pos[i + 1] = 40 + Math.random() * 120;
      pos[i + 2] = (Math.random() - 0.5) * 350;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  setMode(mode) {
    this.currentMode = mode;

    switch (mode) {
      case 'sunrise': // 晨曦
        this.renderer.setClearColor(0xfdd5b1);
        this.dirLight.color.setHex(0xffcb9a);
        this.dirLight.intensity = 1.3;
        this.lightOffset.set(-60, 30, 20);
        this.hemiLight.color.setHex(0xffdfba);
        this.hemiLight.groundColor.setHex(0x556b2f);
        this.hemiLight.intensity = 0.8;
        this.ambientLight.intensity = 0.35;
        if (this.stars) this.stars.material.opacity = 0;
        break;

      case 'day': // 正午明媚热带海岛阳光
        this.renderer.setClearColor(0x76c4e0);
        this.dirLight.color.setHex(0xfff5e6);
        this.dirLight.intensity = 2.1;
        this.lightOffset.set(-42, 54, 32);
        this.hemiLight.color.setHex(0xb4e8fc);
        this.hemiLight.groundColor.setHex(0x426e22);
        this.hemiLight.intensity = 0.85;
        this.ambientLight.intensity = 0.32;
        if (this.stars) this.stars.material.opacity = 0;
        break;

      case 'sunset': // 黄昏暖金
        this.renderer.setClearColor(0xf4a261);
        this.dirLight.color.setHex(0xff7b54);
        this.dirLight.intensity = 1.5;
        this.lightOffset.set(60, 25, -30);
        this.hemiLight.color.setHex(0xffb26b);
        this.hemiLight.groundColor.setHex(0x4a3b2c);
        this.hemiLight.intensity = 0.85;
        this.ambientLight.intensity = 0.35;
        if (this.stars) this.stars.material.opacity = 0.2;
        break;

      case 'night': // 静谧星空夜
        this.renderer.setClearColor(0x0d1b2a);
        this.dirLight.color.setHex(0x8da9c4);
        this.dirLight.intensity = 0.65;
        this.lightOffset.set(-30, 50, -40);
        this.hemiLight.color.setHex(0x1b263b);
        this.hemiLight.groundColor.setHex(0x0d131a);
        this.hemiLight.intensity = 0.4;
        this.ambientLight.intensity = 0.2;
        if (this.stars) this.stars.material.opacity = 0.85;
        break;
    }
    this.applyAtmosphere(mode);
  }

  // 阴影相机动态跟随玩家核心探索区 (带量化平滑吸附防闪烁)
  update(delta, playerPos) {
    if (!playerPos || !this.dirLight || !this.dirLight.target) return;
    // 采用 1.0 米世界坐标网格吸附，消除摄像机移动产生的阴影边缘像素蠕动
    const snap = 1.0;
    const snapX = Math.floor(playerPos.x / snap) * snap;
    const snapZ = Math.floor(playerPos.z / snap) * snap;

    this.dirLight.target.position.set(snapX, 0, snapZ);
    this.dirLight.position.set(
      snapX + this.lightOffset.x,
      this.lightOffset.y,
      snapZ + this.lightOffset.z
    );
  }

  // 各时段大气参数：雾色贴近天色制造空气透视，水面菲涅尔反射同一天色
  static ATMOSPHERE = {
    day: { fog: 0xb8e9f8, density: 0.0032, sky: 0xbfe6f5 },
    sunrise: { fog: 0xf6d6bc, density: 0.0036, sky: 0xffdcbc },
    sunset: { fog: 0xf2bd90, density: 0.0038, sky: 0xffc390 },
    night: { fog: 0x13233a, density: 0.0045, sky: 0x1f3656 }
  };

  attachWater(waterUniforms) {
    this.waterUniforms = waterUniforms || null;
    this.applyAtmosphere(this.currentMode);
  }

  applyAtmosphere(mode) {
    const atm = DayNightCycle.ATMOSPHERE[mode] || DayNightCycle.ATMOSPHERE.day;
    if (this.scene.fog && this.scene.fog.isFogExp2) {
      this.scene.fog.color.setHex(atm.fog);
      this.scene.fog.density = atm.density;
    }
    if (this.waterUniforms && this.waterUniforms.uSkyColor) {
      this.waterUniforms.uSkyColor.value.setHex(atm.sky);
    }
  }

  toggleMode() {
    const idx = (this.modes.indexOf(this.currentMode) + 1) % this.modes.length;
    this.setMode(this.modes[idx]);
    return this.currentMode;
  }
}
