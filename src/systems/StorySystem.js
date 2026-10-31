import { ISLAND_LAYOUT, distanceXZ } from '../core/IslandLayout.js';

// CastawaySOL - 荒岛求生主线剧情与真实行为事件监听引擎 (Story & Action-based Quest Engine)
// 杜绝开局初始条件被动跳关；完全基于真实物理采集、进食、饮水、营地到达与烹饪制作驱动

export class StorySystem {
  constructor(game) {
    this.game = game;

    // 当前主线章节与子步骤索引
    this.currentChapterId = 0;
    this.currentStepIndex = 0;

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
    this.endedEndingId = null;             // 已达成的结局代码 (ED1 - ED8)

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
            desc: '探索南岸沙滩，按【E】走近拾取散落的【漂流木棍】！',
            hint: '在海滩四周走动，靠近发光的树枝按 E 键拾取'
          },
          {
            id: 'find_food_water',
            type: 'action',
            desc: '四维代谢正在消耗！在行囊中食用野果，或前往内陆小溪饮水！',
            hint: '打开行囊点击食用随身野苹果，或前往内陆溪流 (X:13.5) 按 E 痛快畅饮'
          },
          {
            id: 'find_campsite',
            type: 'position',
            desc: '沿沙滩向内陆探索，寻找椰林后方的帐篷营地！',
            checkPosition: (playerPos) => distanceXZ(playerPos, ISLAND_LAYOUT.tent) < 5.0,
            hint: '从南岸向西北走，寻找营地帐篷 (-16, 0, -8) 与跳动的篝火'
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
            desc: '靠近营地篝火按【E】，用引火物烘烤鲜鱼或采集的苹果！',
            hint: '持食材靠近营地中央篝火 (-7, 0, -4) 按 E 键烹饪热食'
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
            desc: '小猴子馋得直流口水！在背包中选中【苹果】或【烤鱼】按【E】投喂它！',
            checkState: () => this.monkeyBefriended,
            hint: '靠近小猴子按 E 投喂美味食物，收服猴子伙伴'
          }
        ]
      },
      {
        id: 3,
        title: '第三章：电波呼救与邻岛信号',
        subtitle: '收音机求救 · 浮木岛的呼号',
        steps: [
          {
            id: 'fix_radio',
            type: 'action',
            desc: '打捞搁浅物资箱中的零件，在合成台修复为【工作收音机】！',
            hint: '在合成台使用破损收音机 + 电池合成无线电设备'
          },
          {
            id: 'radio_contact',
            type: 'state',
            desc: '手持收音机前往南岸 S.O.S 地标按【E】架设天线，接收邻岛求救信号！',
            checkState: () => this.radioBroadcasted,
            hint: '在南岸沙滩巨石 S.O.S 处按 E 键调谐收音机频段'
          },
          {
            id: 'build_raft',
            type: 'state',
            desc: '在西南浅滩造好【求生大木筏】，展开海图备足水粮，准备出海营救同伴！',
            checkState: () => this.raftBuilt,
            hint: '准备4根木材+2铁钉+2藤蔓在浅滩建造大木筏'
          }
        ]
      },
      {
        id: 4,
        title: '第四章：暴风雨洗礼与第二幸存者',
        subtitle: '命运相遇的羁绊',
        steps: [
          {
            id: 'rescue_partner',
            type: 'state',
            desc: '在东北悬崖高台木屋旁巡查，发现昏迷的第二幸存者，按【E】紧急救援！',
            checkState: () => this.secondKidAwake,
            hint: '前往东北侧山顶别墅高台 (25, 1.8, -19) 救治昏迷同伴'
          },
          {
            id: 'care_partner',
            type: 'state',
            desc: '给同伴投喂清水与鲜美烤鱼，将彼此的好感度培养至 100 以上！',
            checkState: () => this.secondKidAffection >= 100,
            hint: '每日与同伴对话互动并赠送美食增加好感度'
          }
        ]
      },
      {
        id: 5,
        title: '第五章：远古遗迹与终极生还',
        subtitle: '解开神殿谜题，逃出生天',
        steps: [
          {
            id: 'collect_gems',
            type: 'state',
            desc: '探索全岛采集 3 颗神秘古代宝石（星形宝石、菱形宝石、圆月宝石）！',
            checkState: () => this.gemsCollected.size >= 3,
            hint: '在山麓洞穴、高台树林与神殿石雕处探索获取宝石'
          },
          {
            id: 'final_escape',
            type: 'state',
            desc: '乘上坚固大木筏扬帆远航，逃出孤岛！',
            checkState: () => this.endedEndingId !== null,
            hint: '乘木筏或呼叫救援触发终极结算'
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

  // 获得格式化的当前任务引导文案
  getQuestBannerText() {
    const chapter = this.getCurrentChapter();
    const step = this.getCurrentStep();
    return `🚩 [${chapter.title}] ${step.desc}`;
  }

  // 帧更新循环：仅检测地理位置到达与明确的状态变更，严禁被动读取背包跳关！
  update(playerPos, inventory, survivalStats) {
    if (this.endedEndingId || this.isAdvancing) return;

    const currentStep = this.getCurrentStep();
    if (!currentStep) return;

    // 1. 位置到达类任务检测
    if (currentStep.type === 'position' && currentStep.checkPosition) {
      if (currentStep.checkPosition(playerPos)) {
        if (currentStep.id === 'find_campsite') {
          this.hasReachedCampsite = true;
        }
        this.advanceStep();
        return;
      }
    }

    // 2. 状态驱动类任务检测 (如好感度达到要求、巨石阵拼装完成)
    if (currentStep.type === 'state' && currentStep.checkState) {
      if (currentStep.checkState()) {
        this.advanceStep();
        return;
      }
    }
  }

  // === 真实行为监听器 (Action-based Triggers) ===

  // 真实采集/拾取了自然资源
  onGatherResource(itemType) {
    if (this.currentChapterId === 0 && this.currentStepIndex === 0) {
      if (itemType === 'tree_branch' || itemType === 'driftwood') {
        this.hasGatheredBranch = true;
        this.advanceStep();
      }
    }
  }

  // 真实食用了食物
  onConsumeFood(foodId) {
    if (this.currentChapterId === 0 && this.currentStepIndex === 1) {
      this.hasConsumedFoodOrWater = true;
      this.advanceStep();
    }
  }

  // 真实饮用了淡水泉水或水壶
  onDrinkWater() {
    if (this.currentChapterId === 0 && this.currentStepIndex === 1) {
      this.hasConsumedFoodOrWater = true;
      this.advanceStep();
    }
  }

  // 真实在合成台完成了道具制作
  onCraftItem(product) {
    if (this.currentChapterId === 1 && this.currentStepIndex === 0 && product === 'kindling') {
      this.hasCraftedKindling = true;
      this.advanceStep();
    } else if (this.currentChapterId === 1 && this.currentStepIndex === 2 && product === 'stone_axe') {
      this.hasCraftedAxe = true;
      this.advanceStep();
    } else if (this.currentChapterId === 3 && this.currentStepIndex === 0 && product === 'workradio') {
      this.advanceStep();
    }
  }

  // 真实在篝火完成了烹饪
  onCookFood() {
    if (this.currentChapterId === 1 && this.currentStepIndex === 1) {
      this.hasCookedFood = true;
      this.advanceStep();
    }
  }

  // 真实完成了无线电架设调谐并收到邻岛呼救
  onRadioContact() {
    this.radioBroadcasted = true;
    if (this.currentChapterId === 3 && this.currentStepIndex === 1) {
      this.advanceStep();
    }
  }

  // 单步防跃迁推进守卫
  advanceStep() {
    if (this.isAdvancing) return;
    this.isAdvancing = true;

    try {
      const chapter = this.getCurrentChapter();
      if (this.currentStepIndex < chapter.steps.length - 1) {
        this.currentStepIndex++;
        this.notifyQuestProgress(true);
      } else {
        // 晋级下一章节
        if (this.currentChapterId < this.chapters.length - 1) {
          this.currentChapterId++;
          this.currentStepIndex = 0;
          this.notifyQuestChapterComplete();
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
    if (this.currentChapterId === 2 && this.currentStepIndex === 1) {
      this.advanceStep();
    }
  }

  // 拼搭沙滩巨型 SOS
  buildSosSign() {
    this.sosBuilt = true;
    if (this.game && this.game.ui) {
      this.game.ui.showDialog('🪨 沙滩 SOS 地标拼装完成！', '你搬运大量海滩巨石与白色贝壳，在平坦南岸沙滩上拼出了直径十余米的巨型【S.O.S】求救符号！\n配合修好的收音机广播，空中搜救机将能一眼看见！');
    }
    if (this.currentChapterId === 3 && this.currentStepIndex === 1) {
      this.advanceStep();
    }
  }

  // 建造救生大木筏
  buildRaft() {
    this.raftBuilt = true;
    if (this.game && this.game.ui) {
      this.game.ui.showDialog('⛵ 求生大木筏建造完成！', '经过精密的木工捆绑与打钉加固，一艘坚不可摧的双桅求生大木筏在南岸西侧码头赫然成型！\n现在具备横渡深海逃离荒岛的航海载具！');
    }
    if (this.currentChapterId === 3 && this.currentStepIndex === 1) {
      this.advanceStep();
    }
  }

  // 触发特定结局 (仅由明确的剧情交互如乘筏远航或无线电呼叫直升机触发)
  triggerEnding(endingId) {
    this.endedEndingId = endingId;
    if (this.game && this.game.ui) {
      this.game.ui.triggerEndingScreen(endingId, {
        day: this.game.survival ? this.game.survival.day : 1,
        steps: this.game.survival ? this.game.survival.steps : 0,
        monkeyBefriended: this.monkeyBefriended,
        secondKidAwake: this.secondKidAwake,
        secondKidAffection: this.secondKidAffection
      });
    }
  }

  // 序列化与反序列化支持 (用于 SaveSystem 安全存档与迁移)
  serialize() {
    return {
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
      endedEndingId: this.endedEndingId
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
    if (Array.isArray(data.gemsCollected)) this.gemsCollected = new Set(data.gemsCollected);
    if (data.endedEndingId) this.endedEndingId = data.endedEndingId;
  }
}
