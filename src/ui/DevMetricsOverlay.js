// 渲染性能监控开发浮层 (FPS, calls, triangles)
export class DevMetricsOverlay {
  constructor(renderer) {
    this.renderer = renderer;
    this.visible = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fps = 60;
    this.lastFpsUpdate = performance.now();

    this.container = document.createElement('div');
    this.container.id = 'dev-metrics-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 64px;
      left: 12px;
      z-index: 99999;
      background: rgba(11, 16, 27, 0.88);
      border: 1px solid rgba(0, 206, 201, 0.5);
      border-radius: 8px;
      padding: 6px 10px;
      color: #00cec9;
      font-family: monospace;
      font-size: 11px;
      line-height: 1.4;
      pointer-events: auto;
      user-select: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;

    this.textEl = document.createElement('div');
    this.container.appendChild(this.textEl);

    // 双击或点击切换折叠/显隐
    this.container.addEventListener('click', () => {
      this.toggle();
    });

    // U7 规范：性能浮层默认隐藏，仅当 URL 携带 ?dev=1 时才默认启用
    this.visible = false;
    this.container.style.display = 'none';
    if (typeof window !== 'undefined') {
      const devParam = new URLSearchParams(window.location.search).get('dev');
      const metricsParam = new URLSearchParams(window.location.search).get('metrics');
      if (devParam === '1' || metricsParam === '1' || devParam === 'true') {
        this.visible = true;
        this.container.style.display = 'block';
      }
      window.__devMetrics = this;
    }

    document.body.appendChild(this.container);
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }

  update() {
    this.frameCount++;
    const now = performance.now();
    if (!this.fpsHistory) this.fpsHistory = [];
    if (now - this.lastFpsUpdate >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 20) this.fpsHistory.shift();
      if (typeof window !== 'undefined') {
        window.__devFps = this.fps;
        window.__devAvgFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
      }
    }

    if (!this.visible || !this.renderer) return;

    const rInfo = this.renderer.info.render;
    this.textEl.innerHTML = `
      <div style="font-weight:900; color:#55efc4;">📊 性能监控 (Dev)</div>
      <div>FPS: <b style="color:#ffeaa7;">${this.fps}</b></div>
      <div>Calls: <b style="color:#74b9ff;">${rInfo.calls}</b></div>
      <div>Triangles: <b style="color:#fd79a8;">${rInfo.triangles.toLocaleString()}</b></div>
    `;
  }
}
