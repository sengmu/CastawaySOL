import * as THREE from 'three';

// 淡水（小溪 / 瀑布 / 泉潭 / 崖顶汇流）程序化流动水材质，与海面同一套做法：
// MeshStandardMaterial + onBeforeCompile，无外部贴图；波纹稀疏柔和；按画质档位降级。
// detail: 0=低档(无法线扰动) 1=中档 2=高档
export function freshwaterDetail(quality = {}) {
  const o = quality.waveOctaves || 2;
  return o <= 1 ? 0 : (o >= 3 ? 2 : 1);
}

const COMMON = `
uniform float uTime;
uniform vec3 uSkyColor;
varying vec3 vFlowWorld;
`;

// 小溪：沿 +Z（下游）流动、沿流向拉伸的大块波纹，岸边浅色与泡沫
const STREAM = {
  pars: `
float streamH(vec2 q, float t) {
  float h = 0.5 * sin(q.y * 0.9 - t * 1.4 + sin(q.x * 1.3) * 0.8);
  h += 0.25 * sin(q.y * 1.7 - t * 2.1 + q.x * 0.9);
  return h;
}`,
  color: `
float edgeD = min(vUv.x, 1.0 - vUv.x);
float bank = 1.0 - smoothstep(0.0, 0.22, edgeD);
float flowBand = 0.5 + 0.5 * sin(vFlowWorld.z * 0.9 - uTime * 1.6 + vFlowWorld.x * 1.7);
float foam = bank * smoothstep(0.35, 1.0, flowBand) * 0.55 + (1.0 - smoothstep(0.0, 0.06, edgeD)) * 0.35;
vec3 flowCol = mix(vec3(0.05, 0.42, 0.56), vec3(0.42, 0.80, 0.76), bank);
flowCol = mix(flowCol, vec3(0.92, 0.97, 0.98), foam);
diffuseColor.rgb *= flowCol;
float endFade = smoothstep(0.0, 0.04, vUv.y) * smoothstep(0.0, 0.04, 1.0 - vUv.y);
diffuseColor.a *= mix(0.92, 0.7, bank) * endFade;
diffuseColor.a = max(diffuseColor.a, foam * endFade);`,
  normal: `
#if FLOW_DETAIL > 0
vec2 fq = vFlowWorld.xz;
float fe = 0.08;
float fh0 = streamH(fq, uTime);
vec2 fg = vec2(streamH(fq + vec2(fe, 0.0), uTime) - fh0, streamH(fq + vec2(0.0, fe), uTime) - fh0) / fe;
fg *= FLOW_DETAIL > 1 ? 0.14 : 0.1;
normal = normalize((viewMatrix * vec4(normalize(vec3(-fg.x, 1.0, -fg.y)), 0.0)).xyz);
#endif`
};

// 瀑布水帘：向下流动的竖向条纹，崖顶汇入处与底部落点泛白
const FALL = {
  pars: ``,
  color: `
float sx = vUv.x * 11.0 + sin(vUv.x * 5.0) * 1.4;
float column = smoothstep(0.35, 1.0, 0.5 + 0.5 * sin(sx));
float drop = 0.5 + 0.5 * sin((vUv.y + uTime * 0.85) * 7.0 + vUv.x * 9.0);
float drop2 = 0.5 + 0.5 * sin((vUv.y + uTime * 1.3) * 3.0 - vUv.x * 4.0);
float streak = column * mix(drop, drop2, 0.5);
float lip = smoothstep(0.82, 1.0, vUv.y);
float base = 1.0 - smoothstep(0.0, 0.22, vUv.y);
float white = clamp(streak * 0.55 + lip * 0.45 + base * 0.6, 0.0, 1.0);
vec3 fallCol = mix(vec3(0.30, 0.74, 0.86), vec3(0.95, 0.99, 1.0), white);
diffuseColor.rgb *= fallCol;
float sideFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
diffuseColor.a *= (0.62 + white * 0.35) * sideFade;`,
  normal: ``
};

// 瀑布泉潭：从落点向外扩散的稀疏同心涟漪，边缘浅色
const POOL = {
  pars: `
float poolH(vec2 q, float t) {
  float r = length(q);
  return sin(r * 3.2 - t * 2.0) * exp(-r * 0.45);
}`,
  color: `
float pr = length(vUv - 0.5) * 2.0;
float pbank = smoothstep(0.6, 1.0, pr);
vec3 poolCol = mix(vec3(0.06, 0.45, 0.58), vec3(0.45, 0.82, 0.78), pbank);
diffuseColor.rgb *= poolCol;
diffuseColor.a *= mix(0.9, 0.72, pbank);`,
  normal: `
#if FLOW_DETAIL > 0
vec2 pq = (vUv - vec2(0.5, 0.667)) * 4.8; // 落点约在潭心偏北 0.8 米
float pe = 0.06;
float ph0 = poolH(pq, uTime);
vec2 pg = vec2(poolH(pq + vec2(pe, 0.0), uTime) - ph0, poolH(pq + vec2(0.0, pe), uTime) - ph0) / pe;
pg *= 0.08;
normal = normalize((viewMatrix * vec4(normalize(vec3(-pg.x, 1.0, pg.y)), 0.0)).xyz);
#endif`
};

const KINDS = { stream: STREAM, fall: FALL, pool: POOL };

export function createFlowMaterial(kind, { quality = {}, uTime, uSkyColor, side = THREE.FrontSide } = {}) {
  const k = KINDS[kind];
  const detail = freshwaterDetail(quality);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: kind === 'fall' ? 0.3 : 0.18,
    metalness: 0.0,
    emissive: kind === 'fall' ? 0x0c3a44 : 0x062a33,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side
  });
  mat.defines = { USE_UV: '', FLOW_DETAIL: detail };
  mat.userData.flowKind = kind;
  const uniforms = {
    uTime: uTime || { value: 0 },
    uSkyColor: uSkyColor || { value: new THREE.Color(0xbfe6f5) }
  };
  mat.userData.flowUniforms = uniforms;
  mat.customProgramCacheKey = () => `castaway-flow-${kind}-${detail}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlowWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFlowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON + k.pars)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + k.color)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + k.normal)
      .replace('#include <opaque_fragment>', `float flowFres = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 5.0);
outgoingLight = mix(outgoingLight, uSkyColor, mix(0.03, 1.0, flowFres) * 0.18);
#include <opaque_fragment>`);
  };
  return mat;
}

// 瀑布底部水雾：少量柔光粒子（低档 0 个，中档 18，高档 32）
export function createMistPoints(quality = {}) {
  const detail = freshwaterDetail(quality);
  const count = detail === 0 ? 0 : (detail === 1 ? 18 : 32);
  if (!count || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const pos = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push({ x: (Math.random() - 0.5) * 2.4, z: 0.3 + Math.random() * 0.9, life: Math.random(), speed: 0.25 + Math.random() * 0.35 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: tex, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.32, depthWrite: false, color: 0xf2fbff });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.seeds = seeds;
  points.userData.update = (delta) => {
    const p = geo.attributes.position;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      s.life += delta * s.speed;
      if (s.life > 1) { s.life -= 1; s.x = (Math.random() - 0.5) * 2.4; s.z = 0.3 + Math.random() * 0.9; }
      p.setXYZ(i, s.x * (1 + s.life * 0.4), 0.08 + s.life * 1.3, s.z + s.life * 0.6);
    }
    p.needsUpdate = true;
  };
  points.userData.update(0);
  return points;
}