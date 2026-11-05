import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// 原始模型以分米(dm)为单位导出，全局基准缩放系数 0.1 转为米制
export const DAE_GLOBAL_SCALE = 0.1;

export class ModelLoader {
  constructor() {
    this.colladaLoader = new ColladaLoader();
    this.gltfLoader = new GLTFLoader();
    this.cache = new Map();
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * 加载 DAE 或 GLTF/GLB 模型，返回已缩放、已贴地的外层 Group
   * @param {string} url 模型相对于 public 的路径
   * @param {Object} options 选项配置 (scale, castShadow, receiveShadow, adjustToGround)
   * @returns {Promise<THREE.Group>}
   */
  async loadModel(url, options = {}) {
    const { scale = 1.0, castShadow = true, receiveShadow = true, adjustToGround = true } = options;

    let template;
    try {
      template = await this.loadTemplate(url);
    } catch (error) {
      console.warn(`[ModelLoader] 加载模型失败: ${url}`, error);
      return this.createFallbackModel();
    }

    const isGlb = url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf');
    // 普通 clone 不会重绑骨骼，必须用 SkeletonUtils
    const inner = SkeletonUtils.clone(template);
    inner.traverse((child) => {
      if (child.isMesh) {
        const cName = (child.name || '').toLowerCase();
        // 树木与枝叶完整投射婆娑海岛树影
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
      }
    });

    const finalScale = isGlb ? scale : scale * DAE_GLOBAL_SCALE;
    inner.scale.setScalar(finalScale);

    // 外层 Group 留给调用方做位移/摇摆动画，贴地偏移放在内层，互不覆盖
    const result = new THREE.Group();
    result.add(inner);

    if (adjustToGround) {
      // 植物模型的原点 Y=0 即为自然地平线，负Y为地下根须，不应被强制拔出地表
      const isPlant = url.toLowerCase().includes('/plants/');
      if (!isPlant) {
        result.updateMatrixWorld(true);
        const bbox = new THREE.Box3();
        inner.traverse(child => {
          let visible = true;
          for (let parent = child; parent; parent = parent.parent) visible &&= parent.visible;
          if (child.isMesh && visible && !/shadow/i.test(child.name)) {
            const part = new THREE.Box3().setFromObject(child, true);
            bbox.union(part);
          }
        });
        if (isFinite(bbox.min.y)) inner.position.y = -bbox.min.y;
      } else {
        // 植物树木轻微下沉 0.05 米，使树干与地面草皮/细沙严丝合缝咬合
        inner.position.y = -0.05;
      }
    }
    return result;
  }

  loadTemplate(url) {
    if (!this.cache.has(url)) {
      const isGlb = url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf');
      if (isGlb) {
        this.cache.set(url, new Promise((resolve, reject) => {
          this.gltfLoader.load(url, (gltf) => {
            const model = gltf.scene;
            const isCustomGlb = url.toLowerCase().includes('/models/custom/');
            model.traverse((child) => {
              if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                  // 仅对具备该属性的材质赋值：MeshBasicMaterial（unlit）没有 emissive，
                  // 强行挂上会让 three 的 uniforms 刷新读到不存在的 emissive uniform 而逐帧崩溃
                  if ("metalness" in mat) mat.metalness = 0.0;
                  if ("emissive" in mat) mat.emissive = new THREE.Color(0x000000);
                  // 自研 AI 模型（/models/custom/）色彩校正：与 OpeningAssets 的 CUSTOM_GRADE 同档，
                  // 抵消 PBR 背阳面偏暗，对齐设计稿明亮观感（2026-11-05 批量替换植物/家具接入）
                  if (isCustomGlb && mat.isMeshStandardMaterial) {
                    mat.toneMapped = false;
                    if (mat.map) {
                      mat.emissiveMap = mat.map;
                      mat.emissive = new THREE.Color(0.85, 0.85, 0.85);
                    }
                    mat.color.setRGB(1.25, 1.12, 0.9);
                    if ('occlusionStrength' in mat) mat.occlusionStrength = 0.35;
                    mat.needsUpdate = true;
                  }
                });
              }
            });
            resolve(model);
          }, undefined, reject);
        }));
      } else {
        this.cache.set(url, new Promise((resolve, reject) => {
          this.colladaLoader.load(url, (collada) => {
            const model = collada.scene;
            const urlLower = url.toLowerCase();
            model.traverse((child) => {
              const childName = (child.name || '').toLowerCase();

              // 隐藏太阳镜等配件与烘焙阴影
              if (
                childName.includes('accessoryglass') ||
                childName.includes('shadow') ||
                childName.includes('shadowshake') ||
                childName.includes('mshadow')
              ) {
                child.visible = false;
                return;
              }

              if (!child.isMesh || !child.material) return;
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              const urlLower = url.toLowerCase();

              materials.forEach((mat) => {
                const nameLower = ((child.name || '') + ' ' + (mat.name || '')).toLowerCase();
                const isCharacter = urlLower.includes('player') || urlLower.includes('npc');
                const isLeaf = nameLower.includes('leaf') || nameLower.includes('bush') || nameLower.includes('foliage');
                const isTrunk = nameLower.includes('trunk') || nameLower.includes('bark') || nameLower.includes('stump') || nameLower.includes('branch');

                // 卡通微漫反射材质基准（统一自发光改回黑色，保留模型原始粗糙度）
                mat.metalness = 0.0;
                mat.emissive = new THREE.Color(0x000000);

                let mapSrc = '';
                const isWoodBench = urlLower.includes('ftrwoodbench') || urlLower.includes('woodbench');

                if (isWoodBench) {
                  mat.map = null;
                  mat.color.set('#a6713c');
                  mat.roughness = 0.68;
                  mat.metalness = 0.0;
                  mat.emissive = new THREE.Color(0x261608);
                } else if (mat.map) {
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  mat.map.anisotropy = 8;
                  mat.color.setScalar(1.0);
                  mapSrc = (mat.map.image && (mat.map.image.src || mat.map.image.currentSrc) || '').toLowerCase();
                } else {
                  if (urlLower.includes('wood') || urlLower.includes('bench') || urlLower.includes('table') || urlLower.includes('ftr')) {
                    mat.color.set('#a6713c');
                    mat.roughness = 0.68;
                    mat.emissive = new THREE.Color(0x261608);
                  }
                }

                // 角色通透瓷润渲染
                if (isCharacter) {
                  mat.metalness = 0.0;
                  mat.emissive = new THREE.Color(0x000000);
                  if (mat.map) {
                    mat.color.setScalar(1.0);
                  }
                  if (nameLower.includes('eye')) {
                    mat.roughness = 0.15;
                    mat.emissive = new THREE.Color(0x000000);
                  }
                }

                const dir = url.slice(0, url.lastIndexOf('/') + 1);

                if (urlLower.includes('plttreeoaksakura')) {
                  // 樱花树：花团与叶片精准 Alpha 蒙版镂空
                  if (isLeaf || nameLower.includes('bloom') || nameLower.includes('back')) {
                    const isBack = nameLower.includes('back');
                    const opFile = isBack ? 'mTreeOakSakuraBack_OP.png' : 'mTreeOakSakuraBloom_OP.png';
                    mat.alphaMap = this.textureLoader.load(dir + opFile);
                    mat.alphaMap.colorSpace = THREE.NoColorSpace;
                    mat.alphaTest = 0.35;
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    mat.roughness = 0.55;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color(0x180c10);
                  } else if (isTrunk) {
                    mat.roughness = 0.8;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color(0x1a120c);
                  }
                } else if (urlLower.includes('plttreeoak')) {
                  // 苹果阔叶树：全视角立体饱满树冠 + 透光青翠材质 (杜绝侧面扁平与逆光发黑)
                  if (isLeaf || !isTrunk) {
                    const isBack = nameLower.includes('back');
                    const opFile = isBack ? 'mTreeOakLeafBack_OP.png' : 'mTreeOakLeaf_OP.png';
                    mat.alphaMap = this.textureLoader.load(dir + opFile);
                    mat.alphaMap.colorSpace = THREE.NoColorSpace;
                    mat.alphaTest = 0.18; // 温和阈值保留叶缘全部丰盛羽状细节
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    mat.color.set(isBack ? '#42b01c' : '#5ec928'); // 充满热带生机的青葱翠绿
                    mat.roughness = 0.62;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color(isBack ? '#12300a' : '#18400e'); // 润泽的叶片环境透光漫反射
                  } else if (isTrunk) {
                    mat.color.set('#9e7240');
                    mat.roughness = 0.78;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color('#22160a');
                  }
                } else if (urlLower.includes('plttreecedar')) {
                  // 雪松林：针叶镂空与挺拔冷杉质感
                  if (isLeaf) {
                    mat.alphaMap = this.textureLoader.load(dir + 'mPltTreeCedarLeaf_OP.png');
                    mat.alphaMap.colorSpace = THREE.NoColorSpace;
                    mat.alphaTest = 0.38;
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    mat.color.set('#247248');
                    mat.roughness = 0.58;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color('#062010');
                  } else if (isTrunk) {
                    mat.color.set('#764e26');
                    mat.roughness = 0.85;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color('#160e06');
                  }
                } else if (urlLower.includes('plttreepalm')) {
                  // 热带椰子树：叶片高品质羽状镂空 + 树干根部镂空 (消除黑斑走样)
                  if (isLeaf || !isTrunk) {
                    mat.alphaMap = this.textureLoader.load(dir + 'mPltTreePalmLeaf_OP.png');
                    mat.alphaMap.colorSpace = THREE.NoColorSpace;
                    mat.alphaTest = 0.62;
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    mat.color.set('#42b832');
                    mat.roughness = 0.52;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color('#0a2408');
                  } else if (isTrunk) {
                    mat.alphaMap = this.textureLoader.load(dir + 'mPltTreePalmTrunk_OP.png');
                    mat.alphaMap.colorSpace = THREE.NoColorSpace;
                    mat.alphaTest = 0.5;
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    mat.color.set('#9c7546');
                    mat.roughness = 0.78;
                    mat.metalness = 0.0;
                    mat.emissive = new THREE.Color('#1c140a');
                  }
                } else if (urlLower.includes('pltbushazalea') || urlLower.includes('pltbushcamellia')) {
                  // 海岛天然灌木：杜鹃与山茶花
                  if (isLeaf) {
                    const leafOp = urlLower.includes('azalea') ? 'mPltBushAzaleaLeaf_OP.png' : 'mPltBushCamelliaLeaf_OP.png';
                    mat.alphaMap = this.textureLoader.load(dir + leafOp);
                    mat.alphaMap.colorSpace = THREE.NoColorSpace;
                    mat.alphaTest = 0.35;
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.side = THREE.DoubleSide;
                    mat.color.set('#46ad26');
                    mat.roughness = 0.55;
                    mat.emissive = new THREE.Color('#0a2608');
                  }
                }

                // 半透明与双面渲染保护，并绑定精确的阴影镂空深度材质
                if (['leaf', 'tree', 'glass', 'alpha', 'bush', 'sakura', 'flower'].some((k) => nameLower.includes(k))) {
                  mat.transparent = nameLower.includes('glass');
                  if (!mat.transparent) mat.opacity = 1;
                  // 保护实木树干：仅当具有 alphaMap 且非实木树干时，才启用 alphaTest
                  if (!mat.alphaTest && !isTrunk && mat.alphaMap) mat.alphaTest = 0.35;
                  mat.depthWrite = true;
                  mat.side = THREE.DoubleSide;

                  if (isLeaf || nameLower.includes('leaf') || nameLower.includes('bush') || nameLower.includes('bloom')) {
                    mat.alphaToCoverage = true;
                  }
                  // 当材质拥有 alphaMap 且有 alphaTest 时，为其提供镂空投影
                  if (mat.alphaMap) {
                    child.customDepthMaterial = new THREE.MeshDepthMaterial({
                      depthPacking: THREE.RGBADepthPacking,
                      map: mat.alphaMap,
                      alphaTest: mat.alphaTest
                    });
                  }
                }
              });
            });

            // 针对动森单向视角的阔叶树 (苹果树与樱花树)，在加载阶段直接重构为 360 度四向交融全向饱满树冠，
            // 彻底消除侧面扁平、背面镂空以及 SkinnedMesh 骨架绑定导致的空间剪裁问题
            if (urlLower.includes('plttreeoak') && !urlLower.includes('stump')) {
              const leafMeshes = [];
              let trunkMesh = null;
              const dir = url.slice(0, url.lastIndexOf('/') + 1);
              const isSakura = urlLower.includes('sakura');
              const opLeaf = this.textureLoader.load(dir + (isSakura ? 'mTreeOakSakuraBloom_OP.png' : 'mTreeOakLeaf_OP.png'));
              const opBack = this.textureLoader.load(dir + (isSakura ? 'mTreeOakSakuraBack_OP.png' : 'mTreeOakLeafBack_OP.png'));
              opLeaf.colorSpace = THREE.NoColorSpace;
              opBack.colorSpace = THREE.NoColorSpace;

              model.traverse((child) => {
                if (child.isMesh) {
                  const n = (child.name || '').toLowerCase();
                  if (n.includes('shadow')) return;
                  const geo = child.geometry.clone();
                  geo.computeVertexNormals();

                  if (n.includes('trunk')) {
                    const mat = new THREE.MeshStandardMaterial({
                      color: 0x9e7240,
                      roughness: 0.72,
                      metalness: 0.0,
                      emissive: new THREE.Color(0x22160a),
                      side: THREE.DoubleSide
                    });
                    trunkMesh = new THREE.Mesh(geo, mat);
                    trunkMesh.name = child.name;
                    trunkMesh.castShadow = true;
                    trunkMesh.receiveShadow = true;
                  } else if (n.includes('leaf') || n.includes('bloom') || n.includes('back')) {
                    const isBack = n.includes('back');
                    const mat = new THREE.MeshStandardMaterial({
                      color: isSakura ? (isBack ? 0xf29cb2 : 0xffc8d8) : (isBack ? 0x48b820 : 0x6ed92e),
                      alphaMap: isBack ? opBack : opLeaf,
                      alphaTest: 0.18,
                      alphaToCoverage: true,
                      side: THREE.DoubleSide,
                      metalness: 0.0,
                      emissive: new THREE.Color(0x000000)
                    });
                    const m = new THREE.Mesh(geo, mat);
                    m.name = child.name;
                    m.castShadow = true;
                    m.receiveShadow = true;
                    m.customDepthMaterial = new THREE.MeshDepthMaterial({
                      depthPacking: THREE.RGBADepthPacking,
                      map: mat.alphaMap,
                      alphaTest: mat.alphaTest
                    });
                    leafMeshes.push(m);
                  }
                }
              });

              while (model.children.length > 0) {
                model.remove(model.children[0]);
              }

              if (trunkMesh) model.add(trunkMesh);

              const canopyConfigs = [
                { rotY: 0, scale: [1.0, 1.0, 1.0] },
                { rotY: Math.PI, scale: [0.98, 1.01, 0.98] },
                { rotY: Math.PI * 0.5, scale: [0.96, 0.99, 0.96] },
                { rotY: -Math.PI * 0.5, scale: [0.95, 1.02, 0.95] }
              ];

              canopyConfigs.forEach((cfg) => {
                const branchGroup = new THREE.Group();
                branchGroup.rotation.y = cfg.rotY;
                branchGroup.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]);
                leafMeshes.forEach((mesh) => {
                  branchGroup.add(mesh.clone());
                });
                model.add(branchGroup);
              });
            }

            // 针对针叶雪松（PltTreeCedar），脱除骨架限制，构建 360 度四向交叠苍翠挺拔树冠，
            // 恢复扎实苍劲的树干质感与浓密针叶层次，彻底解决骨骼绑定造成的树干丢失与叶冠镂空断层
            if (urlLower.includes('plttreecedar') && !urlLower.includes('stump')) {
              const leafMeshes = [];
              let trunkMesh = null;
              const dir = url.slice(0, url.lastIndexOf('/') + 1);
              const opLeaf = this.textureLoader.load(dir + 'mPltTreeCedarLeaf_OP.png');
              opLeaf.colorSpace = THREE.NoColorSpace;

              model.traverse((child) => {
                if (child.isMesh) {
                  const n = (child.name || '').toLowerCase();
                  if (n.includes('shadow')) return;
                  const geo = child.geometry.clone();
                  geo.computeVertexNormals();

                  if (n.includes('trunk')) {
                    // 实木树干：温润暖棕色，无 alphaTest，实心挺拔扎根
                    const mat = new THREE.MeshStandardMaterial({
                      color: 0x6e4726,
                      roughness: 0.82,
                      metalness: 0.0,
                      emissive: new THREE.Color(0x180f08),
                      side: THREE.DoubleSide
                    });
                    trunkMesh = new THREE.Mesh(geo, mat);
                    trunkMesh.name = child.name;
                    trunkMesh.castShadow = true;
                    trunkMesh.receiveShadow = true;
                  } else if (n.includes('leaf')) {
                    // 针叶：苍翠深林冷杉绿，宽容的 alphaTest 保护细长羽状针叶，注入环境透光漫反射
                    const isLayerD = n.includes('leafd');
                    const mat = new THREE.MeshStandardMaterial({
                      color: isLayerD ? 0x226b3e : 0x2e824c,
                      alphaMap: opLeaf,
                      alphaTest: 0.20,
                      side: THREE.DoubleSide,
                      roughness: 0.52,
                      metalness: 0.0,
                      emissive: new THREE.Color(0x0e2814)
                    });
                    const m = new THREE.Mesh(geo, mat);
                    m.name = child.name;
                    m.castShadow = true;
                    m.receiveShadow = true;
                    m.customDepthMaterial = new THREE.MeshDepthMaterial({
                      depthPacking: THREE.RGBADepthPacking,
                      map: mat.alphaMap,
                      alphaTest: mat.alphaTest
                    });
                    leafMeshes.push(m);
                  }
                }
              });

              while (model.children.length > 0) {
                model.remove(model.children[0]);
              }

              if (trunkMesh) model.add(trunkMesh);

              // 四向微扰交叠浓密冷杉树冠，杜绝任何视角的单薄与片状空洞
              const canopyConfigs = [
                { rotY: 0, scale: [1.0, 1.0, 1.0] },
                { rotY: Math.PI, scale: [0.98, 1.02, 0.98] },
                { rotY: Math.PI * 0.5, scale: [0.96, 0.99, 0.96] },
                { rotY: -Math.PI * 0.5, scale: [0.95, 1.01, 0.95] }
              ];

              canopyConfigs.forEach((cfg) => {
                const branchGroup = new THREE.Group();
                branchGroup.rotation.y = cfg.rotY;
                branchGroup.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]);
                leafMeshes.forEach((mesh) => {
                  branchGroup.add(mesh.clone());
                });
                model.add(branchGroup);
              });
            }

            resolve(model);
          }, undefined, reject);
        }));
      }
    }
    return this.cache.get(url);
  }

  createFallbackModel() {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x88c057, roughness: 0.5 })
    );
    mesh.position.y = 0.6;
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }
}

export const modelLoader = new ModelLoader();
