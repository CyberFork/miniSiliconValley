/**
 * 星之卡比 CP版 · Web Audio 音频合成器
 * 100% 纯原生 Web Audio API，无需外部音频资源，零延迟响应
 */
const KirbyAudio = (() => {
  let ctx = null;
  let muted = false;

  function init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  function playTone(freqStart, freqEnd, type, duration, gainStart = 0.25, gainEnd = 0.001) {
    if (muted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd && freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), now + duration);
      }

      gain.gain.setValueAtTime(gainStart, now);
      gain.gain.exponentialRampToValueAtTime(gainEnd, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio context might not be allowed yet
    }
  }

  return {
    init,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },

    // 经典跳跃声
    jump() {
      init();
      playTone(280, 560, 'sine', 0.16, 0.22);
    },

    // 膨胀滑翔 / 浮空
    puff() {
      init();
      playTone(420, 680, 'triangle', 0.14, 0.18);
    },

    // 普通攻击挥舞
    attack() {
      init();
      playTone(320, 140, 'triangle', 0.12, 0.25);
    },

    // 爱心投掷
    heart() {
      init();
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      [659, 880, 1046].forEach((f, i) => {
        setTimeout(() => playTone(f, f * 1.05, 'sine', 0.15, 0.18), i * 50);
      });
    },

    // 吸入 / 吞下
    swallow() {
      init();
      playTone(260, 160, 'sine', 0.2, 0.3);
      setTimeout(() => playTone(392, 523, 'triangle', 0.18, 0.25), 120);
    },

    // 舍弃能力 (Star Pop)
    discard() {
      init();
      playTone(784, 392, 'square', 0.18, 0.18);
      setTimeout(() => playTone(330, 220, 'sine', 0.14, 0.15), 60);
    },

    // 收集头部星星
    star() {
      init();
      if (!ctx || muted) return;
      const notes = [987, 1318];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, f, 'sine', 0.18, 0.25), i * 70);
      });
    },

    // 受到伤害
    hit() {
      init();
      playTone(180, 60, 'sawtooth', 0.18, 0.35);
    },

    // 火焰能力攻击
    fire() {
      init();
      playTone(160, 480, 'sawtooth', 0.22, 0.3);
      setTimeout(() => playTone(320, 120, 'triangle', 0.2, 0.2), 60);
    },

    // 冰霜能力攻击
    ice() {
      init();
      [1046, 1318, 1567].forEach((f, i) => {
        setTimeout(() => playTone(f, f * 0.95, 'sine', 0.15, 0.18), i * 40);
      });
    },

    // 电气能力攻击
    spark() {
      init();
      playTone(880, 220, 'sawtooth', 0.22, 0.3);
      setTimeout(() => playTone(1200, 440, 'square', 0.16, 0.2), 50);
    },

    // 水流能力攻击
    water() {
      init();
      playTone(300, 600, 'sine', 0.18, 0.28);
      setTimeout(() => playTone(540, 280, 'triangle', 0.16, 0.22), 80);
    },

    // 暗影能力攻击
    shadow() {
      init();
      playTone(180, 70, 'sawtooth', 0.3, 0.35);
      setTimeout(() => playTone(90, 45, 'triangle', 0.35, 0.4), 80);
    },

    // 角色专属技能释放
    skill() {
      init();
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => playTone(f, f * 1.02, 'triangle', 0.2, 0.25), i * 50);
      });
    },

    // 召唤成功音效 (Dual Summon)
    summon() {
      init();
      [440, 554, 659, 880].forEach((f, i) => {
        setTimeout(() => playTone(f, f, 'sine', 0.25, 0.3), i * 60);
      });
    },

    // 主玩家倒地 10秒紧急救援警报
    siren() {
      init();
      playTone(700, 950, 'sawtooth', 0.18, 0.3);
      setTimeout(() => playTone(950, 700, 'sawtooth', 0.18, 0.3), 180);
    },

    // Boss 怒吼
    bossRoar() {
      init();
      playTone(110, 45, 'sawtooth', 0.55, 0.45);
      setTimeout(() => playTone(80, 35, 'square', 0.45, 0.35), 150);
    },

    // 胜利号角
    victory() {
      init();
      if (!ctx || muted) return;
      const tune = [
        { f: 523, d: 0.15 }, { f: 523, d: 0.15 }, { f: 523, d: 0.15 },
        { f: 523, d: 0.35 }, { f: 415, d: 0.35 }, { f: 466, d: 0.35 },
        { f: 523, d: 0.2 }, { f: 0, d: 0.05 }, { f: 466, d: 0.15 },
        { f: 523, d: 0.6 }
      ];
      let t = 0;
      tune.forEach(note => {
        if (note.f > 0) {
          setTimeout(() => playTone(note.f, note.f, 'triangle', note.d, 0.3), t * 1000);
        }
        t += note.d + 0.03;
      });
    },

    // 战败音效
    defeat() {
      init();
      if (!ctx || muted) return;
      const notes = [440, 415, 392, 349];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, f * 0.95, 'sawtooth', 0.3, 0.28), i * 180);
      });
    },

    // 塞满嘴变形吸入膨胀
    mouthfulInhale() {
      init();
      playTone(180, 420, 'sine', 0.28, 0.35);
      setTimeout(() => playTone(360, 680, 'triangle', 0.22, 0.3), 120);
      setTimeout(() => playTone(880, 1046, 'sine', 0.18, 0.25), 260);
    },

    // 汽车塞满嘴涡轮喷射
    carTurbo() {
      init();
      playTone(150, 480, 'sawtooth', 0.32, 0.4);
      setTimeout(() => playTone(300, 750, 'square', 0.25, 0.25), 80);
    },

    // 三角锥千斤顶下砸
    coneSlam() {
      init();
      playTone(600, 100, 'sawtooth', 0.25, 0.45);
      setTimeout(() => playTone(90, 40, 'triangle', 0.4, 0.5), 140);
    },

    // 完美闪避 (魔女时间慢动作特写)
    perfectDodge() {
      init();
      if (!ctx || muted) return;
      playTone(1200, 1800, 'sine', 0.3, 0.35);
      setTimeout(() => playTone(880, 1320, 'triangle', 0.25, 0.3), 100);
      setTimeout(() => playTone(1760, 2200, 'sine', 0.35, 0.3), 200);
    },

    // 利剑出鞘斩击
    swordSlash() {
      init();
      playTone(720, 240, 'triangle', 0.12, 0.3);
      setTimeout(() => playTone(1200, 400, 'sine', 0.08, 0.22), 30);
    },

    // 超级剑毁灭斩击 (Ultra Sword)
    superSword() {
      init();
      playTone(120, 680, 'sawtooth', 0.45, 0.5);
      setTimeout(() => playTone(440, 1760, 'square', 0.35, 0.4), 150);
      setTimeout(() => playTone(90, 30, 'triangle', 0.6, 0.6), 350);
    },

    // 拯救瓦豆鲁迪欢呼
    waddleDeeCheer() {
      init();
      if (!ctx || muted) return;
      const notes = [587, 740, 880, 1174];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, f * 1.05, 'triangle', 0.18, 0.28), i * 90);
      });
    },

    // 自动贩卖机易拉罐高速连发
    vendingShoot() {
      init();
      playTone(520, 220, 'square', 0.08, 0.25);
      setTimeout(() => playTone(780, 330, 'triangle', 0.06, 0.2), 20);
    },

    // 圈圈强风飓风冲击波
    windBlast() {
      init();
      playTone(220, 880, 'sine', 0.35, 0.35);
      setTimeout(() => playTone(440, 180, 'triangle', 0.25, 0.25), 80);
    },

    // 超级能力：怪兽烈焰 (Monster Flame) 巨龙长啸
    monsterFlame() {
      init();
      playTone(90, 480, 'sawtooth', 0.5, 0.45);
      setTimeout(() => playTone(320, 120, 'sawtooth', 0.6, 0.4), 160);
      setTimeout(() => playTone(60, 30, 'triangle', 0.7, 0.5), 320);
    },

    // 帝帝帝大王重锤 / 全垒打巨槌 (Grand Hammer)
    hammerSlam() {
      init();
      playTone(350, 60, 'sawtooth', 0.35, 0.5);
      setTimeout(() => playTone(120, 35, 'triangle', 0.5, 0.6), 80);
    },

    // 刹那间居合斩破空斩击
    quickDrawSlash() {
      init();
      if (!ctx || muted) return;
      playTone(1800, 400, 'triangle', 0.18, 0.45);
      setTimeout(() => playTone(2400, 1200, 'sine', 0.22, 0.35), 40);
    },

    // 风语大树空气炮与落苹果
    whispyPuff() {
      init();
      playTone(280, 110, 'sine', 0.2, 0.35);
      setTimeout(() => playTone(160, 80, 'triangle', 0.18, 0.25), 60);
    },

    // 享用 M番茄 / 咖啡店补给食物
    itemEat() {
      init();
      if (!ctx || muted) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => {
        setTimeout(() => playTone(f, f * 1.02, 'sine', 0.16, 0.28), i * 65);
      });
    }
  };
})();

if (typeof window !== 'undefined') window.KirbyAudio = KirbyAudio;
if (typeof module !== 'undefined' && module.exports) module.exports = KirbyAudio;
