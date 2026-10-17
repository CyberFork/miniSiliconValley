/* ============================================================
   main.js —— 启动与页面按钮对应的入口函数
   ============================================================ */
Object.assign(Game, {
  cd: {},
  paused: false,
  pauseForUI: false,
  atSafe: true,
  running: false,

  enterGame() {
    Sfx.init(); Sfx.resume();
    if (!this.S.started) { UI.playIntro(); }
    else { UI.go('prep'); UI.toast('欢迎回来 · 第 ' + this.S.day + ' 天'); }
  },

  /* 离开安全屋，进入街区 */
  startExplore() {
    Sfx.init(); Sfx.resume();
    const c = this.cur();
    if (this.S.equipped.jy.length < 3 || this.S.equipped.zy.length < 3) {
      UI.toast('有人还没带满 3 个技能，先去「人物与技能」补齐');
      UI.go('char'); return;
    }
    this.S.started = true;
    this.S.time = this.time;
    this.writeSave();                   // 出门时记录一次（真正保险的存档点仍是安全屋）
    this.setupChars();
    this.syncCharSprites();
    if (!this.mobs.length) this.spawnWave(true);
    UI.go('battle');
    setTimeout(() => World.onResize(), 40);
    this.running = true; this.dead = false;
    this.clock = performance.now();
    this.loop();
    UI.toast('第 ' + this.S.day + ' 天 · 出发！天黑前记得回安全屋');
  },

  /* 回到安全屋 */
  backToPrep() {
    if (!World.inSafehouse(this.cur().x, this.cur().z)) { UI.toast('请先走回地图中央安全屋，再进入安全区准备和合成'); return; }
    this.pauseForUI = false;
    this.running = false;
    UI.go('prep');
    UI.toast('你回到了安全屋。记得在这里存档');
  },

  closePage() {
    if (this.uiReturnScreen === 'battle' && !this.dead) {
      UI.go('battle');
      setTimeout(() => World.onResize(), 40);
      if (this.pauseForUI) {
        this.pauseForUI = false;
        this.running = true;
        this.clock = performance.now();
        this.loop();
      }
    } else UI.go('prep');
  },

  openBag() {
    this.uiReturnScreen = document.getElementById('battle').classList.contains('active') ? 'battle' : 'prep';
    if (this.running) { this.pauseForUI = true; this.running = false; }
    UI.tab = 'bag'; UI.sel = null;
    UI.go('bag');
  },
  openChar() {
    this.uiReturnScreen = document.getElementById('battle').classList.contains('active') ? 'battle' : 'prep';
    if (this.running) { this.pauseForUI = true; this.running = false; }
    UI.go('char');
  },

  /* 安全屋睡觉：直接到下一天早晨 */
  restAtSafehouse() {
    const c = this.cur();
    if (this.S.started && !World.inSafehouse(c.x, c.z)) { UI.toast('只有在安全屋里才能睡觉'); return; }
    this.S.day++;
    this.S.stats.bestDay = Math.max(this.S.stats.bestDay, this.S.day);
    this.time = (CONFIG.START_HOUR / 24) * CONFIG.DAY_SECONDS;
    ['jy', 'zy'].forEach((id) => {
      const ch = this.S.chars[id];
      if (ch.hp > 0) ch.hp = Math.min(ch.maxHp, ch.hp + 32);
      ch.hunger = Math.max(0, ch.hunger - 22);
    });
    this.clearMobs();
    World.spawnLoot(16);
    this.spawnWave(true);
    this.syncCharSprites();
    const plan = dayPlan(this.S.day, false);
    this.writeSave();
    UI.renderPrep(); UI.renderChar();
    UI.toast('☀️ 睡醒了：第 ' + this.S.day + ' 天 · 今天街上约 ' + plan.total + ' 只丧尸');
  },

  /* 普通攻击（近身钝击，不需要冷却太长） */
  basicAttack() {
    if (!this.running || this.paused) return;
    if ((this.cd.__atk || 0) > 0) return;
    this.cd.__atk = 0.55;
    const me = this.cur();
    const myPos = new THREE.Vector3(me.x, 0, me.z);
    const fwd = this.forward();
    const hit = this.mobsInCone(myPos, fwd, 2.5, 100);
    const dmg = 16 + this.atkBonus();
    hit.forEach((m) => { this.hurtZombie(m, dmg); UI.floatText(m.spr.position, '-' + dmg, false, 0.4); });
    Sfx.burst(0.12, 900, 0.14);
    if (hit.length) UI.toast('近身攻击命中 ' + hit.length + ' 只丧尸');
  },
});

/* ---------------- 启动 ---------------- */
window.MSV_SHOWCASE_READY.then(() => {
  Game.load();
  World.init(document.getElementById('gl'));
  World.setNight(0);
  World.renderer.render(World.scene, World.camera);
  UI.bindControls();
  UI.showLoginInfo();
  loadSpriteSheets(() => {
    UI.showLoginInfo();
    UI.renderPrep();
  });
});
