// 无第三方依赖的最小 DOM 契约测试：执行真实 UIManager 方法、伙伴目录和图标注册表。
// 与同目录 source-extraction 测试一致；像素布局仍需浏览器/真机验收。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { iconHTML, getSurvivalIconHtml, getWeatherIconHtml } from '../src/ui/IconRegistry.js';

const source = fs.readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const petSource = fs.readFileSync(new URL('../src/systems/PetCompanionSystem.js', import.meta.url), 'utf8');
const PET_CATALOG = vm.runInNewContext(petSource.slice(petSource.indexOf('export const PET_CATALOG'), petSource.indexOf("if (typeof window")).replace('export const', 'const') + '\nPET_CATALOG;');

// 只实现本页使用的 DOM 接口；HTML 经解析后按节点查询，事件支持冒泡。
class Element {
  constructor(tag = 'div', attrs = {}) { this.tag = tag; this.attrs = attrs; this.children = []; this.listeners = {}; this.style = {}; }
  get id() { return this.attrs.id; }
  set id(v) { this.attrs.id = v; }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(el) { this.children.push(el); el.parent = this; return el; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this); this.parent = null; }
  get isConnected() { return this === document.body || !!this.parent?.isConnected; }
  set innerHTML(html) {
    this.children.forEach(el => { el.parent = null; }); this.children = [];
    const stack = [this];
    for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith('</')) { stack.pop(); continue; }
      if (!token.startsWith('<')) { stack.at(-1).appendChild(new Element('#text', { text: token })); continue; }
      const tag = token.match(/^<([\w-]+)/)?.[1];
      const attrs = Object.fromEntries([...token.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      const node = stack.at(-1).appendChild(new Element(tag, attrs));
      if (!['img', 'br', 'input'].includes(tag)) stack.push(node);
    }
  }
  get textContent() { return this.attrs.text || this.children.map(el => el.textContent).join(''); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const attr = selector.match(/^\[([^=]+)="([^"]*)"\]$/);
    return attr ? this.attrs[attr[1]] === attr[2] : this.tag === selector;
  }
  querySelectorAll(selector) { return this.children.flatMap(el => [...(el.matches(selector) ? [el] : []), ...el.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return selector.split(',').some(s => this.matches(s.trim())) ? this : this.parent?.closest(selector); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, extra = {}) {
    const event = { target: this, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, ...extra };
    for (let node = this; node; node = node.parent) {
      for (const fn of node.listeners[type] || []) fn(event);
      if (event.stopped) break;
    }
  }
  click() { this.dispatch('click'); }
  focus() { document.activeElement = this; }
}
const document = { body: new Element('body'), createElement: tag => new Element(tag), getElementById: id => document.body.querySelector(`#${id}`) };
const timers = new Map(); let sequence = 0;
const window = {};
const context = vm.createContext({ document, window, PET_CATALOG, iconHTML, getSurvivalIconHtml, getWeatherIconHtml,
  setInterval(fn, ms) { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
  clearInterval(id) { timers.delete(id); }
});
vm.runInContext(source.replace(/^import .*;.*$/gm, '').replace(/export /g, '') + '\nglobalThis.TestUIManager = UIManager;', context);
const ui = Object.create(context.TestUIManager.prototype);
assert.equal(typeof ui.openCharacterModal, 'function');
assert.match(source, /bindEvents\(\)\s*\{\s*this\._bindCharacterEntry\(\)/);
assert.match(source, /portrait-protagonist-avatar" title="角色" style="cursor:pointer"/);
ui.survival = { life: 61, hunger: 48, water: 37, fatigue: 29, day: 7, steps: 999 };
ui.inventory = { sol_token: 123, sol_crystal: 14, sol_crystal_pure: 3 };
ui.buildSystem = { placedFurniture: [{ drawerCategory: 'facility' }, { drawerCategory: 'comfort' }, { drawerCategory: 'facility' }] };
let resets = 0; ui.player = { resetInput() { resets++; } };
window.__game = { story: { currentChapterId: 2, getCurrentChapter: () => ({ title: '第二章：丛林猴影 (Bub)' }) }, weatherSystem: { currentWeather: 'rain' }, miningRig: { rigLevel: 3 }, shipUpgradeSystem: { currentTierLevel: 2 }, petCompanion: { isUnlocked: id => id === 'bub_monkey' } };
document.body.innerHTML = '<div id="portrait-capsule-wrapper"><img class="portrait-protagonist-avatar"></div><button id="canteen-btn"></button><div id="quest-banner"></div>';
let drinks = 0, quests = 0;
document.getElementById('canteen-btn').addEventListener('click', () => drinks++);
document.getElementById('quest-banner').addEventListener('click', () => quests++);
ui._bindCharacterEntry();
document.body.querySelector('.portrait-protagonist-avatar').click();
assert.ok(document.getElementById('char-overlay'), '点头像打开角色页');
assert.equal(resets, 1);
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].ms, 1000);
const value = key => document.body.querySelector(`[data-char="${key}"]`).textContent;
for (const [key, expected] of Object.entries({ life: '61', hunger: '48', water: '37', fatigue: '29', sol_token: '123', sol_crystal: '14', sol_crystal_pure: '3', rig: 'Lv.3', ship: 'T2', camp: '设施 2 处', chapter: '流落者 · 主线第 2 章', 'day-weather': '第 7 天 · 下雨' })) assert.equal(value(key), expected, key);
assert.ok(document.getElementById('char-overlay').textContent.includes('第二章：丛林猴影 (Bub)'));
assert.equal(document.body.querySelectorAll('.char-heart-on').length, 4);
assert.equal(document.body.querySelectorAll('.char-pet').length, Object.keys(PET_CATALOG).length);
assert.ok(document.body.querySelector('[data-pet="bella_dog"]').textContent.includes('尚未结缘'));
assert.ok(document.body.querySelector('[data-pet="bella_dog"]').matches('.char-pet-locked'));
assert.ok(document.body.querySelector('[data-pet="bub_monkey"]').textContent.includes('巴布'));
assert.ok(document.body.querySelector('[data-pet="bub_monkey"]').textContent.includes(PET_CATALOG.bub_monkey.species));
assert.ok(!document.body.querySelector('[data-pet="bub_monkey"]').textContent.includes(PET_CATALOG.bub_monkey.desc), '伙伴格不显示长描述');
assert.equal(document.body.querySelector('[data-pet="dom_sheep"]').querySelector('.char-pet-avatar').textContent, '高');
ui.survival.life = 40; ui.survival.hunger = 75; ui.inventory.sol_token = 200;
window.__game.miningRig.rigLevel = 4; window.__game.story.currentChapterId = 3;
[...timers.values()][0].fn();
assert.equal(value('life'), '40'); assert.equal(value('hunger'), '75'); assert.equal(value('sol_token'), '200'); assert.equal(value('rig'), 'Lv.4');
assert.equal(value('chapter'), '流落者 · 主线第 3 章');
window.__game.story.currentChapterId = 0; [...timers.values()][0].fn();
assert.equal(value('chapter'), '流落者 · 序章');
window.__game.story.currentChapterId = 3; [...timers.values()][0].fn();
assert.equal(document.body.querySelectorAll('.char-heart-on').length, 2);
const oldTimer = ui._characterTimer;
document.getElementById('portrait-capsule-wrapper').click();
assert.equal(timers.size, 1, '重复打开只保留一个 interval'); assert.ok(!timers.has(oldTimer));
document.body.querySelector('.char-close').click();
assert.equal(document.getElementById('char-overlay'), null);
assert.equal(ui._characterTimer, null); assert.equal(timers.size, 0, '关闭立即清 interval');
document.getElementById('canteen-btn').click(); document.getElementById('quest-banner').click();
assert.equal(drinks, 1); assert.equal(quests, 1); assert.equal(document.getElementById('char-overlay'), null);
// 空系统降级不造状态，不出现 undefined/NaN，也不把累计步数当今日步数。
window.__game = {}; ui.survival = {}; ui.inventory = {}; ui.buildSystem = {};
ui.openCharacterModal();
assert.equal(value('life'), '—'); assert.equal(value('sol_token'), '0'); assert.equal(value('rig'), '—');
assert.equal(value('chapter'), '流落者');
assert.doesNotMatch(document.getElementById('char-overlay').textContent, /undefined|NaN|今日步数|潮汐|守夜中|尚未结缘/);
ui._characterOverlay.remove(); [...timers.values()][0].fn(); assert.equal(timers.size, 0, '意外移除也清理 interval');
console.log('Character panel: DOM values, avatar/capsule entry, refresh, companions, fallbacks and timer cleanup passed.');

// 与现有 UI verify 脚本共用浏览器脚手架；依赖与本地 dev server 就绪后可加 --browser。
if (process.argv.includes('--browser')) {
  const { browserSession } = await import('../tools/lib/browser-session.mjs');
  await browserSession(async ({ evaluate, send, wait }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const initial = await evaluate(`(() => {
      const g = window.__game;
      Object.assign(g.survival, { life: 61, hunger: 48, water: 37, fatigue: 29, day: 7 });
      Object.assign(g.ui.inventory, { sol_token: 123, sol_crystal: 14, sol_crystal_pure: 3 });
      g.miningRig.rigLevel = 3;
      g.story.currentChapterId = 2;
      g.petCompanion.unlockedPets = ['bub_monkey'];
      document.querySelector('.portrait-protagonist-avatar').click();
      const root = document.getElementById('char-overlay');
      const read = key => root.querySelector('[data-char="' + key + '"]').textContent;
      return { life: read('life'), hunger: read('hunger'), token: read('sol_token'), rig: read('rig'), chapter: read('chapter'),
        locked: root.querySelector('[data-pet="bella_dog"]').textContent.includes('尚未结缘') };
    })()`);
    assert.deepEqual(initial, { life: '61', hunger: '48', token: '123', rig: 'Lv.3', chapter: '流落者 · 主线第 2 章', locked: true });
    await evaluate(`window.__game.ui.inventory.sol_token = 321`);
    await wait(1200);
    assert.equal(await evaluate(`document.querySelector('[data-char="sol_token"]').textContent`), '321');
    // 全员解锁、最长描述都出现时，整页与每张卡仍在 390×844 视口内。
    const layout = await evaluate(`(() => {
      const ui = window.__game.ui;
      window.__game.petCompanion.unlockedPets = ['bub_monkey', 'bella_dog', 'raymond_cat', 'dom_sheep'];
      ui._renderCharacterPanel(document.querySelector('.char-content'));
      const page = document.querySelector('.char-page');
      return { fits: page.scrollHeight <= page.clientHeight && page.scrollWidth <= page.clientWidth,
        cardsFit: [...document.querySelectorAll('.char-card')].every(el => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844 && el.scrollHeight <= el.clientHeight;
        }) };
    })()`);
    assert.equal(layout.fits, true); assert.equal(layout.cardsFit, true);
    const closed = await evaluate(`(() => {
      const ui = window.__game.ui, timer = ui._characterTimer;
      const original = window.clearInterval;
      let cleared = false;
      window.clearInterval = id => { if (id === timer) cleared = true; original(id); };
      document.querySelector('.char-close').click();
      window.clearInterval = original;
      return { removed: !document.getElementById('char-overlay'), cleared, timer: ui._characterTimer };
    })()`);
    assert.deepEqual(closed, { removed: true, cleared: true, timer: null });
  });
  console.log('Character panel: Chromium DOM and 390×844 layout passed.');
}
