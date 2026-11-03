import { ISLAND_LAYOUT, distanceXZ } from '../core/IslandLayout.js';

// CastawaySOL - 荒岛求生主线剧情与真实行为事件监听引擎 (Story & Action-based Quest Engine)
// 杜绝开局初始条件被动跳关；完全基于真实物理采集、进食、饮水、营地到达与烹饪制作驱动

export class StorySystem {
  constructor(game) {
    this.game = game;

    // 当前主线章节与子步骤索引
    this.currentChapterId = 0;
    this.currentStepIndex = 0;
    this.onboardingStep = 0;
    this.onboardingDismissed = false;
    this.lastOnboardingPosition = null;

    // 真实主动行为记录标记 (Action-based Milestones)
    this.hasGatheredBranch = false;        // 真实拾取/采集了木棍
    this.hasConsumedFoodOrWater = false;   // 真实进食或饮水
    this.hasReachedCampsite = false;       // 真实探访帐篷营地
    this.hasCraftedKindling = false;       // 真实在合成台制作了引火物
    this.hasCookedFood = false;            // 真实在营火烘烤了熟食
    this.hasCraftedAxe = false;            // 真实制作了石斧

    // 伙伴与NPC好感羁绊
    this.monkeyBefriended = false;         // 猴子 Bub 是否入队
    this.secondKidFound = false;           // 第二幸存者是否发现
    this.secondKidAwake = false;           // 第二幸存者是否救醒
    this.secondKidAffection = 50;          // 第二幸存者好感度 (0 - 250)

    // 关键地标与航海筹备
    this.sosBuilt = false;                 // 沙滩巨型 SOS 是否拼成
    this.radioBroadcasted = false;         // 是否已发送无线电呼救
    this.sosWaitDays = 0;                  // 发送 SOS 后的等待天数
    this.raftBuilt = false;                // 救生大木筏是否建成
    this.caveExplored = false;             // 山麓洞穴是否探索
    this.gemsCollected = new Set();        // 收集到的遗迹神殿宝石
    this.endedEndingId = null;             // 旧档兼容；结局已下线
    this.isCompleted = false;

    // 挖矿主线里程碑与过章凭据 (Mining Spine Gates)
    this.pureCrystalDelivered = false;     // 高纯精炼纯晶是否提纯交付
    this.raymondRescued = false;           // 学者雷蒙德是否救回大本营
    this.lighthouseLit = false;            // 北崖古灯塔一期大工程是否点亮
    this.firstResonanceSettled = false;    // 首次地脉共振勘探是否完成结算
    this.templeUnsealed = false;           // 后山远古神殿三宝石封印是否已解封

    // 推进防抖锁 (防止同一帧重复触发)
    this.isAdvancing = false;

    // 主线章节与步骤定义 (严格区分 action 动作监听与 position 地理到达)
    this.chapters = [
      {
        id: 0,
        title: '序章：海难漂流',
        subtitle: '南岸沙滩余生',
        steps: [
          {
            id: 'collect_driftwood',
            type: 'action',
            desc: '探索南岸沙滩，走近并点按互动按钮拾取散落的【漂流木棍】！',
            hint: '在海滩四周走动，靠近发光的树枝点按互动按钮拾取'
          },
          {
            id: 'find_food_water',
            type: 'action',
            desc: '四维代谢正在消耗！在行囊中食用野果，或前往内陆小溪饮水！',
            hint: '打开行囊点按食用随身野苹果，或前往内陆溪流 (X:13.5) 点按互动按钮痛快畅饮'
          },
          {
            id: 'find_campsite',
            type: 'position',
            desc: '沿沙滩向内陆探索，寻找椰林后方的帐篷营地！',
            checkPosition: (playerPos) => distanceXZ(playerPos, ISLAND_LAYOUT.tent) < 5.0,
            hint: '从南岸向西北走，寻找营地帐篷 (-17, 0, 23) 与跳动的篝火'
          }
        ]
      },
      {
        id: 1,
        title: '第一章：钻木取火与工匠雏形',
        subtitle: '建立荒岛大本营',
        steps: [
          {
            id: 'craft_kindling',
            type: 'action',
            desc: '打开顶部【🛠️ 合成】面板，用【木棍 + 树皮】研制【引火物 (Kindling)】！',
            hint: '摇树获得树枝与树皮，在合成台放入两件原料制作引火物'
          },
          {
            id: 'cook_hot_food',
            type: 'action',
            desc: '靠近营地篝火点按互动按钮，用引火物烘烤鲜鱼或采集的苹果！',
            hint: '持食材靠近营地中央篝火 (-12, 0, 24) 点按互动按钮烹饪热食'
          },
          {
            id: 'craft_axe',
            type: 'action',
            desc: '在合成台研制【锋利石斧 (Stone Axe)】（木棍 + 坚硬石块）！',
            hint: '在沙滩退潮礁石带拾取燧石，配合木棍在合成台制作石斧'
          }
        ]
      },
      {
        id: 2,
        title: '第二章：丛林猴影 (Bub)',
        subtitle: '失而复得的同伴',
        steps: [
          {
            id: 'chase_monkey',
            type: 'position',
            desc: '林中突然窜出一只淘气小猴！追循叫声前往东侧密林探查！',
            checkPosition: (playerPos) => Math.hypot(playerPos.x - 10, playerPos.z - (-10)) < 6.0,
            hint: '往东面树林走，小猴子正在树下好奇地盯着你'
          },
          {
            id: 'befriend_monkey',
            type: 'state',
            desc: '小猴子馋得直流口水！在背包中选中【苹果】或【烤鱼】点按互动按钮投喂它！',
            checkState: () => this.monkeyBefriended,
            hint: '靠近小猴子点按互动按钮投喂美味食物，收服猴子伙伴'
          }
        ]
      },
      {
        id: 3,
        title: '第三章：无线通讯与邻岛求救',
        subtitle: '收音机求救 · 浮木岛的呼号',
        steps: [
          {
            id: 'fix_radio',
            type: 'action',
            desc: '打捞搁浅物资箱中的破损收音机，在精炼炉提炼纯晶后合成【工作收音机】！',
            hint: '先在营地告示板建造纯晶精炼炉过夜提纯，再用高纯硅晶 + 故障无线电合成'
          },
          {
            id: 'radio_contact',
            type: 'state',
            desc: '手持收音机前往南岸 S.O.S 地标点按互动按钮架设天线，接收邻岛求救信号！',
            checkState: () => this.radioBroadcasted,
            hint: '在南岸沙滩巨石 S.O.S 处点按互动按钮调谐收音机频段'
          }
        ]
      },
      {
        id: 4,
        title: '第四章：筹备远航与出海营救',
        subtitle: '乘风破浪 · 搜救同伴与浮木岛开拓',
        steps: [
          {
            id: 'build_raft',
            type: 'state',
            desc: '在西南浅滩造好【求生大木筏】，准备扬帆出海展开营救！',
            checkState: () => this.raftBuilt,
            hint: '准备4根木材+2铁钉+2藤蔓在浅滩建造大木筏'
          },
          {
            id: 'rescue_partner',
            type: 'state',
            desc: '在东北悬崖高台木屋旁巡查，发现昏迷的第二幸存者，点按互动按钮紧急救援！',
            checkState: () => this.secondKidAwake,
            hint: '前往东北侧山顶别墅高台 (25, 1.8, -19) 救治昏迷同伴'
          }
        ]
      },
      {
        id: 5,
        title: '第五章：扩大生产与海岛家园',
        subtitle: '营地扩建与群岛前哨',
        steps: [
          {
            id: 'care_partner',
            type: 'state',
            desc: '给同伴投喂清水与鲜美烤鱼，将彼此的好感度培养至 100 以上！',
            checkState: () => this.secondKidAffection >= 100,
            hint: '每日与同伴对话互动并赠送美食增加好感度'
          },
          {
            id: 'collect_gems',
            type: 'state',
            desc: '探索全岛采集 3 颗神秘古代宝石（星形宝石、菱形宝石、圆月宝石）！',
            checkState: () => this.gemsCollected.size >= 3,
            hint: '在山麓洞穴、高台树林与神殿石雕处探索获取宝石'
          }
        ]
      },
      {
        id: 6,
        title: '第六章：自由经营',
        subtitle: '主线完成，建设海岛家园',
        steps: [
          {
            id: 'mainline_complete',
            type: 'state',
            desc: '开启自由经营，继续挖矿、扩建营地与探索群岛！',
            checkState: () => this.currentChapterId === 6,
            hint: '留岛漫游，自由建设与经营'
          }
        ]
      }
    ];
  }

  // 获取当前正在进行的章节与步骤
  getCurrentChapter() {
    return this.chapters[this.currentChapterId] || this.chapters[this.chapters.length - 1];
  }

  getCurrentStep() {
    const chapter = this.getCurrentChapter();
    return chapter.steps[this.currentStepIndex] || chapter.steps[chapter.steps.length - 1];
  }

  // 判断当前章节最后一步的叙事条件是否已达成
  _isLastStepNarrativeMet() {
    const chapter = this.getCurrentChapter();
    if (!chapter || this.currentStepIndex !== chapter.steps.length - 1) return false;
    const stepId = this.getCurrentStep()?.id;
    if (stepId === 'find_campsite') return this.hasReachedCampsite;
    if (stepId === 'craft_axe') return this.hasCraftedAxe;
    if (stepId === 'befriend_monkey') return this.monkeyBefriended;
    if (stepId === 'radio_contact') return this.radioBroadcasted;
    if (stepId === 'rescue_partner') return this.secondKidAwake;
    if (stepId === 'collect_gems') return this.gemsCollected.size >= 3;
    return false;
  }

  // 获取当前章节过章里程碑逐项检查清单（供 HUD 横幅与营地中枢面板实时展示）
  getChapterGateChecklist(chapterId = this.currentChapterId) {
    const rig = this.game?.miningRig;
    const inv = this.game?.ui?.inventory || {};
    const ledger = this.game?.economyLedger;

    if (chapterId === 0) {
      const hasCrystal = (inv.sol_crystal || 0) > 0 || (rig?.loadedCrystals || 0) > 0 || (rig?.totalBlocksMined || 0) > 0;
      return [
        { id: 'c0_crystal', label: '检视营地绿色矿机并采集/装载首块硅晶原石', done: !!rig && hasCrystal }
      ];
    }
    if (chapterId === 1) {
      const blocks = rig?.totalBlocksMined || 0;
      const tokens = rig?.totalSolMined || 0;
      return [
        { id: 'c1_block', label: `营地矿机完成首次出块 (${Math.min(blocks, 1)}/1)`, done: blocks >= 1 },
        { id: 'c1_tokens', label: `累计挖矿产出 6 枚算力代币 (${Math.min(tokens, 6)}/6)`, done: tokens >= 6 }
      ];
    }
    if (chapterId === 2) {
      const hasScanner = (rig?.scannerLevel || 0) >= 1 || (inv.geo_scanner_mk1 || 0) > 0;
      const hasResonance = this.firstResonanceSettled === true ||
        (rig?.resonance?.history?.length || 0) >= 1 ||
        (rig?.shardCount || 0) > 0 ||
        Boolean(ledger?.days?.some(d => (d.outflow?.sol_crystal?.resonance_commit || 0) > 0 || (d.inflow?.sol_shard?.resonance_shard || 0) > 0));
      return [
        { id: 'c2_scanner', label: '合成并安装地质共振扫描仪 Mk1', done: hasScanner },
        { id: 'c2_resonance', label: '在矿机【共振】页完成首次地脉勘探结算', done: hasResonance }
      ];
    }
    if (chapterId === 3) {
      const pureDelivered = this.pureCrystalDelivered === true ||
        Boolean(ledger?.days?.some(d => (d.outflow?.sol_crystal?.refinery_consume || 0) > 0)) ||
        (this.game?.campFacilities?.refineryLevel || 0) >= 1;
      const rigL2 = (rig?.rigLevel || 1) >= 2;
      return [
        { id: 'c3_refinery', label: '在营地告示板建造【纯晶精炼炉】并提纯硅晶', done: pureDelivered },
        { id: 'c3_rig_l2', label: `将营地解密矿机升级至 L2 (当前 L${rig?.rigLevel || 1})`, done: rigL2 }
      ];
    }
    if (chapterId === 4) {
      const raymond = this.raymondRescued === true ||
        this.game?.timberIsleScene?.survivorRescued === true ||
        this.game?.raymondSettled === true;
      return [
        { id: 'c4_ellie', label: '前往东北高台救醒幸存少女艾莉', done: this.secondKidAwake === true },
        { id: 'c4_raymond', label: '乘船前往【浮木岛】救回学者雷蒙德（解锁 L3 图纸）', done: raymond }
      ];
    }
    if (chapterId === 5) {
      const lit = this.lighthouseLit === true || this.game?.lighthouse?.isLit === true;
      const rigL4 = (rig?.rigLevel || 1) >= 4;
      return [
        { id: 'c5_lighthouse', label: '集齐三梯晶石点亮【北崖古灯塔】一期工程', done: lit },
        { id: 'c5_rig_l4', label: `将营地解密矿机升级至 L4 (当前 L${rig?.rigLevel || 1})`, done: rigL4 }
      ];
    }
    return [];
  }

  // 获取当前章节过章挖矿要求文案（精准提示未完成的剩余项）
  getChapterGateBannerDesc(chapterId) {
    const list = this.getChapterGateChecklist(chapterId);
    const pending = list.filter(item => !item.done);
    if (pending.length > 0) {
      return `过章要求：${pending.map(item => item.label).join('；')}！`;
    }
    return '过章要求：达成当前章节挖矿里程碑！';
  }

  // 获得格式化的当前任务引导文案
  getQuestBannerText() {
    if (this.isCompleted) return FREEPLAY_BANNER;
    const chapter = this.getCurrentChapter();
    const step = this.getCurrentStep();
    if (this._isLastStepNarrativeMet() && !this.canPassChapterGate(this.currentChapterId)) {
      return `⛏️ [${chapter.title}] ${this.getChapterGateBannerDesc(this.currentChapterId)}`;
    }
    return `🚩 [${chapter.title}] ${step.desc}`;
  }

  getOnboardingHint() {
    if (this.onboardingDismissed || this.onboardingStep >= ONBOARDING_STEPS.length) return null;
    return ONBOARDING_STEPS[this.onboardingStep];
  }

  _completeOnboardingThrough(stepIndex) {
    if (this.onboardingDismissed || this.onboardingStep > stepIndex) return;
    this.onboardingStep = stepIndex + 1;
    this._refreshOnboarding();
  }

  _refreshOnboarding() {
    this._renderOnboarding();
    queueMicrotask(() => this.game?.saveSystem?.saveGame?.('onboarding_progress'));
  }

  _renderOnboarding() {
    const hint = this.getOnboardingHint();
    this.game?.ui?.updateTutorial?.(hint, this.onboardingStep, ONBOARDING_STEPS.length);
  }

  dismissOnboarding() {
    if (this.onboardingDismissed || this.onboardingStep >= ONBOARDING_STEPS.length) return;
    this.onboardingDismissed = true;
    this._refreshOnboarding();
  }

  onInventoryOpened() {
    this._completeOnboardingThrough(2);
  }

  // 帧更新循环：仅检测地理位置到达与明确的状态变更，严禁被动读取背包跳关！
  update(playerPos, inventory, survivalStats) {
    if (!this.onboardingDismissed && this.onboardingStep === 0 && playerPos) {
      if (this.lastOnboardingPosition) {
        const dx = playerPos.x - this.lastOnboardingPosition[0];
        const dz = (playerPos.z || 0) - this.lastOnboardingPosition[1];
        if (Math.hypot(dx, dz) >= 0.75) {
          this._completeOnboardingThrough(0);
        }
      }
      this.lastOnboardingPosition = [playerPos.x, playerPos.z || 0];
    }
    if (this.isCompleted || this.isAdvancing) return;

    const currentStep = this.getCurrentStep();
    if (!currentStep) return;

    // 1. 位置到达类任务检测
    if (currentStep.type === 'position' && currentStep.checkPosition) {
      if (currentStep.checkPosition(playerPos)) {
        if (currentStep.id === 'find_campsite') {
          this.hasReachedCampsite = true;
        }
        this.#advanceStep();
        return;
      }
    }

    // 2. 状态驱动类任务检测 (如好感度达到要求、巨石阵拼装完成)
    if (currentStep.type === 'state' && currentStep.checkState) {
      if (currentStep.checkState()) {
        this.#advanceStep();
        return;
      }
    }

    // 3. 章节门跨章推进检测：若当前章节末步已达成，但此前受阻于挖矿里程碑，一旦达成自动推进
    if (this.currentStepIndex === this.getCurrentChapter().steps.length - 1) {
      const stepNarrativeMet = this._isLastStepNarrativeMet();
      if (stepNarrativeMet && this.canPassChapterGate(this.currentChapterId)) {
        this.#advanceStep();
        return;
      }
      if (stepNarrativeMet) {
        const nextBanner = this.getQuestBannerText();
        if (this._lastGateBanner !== nextBanner) {
          this._lastGateBanner = nextBanner;
          this.game?.ui?.updateObjective?.(nextBanner);
        }
      }
    }
  }

  // === 真实行为监听器 (Action-based Triggers) ===

  // 真实采集/拾取了自然资源
  onGatherResource(itemType) {
    if (itemType === 'tree_branch' || itemType === 'driftwood') this._completeOnboardingThrough(1);
    if (this.getCurrentStep()?.id === 'collect_driftwood') {
      if (itemType === 'tree_branch' || itemType === 'driftwood') {
        this.hasGatheredBranch = true;
        this.#advanceStep();
      }
    }
  }

  // 真实食用了食物
  onConsumeFood(foodId) {
    this._completeOnboardingThrough(3);
    if (this.getCurrentStep()?.id === 'find_food_water') {
      this.hasConsumedFoodOrWater = true;
      this.#advanceStep();
    }
  }

  // 真实饮用了淡水泉水或水壶
  onDrinkWater() {
    this._completeOnboardingThrough(3);
    if (this.getCurrentStep()?.id === 'find_food_water') {
      this.hasConsumedFoodOrWater = true;
      this.#advanceStep();
    }
  }

  // 真实在合成台完成了道具制作
  onCraftItem(product) {
    const curStepId = this.getCurrentStep()?.id;
    if (curStepId === 'craft_kindling' && product === 'kindling') {
      this.hasCraftedKindling = true;
      this.#advanceStep();
    } else if (curStepId === 'craft_axe' && product === 'stone_axe') {
      this.hasCraftedAxe = true;
      this.#advanceStep();
    } else if (curStepId === 'fix_radio' && product === 'workradio') {
      this.pureCrystalDelivered = true;
      this.#advanceStep();
    }
  }

  // 真实在篝火完成了烹饪
  onCookFood() {
    if (this.getCurrentStep()?.id === 'cook_hot_food') {
      this.hasCookedFood = true;
      this.#advanceStep();
    }
  }

  // 真实完成了无线电架设调谐并收到邻岛呼救
  onRadioContact() {
    this.radioBroadcasted = true;
    if (this.getCurrentStep()?.id === 'radio_contact') {
      this.#advanceStep();
    }
  }

  // 外部救醒交互只记录里程碑；当前步骤的状态判定由任务帧更新负责。
  onPartnerAwakened() {
    if (this.secondKidAwake) return;
    this.secondKidAwake = true;
    this.secondKidAffection = 80;
  }

  // 矿机主线章节门验证 (Mining Spine Milestone Gates)
  canPassChapterGate(chapterId) {
    if (!this.game || !this.game.miningRig) return true;
    const rig = this.game.miningRig;
    const inv = this.game.ui?.inventory || {};
    const ledger = this.game.economyLedger;

    if (chapterId === 0) {
      const hasCrystal = (inv.sol_crystal || 0) > 0 || (rig.loadedCrystals || 0) > 0 || (rig.totalBlocksMined || 0) > 0;
      return !!rig && hasCrystal;
    }
    if (chapterId === 1) {
      return (rig.totalBlocksMined || 0) >= 1 && (rig.totalSolMined || 0) >= 6;
    }
    if (chapterId === 2) {
      const hasScanner = (rig.scannerLevel || 0) >= 1 || (inv.geo_scanner_mk1 || 0) > 0;
      const hasResonance = this.firstResonanceSettled === true ||
        (rig.resonance?.history?.length || 0) >= 1 ||
        (rig.shardCount || 0) > 0 ||
        Boolean(ledger?.days?.some(d => (d.outflow?.sol_crystal?.resonance_commit || 0) > 0 || (d.inflow?.sol_shard?.resonance_shard || 0) > 0));
      return hasScanner && hasResonance;
    }
    if (chapterId === 3) {
      const pureDelivered = this.pureCrystalDelivered === true ||
        Boolean(ledger?.days?.some(d => (d.outflow?.sol_crystal?.refinery_consume || 0) > 0)) ||
        (this.game.campFacilities?.refineryLevel || 0) >= 1;
      const rigL2 = (rig.rigLevel || 1) >= 2;
      return pureDelivered && rigL2;
    }
    if (chapterId === 4) {
      const raymond = this.raymondRescued === true ||
        this.game.timberIsleScene?.survivorRescued === true ||
        this.game.raymondSettled === true;
      return this.secondKidAwake === true && raymond;
    }
    if (chapterId === 5) {
      const lit = this.lighthouseLit === true || this.game.lighthouse?.isLit === true;
      const rigL4 = (rig.rigLevel || 1) >= 4;
      return lit && rigL4;
    }
    return true;
  }

  notifyChapterGateBlocked(chapterId) {
    if (!this.game || !this.game.ui) return;
    const tips = {
      0: '🏕️ 请先检视营地绿色矿机雏形并装载首块原石！',
      1: '⛏️ 第一章过章要求：营地矿机完成首次出块，且累计挖矿产出达到 6 枚算力代币！',
      2: '🛰️ 第二章过章要求：研制地质扫描仪 Mk1 并完成首次地脉共振勘探结算！',
      3: '🔥 第三章过章要求：建造精炼炉提炼交付高纯度纯晶，并将矿机升级至 L2！',
      4: '⛵ 第四章过章要求：造船出海前往浮木岛救回学者雷蒙德，解锁 L3 蓝图！',
      5: '🗼 第五章过章要求：交付多梯晶石点亮北崖灯塔一期大工程，并将矿机升至 L4！'
    };
    const tip = tips[chapterId] || '🚧 尚未达成当前章节挖矿里程碑！';
    this.game.ui.updateObjective?.(this.getQuestBannerText());
    this.game.ui.showToast(tip, 'medium');
  }

  // 单步防跃迁推进守卫
  #advanceStep() {
    if (this.isCompleted || this.isAdvancing) return;
    this.isAdvancing = true;

    try {
      const chapter = this.getCurrentChapter();
      if (this.currentStepIndex < chapter.steps.length - 1) {
        this.currentStepIndex++;
        this.notifyQuestProgress(true);
      } else {
        // 章节门验证：只有满足挖矿交付物里程碑方可通过本章
        if (!this.canPassChapterGate(this.currentChapterId)) {
          this.notifyChapterGateBlocked(this.currentChapterId);
          return;
        }
        // 晋级下一章节
        if (this.currentChapterId < this.chapters.length - 1) {
          this.currentChapterId++;
          this.currentStepIndex = 0;
          this.notifyQuestChapterComplete();
        } else {
          this.isCompleted = true;
          this.game?.ui?.updateObjective?.(this.getQuestBannerText());
        }
      }
    } finally {
      this.isAdvancing = false;
    }
  }

  notifyQuestProgress(isStep) {
    if (this.game && this.game.ui) {
      const step = this.getCurrentStep();
      this.game.ui.updateObjective(this.getQuestBannerText());
      this.game.ui.showToast(isStep ? `🎯 目标达成！进入下一步：${step.desc}` : `🎉 恭喜晋升新篇章！`, { level: isStep ? 'medium' : 'important', group: 'quest' });
    }
  }

  notifyQuestChapterComplete() {
    if (this.game && this.game.ui) {
      const chapter = this.getCurrentChapter();
      this.game.ui.updateObjective(this.getQuestBannerText());
      this.game.ui.showDialog('🌟 剧情篇章突破！', `【${chapter.title}】\n${chapter.subtitle}\n\n主线新目标已激活，请根据仪表盘指引继续探索！`);
    }
  }

  // 猴子收服事件
  befriendMonkey() {
    if (this.monkeyBefriended) return;
    this.monkeyBefriended = true;
    if (this.game && this.game.ui) {
      this.game.ui.showDialog('🐒 伙伴加入：小猴子 Bub', '你递给小猴子香甜的果实，它开心地手舞足蹈，翻了个跟头跳上了你的肩膀！\n小猴子正式成为你的荒岛忠实伙伴！它将在探索中为你搜寻稀有道具！');
    }
    if (this.getCurrentStep()?.id === 'befriend_monkey') {
      this.#advanceStep();
    }
  }

  // 拼搭沙滩巨型 SOS
  buildSosSign() {
    this.sosBuilt = true;
    if (this.game && this.game.ui) {
      this.game.ui.showDialog('🪨 沙滩 S.O.S 导引阵拼装完成！', '你搬运海滩巨石与白色贝壳，在平坦南岸沙滩上拼出了醒目的【S.O.S】地面信标阵！\n手持精炼纯晶修复的【工作收音机】在此架设天线，即可捕捉远方海平线传来的微弱求救电波！');
    }
  }

  // 建造救生大木筏
  buildRaft() {
    this.raftBuilt = true;
    if (this.game && this.game.ui) {
      this.game.ui.showDialog('⛵ 求生大木筏建造完成！', '经过精密的木工捆绑与打钉加固，一艘坚不可摧的双桅求生大木筏在南岸西侧码头赫然成型！\n现在具备横渡深海探索邻岛的航海载具！');
    }
    if (this.getCurrentStep()?.id === 'build_raft') {
      this.#advanceStep();
    }
  }

  // 序列化与反序列化支持 (用于 SaveSystem 安全存档与迁移)
  serialize() {
    return {
      isCompleted: this.isCompleted,
      currentChapterId: this.currentChapterId,
      currentStepIndex: this.currentStepIndex,
      hasGatheredBranch: this.hasGatheredBranch,
      hasConsumedFoodOrWater: this.hasConsumedFoodOrWater,
      hasReachedCampsite: this.hasReachedCampsite,
      hasCraftedKindling: this.hasCraftedKindling,
      hasCookedFood: this.hasCookedFood,
      hasCraftedAxe: this.hasCraftedAxe,
      monkeyBefriended: this.monkeyBefriended,
      secondKidFound: this.secondKidFound,
      secondKidAwake: this.secondKidAwake,
      secondKidAffection: this.secondKidAffection,
      sosBuilt: this.sosBuilt,
      radioBroadcasted: this.radioBroadcasted,
      raftBuilt: this.raftBuilt,
      gemsCollected: Array.from(this.gemsCollected),
      pureCrystalDelivered: this.pureCrystalDelivered,
      raymondRescued: this.raymondRescued,
      lighthouseLit: this.lighthouseLit,
      firstResonanceSettled: this.firstResonanceSettled,
      templeUnsealed: this.templeUnsealed,
      endedEndingId: this.endedEndingId,
      onboardingStep: this.onboardingStep,
      onboardingDismissed: this.onboardingDismissed
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.currentChapterId === 'number') this.currentChapterId = data.currentChapterId;
    if (typeof data.currentStepIndex === 'number') this.currentStepIndex = data.currentStepIndex;
    if (typeof data.hasGatheredBranch === 'boolean') this.hasGatheredBranch = data.hasGatheredBranch;
    if (typeof data.hasConsumedFoodOrWater === 'boolean') this.hasConsumedFoodOrWater = data.hasConsumedFoodOrWater;
    if (typeof data.hasReachedCampsite === 'boolean') this.hasReachedCampsite = data.hasReachedCampsite;
    if (typeof data.hasCraftedKindling === 'boolean') this.hasCraftedKindling = data.hasCraftedKindling;
    if (typeof data.hasCookedFood === 'boolean') this.hasCookedFood = data.hasCookedFood;
    if (typeof data.hasCraftedAxe === 'boolean') this.hasCraftedAxe = data.hasCraftedAxe;
    if (typeof data.monkeyBefriended === 'boolean') this.monkeyBefriended = data.monkeyBefriended;
    if (typeof data.secondKidFound === 'boolean') this.secondKidFound = data.secondKidFound;
    if (typeof data.secondKidAwake === 'boolean') this.secondKidAwake = data.secondKidAwake;
    if (typeof data.secondKidAffection === 'number') this.secondKidAffection = data.secondKidAffection;
    if (typeof data.sosBuilt === 'boolean') this.sosBuilt = data.sosBuilt;
    if (typeof data.radioBroadcasted === 'boolean') this.radioBroadcasted = data.radioBroadcasted;
    if (typeof data.raftBuilt === 'boolean') this.raftBuilt = data.raftBuilt;
    if (typeof data.pureCrystalDelivered === 'boolean') this.pureCrystalDelivered = data.pureCrystalDelivered;
    if (typeof data.raymondRescued === 'boolean') this.raymondRescued = data.raymondRescued;
    if (typeof data.lighthouseLit === 'boolean') this.lighthouseLit = data.lighthouseLit;
    if (typeof data.firstResonanceSettled === 'boolean') this.firstResonanceSettled = data.firstResonanceSettled;
    if (Array.isArray(data.gemsCollected)) this.gemsCollected = new Set(data.gemsCollected);
    if (typeof data.templeUnsealed === 'boolean') {
      this.templeUnsealed = data.templeUnsealed;
    } else {
      const hasCrown = Boolean((this.game?.ui?.inventory?.poseidon_crown || 0) > 0 || (this.game?.storageSystem?.storageInventory?.poseidon_crown || 0) > 0);
      const solved = Boolean(this.game?.templePuzzle?.puzzleSolved || this.game?.templePuzzle?.vaultClaimed);
      this.templeUnsealed = hasCrown || solved;
    }
    this.endedEndingId = null;
    // 第六章即成长主线已完成；兼容没有 isCompleted 的旧档。
    this.isCompleted = data.isCompleted === true || this.currentChapterId === 6;
    if (typeof data.onboardingStep === 'number') this.onboardingStep = Math.max(0, Math.min(ONBOARDING_STEPS.length, data.onboardingStep));
    else if ((data.currentChapterId || 0) > 0 || (data.currentStepIndex || 0) > 0 || data.hasGatheredBranch || data.hasConsumedFoodOrWater || data.hasReachedCampsite) this.onboardingStep = ONBOARDING_STEPS.length;
    if (typeof data.onboardingDismissed === 'boolean') this.onboardingDismissed = data.onboardingDismissed;
    else if ((data.currentChapterId || 0) > 0 || (data.currentStepIndex || 0) > 0 || data.hasGatheredBranch || data.hasConsumedFoodOrWater || data.hasReachedCampsite) this.onboardingDismissed = true;
    this._renderOnboarding();
  }
}

const ONBOARDING_STEPS = [
  { id: 'move', title: '先熟悉移动', text: '拖动左下角摇杆移动。' },
  { id: 'gather', title: '拾取漂流物', text: '走近发亮的树枝，点按右侧互动按钮拾取。' },
  { id: 'inventory', title: '查看随身行囊', text: '点按右上角行囊，查看刚捡到的材料和随身食物。' },
  { id: 'consume', title: '补充体力', text: '在行囊中选择苹果并点按使用；也可以到溪边互动饮水。' }
];

const FREEPLAY_BANNER = '🏝️ 主线完成 · 自由经营：继续挖矿、扩建营地与探索群岛！';
