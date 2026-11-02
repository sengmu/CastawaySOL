// CastawaySOL - 移植自 GBC《Survival Kids (Konami 1999)》全套 Merge 合成与道具配方系统

export class CraftingSystem {
  constructor() {
    // 道具元数据字典（名称、图标、分类、描述）
    this.itemDefs = {
      tree_branch: { name: '坚韧木棍', icon: '🪵', category: 'material', desc: '摇树或海滩拾取的木棍，可做手柄、支架或简易工具。' },
      tree_bark: { name: '干燥树皮', icon: '🍂', category: 'material', desc: '粗糙干燥的树皮纤维，极易点燃，是钻木取火的最佳引信。' },
      tree_sap: { name: '粘性树脂', icon: '🍯', category: 'material', desc: '松柏树分泌的琥珀色油脂，常用于固定工具或制作火把。' },
      ivy: { name: '坚韧藤蔓', icon: '🌿', category: 'material', desc: '悬崖峭壁垂下的坚韧藤蔓，耐磨抗拉，可作为钓线与捆扎绳。' },
      stone_chunk: { name: '坚硬燧石', icon: '🪨', category: 'material', desc: '海滩礁石边缘敲下的坚硬燧石，敲击生火或打磨锋利刃部。' },
      big_rock: { name: '海滩大礁石', icon: '⛰️', category: 'material', desc: '沉重结实的天然岩块，可作为敲打石锤或在沙滩摆设 SOS。' },
      feather: { name: '海鸟羽毛', icon: '🪶', category: 'material', desc: '海鸥或丛林野鸟脱落的羽毛，可用于制作箭尾羽。' },
      lumber: { name: '重型圆木', icon: '🪵', category: 'material', desc: '用石斧砍伐密林巨树所取得的厚实木料，是造筏的核心龙骨。' },
      nail: { name: '生锈铁钉', icon: '🔩', category: 'material', desc: '从海难沉船残骸中撬出的金属钉，木筏与建筑紧固必备。' },
      iron_ore: { name: '富铁矿石', icon: '⛏️', category: 'material', desc: '火山海蚀矿石岛开采出的赤铁原矿，可在营地熔炉冶炼纯净铁锭。' },
      copper_ore: { name: '孔雀铜矿', icon: '🪨', category: 'material', desc: '泛着古铜青绿的铜矿原石，用于精密机械与前哨电气元件。' },
      iron_ingot: { name: '精密铁锭', icon: '🧱', category: 'material', desc: '高温熔炉锻打冶炼的高硬度纯铁锭，是工业级高阶工具的核心。' },
      broken_radio: { name: '故障无线电', icon: '📻', category: 'special', desc: '被海水浸湿的便携应急电台，装入干燥电池即可恢复呼救功能。' },
      battery: { name: '高能干电池', icon: '🔋', category: 'special', desc: '完好无损的应急干电池，可为无线电设备供应充足电能。' },
      sol_crystal_pure: { name: '高纯度精炼硅晶', icon: '💎', category: 'special', desc: '纯晶精炼炉提炼出的高纯度晶石，质地澄澈，是高阶科技与灯塔工程核心。' },
      sol_crystal_deep: { name: '深层海脉晶核', icon: '🔮', category: 'special', desc: '浮木岛沉船海沟与深海矿脉产出的幽蓝晶核，蕴含充沛地脉能量。' },

      // 工具类
      kindling: { name: '引火物', icon: '🔥', category: 'tool', desc: '木棍与干燥树皮研磨出的引火物，靠近营地篝火可烹饪生食。' },
      torch: { name: '明亮火把', icon: '🔦', category: 'tool', desc: '涂抹了树脂的长木棍火把，在暗夜与幽深洞穴中提供广角照明。' },
      fishingrod: { name: '手工钓竿', icon: '🎣', category: 'tool', desc: '柔韧枝条与藤蔓组装的钓竿，在近海有鱼影翻腾处钓起大鱼。' },
      stone_axe: { name: '锋利石斧', icon: '🪓', category: 'tool', desc: '燧石与木柄牢固捆扎的石斧，可砍倒枯树获取优质建筑木料。' },
      stone_pickaxe: { name: '骨柄石镐', icon: '⛏️', category: 'tool', desc: '硬燧石与粗木柄紧固捆扎的手工采矿镐，能凿碎并采集矿石岛富铁矿石！' },
      iron_pickaxe: { name: '精钢锻镐', icon: '⚒️', category: 'tool', desc: '由纯铁锭与圆木打造的耐用重型矿镐，开采效率极大提升！' },
      stone_hammer: { name: '重装石锤', icon: '🔨', category: 'tool', desc: '重石与坚固木棍合成的石锤，敲打矿石或在沙滩固定大木筏。' },
      bow_arrow: { name: '简易猎弓', icon: '🏹', category: 'tool', desc: '藤蔓与柔韧枝条弯制的猎弓，配备羽毛箭矢，可狩猎野鹿。' },
      workradio: { name: '工作收音机', icon: '📡', category: 'tool', desc: '成功组装的无线电台！在沙滩发射 SOS 搜救广播即可呼叫直升机！' },
      sos_sign: { name: 'SOS 巨石阵', icon: '🆘', category: 'build', desc: '在平坦开阔的南岸沙滩排布的巨型 SOS 标志，高空极易侦测。' },
      escape_raft: { name: '求生大木筏', icon: '⛵', category: 'build', desc: '4根圆木+2根藤蔓+铁钉牢固组装的航海大木筏，能容纳全员起航！' },

      // 食材与料理类
      apple: { name: '野生红苹果', icon: '🍎', category: 'food', desc: '摇树掉落的脆甜野苹果，恢复 15% 饱食与 10% 饮水。' },
      coconut: { name: '热带椰子', icon: '🥥', category: 'food', desc: '天然椰汁与厚实果肉，恢复 25% 饮水并大幅提神！' },
      clam: { name: '新鲜海蛤', icon: '🐚', category: 'food', desc: '退潮时在礁石滩挖取的新鲜生蛤蜊，建议烤熟后食用防腹泻。' },
      fish: { name: '新鲜海鱼', icon: '🐟', category: 'food', desc: '刚钓上来的鲜美野生海鱼，富含蛋白质。' },
      raw_meat: { name: '新鲜生肉', icon: '🥩', category: 'food', desc: '岛上猎捕的生兽肉，切勿生食，必须烤熟！' },
      baked_apple: { name: '焦糖烤苹果', icon: '🥧', category: 'food', desc: '篝火慢煨的甜香烤苹果，恢复 25% 饱食，消除疲劳。' },
      baked_clam: { name: '碳烤海蛤', icon: '🦪', category: 'food', desc: '壳内滋滋冒油的碳烤海蚌，鲜美多汁，恢复 20% 生命与 30% 饱食。' },
      baked_fish: { name: '香烤大鱼', icon: '🍱', category: 'food', desc: '香脆可口的营地烤鱼，大幅恢复 25% 生命与 45% 饱食度！' },
      baked_meat: { name: '篝火烤肉排', icon: '🍖', category: 'food', desc: '肉香四溢的极品烤肉，体力满血复活的神级料理！' }
    };

    // 核心合成配方字典
    this.recipes = [
      {
        id: 'kindling',
        name: '引火物 (Kindling)',
        desc: '木棍 + 树皮：在营地篝火处烤制美味熟食的必备燃料',
        req: { tree_branch: 1, tree_bark: 1 },
        result: { id: 'kindling', name: '引火物', count: 1 }
      },
      {
        id: 'torch',
        name: '明亮火把 (Torch)',
        desc: '木棍 + 树脂：夜间与洞穴探索的广角高光照明工具',
        req: { tree_branch: 1, tree_sap: 1 },
        result: { id: 'torch', name: '明亮火把', count: 1 }
      },
      {
        id: 'stone_axe',
        name: '锋利石斧 (Stone Axe)',
        desc: '木棍 + 坚硬燧石：砍伐灌木枯树获得优质木料',
        req: { tree_branch: 1, stone_chunk: 1 },
        result: { id: 'stone_axe', name: '锋利石斧', count: 1 }
      },
      {
        id: 'stone_pickaxe',
        name: '骨柄石镐 (Stone Pickaxe)',
        desc: '木棍 + 坚硬燧石 × 2 + 藤蔓：敲凿开采火山矿石岛的富铁矿石！',
        req: { tree_branch: 1, stone_chunk: 2, ivy: 1 },
        result: { id: 'stone_pickaxe', name: '骨柄石镐', count: 1 }
      },
      {
        id: 'iron_pickaxe',
        name: '精钢锻镐 (Iron Pickaxe)',
        desc: '精密铁锭 × 2 + 木板 + 铁钉：坚不可摧的专业采矿镐！',
        req: { iron_ingot: 2, wood_plank: 1, nail: 1 },
        result: { id: 'iron_pickaxe', name: '精钢锻镐', count: 1 }
      },
      {
        id: 'iron_ingot',
        name: '高温冶炼铁锭 (Iron Ingot)',
        desc: '富铁矿石 × 2 + 木柴燃料 × 2：高温煅烧冶炼出纯净铁锭！',
        req: { iron_ore: 2, tree_branch: 2 },
        result: { id: 'iron_ingot', name: '精密铁锭', count: 1 }
      },
      {
        id: 'stone_hammer',
        name: '重装石锤 (Stone Hammer)',
        desc: '木棍 + 海滩大石：敲打矿石和加固航海木筏',
        req: { tree_branch: 1, big_rock: 1 },
        result: { id: 'stone_hammer', name: '重装石锤', count: 1 }
      },
      {
        id: 'fishingrod',
        name: '手工钓竿 (Fishing Rod)',
        desc: '木棍 + 坚韧藤蔓：在近海水波泛起处钓取海鱼',
        req: { tree_branch: 1, ivy: 1 },
        result: { id: 'fishingrod', name: '手工钓竿', count: 1 }
      },
      {
        id: 'bow_arrow',
        name: '简易猎弓套件 (Bow & Arrows)',
        desc: '木棍 + 坚韧藤蔓 + 羽毛：远程狩猎森林动物',
        req: { tree_branch: 2, ivy: 1, feather: 1 },
        result: { id: 'bow_arrow', name: '简易猎弓', count: 1 }
      },
      {
        id: 'baked_clam',
        name: '碳烤海蛤 (Baked Clam)',
        desc: '新鲜海蛤 + 引火物：在篝火处烹饪鲜嫩海蛤',
        req: { clam: 1, kindling: 1 },
        result: { id: 'baked_clam', name: '碳烤海蛤', count: 1 }
      },
      {
        id: 'baked_fish',
        name: '香烤大鱼 (Baked Fish)',
        desc: '新鲜海鱼 + 引火物：在篝火处烤制香脆大鱼',
        req: { fish: 1, kindling: 1 },
        result: { id: 'baked_fish', name: '香烤大鱼', count: 1 }
      },
      {
        id: 'baked_apple',
        name: '焦糖烤苹果 (Baked Apple)',
        desc: '新鲜野苹果 + 引火物：温热甜美焦糖果',
        req: { apple: 1, kindling: 1 },
        result: { id: 'baked_apple', name: '焦糖烤苹果', count: 1 }
      },
      {
        id: 'baked_meat',
        name: '篝火烤肉排 (Baked Meat)',
        desc: '新鲜生肉 + 引火物：香气扑鼻的大块烤肉排',
        req: { raw_meat: 1, kindling: 1 },
        result: { id: 'baked_meat', name: '篝火烤肉排', count: 1 }
      },
      {
        id: 'workradio',
        name: '工作收音机 (Work Radio)',
        desc: '故障电台 + 高纯精炼硅晶（或干电池）：【ED1 直升机结局】在沙滩广播呼叫搜救！',
        req: { broken_radio: 1, sol_crystal_pure: 1 },
        result: { id: 'workradio', name: '工作收音机', count: 1 }
      },
      {
        id: 'workradio_battery',
        name: '工作收音机 (电池备选)',
        desc: '故障电台 + 干电池：在沙滩广播呼叫搜救！',
        req: { broken_radio: 1, battery: 1 },
        result: { id: 'workradio', name: '工作收音机', count: 1 }
      },
      {
        id: 'sos_sign',
        name: '沙滩 SOS 地标 (S.O.S Sign)',
        desc: '海滩大礁石 × 2：在南岸沙滩拼出巨大醒目的白色求救字样！',
        req: { big_rock: 2 },
        result: { id: 'sos_sign', name: 'SOS 巨石阵', count: 1 }
      },
      {
        id: 'escape_raft',
        name: '求生大木筏 (Escape Raft)',
        desc: '【ED2/ED6 航海结局】重型圆木 × 4 + 藤蔓 × 2 + 铁钉 × 2：横渡大洋！',
        req: { lumber: 4, ivy: 2, nail: 2 },
        result: { id: 'escape_raft', name: '求生大木筏', count: 1 }
      }
    ];
  }

  // 获得道具元数据
  getItemDef(itemId) {
    return this.itemDefs[itemId] || { name: itemId, icon: '📦', category: 'material', desc: '未知物品' };
  }

  // 检索特定双材料是否存在配方
  findRecipe(itemA, itemB) {
    if (!itemA || !itemB) return null;
    for (const recipe of this.recipes) {
      const keys = Object.keys(recipe.req);
      if (keys.length === 2) {
        if (keys.includes(itemA) && keys.includes(itemB)) return recipe;
      } else if (keys.length === 1 && keys[0] === itemA && itemA === itemB && recipe.req[itemA] === 2) {
        return recipe;
      }
    }
    return null;
  }

  // 双物品自由 Merge 判定（对齐原版自由拖拽合成体验）
  tryMerge(itemA, itemB, inventory) {
    if (!itemA || !itemB) return { success: false, msg: '请选择两件材料放入合成槽位！' };

    // 寻找匹配的双材料配方
    for (const recipe of this.recipes) {
      const keys = Object.keys(recipe.req);
      if (keys.length === 2) {
        const matches = (keys.includes(itemA) && keys.includes(itemB));
        if (matches) {
          return this.craft(recipe.id, inventory);
        }
      } else if (keys.length === 1 && keys[0] === itemA && itemA === itemB && recipe.req[itemA] === 2) {
        return this.craft(recipe.id, inventory);
      }
    }

    return { success: false, msg: `【${this.getItemDef(itemA).name}】和【${this.getItemDef(itemB).name}】无法发生有效反应，请参阅蓝图手册！` };
  }

  // 检查是否满足配方
  canCraft(recipeId, inventory) {
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    for (const [itemId, count] of Object.entries(recipe.req)) {
      if ((inventory[itemId] || 0) < count) {
        return false;
      }
    }
    return true;
  }

  // 执行配方合成
  craft(recipeId, inventory) {
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return { success: false, msg: '不存在此配方！' };
    if (!this.canCraft(recipeId, inventory)) {
      return { success: false, msg: '背包材料不足，无法合成！' };
    }

    // 扣除材料
    for (const [itemId, count] of Object.entries(recipe.req)) {
      inventory[itemId] -= count;
      if (inventory[itemId] <= 0) {
        delete inventory[itemId];
      }
    }

    // 产生成品
    inventory[recipe.result.id] = (inventory[recipe.result.id] || 0) + recipe.result.count;
    return {
      success: true,
      result: recipe.result,
      msg: `✨ 成功研制合成了【${recipe.result.name}】！`
    };
  }
}
