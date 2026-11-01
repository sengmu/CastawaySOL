import * as THREE from 'three';

export class DayNightCycle {
  constructor(scene, renderer, quality = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.waterUniforms = null;
    this.skyUniforms = null;

    this.modes = ['day', 'sunset', 'night', 'sunrise'];
    this.currentMode = 'day';

    // 平滑过渡状态对象 (2~4 秒插值)
    this.isTransitioning = false;
    this.transitionDuration = 2.5; // 2.5秒优雅平滑插值过渡
    this.transitionTimer = 0;
    this.startState = null;
    this.targetState = null;

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

    this.baseHemiIntensity = 0.85;
    this.baseAmbientIntensity = 0.32;

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

  getModeState(mode) {
    const atm = DayNightCycle.ATMOSPHERE[mode] || DayNightCycle.ATMOSPHERE.day;
    let clearColor = 0x76c4e0;
    let dirColor = 0xfff5e6;
    let dirIntensity = 2.1;
    let dirOffset = new THREE.Vector3(-42, 54, 32);
    let hemiColor = 0xb4e8fc;
    let hemiGround = 0x426e22;
    let hemiIntensity = 0.85;
    let ambientIntensity = 0.32;
    let starOpacity = 0.0;

    switch (mode) {
      case "sunrise":
        clearColor = 0xfdd5b1;
        dirColor = 0xffcb9a;
        dirIntensity = 1.3;
        dirOffset = new THREE.Vector3(-60, 30, 20);
        hemiColor = 0xffdfba;
        hemiGround = 0x556b2f;
        hemiIntensity = 0.8;
        ambientIntensity = 0.35;
        starOpacity = 0.0;
        break;
      case "day":
        clearColor = 0x76c4e0;
        dirColor = 0xfff5e6;
        dirIntensity = 2.1;
        dirOffset = new THREE.Vector3(-42, 54, 32);
        hemiColor = 0xb4e8fc;
        hemiGround = 0x426e22;
        hemiIntensity = 0.85;
        ambientIntensity = 0.32;
        starOpacity = 0.0;
        break;
      case "sunset":
        clearColor = 0xf4a261;
        dirColor = 0xff7b54;
        dirIntensity = 1.5;
        dirOffset = new THREE.Vector3(60, 25, -30);
        hemiColor = 0xffb26b;
        hemiGround = 0x4a3b2c;
        hemiIntensity = 0.85;
        ambientIntensity = 0.35;
        starOpacity = 0.2;
        break;
      case "night":
        clearColor = 0x0d1b2a;
        dirColor = 0x8da9c4;
        dirIntensity = 0.65;
        dirOffset = new THREE.Vector3(-30, 50, -40);
        hemiColor = 0x1b263b;
        hemiGround = 0x0d131a;
        hemiIntensity = 0.4;
        ambientIntensity = 0.2;
        starOpacity = 0.85;
        break;
    }

    return {
      clearColor: new THREE.Color(clearColor),
      dirColor: new THREE.Color(dirColor),
      dirIntensity,
      dirOffset,
      hemiColor: new THREE.Color(hemiColor),
      hemiGround: new THREE.Color(hemiGround),
      hemiIntensity,
      ambientIntensity,
      starOpacity,
      fogColor: new THREE.Color(atm.fog),
      fogDensity: atm.density,
      waterSky: new THREE.Color(atm.sky),
      skyTop: new THREE.Color(atm.skyTop),
      skyBottom: new THREE.Color(atm.skyBottom)
    };
  }

  getCurrentState() {
    return {
      clearColor: this.renderer ? this.renderer.getClearColor(new THREE.Color()) : new THREE.Color(0x76c4e0),
      dirColor: this.dirLight.color.clone(),
      dirIntensity: this.dirLight.intensity,
      dirOffset: this.lightOffset.clone(),
      hemiColor: this.hemiLight.color.clone(),
      hemiGround: this.hemiLight.groundColor.clone(),
      hemiIntensity: this.hemiLight.intensity,
      ambientIntensity: this.ambientLight.intensity,
      starOpacity: this.stars ? this.stars.material.opacity : 0.0,
      fogColor: this.scene.fog ? this.scene.fog.color.clone() : new THREE.Color(0xb8e9f8),
      fogDensity: this.scene.fog ? this.scene.fog.density : 0.007,
      waterSky: (this.waterUniforms && this.waterUniforms.uSkyColor) ? this.waterUniforms.uSkyColor.value.clone() : new THREE.Color(0xbfe6f5),
      skyTop: (this.skyUniforms && this.skyUniforms.topColor) ? this.skyUniforms.topColor.value.clone() : new THREE.Color(0x3eaaf8),
      skyBottom: (this.skyUniforms && this.skyUniforms.bottomColor) ? this.skyUniforms.bottomColor.value.clone() : new THREE.Color(0xd7f3fc)
    };
  }

  setMode(mode, immediate = false) {
    const prevMode = this.currentMode;
    this.currentMode = mode;
    this.targetState = this.getModeState(mode);

    if (immediate || !prevMode) {
      this.isTransitioning = false;
      this.applyState(this.targetState);
    } else {
      this.startState = this.getCurrentState();
      this.transitionTimer = 0;
      this.isTransitioning = true;
    }
  }

  applyState(s) {
    if (this.renderer) this.renderer.setClearColor(s.clearColor);
    this.dirLight.color.copy(s.dirColor);
    this.dirLight.intensity = s.dirIntensity;
    this.lightOffset.copy(s.dirOffset);
    this.hemiLight.color.copy(s.hemiColor);
    this.hemiLight.groundColor.copy(s.hemiGround);
    this.hemiLight.intensity = s.hemiIntensity;
    this.ambientLight.intensity = s.ambientIntensity;
    this.baseHemiIntensity = s.hemiIntensity;
    this.baseAmbientIntensity = s.ambientIntensity;

    if (this.stars) this.stars.material.opacity = s.starOpacity;

    if (this.scene.fog && this.scene.fog.isFogExp2) {
      this.scene.fog.color.copy(s.fogColor);
      this.scene.fog.density = s.fogDensity;
    }
    if (this.waterUniforms && this.waterUniforms.uSkyColor) {
      this.waterUniforms.uSkyColor.value.copy(s.waterSky);
    }
    if (this.skyUniforms) {
      if (this.skyUniforms.topColor) this.skyUniforms.topColor.value.copy(s.skyTop);
      if (this.skyUniforms.bottomColor) this.skyUniforms.bottomColor.value.copy(s.skyBottom);
    }
  }

  // 阴影相机动态跟随玩家核心探索区 (带量化平滑吸附防闪烁)
  update(delta, playerPos) {
    // 2~4 秒全要素平滑插值过渡 (灯光、雾、天空、水面一起平滑过渡)
    if (this.isTransitioning && this.startState && this.targetState) {
      this.transitionTimer += delta;
      const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);
      // 平滑缓动 (smoothstep)
      const t = progress * progress * (3.0 - 2.0 * progress);

      const cur = {
        clearColor: this.startState.clearColor.clone().lerp(this.targetState.clearColor, t),
        dirColor: this.startState.dirColor.clone().lerp(this.targetState.dirColor, t),
        dirIntensity: THREE.MathUtils.lerp(this.startState.dirIntensity, this.targetState.dirIntensity, t),
        dirOffset: this.startState.dirOffset.clone().lerp(this.targetState.dirOffset, t),
        hemiColor: this.startState.hemiColor.clone().lerp(this.targetState.hemiColor, t),
        hemiGround: this.startState.hemiGround.clone().lerp(this.targetState.hemiGround, t),
        hemiIntensity: THREE.MathUtils.lerp(this.startState.hemiIntensity, this.targetState.hemiIntensity, t),
        ambientIntensity: THREE.MathUtils.lerp(this.startState.ambientIntensity, this.targetState.ambientIntensity, t),
        starOpacity: THREE.MathUtils.lerp(this.startState.starOpacity, this.targetState.starOpacity, t),
        fogColor: this.startState.fogColor.clone().lerp(this.targetState.fogColor, t),
        fogDensity: THREE.MathUtils.lerp(this.startState.fogDensity, this.targetState.fogDensity, t),
        waterSky: this.startState.waterSky.clone().lerp(this.targetState.waterSky, t),
        skyTop: this.startState.skyTop.clone().lerp(this.targetState.skyTop, t),
        skyBottom: this.startState.skyBottom.clone().lerp(this.targetState.skyBottom, t)
      };

      this.applyState(cur);

      if (progress >= 1.0) {
        this.isTransitioning = false;
        this.applyState(this.targetState);
      }
    }

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
    day: {
      fog: 0xb8e9f8,
      density: 0.007, // 白天雾密度提高到约 0.007，营造海岛温润空气透视感
      sky: 0xbfe6f5,
      skyTop: 0x3eaaf8,
      skyBottom: 0xd7f3fc
    },
    sunrise: {
      fog: 0xf6d6bc,
      density: 0.0065,
      sky: 0xffdcbc,
      skyTop: 0xf39c12,
      skyBottom: 0xfdebd0
    },
    sunset: {
      fog: 0xf2bd90,
      density: 0.0068,
      sky: 0xffc390,
      skyTop: 0xd35400,
      skyBottom: 0xf5b041
    },
    night: {
      fog: 0x13233a,
      density: 0.008,
      sky: 0x1f3656,
      skyTop: 0x0a101d,
      skyBottom: 0x1a2a40
    }
  };

  attachWater(waterUniforms) {
    this.waterUniforms = waterUniforms || null;
    this.applyAtmosphere(this.currentMode);
  }

  attachSky(skyUniforms) {
    this.skyUniforms = skyUniforms || null;
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
    if (this.skyUniforms) {
      if (this.skyUniforms.topColor) this.skyUniforms.topColor.value.setHex(atm.skyTop);
      if (this.skyUniforms.bottomColor) this.skyUniforms.bottomColor.value.setHex(atm.skyBottom);
    }
  }

  toggleMode() {
    const idx = (this.modes.indexOf(this.currentMode) + 1) % this.modes.length;
    this.setMode(this.modes[idx]);
    return this.currentMode;
  }
}
