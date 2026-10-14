/* ============================================================
   ui.js —— 页面流程、HUD、触屏操作（摇杆 + 滑动视角 + 技能键）、
   人物界面、背包与合成、死亡页
   ============================================================ */
const UI = {
  screens: ['boot', 'login', 'intro', 'prep', 'battle', 'char', 'bag', 'dead'],
  bagOpen: false, charOpen: false, tab: 'bag',
  sel: null,
  fxFloats: [],
  lastSafe: null,
  introTimer: null,

  /* ---------------- 页面 ---------------- */
  go(id) {
    this.screens.forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === id);
    });
    this.bagOpen = (id === 'bag'); this.charOpen = (id === 'char');
    if (id === 'battle') setTimeout(() => World.onResize(), 30);
    if (id === 'prep') this.renderPrep();
    if (id === 'bag') this.renderBag();
    if (id === 'char') this.renderChar();
  },
  closePage() {
    if (Game.S.started && !Game.dead) this.go('battle');
    else this.go('prep');
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { t.style.display = 'none'; }, 2300);
  },
  flashHurt(k) {
    const el = document.getElementById('hurt-flash');
    el.style.background = 'rgba(160,20,20,' + (0.15 + k * 0.4) + ')';
    clearTimeout(this._hf);
    this._hf = setTimeout(() => { el.style.background = 'rgba(160,20,20,0)'; }, 180);
  },
  showLoginInfo() {
    const el = document.getElementById('login-info');
    el.textContent = Game.S.started ? Game.showSaveInfo() : '这台设备还没有存档 · 将从第 1 天开始';
  },
  showDead(reason) {
    document.getElementById('dead-stat').innerHTML =
      reason + '<br>击杀丧尸 ' + Game.S.stats.kills + ' 只 · 搜集物资 ' + Game.S.stats.loot + ' 次 · 合成 ' + Game.S.stats.crafts + ' 次';
    document.getElementById('dead-note').textContent = '存档在：第 ' + (JSON.parse(window.MSV_SHOWCASE_STORAGE.getItem(CONFIG.SAVE_KEY) || '{}').day || 1) + ' 天（安全屋）';
    document.getElementById('dead-load').onclick = () => Game.reviveFromSave();
    this.go('dead');
  },

  /* ---------------- HUD ---------------- */
  updateHUD() {
    if (!Game.S) return;
    const act = Game.S.active;
    const jy = Game.S.chars.jy, zy = Game.S.chars.zy;
    const hour = (Game.time / CONFIG.DAY_SECONDS) * 24;
    const minuteOfDay = Math.floor(hour * 60);
    const sig = [act, Math.round(jy.hp), Math.round(jy.hunger), Math.round(zy.hp), Math.round(zy.hunger),
      Game.S.day, minuteOfDay, Game.atSafe ? 1 : 0, Math.ceil(Game.switchCd * 5)].join('|');
    if (sig === this._hudSig) { this.renderSkillBar(); return; }
    this._hudSig = sig;
    const bars = document.getElementById('hud-bars');
    bars.innerHTML = ['jy', 'zy'].map((id) => {
      const c = Game.S.chars[id];
      const dead = c.hp <= 0;
      const hpP = Math.max(0, (c.hp / c.maxHp) * 100);
      return '<div class="bar-row" style="' + (id === act ? 'border-color:#d9a441' : 'opacity:' + (dead ? '.45' : '.8')) + '">' +
        '<span>' + (id === act ? '▶ ' : '') + CHARS[id].name + (dead ? '（倒下）' : '') + '</span>' +
        '<div class="bar hp"><i style="width:' + hpP + '%"></i></div>' +
        '<div class="bar food"><i style="width:' + c.hunger + '%"></i></div>' +
        '<span style="font-size:10px;color:#a8aeb5">' + Math.round(c.hp) + '/' + Math.round(c.maxHp) + '</span>' +
        '</div>';
    }).join('');
    const hh = String(Math.floor(hour)).padStart(2, '0');
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
    document.getElementById('hud-day').textContent = '第 ' + Game.S.day + ' 天';
    document.getElementById('hud-clock').textContent =
      (Game.nightF > 0.5 ? '🌙 黑夜 ' : Game.nightF > 0.1 ? '🌇 黄昏 ' : '☀️ 白天 ') + hh + ':' + mm;
    document.getElementById('btn-switch').textContent =
      Game.switchCd > 0 ? '切换（' + Game.switchCd.toFixed(1) + 's）'
        : '切换 ' + CHARS[Game.otherId()].name;
    document.getElementById('btn-switch').classList.toggle('hot', Game.switchCd <= 0);
    const inSafe = Game.atSafe;
    document.getElementById('btn-save').style.display = inSafe ? '' : 'none';
    document.getElementById('btn-char').style.display = inSafe ? '' : 'none';
    document.getElementById('safe-tag').style.display = inSafe ? 'block' : 'none';
    const hint = document.getElementById('hud-hint');
    let hintTxt = '';
    if (inSafe) hintTxt = '🏠 你在安全屋，丧尸进不来 · 可以存档、合成、换技能';
    else if (Game.nightF > 0.5) hintTxt = '🌙 夜晚：丧尸更多更快，赶紧回安全屋';
    else if (Game.S.chars.jy.hunger < 25 || Game.S.chars.zy.hunger < 25) hintTxt = '🍖 有人快饿坏了，打开背包吃点东西';
    else hintTxt = '左手摇杆走动 · 右半屏滑动看四周 · 右下角按钮放技能';
    if (hint.textContent !== hintTxt) hint.textContent = hintTxt;
    this.renderSkillBar();
  },
  renderSkillBar() {
    const list = Game.skillList(Game.S.active);
    const sig = list.join(',') + '|' + (Game.S.bag.molotov || 0) + '|' +
      list.map((sid) => Math.ceil((Game.cd[sid] || 0) * 4)).join('.');
    if (sig === this._skillSig) return;
    this._skillSig = sig;
    const wrap = document.getElementById('hud-skills');
    let html = '';
    for (let i = 0; i < 3; i++) {
      const sid = list[i];
      if (!sid) { html += '<div class="skill locked"><div class="ic">➖</div><div class="nm">空</div></div>'; continue; }
      const sk = SKILLS[sid];
      const cd = Game.cd[sid] || 0;
      const need = (sid === 'throw' && (!Game.S.bag.molotov || Game.S.bag.molotov <= 0));
      html += '<div class="skill ' + (cd > 0 ? 'cooling' : '') + ' ' + (need ? 'locked' : '') + '" data-skill="' + i + '">' +
        '<div class="ic">' + sk.icon + '</div><div class="nm">' + sk.name + '</div>' +
        '<div class="cd">' + (cd > 0 ? cd.toFixed(1) : '') + '</div></div>';
    }
    html += '<div class="skill big" data-attack="1"><div class="ic">🔪</div><div class="nm">普攻</div></div>';
    wrap.innerHTML = html;
  },

  /* ---------------- 飘字 ---------------- */
  floatText(worldPos, text, heal, life) {
    const el = document.createElement('div');
    el.className = 'dmgfx' + (heal ? ' heal' : '');
    el.textContent = text;
    document.getElementById('battle').appendChild(el);
    this.fxFloats.push({ el, pos: worldPos.clone(), life: life || 1, max: life || 1 });
  },
  updateFloats(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.fxFloats.length - 1; i >= 0; i--) {
      const f = this.fxFloats[i];
      f.life -= dt;
      const v = f.pos.clone().project(World.camera);
      f.el.style.left = ((v.x * 0.5 + 0.5) * w - 14) + 'px';
      f.el.style.top = ((-v.y * 0.5 + 0.5) * h - 10) + 'px';
      if (f.life <= 0) { f.el.remove(); this.fxFloats.splice(i, 1); }
    }
  },

  /* ---------------- 准备页 ---------------- */
  renderPrep() {
    const wrap = document.getElementById('prep-cards');
    if (!wrap) return;
    document.getElementById('prep-day').textContent = '第 ' + Game.S.day + ' 天 · 安全屋';
    wrap.innerHTML = ['jy', 'zy'].map((id) => {
      const c = CHARS[id], s = Game.S.chars[id];
      const sk = Game.skillList(id).map((sid) => '<span class="sk-chip">' + SKILLS[sid].icon + ' ' + SKILLS[sid].name + '</span>').join('');
      return '<div class="ccard ' + (id === Game.S.active ? 'active-char' : '') + '">' +
        '<img src="' + spriteIdleURL(c.sheet) + '" alt="">' +
        '<div><h3>' + c.name + ' · ' + c.role + (id === Game.S.active ? '（当前操作）' : '') + '</h3>' +
        '<p>' + c.desc + '</p>' +
        '<p style="margin-top:4px">❤ ' + Math.round(s.hp) + '/' + Math.round(s.maxHp) + ' ｜ 🍖 饥饿 ' + Math.round(s.hunger) + '</p>' +
        '<div class="skills-strip">' + sk + '</div></div></div>';
    }).join('');
    document.getElementById('prep-note').textContent =
      '规则提醒：每人最多带 3 个技能，换技能只能在安全屋。天亮出门找物资，天黑前回来存档；两个人都不倒下才能继续活下去。背包 ' +
      Object.keys(Game.S.bag).length + '/' + CONFIG.BAG_CAPACITY + ' 格。';
  },

  /* ---------------- 人物界面 ---------------- */
  renderChar() {
    const wrap = document.getElementById('char-wrap');
    if (!wrap) return;
    const canEdit = World.inSafehouse(Game.cur().x, Game.cur().z) || !Game.S.started;
    document.getElementById('char-sub').textContent = canEdit
      ? '每人上阵 3 个技能 · 点技能卡换上去（在安全屋可以随便换）'
      : '离开安全屋了：现在只能查看，回到安全屋才能更换技能';
    wrap.innerHTML = ['jy', 'zy'].map((id) => {
      const c = CHARS[id], s = Game.S.chars[id];
      const eq = Game.skillList(id);
      const slots = [0, 1, 2].map((i) => eq[i]
        ? '<div class="slot filled">' + SKILLS[eq[i]].icon + ' ' + SKILLS[eq[i]].name + '</div>'
        : '<div class="slot">空格 ' + (i + 1) + '</div>').join('');
      const pool = Object.keys(SKILLS).map((sid) => {
        const sk = SKILLS[sid];
        const on = eq.indexOf(sid) >= 0;
        return '<div class="pcard ' + (on ? 'on' : '') + '" data-eq="' + id + ':' + sid + '">' +
          '<b>' + sk.icon + ' ' + sk.name + '</b>' + sk.desc +
          '<br><small>冷却 ' + sk.cd + ' 秒' + (on ? ' · 已上阵（点一下换下）' : '') + '</small></div>';
      }).join('');
      return '<div class="charcol">' +
        '<div class="top"><img src="' + spriteIdleURL(c.sheet) + '" alt="">' +
        '<div><h3 style="font-size:17px">' + c.name + ' · ' + c.role + '</h3>' +
        '<p style="font-size:12px;color:#a8aeb5;line-height:1.6;margin-top:4px">' + c.desc + '</p>' +
        '<p style="font-size:12px;color:#c9c2b4;margin-top:4px">❤ ' + Math.round(s.hp) + '/' + Math.round(s.maxHp) +
        ' ｜ 🍖 饥饿 ' + Math.round(s.hunger) + '</p></div></div>' +
        '<div class="slots">' + slots + '</div>' +
        '<div style="font-size:12px;font-weight:800;color:#c6bfb1;margin-top:2px">技能库（上阵 3 个）</div>' +
        '<div class="pool">' + pool + '</div>' +
        '</div>';
    }).join('');
    document.getElementById('char-note').textContent = canEdit
      ? '装备类物品（铁甲护具 / 猎刀 / 手电筒）在背包里点“装备”就会永久生效。'
      : '提示：回到安全屋后技能可以任意更换。';
  },
  toggleEquip(id, sid) {
    const c = Game.cur();
    if (Game.S.started && !World.inSafehouse(c.x, c.z)) { this.toast('只有在安全屋才能换技能'); return; }
    const list = Game.S.equipped[id];
    const i = list.indexOf(sid);
    if (i >= 0) { list.splice(i, 1); }
    else {
      if (list.length >= 3) { this.toast('每人只能带 3 个技能，先换下一个'); return; }
      list.push(sid);
    }
    Game.S.equipped[id] = list;
    Game.writeSave();
    this.renderChar();
    this.toast(CHARS[id].name + '的技能已更新');
  },

  /* ---------------- 背包与合成 ---------------- */
  bagTab(t) { this.tab = t; this.sel = null; this.renderBag(); },
  renderBag() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;
    document.querySelectorAll('#bag-tabs .tab').forEach((el) => el.classList.toggle('on', el.dataset.tab === this.tab));
    const canCraft = World.inSafehouse(Game.cur().x, Game.cur().z) || !Game.S.started;
    document.getElementById('bag-sub').textContent =
      '背包 ' + Object.keys(Game.S.bag).length + '/' + CONFIG.BAG_CAPACITY + ' 格 · ' +
      (canCraft ? '在安全屋，可以用合成台' : '离开安全屋了，回到安全屋才能合成');
    if (this.tab === 'bag') {
      const keys = Object.keys(Game.S.bag);
      let html = keys.map((k) => {
        const it = ITEMS[k];
        return '<div class="cell ' + (this.sel === k ? 'sel' : '') + '" data-item="' + k + '">' +
          (Game.S.passives[k] ? '<div class="eq">已装备</div>' : '') +
          '<div class="ic">' + it.icon + '</div><div class="nm">' + it.name + '</div>' +
          '<div class="n">×' + Game.S.bag[k] + '</div></div>';
      }).join('');
      for (let i = keys.length; i < CONFIG.BAG_CAPACITY; i++) html += '<div class="cell empty"></div>';
      grid.innerHTML = html;
    } else {
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(220px,1fr))';
      grid.innerHTML = RECIPES.map((r) => {
        const ok = Object.keys(r.need).every((k) => (Game.S.bag[k] || 0) >= r.need[k]);
        const need = Object.keys(r.need).map((k) => ITEMS[k].name + '×' + r.need[k] + '（有' + (Game.S.bag[k] || 0) + '）').join(' + ');
        return '<div class="pcard" data-recipe="' + r.id + '" style="' + (ok ? 'border-color:#8fa832' : 'opacity:.65') + '">' +
          '<b>' + ITEMS[r.out].icon + ' ' + ITEMS[r.out].name + ' ×' + r.n + '</b>' +
          '需要：' + need + '<br><small>' + ITEMS[r.out].desc + '</small>' +
          '<div style="margin-top:6px"><span class="tab ' + (ok ? 'on' : '') + '" style="padding:4px 10px">' + (ok ? '点这里合成' : '材料不足') + '</span></div></div>';
      }).join('');
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(200px,1fr))';
    }
    // 详情
    const info = document.getElementById('bag-info'), acts = document.getElementById('bag-actions');
    if (this.tab === 'bag' && this.sel && Game.S.bag[this.sel]) {
      const it = ITEMS[this.sel];
      info.innerHTML = '<b>' + it.icon + ' ' + it.name + ' ×' + Game.S.bag[this.sel] + '</b><br>' + it.desc;
      const useLabel = it.kind === 'heal' ? '使用（回血）' : it.kind === 'food' ? '使用（吃 / 喝）' :
        it.kind === 'throw' ? '使用（投掷）' : it.kind === 'passive' ? '装备（永久生效）' : '材料（拿去合成）';
      acts.innerHTML = '<button class="btn btn-rust" data-use="' + this.sel + '">' + useLabel + '</button>';
    } else {
      info.textContent = this.tab === 'bag' ? '点一个物品，看看它是什么。' : '把材料凑齐，就能在这里做出新东西。';
      acts.innerHTML = '';
    }
  },
  renderBagIfOpen() { if (this.bagOpen) this.renderBag(); },

  /* ---------------- 触屏 / 鼠标输入 ---------------- */
  bindControls() {
    const battle = document.getElementById('battle');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let joyId = null, lookId = null, lastX = 0, lastY = 0;
    const isUI = (t) => {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      return el && el.closest && !!el.closest('.mini-btn,.skill,.stick,.hud-top');
    };
    const setKnob = (dx, dy) => {
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    const startJoy = (t) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = t.clientX - cx, dy = t.clientY - cy;
      const max = r.width / 2 - 12;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / max);
      Game.joy.x = (dx / len) * k;
      Game.joy.y = -(dy / len) * k;
      setKnob((dx / len) * max * k, (dy / len) * max * k);
    };
    const endJoy = () => { joyId = null; Game.joy.x = 0; Game.joy.y = 0; setKnob(0, 0); };

    const down = (e) => {
      if (!Game.running || Game.paused) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.closest && el.closest('.skill')) {
          const sk = el.closest('.skill');
          if (sk.dataset.skill !== undefined) Game.useSkillByIndex(parseInt(sk.dataset.skill, 10));
          else Game.basicAttack();
          e.preventDefault();
        } else if (el && el.closest && el.closest('.mini-btn')) {
          // 顶部小按钮：交给 click 处理，这里不做拦截
        } else if (el && el.closest && el.closest('.stick')) {
          joyId = t.identifier; startJoy(t); e.preventDefault();
        } else if (t.clientX > window.innerWidth * 0.40) {
          lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; e.preventDefault();
        }
      }
    };
    const move = (e) => {
      if (!Game.running || Game.paused) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyId) { startJoy(t); e.preventDefault(); }
        else if (t.identifier === lookId) {
          const dx = t.clientX - lastX, dy = t.clientY - lastY;
          lastX = t.clientX; lastY = t.clientY;
          Game.yaw -= dx * 0.0042;
          Game.pitch = Math.max(-1.2, Math.min(1.1, Game.pitch - dy * 0.0032));
          e.preventDefault();
        }
      }
    };
    const up = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyId) endJoy();
        if (t.identifier === lookId) lookId = null;
      }
    };
    battle.addEventListener('touchstart', down, { passive: false });
    battle.addEventListener('touchmove', move, { passive: false });
    battle.addEventListener('touchend', up, { passive: false });
    battle.addEventListener('touchcancel', up, { passive: false });

    // 鼠标（电脑试玩）
    let mLook = false;
    battle.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('.skill')) return;
      if (e.clientX > window.innerWidth * 0.40 && Game.running) { mLook = true; lastX = e.clientX; lastY = e.clientY; }
    });
    window.addEventListener('mousemove', (e) => {
      if (!mLook) return;
      Game.yaw -= (e.clientX - lastX) * 0.0032;
      Game.pitch = Math.max(-1.2, Math.min(1.1, Game.pitch - (e.clientY - lastY) * 0.0026));
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { mLook = false; });
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      Game.keys[k] = true;
      if (k === '1') Game.useSkillByIndex(0);
      if (k === '2') Game.useSkillByIndex(1);
      if (k === '3') Game.useSkillByIndex(2);
      if (k === 'q') Game.switchChar();
      if (k === ' ') { Game.basicAttack(); e.preventDefault(); }
      if (k === 'escape') Game.backToPrep();
    });
    window.addEventListener('keyup', (e) => { Game.keys[e.key.toLowerCase()] = false; });

    // 页面事件委托
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target.closest('[data-item],[data-use],[data-recipe],[data-eq]') : null;
      if (!t) return;
      if (t.dataset.item) { this.sel = t.dataset.item; this.renderBag(); }
      else if (t.dataset.use) { Game.useItem(t.dataset.use); this.renderBag(); }
      else if (t.dataset.recipe) { Game.craft(t.dataset.recipe); this.renderBag(); }
      else if (t.dataset.eq) { const [id, sid] = t.dataset.eq.split(':'); this.toggleEquip(id, sid); }
    });
    // 开机 / 动画
    document.getElementById('boot').addEventListener('click', () => { this.go('login'); this.showLoginInfo(); });
    document.getElementById('intro').addEventListener('click', () => this.skipIntro());

    window.addEventListener('resize', () => { World.onResize(); });
    window.addEventListener('orientationchange', () => setTimeout(() => World.onResize(), 200));
    // 帧动画飘字
    setInterval(() => { if (Game.running) this.updateFloats(1 / 30); }, 33);
  },

  /* ---------------- 流程 ---------------- */
  playIntro() {
    this.go('intro');
    document.querySelectorAll('#intro .line').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => this.skipIntro(), 6600);
  },
  skipIntro() {
    clearTimeout(this.introTimer);
    this.go('prep');
  },
};
