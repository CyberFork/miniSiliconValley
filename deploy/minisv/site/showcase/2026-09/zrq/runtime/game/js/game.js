/* ============================================================
   game.js —— 游戏核心：第一人称操作、双角色、战斗技能、丧尸 AI、
   饥饿与昼夜、安全屋存档、死亡回档
   ============================================================ */
const Game = {
  S: null,                 // 存档数据
  running: false,
  zombies: [], effects: [], mobs: [],       // mobs: 世界里可攻击的生物（丧尸）
  clock: 0,                // 上一帧时间
  time: 0,                 // 一天内的秒数
  nightF: 0,
  yaw: 0, pitch: 0,
  joy: { x: 0, y: 0 },
  keys: {},
  invul: 0, slowmo: 0, switchCd: 0, toastCd: 0,
  sprint: false,
  danger: 0, heartT: 0, growlT: 4,
  charSprites: {},         // 场上待机角色的广告牌
  stats: null,
  dead: false,
  paused: false,
  cameraShake: 0,

  /* ---------------- 存档 ---------------- */
  newSave() {
    const S = {
      day: 1, time: (CONFIG.START_HOUR / 24) * CONFIG.DAY_SECONDS,
      active: 'jy',
      chars: {
        jy: { hp: CHARS.jy.hp, maxHp: CHARS.jy.hp, hunger: 100, x: 2.5, z: 3.5, yaw: 0 },
        zy: { hp: CHARS.zy.hp, maxHp: CHARS.zy.hp, hunger: 100, x: -2.5, z: 3.5, yaw: 0 },
      },
      equipped: { jy: CHARS.jy.equip.slice(), zy: CHARS.zy.equip.slice() },
      bag: { bandage: 3, food_can: 2, water: 2, cloth: 2, metal: 1 },
      passives: {},
      stats: { kills: 0, bites: 0, loot: 0, crafts: 0, bestDay: 1 },
      started: false,
    };
    return S;
  },
  load() {
    try {
      const raw = window.MSV_SHOWCASE_STORAGE.getItem(CONFIG.SAVE_KEY);
      this.S = raw ? JSON.parse(raw) : this.newSave();
      if (!this.S || !this.S.chars) this.S = this.newSave();
    } catch (e) { this.S = this.newSave(); }
    return this.S;
  },
  writeSave() { try { window.MSV_SHOWCASE_STORAGE.setItem(CONFIG.SAVE_KEY, JSON.stringify(this.S)); return true; } catch (e) { return false; } },
  async wipeSave(keepPlaying) {
    if (!await window.MSV_CONFIRM('清空存档，从第 1 天重新开始？')) return;
    window.MSV_SHOWCASE_STORAGE.removeItem(CONFIG.SAVE_KEY);
    this.S = this.newSave();
    this.writeSave();
    UI.toast('存档已清空，新的求生开始');
    if (keepPlaying) { this.S.started = true; this.applySave(true); UI.go('prep'); UI.renderPrep(); }
    else UI.showLoginInfo();
  },
  showSaveInfo() {
    const S = this.S;
    return '第 ' + S.day + ' 天 · 击杀 ' + (S.stats.kills || 0) + ' 只 · 背包 ' + Object.keys(S.bag).length + '/' + CONFIG.BAG_CAPACITY + ' 格';
  },
  saveAtSafehouse(fromPrep) {
    const c = this.cur();
    const atSafe = fromPrep || World.inSafehouse(c.x, c.z);
    if (!atSafe) { UI.toast('只有回到安全屋才能存档！'); return; }
    this.S.time = this.time;
    this.S.started = true;
    this.S.stats.bestDay = Math.max(this.S.stats.bestDay || 1, this.S.day);
    const ok = this.writeSave();
    UI.toast(ok ? '✔ 已在安全屋存档 · 第 ' + this.S.day + ' 天' : '存档失败：浏览器存储不可用');
    Sfx.craft();
  },
  applySave(keepPos) {
    const S = this.S;
    this.time = S.time || (CONFIG.START_HOUR / 24) * CONFIG.DAY_SECONDS;
    this.nightF = World ? World.nightFactor : 0;
    if (this.mobs.length || !keepPos) this.clearMobs();
    if (!keepPos) { this.setupChars(); this.spawnWave(true); }
    else { this.setupChars(); this.syncCharSprites(); this.spawnWave(true); }
  },

  /* ---------------- 角色 ---------------- */
  cur() { return this.S.chars[this.S.active]; },
  otherId() { return this.S.active === 'jy' ? 'zy' : 'jy'; },
  curId() { return this.S.active; },
  maxHpFor(id) { return (CHARS[id].hp + (this.S.passives.armor ? (ITEMS.armor.bonus.maxHp || 0) : 0)); },
  atkBonus() { return (this.S.passives.knife ? (ITEMS.knife.bonus.atk || 0) : 0); },
  setupChars() {
    ['jy', 'zy'].forEach((id) => {
      const c = this.S.chars[id];
      c.maxHp = this.maxHpFor(id);
      if (c.hp > c.maxHp) c.hp = c.maxHp;
      if (!c.equipped) c.equipped = this.S.equipped[id];
      if (c.hp <= 0) c.hp = 1;         // 回档时不至于立刻死
    });
    const c = this.cur();
    this.yaw = c.yaw || 0; this.pitch = 0;
    World.camera.position.set(c.x, CONFIG.EYE_HEIGHT, c.z);
  },
  charSprite(id) { return this.charSprites[id]; },
  makeCharSprite(id) {
    const key = CHARS[id].sheet;
    if (!SHEETS[key]) return null;
    const mat = new THREE.SpriteMaterial({ map: SHEETROWS(key)[0].clone(), transparent: true, depthTest: true });
    const sp = new THREE.Sprite(mat);
    const h = id === 'jy' ? 1.95 : 1.85;
    sp.scale.set(h * 0.72, h, 1);
    sp.userData.anim = makeSpriteAnim(key, sp);
    sp.userData.anim.tex = mat.map;
    World.scene.add(sp);
    return sp;
  },
  syncCharSprites() {
    ['jy', 'zy'].forEach((id) => {
      const c = this.S.chars[id];
      const sp = this.charSprites[id] || (this.charSprites[id] = this.makeCharSprite(id));
      if (!sp) return;
      sp.position.set(c.x, 0.98, c.z);
      sp.visible = (id !== this.S.active) && c.hp > 0;
    });
    const me = this.cur();
    World.camera.position.set(me.x, CONFIG.EYE_HEIGHT, me.z);
  },
  switchChar(force) {
    if (this.switchCd > 0 && !force) { UI.toast('切换冷却中 ' + this.switchCd.toFixed(1) + ' 秒'); return; }
    const oid = this.otherId(), oc = this.S.chars[oid];
    if (oc.hp <= 0) { UI.toast(CHARS[oid].name + ' 已经倒下了，救不了自己也不能切过去'); return; }
    this.cur().yaw = this.yaw;
    this.S.active = oid;
    this.switchCd = CONFIG.SWITCH_CD;
    this.slowmo = CONFIG.SWITCH_SLOWMO;
    this.invul = Math.max(this.invul, CONFIG.SWITCH_SLOWMO);
    this.yaw = oc.yaw || 0; this.pitch = 0;
    World.camera.position.set(oc.x, CONFIG.EYE_HEIGHT, oc.z);
    this.syncCharSprites();
    Sfx.zipper(); Sfx.blip(660, 0.25, 'triangle', 0.14, 300);
    UI.toast('切换为 ' + CHARS[oid].name + '（' + CHARS[oid].role + '）· 时间变慢');
    UI.updateHUD();
  },

  /* ---------------- 丧尸 ---------------- */
  clearMobs() {
    this.mobs.forEach((m) => { if (m.spr) World.scene.remove(m.spr); });
    this.mobs = [];
  },
  spawnWave(initial) {
    const { pool, total } = dayPlan(this.S.day, this.nightF > 0.5);
    while (this.mobs.length < total) {
      const type = ZOMBIES[pool[Math.floor(Math.random() * pool.length)]];
      const z = this.makeZombie(type, initial);
      if (z) this.mobs.push(z);
    }
  },
  makeZombie(type, silent) {
    const c = this.cur();
    let x, z, tries = 0;
    do {
      const a = Math.random() * Math.PI * 2;
      const d = CONFIG.SPAWN_DIST * (0.8 + Math.random() * 0.6);
      x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
      tries++;
    } while (tries < 30 && (Math.abs(x) > 70 || Math.abs(z) > 70 ||
      World.blocked(x, z, 0.8) || Math.hypot(x, z) < CONFIG.SAFE_RADIUS + 4));
    if (tries >= 30) return null;
    const spr = this.makeZombieSprite(type);
    if (!spr) return null;
    const scale = type.scale * (1 + Math.min(0.4, (this.S.day - 1) * 0.03));
    const m = {
      id: 'z' + Math.random().toString(36).slice(2, 8),
      type, hp: type.hp * (1 + (this.S.day - 1) * 0.06), maxHp: type.hp * (1 + (this.S.day - 1) * 0.06),
      pos: new THREE.Vector3(x, 0, z), spr, scale,
      state: 'idle', vx: 0, vz: 0, atkT: 0, freeze: 0, burn: 0, burnDps: 0,
      wander: { x: 0, z: 0, t: 0 }, notice: 0, growl: Math.random() * 6,
      dead: false, deadT: 0, hitT: 0,
    };
    spr.position.set(x, (type === ZOMBIES.brute ? 1.5 : 0.9), z);
    spr.scale.set(scale * 0.78, scale, 1);
    return m;
  },
  makeZombieSprite(type) {
    const key = type.sheet;
    if (!SHEETS[key]) return null;
    const mat = new THREE.SpriteMaterial({ map: SHEETROWS(key)[0].clone(), transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.userData.anim = makeSpriteAnim(key, sp);
    sp.userData.anim.tex = mat.map;
    World.scene.add(sp);
    return sp;
  },
  updateZombie(m, dt) {
    const anim = m.spr.userData.anim;
    if (m.dead) {
      m.deadT += dt;
      const s = Math.max(0, 1 - m.deadT / 1.2);
      m.spr.material.opacity = s;
      m.spr.position.y = (m.type === ZOMBIES.brute ? 1.5 : 0.9) * (1 - m.deadT * 0.4);
      if (m.deadT > 1.3) { World.scene.remove(m.spr); m.type = null; }
      return;
    }
    const dist = (id) => Math.hypot(m.pos.x - this.S.chars[id].x, m.pos.z - this.S.chars[id].z);
    const dj = dist('jy'), dz = dist('zy');
    let targetId = this.S.active;
    const oid = this.otherId();
    if (this.S.chars[oid].hp > 0 && dist(oid) < dist(this.S.active) * 0.75) targetId = oid;
    const t = this.S.chars[targetId];
    const d = Math.hypot(m.pos.x - t.x, m.pos.z - t.z);
    if (m.hitT > 0) m.hitT -= dt;
    if (m.freeze > 0) {
      m.freeze -= dt;
      m.spr.material.color.setHex(0x9fd8ff);
      anim.update(dt, false, 0.15);
      return;
    }
    m.spr.material.color.setHex(m.hitT > 0 ? 0xffb0a0 : (m.tint || 0xffffff));

    // 火焰灼烧
    if (m.burn > 0) {
      m.burn -= dt;
      this.hurtZombie(m, m.burnDps * dt, true);
      if (m.burn <= 0) m.burn = 0;
      if (m.dead) return;
    }

    const safe = World.inSafehouse(t.x, t.z);
    const noticeR = m.type.notice * (this.nightF > 0.5 ? 1.25 : 1);
    const canSee = d < noticeR && !World.lineBlocked(m.pos, new THREE.Vector3(t.x, 0, t.z));

    if (canSee) m.state = d <= m.type.attackRange ? 'attack' : 'chase';
    else if (m.state === 'chase' || m.state === 'attack') m.state = 'wander';

    if (m.state === 'idle') {
      anim.setAct('idle'); anim.update(dt, false);
      m.growl -= dt;
      if (m.growl <= 0) { m.growl = 6 + Math.random() * 10; if (d < 26) { Sfx.growl(); } }
      return;
    }
    if (m.state === 'wander') {
      m.wander.t -= dt;
      if (m.wander.t <= 0) {
        m.wander.t = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        m.wander.x = Math.cos(a) * 1.4; m.wander.z = Math.sin(a) * 1.4;
      }
      this.moveZombie(m, m.wander.x * 0.35, m.wander.z * 0.35, dt);
      anim.setAct('walk'); anim.update(dt, true, 0.6);
      m.growl -= dt;
      if (m.growl <= 0) { m.growl = 8 + Math.random() * 12; if (d < 30) Sfx.growl(); }
      return;
    }
    if (m.state === 'attack') {
      m.atkT -= dt;
      anim.setAct('atk'); anim.update(dt, false, 1.4);
      const throughWall = safe && !World.inSafehouse(m.pos.x, m.pos.z);
      if (throughWall) return;              // 安全屋墙内绝对安全
      if (m.atkT <= 0) {
        m.atkT = m.type.attackCd;
        const dmg = m.type.damage * (this.nightF > 0.5 ? 1.15 : 1);
        this.hurtChar(targetId, dmg, m.type.name);
        Sfx.burst(0.18, 260, 0.2);
      }
      return;
    }
    // chase
    const speed = m.type.speed * (this.nightF > 0.5 ? CONFIG.NIGHT_SPEED : 1);
    let dx = t.x - m.pos.x, dz2 = t.z - m.pos.z;
    const len = Math.hypot(dx, dz2) || 1;
    dx /= len; dz2 /= len;
    if (safe && Math.hypot(m.pos.x, m.pos.z) < CONFIG.SAFE_RADIUS + 1.6) {
      // 安全屋门口停下，来回徘徊（丧尸不会进屋）
      this.moveZombie(m, m.wander.x * 0.2, m.wander.z * 0.2, dt);
      m.wander.t -= dt;
      if (m.wander.t <= 0) { m.wander.t = 1.5 + Math.random() * 2; const a = Math.random() * 6.28; m.wander.x = Math.cos(a); m.wander.z = Math.sin(a); }
      anim.setAct('walk'); anim.update(dt, true, 0.7);
      return;
    }
    this.moveZombie(m, dx * speed, dz2 * speed, dt);
    anim.setAct('walk'); anim.update(dt, true, 1.25);
  },
  moveZombie(m, vx, vz, dt) {
    // 与其他丧尸稍微分开，避免叠在一起
    let sx = 0, sz = 0;
    for (let i = 0; i < this.mobs.length; i++) {
      const o = this.mobs[i];
      if (o === m || o.dead) continue;
      const dx = m.pos.x - o.pos.x, dz = m.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.6 && d2 > 0.0001) { const d = Math.sqrt(d2); sx += dx / d; sz += dz / d; }
    }
    const p = { x: m.pos.x + (vx + sx * 1.2) * dt, z: m.pos.z + (vz + sz * 1.2) * dt };
    World.resolve(p, m.type === ZOMBIES.brute ? 0.8 : 0.5);
    m.pos.x = p.x; m.pos.z = p.z;
    m.spr.position.x = p.x; m.spr.position.z = p.z;
  },
  hurtZombie(m, dmg, silent) {
    if (m.dead) return;
    m.hp -= dmg;
    if (!silent) { m.hitT = 0.22; }
    if (m.hp <= 0) this.killZombie(m);
  },
  killZombie(m) {
    if (m.dead) return;
    m.dead = true; m.deadT = 0;
    m.spr.userData.anim.setAct('die');
    this.S.stats.kills++;
    Sfx.blip(140, 0.5, 'sawtooth', 0.16, 50);
    if (Math.random() < CONFIG.DROP_CHANCE) {
      const kinds = ['cloth', 'metal', 'wood', 'alcohol', 'bandage', 'food_bar', 'water'];
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      World.addLoot(k, m.pos.x + (Math.random() - 0.5), m.pos.z + (Math.random() - 0.5));
    }
  },

  /* ---------------- 受伤 / 死亡 ---------------- */
  hurtChar(id, dmg, fromName) {
    const c = this.S.chars[id];
    if (c.hp <= 0) return;
    if (id === this.S.active && this.invul > 0) return;
    c.hp = Math.max(0, c.hp - dmg);
    this.S.stats.bites++;
    if (id === this.S.active) {
      UI.flashHurt(Math.min(1, dmg / 26));
      UI.floatText(this.camPos(), '-' + Math.round(dmg), false, 0.6 + Math.random() * 0.2);
      Sfx.hurt();
      this.cameraShake = Math.min(0.5, this.cameraShake + 0.2);
    } else {
      UI.floatText(new THREE.Vector3(c.x, 1.8, c.z), CHARS[id].name + ' -' + Math.round(dmg), false, 0);
      UI.toast('⚠ ' + CHARS[id].name + '正在被' + fromName + '攻击！');
    }
    if (c.hp <= 0) {
      c.hp = 0;
      UI.toast(CHARS[id].name + ' 倒下了！');
      if (this.S.chars.jy.hp <= 0 && this.S.chars.zy.hp <= 0) this.die('被丧尸咬死');
      else if (id === this.S.active) this.switchChar(true);
    }
    UI.updateHUD();
  },
  die(reason) {
    if (this.dead) return;
    this.dead = true; this.running = false;
    UI.showDead(reason + '｜活到第 ' + this.S.day + ' 天，击杀 ' + this.S.stats.kills + ' 只丧尸');
  },
  reviveFromSave() {
    this.dead = false;
    const raw = window.MSV_SHOWCASE_STORAGE.getItem(CONFIG.SAVE_KEY);
    if (raw) { try { this.S = JSON.parse(raw); } catch (e) { } }
    else { this.S = this.newSave(); }
    this.time = this.S.time;
    this.clearMobs(); this.setupChars(); this.syncCharSprites(); this.spawnWave(true);
    this.running = true;
    UI.go('battle'); UI.updateHUD(); UI.toast('回到上次存档：第 ' + this.S.day + ' 天');
  },

  /* ---------------- 技能 ---------------- */
  skillList(id) { return (this.S.equipped[id] || []).slice(0, 3); },
  skillReady(i) {
    const list = this.skillList(this.S.active);
    const sid = list[i]; if (!sid) return false;
    const sk = SKILLS[sid];
    return (this.cd[sid] || 0) <= 0;
  },
  useSkillByIndex(i) {
    if (!this.running || this.paused) return;
    const list = this.skillList(this.S.active);
    const sid = list[i]; if (!sid) return;
    this.castSkill(sid);
  },
  castSkill(sid) {
    const sk = SKILLS[sid]; if (!sk) return;
    if ((this.cd[sid] || 0) > 0) { UI.toast(sk.name + ' 冷却中 ' + (this.cd[sid]).toFixed(1) + ' 秒'); return; }
    if (sid === 'throw') {
      if (!this.S.bag.molotov || this.S.bag.molotov <= 0) { UI.toast('没有燃烧瓶了，先在合成台做几个'); return; }
      this.S.bag.molotov--;
    }
    const me = this.S.chars[this.S.active];
    const fwd = this.forward();
    const myPos = new THREE.Vector3(me.x, 0, me.z);
    if (sk.type === 'cone') {
      const hit = this.mobsInCone(myPos, fwd, sk.range, sk.angle);
      hit.forEach((m) => { this.hurtZombie(m, sk.damage + this.atkBonus()); UI.floatText(m.spr.position, '-' + (sk.damage + this.atkBonus()), false, 0.4); });
      this.addFlameEffect(myPos, fwd, sk.range);
      Sfx.skill('flame');
      UI.toast(hit.length ? '火焰斩命中 ' + hit.length + ' 只丧尸！' : '火焰斩劈空了');
    } else if (sk.type === 'dash') {
      const p = { x: myPos.x + fwd.x * sk.distance, z: myPos.z + fwd.z * sk.distance };
      World.resolve(p, 0.5);
      // 冲锋撞击沿途丧尸
      if (sk.damage > 0) {
        this.mobs.forEach((m) => {
          if (m.dead) return;
          const t = this.segDist(myPos, new THREE.Vector3(p.x, 0, p.z), m.pos);
          if (t < 1.9) {
            this.hurtZombie(m, sk.damage + this.atkBonus());
            const kx = m.pos.x - myPos.x, kz = m.pos.z - myPos.z, kl = Math.hypot(kx, kz) || 1;
            m.pos.x += (kx / kl) * 1.6; m.pos.z += (kz / kl) * 1.6;
            this.moveZombie(m, 0, 0, 0.001);
            UI.floatText(m.spr.position, '-' + (sk.damage + this.atkBonus()), false, 0.4);
          }
        });
      }
      me.x = p.x; me.z = p.z;
      World.camera.position.set(me.x, CONFIG.EYE_HEIGHT, me.z);
      if (sk.invul) this.invul = Math.max(this.invul, sk.invul);
      this.addDashEffect(myPos, new THREE.Vector3(me.x, 0, me.z), sk.color);
      Sfx.skill(sk.type);
      UI.toast(sk.name + '！冲出去了');
    } else if (sk.type === 'heal') {
      const h = Math.min(sk.heal, this.cur().maxHp - this.cur().hp);
      this.cur().hp += h;
      UI.floatText(this.camPos(), '+' + Math.round(h), true, 0.5);
      this.addRingEffect(new THREE.Vector3(me.x, 0.1, me.z), 2.4, sk.color);
      Sfx.skill('heal');
      UI.toast(sk.name + '：回复 ' + Math.round(h) + ' 点生命');
      UI.updateHUD();
    } else if (sk.type === 'nova') {
      let n = 0;
      this.mobs.forEach((m) => {
        if (m.dead) return;
        if (m.pos.distanceTo(myPos) <= sk.radius) {
          this.hurtZombie(m, sk.damage + this.atkBonus()); m.freeze = sk.freeze; n++;
          UI.floatText(m.spr.position, '-' + (sk.damage + this.atkBonus()), false, 0.4);
        }
      });
      this.addRingEffect(new THREE.Vector3(me.x, 0.12, me.z), sk.radius, sk.color);
      Sfx.skill('frost');
      UI.toast(n ? '冰冻陷阱冻住 ' + n + ' 只丧尸！' : '冰冻陷阱炸开，附近没有丧尸');
    } else if (sk.type === 'fire') {
      const p = { x: myPos.x + fwd.x * Math.min(sk.range, 9), z: myPos.z + fwd.z * Math.min(sk.range, 9) };
      World.resolve(p, 0.4);
      this.spawnFire(p.x, p.z, sk.radius, sk.dps, sk.duration);
      Sfx.skill('fire');
      UI.toast('燃烧瓶砸出去了，火会烧 ' + sk.duration + ' 秒');
    }
    this.cd[sid] = sk.cd;
    UI.updateHUD();
  },
  forward() {
    // 与 three.js 相机朝向一致：相机默认看 -Z，绕 Y 旋转 yaw 之后
    // 前方向量 = (-sin yaw, 0, -cos yaw)，右方向量 = (cos yaw, 0, -sin yaw)
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  },
  camPos() {
    const c = World.camera.position;
    return new THREE.Vector3(c.x, c.y - 0.2, c.z);
  },
  mobsInCone(origin, fwd, range, angleDeg) {
    const cosA = Math.cos((angleDeg / 2) * Math.PI / 180);
    const out = [];
    this.mobs.forEach((m) => {
      if (m.dead) return;
      const d = m.pos.distanceTo(origin);
      if (d > range + 0.7) return;
      const dir = new THREE.Vector3(m.pos.x - origin.x, 0, m.pos.z - origin.z).normalize();
      if (dir.dot(fwd) >= cosA) out.push(m);
    });
    return out;
  },
  segDist(a, b, p) {
    const abx = b.x - a.x, abz = b.z - a.z;
    const apx = p.x - a.x, apz = p.z - a.z;
    const l2 = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / l2));
    const cx = a.x + abx * t, cz = a.z + abz * t;
    return Math.hypot(p.x - cx, p.z - cz);
  },

  /* ---------------- 特效 ---------------- */
  addFlameEffect(pos, fwd, range) {
    const geo = new THREE.ConeGeometry(range * 0.42, range, 10, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a2b, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = Math.PI / 2;
    m.position.set(pos.x + fwd.x * range * 0.4, 1.1, pos.z + fwd.z * range * 0.4);
    m.rotation.y = -this.yaw + Math.PI / 2;
    World.scene.add(m);
    this.effects.push({ obj: m, life: 0.34, max: 0.34, kind: 'fade', grow: 1.5 });
  },
  addRingEffect(pos, radius, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 28),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    World.scene.add(m);
    this.effects.push({ obj: m, life: 0.6, max: 0.6, kind: 'ring', radius });
  },
  addDashEffect(a, b, color) {
    const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    const len = dir.length() || 0.1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    m.position.set((a.x + b.x) / 2, 0.9, (a.z + b.z) / 2);
    m.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
    World.scene.add(m);
    this.effects.push({ obj: m, life: 0.35, max: 0.35, kind: 'fade' });
  },
  spawnFire(x, z, radius, dps, duration) {
    const m = new THREE.Mesh(new THREE.RingGeometry(radius * 0.3, radius, 22),
      new THREE.MeshBasicMaterial({ color: 0xff8a3b, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z);
    World.scene.add(m);
    const light = new THREE.PointLight(0xff8a3b, 1.2, radius * 2.2, 2);
    light.position.set(x, 1.2, z); World.scene.add(light);
    this.effects.push({
      obj: m, light, life: duration, max: duration, kind: 'fire',
      x, z, radius, dps, tick: 0,
    });
  },
  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      if (e.kind === 'ring') {
        const s = 1 + (1 - k) * (e.radius / 0.7);
        e.obj.scale.set(s, s, 1);
        e.obj.material.opacity = 0.75 * k;
      } else if (e.kind === 'fire') {
        e.obj.material.opacity = 0.5 * k + 0.08;
        e.obj.scale.set(1 + Math.sin(this.time * 6) * 0.04, 1, 1);
        if (e.light) e.light.intensity = 1.2 * k;
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.25;
          this.mobs.forEach((m) => {
            if (m.dead) return;
            if (Math.hypot(m.pos.x - e.x, m.pos.z - e.z) <= e.radius) {
              this.hurtZombie(m, e.dps * 0.25, true);
              m.burn = Math.max(m.burn, 0.6);
              if (m.burnDps < e.dps) m.burnDps = e.dps;
            }
          });
        }
        if (!this.fireHiss) this.fireHiss = 0;
      } else {
        e.obj.material.opacity = 0.8 * k;
        if (e.grow) e.obj.scale.multiplyScalar(1 + dt * e.grow);
      }
      if (e.life <= 0) {
        World.scene.remove(e.obj);
        if (e.light) World.scene.remove(e.light);
        this.effects.splice(i, 1);
      }
    }
  },

  /* ---------------- 物品 / 背包 ---------------- */
  bagFull(newKind) {
    if (this.S.bag[newKind] !== undefined) return false;
    return Object.keys(this.S.bag).length >= CONFIG.BAG_CAPACITY;
  },
  gainItem(kind, n) {
    if (this.bagFull(kind)) { UI.toast('背包已满（' + CONFIG.BAG_CAPACITY + ' 格），先用掉或合成一些东西'); return false; }
    this.S.bag[kind] = (this.S.bag[kind] || 0) + (n || 1);
    this.S.stats.loot++;
    Sfx.pickup();
    UI.toast('获得 ' + ITEMS[kind].name + ' ×' + (n || 1) + '（背包 ' + Object.keys(this.S.bag).length + '/' + CONFIG.BAG_CAPACITY + '）');
    return true;
  },
  useItem(kind) {
    const it = ITEMS[kind]; if (!it || !this.S.bag[kind]) return;
    const c = this.cur();
    if (it.kind === 'heal') {
      if (c.hp >= c.maxHp) { UI.toast('生命是满的，先留着'); return; }
      const h = Math.min(it.heal, c.maxHp - c.hp);
      c.hp += h; UI.floatText(this.camPos(), '+' + Math.round(h), true, 0.5);
      Sfx.skill('heal'); UI.toast('使用 ' + it.name + '，回复 ' + Math.round(h) + ' 点生命');
    } else if (it.kind === 'food') {
      if (c.hunger >= 100) { UI.toast('已经很饱了'); return; }
      c.hunger = Math.min(100, c.hunger + it.food);
      UI.toast('吃掉 ' + it.name + '，饥饿 +' + it.food);
    } else if (it.kind === 'throw') {
      const fwd = this.forward();
      const p = { x: c.x + fwd.x * 8, z: c.z + fwd.z * 8 };
      World.resolve(p, 0.4);
      this.spawnFire(p.x, p.z, it.radius, it.dps, it.duration);
      Sfx.skill('fire'); UI.toast('扔出 ' + it.name + '，点燃前方');
    } else if (it.kind === 'passive') {
      this.S.passives[kind] = 1;
      if (kind === 'armor') { ['jy', 'zy'].forEach((id) => { this.S.chars[id].maxHp = this.maxHpFor(id); }); }
      Sfx.craft();
      UI.toast('已永久装备 ' + it.name);
    } else { UI.toast(it.name + ' 是合成材料，拿去合成台用'); return; }
    this.S.bag[kind]--; if (this.S.bag[kind] <= 0) delete this.S.bag[kind];
    UI.updateHUD();
  },
  craft(recipeId) {
    const r = RECIPES.find((x) => x.id === recipeId); if (!r) return;
    if (!World.inSafehouse(this.cur().x, this.cur().z)) { UI.toast('只有在安全屋的合成台才能合成'); return; }
    for (const k in r.need) if ((this.S.bag[k] || 0) < r.need[k]) { UI.toast('材料不够：还缺 ' + ITEMS[k].name); return; }
    if (this.bagFull(r.out)) { UI.toast('背包已满，先腾一格'); return; }
    for (const k in r.need) { this.S.bag[k] -= r.need[k]; if (this.S.bag[k] <= 0) delete this.S.bag[k]; }
    this.S.bag[r.out] = (this.S.bag[r.out] || 0) + r.n;
    this.S.stats.crafts++;
    Sfx.craft();
    UI.toast('合成成功：' + ITEMS[r.out].name + ' ×' + r.n);
    UI.renderBag();
  },

  /* ---------------- 循环 ---------------- */
  start() {
    if (this.running) return;
    this.running = true; this.dead = false;
    this.clock = performance.now();
    requestAnimationFrame(() => this.loop());
  },
  loop() {
    if (!this.running) return;
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.clock) / 1000);
    this.clock = now;
    try { this.tick(dt); } catch (e) { console.error(e); }
    requestAnimationFrame(() => this.loop());
  },
  tick(dtReal) {
    if (this.paused) { World.renderer.render(World.scene, World.camera); return; }
    if (this.slowmo > 0) this.slowmo -= dtReal;
    const scale = this.slowmo > 0 ? CONFIG.SLOWMO_SCALE : 1;
    const dt = dtReal * scale;
    this.time += dt;
    if (this.time >= CONFIG.DAY_SECONDS) this.nextDay();
    this.updateClock();
    this.updatePlayer(dtReal);
    this.updateEffects(dt);
    // 生物
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      this.updateZombie(m, dt);
      if (m.type === null) this.mobs.splice(i, 1);
    }
    // 刷新与清理
    const c = this.cur();
    this.mobs = this.mobs.filter((m) => m.dead || Math.hypot(m.pos.x - c.x, m.pos.z - c.z) < 95);
    if (Math.random() < dt * 0.4) this.spawnWave(false);
    // 饥饿
    this.updateHunger(dt);
    // 冷却
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.switchCd > 0) this.switchCd = Math.max(0, this.switchCd - dtReal);
    if (this.invul > 0) this.invul -= dtReal;
    // 声音氛围
    this.updateAudio(dtReal);
    // 世界
    this.syncCharSprites();
    World.update(dt, this.time);
    World.renderer.render(World.scene, World.camera);
    UI.updateHUD();
  },
  updateClock() {
    const hour = (this.time / CONFIG.DAY_SECONDS) * 24;
    let f;
    if (hour >= 17 && hour < 20.5) f = (hour - 17) / 3.5;
    else if (hour >= 20.5 || hour < 4.5) f = 1;
    else if (hour >= 4.5 && hour < 6.5) f = 1 - (hour - 4.5) / 2;
    else f = 0;
    const prev = this.nightF;
    this.nightF = f;
    World.setNight(f);
    if (prev < 0.5 && f >= 0.5) { UI.toast('🌙 天黑了，丧尸变多也变快，尽快回安全屋！'); Sfx.growl(); }
    if (prev <= 0.5 && f > 0.15 && !this.duskWarned) {
      this.duskWarned = true;
      UI.toast('🌇 天快黑了，记得在天黑前回安全屋');
    }
    if (f < 0.15) this.duskWarned = false;
  },
  updateHunger(dt) {
    let starving = false;
    ['jy', 'zy'].forEach((id) => {
      const c = this.S.chars[id];
      if (c.hunger > 0) c.hunger = Math.max(0, c.hunger - CONFIG.HUNGER_DECAY * dt);
      else if (c.hp > 0) { c.hp = Math.max(0, c.hp - CONFIG.STARVE_DPS * dt); starving = true; }
    });
    if (starving && !this.starveWarn) { this.starveWarn = true; UI.toast('🍖 有人饿坏了，正在掉血！吃点东西'); }
    if (!starving) this.starveWarn = false;
    if (this.S.chars.jy.hp <= 0 && this.S.chars.zy.hp <= 0) this.die('饿死在废土上');
  },
  updateAudio(dt) {
    // 危险度：最近的丧尸有多近
    const c = this.cur();
    let near = 999;
    this.mobs.forEach((m) => { if (!m.dead) near = Math.min(near, Math.hypot(m.pos.x - c.x, m.pos.z - c.z)); });
    this.danger = Math.max(0, Math.min(1, (14 - near) / 12));
    this.heartT -= dt * (1 + this.danger * 2.2);
    if (this.heartT <= 0 && this.danger > 0.25) { this.heartT = 1.05 - this.danger * 0.35; Sfx.heartbeat(this.danger > 0.7); }
  },
  nextDay() {
    this.time = 0; this.S.day++;
    World.spawnLoot(18);                    // 一天过去，废墟里又翻出一些物资
    this.S.stats.bestDay = Math.max(this.S.stats.bestDay, this.S.day);
    this.clearMobs(); this.spawnWave(true);
    const plan = dayPlan(this.S.day, false);
    UI.toast('☀️ 第 ' + this.S.day + ' 天开始了 · 今天街上会有 ' + plan.total + ' 只丧尸');
    ['jy', 'zy'].forEach((id) => { const c = this.S.chars[id]; if (c.hp > 0) c.hp = Math.min(c.maxHp, c.hp + 8); });
  },

  /* ---------------- 输入：移动 / 视角 ---------------- */
  updatePlayer(dt) {
    const c = this.cur();
    // 键盘（电脑上也能试玩）
    let kx = 0, kz = 0;
    if (this.keys['w'] || this.keys['arrowup']) kz += 1;
    if (this.keys['s'] || this.keys['arrowdown']) kz -= 1;
    if (this.keys['a'] || this.keys['arrowleft']) kx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) kx += 1;
    let mx = this.joy.x + kx, mz = this.joy.y + kz;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const speed = CONFIG.MOVE_SPEED;
    if (Math.abs(mx) > 0.02 || Math.abs(mz) > 0.02) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // 前 = (-sin, -cos)，右 = (cos, -sin)
      const dx = (-sin * mz + cos * mx) * speed * dt;
      const dz = (-cos * mz - sin * mx) * speed * dt;
      const p = { x: c.x + dx, z: c.z + dz };
      World.resolve(p, 0.5);
      c.x = p.x; c.z = p.z;
      this.walkT = (this.walkT || 0) + dt * 9;
    }
    c.yaw = this.yaw;
    // 相机
    const bob = Math.sin(this.walkT || 0) * 0.028 * (ml > 0.05 ? 1 : 0);
    World.camera.rotation.set(0, 0, 0);
    World.camera.rotateY(this.yaw);
    World.camera.rotateX(this.pitch);
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.6);
      World.camera.rotateZ((Math.random() - 0.5) * this.cameraShake * 0.3);
    }
    World.camera.position.set(c.x, CONFIG.EYE_HEIGHT + bob, c.z);
    // 手电筒（夜里 + 有手电筒更亮）
    if (this.S.passives.flashlight) {
      if (!this.flashlight) {
        this.flashlight = new THREE.PointLight(0xffe9b0, 0, 22, 2);
        World.scene.add(this.flashlight);
      }
      this.flashlight.position.copy(World.camera.position);
      this.flashlight.intensity = 0.2 + this.nightF * 1.6;
      World.scene.fog.density = 0.022 + this.nightF * 0.018;
    }
    // 安全屋提示
    this.atSafe = World.inSafehouse(c.x, c.z);
    // 拾取
    for (let i = World.loot.length - 1; i >= 0; i--) {
      const L = World.loot[i];
      if (Math.hypot(L.position.x - c.x, L.position.z - c.z) < CONFIG.PICKUP_DIST) {
        const k = L.userData.kind;
        if (this.gainItem(k, 1)) { World.takeLoot(L); UI.renderBagIfOpen(); }
      }
    }
  },
};

/* 取某张精灵表每一行的 three 贴图（延迟构建，避免重复） */
function SHEETROWS(key) {
  if (!SHEETROWS.cache) SHEETROWS.cache = {};
  if (!SHEETROWS.cache[key]) {
    const s = SHEETS[key];
    SHEETROWS.cache[key] = s ? s.rows.map((cv) => sheetRowTexture(cv, s.cols)) : [null];
  }
  return SHEETROWS.cache[key];
}
