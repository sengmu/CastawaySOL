// 黏土图标集成（2026-10-31）：统一的图标注册表
// - public/icons/{items,tools,menu,hud}/*.png：128x128 透明 PNG（黏土质感）
// - iconHTML(id, size)：id 可以是游戏物品 id（如 'apple'、'stone_axe'），也可以是图标路径（如 'hud/attack'）
//   有图返回 <img loading="lazy">；没有图（或图片加载失败）回退为原 emoji
// - 合并了 UIManager.getItemIcon（53 项）与 CraftingSystem.itemDefs（34 项）两张 emoji 表

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

// 已有的图标文件（文件名去掉 .png）
const AVAILABLE = new Set([
  'items/apple', 'items/coconut', 'items/fish_raw', 'items/fish_grilled', 'items/meat_cooked', 'items/meat_raw', 'items/water_bamboo',
  'items/stick', 'items/bark', 'items/resin', 'items/vine', 'items/flint', 'items/log', 'items/plank', 'items/nails', 'items/iron_ore',
  'items/tinder', 'items/torch', 'items/sol_token', 'items/sol_crystal',
  'tools/stone_axe', 'tools/stone_pickaxe', 'tools/fishing_rod', 'tools/flint_spear', 'tools/hunting_bow', 'tools/stone_hammer',
  'menu/crafting_table', 'menu/camp', 'menu/shop', 'menu/manual',
  'hud/mining_rig', 'hud/backpack', 'hud/menu', 'hud/interact', 'hud/attack', 'hud/sprint', 'hud/jump',
  // 黏土图标第二批（2026-10-31）：35 个物品图
  'items/baked_apple', 'items/broken_radio', 'items/battery', 'items/working_radio', 'items/raft', 'items/flint_arrow', 'items/rocket', 'items/bone_armor', 'items/herb_salve', 'items/energy_drink', 'items/iron_ingot', 'items/trap', 'items/thorn', 'items/crab_shield', 'items/crab_meat_raw', 'items/crab_meat_cooked', 'items/hide', 'items/crab_shell', 'items/big_backpack', 'items/golden_coconut', 'items/bird_egg', 'items/ancient_coin', 'items/map_fragment', 'items/pearl', 'items/tough_bark', 'items/crab', 'items/sardine', 'items/smoked_fish', 'items/big_rock', 'items/feather', 'items/copper_ore', 'items/steel_pickaxe', 'items/sos_sign', 'items/clam', 'items/grilled_clam'
]);

// 游戏物品 id → 图标文件
const ITEM_IMAGE = {
  apple: 'items/apple', coconut: 'items/coconut',
  fish: 'items/fish_raw', baked_fish: 'items/fish_grilled',
  raw_meat: 'items/meat_raw', cooked_meat: 'items/meat_cooked', baked_meat: 'items/meat_cooked',
  canteen_clean_water: 'items/water_bamboo', bamboo_canteen: 'items/water_bamboo',
  tree_branch: 'items/stick', tree_bark: 'items/bark', tree_sap: 'items/resin', ivy: 'items/vine',
  stone_chunk: 'items/flint', lumber: 'items/log', wood_plank: 'items/plank', nail: 'items/nails', iron_ore: 'items/iron_ore',
  kindling: 'items/tinder', torch: 'items/torch', sol_token: 'items/sol_token', sol_crystal: 'items/sol_crystal',
  stone_axe: 'tools/stone_axe', stone_pickaxe: 'tools/stone_pickaxe', fishingrod: 'tools/fishing_rod',
  spear: 'tools/flint_spear', wooden_bow: 'tools/hunting_bow', bow_arrow: 'tools/hunting_bow', stone_hammer: 'tools/stone_hammer',
  // 黏土图标第二批（2026-10-31）
  baked_apple: 'items/baked_apple', broken_radio: 'items/broken_radio', battery: 'items/battery', workradio: 'items/working_radio',
  escape_raft: 'items/raft', flint_arrow: 'items/flint_arrow', fire_arrow: 'items/rocket', bone_armor: 'items/bone_armor',
  herbal_paste: 'items/herb_salve', energy_drink: 'items/energy_drink', iron_ingot: 'items/iron_ingot', beast_trap: 'items/trap',
  wooden_spikes: 'items/thorn', crab_shield: 'items/crab_shield', crab_meat: 'items/crab_meat_raw', cooked_crab: 'items/crab_meat_cooked',
  beast_hide: 'items/hide', crab_shell: 'items/crab_shell', large_backpack: 'items/big_backpack', golden_coconut: 'items/golden_coconut',
  bird_egg: 'items/bird_egg', ancient_coin: 'items/ancient_coin', treasure_map_piece: 'items/map_fragment', pearl: 'items/pearl',
  tough_bark: 'items/tough_bark', sea_crab: 'items/crab', sardine: 'items/sardine', smoked_fish: 'items/smoked_fish',
  big_rock: 'items/big_rock', feather: 'items/feather', copper_ore: 'items/copper_ore', iron_pickaxe: 'items/steel_pickaxe',
  sos_sign: 'items/sos_sign', clam: 'items/clam', baked_clam: 'items/grilled_clam'
};

// 合并后的 emoji 表（没有新图时使用；冲突 id 以新图为准，workradio 无新图沿用 CraftingSystem 的 📡 以区别故障无线电 📻）
const ITEM_EMOJI = {
  apple: '🍎', coconut: '🥥', tree_branch: '🪵', tree_bark: '🍂', tree_sap: '🍯', ivy: '🌿', lumber: '🪵', wood_plank: '🪵',
  stone_chunk: '🪨', big_rock: '⛰️', feather: '🪶', nail: '🔩', iron_ore: '⛏️', copper_ore: '🪨', iron_ingot: '🧱',
  canteen_clean_water: '🚰', bamboo_canteen: '🍶', fish: '🐟', sardine: '🐟', clam: '🐚', raw_meat: '🥩',
  baked_fish: '🍱', smoked_fish: '🍱', baked_apple: '🥧', baked_clam: '🦪', baked_meat: '🍖', cooked_meat: '🍖',
  crab_meat: '🦀', cooked_crab: '🦀', sea_crab: '🦀', golden_coconut: '🥥', bird_egg: '🥚', energy_drink: '🧃', herbal_paste: '🩹',
  kindling: '🔥', torch: '🔦', fishingrod: '🎣', stone_axe: '🪓', stone_pickaxe: '⛏️', iron_pickaxe: '⚒️', stone_hammer: '🔨',
  spear: '🗡️', wooden_bow: '🏹', bow_arrow: '🏹', flint_arrow: '🏹', fire_arrow: '🏹🔥',
  bone_armor: '🦺', crab_shield: '🛡️', crab_shell: '🛡️', beast_hide: '🧶', beast_trap: '🪤', wooden_spikes: '🪵',
  broken_radio: '📻', workradio: '📡', battery: '🔋', sos_sign: '🆘', escape_raft: '⛵', large_backpack: '🎒',
  ancient_coin: '🪙', treasure_map_piece: '🗺️', pearl: '🦪', tough_bark: '🍂', sol_crystal: '💎', sol_token: '🪙'
};

// 界面图标路径没有图时的 emoji
const UI_EMOJI = {
  'hud/mining_rig': '⛏️', 'hud/backpack': '🎒', 'hud/menu': '☰', 'hud/interact': '💬', 'hud/attack': '⚔️', 'hud/sprint': '⚡', 'hud/jump': '🦘',
  'menu/crafting_table': '🔨', 'menu/camp': '🏕️', 'menu/shop': '🛒', 'menu/manual': '📖'
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function iconPath(id) {
  if (!id) return null;
  const p = ITEM_IMAGE[id] || (AVAILABLE.has(id) ? id : null);
  return p && AVAILABLE.has(p) ? p : null;
}

export function iconEmoji(id) {
  return ITEM_EMOJI[id] || UI_EMOJI[id] || '📦';
}

export function hasIcon(id) {
  return !!iconPath(id);
}

// size：数字按 px，字符串原样（默认 1.25em，跟随所在文字大小）；opts.eager 用于首屏 HUD
export function iconHTML(id, size = '1.25em', opts = {}) {
  const path = iconPath(id);
  const emoji = iconEmoji(id);
  if (!path) return emoji;
  const s = typeof size === 'number' ? `${size}px` : size;
  const cls = opts.className ? `clay-icon ${opts.className}` : 'clay-icon';
  const loading = opts.eager ? 'eager' : 'lazy';
  // 加载失败时换回 emoji 文字
  const fallback = `this.replaceWith(document.createTextNode(this.dataset.emoji))`;
  return `<img class="${cls}" src="${BASE}icons/${path}.png" alt="" aria-hidden="true" draggable="false" loading="${loading}" decoding="async" data-icon="${esc(path)}" data-emoji="${esc(emoji)}" style="width:${s};height:${s};" onerror="${fallback}">`;
}

export const ICON_REGISTRY_STATS = { images: AVAILABLE.size, itemImages: Object.keys(ITEM_IMAGE).length, itemEmoji: Object.keys(ITEM_EMOJI).length };