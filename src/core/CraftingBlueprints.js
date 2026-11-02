// CastawaySOL - 全局合成配方知识库与图鉴系统 (Crafting Blueprints & Pokédex)
// 包含 4 大学科分类：战斗装具、求生工具、烹饪医疗、营建逃脱，共 26 套经典合成蓝图

export const CRAFTING_CATEGORIES = {
  all: { id: 'all', name: '全部图鉴', icon: '📖' },
  combat: { id: 'combat', name: '武器防具', icon: '⚔️' },
  tools: { id: 'tools', name: '求生工具', icon: '🛠️' },
  medical_food: { id: 'medical_food', name: '烹饪医疗', icon: '🍖' },
  escape_base: { id: 'escape_base', name: '营建逃脱', icon: '⛵' }
};

export const CRAFTING_BLUEPRINTS = [
  // ================= 1. 武器与防御装具 (Combat & Defense) =================
  {
    id: 'spear',
    category: 'combat',
    a: 'ivy',
    b: 'stone_chunk',
    result: 'spear',
    count: 1,
    name: '燧石战矛 🗡️',
    hint: '柔韧藤蔓捆绑坚硬燧石，打造远距离强力突刺兵刃',
    desc: '按 [F] 或右下角攻击键发动强力突刺，造成 38 点伤害，3.2 米攻击范围！'
  },
  {
    id: 'wooden_bow',
    category: 'combat',
    a: 'beast_hide',
    b: 'tree_branch',
    result: 'wooden_bow',
    count: 1,
    name: '简易猎弓 🏹',
    hint: '加厚兽皮韧弦与弹性硬木结合，制成远程抛物线抛射武器',
    desc: '按 [R] 键切换远程射击模式，射出物理抛物线羽箭，远距激怒引怪！'
  },
  {
    id: 'flint_arrow',
    category: 'combat',
    a: 'stone_chunk',
    b: 'tree_bark',
    result: 'flint_arrow',
    count: 5,
    name: '燧石羽箭 🏹 (x5)',
    hint: '锋利燧石碎片与干燥轻羽树皮绑缚制成箭矢',
    desc: '猎弓专属远程弹药，击中野兽造成 28 点贯穿伤害，落空有 50% 概率地表回收！'
  },
  {
    id: 'beast_trap',
    category: 'combat',
    a: 'nail',
    b: 'stone_chunk',
    result: 'beast_trap',
    count: 1,
    name: '齿状捕兽夹 🪤',
    hint: '坚固铁钉与坚石打造的机械咬合地表陷阱',
    desc: '点击放置在脚下，踏入的野兽遭受 45 点重伤并陷入长达 4 秒的禁锢破绽！'
  },
  {
    id: 'wooden_spikes',
    category: 'combat',
    a: 'lumber',
    b: 'tree_branch',
    result: 'wooden_spikes',
    count: 1,
    name: '防兽尖木拒马 🪵',
    hint: '削尖重型圆木与横向硬木捆扎构成的反击工事',
    desc: '筑于营地四周，硬直阻断狂暴野猪高速冲撞，反弹 50 点重创并眩晕！'
  },
  {
    id: 'crab_shield',
    category: 'combat',
    a: 'crab_shell',
    b: 'wood_plank',
    result: 'crab_shield',
    count: 1,
    name: '坚甲木盾 🛡️',
    hint: '天然抗压巨蟹硬背甲与轻韧木板铆接防具',
    desc: '常驻存放在行囊中即可起效，被动减免 50% 受到的肉体与爪击伤害！'
  },
  {
    id: 'bone_armor',
    category: 'combat',
    a: 'beast_hide',
    b: 'crab_shell',
    result: 'bone_armor',
    count: 1,
    name: '甲壳兽皮胸甲 🦺',
    hint: '缝制兽皮衬里并嵌合弧形蟹壳制成复合防具',
    desc: '点击装备永久提升 +25 点生命上限，并赋予面对野兽冲撞的霸体抗性！'
  },
  {
    id: 'fire_arrow',
    category: 'combat',
    a: 'flint_arrow',
    b: 'tree_sap',
    result: 'fire_arrow',
    count: 3,
    name: '烈焰爆燃箭 🏹🔥 (x3)',
    hint: '在燧石羽箭箭簇浸透易燃粘稠树脂',
    desc: '远程发射命中野兽造成爆炸火光，附加持续 5 秒的爆燃灼烧伤害！'
  },

  // ================= 2. 求生工具与工序 (Survival Tools) =================
  {
    id: 'stone_axe',
    category: 'tools',
    a: 'stone_chunk',
    b: 'tree_branch',
    result: 'stone_axe',
    count: 1,
    name: '锋利石斧 🪓',
    hint: '坚硬燧石以木棍为柄捆扎绑紧的重砍伐工具',
    desc: '可砍倒枯树与密集灌木，高效获取建筑重型圆木！'
  },
  {
    id: 'stone_pickaxe',
    category: 'tools',
    a: 'lumber',
    b: 'stone_chunk',
    result: 'stone_pickaxe',
    count: 1,
    name: '骨柄石镐 ⛏️',
    hint: '重型圆木做手柄，顶部嵌合锋利燧石琢凿工具',
    desc: '能敲凿开采火山石岛与海蚀矿床中的富铁矿石！'
  },
  {
    id: 'stone_hammer',
    category: 'tools',
    a: 'big_rock',
    b: 'tree_branch',
    result: 'stone_hammer',
    count: 1,
    name: '重装石锤 🔨',
    hint: '沉重的大礁石与粗木棍加固而成的敲砸重器',
    desc: '用于岩石粉碎、构件压合及加固海难大木筏！'
  },
  {
    id: 'fishingrod',
    category: 'tools',
    a: 'ivy',
    b: 'tree_branch',
    result: 'fishingrod',
    count: 1,
    name: '简易鱼竿 🎣',
    hint: '弹性木枝条系上柔韧耐磨悬崖藤蔓',
    desc: '在近海潮汐泛白翻腾处下饵垂钓，捕获新鲜肥美海鱼！'
  },
  {
    id: 'torch',
    category: 'tools',
    a: 'tree_branch',
    b: 'tree_sap',
    result: 'torch',
    count: 1,
    name: '探险火把 🕯️',
    hint: '长木棍顶端厚厚涂抹琥珀色粘性树脂',
    desc: '提供大范围暖光高光照明，照亮暗夜丛林与幽深密穴，驱赶微型爬虫！'
  },
  {
    id: 'kindling',
    category: 'tools',
    a: 'tree_bark',
    b: 'tree_branch',
    result: 'kindling',
    count: 1,
    name: '引火物 🔥',
    hint: '坚韧木棍与干燥粗糙树皮摩擦生热制成的引信',
    desc: '在营地篝火处烤制生肉、海鱼与热饮必备的点火助燃剂！'
  },
  {
    id: 'large_backpack',
    category: 'tools',
    a: 'beast_hide',
    b: 'ivy',
    result: 'large_backpack',
    count: 1,
    name: '拓荒者大皮包 🎒',
    hint: '加厚保暖兽皮用坚韧藤蔓经纬密密缝合',
    desc: '使用后永久扩充个人随身行囊存储容量 +4 个储物格！'
  },
  {
    id: 'bamboo_canteen',
    category: 'tools',
    a: 'ivy',
    b: 'tree_bark',
    result: 'bamboo_canteen',
    count: 1,
    name: '便携树皮水壶 🍶',
    hint: '紧实树皮内层以藤蔓缠裹锁紧的水囊',
    desc: '可在营地净水滴滤台取水装满，外出探索随时补充 50 点饮水！'
  },
  {
    id: 'geo_scanner_mk1',
    category: 'tools',
    minChapter: 2,
    a: 'copper_ore',
    b: 'battery',
    result: 'geo_scanner_mk1',
    count: 1,
    name: '地质共振扫描仪 Mk1 📡',
    hint: '孔雀铜矿与蓄电电池连接，制成初阶地脉行波探测仪（第二章解锁）',
    desc: '在矿机控制台安装后，每轮可勘探出 1 条包含主矿脉的行或列！'
  },
  {
    id: 'geo_scanner_mk2',
    category: 'tools',
    a: 'geo_scanner_mk1',
    b: 'iron_ingot',
    result: 'geo_scanner_mk2',
    count: 1,
    name: '精密共振扫描仪 Mk2 🛰️',
    hint: '精炼铁锭加固外壳并扩充振荡器',
    desc: '在矿机控制台安装后，每轮锁定 4 个高能候选格，大幅提升勘探中签率！'
  },
  {
    id: 'geo_scanner_mk3',
    category: 'tools',
    a: 'geo_scanner_mk2',
    b: 'treasure_map_piece',
    result: 'geo_scanner_mk3',
    count: 1,
    name: '全域量子扫描仪 Mk3 🌌',
    hint: '古藏宝图古老地脉坐标与精密扫描仪融合',
    desc: '在矿机控制台安装后，精确透视 3 个热脉格，主脉预测准确率达 80%！'
  },

  // ================= 3. 烹饪与野外医疗 (Cooking & Medical) =================
  {
    id: 'herbal_paste',
    category: 'medical_food',
    a: 'tree_bark',
    b: 'tree_sap',
    result: 'herbal_paste',
    count: 1,
    name: '止血树脂敷膏 🩹',
    hint: '药用树皮纤维捣碎浸入抑菌天然树脂',
    desc: '使用瞬间愈合伤口，恢复 40 点生命值并立即清除流血创伤！'
  },
  {
    id: 'cooked_meat',
    category: 'medical_food',
    a: 'raw_meat',
    b: 'tree_branch',
    result: 'cooked_meat',
    count: 1,
    name: '香烤野味排骨 🍖',
    hint: '带骨新鲜生兽肉用削尖细木枝穿串慢烤',
    desc: '肉香四溢，大块朵颐！大幅恢复 75 饥饿度、35 生命值，降低 20 疲劳！'
  },
  {
    id: 'cooked_crab',
    category: 'medical_food',
    a: 'crab_meat',
    b: 'tree_branch',
    result: 'cooked_crab',
    count: 1,
    name: '香烤极品红蟹 🦀',
    hint: '细嫩红蟹肉穿串置于炭火红烬上慢火炙烤',
    desc: '鲜美香甜，肉质饱满！恢复 55 饥饿度、25 生命值，降低 10 疲劳！'
  },
  {
    id: 'baked_apple',
    category: 'medical_food',
    a: 'apple',
    b: 'tree_branch',
    result: 'baked_apple',
    count: 1,
    name: '糖心烤苹果 🥧',
    hint: '鲜红野苹果穿串在营火边缘烤出焦糖香气',
    desc: '温热软糯，清甜解乏！恢复 35 饥饿度、15 生命值！'
  },
  {
    id: 'baked_fish',
    category: 'medical_food',
    a: 'fish',
    b: 'tree_branch',
    result: 'baked_fish',
    count: 1,
    name: '香脆烤鱼串 🍱',
    hint: '新鲜海鱼剖洗后用树枝横穿并在炭火上翻烤',
    desc: '外酥里嫩，营养极高！恢复 65 饥饿度、25 生命值！'
  },
  {
    id: 'energy_drink',
    category: 'medical_food',
    a: 'apple',
    b: 'coconut',
    result: 'energy_drink',
    count: 1,
    name: '清甜鲜萃果浆 🧃',
    hint: '破开椰子倒入酸甜苹果肉融合捣匀',
    desc: '神清气爽！恢复 30 饥饿、50 饮水，并瞬间降低 35 疲劳！'
  },
  {
    id: 'resonance_crab_pot',
    category: 'medical_food',
    a: 'cooked_crab',
    b: 'coconut',
    result: 'resonance_crab_pot',
    count: 1,
    name: '共振浓香椰子蟹煲 🍲✨',
    hint: '香烤极品红蟹与海岛椰汁温火炖煮',
    desc: '食用后获得「晶爆」灵感：接下来 3 轮共振勘探晶爆触发概率提升 1.5 倍！'
  },

  // ================= 4. 营建与逃脱主线 (Base & Escape) =================
  {
    id: 'wood_plank',
    category: 'escape_base',
    a: 'lumber',
    b: 'stone_axe',
    result: 'wood_plank',
    count: 2,
    name: '优质木板 🪵 (x2)',
    hint: '用石斧沿木纹精准劈开打磨重型圆木',
    desc: '平整厚实的建筑与防具板材，可制作盾牌或修补木筏！'
  },
  {
    id: 'iron_ingot',
    category: 'escape_base',
    a: 'iron_ore',
    b: 'tree_branch',
    result: 'iron_ingot',
    count: 1,
    name: '精炼铁质构件 🧱',
    hint: '富铁矿石以坚韧木柴为燃料高温锻打冶炼',
    desc: '高强度纯铁材料，用于精密仪器修补、精钢锻镐与坚固机械改装！'
  },
  {
    id: 'workradio',
    category: 'escape_base',
    a: 'sol_crystal_pure',
    b: 'broken_radio',
    result: 'workradio',
    count: 1,
    name: '精炼工作收音机 📻',
    hint: '高纯度精炼硅晶谐振模块装入故障电台调谐槽',
    desc: '【逃脱结局1：直升机救援】前往南岸平坦沙滩 S.O.S 地标发报呼叫空中搜救！'
  },
  {
    id: 'workradio_battery',
    category: 'escape_base',
    a: 'battery',
    b: 'broken_radio',
    result: 'workradio',
    count: 1,
    name: '工作收音机 📻 (电池备选)',
    hint: '高能干电池准确装入故障电台干燥电池槽',
    desc: '【逃脱结局1：直升机救援】前往南岸平坦沙滩 S.O.S 地标发报呼叫空中搜救！'
  },
  {
    id: 'escape_raft',
    category: 'escape_base',
    a: 'lumber',
    b: 'nail',
    result: 'escape_raft',
    count: 1,
    name: '求生大木筏 ⛵',
    hint: '4根粗壮圆木以坚固铁钉与榫卯紧密排布加固',
    desc: '【逃脱结局2/6/8：扬帆起航】前往西南浅滩简易码头起航横渡大洋！'
  }
];

// 本地解锁图鉴持久化存储键名与默认基础配方
const STORAGE_KEY_DISCOVERED = 'castawaysol_blueprints_discovered';
const DEFAULT_DISCOVERED_IDS = [
  'kindling', 'torch', 'stone_axe', 'fishingrod',
  'spear', 'wooden_bow', 'flint_arrow', 'cooked_meat'
];

let _inMemoryDiscovered = null;

export class CraftingBlueprintManager {
  // 根据任意两件物品（不分先后）寻找匹配蓝图
  static findBlueprint(itemA, itemB) {
    if (!itemA || !itemB) return null;
    const pair = [itemA, itemB].sort().join('+');
    return CRAFTING_BLUEPRINTS.find(bp => [bp.a, bp.b].sort().join('+') === pair) || null;
  }

  // 根据分类获取蓝图列表
  static getBlueprintsByCategory(category = 'all') {
    if (!category || category === 'all') {
      return CRAFTING_BLUEPRINTS;
    }
    return CRAFTING_BLUEPRINTS.filter(bp => bp.category === category);
  }

  // 获取已解锁的蓝图 ID 列表
  static getDiscoveredIds() {
    if (typeof localStorage === 'undefined') {
      if (!_inMemoryDiscovered) {
        _inMemoryDiscovered = [...DEFAULT_DISCOVERED_IDS];
      }
      return _inMemoryDiscovered;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISCOVERED);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // 忽略解析错误
    }
    // 初次游玩默认解锁 8 个基础核心配方
    this.saveDiscoveredIds(DEFAULT_DISCOVERED_IDS);
    return [...DEFAULT_DISCOVERED_IDS];
  }

  // 保存已解锁蓝图
  static saveDiscoveredIds(ids) {
    if (typeof localStorage === 'undefined') {
      _inMemoryDiscovered = [...ids];
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_DISCOVERED, JSON.stringify(ids));
    } catch {
      // 忽略存储异常
    }
  }

  // 记录新蓝图解锁，若为首次探明返回 true
  static unlockBlueprint(blueprintId) {
    const list = this.getDiscoveredIds();
    if (!list.includes(blueprintId)) {
      list.push(blueprintId);
      this.saveDiscoveredIds(list);
      return true; // 首次发现！
    }
    return false;
  }

  // 获取图鉴发现统计（已解锁数、总数、百分比）
  static getDiscoveryProgress() {
    const discovered = this.getDiscoveredIds();
    const total = CRAFTING_BLUEPRINTS.length;
    const unlockedCount = CRAFTING_BLUEPRINTS.filter(bp => discovered.includes(bp.id)).length;
    const percent = Math.round((unlockedCount / total) * 100);
    return { unlockedCount, total, percent };
  }
}
