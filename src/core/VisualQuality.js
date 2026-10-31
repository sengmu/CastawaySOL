// 画质档位（低/中/高）：自动适配移动端与桌面端硬件算力
// 切换方式：URL 参数 ?quality=low|medium|high，或 localStorage['castaway_visual_quality']
export const VISUAL_QUALITY_KEY = 'castaway_visual_quality';

// 移动端环境检测
export const isMobileDevice = typeof navigator !== 'undefined' && (
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 900px)').matches)
);

const PRESETS = {
  // 移动端专用均衡配置：1.15 DPR 像素开销减少42%，1024 硬件4-tap PCF阴影，满帧60FPS
  low: {
    name: 'low',
    pixelRatioCap: 1.0,
    shadowMapSize: 1024,
    softShadows: false,
    postOverlay: false,
    colorGrade: false,
    waveOctaves: 1
  },
  medium: {
    name: 'medium',
    pixelRatioCap: isMobileDevice ? 1.15 : 1.5,
    shadowMapSize: isMobileDevice ? 1024 : 2048,
    softShadows: !isMobileDevice, // 手机端使用硬件快速 PCFShadowMap，避免移动 GPU 昂贵的跨纹素模糊过滤
    postOverlay: true,
    colorGrade: false,
    waveOctaves: 2
  },
  high: {
    name: 'high',
    pixelRatioCap: isMobileDevice ? 1.35 : 2.0,
    shadowMapSize: 2048,
    softShadows: true,
    postOverlay: true,
    colorGrade: true,
    waveOctaves: 3
  }
};

export function resolveVisualQuality() {
  let key = 'medium';
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('quality');
    const fromStore = window.localStorage ? window.localStorage.getItem(VISUAL_QUALITY_KEY) : null;
    const picked = (fromUrl || fromStore || '').toLowerCase();
    if (PRESETS[picked]) key = picked;
    if (fromUrl && PRESETS[fromUrl.toLowerCase()] && window.localStorage) {
      window.localStorage.setItem(VISUAL_QUALITY_KEY, fromUrl.toLowerCase());
    }
  } catch (e) { /* 无头/隐私模式下保持默认中档 */ }
  return { ...PRESETS[key] };
}

// 零 GPU 开销的屏幕后期：柔和暗角 + 中心微暖空气感（CSS 叠加层，不拦截任何点击）
export function applyPostOverlay(container, quality, canvas) {
  if (!quality || !quality.postOverlay || typeof document === 'undefined') return null;
  const overlay = document.createElement('div');
  overlay.id = 'visual-post-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:0',
    'background:radial-gradient(ellipse 75% 70% at 50% 46%, rgba(255,244,222,0.05) 0%, rgba(255,244,222,0) 45%, rgba(8,32,46,0) 62%, rgba(8,32,46,0.26) 100%)'
  ].join(';');
  container.appendChild(overlay);
  if (quality.colorGrade && canvas) {
    canvas.style.filter = 'saturate(1.06) contrast(1.03)';
  }
  return overlay;
}