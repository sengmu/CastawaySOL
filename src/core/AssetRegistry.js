// CastawaySOL 核心资产清单与模型元数据
export const GAME_ASSETS = {
  // 岛屿幸存者伙伴与营地 NPC
  npcs: {
    // Survival Kids 核心伙伴：机灵小猴子 Bub
    bub_monkey: {
      id: 'bub_monkey',
      name: '机灵小猴·巴布 (Bub)',
      species: '荒岛灵猴',
      role: '随行探险伙伴',
      path: '/models/npcs/Model/NpcNmlSqu00.Nin_NX_NVN/NpcNmlSqu00.dae',
      scale: 0.72,
      dialogs: [
        '吱吱！吱吱吱！（小猴子眼巴巴地看着你背包里的美味苹果和香甜烤鱼～）',
        '吱吱！（小猴子高兴地跳上你的肩膀，示意它可以帮你爬树采摘高处的野果和稀有藤蔓！）',
        '吱～（小猴子指了指远方的海平线，似乎在提醒你收集木材打造木筏去邻岛探险！）'
      ]
    },
    // Survival Kids 核心同伴：海难第二幸存者 (Second Child)
    second_kid: {
      id: 'second_kid',
      name: '海难幸存少女·艾莉 (Ellie)',
      species: '幸存人类',
      role: '荒岛挚友',
      path: '/models/npcs/Model/NpcNmlCat23.Nin_NX_NVN/NpcNmlCat23.dae',
      scale: 0.85,
      dialogs: [
        '唔……头好痛……是你救了我吗？谢谢你递给我的甘甜清泉和烤鱼……',
        '这里是……一座荒无人烟的海岛吗？只要我们齐心协力，一定能找到回到家乡的办法！',
        '【好感度提升】今天的天空好美，吹着海风看着夕阳，只要有你在身边，这里就没那么孤单了……'
      ]
    },
    isabelle: {
      id: 'isabelle',
      name: '营地领航员·贝拉 (Bella)',
      species: '探险犬',
      role: '营地总管',
      path: '/models/npcs/Model/NpcSpSza.Nin_NX_NVN/NpcSpSza.dae',
      scale: 0.8,
      dialogs: [
        '流落荒岛不用怕！先用树枝和树皮去【🔨合成】工作台制作引火物与火把，保障安全哦！',
        '口渴了点击左上角【🚰水壶】或右侧轮盘痛快畅饮，水壶喝空了可以去海岛淡水旁打水补充！',
        '走近岛上的苹果树和椰子树按【E】用力摇晃，掉落的水果能快速恢复饥饿度与生命值呢！',
        '搜集到 4 根木材、2 枚钉子和藤蔓，就能在西南浅滩建造【求生大木筏】出海探索群岛！'
      ]
    },
    tom_nook: {
      id: 'tom_nook',
      name: '后勤总管·诺克 (Nook)',
      species: '海狸',
      role: '资源总管',
      path: '/models/npcs/Model/NpcSpRco.Nin_NX_NVN/NpcSpRco.dae',
      scale: 0.8,
      dialogs: [
        '欢迎来到 CastawaySOL 荒岛生存计划！生命、饥饿、饮水、疲劳都在随步数消耗，可别大意了！',
        '用纯晶精炼炉提炼高纯度硅晶，就能修好破损收音机侦听邻岛幸存者的无线电呼号！',
        '要是疲劳值累积太高，赶紧去西侧营地帐篷睡个安稳觉，四维会大幅回满！',
        '多砍树、勤挖矿、拓航线，把荒岛营地一步步建设成繁荣的群岛大本营吧！'
      ]
    },
    raymond: {
      id: 'raymond',
      name: '探险学者·雷蒙德 (Raymond)',
      species: '猫咪',
      role: '工程学者',
      path: '/models/npcs/Model/NpcNmlCat23.Nin_NX_NVN/NpcNmlCat23.dae',
      scale: 0.8,
      dialogs: [
        '今天海风的吹拂角度，非常适合搭建风力发电机和防御工事呢。',
        '保持冷静与逻辑，是荒岛求生的第一法则。',
        '你摆在营地的那些长椅和工坊设施，颇具现代野营美学呢，不错。'
      ]
    },
    marshal: {
      id: 'marshal',
      name: '侦察游侠·马歇尔 (Marshal)',
      species: '白松鼠',
      role: '侦察先锋',
      path: '/models/npcs/Model/NpcNmlSqu00.Nin_NX_NVN/NpcNmlSqu00.dae',
      scale: 0.75,
      dialogs: [
        '嘿，刚才我在东北侧的高台上眺望，远处的洋流和云朵非常壮丽呢～',
        '累了就坐在沙滩木桩上吹吹海风，也是一种生存智慧啊。',
        '要一起去海边捡贝壳、听听海浪的声音吗？'
      ]
    },
    dom: {
      id: 'dom',
      name: '体能领航员·多姆 (Dom)',
      species: '绵羊',
      role: '体能健将',
      path: '/models/npcs/Model/NpcNmlShp00.Nin_NX_NVN/NpcNmlShp00.dae',
      scale: 0.8,
      dialogs: [
        '哇啊～今天我已经绕着全岛慢跑了十圈啦！感觉浑身充满力量！',
        '肌肉在燃烧！这就是荒岛求生的活力证明，冲啊！',
        '等下要不要来一场沙滩折返冲刺大比拼？！'
      ]
    }
  },

  // 玩家角色外观
  player: {
    // 3D-PILOT: 启用主角自建 3D 荒岛款模型 (GLTF/GLB)
    path: '/models/npcs/Model/NpcNmlCat23.Nin_NX_NVN/NpcNmlCat23.dae',
    scale: 1.0,
    // [回退注释 / Fallback]: 若需回退至小猫咪模型，解开下行注释并恢复 PlayerController 引用
    // fallbackCatDae: '/models/npcs/Model/NpcNmlCat23.Nin_NX_NVN/NpcNmlCat23.dae',
    body: '/models/player/Model/PlayerBody.Nin_NX_NVN/PlayerBody.dae',
    hair: '/models/player/Model/PlayerHair00.Nin_NX_NVN/PlayerHair00.dae',
    pants: '/models/player/Model/PlayerBottomsPantsNormal.Nin_NX_NVN/PlayerBottomsPantsNormal.dae',
  },

  // 自然植物生态
  plants: {
    cherry_blossom: {
      id: 'cherry_blossom',
      name: '盛开的樱花树',
      category: 'tree',
      path: '/models/plants/Model/PltTreeOakSakura.Nin_NX_NVN/PltTreeOak4Sakura.dae',
      scale: 1.0,
      canShake: true,
      dropItem: 'cherry_blossom_petal'
    },
    apple_tree: {
      id: 'apple_tree',
      name: '苹果阔叶树',
      category: 'tree',
      path: '/models/custom/apple_tree.glb',
      scale: 1.0,
      canShake: true,
      dropItem: 'apple'
    },
    palm_tree: {
      id: 'palm_tree',
      name: '海滩椰子树',
      category: 'tree',
      path: '/models/custom/palm_tree.glb',
      scale: 1.0,
      canShake: true,
      dropItem: 'coconut'
    },
    cedar_tree: {
      id: 'cedar_tree',
      name: '针叶雪松树',
      category: 'tree',
      path: '/models/custom/cedar_tree.glb',
      scale: 1.0,
      canShake: true,
      dropItem: 'tree_branch'
    },
    azalea_bush: {
      id: 'azalea_bush',
      name: '杜鹃花灌木',
      category: 'bush',
      path: '/models/custom/azalea_bush.glb',
      scale: 0.9
    },
    camellia_bush: {
      id: 'camellia_bush',
      name: '山茶花灌木',
      category: 'bush',
      path: '/models/custom/camellia_bush.glb',
      scale: 0.9
    }
  },

  // 大型地标与建筑设施
  structures: {
    campsite_tent: {
      id: 'campsite_tent',
      name: '露营地大帐篷',
      path: '/models/structures/Model/StrcCampsiteTentA00.Nin_NX_NVN/StrcCampsiteTentA00.dae',
      scale: 0.8
    },
    airport: {
      id: 'airport',
      name: '海岛水上机场',
      path: '/models/structures/Model/StrcAirPortA00.Nin_NX_NVN/StrcAirPortA00.dae',
      scale: 0.6
    },
    cozy_house: {
      id: 'cozy_house',
      name: '山顶观景海滨木屋',
      path: '/models/structures/Model/FtrMjkHouse.Nin_NX_NVN/FtrMjkHouse.dae',
      scale: 0.9
    }
  },

  // 经典家具与户外摆件（供建造模式自由布置，带真实原材料消耗、三分类抽屉与营地舒适度分值）
  // 遵循资产冻结约束：绝不新增任何 Nin_NX_NVN 模型引用，新增工坊双炉统一走 Three.js 程序化低多边形构建
  furniture: [
    {
      id: 'storage_box',
      name: '坚固储物木箱',
      category: '营地仓储',
      drawerCategory: 'facility',
      comfortScore: 8,
      bonusStorageSlots: 4,
      cost: { wood_plank: 2, nail: 2 },
      path: '/models/furniture/Model/FtrWoodBench.Nin_NX_NVN/FtrWoodBench.dae',
      scale: 0.95,
      icon: '📦',
      isStorage: true
    },
    {
      id: 'furnace',
      name: '耐火锻造熔炉',
      category: '工坊设施',
      drawerCategory: 'facility',
      comfortScore: 10,
      cost: { stone_chunk: 4, tree_branch: 2, nail: 1 },
      proceduralType: 'furnace',
      scale: 1.0,
      icon: '🔥',
      isFurnace: true
    },
    {
      id: 'crystal_refinery',
      name: '古法纯晶精炼炉',
      category: '核心工坊',
      drawerCategory: 'facility',
      comfortScore: 12,
      cost: { stone_chunk: 4, iron_ingot: 2, sol_token: 20 },
      proceduralType: 'crystal_refinery',
      scale: 1.0,
      icon: '💠',
      isRefinery: true
    },
    {
      id: 'water_purifier',
      name: '自然净水滴滤台',
      category: '生命维持',
      drawerCategory: 'facility',
      comfortScore: 10,
      cost: { stone_chunk: 2, tree_branch: 3, nail: 1 },
      path: '/models/custom/water_purifier.glb',
      scale: 1.0,
      icon: '🚰',
      isWaterPurifier: true
    },
    {
      id: 'camp_bed',
      name: '避风原木单人床',
      category: '居民居所',
      drawerCategory: 'comfort',
      comfortScore: 12,
      cost: { wood_plank: 3, tree_branch: 2 },
      path: '/models/furniture/Model/FtrWoodBench.Nin_NX_NVN/FtrWoodBench.dae',
      scale: 1.15,
      icon: '🛏️',
      isBed: true
    },
    {
      id: 'wood_bench',
      name: '原木长椅',
      category: '座椅',
      drawerCategory: 'comfort',
      comfortScore: 8,
      cost: { wood_plank: 2, nail: 1 },
      path: '/models/furniture/Model/FtrWoodBench.Nin_NX_NVN/FtrWoodBench.dae',
      scale: 1.0,
      icon: '🪵'
    },
    {
      id: 'irongarden_bench',
      name: '铁花园长椅',
      category: '座椅',
      drawerCategory: 'comfort',
      comfortScore: 9,
      cost: { nail: 4, stone_chunk: 2 },
      path: '/models/furniture/Model/FtrIrongardenBench.Nin_NX_NVN/FtrIrongardenBench.dae',
      scale: 1.0,
      icon: '🪑'
    },
    {
      id: 'ironwood_table',
      name: '铁木大长桌',
      category: '桌子',
      drawerCategory: 'comfort',
      comfortScore: 10,
      cost: { wood_plank: 3, nail: 2 },
      path: '/models/furniture/Model/FtrIronwoodTableL.Nin_NX_NVN/FtrIronwoodTableL.dae',
      scale: 1.0,
      icon: '🪵'
    },
    {
      id: 'sakura_picnic',
      name: '樱花野餐垫组合',
      category: '装饰',
      drawerCategory: 'comfort',
      comfortScore: 10,
      cost: { tree_branch: 2, apple: 1 },
      path: '/models/furniture/Model/FtrSakuraPicnicset.Nin_NX_NVN/FtrSakuraPicnicset.dae',
      scale: 1.0,
      icon: '🌸'
    },
    {
      id: 'campfire',
      name: '露天篝火',
      category: '照明/自然',
      drawerCategory: 'decor',
      comfortScore: 7,
      cost: { tree_branch: 3, stone_chunk: 2 },
      path: '/models/custom/campfire.glb',
      scale: 1.0,
      icon: '🔥'
    },
    {
      id: 'streetlamp',
      name: '欧式复古路灯',
      category: '照明',
      drawerCategory: 'decor',
      comfortScore: 9,
      cost: { nail: 3, stone_chunk: 2 },
      path: '/models/furniture/Model/FtrStreetlamp.Nin_NX_NVN/FtrStreetlamp.dae',
      scale: 1.0,
      icon: '🏮'
    },
    {
      id: 'picnic_basket',
      name: '藤编野餐篮',
      category: '小物件',
      drawerCategory: 'decor',
      comfortScore: 6,
      cost: { tree_branch: 2 },
      path: '/models/furniture/Model/FtrPicnicbasket.Nin_NX_NVN/FtrPicnicbasket.dae',
      scale: 1.0,
      icon: '🧺'
    },
    {
      id: 'drinking_fountain',
      name: '直饮水喷水台',
      category: '户外设施',
      drawerCategory: 'decor',
      comfortScore: 9,
      cost: { stone_chunk: 3, nail: 2 },
      path: '/models/furniture/Model/FtrDrinkingfountain.Nin_NX_NVN/FtrDrinkingfountain.dae',
      scale: 1.0,
      icon: '⛲'
    }
  ]
};

// 保持向下兼容内部别名
export const ACNH_ASSETS = GAME_ASSETS;

