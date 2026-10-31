// 提示系统优化（2026-10-31）：统一管理 showToast / showBubbleNotice 的显示
// - 同一时间最多 1 条主横幅，其余排队；普通 2 秒、重要 3 秒；排队超过 4 条丢弃最旧的低优先级提示
// - 三档：small（获得物品等，图标 +数量 小气泡 / 窄胶囊）、medium（任务进度合并为最新一条）、important（插队、停留更久）
// - 相同文案 / 同一物品 3 秒内合并计数；对话框 / 面板打开时暂停，关闭后继续
// - 提示强度：完整 full / 精简 lite（默认）/ 仅重要 important，存 localStorage
// 只改显示，不改游戏逻辑
import { iconHTML } from './IconRegistry.js';

export const NOTICE_MODE_KEY = 'castaway_notice_mode';
export const NOTICE_MODES = ['full', 'lite', 'important'];
const LEVELS = { small: 0, medium: 1, important: 2 };
const TYPES = ['ok', 'fail', 'gain', 'info', 'quest'];
const MERGE_MS = 3000;
const DWELL = { small: 2000, medium: 2000, important: 3000 };
const MAX_PENDING = 4;
const POP_MS = 1200;

export class NoticeCenter {
  constructor(ui, format) {
    this.ui = ui;
    this.format = format || ((t) => t);
    this.active = null;
    this.pending = [];
    this.recent = new Map(); // key -> { count, ts }
    this.pops = [];
    this.capsule = null;
    this.lastItemNames = [];
    this.paused = false;
    this.stats = { shown: 0, dropped: 0, merged: 0, popped: 0, capsules: 0, suppressed: 0 };
    this.mode = 'lite';
    try {
      const saved = window.localStorage.getItem(NOTICE_MODE_KEY);
      if (NOTICE_MODES.includes(saved)) this.mode = saved;
    } catch (e) { /* 隐私模式 */ }
    if (!document.getElementById('notice-center-css')) {
      const st = document.createElement('style');
      st.id = 'notice-center-css';
      st.textContent = NOTICE_CSS;
      document.head.appendChild(st);
    }
    this._watchPause();
  }

  setMode(mode) {
    if (!NOTICE_MODES.includes(mode)) return;
    this.mode = mode;
    try { window.localStorage.setItem(NOTICE_MODE_KEY, mode); } catch (e) { /* 隐私模式 */ }
  }

  // 参数兼容：push(text) / push(text, 'ok') / push(text, 'small') / push(text, 'ok', 'important') / push(text, { type, level, item, count, group })
  push(text, a, b) {
    const msg = this.format(text == null ? '' : String(text)).trim();
    if (!msg || !this.ui.toast) return;
    const opts = {};
    for (const arg of [a, b]) {
      if (typeof arg === 'string') {
        if (arg in LEVELS) opts.level = arg;
        else if (TYPES.includes(arg)) opts.type = arg;
      } else if (arg && typeof arg === 'object') {
        if (TYPES.includes(arg.type)) opts.type = arg.type;
        if (arg.level in LEVELS) opts.level = arg.level;
        if (arg.item) opts.item = String(arg.item);
        if (arg.count > 0) opts.count = Number(arg.count);
        if (arg.group) opts.group = String(arg.group);
      }
    }
    const level = opts.level || 'medium';
    const type = opts.type || (this.ui._toastKind ? this.ui._toastKind(msg) : 'info');
    const group = opts.group || (type === 'quest' ? 'quest' : '');
    const n = {
      msg, type, level, group, item: opts.item || '', add: opts.count || 1,
      key: opts.item ? 'item:' + opts.item : 'msg:' + msg, count: 1, el: null, timer: null, until: 0, remain: 0,
    };

    if (this.mode === 'important' && level !== 'important') { this.stats.suppressed++; return; }
    if (this.mode !== 'full' && level === 'small') { this._small(n); return; }
    this._enqueue(n);
  }

  // ---------- 合并计数 ----------
  _bump(n) {
    const now = performance.now();
    const r = this.recent.get(n.key);
    const add = n.item ? n.add : 1;
    if (r && now - r.ts < MERGE_MS) { r.count += add; r.ts = now; }
    else this.recent.set(n.key, { count: add, ts: now });
    if (this.recent.size > 60) {
      for (const [k, v] of this.recent) if (now - v.ts > MERGE_MS) this.recent.delete(k);
    }
    return this.recent.get(n.key).count;
  }

  // ---------- 主横幅队列 ----------
  _enqueue(n) {
    // 3 秒内相同文案 / 同一物品：合并到正在显示或排队的那条
    const same = (x) => x && x.key === n.key;
    if (same(this.active)) {
      this.active.count = this._bump(n);
      this.stats.merged++;
      this._render(this.active);
      if (!this.paused) this._schedule(this.active, DWELL[this.active.level]);
      return;
    }
    const queued = this.pending.find(same);
    if (queued) { queued.count = this._bump(n); this.stats.merged++; return; }
    n.count = this._bump(n);
    if (n.item && n.count > n.add) this.stats.merged++;
    else if (!n.item && n.count > 1) this.stats.merged++;

    // 任务类（精简模式）：只保留最新一条
    if (n.group && this.mode !== 'full') {
      const before = this.pending.length;
      this.pending = this.pending.filter((x) => x.group !== n.group);
      this.stats.dropped += before - this.pending.length;
      if (this.active && this.active.group === n.group) {
        this.active.msg = n.msg; this.active.type = n.type; this.active.key = n.key; this.active.count = n.count;
        this._render(this.active);
        if (!this.paused) this._schedule(this.active, DWELL[this.active.level]);
        return;
      }
    }

    if (!this.active && !this.paused) { this._present(n); return; }

    if (n.level === 'important') {
      // 插队：排在已有重要提示之后、其他提示之前；正在显示的非重要横幅提前收尾
      let i = 0;
      while (i < this.pending.length && this.pending[i].level === 'important') i++;
      this.pending.splice(i, 0, n);
      if (this.active && this.active.level !== 'important' && !this.paused && this.active.until - performance.now() > 400) this._schedule(this.active, 400);
    } else {
      this.pending.push(n);
    }
    while (this.pending.length > MAX_PENDING) {
      // 丢弃最旧的最低优先级提示
      let low = 0;
      for (let i = 1; i < this.pending.length; i++) if (LEVELS[this.pending[i].level] < LEVELS[this.pending[low].level]) low = i;
      this.pending.splice(low, 1);
      this.stats.dropped++;
    }
  }

  _present(n) {
    const el = document.createElement('div');
    el.className = `toast-item toast-${n.type} notice-banner notice-${n.level}`;
    n.el = el;
    this._render(n);
    this.ui.toast.appendChild(el);
    this.active = n;
    this.stats.shown++;
    this._schedule(n, DWELL[n.level]);
  }

  _render(n) {
    if (!n.el) return;
    n.el.className = `toast-item toast-${n.type} notice-banner notice-${n.level}`;
    n.el.textContent = n.msg;
    if (n.count > 1) {
      const c = document.createElement('span');
      c.className = 'toast-count';
      c.textContent = `×${n.count}`;
      n.el.appendChild(c);
    }
  }

  _schedule(n, ms) {
    clearTimeout(n.timer);
    n.until = performance.now() + ms;
    n.timer = setTimeout(() => this._dismiss(n), ms);
  }

  _dismiss(n) {
    clearTimeout(n.timer);
    if (n.el) n.el.remove();
    if (this.active === n) this.active = null;
    if (this.paused) return;
    const next = this.pending.shift();
    if (next) this._present(next);
  }

  // ---------- 小提示：图标 +数量 / 窄胶囊 ----------
  _small(n) {
    if (n.item) {
      const anchor = this._anchorFor(n.item);
      const name = this.ui.getItemName ? this.ui.getItemName(n.item) : '';
      this.lastItemNames = [{ name, ts: performance.now() }, ...this.lastItemNames.slice(0, 5)];
      if (anchor && !this.paused) { this._pop(n, anchor); return; }
      if (name) n.msg = `${name} +${n.add}`;
    } else {
      // 与刚弹出的物品图标重复的文字（如「拾取了【椰子】！」）不再显示
      const now = performance.now();
      if (this.lastItemNames.some((x) => x.name && now - x.ts < 1000 && n.msg.includes(x.name))) { this.stats.suppressed++; return; }
    }
    this._capsuleShow(n);
  }

  _anchorFor(item) {
    const visible = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) return null;
      return r;
    };
    const bar = this.ui.bottomBar;
    let slot = null;
    if (bar) bar.querySelectorAll('[data-id]').forEach((s) => { if (!slot && s.dataset.id === item) slot = s; });
    const r = visible(slot);
    if (r) return { rect: r, side: 'above' };
    const bag = visible(document.getElementById('btn-open-inv'));
    if (bag) return { rect: bag, side: 'below' };
    return null;
  }

  _pop(n, anchor) {
    const now = performance.now();
    let p = this.pops.find((x) => x.key === n.key);
    if (p) {
      p.count = this._bump(n);
    } else {
      p = { key: n.key, item: n.item, count: this._bump(n), el: document.createElement('div'), timer: null };
      p.el.className = 'notice-pop';
      document.body.appendChild(p.el);
      this.pops.push(p);
      while (this.pops.length > 3) this._popRemove(this.pops[0]);
    }
    this.stats.popped++;
    p.el.innerHTML = `${iconHTML(n.item, 22, { eager: true }) || '📦'}<span class="notice-pop-n">+${p.count}</span>`;
    const idx = this.pops.indexOf(p);
    const r = anchor.rect;
    const w = 72, h = 30, m = 24;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = r.left + r.width / 2 - w / 2;
    let top = anchor.side === 'above' ? r.top - h - 6 - idx * (h + 4) : r.bottom + 6 + idx * (h + 4);
    left = Math.max(m, Math.min(vw - m - w, left));
    top = Math.max(m / 2, Math.min(vh - h - 8, top));
    p.el.style.left = Math.round(left) + 'px';
    p.el.style.top = Math.round(top) + 'px';
    p.el.classList.remove('notice-pop-run');
    void p.el.offsetWidth; // 重新播放淡出动画
    p.el.classList.add('notice-pop-run');
    clearTimeout(p.timer);
    p.timer = setTimeout(() => this._popRemove(p), POP_MS);
    p.ts = now;
  }

  _popRemove(p) {
    clearTimeout(p.timer);
    p.el.remove();
    const i = this.pops.indexOf(p);
    if (i >= 0) this.pops.splice(i, 1);
  }

  _capsuleShow(n) {
    let c = this.capsule;
    const count = this._bump(n);
    if (!c) {
      c = this.capsule = { el: document.createElement('div'), timer: null, key: '' };
      c.el.className = 'notice-capsule';
      this.ui.toast.appendChild(c.el); // 位于主横幅下方（同一容器，column 布局）
    }
    c.key = n.key;
    c.el.textContent = n.item ? n.msg : (count > 1 ? `${n.msg} ×${count}` : n.msg);
    c.el.classList.remove('notice-capsule-run');
    void c.el.offsetWidth;
    c.el.classList.add('notice-capsule-run');
    this.stats.capsules++;
    clearTimeout(c.timer);
    c.timer = setTimeout(() => { if (this.capsule === c) { c.el.remove(); this.capsule = null; } }, POP_MS + 300);
  }

  // ---------- 对话框 / 面板打开时暂停 ----------
  _watchPause() {
    const body = document.body;
    if (!body || typeof MutationObserver === 'undefined') return;
    const check = () => {
      const p = body.classList.contains('hud-dialog-open') || body.classList.contains('hud-modal-open');
      if (p !== this.paused) this._setPaused(p);
    };
    new MutationObserver(check).observe(body, { attributes: true, attributeFilter: ['class'] });
    check();
  }

  _setPaused(p) {
    this.paused = p;
    const a = this.active;
    if (p) {
      if (this.ui.toast) this.ui.toast.classList.add('notice-paused');
      if (a) { a.remain = Math.max(800, a.until - performance.now()); clearTimeout(a.timer); }
      this.pops.slice().forEach((x) => this._popRemove(x));
    } else {
      if (this.ui.toast) this.ui.toast.classList.remove('notice-paused');
      if (a) this._schedule(a, a.remain || DWELL[a.level]);
      else { const next = this.pending.shift(); if (next) this._present(next); }
    }
  }
}

export const NOTICE_CSS = `
  .toast-stack { max-width: min(520px, 60vw); }
  @media (orientation: landscape) { .toast-stack { max-width: min(520px, 60vw, calc(100vw - var(--hud-ql) - var(--hud-qr))); } }
  .toast-stack.notice-paused { visibility: hidden; }
  .notice-banner.notice-important { font-size: 14px; border-width: 2px; }
  .notice-capsule {
    max-width: min(320px, 50vw); padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 18px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f4e8c8; background: rgba(20,36,30,.82);
    border: 1px solid rgba(226,202,148,.28); pointer-events: none;
  }
  .notice-capsule-run { animation: notice-fade 1.5s ease-out forwards; }
  .notice-pop {
    position: fixed; z-index: 520; width: 72px; height: 30px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 3px;
    border-radius: 15px; background: rgba(28,49,40,.9); border: 1px solid rgba(232,205,137,.55); color: #fff1c9;
    font-size: 13px; font-weight: 800; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,.3);
  }
  .notice-pop img, .notice-pop .hud-clay-icon { width: 22px; height: 22px; }
  .notice-pop-n { font-size: 13px; }
  .notice-pop-run { animation: notice-pop 1.2s ease-out forwards; }
  @keyframes notice-pop { 0% { opacity: 0; transform: translateY(6px) scale(.9); } 15% { opacity: 1; transform: translateY(0) scale(1); } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
  @keyframes notice-fade { 0% { opacity: 0; } 12% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .notice-pop-run, .notice-capsule-run { animation: none; } }
  body.hud-modal-open .notice-pop, body.hud-dialog-open .notice-pop { display: none; }
  .notice-opt { flex: 1; min-height: 44px; min-width: 44px; padding: 0 6px; border-radius: 12px; border: 1px solid rgba(229,211,163,.24); background: rgba(246,237,210,.08); color: #f7efd9; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; white-space: nowrap; }
  .notice-opt[aria-pressed="true"] { background: #d9c08a; color: #1e272e; border-color: #d9c08a; }
`;
