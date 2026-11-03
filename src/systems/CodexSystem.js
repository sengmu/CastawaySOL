// CastawaySOL - D2 博物图鉴系统 (Codex System)
// 4 卷 32 项本地探索档案，支持老档回溯点亮、分卷满收集奖励与序列化。
// 严格合规：图鉴奖励对 sol_crystal 产出速率、纯晶日产能上限、矿机算力及赛季共振声望 RS 影响严格等于 0。
// 本地博物图鉴与荣誉头衔【群岛守望者】不包装为服务端联机、云存档或链上 NFT。

export const CODEX_VOLUMES = Object.freeze({
  ecology: {
    id: 'ecology',
    name: '生态与海产卷',
    icon: '🌿',
    entries: [
      'apple', 'coconut', 'golden_coconut', 'tree_sap',
      'ivy', 'fish', 'sardine', 'clam', 'sea_crab', 'pearl', 'bird_egg', 'driftwood'
    ],
    rewardDesc: '营地储物箱容量 +10 格',
    rewardKey: 'storage_expand_10'
  },
  geology: {
    id: 'geology',
    name: '地质与晶脉卷',
    icon: '💎',
    entries: [
      'stone_chunk', 'big_rock', 'iron_ore', 'copper_ore', 'iron_ingot',
      'metal_scrap', 'sol_shard', 'sol_crystal', 'sol_crystal_pure', 'sol_crystal_deep'
    ],
    rewardDesc: '获赠【共振椰子蟹煲】×2',
    rewardKey: 'grant_resonance_crab_pot_x2'
  },
  bestiary: {
    id: 'bestiary',
    name: '群岛异兽卷',
    icon: '🦀',
    entries: ['crab', 'boar', 'hermit_crab', 'basalt_lizard', 'crystal_crab'],
    rewardDesc: '近战武器耐久损耗 -25%',
    rewardKey: 'melee_durability_discount'
  },
  chronicles: {
    id: 'chronicles',
    name: '先民遗迹碑文卷',
    icon: '🏛️',
    entries: [
      'relic_sos_radio', 'relic_quarry_monolith',
      'relic_temple_corona', 'relic_poseidon_crown', 'relic_harmonic_tower'
    ],
    rewardDesc: '解锁完整《群岛先民编年史》与本地头衔【群岛守望者】',
    rewardKey: 'unlock_chronicles_and_title'
  }
});

// 《群岛先民编年史》全文（碑文卷满奖励解锁，不包装为链上 NFT）
export const CHRONICLES_TEXT = `
【群岛先民编年史·残存版本】

第一纪·晶石降临：远古时期，七颗地脉晶石从星海坠落，嵌入群岛珊瑚礁底层，
孕育出绵延数万平方海里的地脉共振网络。先民于主岛北崖建造"星海谐振塔"，
以感应与校准晶脉频率，驱动整座群岛生态的繁荣。

第二纪·采石工程：先民在矿石岛开凿"先民地脉采石碑"，记录了十二种矿脉晶石
的提纯与共振利用方法，其中高纯精炼纯晶的冷淬工艺延续至今。

第三纪·神殿宝冠：神殿石顶宝冠与波塞冬金冠由海皇一族供奉，为群岛带来潮汐
护佑与稀有海产的丰盛馈赠，据说与星海谐振塔的频率同频才能完全激活。

第四纪·遗失与复苏：不明的"频率断裂"事件导致先民文明骤然中断，遗存的传送
阵、采石碑与碑文被海沙埋没。现今的探索者正在一步步唤醒这片沉睡的星海记忆。

——本编年史由【群岛守望者】根据遗迹碑文整理，仅供本地收藏，不作商业用途。
`.trim();

export class CodexSystem {
  constructor(game) {
    this.game = game;

    // 各条目已点亮集合
    this.unlocked = new Set();

    // 各卷奖励已领取集合
    this.claimedVolumes = new Set();

    // 荣誉头衔
    this.hasWatcherTitle = false;

    // 完整编年史是否已解锁
    this.chroniclesUnlocked = false;

    // 编年史全文（解锁后供 UI 展示）
    this.chroniclesText = CHRONICLES_TEXT;
  }

  // 解锁单条图鉴条目（可安全重复调用）
  unlockEntry(entryId) {
    if (this.unlocked.has(entryId)) return false;
    this.unlocked.add(entryId);
    this._checkVolumeCompletion();
    return true;
  }

  // 通知击杀野生生物（由 WildlifeCombatSystem 调用）
  recordMobKill(mobType) {
    const mobMap = {
      crab: 'crab', boar: 'boar', hermit_crab: 'hermit_crab',
      basalt_lizard: 'basalt_lizard', crystal_crab: 'crystal_crab'
    };
    const id = mobMap[mobType];
    if (id) this.unlockEntry(id);
  }

  // 通知采集/拾取物品（由 UIManager.addInventory 调用）
  recordItemObtained(itemId) {
    const ecologyIds = new Set(['apple','coconut','golden_coconut','tree_sap','ivy','fish','sardine','clam','sea_crab','pearl','bird_egg','driftwood']);
    const geologyIds = new Set(['stone_chunk','big_rock','iron_ore','copper_ore','iron_ingot','metal_scrap','sol_shard','sol_crystal','sol_crystal_pure','sol_crystal_deep']);
    if (ecologyIds.has(itemId) || geologyIds.has(itemId)) {
      this.unlockEntry(itemId);
    }
  }

  // 通知遗迹互动（由场景系统调用）
  recordRelicInteracted(relicId) {
    const relicMap = {
      sos_radio: 'relic_sos_radio', quarry_monolith: 'relic_quarry_monolith',
      temple_corona: 'relic_temple_corona', poseidon_crown: 'relic_poseidon_crown',
      harmonic_tower: 'relic_harmonic_tower'
    };
    const id = relicMap[relicId] || (relicId.startsWith('relic_') ? relicId : null);
    if (id) this.unlockEntry(id);
  }

  // 老档回溯：从背包、营地储物箱、故事系统状态中自动点亮已有条目
  retroactiveSync() {
    const inv = this.game?.ui?.inventory || {};
    const box = this.game?.storageSystem?.storageInventory || {};
    const story = this.game?.story;

    const allItems = { ...inv, ...box };
    for (const itemId of Object.keys(allItems)) {
      if ((allItems[itemId] || 0) > 0) {
        this.recordItemObtained(itemId);
      }
    }

    if (story?.lighthouseLit) {
      this.unlockEntry('relic_harmonic_tower');
    }
    if (story?.firstResonanceSettled) {
      this.unlockEntry('sol_crystal');
    }
    if (this.game?.lighthouse?.poseidonRelicEnshrined) {
      this.unlockEntry('relic_poseidon_crown');
      this.unlockEntry('relic_harmonic_tower');
    }
  }

  // 内部检查各卷是否达到满收集
  _checkVolumeCompletion() {
    for (const [volId, vol] of Object.entries(CODEX_VOLUMES)) {
      if (this.claimedVolumes.has(volId)) continue;
      const allUnlocked = vol.entries.every(e => this.unlocked.has(e));
      if (allUnlocked) {
        this._autoClaimVolumeReward(volId);
      }
    }
  }

  // 自动发放分卷满收集奖励
  _autoClaimVolumeReward(volumeId) {
    if (this.claimedVolumes.has(volumeId)) return { ok: false, msg: '已领取' };
    this.claimedVolumes.add(volumeId);
    const vol = CODEX_VOLUMES[volumeId];
    this._applyVolumeReward(volumeId);

    if (this.game?.ui) {
      this.game.ui.showToast(`📖 博物图鉴【${vol.name}】全部收录！奖励：${vol.rewardDesc}`, 'medium');
    }
    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('codex_volume_reward');
    }
    return { ok: true };
  }

  // 手动领取分卷满收集奖励（UI 按钮调用）
  claimVolumeReward(volumeId) {
    const vol = CODEX_VOLUMES[volumeId];
    if (!vol) return { ok: false, msg: '图鉴卷不存在' };
    if (this.claimedVolumes.has(volumeId)) return { ok: false, msg: '该卷奖励已领取' };
    const allUnlocked = vol.entries.every(e => this.unlocked.has(e));
    if (!allUnlocked) {
      const missing = vol.entries.filter(e => !this.unlocked.has(e));
      return { ok: false, msg: `尚未集齐该卷全部图鉴（缺 ${missing.length} 项）` };
    }
    return this._autoClaimVolumeReward(volumeId);
  }

  // 发放具体奖励效果（不经过账本，属于本地探索奖励不属于经济代币）
  _applyVolumeReward(volumeId) {
    const vol = CODEX_VOLUMES[volumeId];
    switch (vol.rewardKey) {
      case 'storage_expand_10':
        if (this.game?.storageSystem) {
          this.game.storageSystem.bonusCapacity = (this.game.storageSystem.bonusCapacity || 0) + 10;
        }
        break;
      case 'grant_resonance_crab_pot_x2':
        if (this.game?.ui) {
          const inv = this.game.ui.inventory;
          inv.resonance_crab_pot = (inv.resonance_crab_pot || 0) + 2;
          this.game.ui.renderInventory();
        }
        break;
      case 'melee_durability_discount':
        // WildlifeCombatSystem 通过 getMeleeDurabilityLossMultiplier() 读取
        break;
      case 'unlock_chronicles_and_title':
        this.chroniclesUnlocked = true;
        this.hasWatcherTitle = true;
        if (this.game?.ui) {
          this.game.ui.showDialog(
            '🏛️【群岛守望者】荣誉头衔已授予！',
            '你完整收录了先民遗迹的全部碑文，《群岛先民编年史》的完整版本已解封！\n\n• 荣誉头衔【群岛守望者】永久刻入本地探索档案\n• 先民编年史可在博物图鉴中随时阅览\n\n（本地探索成就，不包含任何链上凭证或服务端积分）'
          );
        }
        break;
    }
  }

  // 获取单卷进度摘要（供 UI 弹窗调用）
  getVolumeSummary(volId) {
    const vol = CODEX_VOLUMES[volId];
    if (!vol) return null;
    const unlockedCount = vol.entries.filter(e => this.unlocked.has(e)).length;
    const completed = unlockedCount === vol.entries.length;
    return {
      id: volId,
      name: vol.name,
      total: vol.entries.length,
      unlocked: unlockedCount,
      completed,
      claimed: this.claimedVolumes.has(volId),
      rewardDesc: vol.rewardDesc,
      entries: vol.entries.map(e => ({ id: e, name: e, unlocked: this.unlocked.has(e) }))
    };
  }

  // 获取各卷当前收录进度（供 UI 弹窗渲染）
  getVolumeProgress() {
    return Object.entries(CODEX_VOLUMES).map(([volId, vol]) => ({
      id: volId,
      name: vol.name,
      icon: vol.icon,
      total: vol.entries.length,
      unlocked: vol.entries.filter(e => this.unlocked.has(e)).length,
      entries: vol.entries.map(e => ({ id: e, unlocked: this.unlocked.has(e) })),
      claimed: this.claimedVolumes.has(volId),
      rewardDesc: vol.rewardDesc
    }));
  }

  // 检查图鉴条目是否已点亮
  isUnlocked(entryId) {
    return this.unlocked.has(entryId);
  }

  // 获取近战武器耐久损耗乘数（默认 1.0，卷三满收集领奖后降至 0.75）
  getMeleeDurabilityLossMultiplier() {
    return this.claimedVolumes.has('bestiary') ? 0.75 : 1.0;
  }

  serialize() {
    return {
      unlocked: [...this.unlocked],
      claimedVolumes: [...this.claimedVolumes],
      hasWatcherTitle: this.hasWatcherTitle,
      chroniclesUnlocked: this.chroniclesUnlocked
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.unlocked)) {
      this.unlocked = new Set(data.unlocked);
    }
    if (Array.isArray(data.claimedVolumes)) {
      this.claimedVolumes = new Set(data.claimedVolumes);
    }
    if (typeof data.hasWatcherTitle === 'boolean') {
      this.hasWatcherTitle = data.hasWatcherTitle;
    }
    if (typeof data.chroniclesUnlocked === 'boolean') {
      this.chroniclesUnlocked = data.chroniclesUnlocked;
    }
  }
}
