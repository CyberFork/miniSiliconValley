/* ============================================================
   world.js —— 3D 末日街区：地面、建筑、废弃车辆、路灯、安全屋、物资
   + 白天黑夜的光影变化 + 声音（全部程序生成，不需要额外音频文件）
   ============================================================ */

/* ---------------- 声音引擎（WebAudio 现场合成） ---------------- */
const Sfx = {
  ctx: null, master: null, ready: false, muted: false,
  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.ready = true;
      this.startAmbience();
    } catch (e) { console.warn('声音不可用', e); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  noiseBuffer(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  startAmbience() {
    if (!this.ready) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3); src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = this.ctx.createGain(); g.gain.value = 0.055;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.wind = g;
  },
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ready || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), this.ctx.currentTime + dur);
    g.gain.value = vol === undefined ? 0.16 : vol;
    g.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur + 0.02);
  },
  burst(dur, freq, vol, type) {
    if (!this.ready || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer(dur);
    const f = this.ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 900;
    const g = this.ctx.createGain(); g.gain.value = vol === undefined ? 0.22 : vol;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  },
  growl() { if (!this.ready || this.muted) return; this.blip(70 + Math.random() * 40, 0.85, 'sawtooth', 0.10, 42); this.burst(0.6, 300, 0.07); },
  hit() { this.burst(0.16, 1400, 0.18); this.blip(220, 0.09, 'square', 0.1, 90); },
  hurt() { this.blip(150, 0.28, 'triangle', 0.2, 70); this.burst(0.2, 500, 0.14); },
  pickup() { this.blip(700, 0.12, 'triangle', 0.14, 1100); },
  craft() { this.blip(420, 0.18, 'triangle', 0.16, 880); setTimeout(() => this.blip(880, 0.2, 'triangle', 0.14, 1200), 140); },
  skill(kind) {
    if (kind === 'flame') { this.burst(0.5, 700, 0.24, 'lowpass'); this.blip(180, 0.3, 'sawtooth', 0.12, 60); }
    else if (kind === 'heal') { this.blip(520, 0.35, 'sine', 0.16, 900); }
    else if (kind === 'frost') { this.blip(1400, 0.4, 'sine', 0.14, 300); this.burst(0.35, 2600, 0.12); }
    else if (kind === 'dash' || kind === 'jump') { this.burst(0.3, 500, 0.16); this.blip(300, 0.22, 'triangle', 0.1, 700); }
    else if (kind === 'fire') { this.burst(0.6, 420, 0.2, 'lowpass'); }
    else this.burst(0.25, 900, 0.16);
  },
  heartbeat(fast) { this.blip(fast ? 58 : 48, 0.16, 'sine', 0.26, 34); },
  zipper() { this.blip(240, 0.2, 'square', 0.12, 60); },
};

/* ---------------- 世界 ---------------- */
const World = {
  scene: null, camera: null, renderer: null, canvas: null,
  solids: [],            // 碰撞盒 {x0,x1,z0,z1,h}
  loot: [], lootGroup: null, lampLights: [], glow: [],
  hemi: null, sun: null, moon: null,
  nightFactor: 0,        // 0=白天 1=黑夜
  lootSpin: 0,
  weather: null,

  init(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = false;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a1d22, 0.028);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, CONFIG.EYE_HEIGHT, 0);
    this.camera = camera;

    this.hemi = new THREE.HemisphereLight(0xb9c3cc, 0x2a2622, 0.75);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe0b0, 0.55);
    this.sun.position.set(40, 60, 20); scene.add(this.sun);
    this.moon = new THREE.DirectionalLight(0x8fb4ff, 0.0);
    this.moon.position.set(-30, 40, -20); scene.add(this.moon);

    this.buildGround();
    this.buildCity();
    this.buildSafehouse();
    this.lootGroup = new THREE.Group(); scene.add(this.lootGroup);
    this.spawnLoot(55);
    window.addEventListener('resize', () => this.onResize());
    return this;
  },

  onResize() {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  },

  /* ---- 程序化贴图 ---- */
  makeTexture(draw, size) {
    const s = size || 256;
    const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
    const cx = cv.getContext('2d');
    draw(cx, s);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  },
  groundTex() {
    return this.makeTexture((cx, s) => {
      cx.fillStyle = '#33363a'; cx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const g = 30 + Math.random() * 55;
        cx.fillStyle = 'rgba(' + g + ',' + g + ',' + (g - 4) + ',.7)';
        cx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      cx.strokeStyle = 'rgba(18,18,18,.75)'; cx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        cx.beginPath();
        let x = Math.random() * s, y = Math.random() * s;
        cx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; cx.lineTo(x, y); }
        cx.stroke();
      }
    }, 256);
  },
  wallTex(c1, c2) {
    return this.makeTexture((cx, s) => {
      cx.fillStyle = c1; cx.fillRect(0, 0, s, s);
      for (let y = 8; y < s; y += 26) for (let x = 8; x < s; x += 22) {
        const lit = Math.random();
        cx.fillStyle = lit > 0.82 ? 'rgba(255,214,140,.5)' : 'rgba(12,14,17,.82)';
        cx.fillRect(x, y, 11, 15);
      }
      cx.fillStyle = 'rgba(0,0,0,.22)';
      for (let i = 0; i < 18; i++) cx.fillRect(Math.random() * s, 0, 3 + Math.random() * 6, s);
      cx.strokeStyle = c2; cx.lineWidth = 4; cx.strokeRect(2, 2, s - 4, s - 4);
    }, 256);
  },

  buildGround() {
    const g = new THREE.PlaneGeometry(CONFIG.MAP_SIZE, CONFIG.MAP_SIZE);
    const tex = this.groundTex();
    tex.repeat.set(18, 18);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    // 街道中线，帮玩家认路
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x6b6b52 });
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const a = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.MAP_SIZE, 0.35), lineMat);
      a.rotation.x = -Math.PI / 2; a.position.set(0, 0.02, i * 22); this.scene.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.35, CONFIG.MAP_SIZE), lineMat);
      b.rotation.x = -Math.PI / 2; b.position.set(i * 22, 0.02, 0); this.scene.add(b);
    }
  },

  addSolid(x, z, w, d, h) {
    this.solids.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: h || 10 });
  },

  buildCity() {
    const wallVariants = [
      this.wallTex('#4a4640', '#2c2a26'),
      this.wallTex('#3f4448', '#26292c'),
      this.wallTex('#514741', '#2f2823'),
    ];
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x22252a });
    const step = 22, half = 3;
    for (let bx = -half; bx <= half; bx++) {
      for (let bz = -half; bz <= half; bz++) {
        if (bx === 0 && bz === 0) continue;                 // 中心留给安全屋
        if (Math.abs(bx) + Math.abs(bz) === 1) continue;     // 安全屋周围留出空地
        const cx = bx * step, cz = bz * step;
        const count = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < count; k++) {
          const w = 8 + Math.random() * 7, d = 8 + Math.random() * 7;
          const h = 6 + Math.random() * 14 + (Math.abs(bx) + Math.abs(bz)) * 0.6;
          const ox = (Math.random() - 0.5) * (step - w - 2);
          const oz = (Math.random() - 0.5) * (step - d - 2);
          const tex = wallVariants[(Math.abs(bx) + Math.abs(bz) + k) % wallVariants.length].clone();
          tex.needsUpdate = true;
          tex.repeat.set(Math.max(1, w / 8), Math.max(1, h / 8));
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
            [new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex }),
             roofMat, roofMat, new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex })]);
          b.position.set(cx + ox, h / 2, cz + oz);
          this.scene.add(b);
          this.addSolid(b.position.x, b.position.z, w, d, h);
        }
      }
    }
    // 废弃车辆
    const carColors = [0x7a3b2e, 0x2f3b45, 0x4a4a44, 0x5d5347];
    for (let i = 0; i < 26; i++) {
      const onX = Math.random() < 0.5;
      const lane = (Math.floor(Math.random() * 7) - 3) * 22 + (Math.random() - 0.5) * 8;
      const along = (Math.random() - 0.5) * 130;
      const w = onX ? 4.4 : 2.1, d = onX ? 2.1 : 4.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, d),
        new THREE.MeshLambertMaterial({ color: carColors[i % carColors.length] }));
      const x = onX ? along : lane, z = onX ? lane : along;
      body.position.set(x, 0.65, z);
      body.rotation.y = (Math.random() - 0.5) * 0.5;
      this.scene.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.7, d * 0.62),
        new THREE.MeshLambertMaterial({ color: 0x1b1e22 }));
      cab.position.set(x, 1.5, z); cab.rotation.y = body.rotation.y;
      this.scene.add(cab);
      this.addSolid(x, z, Math.max(w, d) + 0.4, Math.max(w, d) + 0.4, 1.6);
    }
    // 路灯（夜里点亮，数量受控保证流畅）
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2e33 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    let lampIdx = 0;
    for (let bx = -3; bx <= 3; bx++) for (let bz = -3; bz <= 3; bz++) {
      if (bx === 0 && bz === 0) continue;
      const x = bx * 22 + 11, z = bz * 22 + 11;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 8, 6), poleMat);
      pole.position.set(x, 4, z); this.scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), bulbMat.clone());
      bulb.position.set(x, 8.3, z); this.scene.add(bulb);
      bulb.material.opacity = 1; bulb.material.transparent = true;
      this.glow.push(bulb);
      if (lampIdx < 7) {
        const lt = new THREE.PointLight(0xffcf82, 0, 26, 2);
        lt.position.set(x, 8, z); this.scene.add(lt);
        this.lampLights.push(lt);
      }
      lampIdx++;
    }
    // 街边杂物
    const junkMat = new THREE.MeshLambertMaterial({ color: 0x3b3a35 });
    for (let i = 0; i < 60; i++) {
      const s = 0.5 + Math.random() * 1.1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s), junkMat);
      m.position.set((Math.random() - 0.5) * 130, s * 0.3, (Math.random() - 0.5) * 130);
      m.rotation.y = Math.random() * 3;
      this.scene.add(m);
    }
  },

  buildSafehouse() {
    // 围墙（留一个正门开口）
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x53504a });
    const R = 10, H = 3.4, T = 0.7;
    const makeWall = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      m.position.set(x, H / 2, z); this.scene.add(m);
      this.addSolid(x, z, w, d, H);
      // 墙顶铁刺
      const topMat = new THREE.MeshLambertMaterial({ color: 0x2e2c29 });
      for (let i = -w / 2 + 1; i < w / 2; i += 2) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), topMat);
        s.position.set(x + (d < w ? i : 0), H + 0.35, z + (d < w ? 0 : i));
        this.scene.add(s);
      }
    };
    makeWall(0, -R, R * 2, T);
    makeWall(-R, 0, T, R * 2);
    makeWall(R, 0, T, R * 2);
    makeWall(-R + 3.2, R, R - 3.2, T);      // 正门开口
    makeWall(R - 3.2, R, R - 3.2, T);

    // 主屋
    const houseTex = this.wallTex('#5a5045', '#332c25');
    houseTex.repeat.set(2, 1.4);
    const house = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.4, 7),
      new THREE.MeshLambertMaterial({ map: houseTex }));
    house.position.set(-3.4, 2.2, -3.4); this.scene.add(house);
    this.addSolid(-3.4, -3.4, 8.4, 7, 4.4);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.4, 7.4), new THREE.MeshLambertMaterial({ color: 0x26292e }));
    roof.position.set(-3.4, 4.6, -3.4); this.scene.add(roof);

    // 合成台 + 存档终端 + 篝火
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1.3), new THREE.MeshLambertMaterial({ color: 0x5d4a33 }));
    bench.position.set(4.4, 0.55, -2.2); this.scene.add(bench);
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1.5), new THREE.MeshLambertMaterial({ color: 0x7d6242 }));
    benchTop.position.set(4.4, 1.15, -2.2); this.scene.add(benchTop);
    this.benchPos = new THREE.Vector3(4.4, 0, -2.2);

    const term = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.8), new THREE.MeshLambertMaterial({ color: 0x2a3138 }));
    term.position.set(4.6, 0.8, 2.6); this.scene.add(term);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0x7fe07f }));
    screen.position.set(4.6, 1.25, 3.02); this.scene.add(screen);
    this.termPos = new THREE.Vector3(4.6, 0, 2.6);
    this.termScreen = screen;

    const logMat = new THREE.MeshLambertMaterial({ color: 0x3a2b1d });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.18), logMat);
      log.position.set(-1.6, 0.1, 5.0); log.rotation.y = i * 0.8; this.scene.add(log);
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 7),
      new THREE.MeshBasicMaterial({ color: 0xff8a3b, transparent: true, opacity: 0.8 }));
    fire.position.set(-1.6, 0.5, 5.0); this.scene.add(fire);
    this.fire = fire;
    const fireLight = new THREE.PointLight(0xff9a4a, 1.0, 12, 2);
    fireLight.position.set(-1.6, 1.0, 5.0); this.scene.add(fireLight);
    this.fireLight = fireLight;

    // 安全屋光柱：夜里远远就能看见家在哪
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfe08a, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(0, 13, 0); this.scene.add(beam);
    this.beam = beam;

    // 大门两侧的沙袋
    const bagMat = new THREE.MeshLambertMaterial({ color: 0x6b6448 });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.9), bagMat);
      s.position.set(-7.2 + i * 0.1, 0.3 + (i % 2) * 0.6, R - 0.9);
      s.rotation.y = 0.2 * i; this.scene.add(s);
    }
  },

  /* ---- 物资 ---- */
  spawnLoot(n) {
    const kinds = [
      'bandage', 'bandage', 'food_can', 'food_can', 'food_bar', 'water', 'water',
      'cloth', 'cloth', 'alcohol', 'metal', 'wood', 'cloth', 'metal', 'wood',
      'bandage', 'food_bar', 'alcohol', 'metal', 'medkit',
    ];
    for (let i = 0; i < n; i++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      let x, z, tries = 0;
      do {
        x = (Math.random() - 0.5) * 120; z = (Math.random() - 0.5) * 120; tries++;
      } while (tries < 40 && (Math.hypot(x, z) < CONFIG.SAFE_RADIUS + 3 || this.blocked(x, z, 1.2)));
      this.addLoot(k, x, z);
    }
  },
  addLoot(kind, x, z) {
    const it = ITEMS[kind]; if (!it) return;
    const g = new THREE.Group();
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xb9a06a, emissive: 0x4a3a12 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), boxMat);
    box.position.y = 0.3; g.add(box);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 16),
      new THREE.MeshBasicMaterial({ color: 0xd9c07a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; g.add(halo);
    g.position.set(x, 0, z);
    g.userData = { kind, kind2: it.kind, taken: false, halo, box };
    this.lootGroup.add(g);
    this.loot.push(g);
  },
  takeLoot(obj) {
    obj.userData.taken = true;
    this.lootGroup.remove(obj);
    const i = this.loot.indexOf(obj); if (i >= 0) this.loot.splice(i, 1);
  },

  /* ---- 碰撞 ---- */
  blocked(x, z, r) {
    r = r || 0.45;
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return s;
    }
    return null;
  },
  resolve(pos, r) {
    r = r || 0.45;
    const lim = CONFIG.MAP_SIZE / 2 - 1.5;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
    for (let k = 0; k < 3; k++) {
      const s = this.blocked(pos.x, pos.z, r);
      if (!s) break;
      const cx = Math.max(s.x0, Math.min(s.x1, pos.x));
      const cz = Math.max(s.z0, Math.min(s.z1, pos.z));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d > 0.0001) { pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
      else { pos.x = (pos.x < (s.x0 + s.x1) / 2) ? s.x0 - r : s.x1 + r; }
    }
    return pos;
  },
  inSafehouse(x, z) { return Math.hypot(x, z) <= CONFIG.SAFE_RADIUS - 1.5; },
  /* 视线遮挡（简单射线步进，用于丧尸发现玩家） */
  lineBlocked(a, b) {
    const steps = 8;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const s = this.blocked(x, z, 0.1);
      if (s && s.h > 2) return true;
    }
    return false;
  },

  /* ---- 昼夜 ---- */
  setNight(f) {
    this.nightFactor = f;
    const dayCol = new THREE.Color(0xb9c4cf), nightCol = new THREE.Color(0x1b2330);
    const sky = dayCol.clone().lerp(nightCol, f);
    this.scene.background = sky;
    this.scene.fog.color = sky.clone().lerp(new THREE.Color(0x0b0e12), f * 0.45);
    this.scene.fog.density = 0.016 + f * 0.034;
    this.hemi.intensity = 1.05 - f * 0.8;
    this.hemi.color = new THREE.Color(0xb9c3cc).lerp(new THREE.Color(0x2c3a52), f);
    this.sun.intensity = Math.max(0, 0.85 - f * 1.05);
    this.moon.intensity = f * 0.28;
    this.lampLights.forEach((l) => { l.intensity = f * 1.8; });
    if (this.beam) this.beam.material.opacity = f * 0.16;
    this.glow.forEach((b) => { b.material.color.setHex(f > 0.35 ? 0xffe3a8 : 0x8d8f7a); });
    if (this.fireLight) this.fireLight.intensity = 0.6 + f * 0.9;
  },

  update(dt, t) {
    this.lootSpin += dt;
    for (let i = 0; i < this.loot.length; i++) {
      const g = this.loot[i];
      g.userData.box.rotation.y += dt * 1.6;
      g.position.y = Math.sin(this.lootSpin * 2 + i) * 0.08;
    }
    if (this.fire) {
      this.fire.scale.y = 1 + Math.sin(t * 9) * 0.12;
      this.fire.rotation.y += dt * 1.2;
    }
    if (this.termScreen) this.termScreen.material.color.setHex(Math.sin(t * 3) > 0 ? 0x7fe07f : 0x3f7f3f);
  },
};
