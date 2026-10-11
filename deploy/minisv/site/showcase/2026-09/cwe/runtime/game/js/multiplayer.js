/**
 * 星之卡比 CP版 · 联机匹配与同步模块 (子棍 11 & 子棍 8 联机救援)
 * 2-10人随机匹配、60秒倒计时、1号主玩家机制、电脑(0+1)/手机双按钮召唤、主玩家10秒救援/队友5分钟救援、全员麦克风
 */
const KirbyMultiplayer = (() => {
  const CHANNEL_NAME = 'kirby_cp_online_bus_v1';
  let bus = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bus = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) {
    console.warn('BroadcastChannel not supported, falling back to local simulation');
  }

  // 联机状态
  let state = {
    isOnline: false,
    isHost: false, // 1号主玩家
    playerId: 'p_' + Math.random().toString(36).substr(2, 6),
    slotIndex: 1, // 1号主玩家, 2号, 3号...
    myCharacter: 'pink',
    hasSummoned: false, // 是否已完成召唤
    players: [], // [{ id, slot, name, character, hp, maxHp, isHost, summoned, isDead, rescueTimer, ability, x, y, z, micOn }]
    matchTimer: 60,
    matchInterval: null,
    pendingAbility: null, // 主玩家收服或吞下后供后来召唤玩家竞争的能力
    micActive: false
  };

  // 监听跨标签/跨窗口广播
  if (bus) {
    bus.onmessage = (event) => {
      const data = event.data;
      if (!state.isOnline || !data) return;
      handleRemoteMessage(data);
    };
  }

  function broadcast(type, payload = {}) {
    if (bus) {
      try {
        bus.postMessage({ type, sender: state.playerId, slot: state.slotIndex, payload, time: Date.now() });
      } catch (e) {}
    }
  }

  function handleRemoteMessage(msg) {
    if (msg.sender === state.playerId) return; // 忽略自己
    switch (msg.type) {
      case 'JOIN_QUEUE':
        addRemotePlayer(msg.sender, msg.payload.name, msg.payload.character);
        break;
      case 'SUMMON_EVENT':
        onRemoteSummon(msg.sender, msg.payload.abilityClaimed);
        break;
      case 'PLAYER_POS':
        updateRemotePos(msg.sender, msg.payload);
        break;
      case 'HOST_CAPTURED_ABILITY':
        state.pendingAbility = msg.payload.ability;
        break;
      case 'PLAYER_DOWN':
        onRemoteDown(msg.sender, msg.payload.isHost);
        break;
      case 'PLAYER_REVIVED':
        onRemoteRevived(msg.sender);
        break;
      case 'PLAYER_DISCONNECT':
        removePlayer(msg.sender);
        break;
    }
  }

  function addRemotePlayer(id, name, character) {
    if (state.players.find(p => p.id === id)) return;
    if (state.players.length >= 10) return; // 最多 10 人
    const slot = state.players.length + 1;
    state.players.push({
      id,
      slot,
      name: name || `卡比战友#${slot}`,
      character: character || 'yellow',
      hp: 10,
      maxHp: 10,
      isHost: slot === 1,
      summoned: false, // 必须召唤才出现
      isDead: false,
      rescueTimer: slot === 1 ? 10 : 300,
      ability: null,
      x: 0,
      y: 0.5,
      z: 14,
      micOn: true
    });
  }

  function onRemoteSummon(id, abilityClaimed) {
    const p = state.players.find(x => x.id === id);
    if (p) {
      p.summoned = true;
      if (abilityClaimed) {
        p.ability = abilityClaimed;
      }
    }
  }

  function updateRemotePos(id, pos) {
    const p = state.players.find(x => x.id === id);
    if (p) {
      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;
      p.hp = pos.hp;
    }
  }

  function onRemoteDown(id, isHost) {
    const p = state.players.find(x => x.id === id);
    if (p) {
      p.isDead = true;
      p.rescueTimer = isHost ? 10 : 300;
    }
  }

  function onRemoteRevived(id) {
    const p = state.players.find(x => x.id === id);
    if (p) {
      p.isDead = false;
      p.hp = 6;
      p.rescueTimer = p.isHost ? 10 : 300;
    }
  }

  function removePlayer(id) {
    state.players = state.players.filter(p => p.id !== id);
  }

  return {
    getState() {
      return state;
    },

    // 开始随机匹配 (2-10 人，最多 60 秒)
    startMatchmaking(username, character, onCountdown, onStart) {
      state.isOnline = true;
      state.myCharacter = character;
      state.players = [];
      state.matchTimer = 60;
      state.pendingAbility = null;

      // 本地玩家首先加入，排在第 1 位则成为 1 号主玩家
      state.slotIndex = 1;
      state.isHost = true;
      state.hasSummoned = true; // 主玩家一开始就自然存在

      const myPlayer = {
        id: state.playerId,
        slot: 1,
        name: username || '我（1号主玩家）',
        character,
        hp: 10,
        maxHp: 10,
        isHost: true,
        summoned: true, // 1号主玩家在开始时唯一出现
        isDead: false,
        rescueTimer: 10,
        ability: null,
        x: 0,
        y: 0.5,
        z: 12,
        micOn: false
      };
      state.players.push(myPlayer);

      // 向局域网/其他标签页广播加入
      broadcast('JOIN_QUEUE', { name: myPlayer.name, character });

      // 启动 60 秒倒计时
      if (state.matchInterval) clearInterval(state.matchInterval);
      state.matchInterval = setInterval(() => {
        state.matchTimer--;
        // 模拟其他在线玩家随机加入队列（如果暂无其他真实窗口）
        if (state.matchTimer === 55 && state.players.length < 2) {
          this.addSimulatedTeammate('炽焰勇士#2', 'yellow');
        }
        if (state.matchTimer === 45 && state.players.length < 3) {
          this.addSimulatedTeammate('碧海星光#3', 'blue');
        }

        if (onCountdown) onCountdown(state.matchTimer, state.players.length);

        // 倒计时结束或者达到要求即可开始 (至少2人)
        if (state.matchTimer <= 0) {
          clearInterval(state.matchInterval);
          if (state.players.length >= 2) {
            if (onStart) onStart();
          } else {
            // 自动补齐1名队友满足最少2人开局
            this.addSimulatedTeammate('星之伙伴#2', 'yellow');
            if (onStart) onStart();
          }
        }
      }, 1000);
    },

    // 辅助测试：允许提前开始 (只要 >= 2人)
    forceStartNow(onStart) {
      if (state.players.length < 2) {
        this.addSimulatedTeammate('星之守望者#2', 'yellow');
      }
      if (state.matchInterval) clearInterval(state.matchInterval);
      if (onStart) onStart();
    },

    addSimulatedTeammate(name, character) {
      if (state.players.length >= 10) return;
      const slot = state.players.length + 1;
      const id = 'sim_' + slot;
      state.players.push({
        id,
        slot,
        name,
        character,
        hp: 10,
        maxHp: 10,
        isHost: false,
        summoned: false, // 普通队友开局不出现，需召唤！
        isDead: false,
        rescueTimer: 300, // 5 分钟救援时间
        ability: null,
        x: (slot % 2 === 0 ? 1 : -1) * (slot * 1.5),
        y: 0.5,
        z: 14 + slot,
        micOn: true
      });
    },

    // 执行召唤 (电脑端同时按数字 0 和 1；手机端同时按两个召唤按钮)
    triggerSummon(slotIdx = state.slotIndex) {
      const p = state.players.find(x => x.slot === slotIdx);
      if (!p) return { success: false, msg: '未找到玩家信息' };
      if (p.summoned) return { success: false, msg: '角色已经在场中' };

      p.summoned = true;
      KirbyAudio.summon();

      // 召唤竞争：若主玩家刚才收服/吞下技能且暂未被他人领走，则最先召唤的玩家获得该能力！
      let awardedAbility = null;
      if (state.pendingAbility && !p.ability) {
        awardedAbility = state.pendingAbility;
        p.ability = awardedAbility;
        state.pendingAbility = null; // 别人不能重复获得该能力
      }

      broadcast('SUMMON_EVENT', { abilityClaimed: awardedAbility });
      return {
        success: true,
        awardedAbility,
        msg: awardedAbility 
          ? `✨ 召唤成功降临！并在竞争中抢先夺得了「${awardedAbility}」能力！` 
          : `✨ 角色召唤成功降临战场！`
      };
    },

    // 麦克风开关
    toggleMic() {
      state.micActive = !state.micActive;
      const me = state.players.find(x => x.id === state.playerId);
      if (me) me.micOn = state.micActive;
      return state.micActive;
    },

    // 主玩家收服或吞下了有技能的生物，触发能力竞争池
    onHostCapturedAbility(abilityKey) {
      if (!state.isOnline) return;
      state.pendingAbility = abilityKey;
      broadcast('HOST_CAPTURED_ABILITY', { ability: abilityKey });
    },

    // 玩家受到伤害 / 倒地处理
    updatePlayerHp(slotIdx, newHp) {
      const p = state.players.find(x => x.slot === slotIdx);
      if (!p) return;
      p.hp = Math.max(0, newHp);
      if (p.hp <= 0 && !p.isDead) {
        p.isDead = true;
        p.rescueTimer = p.isHost ? 10 : 300; // 主玩家10秒，队友5分钟(300秒)
        if (p.isHost) {
          KirbyAudio.siren();
        }
        broadcast('PLAYER_DOWN', { isHost: p.isHost });
      }
    },

    // 救援玩家 (消耗 1 颗头部星星)
    rescuePlayer(rescuerSlot, targetSlot) {
      const target = state.players.find(x => x.slot === targetSlot);
      if (!target || !target.isDead) return { success: false, msg: '该玩家无需救援' };

      const ok = KirbyStore.consumeHeadStars(1);
      if (!ok) {
        return { success: false, msg: '救援需要消耗 1 颗头部星星，当前星星不足！' };
      }

      target.isDead = false;
      target.hp = 6;
      target.rescueTimer = target.isHost ? 10 : 300;
      KirbyAudio.heart();
      broadcast('PLAYER_REVIVED', {});
      return { success: true, msg: `❤️ 成功救活战友【${target.name}】！消耗了 1 颗头部星星。` };
    },

    // 联机帧更新：处理倒计时与超时
    update(dt, onHostFailed, onPeerVanished) {
      if (!state.isOnline) return;

      // 模拟其他在线 AI 队友自动召唤进场 (如果开局后 3-5 秒还没召唤)
      state.players.forEach(p => {
        if (!p.isHost && !p.summoned) {
          if (!p.summonDelay) p.summonDelay = 2.5 + Math.random() * 4.0;
          p.summonDelay -= dt;
          if (p.summonDelay <= 0) {
            this.triggerSummon(p.slot);
          }
        }
      });

      // 处理倒地救援计时
      state.players.forEach(p => {
        if (p.isDead) {
          p.rescueTimer -= dt;
          if (p.rescueTimer <= 0) {
            if (p.isHost) {
              // 主玩家 10 秒超时 -> 联机宣告失败，整局结束
              if (onHostFailed) onHostFailed();
            } else {
              // 普通玩家 5 分钟超时 -> 自动从房间消失，其余人继续
              this.removePlayer(p.id);
              if (onPeerVanished) onPeerVanished(p);
            }
          }
        }
      });
    },

    // 玩家断开联机 -> 平滑转入单机模式
    disconnect() {
      if (state.isOnline) {
        broadcast('PLAYER_DISCONNECT', {});
      }
      state.isOnline = false;
      state.players = [];
      if (state.matchInterval) clearInterval(state.matchInterval);
    }
  };
})();

if (typeof window !== 'undefined') window.KirbyMultiplayer = KirbyMultiplayer;
if (typeof module !== 'undefined' && module.exports) module.exports = KirbyMultiplayer;
