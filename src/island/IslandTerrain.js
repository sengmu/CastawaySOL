import { islandShape, islandOutline } from './IslandFootprint.js';
import { ISLAND_LAYOUT, distanceXZ } from '../core/IslandLayout.js';
import * as THREE from 'three';
import { createFlowMaterial, createMistPoints } from './FreshwaterMaterials.js';

export class IslandTerrain {
  constructor(scene, quality = {}) {
    this.scene = scene;
    this.quality = quality;
    this.waterUniforms = null;
    this.group = new THREE.Group();
    this.colliders = [];
    this.waterMesh = null;
    this.foamMesh = null;
    this.time = 0;
    this.clouds = [];

    this.texLoader = new THREE.TextureLoader();

    // 载入高品质海岛质感贴图 (在顶点着色阶段按世界米制映射，贴图自身保持 Repeat 循环)
    this.grassTex = this.loadTex('/textures/grass_tri.png');
    this.stoneTex = this.loadTex('/textures/stone.png');
    this.sandTex = this.loadTex('/textures/sand.png');
    this.planksTex = this.loadTex('/textures/planks.png');
    this.waterTex = this.loadTex('/textures/water_foam.png');

    this.createSkyDome();
    this.createOcean();
    this.createShoreFoam();
    this.createIslandBase();
    this.createBeach();
    this.createCastawayShore();
    this.createSurvivalTrail();
    this.createRockyShores();
    this.createNorthwestSeaCaveAndArch();
    this.createCliffs();
    this.createWaterfallAndPool();
    this.createRiverAndBridge();
    this.createPier();
    // 成熟铺装与跳石步道在居民聚落升级阶段解锁
    this.createWildflowersAndDecor();
    this.createClouds();

    // 注入清润海岛空气轻雾，让远端海平面与天空优雅交融
    this.scene.fog = new THREE.FogExp2(0xb8e9f8, 0.0032);

    this.scene.add(this.group);
  }

  createSurvivalTrail() {
    // 质朴海岛生存步道：天然风化海石踏阶与踩踏紧实泥沙过渡，杜绝人工贴纸感
    const stoneStepMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x8a8478,
      roughness: 0.88,
      metalness: 0.04
    });
    const earthPathMat = new THREE.MeshStandardMaterial({
      map: this.sandTex,
      color: 0x847254, // 滋润深褐踏实沙泥色
      roughness: 0.95,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    // 营地火塘周围踩踏出的圆形自然沙石空地
    const campGroundShape = new THREE.Shape();
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 4.2 + Math.sin(angle * 3.5) * 0.45 + Math.cos(angle * 2.2) * 0.3;
      const px = Math.cos(angle) * radius * 1.25;
      const pz = Math.sin(angle) * radius * 0.95;
      if (i === 0) campGroundShape.moveTo(px, pz); else campGroundShape.lineTo(px, pz);
    }
    campGroundShape.closePath();
    const campGroundGeo = new THREE.ShapeGeometry(campGroundShape);
    campGroundGeo.rotateX(-Math.PI / 2);
    const campGroundMesh = new THREE.Mesh(campGroundGeo, earthPathMat);
    campGroundMesh.position.set(-15, 0.015, 24);
    campGroundMesh.receiveShadow = true;
    this.group.add(campGroundMesh);

    // 从南岸沙滩通向营地的蜿蜒海岛天然踏石路 (Stepping Stones)
    const stonePositions = [
      { x: -10.0, z: 36.8, scale: 0.68, rot: 0.2 },
      { x: -10.3, z: 34.6, scale: 0.74, rot: -0.4 },
      { x: -10.8, z: 32.4, scale: 0.65, rot: 0.8 },
      { x: -11.2, z: 30.2, scale: 0.72, rot: -0.1 },
      { x: -11.8, z: 28.0, scale: 0.78, rot: 0.5 },
      { x: -12.6, z: 26.0, scale: 0.82, rot: -0.3 },
      { x: -13.8, z: 24.8, scale: 0.75, rot: 0.2 }
    ];

    stonePositions.forEach((st, idx) => {
      // 每一枚踏石拥有轻微厚度与自然倒角，稳实嵌入草皮
      const stoneGeo = new THREE.CylinderGeometry(0.55 * st.scale, 0.65 * st.scale, 0.06, 9);
      stoneGeo.scale(1.2, 1.0, 0.9);
      const stoneMesh = new THREE.Mesh(stoneGeo, stoneStepMat);
      stoneMesh.position.set(st.x, 0.03, st.z);
      stoneMesh.rotation.y = st.rot;
      stoneMesh.receiveShadow = true;
      stoneMesh.castShadow = true;
      this.group.add(stoneMesh);

      // 石阶周围微小的踩踏深色泥迹
      const soilShape = new THREE.Shape();
      for (let s = 0; s < 10; s++) {
        const a = (s / 10) * Math.PI * 2;
        const r = (0.75 + Math.sin(s * 2.1) * 0.15) * st.scale;
        const sx = Math.cos(a) * r * 1.3;
        const sz = Math.sin(a) * r;
        if (s === 0) soilShape.moveTo(sx, sz); else soilShape.lineTo(sx, sz);
      }
      soilShape.closePath();
      const soilGeo = new THREE.ShapeGeometry(soilShape);
      soilGeo.rotateX(-Math.PI / 2);
      const soilMesh = new THREE.Mesh(soilGeo, earthPathMat);
      soilMesh.position.set(st.x, 0.016, st.z);
      soilMesh.receiveShadow = true;
      this.group.add(soilMesh);
    });

    // 沿途零星点缀的风化散碎小卵石
    const pebbles = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.12, 1),
      new THREE.MeshStandardMaterial({ color: 0x928a7c, roughness: 0.9 }), 30
    );
    const dummy = new THREE.Object3D();
    const clusters = [[-7, 36], [-14, 34], [-8, 29], [-16, 26], [-9, 22]];
    for (let i = 0; i < 30; i++) {
      const center = clusters[Math.floor(i / 6)];
      dummy.position.set(center[0] + Math.sin(i * 2.4) * 0.9, 0.05, center[1] + Math.cos(i * 1.8) * 0.7);
      dummy.rotation.set(i * 0.4, i * 1.2, 0);
      dummy.scale.set(0.7 + (i % 3) * 0.25, 0.45, 0.85);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
    }
    pebbles.receiveShadow = true;
    this.group.add(pebbles);
  }

  createCastawayShore() {
    // 程序化水面在着色器内逐像素计算深浅渐变（同一岸线公式），不再使用顶点色
    if (this.waterMesh.material.userData.proceduralWater) return;
    const geometry = this.waterMesh.geometry;
    const position = geometry.attributes.position;
    const colors = [];
    const deep = new THREE.Color(0x228cae);
    const shallow = new THREE.Color(0x78d6ca);
    const tint = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = Math.abs(position.getX(i));
      const z = Math.abs(position.getZ(i));
      const distance = Math.hypot(Math.max(x - 36, 0), Math.max(z - 29, 0)) - 13;
      const blend = 1 - THREE.MathUtils.smoothstep(distance, 0, 18);
      tint.copy(deep).lerp(shallow, blend);
      colors.push(tint.r, tint.g, tint.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.waterMesh.material.color.set(0xffffff);
    this.waterMesh.material.vertexColors = true;
    this.waterMesh.material.needsUpdate = true;
  }

  // 0. 天青渐变天空半球 (Sky Dome)
  createSkyDome() {
    const skyGeo = new THREE.SphereGeometry(320, 32, 16);
    skyGeo.scale(-1, 1, 1);

    // 顶点着色器绘制天青到地平线水青的温润渐变
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `;
    const uniforms = {
      topColor: { value: new THREE.Color(0x3eaaf8) },    // 天顶明媚宝蓝
      bottomColor: { value: new THREE.Color(0xd7f3fc) }, // 地平线奶白水青
      offset: { value: 15 },
      exponent: { value: 0.65 }
    };
    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.BackSide,
      depthWrite: false
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);
  }

  loadTex(url) {
    const tex = this.texLoader.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 为任意网格按世界真实米制坐标投影 UV，消除挤出与倒角拉伸
  applyPlanarUV(geometry, metersPerTile = 5.0) {
    geometry.computeBoundingBox();
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      uv.setXY(i, x / metersPerTile, z / metersPerTile);
    }
    uv.needsUpdate = true;
  }

  // 1. 海岛双层清亮海浪与动态微波
  createOcean() {
    const waterGeo = new THREE.PlaneGeometry(420, 420, 64, 64);
    waterGeo.rotateX(-Math.PI / 2);

    // 程序化流动水面：正弦叠加波纹法线 + 深浅水渐变 + 菲涅尔天空反射 + PBR 太阳高光（无外部贴图）
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.0,
      transparent: true,
      opacity: 0.86
    });
    waterMat.userData.proceduralWater = true;
    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1a7ea6) },
      uShallow: { value: new THREE.Color(0x72d8cb) },
      uSkyColor: { value: new THREE.Color(0xbfe6f5) },
      uWaveStrength: { value: 0.15 } // 法线扰动强度（原 0.2）；调平静就再降
    };
    const waveOctaves = Math.max(1, Math.min(3, this.quality.waveOctaves || 2)); // 低1/中2/高3 层
    waterMat.customProgramCacheKey = () => 'castaway-water-' + waveOctaves;
    waterMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.waterUniforms);
      shader.defines = shader.defines || {};
      shader.defines.WAVE_OCTAVES = waveOctaves;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSkyColor;
uniform float uWaveStrength;
varying vec3 vWaterWorld;

// 浅滩折射动态焦散水光 (Water Caustics)
float calcWaterCaustics(vec2 p, float t) {
  vec2 p1 = p * 0.38 + vec2(t * 0.18, -t * 0.14);
  vec2 p2 = p * 0.42 - vec2(-t * 0.15, t * 0.20);
  float c1 = sin(p1.x * 2.8 + sin(p1.y * 2.4 + t * 0.75)) + cos(p1.y * 2.8 + cos(p1.x * 2.4 - t * 0.75));
  float c2 = sin(p2.x * 2.6 - cos(p2.y * 2.2 - t * 0.65)) + cos(p2.y * 2.6 + sin(p2.x * 2.2 + t * 0.65));
  return pow(clamp((c1 + c2) * 0.25 + 0.5, 0.0, 1.0), 3.2);
}

// 高度场 h = Σ a·sin(f·dot(p,d) + ωt) 的解析梯度
vec2 waterGrad(vec2 p, float t) {
  // 大块柔和涌浪：f 为空间频率（波长 = 2π/f 米），越小波越大越稀
  p += 1.2 * vec2(sin(p.y * 0.08 + t * 0.15), cos(p.x * 0.07 - t * 0.12));
  vec2 g = vec2(0.0);
  vec2 d; float f; float a;
  d = vec2(0.94, 0.34); f = 0.22; a = 0.55; g += d * f * a * cos(dot(p, d) * f + t * 0.70);
#if WAVE_OCTAVES > 1
  d = vec2(-0.57, 0.82); f = 0.50; a = 0.25; g += d * f * a * cos(dot(p, d) * f + t * 1.05);
#endif
#if WAVE_OCTAVES > 2
  d = vec2(0.20, -0.98); f = 1.05; a = 0.10; g += d * f * a * cos(dot(p, d) * f + t * 1.50);
#endif
  return g;
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
vec2 waterAx = abs(vWaterWorld.xz);
float shoreD = length(max(waterAx - vec2(36.0, 29.0), 0.0)) - 13.0;
float shallowMix = 1.0 - smoothstep(0.0, 18.0, shoreD);
float lagoonMix = 1.0 - smoothstep(-2.0, 6.0, shoreD);
vec3 waterCol = mix(uDeep, uShallow, shallowMix);
waterCol = mix(waterCol, uShallow * 1.15, lagoonMix * 0.45);

// 浅滩与岸边游动焦散水斑 (马尔代夫级清澈透亮水下光斑，深度短路避免深海无谓计算)
float causticsMask = shallowMix * (1.0 - smoothstep(6.0, 24.0, shoreD));
if (causticsMask > 0.02) {
  float caustics = calcWaterCaustics(vWaterWorld.xz, uTime);
  vec3 causticsTint = vec3(0.95, 1.0, 0.98);
  waterCol += causticsTint * caustics * (0.35 * causticsMask);
}

diffuseColor.rgb *= waterCol;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec2 waterG = waterGrad(vWaterWorld.xz, uTime) * uWaveStrength;
float waterViewDist = length(vWaterWorld - cameraPosition);
waterG *= 1.0 - smoothstep(40.0, 140.0, waterViewDist) * 0.8;
vec3 waterNw = normalize(vec3(-waterG.x, 1.0, -waterG.y));
normal = normalize((viewMatrix * vec4(waterNw, 0.0)).xyz);`)
        .replace('#include <opaque_fragment>', `float waterFres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 5.0);
waterFres = mix(0.03, 1.0, waterFres);
outgoingLight = mix(outgoingLight, uSkyColor, waterFres * 0.2); // 风格化：保留热带海蓝，远处只适度泛天光
diffuseColor.a = mix(diffuseColor.a, 1.0, waterFres * 0.5);
diffuseColor.a *= mix(1.0, 0.85, lagoonMix);
#include <opaque_fragment>`);
    };

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = -0.36;
    this.waterMesh.receiveShadow = true;
    this.group.add(this.waterMesh);

    // 动态波光浮层：移动端直接剔除 420m 巨大半透明双层 Overdraw，水面更纯净透亮且大幅降低显存带宽
    if (!this.quality || this.quality.pixelRatioCap > 1.25) {
      const foamTex = this.waterTex.clone();
      foamTex.repeat.set(20, 20);
      const foamMat = new THREE.MeshBasicMaterial({
        map: foamTex,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      });
      this.foamMesh = new THREE.Mesh(waterGeo, foamMat);
      this.foamMesh.position.y = -0.33;
      this.group.add(this.foamMesh);
    }
  }

  // 1.5 海岛海滩专属：环岛动态拍岸白色微浪碎花带 (Shoreline White Foam Strip)
  createShoreFoam() {
    const shape = islandShape(50.2, 43.2);
    shape.holes.push(new THREE.Path(islandOutline(49.4, 42.4).reverse()));

    const foamGeo = new THREE.ShapeGeometry(shape);
    foamGeo.rotateX(-Math.PI / 2);

    const shoreFoamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.shoreFoamMesh = new THREE.Mesh(foamGeo, shoreFoamMat);
    this.shoreFoamMesh.position.y = -0.32;
    this.group.add(this.shoreFoamMesh);

    // 外圈柔和回卷浪沫（与内圈反相呼吸，沿用同一岛屿轮廓，不改变岸线坐标）
    const outerShape = islandShape(51.8, 44.6);
    outerShape.holes.push(new THREE.Path(islandOutline(50.2, 43.2).reverse()));
    const outerGeo = new THREE.ShapeGeometry(outerShape);
    outerGeo.rotateX(-Math.PI / 2);
    this.shoreFoamOuter = new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({
      color: 0xf4fbff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    this.shoreFoamOuter.position.y = -0.335;
    this.group.add(this.shoreFoamOuter);
  }

  // 2. 特色生态三角草皮主岛 (按 4 米贴图无缝平铺，还原热带海岛清新三角纹)
  createIslandBase() {
    const shape = islandShape(45, 38);

    const geom = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: 1.4,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 0.6,
      bevelSegments: 4
    });
    geom.rotateX(Math.PI / 2);
    geom.computeBoundingBox();
    geom.translate(0, -geom.boundingBox.max.y, 0);

    // 热带海岛三角纹比例：按 7.0 米黄金尺度平铺，既凸显经典三角形，又无高频刺眼网格
    this.applyPlanarUV(geom, 7.0);

    const grassMat = new THREE.MeshStandardMaterial({
      map: this.grassTex,
      color: 0x82b85a, // 温润清透的翡翠草地基底，摒弃泛白荧光黄
      roughness: 0.88, // 提高粗糙度，避免镜面高光带来的塑料反光
      metalness: 0.0
    });
    // 世界坐标驱动低频色差和南岸草沙过渡，沿用标准光照及阴影。
    grassMat.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vGroundPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = 'varying vec3 vGroundPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        // 自然大地双频色块起伏 (大尺度温和冷暖 + 小尺度青润斑驳)
        float lowFreq = sin(vGroundPosition.x * 0.12) * cos(vGroundPosition.z * 0.14);
        float midFreq = sin(vGroundPosition.x * 0.32 + 1.2) * sin(vGroundPosition.z * 0.28);
        vec3 grassLush = vec3(0.24, 0.45, 0.16);
        vec3 grassSunny = vec3(0.38, 0.56, 0.22);
        vec3 baseGrass = mix(grassLush, grassSunny, 0.5 + lowFreq * 0.35);
        diffuseColor.rgb = mix(diffuseColor.rgb, baseGrass, 0.32);
        diffuseColor.rgb *= 0.94 + midFreq * 0.08;

        // 营地火塘周围泥草交融踏平质感 (Campfire trodden earth footprint)
        float campDist = length(vec2((vGroundPosition.x + 15.0) * 0.85, (vGroundPosition.z - 24.0) * 1.1));
        float campBlend = 1.0 - smoothstep(2.8, 5.2, campDist);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.48, 0.40, 0.28), campBlend * 0.42);

        // 海岸与月牙湾南侧草沙自然渐变
        float bay = exp(-pow((vGroundPosition.x + 10.0) / 13.0, 2.0));
        float edge = 37.8 - bay * 2.2 + sin(vGroundPosition.x * 0.65) * 0.45 + cos(vGroundPosition.z * 0.8) * 0.25;
        float sandBlend = smoothstep(edge - 1.8, edge + 0.25, vGroundPosition.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.68, 0.48), sandBlend);
      `);
    };
    grassMat.customProgramCacheKey = () => 'castaway-grass-shore-v2';

    const islandMesh = new THREE.Mesh(geom, grassMat);
    islandMesh.position.set(0, 0, 0);
    islandMesh.userData.walkSurface = true;
    islandMesh.receiveShadow = true;
    this.group.add(islandMesh);
  }

  // 3. 温暖金黄细沙滩 (按 5 米贴图平铺)
  createBeach() {
    const shape = islandShape(49, 42);

    const geom = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: 0.8,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.5,
      bevelSegments: 3
    });
    geom.rotateX(Math.PI / 2);
    geom.computeBoundingBox();
    geom.translate(0, -geom.boundingBox.max.y - 0.15, 0);

    this.applyPlanarUV(geom, 5.0);

    const sandMat = new THREE.MeshStandardMaterial({
      map: this.sandTex,
      color: 0xecd7ab,
      roughness: 0.92,
      metalness: 0.01
    });

    const beachMesh = new THREE.Mesh(geom, sandMat);
    beachMesh.position.set(0, 0, 0);
    beachMesh.userData.walkSurface = true;
    beachMesh.receiveShadow = true;
    this.group.add(beachMesh);
  }

  // 3.5 海岛标志性海边天然礁石群 (Rocky Shore Outcrops)
  createRockyShores() {
    const rockMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x8a847a, // 质朴海石青灰
      roughness: 0.88,
      metalness: 0.05
    });

    const rockClusters = [
      // 东南角海滨突出巨礁
      { x: 38, z: 32, scale: 3.5 },
      { x: 41, z: 34, scale: 2.8 },
      { x: 36, z: 35, scale: 2.2 },
      // 西北角天然石滩
      { x: -40, z: -30, scale: 3.2 },
      { x: -43, z: -27, scale: 2.6 },
      { x: -38, z: -33, scale: 2.0 },
      // 东北角悬崖外侧礁石
      { x: 42, z: -25, scale: 3.8 }
    ];

    rockClusters.forEach(rc => {
      const rockGeo = new THREE.DodecahedronGeometry(rc.scale, 1);
      // 扁平化模拟自然海蚀礁石
      rockGeo.scale(1.2, 0.55, 1.0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rc.x, -0.1, rc.z);
      rock.rotation.y = Math.random() * Math.PI;
      rock.userData.movementRadius = rc.scale * 1.2;
      rock.receiveShadow = true;
      rock.castShadow = true;
      this.group.add(rock);
    });
  }

  // 3.8 西北神秘海蚀洞穴与天然海蚀岩拱门 (Northwest Sea Cave & Natural Arch)
  // 严格对齐海岛规划图：西北月牙湾浅滩交界处的天然岩石拱门，以及依山而建的神秘避风洞窟
  createNorthwestSeaCaveAndArch() {
    const rockMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x9b9080, // 自然风化暖海石色
      roughness: 0.88,
      metalness: 0.05
    });
    const darkRockMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x6e685f, // 潮湿阴凉背光洞壁
      roughness: 0.92,
      metalness: 0.02
    });
    const vineMat = new THREE.MeshStandardMaterial({
      map: this.grassTex,
      color: 0x4d8a28, // 拱顶垂挂热带藤蔓
      roughness: 0.75
    });

    // A. 月牙湾前沿天然海蚀岩拱门 (Natural Sea Arch，跨立在 X:-24.5, Z:-26.5 潮间浅滩)
    const archGroup = new THREE.Group();
    archGroup.position.set(-24.5, 0, -26.5);
    archGroup.rotation.y = 0.52; // 顺应月牙湾海岸线自然倾斜约 30 度

    // 左右风化石柱 (高 3.8 米，净通道间隙宽 3.4 米)
    const pillarGeo = new THREE.CylinderGeometry(0.75, 1.05, 3.8, 7);
    pillarGeo.translate(0, 1.9, 0);

    const leftPillar = new THREE.Mesh(pillarGeo, rockMat);
    leftPillar.position.set(-2.1, -0.15, 0);
    leftPillar.rotation.z = 0.08; // 向内侧微倾
    leftPillar.userData.movementRadius = 1.35;
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    archGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, rockMat);
    rightPillar.position.set(2.1, -0.15, 0);
    rightPillar.rotation.z = -0.08; // 向内侧微倾
    rightPillar.userData.movementRadius = 1.35;
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    archGroup.add(rightPillar);

    // 拱门顶部横跨巨石梁 (厚度 1.1 米，拱顶跨度 5.2 米)
    const lintelGeo = new THREE.BoxGeometry(5.4, 1.15, 1.8);
    this.applyPlanarUV(lintelGeo, 3.0);
    const lintelMesh = new THREE.Mesh(lintelGeo, rockMat);
    lintelMesh.position.set(0, 4.0, 0);
    lintelMesh.userData.walkSurface = true;
    lintelMesh.castShadow = true;
    lintelMesh.receiveShadow = true;
    archGroup.add(lintelMesh);

    // 拱门顶部倒悬藤蔓装饰
    for (let v = 0; v < 4; v++) {
      const vineGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.4 + v * 0.2, 5);
      const vine = new THREE.Mesh(vineGeo, vineMat);
      vine.position.set(-1.4 + v * 0.9, 3.2 - (1.4 + v * 0.2) * 0.5, (v % 2 === 0 ? 0.35 : -0.35));
      vine.castShadow = true;
      archGroup.add(vine);
    }

    this.group.add(archGroup);

    // B. 神秘天然海蚀洞窟 (Sea Cave，背靠西北山岩，洞口朝向东南月牙沙滩)
    const caveGroup = new THREE.Group();
    caveGroup.position.set(-30.5, 0, -21.0);
    caveGroup.rotation.y = 0.48; // 正对月牙湾沙滩中心

    // 洞穴平整沙石地面 (玩家可走入洞穴内避雨休息)
    const caveFloorGeo = new THREE.PlaneGeometry(6.4, 7.2);
    caveFloorGeo.rotateX(-Math.PI / 2);
    const caveFloor = new THREE.Mesh(caveFloorGeo, new THREE.MeshStandardMaterial({
      map: this.sandTex,
      color: 0xcdba98,
      roughness: 0.95
    }));
    caveFloor.position.set(0, 0.015, -1.8);
    caveFloor.userData.walkSurface = true;
    caveFloor.receiveShadow = true;
    caveGroup.add(caveFloor);

    // 洞窟左侧厚重岩壁
    const wallGeoL = new THREE.BoxGeometry(1.6, 3.8, 7.5);
    this.applyPlanarUV(wallGeoL, 3.5);
    const wallL = new THREE.Mesh(wallGeoL, darkRockMat);
    wallL.position.set(-3.2, 1.8, -1.8);
    wallL.rotation.y = 0.05;
    wallL.userData.movementRadius = 1.6;
    wallL.castShadow = true;
    wallL.receiveShadow = true;
    caveGroup.add(wallL);

    // 洞窟右侧厚重岩壁
    const wallGeoR = new THREE.BoxGeometry(1.6, 3.8, 7.5);
    this.applyPlanarUV(wallGeoR, 3.5);
    const wallR = new THREE.Mesh(wallGeoR, darkRockMat);
    wallR.position.set(3.2, 1.8, -1.8);
    wallR.rotation.y = -0.05;
    wallR.userData.movementRadius = 1.6;
    wallR.castShadow = true;
    wallR.receiveShadow = true;
    caveGroup.add(wallR);

    // 洞窟后方深邃封底山壁
    const wallGeoBack = new THREE.BoxGeometry(7.8, 4.0, 1.8);
    this.applyPlanarUV(wallGeoBack, 3.5);
    const wallBack = new THREE.Mesh(wallGeoBack, darkRockMat);
    wallBack.position.set(0, 1.9, -5.4);
    wallBack.userData.movementRadius = 2.0;
    wallBack.castShadow = true;
    wallBack.receiveShadow = true;
    caveGroup.add(wallBack);

    // 洞顶半圆拱顶岩穹 (Cylindrical Arch Roof)
    const roofGeo = new THREE.CylinderGeometry(3.6, 3.9, 7.6, 9, 1, false, 0, Math.PI);
    roofGeo.rotateZ(-Math.PI / 2);
    roofGeo.rotateY(Math.PI / 2);
    this.applyPlanarUV(roofGeo, 4.0);
    const roofMesh = new THREE.Mesh(roofGeo, rockMat);
    roofMesh.position.set(0, 3.4, -1.8);
    roofMesh.userData.walkSurface = true;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    caveGroup.add(roofMesh);

    // 洞顶钟乳垂石
    const stalactiteGeo = new THREE.ConeGeometry(0.28, 1.2, 6);
    stalactiteGeo.rotateX(Math.PI); // 倒垂
    const stalactiteMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x827c73,
      roughness: 0.9
    });
    const stalactitePositions = [
      [-1.2, 3.0, -1.5],
      [1.4, 2.9, -2.8],
      [-0.4, 3.1, -4.0],
      [1.1, 2.8, -4.5]
    ];
    stalactitePositions.forEach(([sx, sy, sz]) => {
      const st = new THREE.Mesh(stalactiteGeo, stalactiteMat);
      st.position.set(sx, sy, sz);
      st.castShadow = true;
      caveGroup.add(st);
    });

    // 洞穴深处神秘发光莹石 (Ancient Luminescent Crystal) - 带来神秘探索感
    const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
    crystalGeo.scale(0.8, 1.5, 0.8);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x48d1cc, // 碧海莹蓝
      emissive: 0x1f7a75,
      roughness: 0.2,
      metalness: 0.1
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 0.45, -4.6);
    crystal.castShadow = true;
    caveGroup.add(crystal);

    // 洞窟内幽蓝探险微光
    const caveLight = new THREE.PointLight(0x40e0d0, 1.4, 8.5);
    caveLight.position.set(0, 1.2, -4.2);
    caveGroup.add(caveLight);

    this.group.add(caveGroup);
  }

  // 4. 第二层高地悬崖平台 (热带海岛双材质：顶面草坪 + 侧壁自然暖棕岩层)
  createCliffs() {
    const cliffShape = new THREE.Shape();
    // 带有自然阶梯凹凸感的海岛高台轮廓
    cliffShape.moveTo(10, -32);
    cliffShape.lineTo(38, -32);
    cliffShape.quadraticCurveTo(40, -32, 40, -30);
    cliffShape.lineTo(40, -12);
    cliffShape.quadraticCurveTo(40, -10, 38, -10);
    cliffShape.lineTo(24, -10);
    cliffShape.quadraticCurveTo(22, -10, 22, -12);
    cliffShape.lineTo(12, -12);
    cliffShape.quadraticCurveTo(10, -14, 10, -16);
    cliffShape.lineTo(10, -32);

    const geom = new THREE.ExtrudeGeometry(cliffShape, {
      steps: 1,
      depth: 2.0,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.45,
      bevelSegments: 3
    });
    geom.rotateX(Math.PI / 2);
    geom.computeBoundingBox();
    geom.translate(0, -geom.boundingBox.max.y + 1.8, 0);

    this.applyPlanarUV(geom, 7.0);

    // 热带海岛顶面草坪与侧壁岩层分层材质
    const topMat = new THREE.MeshStandardMaterial({
      map: this.grassTex,
      color: 0xffffff,
      roughness: 0.72
    });
    const sideMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0xb58e65, // 质朴暖棕岩土崖壁
      roughness: 0.88
    });

    const cliff = new THREE.Mesh(geom, [topMat, sideMat]);
    cliff.position.set(0, 0, 0);
    cliff.userData.walkSurface = true;
    cliff.receiveShadow = true;
    cliff.castShadow = true;
    this.group.add(cliff);

    // 海岛标志性原生态原木斜道阶梯 (Natural Log Incline)
    const inclineGroup = new THREE.Group();
    // X=18处南沿退至Z=-12，六级阶梯有足够长度抬升到高台。
    // 原X=23处崖壁从Z=-10开始，会在阶梯中段形成不可跨越落差。
    inclineGroup.position.set(18, 0, -8.8);

    const logMat = new THREE.MeshStandardMaterial({
      map: this.planksTex,
      color: 0x9e6938,
      roughness: 0.75
    });

    // 6 级原木阶梯踏板向北自然抬升
    for (let s = 0; s < 6; s++) {
      const stepGeo = new THREE.BoxGeometry(3.6, 0.32, 0.95);
      const stepMesh = new THREE.Mesh(stepGeo, logMat);
      stepMesh.position.set(0, s * 0.3 + 0.16, -s * 0.75);
      stepMesh.userData.walkSurface = true;
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      inclineGroup.add(stepMesh);
    }

    // 阶梯两侧原木立柱与向北倾斜的扶手
    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.2, 8);
    const railGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.8, 8);
    railGeo.rotateX(-0.38); // 向北上方自然倾斜

    for (const side of [-1.85, 1.85]) {
      // 南侧起点立柱
      const postBot = new THREE.Mesh(postGeo, logMat);
      postBot.position.set(side, 0.6, 0.4);
      postBot.castShadow = true;
      inclineGroup.add(postBot);

      // 北侧高台接驳立柱
      const postTop = new THREE.Mesh(postGeo, logMat);
      postTop.position.set(side, 2.1, -4.2);
      postTop.castShadow = true;
      inclineGroup.add(postTop);

      // 贯穿斜扶手
      const rail = new THREE.Mesh(railGeo, logMat);
      rail.position.set(side, 1.35, -1.9);
      rail.castShadow = true;
      inclineGroup.add(rail);
    }

    this.group.add(inclineGroup);

    // 热带海岛高台木栅栏防护带 (Log Fencing along Cliff Edge)
    this.createCliffFences();
  }

  // 4.5 高台原木护栏 (沿悬崖南侧与西侧边缘设立质朴白木栅栏)
  createCliffFences() {
    const fenceMat = new THREE.MeshStandardMaterial({
      map: this.planksTex,
      color: 0xc89660,
      roughness: 0.8
    });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.85, 6);
    const railGeo = new THREE.BoxGeometry(1.8, 0.08, 0.06);

    // 沿悬崖南边缘 (X: 12 ~ 21, Z: -12.2) 放置 5 组木护栏
    for (let x = 12.0; x <= 20.0; x += 1.8) {
      const post = new THREE.Mesh(postGeo, fenceMat);
      post.position.set(x, 1.8 + 0.42, -12.1);
      post.castShadow = true;
      this.group.add(post);

      const rail1 = new THREE.Mesh(railGeo, fenceMat);
      rail1.position.set(x + 0.9, 1.8 + 0.55, -12.1);
      this.group.add(rail1);

      const rail2 = new THREE.Mesh(railGeo, fenceMat);
      rail2.position.set(x + 0.9, 1.8 + 0.25, -12.1);
      this.group.add(rail2);
    }
  }

  // 4.6 东北高台悬崖飞瀑与山脚清泉水潭 (Cliffside Waterfall & Mountain Spring Pool)
  // 严格对齐规划图：全岛淡水生命线发源地，高台落差奔腾飞泻，汇入内陆小溪
  createWaterfallAndPool() {
    const waterfallGroup = new THREE.Group();
    waterfallGroup.position.set(11.5, 0, -12.0);

    // 1. 悬崖飞瀑垂直倾泻水帘 (曲面微拱瀑布)
    const fallGeo = new THREE.PlaneGeometry(2.8, 2.15, 6, 8);
    fallGeo.translate(0, 1.05, 0); // 底部对齐地面 Y=0，顶部对齐崖顶 Y=2.1

    // 给瀑布顶点微弯微凸，模拟真实瀑布水流冲出崖边的抛物弧度
    const fallPos = fallGeo.attributes.position;
    for (let i = 0; i < fallPos.count; i++) {
      const y = fallPos.getY(i);
      const ratio = y / 2.15; // 0 ~ 1
      // 崖顶水流向外喷涌 0.25 米抛物线
      const zOffset = Math.sin(ratio * Math.PI) * 0.28 + (1.0 - ratio) * 0.08;
      fallPos.setZ(i, fallPos.getZ(i) + zOffset);
    }
    fallGeo.computeVertexNormals();

    // 程序化瀑布水帘：向下流动的竖向条纹 + 崖顶汇入与底部泛白（见 FreshwaterMaterials.js）
    const flowShared = { quality: this.quality, uTime: this.waterUniforms && this.waterUniforms.uTime, uSkyColor: this.waterUniforms && this.waterUniforms.uSkyColor };
    const fallMat = createFlowMaterial('fall', { ...flowShared, side: THREE.DoubleSide });

    this.waterfallMesh = new THREE.Mesh(fallGeo, fallMat);
    this.waterfallMesh.receiveShadow = true;
    waterfallGroup.add(this.waterfallMesh);

    // 2. 悬崖出水口两侧分水抱石 (Guiding Rocks at Cliff Lip)
    const lipRockGeo = new THREE.DodecahedronGeometry(0.7, 1);
    lipRockGeo.scale(1.2, 0.8, 1.0);
    const lipRockMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x7c7365,
      roughness: 0.88
    });
    const rockL = new THREE.Mesh(lipRockGeo, lipRockMat);
    rockL.position.set(-1.6, 1.85, 0.2);
    rockL.castShadow = true;
    waterfallGroup.add(rockL);

    const rockR = new THREE.Mesh(lipRockGeo, lipRockMat);
    rockR.position.set(1.6, 1.85, 0.2);
    rockR.castShadow = true;
    waterfallGroup.add(rockR);

    // 3. 山脚瀑布溅落泉潭 (Splash Pool，直径约 4.5 米的清澈天然水潭)
    const poolGeo = new THREE.CircleGeometry(2.4, 24);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = createFlowMaterial('pool', flowShared); // 落点向外扩散的稀疏涟漪
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.position.set(0, 0.025, 1.4);
    poolMesh.receiveShadow = true;
    waterfallGroup.add(poolMesh);

    // 4. 瀑布落水飞溅的激流白色泡沫与水雾光晕 (Waterfall Spray Foam)
    const foamCircleGeo = new THREE.RingGeometry(0.3, 1.8, 16);
    foamCircleGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    this.waterfallFoam = new THREE.Mesh(foamCircleGeo, foamMat);
    this.waterfallFoam.position.set(0, 0.03, 0.6);
    waterfallGroup.add(this.waterfallFoam);

    // 4.5 崖顶汇流水面（纯视觉，位于高台顶面 Y=1.8 之上 4 厘米，向南流向崖边）
    const inflowGeo = new THREE.PlaneGeometry(1.6, 1.2, 1, 1);
    inflowGeo.rotateX(-Math.PI / 2);
    this.waterfallInflow = new THREE.Mesh(inflowGeo, createFlowMaterial('stream', flowShared));
    this.waterfallInflow.position.set(0.6, 1.84, -0.9);
    waterfallGroup.add(this.waterfallInflow);

    // 4.6 落点水雾柔光粒子（低档关闭，中档 18 个，高档 32 个）
    this.waterfallMist = createMistPoints(this.quality);
    if (this.waterfallMist) waterfallGroup.add(this.waterfallMist);

    // 5. 环绕泉潭的自然溪卵石 (Riverbank Boulders around Spring)
    const pebbleGeo = new THREE.DodecahedronGeometry(0.38, 1);
    for (let p = 0; p < 10; p++) {
      const angle = (p / 10) * Math.PI * 1.3 - 0.2; // 围成向南敞开的马蹄形石潭
      const px = Math.cos(angle) * 2.5;
      const pz = Math.sin(angle) * 2.2 + 1.2;
      const pb = new THREE.Mesh(pebbleGeo, lipRockMat);
      pb.position.set(px, 0.1, pz);
      pb.rotation.y = Math.random() * Math.PI;
      pb.scale.set(0.9 + Math.random() * 0.4, 0.7, 0.9 + Math.random() * 0.4);
      pb.castShadow = true;
      pb.receiveShadow = true;
      waterfallGroup.add(pb);
    }

    this.group.add(waterfallGroup);
  }

  // 4.8 热带海岛内岛清澈小溪与跨河原木拱桥 (Meandering River & Log Bridge)
  createRiverAndBridge() {
    // 蜿蜒溪流水面 (自悬崖山脚下自然流出，一路向南蜿蜒注入大海)
    const riverPoints = [
      new THREE.Vector2(11.5, -12.0),
      new THREE.Vector2(13.2, -4.0),
      new THREE.Vector2(14.5, 4.0),
      new THREE.Vector2(14.2, 12.0),
      new THREE.Vector2(15.8, 20.0),
      new THREE.Vector2(16.5, 28.0),
      new THREE.Vector2(17.0, 36.0)
    ];

    // 水道宽度约 3.8 米，构建自然带状水面网格
    const riverGeo = new THREE.PlaneGeometry(3.6, 50, 4, 32);
    riverGeo.rotateX(-Math.PI / 2);

    const pos = riverGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      // 根据 Z 坐标拟合自然弯曲的 X 偏移
      const progress = (z + 14) / 50.0; // 0 ~ 1
      const curveX = 13.5 + Math.sin(progress * Math.PI * 1.8) * 2.2;
      pos.setX(i, pos.getX(i) + curveX);
    }
    riverGeo.computeVertexNormals();

    // 程序化溪水：沿 +Z 下游流动的拉伸大块波纹、岸边浅色与泡沫、轻微天光反射（几何与位置不变）
    const riverMat = createFlowMaterial('stream', {
      quality: this.quality,
      uTime: this.waterUniforms && this.waterUniforms.uTime,
      uSkyColor: this.waterUniforms && this.waterUniforms.uSkyColor
    });

    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.position.y = 0.02; // 清亮小溪平铺在草坪河道之上
    riverMesh.receiveShadow = true;
    this.group.add(riverMesh);

    // 两岸自然河石 (River Stones)
    const rStoneGeo = new THREE.DodecahedronGeometry(0.35, 1);
    rStoneGeo.scale(1.2, 0.6, 1.0);
    const rStoneMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0x9c9488,
      roughness: 0.85
    });

    for (let rz = -10; rz <= 32; rz += 3.5) {
      const progress = (rz + 14) / 50.0;
      const midX = 13.5 + Math.sin(progress * Math.PI * 1.8) * 2.2;
      // 左岸与右岸
      for (const sign of [-1, 1]) {
        const stone = new THREE.Mesh(rStoneGeo, rStoneMat);
        const sx = midX + sign * (2.1 + (Math.random() - 0.5) * 0.4);
        stone.position.set(sx, 0.02, rz + (Math.random() - 0.5) * 1.0);
        stone.rotation.y = Math.random() * Math.PI;
        stone.receiveShadow = true;
        this.group.add(stone);
      }
    }

    // 特色生态跨河原木拱桥 (Log Bridge，位于 Z=4 核心视野)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(14.5, 0, 4.0);

    const bridgeMat = new THREE.MeshStandardMaterial({
      map: this.planksTex,
      color: 0x966133, // 温暖原木色
      roughness: 0.72
    });

    // 优雅微拱形桥面 (6 根紧密相依的粗圆木横排构成桥面)
    const bridgeLogs = 9;
    const bridgeLength = 5.4;
    for (let b = 0; b < bridgeLogs; b++) {
      const ratio = (b / (bridgeLogs - 1)) * 2.0 - 1.0; // -1 ~ 1
      const archY = Math.cos(ratio * (Math.PI / 2.5)) * 0.28 + 0.12; // 0.28m 黄金微拱弧度
      const logG = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 8);
      logG.rotateZ(Math.PI / 2); // 横放
      const logM = new THREE.Mesh(logG, bridgeMat);
      logM.position.set(ratio * (bridgeLength * 0.5), archY, 0);
      logM.receiveShadow = true;
      logM.castShadow = true;
      bridgeGroup.add(logM);
    }

    // 两侧原木安全扶手与圆木桥墩
    const bPostGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.95, 8);
    const bRailGeo = new THREE.CylinderGeometry(0.09, 0.09, bridgeLength + 0.4, 8);
    bRailGeo.rotateZ(Math.PI / 2);

    for (const zSide of [-1.55, 1.55]) {
      // 桥头桥尾四根粗壮原木立柱
      for (const xSide of [-bridgeLength * 0.48, bridgeLength * 0.48]) {
        const post = new THREE.Mesh(bPostGeo, bridgeMat);
        post.position.set(xSide, 0.65, zSide);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
      // 贯穿微拱扶手
      const rail = new THREE.Mesh(bRailGeo, bridgeMat);
      rail.position.set(0, 0.98, zSide);
      rail.castShadow = true;
      bridgeGroup.add(rail);
    }

    this.group.add(bridgeGroup);
  }

  // 5. 木栈桥码头 (原木纹理甲板)
  createPier() {
    const pierGeo = new THREE.BoxGeometry(6.5, 0.35, 18);
    this.applyPlanarUV(pierGeo, 3.5);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.planksTex,
      color: 0xc89660,
      roughness: 0.7,
      metalness: 0.08
    });
    const pier = new THREE.Mesh(pierGeo, woodMat);
    pier.position.fromArray(ISLAND_LAYOUT.pier);
    pier.userData.walkSurface = true;
    pier.receiveShadow = true;
    pier.castShadow = true;
    this.group.add(pier);

    for (let z = 30; z <= 46; z += 4) {
      for (const x of [-27, -21]) {
        const pylonGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.5, 8);
        const pylon = new THREE.Mesh(pylonGeo, woodMat);
        pylon.position.set(x, -1.2, z);
        pylon.castShadow = true;
        this.group.add(pylon);
      }
    }
  }

  // 6. 特色生态自然跳石步道与温馨营地铺砖 (彻底废除生硬大长条石板)
  createStonePaths() {
    const pMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: 0xeae0ca,
      roughness: 0.72
    });

    // 营地篝火暖心圆角原石广场
    const campShape = new THREE.Shape();
    const cw = 4.0, cl = 4.0, cr = 1.2;
    campShape.moveTo(-cw + cr, -cl);
    campShape.lineTo(cw - cr, -cl);
    campShape.quadraticCurveTo(cw, -cl, cw, -cl + cr);
    campShape.lineTo(cw, cl - cr);
    campShape.quadraticCurveTo(cw, cl, cw - cr, cl);
    campShape.lineTo(-cw + cr, cl);
    campShape.quadraticCurveTo(-cw, cl, -cw, cl - cr);
    campShape.lineTo(-cw, -cl + cr);
    campShape.quadraticCurveTo(-cw, -cl, -cw + cr, -cl);

    const campGeo = new THREE.ShapeGeometry(campShape);
    campGeo.rotateX(-Math.PI / 2);
    this.applyPlanarUV(campGeo, 3.2);

    const campPlaza = new THREE.Mesh(campGeo, pMat);
    campPlaza.position.set(ISLAND_LAYOUT.campfire[0], 0.012, ISLAND_LAYOUT.campfire[2]);
    campPlaza.receiveShadow = true;
    this.group.add(campPlaza);

    // 特色生态圆形/鹅卵石跳石踏步 (Stepping Stones)
    // 踏步1：从营地通往西侧帐篷
    const stoneGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.035, 12);
    stoneGeo.scale(1.2, 1.0, 0.9);

    const tentSteps = [
      { x: -9.5, z: -4.2, r: 0.3 },
      { x: -11.2, z: -5.1, r: -0.2 },
      { x: -13.0, z: -6.2, r: 0.5 },
      { x: -14.6, z: -7.2, r: 0.1 }
    ];

    // 踏步2：从中央广场自然蜿蜒通向南岸海滩的亲切小径（曲线错落，灵动自然）
    const beachSteps = [
      { x: -0.5, z: 8.0, r: 0.2 },
      { x: 0.4, z: 10.5, r: -0.4 },
      { x: -0.2, z: 13.2, r: 0.3 },
      { x: 0.6, z: 16.0, r: -0.1 },
      { x: -0.1, z: 19.0, r: 0.4 },
      { x: 0.8, z: 22.0, r: -0.3 },
      { x: 0.2, z: 25.0, r: 0.2 },
      { x: -0.5, z: 28.0, r: -0.2 }
    ];

    // 踏步3：通向东北高台斜道的探索石阶
    const cliffSteps = [
      { x: 8.0, z: -4.0, r: 0.1 },
      { x: 11.5, z: -5.0, r: -0.3 },
      { x: 15.0, z: -6.5, r: 0.4 },
      { x: 18.5, z: -7.8, r: -0.2 },
      { x: 21.5, z: -8.8, r: 0.2 }
    ];

    [...tentSteps, ...beachSteps, ...cliffSteps].forEach(step => {
      const stone = new THREE.Mesh(stoneGeo, pMat);
      stone.position.set(step.x, 0.018, step.z);
      stone.rotation.y = step.r;
      const s = 0.85 + Math.random() * 0.3;
      stone.scale.set(s, 1.0, s);
      stone.receiveShadow = true;
      this.group.add(stone);
    });
  }

  // 7. 热带海岛立体五瓣野花与生机草丛生态 (彻底取代生硬圆柱六面体)
  createWildflowersAndDecor() {
    const flowerPresets = [
      { petal: 0xffffff, core: 0xffd166, name: 'white' },
      { petal: 0xffa8ba, core: 0xffffff, name: 'pink' },
      { petal: 0xffcf44, core: 0xff8c1a, name: 'yellow' },
      { petal: 0x82d9f8, core: 0xffffff, name: 'cyan' },
      { petal: 0xff6b8b, core: 0xffd166, name: 'rose' }
    ];

    // 预创建花朵基础构件
    const coreGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const petalGeo = new THREE.SphereGeometry(0.12, 8, 8);
    petalGeo.scale(1.0, 0.35, 1.8); // 压扁拉长成天然花瓣形状

    const stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.22, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d7a22, roughness: 0.8 });

    const leafGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
    leafGeo.scale(1.2, 1.0, 0.4);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x489628, roughness: 0.7 });

    // 制作 5 种预设的标准花朵模板并批量复用
    const flowerTemplates = flowerPresets.map(preset => {
      const flowerGroup = new THREE.Group();

      // 花茎
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.11;
      flowerGroup.add(stem);

      // 基底绿叶
      const leafL = new THREE.Mesh(leafGeo, leafMat);
      leafL.position.set(0.08, 0.08, 0);
      leafL.rotation.z = -0.7;
      flowerGroup.add(leafL);

      const leafR = new THREE.Mesh(leafGeo, leafMat);
      leafR.position.set(-0.08, 0.08, 0);
      leafR.rotation.z = 0.7;
      flowerGroup.add(leafR);

      // 花蕊
      const cMat = new THREE.MeshStandardMaterial({
        color: preset.core,
        roughness: 0.5,
        emissive: new THREE.Color(preset.core).multiplyScalar(0.15)
      });
      const core = new THREE.Mesh(coreGeo, cMat);
      core.position.y = 0.23;
      flowerGroup.add(core);

      // 5 片圆润饱满的花瓣
      const pMat = new THREE.MeshStandardMaterial({
        color: preset.petal,
        roughness: 0.42,
        emissive: new THREE.Color(preset.petal).multiplyScalar(0.12)
      });

      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(petalGeo, pMat);
        petal.position.set(Math.sin(angle) * 0.14, 0.22, Math.cos(angle) * 0.14);
        petal.rotation.y = angle;
        petal.rotation.x = 0.28; // 花瓣向外微翘
        flowerGroup.add(petal);
      }

      flowerGroup.traverse(c => {
        if (c.isMesh) {
          // 微小低矮花瓣与花蕊无需向阴影贴图写入深度，减少 330+ 阴影 Draw Call
          c.castShadow = false;
          c.receiveShadow = true;
        }
      });
      return flowerGroup;
    });

    // 海岛三叶生机草丛模板 (Grass Tuft)
    const tuftGroup = new THREE.Group();
    const bladeGeo = new THREE.ConeGeometry(0.05, 0.32, 4);
    bladeGeo.scale(1.2, 1.0, 0.3);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x48a825, roughness: 0.65 });

    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const bAngle = (b / 4) * Math.PI * 2;
      blade.position.set(Math.sin(bAngle) * 0.06, 0.16, Math.cos(bAngle) * 0.06);
      blade.rotation.y = bAngle + Math.random() * 0.4;
      blade.rotation.z = 0.35 + Math.random() * 0.2;
      blade.castShadow = false; // 草叶不投射阴影，极大降低移动端 Shadow Pass
      blade.receiveShadow = true;
      tuftGroup.add(blade);
    }

    // 在岛屿草坪上自然成簇点缀
    for (let i = 0; i < 48; i++) {
      const tpl = flowerTemplates[i % flowerTemplates.length];
      const flower = tpl.clone();

      const flowerCenters = [[5, -4], [8, -9], [-21, 14]];
      const flowerCenter = flowerCenters[i % flowerCenters.length];
      let fx = flowerCenter[0] + Math.sin(i * 2.4) * 2;
      let fz = flowerCenter[1] + Math.cos(i * 1.7) * 2;

      // 规避石砖广场核心区，使其在林下与草地上优雅绽放
      if (Math.hypot(fx - (-5.5), fz - (-3.5)) < 3.2) fx += 4.5;
      if (Math.hypot(fx - 0, fz - 4) < 2.5) fz += 3.5;

      flower.position.set(fx, 0.01, fz);
      flower.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.85 + Math.random() * 0.35;
      flower.scale.set(s, s, s);
      this.group.add(flower);
    }

    // 散布 32 簇嫩绿小草丛
    for (let i = 0; i < 32; i++) {
      const tuft = tuftGroup.clone();
      const grassCenters = [[-18, 32], [-4, 30], [-22, 18], [5, -5]];
      const grassCenter = grassCenters[i % grassCenters.length];
      let tx = grassCenter[0] + Math.sin(i * 2.1) * 1.5;
      let tz = grassCenter[1] + Math.cos(i * 1.8) * 1.5;
      if (Math.hypot(tx - (-5.5), tz - (-3.5)) < 3.0) tx -= 4.0;

      tuft.position.set(tx, 0.01, tz);
      tuft.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.4;
      tuft.scale.set(s, s, s);
      this.group.add(tuft);
    }

    // 海滩贝壳
    const shellGeo = new THREE.ConeGeometry(0.25, 0.12, 5);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, roughness: 0.3 });
    const starMat = new THREE.MeshStandardMaterial({ color: 0xff7b00, roughness: 0.6 });

    for (let i = 0; i < 20; i++) {
      const isStar = i % 3 === 0;
      const mesh = new THREE.Mesh(shellGeo, isStar ? starMat : shellMat);
      const angle = (i / 20) * Math.PI * 2;
      const bx = Math.cos(angle) * (46 + (Math.random() - 0.5) * 3);
      const bz = Math.sin(angle) * (39 + (Math.random() - 0.5) * 3);
      mesh.position.set(bx, -0.1, bz);
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.z = Math.random() * Math.PI;
      this.group.add(mesh);
    }
  }

  // 7.5 浪漫樱花随风轻舞飘落粒子系统 (已弃用：保持纯正热带海岛生态)
  createSakuraPetals() {
    return;
    this.petalCount = 36;
    const petalShape = new THREE.Shape();
    // 绘制微尖微弯的娇嫩樱花瓣截面
    petalShape.moveTo(0, -0.12);
    petalShape.quadraticCurveTo(0.12, 0.0, 0.08, 0.15);
    petalShape.quadraticCurveTo(0.04, 0.18, 0, 0.13);
    petalShape.quadraticCurveTo(-0.04, 0.18, -0.08, 0.15);
    petalShape.quadraticCurveTo(-0.12, 0.0, 0, -0.12);

    const petalGeo = new THREE.ShapeGeometry(petalShape);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffbccc,
      roughness: 0.45,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      emissive: new THREE.Color(0x35121c)
    });

    this.petalInstances = new THREE.InstancedMesh(petalGeo, petalMat, this.petalCount);
    this.petalData = [];

    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.petalCount; i++) {
      // 樱花树位于东北方向 (4.0, 0, -3.0) 及其周围
      const p = {
        x: 4.0 + (Math.random() - 0.5) * 9,
        y: 1.5 + Math.random() * 5,
        z: -3.0 + (Math.random() - 0.5) * 9,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        speedY: 0.6 + Math.random() * 0.7,
        swaySpeed: 1.5 + Math.random() * 2.0,
        swayAmp: 0.25 + Math.random() * 0.35,
        rotSpeed: (Math.random() - 0.5) * 2.5,
        scale: 0.35 + Math.random() * 0.3
      };
      this.petalData.push(p);

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      this.petalInstances.setMatrixAt(i, dummy.matrix);
    }

    this.petalInstances.instanceMatrix.needsUpdate = true;
    this.petalInstances.castShadow = false;
    this.petalInstances.receiveShadow = false;
    this.group.add(this.petalInstances);
  }

  // 8. 海岛天空中漂浮的松软低多边形白云
  createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      transparent: true,
      opacity: 0.92
    });

    for (let i = 0; i < 6; i++) {
      const cloudGroup = new THREE.Group();
      const nPuffs = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < nPuffs; p++) {
        const r = 2.5 + Math.random() * 2.0;
        const puffGeo = new THREE.SphereGeometry(r, 7, 6);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(p * 2.8 - nPuffs, Math.sin(p) * 0.8, (Math.random() - 0.5) * 2.5);
        puff.castShadow = false; // 🎯 核心防坑：白云严禁向地面投射深黑阴影块，保持天空轻盈纯净
        cloudGroup.add(puff);
      }
      cloudGroup.position.set(
        (Math.random() - 0.5) * 160,
        22 + Math.random() * 8,
        (Math.random() - 0.5) * 160
      );
      this.clouds.push(cloudGroup);
      this.group.add(cloudGroup);
    }
  }

  update(delta) {
    this.time += delta;
    if (this.waterUniforms) this.waterUniforms.uTime.value = this.time;
    if (this.waterMesh) {
      this.waterMesh.position.y = -0.36 + Math.sin(this.time * 1.5) * 0.02;
    }
    if (this.foamMesh) {
      this.foamMesh.material.map.offset.x = (this.time * 0.015) % 1;
      this.foamMesh.material.map.offset.y = (this.time * 0.018) % 1;
    }
    // 拍岸白浪呼吸潮汐动画 (在沙滩边缘柔和涨退漫涌，双频自然韵律)
    if (this.shoreFoamMesh) {
      // 1. 长周期主涌浪 (约 6.5 秒一涌一退，缓慢深呼吸)
      const swell = (Math.sin(this.time * 0.95) + 1.0) * 0.5;
      // 2. 拍岸碎浪快动量 (约 3.2 秒小浪花破水)
      const lapping = (Math.sin(this.time * 1.95 + 0.6) + 1.0) * 0.5;
      // 复合自然浪势 (推进冲滩非对称：进涌快、回卷缓)
      const tideMotion = Math.pow(swell * 0.7 + lapping * 0.3, 1.4);

      // 浪花漫上沙滩斜坡 (Y坐标与边缘平滑漫涌)
      this.shoreFoamMesh.position.y = -0.325 + tideMotion * 0.045;
      this.shoreFoamMesh.scale.set(0.985 + tideMotion * 0.035, 1.0, 0.985 + tideMotion * 0.035);
      this.shoreFoamMesh.material.opacity = 0.28 + tideMotion * 0.48;

      // 外圈回卷浪沫 (相位滞后，退潮时拉出细碎泡沫带)
      if (this.shoreFoamOuter) {
        const outerTide = (Math.sin(this.time * 0.95 - 1.1) + 1.0) * 0.5;
        this.shoreFoamOuter.position.y = -0.338 + outerTide * 0.03;
        this.shoreFoamOuter.scale.set(0.995 + outerTide * 0.025, 1.0, 0.995 + outerTide * 0.025);
        this.shoreFoamOuter.material.opacity = 0.08 + (1.0 - tideMotion) * 0.22;
      }
    }
    // 瀑布激流泡沫呼吸微动
    if (this.waterfallFoam) {
      const fTide = Math.sin(this.time * 4.5) * 0.08 + 1.0;
      this.waterfallFoam.scale.set(fTide, 1.0, fTide);
      this.waterfallFoam.rotation.z = this.time * 0.35;
    }
    if (this.waterfallMist) this.waterfallMist.userData.update(delta);
    // 悬崖水帘微弱晶莹波动
    if (this.waterfallMesh) {
      this.waterfallMesh.material.opacity = 0.82 + Math.sin(this.time * 6.0) * 0.06;
    }
    // 樱花花瓣随风轻舞飘落动力学
    if (this.petalInstances && this.petalData) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.petalData.length; i++) {
        const p = this.petalData[i];
        p.y -= p.speedY * delta;
        p.x += Math.sin(this.time * p.swaySpeed + i) * p.swayAmp * delta;
        p.z += Math.cos(this.time * 0.8 + i) * 0.15 * delta;
        p.rotX += p.rotSpeed * delta;
        p.rotZ += p.rotSpeed * 0.7 * delta;

        // 触地后在树冠高空自然重置循环
        if (p.y <= 0.05) {
          p.y = 5.0 + Math.random() * 1.5;
          p.x = 4.0 + (Math.random() - 0.5) * 9;
          p.z = -3.0 + (Math.random() - 0.5) * 9;
        }

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        this.petalInstances.setMatrixAt(i, dummy.matrix);
      }
      this.petalInstances.instanceMatrix.needsUpdate = true;
    }

    for (const c of this.clouds) {
      c.position.x += 1.2 * delta;
      if (c.position.x > 90) c.position.x = -90;
    }
  }
}
