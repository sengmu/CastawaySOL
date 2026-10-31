// CastawaySOL - 热带暴风雨与台风气象生存系统 (Weather Survival System)
// 1. 动态气象状态机：晴天 (Clear)、多云 (Cloudy)、倾盆暴雨 (Downpour)、热带台风与雷暴 (Typhoon)
// 2. 真实失温机制 (Hypothermia)：风雨失温掉血、篝火烘烤回暖、烤物回温与防风油布特权
// 3. 3D 雨丝粒子、闪电雷鸣与狂风呼啸视听渲染
// 4. 台风巨浪奇遇：浅滩冲刷远洋沉船黑匣子与稀有深海遗落

import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export const WEATHER_TYPES = {
  clear: {
    id: 'clear',
    name: '明媚晴朗',
    icon: '☀️',
    tempDrain: 0.0,
    fogDensity: 0.0032,
    skyColor: 0x76c4e0,
    desc: '热带海岛风和日丽，适宜远行探索与采摘垂钓。'
  },
  cloudy: {
    id: 'cloudy',
    name: '海风多云',
    icon: '⛅',
    tempDrain: 0.02,
    fogDensity: 0.0045,
    skyColor: 0x8fa4b8,
    desc: '云层渐厚海风呼啸，气温微降，注意防范突发暴雨。'
  },
  rain: {
    id: 'rain',
    name: '倾盆暴雨',
    icon: '🌧️',
    tempDrain: 0.25, // 暴露在野外体温流失
    fogDensity: 0.0075,
    skyColor: 0x4a6572,
    desc: '大雨如注！露天失温加快，营火易被浇灭，请尽快避雨取暖！'
  },
  typhoon: {
    id: 'typhoon',
    name: '热带台风雷暴',
    icon: '⛈️',
    tempDrain: 0.55, // 狂风雷暴急速失温
    fogDensity: 0.012,
    skyColor: 0x263238,
    desc: '飓风雷暴肆虐！极度寒冷刺骨！但巨浪会将深海沉船黑匣子冲上南岸浅滩！'
  }
};

export class WeatherSurvivalSystem {
  constructor(game) {
    this.game = game;

    // 当前气象状态
    this.currentWeather = 'clear';
    this.weatherTimer = 180.0; // 气象自然演变倒计时 (秒)
    this.weatherSequence = ['clear', 'cloudy', 'rain', 'typhoon', 'rain', 'clear'];
    this.sequenceIndex = 0;

    // 玩家体温生存状态 (37.0°C 为常温)
    this.bodyTemp = 37.0;
    this.isWet = false;
    this.hypothermiaDamageTimer = 0.0;

    // 营地篝火防雨顶棚状态 (未搭建则暴雨中营火熄灭)
    this.hasFireShelter = false;
    this.hasOilskinCloak = false; // 防雨油布披风商业化/合成特权

    // 台风浅滩冲刷沉船黑匣子宝藏
    this.typhoonWashedItems = [];
    this.hasSpawnedTyphoonLoot = false;

    // 3D 雨丝粒子系统 (经克制调优：细小透亮雨丝，杜绝大片白点雪花感)
    this.rainParticles = null;
    this.rainCount = 420;
    this.lightningLight = null;
    this.lightningTimer = 0.0;

    // 屏幕寒颤暗角 Vignette
    this.initHypothermiaVignette();

    // 注入场景实体
    if (this.game && this.game.scene) {
      this.initRainSystem();
      this.initLightningLight();
    }
  }

  // 初始化 3D 雨丝粒子与闪电光源
  initRainSystem() {
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    const velocities = new Float32Array(this.rainCount);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 26 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      velocities[i] = 26.0 + Math.random() * 8.0; // 高速穿透下落，呈现利落雨丝动势
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainGeo.userData = { velocities };

    // 极细清澈半透明水丝 (尺寸缩小至 0.11，避免方块雪粒感)
    const rainMat = new THREE.PointsMaterial({
      color: 0x7aaec6,
      size: 0.11,
      transparent: true,
      opacity: 0.0, // 晴天初始完全透明
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.name = 'weather-rain-particles';
    this.game.scene.add(this.rainParticles);
  }

  initLightningLight() {
    this.lightningLight = new THREE.PointLight(0xffffff, 0, 120, 1.2);
    this.lightningLight.position.set(0, 45, 0);
    this.game.scene.add(this.lightningLight);
  }

  // 初始化轻度/重度失温电影级有机椭圆寒霜暗角 (坚决杜绝生硬矩形边框与盒状投影，保持 3D 沉浸感)
  initHypothermiaVignette() {
    if (typeof document === 'undefined') return;
    let vignette = document.getElementById('hypothermia-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'hypothermia-vignette';
      vignette.style.cssText = `
        position: fixed; inset: 0; pointer-events: none; z-index: 120;
        opacity: 0;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0, 180, 216, 0.22) 80%, rgba(15, 65, 110, 0.65) 100%);
        transition: opacity 0.6s ease-out;
      `;
      document.body.appendChild(vignette);
    }
    this.vignetteElement = vignette;
  }

  // 手动/动态切换气象
  setWeather(weatherKey) {
    if (!WEATHER_TYPES[weatherKey]) return;
    this.currentWeather = weatherKey;
    const spec = WEATHER_TYPES[weatherKey];

    // 刷新雾效与氛围
    if (this.game && this.game.scene && this.game.scene.fog) {
      this.game.scene.fog.density = spec.fogDensity;
    }

    // 提示气象变幻
    if (this.game && this.game.ui) {
      this.game.ui.showToast(`🌦️ 气象异动：【${spec.icon} ${spec.name}】！\n${spec.desc}`, 'important');
    }

    if (weatherKey === 'typhoon') {
      soundEngine.playTreeShake();
      haptics.heavy();
      this.spawnTyphoonSurgeLoot();
    } else {
      this.hasSpawnedTyphoonLoot = false;
    }
  }

  // 台风巨浪冲刷黑匣子与深海遗落至南岸浅滩 (Z ~ 32 ~ 35)
  spawnTyphoonSurgeLoot() {
    if (this.hasSpawnedTyphoonLoot) return;
    this.hasSpawnedTyphoonLoot = true;

    // 清除旧掉落
    this.clearTyphoonLoot();

    const surgeItems = [
      { id: 'black_box', name: '远洋沉船黑匣子', icon: '🧰', pos: new THREE.Vector3(-8.5, 0.15, 33.2) },
      { id: 'deepsea_shell', name: '雷暴巨鳌硬壳', icon: '🐚', pos: new THREE.Vector3(4.5, 0.15, 34.5) },
      { id: 'driftwood_raft', name: '深海捆绑浮木排', icon: '🪵', pos: new THREE.Vector3(12.0, 0.15, 32.8) }
    ];

    surgeItems.forEach(item => {
      const group = new THREE.Group();
      group.position.copy(item.pos);

      // 发光外形
      const geo = new THREE.BoxGeometry(0.7, 0.5, 0.5);
      const mat = new THREE.MeshStandardMaterial({
        color: item.id === 'black_box' ? 0xe67e22 : 0x0984e3,
        emissive: item.id === 'black_box' ? 0xd35400 : 0x00cec9,
        emissiveIntensity: 0.6,
        roughness: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      group.add(mesh);

      // 地面微光波纹
      const ringGeo = new THREE.RingGeometry(0.5, 0.8, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd32a, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.1;
      group.add(ring);

      this.game.scene.add(group);
      this.typhoonWashedItems.push({ ...item, group, picked: false });
    });

    if (this.game && this.game.ui) {
      this.game.ui.showToast('🌊 台风巨浪将【沉船黑匣子】与深海遗落冲上了南岸沙滩！快去抢救打捞！', 'important');
    }
  }

  // 拾取台风遗落
  checkTyphoonPickup(playerPos) {
    for (const item of this.typhoonWashedItems) {
      if (!item.picked && item.pos.distanceTo(playerPos) < 2.5) {
        item.picked = true;
        item.group.visible = false;
        soundEngine.playItemDrop();
        haptics.success();

        if (item.id === 'black_box') {
          // 开箱丰厚奖励
          const inv = this.game.ui ? this.game.ui.inventory : {};
          inv['ancient_coin'] = (inv['ancient_coin'] || 0) + 35;
          inv['nail'] = (inv['nail'] || 0) + 3;
          inv['battery'] = (inv['battery'] || 0) + 1;
          if (this.game.ui) {
            this.game.ui.renderInventory();
            this.game.ui.showDialog('🧰 破解沉船黑匣子！', '你撬开了经受巨浪冲刷的加固黑匣子！\n\n获得珍稀物资：\n🪙 古代海盗金币 x35！\n🔩 加固铁钉 x3！\n🔋 强效干电池 x1！');
          }
        } else if (item.id === 'deepsea_shell') {
          if (this.game.ui) {
            this.game.ui.addInventory('sea_crab', 3);
            this.game.ui.showToast('🐚 获取了 3 只被巨浪击昏的深海肥蟹！', 'small');
          }
        } else if (item.id === 'driftwood_raft') {
          if (this.game.ui) {
            this.game.ui.addInventory('lumber', 2);
            this.game.ui.showToast('🪵 拆解深海浮木，获得了【高等级重型方木】x2！', 'small');
          }
        }
        return true;
      }
    }
    return false;
  }

  clearTyphoonLoot() {
    this.typhoonWashedItems.forEach(i => {
      if (i.group && this.game.scene) {
        this.game.scene.remove(i.group);
      }
    });
    this.typhoonWashedItems = [];
  }

  // 搭建营地防风避雨篝火石棚
  buildFireShelter() {
    const inv = this.game.ui ? this.game.ui.inventory : {};
    const stoneCount = (inv['flint'] || 0) + (inv['rock'] || 0);
    const barkCount = inv['tree_bark'] || 0;

    if (stoneCount < 3 || barkCount < 2) {
      return { ok: false, msg: '材料不足！需要【石料/燧石 x3】+【坚固树皮 x2】搭建防雨石棚' };
    }

    // 扣减材料
    let neededStone = 3;
    if (inv['rock'] >= neededStone) {
      inv['rock'] -= neededStone;
    } else {
      neededStone -= (inv['rock'] || 0);
      delete inv['rock'];
      inv['flint'] -= neededStone;
    }
    inv['tree_bark'] -= 2;
    if (inv['tree_bark'] <= 0) delete inv['tree_bark'];

    this.hasFireShelter = true;
    if (this.game.ui) this.game.ui.renderInventory();
    soundEngine.playPlaceFurniture();
    haptics.success();

    return { ok: true, msg: '⛺ 成功为营火搭建原木石料避雨顶棚！暴雨与台风中营火永不熄灭！' };
  }

  // 帧更新气象状态机、粒子与体温
  update(delta) {
    // 1. 周期性气象轮转
    this.weatherTimer -= delta;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 160.0 + Math.random() * 60.0;
      this.sequenceIndex = (this.sequenceIndex + 1) % this.weatherSequence.length;
      this.setWeather(this.weatherSequence[this.sequenceIndex]);
    }

    const isRaining = (this.currentWeather === 'rain' || this.currentWeather === 'typhoon');
    const isTyphoon = (this.currentWeather === 'typhoon');

    // 2. 3D 雨丝粒子动画驱动 (克制透明度，避免遮挡与白花花雪雾)
    if (this.rainParticles && this.game && this.game.player) {
      const pPos = this.game.player.position;
      const targetOpacity = isTyphoon ? 0.40 : (isRaining ? 0.22 : 0.0);
      this.rainParticles.material.opacity = THREE.MathUtils.lerp(this.rainParticles.material.opacity, targetOpacity, delta * 3.0);

      if (this.rainParticles.material.opacity > 0.02) {
        const posAttr = this.rainParticles.geometry.attributes.position;
        const velocities = this.rainParticles.geometry.userData.velocities;
        const windX = isTyphoon ? delta * 12.0 : delta * 3.0;

        for (let i = 0; i < this.rainCount; i++) {
          posAttr.array[i * 3 + 1] -= velocities[i] * delta * (isTyphoon ? 1.4 : 1.0);
          posAttr.array[i * 3] += windX;

          // 雨丝下落到底部循环回天顶，跟随玩家移动包裹
          if (posAttr.array[i * 3 + 1] < -0.5) {
            posAttr.array[i * 3] = pPos.x + (Math.random() - 0.5) * 55;
            posAttr.array[i * 3 + 1] = pPos.y + 24.0 + Math.random() * 8.0;
            posAttr.array[i * 3 + 2] = pPos.z + (Math.random() - 0.5) * 55;
          }
        }
        posAttr.needsUpdate = true;
      }
    }

    // 3. 台风雷暴闪电特效
    if (isTyphoon && this.lightningLight) {
      this.lightningTimer -= delta;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4.0 + Math.random() * 7.0;
        this.lightningLight.intensity = 8.5; // 瞬间强白光雷暴闪烁
        soundEngine.playTreeShake(); // 伴随雷鸣震颤
        haptics.heavy();
      } else {
        this.lightningLight.intensity = THREE.MathUtils.lerp(this.lightningLight.intensity, 0, delta * 8.0);
      }
    }

    // 4. 真实失温与取暖结算
    if (this.game && this.game.player && this.game.survival) {
      const pPos = this.game.player.position;
      // 检查是否靠近营火 ((-7, 0, -4) 距离 < 3.2 米)
      const distToFire = Math.hypot(pPos.x - (-7), pPos.z - (-4));
      const isNearFire = distToFire < 3.2;

      // 检查是否处于帐篷内 ((-16, 0, -8) 距离 < 3.8 米)
      const distToTent = Math.hypot(pPos.x - (-16), pPos.z - (-8));
      const isInTent = distToTent < 3.8;

      const spec = WEATHER_TYPES[this.currentWeather];
      let drainRate = spec.tempDrain;

      // 若穿着防雨油布风衣，暴雨完全免失温，台风失温减免 75%
      if (this.hasOilskinCloak) {
        drainRate = (this.currentWeather === 'typhoon') ? 0.12 : 0.0;
      }

      if (isNearFire) {
        // 营火烘烤快速回温 (+1.2°C/秒)
        this.bodyTemp = Math.min(37.0, this.bodyTemp + delta * 1.2);
        this.isWet = false;
      } else if (isInTent) {
        // 帐篷避风慢慢回温 (+0.4°C/秒)
        this.bodyTemp = Math.min(37.0, this.bodyTemp + delta * 0.4);
      } else if (isRaining) {
        // 露天淋雨失温
        this.isWet = true;
        this.bodyTemp = Math.max(30.0, this.bodyTemp - delta * drainRate);
      } else {
        // 晴朗天气自然平缓恢复
        this.bodyTemp = Math.min(37.0, this.bodyTemp + delta * 0.2);
      }

      // 5. 失温惩罚结算
      if (this.bodyTemp < 35.0) {
        // 电影级有机寒霜暗角平滑显现 (无边界矩形，仅柔和晕染四周)
        const frostLevel = Math.min(1.0, (35.0 - this.bodyTemp) / 5.0); // 0 ~ 1.0
        if (this.vignetteElement) {
          // 适度透明度 + 轻微失温寒颤呼吸 (0.4 ~ 0.85)
          const pulse = Math.sin(Date.now() * 0.003) * 0.08;
          this.vignetteElement.style.opacity = Math.max(0, Math.min(1, frostLevel * 0.85 + pulse));
        }

        // 重度失温 (< 33°C) 扣除生命
        if (this.bodyTemp < 33.0) {
          this.hypothermiaDamageTimer += delta;
          if (this.hypothermiaDamageTimer >= 3.0) {
            this.hypothermiaDamageTimer = 0.0;
            this.game.survival.life = Math.max(0, this.game.survival.life - 3);
            if (this.game.ui) {
              this.game.ui.updateSurvivalHUD();
              this.game.ui.showToast(`🥶 严重失温！体温仅 ${this.bodyTemp.toFixed(1)}°C！生命持续流失！快去营火烘暖！`, 'important');
            }
          }
        }
      } else {
        if (this.vignetteElement) {
          this.vignetteElement.style.opacity = '0';
        }
      }
    }
  }

  // 序列化
  serialize() {
    return {
      currentWeather: this.currentWeather,
      weatherTimer: this.weatherTimer,
      bodyTemp: this.bodyTemp,
      hasFireShelter: this.hasFireShelter,
      hasOilskinCloak: this.hasOilskinCloak
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (!data) return;
    if (data.currentWeather) this.setWeather(data.currentWeather);
    if (typeof data.weatherTimer === 'number') this.weatherTimer = data.weatherTimer;
    if (typeof data.bodyTemp === 'number') this.bodyTemp = data.bodyTemp;
    if (typeof data.hasFireShelter === 'boolean') this.hasFireShelter = data.hasFireShelter;
    if (typeof data.hasOilskinCloak === 'boolean') this.hasOilskinCloak = data.hasOilskinCloak;
  }
}
