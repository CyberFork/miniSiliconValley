/**
 * 星之卡比 CP版 · 游戏主流程、输入监听与渲染循环 (子棍 2, 4, 5, 6, 7, 8, 9, 10, 13)
 * 全端输入适配、第三人称相机跟踪、半透跳台穿透、技能严格舍弃、战斗打击与Boss战
 */
const KirbyGame = (() => {
  let scene, camera, renderer;
  let currentWorld = null;
  let player = null;
  let playerModel = null;
  let enemies = [];
  let headStars = [];
  let boss = null;
  let whispy = null;         // 经典常驻 Boss: 风语大树 (Whispy Woods)
  let projectiles = [];
  let props = [];            // 塞满嘴道具 (汽车、三角锥、贩卖机、圈圈)
  let cages = [];            // 瓦豆鲁迪牢笼 (探索发现)
  let slashes = [];          // 剑气弧光、超级技能与冲击波特效
  let superGauge = 0;        // 超级大招能量 (0-100)
  let superActiveTimer = 0;  // 超级大剑持续时间
  let superAbilityType = 0;  // 超级能力形态轮换: 0=超级剑, 1=怪兽烈焰, 2=全垒打木槌
  let invincibleTimer = 0;   // 无敌糖果彩虹无敌状态倒计时
  let attackBoostTimer = 0;  // 攻击药水加成倒计时
  let perfectDodgeTimer = 0; // 魔女时间慢动作持续计时
  let savedWaddleDees = 0;   // 成功拯救瓦豆鲁迪总数
  let isTurbo = false;       // 汽车塞满嘴涡轮冲刺
  let qdState = 'idle';      // 刹那间居合斩小游戏状态: 'idle' | 'waiting' | 'ready' | 'finished'
  let qdStartTime = 0;       // 居合斩提示出现时间
  let qdTimeout = null;      // 居合斩随机定时器
  let running = false;
  let paused = false;
  let mode = 'solo'; // solo | endless | online
  let worldKey = 'grassland';
  let characterKey = 'pink';
  let guideKirby = null;     // 向导卡比 3D 浮空伴随 NPC
  let guideAdviceTimer = 0;  // 向导卡比智能提示计时器
  let lastGuideTip = '';     // 上次提示内容防止频繁刷屏

  // 阶段目标与任务
  let quest = {
    title: '探索长路',
    desc: '击败敌人并寻找最终 Boss',
    targetKills: 3,
    currentKills: 0,
    stage: 1
  };

  // 输入状态表
  const keys = {};
  const touchState = {
    joyX: 0,
    joyY: 0,
    forward: false,
    back: false,
    jump: false,
    crouch: false,
    attack: false,
    collect: false,
    skill: false,
    discard: false,
    dodge: false,
    superPower: false,
    summon1: false,
    summon2: false
  };
  let mouseX = 0.5;
  let isPointerLocked = false;

  // 召唤按键判定状态
  let summon0Pressed = false;
  let summon1Pressed = false;

  // 冷却与计时器
  let skillCooldownTimer = 0;
  let shieldActiveTimer = 0;

  let camInitialized = false;

  // 3D 自由第三人称视角参数 (标准 3D 手机/主机视角)
  let cameraYaw = 0;             // 水平环绕视角 (弧度)
  let cameraPitch = 0.35;        // 垂直俯仰角 (弧度，约 20°)
  let cameraDist = 8.0;          // 与卡比的距离
  let camTouchId = null;         // 视角触摸手势指 ID
  let lastCamTouchX = 0;
  let lastCamTouchY = 0;

  // 角度最短路径平滑插值函数
  function lerpAngle(from, to, t) {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * Math.min(1.0, t);
  }

  function initRenderer() {
    if (renderer) return;
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 启用 sRGB 广色域与 ACES Filmic 电影级高光色调映射 (1:1 还原封面与 Switch 次时代真实质感)
    if (THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 240);

    window.addEventListener('resize', onWindowResize);
    setupDesktopInputs(canvas);
    setupTouchInputs();
  }

  function onWindowResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------------- 桌面端输入监听 ----------------
  function setupDesktopInputs(canvas) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      keys[k] = true;

      if (k === 'escape') togglePause();
      if (k === 'q') {
        if (player && player.mouthfulMode) {
          discardMouthful();
        } else {
          discardAbility();
        }
      }
      if (k === 'e') {
        if (!tryInhaleProp()) {
          triggerCharacterSkill();
        }
      }
      if (k === 'shift' || (keys['s'] && k === ' ') || (keys['arrowdown'] && k === ' ')) performSlideDash();
      if (k === 'c') performDodgeRoll();
      if (k === 'x') triggerSuperAbility();
      if (k === 't') evolveCurrentAbility();
      if (k === 'j') triggerAttack();
      if (k === 'k') {
        if (!tryInhaleProp()) triggerCollectOrInhale();
      }
      if (k === ' ') performJump();

      // 联机召唤双按键监听: 同时按 0 和 1
      if (k === '0') summon0Pressed = true;
      if (k === '1') summon1Pressed = true;
      if (summon0Pressed && summon1Pressed) {
        onDualSummonTrigger();
      }

      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      keys[k] = false;
      if (k === '0') summon0Pressed = false;
      if (k === '1') summon1Pressed = false;
    });

    // 鼠标拖拽旋转 3D 视角与滚轮缩放
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let hasDragged = false;
    let mouseDownBtn = 0;

    canvas.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      hasDragged = false;
      mouseDownBtn = e.button;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (isMouseDown && running && !paused) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (Math.hypot(dx, dy) > 2) {
          hasDragged = true;
        }
        cameraYaw -= dx * 0.006;
        cameraPitch = Math.max(0.08, Math.min(0.85, cameraPitch + dy * 0.005));
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (isMouseDown && !hasDragged && running && !paused) {
        if (mouseDownBtn === 0) {
          if (!tryInhaleProp()) triggerCollectOrInhale(); // 左键：优先塞满嘴道具吸入，否则爱心收服
        }
        if (mouseDownBtn === 2) triggerAttack();          // 右键：普通攻击 / 元素能力 / 塞满嘴特技
      }
      isMouseDown = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      if (running && !paused) {
        cameraDist = Math.max(4.5, Math.min(14.0, cameraDist + e.deltaY * 0.008));
        e.preventDefault();
      }
    }, { passive: false });
  }

  // ---------------- 移动端触控监听 (左手全域摇杆跑动 + 右手滑动选视角) ----------------
  function setupTouchInputs() {
    const joy = document.getElementById('joy');
    const dot = document.getElementById('joy-dot');
    let joyTouchId = null;
    let joyCenterX = 0;
    let joyCenterY = 0;
    const maxRadius = 50;

    function updateJoyPosition(clientX, clientY) {
      const rawDx = clientX - joyCenterX;
      const rawDy = clientY - joyCenterY;
      const dist = Math.hypot(rawDx, rawDy);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(rawDy, rawDx);

      if (dist > 3) {
        const ratio = clampedDist / maxRadius;
        touchState.joyX = Math.cos(angle) * ratio;
        touchState.joyY = Math.sin(angle) * ratio;
        if (dot) {
          dot.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
        }
      } else {
        touchState.joyX = 0;
        touchState.joyY = 0;
        if (dot) dot.style.transform = 'translate(0px, 0px)';
      }
    }

    function resetJoystick() {
      joyTouchId = null;
      touchState.joyX = 0;
      touchState.joyY = 0;
      if (dot) dot.style.transform = 'translate(0px, 0px)';
      if (joy) {
        joy.style.position = '';
        joy.style.left = '';
        joy.style.top = '';
        joy.style.bottom = '';
        joy.style.transform = '';
        joy.style.opacity = '0.9';
      }
    }

    // 全局触控开始：严格按屏幕左右半区划分职责！
    window.addEventListener('touchstart', (e) => {
      if (!running || paused) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        // 1. 若触摸命中在动作按钮或顶栏按钮，由按钮独立响应
        const target = document.elementFromPoint(t.clientX, t.clientY);
        if (target && target.closest('button, .touch-btn, .hud-btn, #sync-modal')) {
          continue;
        }

        // 2. 左半屏 (小于屏幕 48% 宽度): 100% 专属 360° 移动摇杆！
        if (t.clientX < window.innerWidth * 0.48 && t.clientY > 50) {
          if (joyTouchId === null) {
            joyTouchId = t.identifier;
            joyCenterX = t.clientX;
            joyCenterY = t.clientY;

            // 摇杆瞬间浮动至手指接触位置 (主流 3D 手游跟手体验)
            if (joy) {
              joy.style.position = 'fixed';
              joy.style.left = `${joyCenterX - 65}px`;
              joy.style.top = `${joyCenterY - 65}px`;
              joy.style.bottom = 'auto';
              joy.style.transform = 'scale(1.05)';
              joy.style.opacity = '1';
            }
            updateJoyPosition(t.clientX, t.clientY);
          }
          continue;
        }

        // 3. 右半屏 (大于屏幕 48% 宽度): 100% 专属 3D 视角滑动旋转！
        if (t.clientX >= window.innerWidth * 0.48) {
          if (camTouchId === null) {
            camTouchId = t.identifier;
            lastCamTouchX = t.clientX;
            lastCamTouchY = t.clientY;
          }
        }
      }
    }, { passive: false });

    // 全局触控移动
    window.addEventListener('touchmove', (e) => {
      if (!running || paused) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        // 摇杆移动 -> 更新 360° 跑动向量
        if (t.identifier === joyTouchId) {
          e.preventDefault();
          updateJoyPosition(t.clientX, t.clientY);
        }

        // 视角滑动 -> 更新 3D 摄像机水平与俯仰角
        if (t.identifier === camTouchId) {
          e.preventDefault();
          const dx = t.clientX - lastCamTouchX;
          const dy = t.clientY - lastCamTouchY;
          lastCamTouchX = t.clientX;
          lastCamTouchY = t.clientY;

          cameraYaw -= dx * 0.007;
          cameraPitch = Math.max(0.08, Math.min(0.85, cameraPitch + dy * 0.005));
        }
      }
    }, { passive: false });

    // 全局触控抬起与取消
    const handleTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyTouchId) {
          resetJoystick();
        }
        if (t.identifier === camTouchId) {
          camTouchId = null;
        }
      }
    };
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // 绑定触摸动作按钮
    function bindBtn(id, prop, onPress) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        touchState[prop] = true;
        el.classList.add('active');
        if (onPress) onPress();
      }, { passive: false });

      const release = (e) => {
        e.preventDefault();
        touchState[prop] = false;
        el.classList.remove('active');
      };
      el.addEventListener('touchend', release);
      el.addEventListener('touchcancel', release);
    }

    bindBtn('btn-jump', 'jump', () => performJump());
    bindBtn('btn-crouch', 'crouch', () => {
      if (player && player.grounded && (Math.abs(touchState.joyX) > 0.1 || Math.abs(touchState.joyY) > 0.1)) {
        performSlideDash();
      }
    });
    bindBtn('btn-attack', 'attack', () => triggerAttack());
    bindBtn('btn-collect', 'collect', () => {
      if (!tryInhaleProp()) triggerCollectOrInhale();
    });
    bindBtn('btn-skill', 'skill', () => triggerCharacterSkill());
    bindBtn('btn-dodge', 'dodge', () => performDodgeRoll());
    bindBtn('btn-super-touch', 'superPower', () => triggerSuperAbility());
    bindBtn('btn-discard-touch', 'discard', () => {
      if (player && player.mouthfulMode) {
        discardMouthful();
      } else {
        discardAbility();
      }
    });

    // 绑定 HUD 中的进化与超级大招按钮
    const btnEv = document.getElementById('btn-evolve');
    if (btnEv) btnEv.addEventListener('click', () => evolveCurrentAbility());
    const btnSup = document.getElementById('btn-super-power');
    if (btnSup) btnSup.addEventListener('click', () => triggerSuperAbility());

    // 手机双召唤按钮 (同时按下召唤1与召唤2)
    bindBtn('btn-summon-1', 'summon1', () => checkMobileDualSummon());
    bindBtn('btn-summon-2', 'summon2', () => checkMobileDualSummon());
  }

  function checkMobileDualSummon() {
    if (touchState.summon1 && touchState.summon2) {
      onDualSummonTrigger();
    }
  }

  function onDualSummonTrigger() {
    if (mode !== 'online') {
      showToast('只有在联机模式中才需要召唤伙伴');
      return;
    }
    const res = KirbyMultiplayer.triggerSummon();
    showToast(res.msg);
    if (res.awardedAbility && player) {
      player.ability = res.awardedAbility;
      KirbyEntities.attachAbilityHat(playerModel.hatHolder, player.ability);
      updateHUD();
    }
  }

  // ---------------- 游戏启动与重置 ----------------
  function startGame(chosenMode = 'solo', chosenWorld = 'grassland', chosenChar = 'pink') {
    mode = chosenMode;
    worldKey = chosenWorld;
    characterKey = chosenChar;
    paused = false;
    camInitialized = false;
    cameraYaw = 0;
    cameraPitch = 0.35;
    cameraDist = 8.0;
    camTouchId = null;

    // 清理旧场景与实体
    if (currentWorld) currentWorld.cleanup();
    enemies.forEach(e => { if (e.mesh.parent) e.mesh.parent.remove(e.mesh); });
    enemies = [];
    headStars.forEach(s => { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); });
    headStars = [];
    projectiles.forEach(p => { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); });
    projectiles = [];
    props.forEach(p => { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); });
    props = [];
    cages.forEach(c => { if (c.mesh.parent) c.mesh.parent.remove(c.mesh); });
    cages = [];
    slashes.forEach(s => { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); });
    slashes = [];
    if (boss && boss.mesh.parent) boss.mesh.parent.remove(boss.mesh);
    boss = null;
    if (whispy && whispy.mesh.parent) whispy.mesh.parent.remove(whispy.mesh);
    whispy = null;
    superGauge = 0;
    superActiveTimer = 0;
    invincibleTimer = 0;
    attackBoostTimer = 0;
    perfectDodgeTimer = 0;
    savedWaddleDees = 0;
    isTurbo = false;

    // 构建新世界地形与环境
    currentWorld = KirbyWorlds.createWorld(scene, worldKey);

    // 从持久化存储中读取安全起点
    const safe = KirbyStore.getSafePoint(worldKey);

    // 创建卡比玩家 (含塞满嘴与进化阶级状态)
    player = {
      x: safe.x,
      y: safe.y,
      z: safe.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      hp: 10,
      maxHp: 10,
      ability: null,
      abilityLevel: 1,
      mouthfulMode: null,
      isDodging: false,
      dodgeTimer: 0,
      dodgeVx: 0,
      dodgeVz: 0,
      isSlamming: false,
      grounded: true,
      crouching: false,
      floating: false,
      jumpCount: 0,
      isDown: false,
      rescueTimer: 10
    };

    if (playerModel && playerModel.mesh.parent) {
      scene.remove(playerModel.mesh);
    }
    playerModel = KirbyEntities.createKirbyModel(characterKey);
    playerModel.mesh.position.set(player.x, player.y, player.z);
    scene.add(playerModel.mesh);

    // 生成《探索发现》四大塞满嘴可吸入互动道具 (汽车、自动贩卖机、三角锥、圈圈)
    const carProp = KirbyEntities.createCarProp(3.5, 0.5, safe.z - 8);
    props.push(carProp);
    scene.add(carProp.mesh);

    const vendingProp = KirbyEntities.createVendingProp(-3.5, 0.5, safe.z - 16);
    props.push(vendingProp);
    scene.add(vendingProp.mesh);

    const coneProp = KirbyEntities.createConeProp(-3.5, 0.5, safe.z - 28);
    props.push(coneProp);
    scene.add(coneProp.mesh);

    const ringProp = KirbyEntities.createRingProp(3.5, 0.5, safe.z - 40);
    props.push(ringProp);
    scene.add(ringProp.mesh);

    // 生成被困的瓦豆鲁迪牢笼 (探索发现 & 豪华版)
    const cage1 = KirbyEntities.createWaddleDeeCage(5.5, 0.6, safe.z - 20, 1);
    const cage2 = KirbyEntities.createWaddleDeeCage(-5.5, 0.6, safe.z - 52, 2);
    const cage3 = KirbyEntities.createWaddleDeeCage(0, 0.6, safe.z - 95, 3);
    cages.push(cage1, cage2, cage3);
    scene.add(cage1.mesh);
    scene.add(cage2.mesh);
    scene.add(cage3.mesh);

    // 生成常驻经典 Boss: 风语大树 (Whispy Woods)
    whispy = KirbyEntities.createWhispyWoods(0, 0, safe.z - 65);
    scene.add(whispy.mesh);

    // 生成 3D 向导卡比 (实时伴随指引 NPC)
    if (guideKirby && guideKirby.mesh.parent) guideKirby.mesh.parent.remove(guideKirby.mesh);
    guideKirby = KirbyEntities.createGuideKirbyModel();
    scene.add(guideKirby.mesh);
    guideAdviceTimer = 0.5;

    // 生成该世界的敌人与带技能生物
    spawnEnemiesForWorld(worldKey);

    // 生成最终 Boss (单机与试炼核心: 梦魇帝王)
    boss = KirbyEntities.createFinalBoss(0, 2.0, -118);
    scene.add(boss.mesh);

    // 重置任务
    quest = {
      title: mode === 'endless' ? '无尽阶段探索' : '击败最终 Boss',
      desc: mode === 'endless' ? '击溃前线怪物并探索 Boss' : '前往尽头祭坛，战胜星核霸王',
      targetKills: mode === 'endless' ? 4 : 1,
      currentKills: 0,
      stage: 1
    };

    // 联机特殊初始化
    if (mode === 'online') {
      document.getElementById('online-team-list').style.display = 'flex';
      document.getElementById('dual-summon-pad').style.display = 'flex';
      showToast('🌟 联机已就绪：1号主玩家先锋出击，伙伴请按 0+1 召唤降临！');
    } else {
      document.getElementById('online-team-list').style.display = 'none';
      document.getElementById('dual-summon-pad').style.display = 'none';
      showToast(`✨ 进入【${currentWorld.config.name}】：在安全地点【${safe.name}】启程！`);
    }

    running = true;
    updateHUD();
    requestAnimationFrame(gameLoop);
  }

  // ---------------- 敌人与标志性怪物生成规则 (含沙袋先生与斯卡菲) ----------------
  function spawnEnemiesForWorld(wKey) {
    const specs = [
      { type: 'sandbag', ability: null, z: 2, x: -2.5 },         // 0. 沙袋先生 (靶场沙袋 - 基地木桩击打测试)
      { type: 'minion', ability: null, z: -5, x: 2 },            // 1. 瓦豆鲁迪 (Waddle Dee 经典巡逻)
      { type: 'awoofy', ability: null, z: -12, x: -3 },          // 2. 加鲁鲁菲 (探索发现萌犬野兽)
      { type: 'scarfy', ability: 'fire', z: -16, x: 3 },         // 3. 斯卡菲 (猫耳浮游怪 - 烈火能力)
      { type: 'blade_knight', ability: 'sword', z: -22, x: 2 },  // 4. 利剑骑士 (利剑能力)
      { type: 'hot_head', ability: 'fire', z: -32, x: -5 },      // 5. 火炎怪 (烈火能力)
      { type: 'bronto_burt', ability: null, z: -40, x: 4 },      // 6. 蹦蹦鸟 (高空俯冲轰炸)
      { type: 'chilly', ability: 'ice', z: -50, x: -4 },         // 7. 奇力雪人 (冰冻能力)
      { type: 'gordo', ability: null, z: -60, x: 0 },            // 8. 戈鲁多刺球 (绝对无敌危险铁球)
      { type: 'scarfy', ability: 'fire', z: -68, x: -3 },        // 9. 斯卡菲 (二阶伏击守卫)
      { type: 'sir_kibble', ability: 'sword', z: -76, x: 5 },    // 10. 回旋镖骑士 (回旋切割刃)
      { type: 'minion', ability: null, z: -84, x: -2 },         // 瓦豆鲁迪 (Waddle Dee)
      { type: 'awoofy', ability: null, z: -92, x: -4 },
      { type: 'blade_knight', ability: 'sword', z: -100, x: 3 },
      { type: 'gordo', ability: null, z: -108, x: -2 }
    ];

    specs.forEach(s => {
      const e = KirbyEntities.createEnemy(s.type, s.ability, s.x, 0.8, s.z);
      enemies.push(e);
      scene.add(e.mesh);
    });
  }

  // ---------------- 跳跃与膨胀滑翔 (Puff Glide) ----------------
  function performJump() {
    if (!player || player.isDown) return;
    const isPinkKirby = characterKey === 'pink';

    if (player.grounded) {
      player.vy = 8.5;
      player.grounded = false;
      player.jumpCount = 1;
      KirbyAudio.jump();
      if (playerModel && playerModel.triggerJumpStretch) {
        playerModel.triggerJumpStretch();
      }
    } else if (isPinkKirby && player.jumpCount < 5) {
      // 经典粉卡比专属多段膨胀滞空跳跃
      player.vy = 6.2;
      player.jumpCount++;
      player.floating = true;
      KirbyAudio.puff();
      if (playerModel && playerModel.triggerJumpStretch) {
        playerModel.triggerJumpStretch();
      }
    }
  }

  // ---------------- 贴地滑铲 (Slide Dash) ----------------
  function performSlideDash() {
    if (!player || player.isDown || !player.grounded || player.isSliding) return;
    player.isSliding = true;
    player.slideTimer = 0.42;

    const fwd = getForwardVector();
    player.vx = fwd.x * 20.0;
    player.vz = fwd.z * 20.0;
    KirbyAudio.jump();

    const dust = KirbyEntities.createSlideDust(player.x, player.y, player.z);
    slashes.push(dust);
    scene.add(dust.mesh);

    damageNearbyEnemies(3.6, 5);
    damageNearbyCages(3.6, 2);
    showToast('💨 贴地滑铲突进！击飞阻挡！');
  }

  // ---------------- 空中吐气空气弹 (Aerial Air Puff & Drop) ----------------
  function performAerialAirPuff() {
    if (!player || player.isDown) return;
    KirbyAudio.puff();
    player.floating = false;
    player.vy = -16.0;

    const puff = KirbyEntities.createAirPuffMesh(player.x, player.y, player.z, player.yaw);
    projectiles.push(puff);
    scene.add(puff.mesh);
    showToast('💨 空中喷射空气弹！极速下落！');
  }

  // ---------------- 角色专属技能释放 (梦幻四天王 & 经典四色) ----------------
  function triggerCharacterSkill() {
    if (!player || player.isDown || skillCooldownTimer > 0) return;
    const char = KirbyEntities.CHARACTERS[characterKey] || KirbyEntities.CHARACTERS.pink;

    if (characterKey === 'pink') {
      // 星之卡比：星光膨胀滑翔加速
      player.vy = 7.0;
      player.floating = true;
      KirbyAudio.puff();
      showToast('🌸 释放专属技能：【星光膨胀滑翔】！');
    } else if (characterKey === 'meta') {
      // 魅塔骑士：玛赫龙卷风 (Mach Tornado)
      KirbyAudio.machTornado();
      const slash = KirbyEntities.createSlashWaveMesh(player.x, player.y, player.z, 0, 2.6, 0x1a237e);
      slashes.push(slash);
      scene.add(slash.mesh);
      damageNearbyEnemies(8.5, 14);
      damageNearbyCages(8.5, 3);
      showToast('🌪️ 魅塔骑士释放【玛赫龙卷风】！剑刃飓风绞杀四方敌人！');
    } else if (characterKey === 'dedede') {
      // 帝帝帝大王：喷射大锤跃击 (Jet Hammer)
      KirbyAudio.hammerSlam();
      player.vy = 13.0;
      player.grounded = false;
      setTimeout(() => {
        if (player && !player.isDown) {
          player.vy = -30.0;
          const slam = KirbyEntities.createHammerSlamMesh(player.x, player.y, player.z, player.yaw);
          slashes.push(slam);
          scene.add(slam.mesh);
          damageNearbyEnemies(9.0, 18);
          damageNearbyCages(9.0, 3);
        }
      }, 240);
      showToast('🔨 帝帝帝大王启动推进器！【喷射大锤跃击】引发地裂震撼！');
    } else if (characterKey === 'bandana') {
      // 头巾瓦豆鲁迪：连环枪雨 (Spear Rain)
      KirbyAudio.spearRain();
      damageNearbyEnemies(7.5, 12);
      damageNearbyCages(7.5, 3);
      for (let i = -1; i <= 1; i++) {
        const p = KirbyEntities.createSodaCanProjectile(player.x, player.y, player.z, player.yaw + i * 0.2);
        projectiles.push(p);
        scene.add(p.mesh);
      }
      showToast('🔱 头巾瓦豆鲁迪施展【连环枪雨】！锋芒残影神枪破甲！');
    } else if (characterKey === 'yellow') {
      // 炽焰黄卡比：烈焰突刺冲锋
      const forwardDir = getForwardVector();
      player.vx = forwardDir.x * 22;
      player.vz = forwardDir.z * 22;
      KirbyAudio.fire();
      showToast('🔥 释放专属技能：【烈焰突刺冲锋】！贯穿前方敌人！');
      damageNearbyEnemies(4.5, 6);
    } else if (characterKey === 'blue') {
      // 碧海蓝卡比：蔚蓝星盾 (4 秒无敌护盾)
      shieldActiveTimer = 4.0;
      if (playerModel.shieldMesh) playerModel.shieldMesh.material.opacity = 0.85;
      KirbyAudio.skill();
      showToast('🛡️ 释放专属技能：【蔚蓝星盾】！4秒内完全免疫伤害！');
    } else if (characterKey === 'green') {
      // 翠影绿卡比：愈合之环 (恢复 3 HP)
      player.hp = Math.min(player.maxHp, player.hp + 3);
      KirbyAudio.heart();
      showToast('🌿 释放专属技能：【愈合之环】！恢复了 3 点生命值！');
      updateHUD();
    }

    skillCooldownTimer = char.cooldown;
  }

  // ---------------- 塞满嘴道具吸入交互 (探索发现 四大形态) ----------------
  function tryInhaleProp() {
    if (!player || player.isDown) return false;
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (!p.active) continue;
      const dist = Math.hypot(p.x - player.x, p.z - player.z);
      if (dist < 3.2) {
        if (player.mouthfulMode) {
          showToast('⚠️ 已处于塞满嘴形态，请按 Q 吐出后再变形！');
          return true;
        }
        p.active = false;
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        player.mouthfulMode = p.type;
        playerModel.setMouthful(p.type);
        KirbyAudio.mouthfulInhale();

        if (p.type === 'car') {
          showToast('🚗【汽车塞满嘴】变身成功！移速飙升，按【攻/右键】释放涡轮爆冲破甲碾压！');
        } else if (p.type === 'cone') {
          showToast('⚠️【三角锥塞满嘴】变身成功！在空中按【攻/右键】触发泰山千斤顶砸穿地面！');
        } else if (p.type === 'vending') {
          showToast('🥤【自动贩卖机塞满嘴】变身成功！按【攻/右键】发射易拉罐加特林超速连射！');
        } else if (p.type === 'ring') {
          showToast('🌀【圈圈塞满嘴】变身成功！按【攻/右键】释放狂暴飓风强风波！');
        }
        updateHUD();
        return true;
      }
    }
    return false;
  }

  // ---------------- 吐出并解除塞满嘴形态 ----------------
  function discardMouthful() {
    if (!player || !player.mouthfulMode) return;
    const oldType = player.mouthfulMode;
    player.mouthfulMode = null;
    player.isSlamming = false;
    isTurbo = false;
    playerModel.setMouthful(null);
    KirbyAudio.discard();

    // 在卡比前方吐出对应道具
    const fwd = getForwardVector();
    if (oldType === 'car') {
      const np = KirbyEntities.createCarProp(player.x + fwd.x * 3.2, player.y, player.z + fwd.z * 3.2);
      props.push(np);
      scene.add(np.mesh);
    } else if (oldType === 'cone') {
      const np = KirbyEntities.createConeProp(player.x + fwd.x * 2.5, player.y, player.z + fwd.z * 2.5);
      props.push(np);
      scene.add(np.mesh);
    } else if (oldType === 'vending') {
      const np = KirbyEntities.createVendingProp(player.x + fwd.x * 2.5, player.y, player.z + fwd.z * 2.5);
      props.push(np);
      scene.add(np.mesh);
    } else if (oldType === 'ring') {
      const np = KirbyEntities.createRingProp(player.x + fwd.x * 2.5, player.y, player.z + fwd.z * 2.5);
      props.push(np);
      scene.add(np.mesh);
    }

    showToast('✨ 已吐出塞满嘴物体，恢复圆滚滚常态！');
    updateHUD();
  }

  // ---------------- 汽车塞满嘴涡轮爆冲 ----------------
  function triggerCarTurbo() {
    if (isTurbo) return;
    isTurbo = true;
    KirbyAudio.carTurbo();
    showToast('🔥 全油门极速涡轮爆冲！破甲碾压！');

    const fwd = getForwardVector();
    player.vx = fwd.x * 26.0;
    player.vz = fwd.z * 26.0;

    damageNearbyEnemies(5.5, 8);
    damageNearbyCages(5.5, 2);

    setTimeout(() => {
      isTurbo = false;
    }, 850);
  }

  // ---------------- 三角锥千斤顶暴砸 (Ground Pound) ----------------
  function triggerConeSlam() {
    if (player.grounded) {
      player.vy = 10.0;
      player.grounded = false;
    }
    player.isSlamming = true;
    player.vy = -32.0;
    showToast('⬇️ 三角锥极速千斤顶下砸！');
  }

  // ---------------- 自动贩卖机易拉罐加特林 (Can Gatling) ----------------
  function triggerVendingGatling() {
    KirbyAudio.vendingShoot();
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!player) return;
        const can = KirbyEntities.createSodaCanProjectile(player.x, player.y, player.z, player.yaw + (Math.random() - 0.5) * 0.15);
        projectiles.push(can);
        scene.add(can.mesh);
      }, i * 90);
    }
    damageNearbyEnemies(9.0, 7);
    damageNearbyCages(9.0, 2);
    showToast('🥤 易拉罐加特林机关枪狂暴扫射！');
  }

  // ---------------- 圈圈塞满嘴飓风强风波 (Hurricane Blast) ----------------
  function triggerRingWindBlast() {
    KirbyAudio.windBlast();
    const wind = KirbyEntities.createWindBlastMesh(player.x, player.y, player.z, player.yaw);
    slashes.push(wind);
    scene.add(wind.mesh);
    damageNearbyEnemies(10.0, 9);
    damageNearbyCages(10.0, 2);
    showToast('🌀 强风呼啸飓风冲击波！吹散阻碍！');
  }

  // ---------------- 完美闪避 (魔女时间慢动作特写与反击) ----------------
  function performDodgeRoll() {
    if (!player || player.isDown || player.isDodging) return;
    player.isDodging = true;
    player.dodgeTimer = 0.38;

    const fwd = getForwardVector();
    player.dodgeVx = fwd.x * 15.0;
    player.dodgeVz = fwd.z * 15.0;
    KirbyAudio.jump();

    // 判定是否在敌方攻击范围内触发完美闪避
    let closeEnemy = false;
    enemies.forEach(e => {
      if (!e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 3.2) {
        closeEnemy = true;
      }
    });
    if (boss && !boss.dead && Math.hypot(boss.mesh.position.x - player.x, boss.mesh.position.z - player.z) < 9.0) {
      closeEnemy = true;
    }
    if (whispy && !whispy.dead && Math.hypot(whispy.mesh.position.x - player.x, whispy.mesh.position.z - player.z) < 9.0) {
      closeEnemy = true;
    }

    if (closeEnemy) {
      perfectDodgeTimer = 0.85;
      KirbyAudio.perfectDodge();
      const fx = document.getElementById('witch-time-fx');
      if (fx) {
        fx.classList.add('active');
        setTimeout(() => fx.classList.remove('active'), 850);
      }
      showToast('✨ 触发完美闪避！时间减速，点击【攻】发动瞬星反击！');
    }
  }

  // ---------------- 《豪华版》超级能力爆发三大形态 ----------------
  function triggerSuperAbility() {
    if (superActiveTimer > 0) return;
    if (superGauge < 100) {
      showToast('⚡ 超级能量不足！击败怪物或收集星星可充满能量！');
      return;
    }
    superGauge = 0;
    superAbilityType = (superAbilityType % 3) + 1;

    if (superAbilityType === 1) {
      // 1. 超级大剑 (Ultra Sword)
      superActiveTimer = 16.0;
      playerModel.setSuperSword(true);
      KirbyAudio.superSword();
      showToast('🗡️【超级大剑 (Ultra Sword)】斩断时空！7米黄金星光巨刃降临！');
    } else if (superAbilityType === 2) {
      // 2. 超级怪兽烈焰 (Monster Flame)
      KirbyAudio.monsterFlame();
      const dragon = KirbyEntities.createMonsterFlameMesh(player.x, player.y, player.z, player.yaw);
      slashes.push(dragon);
      scene.add(dragon.mesh);
      damageNearbyEnemies(14.0, 26);
      damageNearbyCages(14.0, 3);
      showToast('🐉【怪兽烈焰 (Monster Flame)】赤炎神龙飞掠全屏！万物化为灰烬！');
    } else {
      // 3. 超级全垒打木槌 (Grand Hammer)
      KirbyAudio.hammerSlam();
      const hammerVfx = KirbyEntities.createHammerSlamMesh(player.x, player.y, player.z, player.yaw);
      slashes.push(hammerVfx);
      scene.add(hammerVfx.mesh);
      damageNearbyEnemies(13.0, 30);
      damageNearbyCages(13.0, 3);
      showToast('🔨【全垒打木槌 (Grand Hammer)】十米撼天重槌！砸裂地层！');
    }
    updateHUD();
  }

  // ---------------- 能力多阶进化工坊 ----------------
  function evolveCurrentAbility() {
    if (!player || !player.ability) {
      showToast('当前没有复制能力，无法进化');
      return;
    }
    const ab = KirbyEntities.ABILITIES[player.ability];
    if (!ab.levels || ab.levels.length <= 1) {
      showToast(`「${ab.name}」已是最高形态！`);
      return;
    }
    const nextLv = (player.abilityLevel % ab.levels.length) + 1;
    player.abilityLevel = nextLv;
    const lvCfg = ab.levels[nextLv - 1];
    KirbyEntities.attachAbilityHat(playerModel.hatHolder, player.ability, player.abilityLevel);
    KirbyAudio.victory();
    showToast(`🌟 武器进化工坊：觉醒【${lvCfg.name}】(Lv.${nextLv})！${lvCfg.desc}`);
    updateHUD();
  }

  // ---------------- 瓦豆鲁迪牢笼破损判定 ----------------
  function damageNearbyCages(range, dmg) {
    cages.forEach(c => {
      if (c.saved) return;
      const dist = Math.hypot(c.x - player.x, c.z - player.z);
      if (dist <= range) {
        c.hit(dmg);
        if (c.saved) {
          savedWaddleDees++;
          KirbyAudio.waddleDeeCheer();
          showToast(`🎉 成功救出被困的瓦豆鲁迪 (${savedWaddleDees}/3)！`);
          updateHUD();
        }
      }
    });
  }

  // ---------------- 舍弃当前能力 (子棍 6: 核心规则) ----------------
  function discardAbility() {
    if (!player) return;
    if (!player.ability) {
      showToast('当前没有复制能力可舍弃');
      return;
    }
    const oldAb = KirbyEntities.ABILITIES[player.ability].name;
    player.ability = null;
    player.abilityLevel = 1;
    KirbyEntities.attachAbilityHat(playerModel.hatHolder, null);
    KirbyAudio.discard();

    // 掉落并弹射出舍弃的星星特效
    const star = KirbyEntities.createHeadStar(player.x, player.y + 1, player.z - 1);
    headStars.push(star);
    scene.add(star.mesh);

    showToast(`🌟 已主动舍弃「${oldAb}」能力！现在可以重新收服新能力！`);
    updateHUD();
  }

  // ---------------- 爱心收服 / 吞下敌对生物 (子棍 6) ----------------
  function triggerCollectOrInhale() {
    if (!player || player.isDown) return;

    // 【严格规则检验】：若已有能力，必须先主动舍弃，禁止直接替换！
    if (player.ability) {
      KirbyAudio.hit();
      showToast(`⚠️ 已有「${KirbyEntities.ABILITIES[player.ability].name}」能力！请按 Q 或点击【舍弃】主动舍弃后再吸入新怪物！`);
      return;
    }

    const vortex = document.getElementById('inhale-vortex');
    if (vortex) {
      vortex.classList.add('show');
      setTimeout(() => vortex.classList.remove('show'), 600);
    }

    // 1. 优先吸入正前方近战范围内的怪物 (近身强力大口吸入，经典卡比手感)
    let closeTarget = null;
    let minD = 4.8;
    for (const e of enemies) {
      if (e.dead || e.isInvincible) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < minD) {
        const ang = Math.atan2(dx, dz);
        let diff = Math.abs(ang - player.yaw);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 1.15) {
          minD = d;
          closeTarget = e;
        }
      }
    }

    if (closeTarget) {
      if (closeTarget.type === 'sandbag') {
        if (closeTarget.mesh.userData && closeTarget.mesh.userData.onHit) {
          closeTarget.mesh.userData.onHit(0, 0.5);
        }
        KirbyAudio.hit();
        showToast('🏋️【沙袋先生】太重了吸不动！受力剧烈弹力晃动中！');
        return;
      }
      if (closeTarget.type === 'scarfy') {
        KirbyAudio.hit();
        showToast('💢【斯卡菲】受到惊吓变脸暴走！无法吸入！');
        return;
      }

      if (closeTarget.ability) {
        player.ability = closeTarget.ability;
        player.abilityLevel = 1;
        KirbyEntities.attachAbilityHat(playerModel.hatHolder, closeTarget.ability, 1);
        KirbyAudio.swallow();
        showToast(`💖 大口吸入！卡比吞下了【${closeTarget.name}】，获得了「${KirbyEntities.ABILITIES[closeTarget.ability].name}」复制能力！`);
        killEnemy(closeTarget, true);
        if (mode === 'online') {
          KirbyMultiplayer.onHostCapturedAbility(closeTarget.ability);
        }
        updateHUD();
      } else {
        KirbyAudio.swallow();
        showToast(`💖 大口吸入！卡比吸入并吞下了【${closeTarget.name}】！`);
        killEnemy(closeTarget, true);
      }
      return;
    }

    // 2. 若前方没有贴身敌人，则发射远距离爱心收服光波
    KirbyAudio.heart();
    const heart = KirbyEntities.createHeartProjectile(player.x, player.y, player.z, player.yaw);
    projectiles.push(heart);
    scene.add(heart.mesh);
  }

  // ---------------- 攻击触发 (普通攻击 / 塞满嘴 / 超级大招 / 元素能力攻击) ----------------
  function triggerAttack() {
    if (!player || player.isDown) return;

    // 0. 浮空状态下按攻击键触发空中吐气空气弹并极速下落
    if (player.floating) {
      performAerialAirPuff();
      return;
    }

    // 1. 塞满嘴形态专属攻击判定
    if (player.mouthfulMode === 'car') {
      triggerCarTurbo();
      return;
    }
    if (player.mouthfulMode === 'cone') {
      if (!player.grounded) {
        triggerConeSlam();
      } else {
        performJump();
        setTimeout(() => triggerConeSlam(), 140);
      }
      return;
    }
    if (player.mouthfulMode === 'vending') {
      triggerVendingGatling();
      return;
    }
    if (player.mouthfulMode === 'ring') {
      triggerRingWindBlast();
      return;
    }

    // 2. 《豪华版》超级大剑 (Ultra Sword) 毁灭横扫
    if (superActiveTimer > 0) {
      KirbyAudio.superSword();
      const slash = KirbyEntities.createSlashWaveMesh(player.x, player.y, player.z, player.yaw, 3.8, 0xffeb3b);
      slashes.push(slash);
      scene.add(slash.mesh);
      damageNearbyEnemies(8.5, 18);
      damageNearbyCages(8.5, 3);
      showToast('💥 超级剑·天崩地裂横扫！全屏破敌！');
      return;
    }

    // 3. 常规与多阶进化能力攻击
    if (!player.ability) {
      KirbyAudio.attack();
      damageNearbyEnemies(3.2, 2);
      damageNearbyCages(3.2, 1);
      showToast('💫 卡比旋转回旋击！');
    } else {
      const ab = player.ability;
      if (ab === 'sword') {
        KirbyAudio.swordSlash();
        const slash = KirbyEntities.createSlashWaveMesh(
          player.x, player.y, player.z, player.yaw,
          1.2 * player.abilityLevel,
          player.abilityLevel === 3 ? 0xd81b60 : 0x81c784
        );
        slashes.push(slash);
        scene.add(slash.mesh);

        const dmg = player.abilityLevel === 1 ? 4 : (player.abilityLevel === 2 ? 7 : 11);
        damageNearbyEnemies(5.0 + player.abilityLevel * 0.8, dmg);
        damageNearbyCages(5.0, dmg);

        if (player.abilityLevel === 3) {
          player.hp = Math.min(player.maxHp, player.hp + 1);
          updateHUD();
          showToast('🦋 摩弗之剑·冥蝶斩击！吸血恢复生命 HP +1！');
        } else if (player.abilityLevel === 2) {
          showToast('🛡️ 庞大剑·重装破甲巨力斩！');
        } else {
          showToast('⚔️ 经典利剑三连斩！');
        }
      } else if (ab === 'fire') {
        const dmg = player.abilityLevel === 1 ? 4 : (player.abilityLevel === 2 ? 7 : 11);
        KirbyAudio.fire();
        damageNearbyEnemies(6.0, dmg);
        damageNearbyCages(6.0, dmg);
        if (player.abilityLevel === 3) {
          showToast('🐉 龙之火·紫炎神龙激光烈焰！');
        } else if (player.abilityLevel === 2) {
          showToast('🌋 火山火·熔岩爆石持续轰炸！');
        } else {
          showToast('🔥 喷射狂暴烈焰吐息！');
        }
      } else if (ab === 'ice') {
        KirbyAudio.ice();
        freezeNearbyEnemies(5.5, 3 + player.abilityLevel * 2);
        damageNearbyCages(5.5, 2);
        showToast('❄️ 呼啸极寒冰霜！冰冻敌人！');
      } else if (ab === 'spark') {
        KirbyAudio.spark();
        damageNearbyEnemies(5.0, 4);
        damageNearbyCages(5.0, 2);
        showToast('⚡ 360° 环状电光雷暴！');
      } else if (ab === 'water') {
        KirbyAudio.water();
        damageNearbyEnemies(5.5, 3);
        damageNearbyCages(5.5, 2);
        showToast('💧 澎湃狂涌水龙卷！');
      } else if (ab === 'shadow') {
        KirbyAudio.shadow();
        damageNearbyEnemies(6.5, 5);
        damageNearbyCages(6.5, 2);
        showToast('🔮 斩出虚空暗影飞刃！');
      }
    }
  }

  function damageNearbyEnemies(range, dmg) {
    if (attackBoostTimer > 0) {
      dmg = Math.round(dmg * 1.5);
    }
    enemies.forEach(e => {
      if (e.dead || e.isInvincible) return;
      const dist = Math.hypot(e.x - player.x, e.z - player.z);
      if (dist <= range) {
        if (e.type === 'sandbag') {
          if (e.mesh.userData && e.mesh.userData.onHit) {
            e.mesh.userData.onHit(0, 0.45);
          }
          KirbyAudio.hit();
          e.hp = e.maxHp;
          return;
        }
        e.hp -= dmg;
        KirbyAudio.hit();
        if (e.hp <= 0) {
          killEnemy(e);
        }
      }
    });

    // 对常驻 Boss 风语大树造成伤害
    if (whispy && !whispy.dead) {
      const distToWhispy = Math.hypot(whispy.mesh.position.x - player.x, whispy.mesh.position.z - player.z);
      if (distToWhispy <= range + 3.8) {
        whispy.takeDamage(dmg);
        updateHUD();
        if (whispy.dead) {
          const star = KirbyEntities.createHeadStar(whispy.mesh.position.x, 2, whispy.mesh.position.z);
          star.mesh.scale.set(2, 2, 2);
          headStars.push(star);
          scene.add(star.mesh);
          showToast('🌳 成功击败经典常驻 Boss【风语大树 (Whispy Woods)】！掉落大星徽！');
        }
      }
    }

    // 对最终 Boss 梦魇帝王造成伤害
    if (boss && !boss.dead) {
      const distToBoss = Math.hypot(boss.mesh.position.x - player.x, boss.mesh.position.z - player.z);
      if (distToBoss <= range + 3.0) {
        boss.hp -= dmg;
        KirbyAudio.hit();
        updateHUD();
        if (boss.hp <= 0) {
          defeatBoss();
        }
      }
    }
  }

  function freezeNearbyEnemies(range, dmg) {
    enemies.forEach(e => {
      if (e.dead || e.isInvincible) return;
      const dist = Math.hypot(e.x - player.x, e.z - player.z);
      if (dist <= range) {
        if (e.type === 'sandbag') {
          if (e.mesh.userData && e.mesh.userData.onHit) {
            e.mesh.userData.onHit(0, 0.35);
          }
          KirbyAudio.ice();
          e.hp = e.maxHp;
          return;
        }
        e.hp -= dmg;
        e.frozenTime = 2.5; // 冻结 2.5 秒
        KirbyAudio.ice();
        if (e.hp <= 0) {
          killEnemy(e);
        }
      }
    });
  }

  function killEnemy(e, swallowedDirectly = false) {
    if (!e || e.isInvincible || e.type === 'sandbag') return;
    e.dead = true;
    if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
    quest.currentKills++;

    // 击败敌人为超级能力充能 +25% (豪华版)
    superGauge = Math.min(100, superGauge + 25);

    // 若敌人携带复制能力且不是直接吸入吞下，当卡比当前无能力时，怪物死后弹落出能力之星！
    if (!swallowedDirectly && e.ability && e.type !== 'ability') {
      const drop = KirbyEntities.createEnemy('ability', e.ability, e.x, 0.8, e.z);
      enemies.push(drop);
      scene.add(drop.mesh);
      showToast(`⭐【${e.name}】倒下并掉落了「${KirbyEntities.ABILITIES[e.ability].name}」能力之星！走近或按吸入即可获得！`);
    }

    // 掉落 3D 头部星星
    const star = KirbyEntities.createHeadStar(e.x, e.y, e.z);
    headStars.push(star);
    scene.add(star.mesh);
    if (!swallowedDirectly) {
      showToast(`敌方【${e.name}】倒下！超级大招能量 +25%！`);
    }

    // 无尽模式阶段目标判断
    if (mode === 'endless' && quest.currentKills >= quest.targetKills) {
      quest.stage++;
      quest.targetKills += 3;
      KirbyAudio.victory();
      KirbyStore.recordEndlessStage(quest.stage, quest.currentKills);
      showToast(`🎉 完成无尽阶段 ${quest.stage - 1} 目标！迈向阶段 ${quest.stage}！`);
    }
    updateHUD();
  }

  function defeatBoss() {
    boss.dead = true;
    boss.hp = 0;
    if (boss.mesh.parent) boss.mesh.parent.remove(boss.mesh);
    KirbyAudio.victory();
    KirbyStore.recordBossDefeat();

    // 掉落特大号金色通关星徽
    const bigStar = KirbyEntities.createHeadStar(boss.mesh.position.x, 2, boss.mesh.position.z);
    bigStar.mesh.scale.set(2.5, 2.5, 2.5);
    headStars.push(bigStar);
    scene.add(bigStar.mesh);

    showModal('🏆 终极胜利！', '你成功击败了高难度最终 Boss【星核霸王·梦魇帝王】！守护了这片星系！', () => {
      window.MSV_SHOWCASE_RELOAD();
    });
  }

  // ---------------- 物理运动、碰撞与半透地面穿透 (子棍 3 & 4) ----------------
  function updatePhysics(dt) {
    if (!player || player.isDown) return;

    // 完美闪避慢动作计时 (魔女时间)
    if (perfectDodgeTimer > 0) {
      perfectDodgeTimer -= dt;
      dt *= 0.25; // 全局物理时间变慢 4 倍！
    }

    // 《豪华版》超级大剑计时
    if (superActiveTimer > 0) {
      superActiveTimer -= dt;
      if (superActiveTimer <= 0) {
        playerModel.setSuperSword(false);
        showToast('🌟 超级大剑时间结束，恢复常态！');
        updateHUD();
      }
    }

    // 闪避翻滚状态位
    if (player.isDodging) {
      player.dodgeTimer -= dt;
      player.vx = player.dodgeVx;
      player.vz = player.dodgeVz;
      if (player.dodgeTimer <= 0) {
        player.isDodging = false;
      }
    }

    // 1. 获取相机坐标系下的移动基底向量 (标准 3D 视角基准)
    const camFwd = {
      x: -Math.sin(cameraYaw),
      z: -Math.cos(cameraYaw)
    };
    const camRight = {
      x: Math.cos(cameraYaw),
      z: -Math.sin(cameraYaw)
    };

    // 2. 收集各端输入 (键盘 + 手机 360° 摇杆)
    let inputX = 0;
    let inputZ = 0; // +1 为向前，-1 为向后

    if (keys.w || keys.arrowup) inputZ += 1;
    if (keys.s || keys.arrowdown) inputZ -= 1;
    if (keys.d || keys.arrowright) inputX += 1;
    if (keys.a || keys.arrowleft) inputX -= 1;

    // 手机 360° 虚拟摇杆输入 (joyY 为负数时代表向上推)
    const joyMag = Math.hypot(touchState.joyX, touchState.joyY);
    if (joyMag > 0.1) {
      inputX = touchState.joyX;
      inputZ = -touchState.joyY;
    }

    const isCrouching = keys.shift || touchState.crouch;
    player.crouching = isCrouching;

    const inputMag = Math.hypot(inputX, inputZ);
    let isMoving = false;

    if (!player.isDodging) {
      if (inputMag > 0.1) {
        isMoving = true;
        const clampedMag = Math.min(1.0, inputMag);
        const normX = inputX / inputMag;
        const normZ = inputZ / inputMag;

        // 投影至世界坐标系 (屏幕视角向前 = camFwd，屏幕视角向右 = camRight)
        const moveWorldX = normZ * camFwd.x + normX * camRight.x;
        const moveWorldZ = normZ * camFwd.z + normX * camRight.z;

        let baseSpeed = isCrouching ? 3.0 : 7.2;
        if (player.mouthfulMode === 'car') {
          baseSpeed = isTurbo ? 28.0 : (isCrouching ? 6.0 : 16.5);
        }

        player.vx = moveWorldX * baseSpeed * clampedMag;
        player.vz = moveWorldZ * baseSpeed * clampedMag;

        const targetYaw = Math.atan2(moveWorldX, -moveWorldZ);
        player.yaw = lerpAngle(player.yaw, targetYaw, dt * 14.0);
      } else {
        player.vx *= Math.pow(0.05, dt * 6.0);
        player.vz *= Math.pow(0.05, dt * 6.0);
        if (Math.abs(player.vx) < 0.05) player.vx = 0;
        if (Math.abs(player.vz) < 0.05) player.vz = 0;
      }
    }

    // 汽车塞满嘴行驶碾压判定
    if (player.mouthfulMode === 'car' && (isMoving || isTurbo)) {
      enemies.forEach(e => {
        if (!e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 2.2) {
          if (e.type === 'sandbag') {
            if (e.mesh.userData && e.mesh.userData.onHit) {
              e.mesh.userData.onHit(0, 0.6);
            }
            KirbyAudio.hit();
            return;
          }
          e.hp -= (isTurbo ? 10 : 4);
          KirbyAudio.hit();
          if (e.hp <= 0) killEnemy(e);
        }
      });
      damageNearbyCages(2.5, isTurbo ? 2 : 1);
    }

    // 3. 重力与下落 (三角锥千斤顶下砸高速坠落)
    let gravity = player.floating ? 6.0 : 20.0;
    if (player.mouthfulMode === 'cone' && player.isSlamming) {
      player.vy = -34.0;
    } else {
      player.vy -= gravity * dt;
    }

    // 计算下一步位置
    let nextX = player.x + player.vx * dt;
    let nextY = player.y + player.vy * dt;
    let nextZ = player.z + player.vz * dt;

    // 4. 边界限制
    const bounds = currentWorld.config.bounds;
    nextX = Math.max(bounds.minX, Math.min(bounds.maxX, nextX));
    nextZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, nextZ));

    // 5. 平台与地面碰撞处理
    let landed = false;
    let groundY = -999;

    if (currentWorld && currentWorld.colliders) {
      for (const col of currentWorld.colliders) {
        if (nextX >= col.minX - 0.4 && nextX <= col.maxX + 0.4 &&
            nextZ >= col.minZ - 0.4 && nextZ <= col.maxZ + 0.4) {
          
          if (col.isPassthrough && isCrouching) {
            continue;
          }

          if (player.y >= col.maxY - 0.25 && nextY <= col.maxY + 0.05) {
            if (col.maxY > groundY) {
              groundY = col.maxY;
              landed = true;
            }
          }
        }
      }
    }

    const wasGrounded = player.grounded;
    if (landed) {
      if (!wasGrounded && playerModel && playerModel.triggerLandingSquash) {
        playerModel.triggerLandingSquash();
      }
      if (player.mouthfulMode === 'cone' && player.isSlamming) {
        player.isSlamming = false;
        KirbyAudio.coneSlam();
        damageNearbyEnemies(6.5, 12);
        damageNearbyCages(6.5, 2);
        showToast('💥 三角锥泰山千斤顶砸地！震碎周围敌人与牢笼！');
      }
      nextY = groundY;
      player.vy = 0;
      player.grounded = true;
      player.floating = false;
      player.jumpCount = 0;
    } else {
      player.grounded = false;
    }

    // 掉出世界虚空保护 -> 回弹到安全地点
    if (nextY < -12) {
      const safe = KirbyStore.getSafePoint(worldKey);
      nextX = safe.x;
      nextY = safe.y + 1;
      nextZ = safe.z;
      player.vy = 0;
      player.hp = Math.max(1, player.hp - 2);
      KirbyAudio.hit();
      showToast('⚠️ 不小心失足跌落！已由星之守护者送回安全地点！');
      updateHUD();
    }

    player.x = nextX;
    player.y = nextY;
    player.z = nextZ;

    // 同步玩家 3D 模型位置与旋转 (含 Switch 原生接触阴影、压扁拉伸与转向倾斜)
    playerModel.mesh.position.set(player.x, player.y, player.z);
    playerModel.mesh.rotation.y = player.yaw + Math.PI;
    const targetBanking = Math.max(-0.25, Math.min(0.25, -player.vx * 0.022));
    playerModel.animate(
      dt,
      isMoving,
      !player.grounded,
      player.floating,
      player.mouthfulMode,
      player.isSlamming,
      isTurbo,
      groundY > -900 ? groundY : 0,
      player.y,
      player.vy,
      targetBanking
    );

    // 冷却计时与咖啡店增益计时递减
    if (skillCooldownTimer > 0) skillCooldownTimer -= dt;
    if (shieldActiveTimer > 0) {
      shieldActiveTimer -= dt;
      if (shieldActiveTimer <= 0 && playerModel.shieldMesh) {
        playerModel.shieldMesh.material.opacity = 0;
      }
    }
    if (attackBoostTimer > 0) {
      attackBoostTimer -= dt;
    }
    if (invincibleTimer > 0) {
      invincibleTimer -= dt;
      const rainbowColors = [0xff1744, 0xffea00, 0x00e676, 0x00e5ff, 0xd500f9];
      playerModel.body.material.color.setHex(rainbowColors[Math.floor(performance.now() / 90) % rainbowColors.length]);
      if (invincibleTimer <= 0) {
        const cfg = KirbyEntities.CHARACTERS[characterKey] || KirbyEntities.CHARACTERS.pink;
        playerModel.body.material.color.setHex(cfg.bodyColor);
        showToast('✨ 无敌糖果效果结束！恢复常态！');
      }
    }
  }

  function getForwardVector() {
    return {
      x: Math.sin(player.yaw),
      z: -Math.cos(player.yaw)
    };
  }

  // ---------------- 第三人称 3D 球坐标相机平滑跟随 ----------------
  function updateCamera(dt) {
    if (!player) return;

    // 球面轨道坐标计算相机世界坐标
    const camX = player.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDist;
    const camY = player.y + 1.2 + Math.sin(cameraPitch) * cameraDist;
    const camZ = player.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDist;

    const targetEye = new THREE.Vector3(camX, camY, camZ);
    const targetLook = new THREE.Vector3(player.x, player.y + 1.1, player.z);

    if (!camInitialized) {
      camera.position.copy(targetEye);
      camInitialized = true;
    } else {
      camera.position.lerp(targetEye, Math.min(1.0, dt * 10.0));
    }
    camera.lookAt(targetLook);
  }

  // ---------------- 飞行物、塞满嘴道具与剑气命中判定 ----------------
  function updateProjectiles(dt) {
    props.forEach(p => p.update(dt));
    cages.forEach(c => c.update(dt));

    slashes.forEach(s => s.update(dt));
    slashes = slashes.filter(s => {
      if (s.life <= 0) {
        if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
        return false;
      }
      return true;
    });

    projectiles.forEach(p => {
      p.update(dt);

      if (p.isAirPuff) {
        enemies.forEach(e => {
          if (e.dead || e.isInvincible) return;
          const dist = Math.hypot(e.x - p.mesh.position.x, e.z - p.mesh.position.z);
          if (dist < 1.5) {
            p.life = 0;
            if (e.type === 'sandbag') {
              if (e.mesh.userData && e.mesh.userData.onHit) {
                e.mesh.userData.onHit(0, 0.45);
              }
              KirbyAudio.hit();
              return;
            }
            e.hp -= (p.damage || 4);
            KirbyAudio.hit();
            if (e.hp <= 0) killEnemy(e);
            showToast('💨 空气弹命中敌人！造成伤害！');
          }
        });
        damageNearbyCages(1.8, 2);
        return;
      }

      // 爱心收服碰撞检测
      enemies.forEach(e => {
        if (e.dead || e.isInvincible) return;
        const dist = Math.hypot(e.x - p.mesh.position.x, e.z - p.mesh.position.z);
        if (dist < 1.6) {
          p.life = 0; // 销毁飞行物
          if (e.ability) {
            // 成功收服并获得能力！
            player.ability = e.ability;
            player.abilityLevel = 1;
            KirbyEntities.attachAbilityHat(playerModel.hatHolder, e.ability, 1);
            KirbyAudio.swallow();
            showToast(`💖 爱心吸入成功！卡比吞下了【${e.name}】，获得了「${KirbyEntities.ABILITIES[e.ability].name}」复制能力！`);
            killEnemy(e, true);

            // 联机广播能力竞争池
            if (mode === 'online') {
              KirbyMultiplayer.onHostCapturedAbility(e.ability);
            }
            updateHUD();
          } else {
            // 普通怪被收服感化
            KirbyAudio.swallow();
            showToast(`💖 成功感化普通怪物伙伴【${e.name}】！`);
            killEnemy(e, true);
          }
        }
      });
    });

    // 清理失效飞行物
    projectiles = projectiles.filter(p => {
      if (p.life <= 0) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  // ---------------- 头部星星收集判定 ----------------
  function updateHeadStars(dt) {
    headStars.forEach(s => {
      s.update(dt);
      if (!s.collected && player) {
        const dist = Math.hypot(s.x - player.x, s.z - player.z);
        if (dist < 1.5) {
          s.collected = true;
          KirbyAudio.star();
          KirbyStore.addHeadStars(1);
          showToast('⭐ 收集到 1 颗金灿灿的头部星星！可用于联机紧急救援！');
          if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
          updateHUD();
        }
      }
    });
    headStars = headStars.filter(s => !s.collected && s.life > 0);
  }

  // ---------------- 敌人对玩家的伤害判定 ----------------
  function checkEnemyCollisions(dt) {
    if (!player || player.isDown) return;

    // 彩虹无敌状态 (触碰敌人直接秒杀，免疫普通伤害；戈鲁多刺球除外)
    if (invincibleTimer > 0) {
      enemies.forEach(e => {
        if (e.dead || e.isInvincible) return;
        const dist = Math.hypot(e.x - player.x, e.z - player.z);
        if (dist < 1.6) {
          KirbyAudio.hit();
          killEnemy(e);
          showToast('⭐ 彩虹无敌冲撞！秒杀敌人！');
        }
      });
      return;
    }

    if (shieldActiveTimer > 0 || player.isDodging) return;

    enemies.forEach(e => {
      if (e.dead) return;
      const dist = Math.hypot(e.x - player.x, e.z - player.z);
      if (e.isInvincible && dist < 1.6) {
        player.hp -= 2;
        KirbyAudio.hit();
        player.vx = (player.x - e.x) * 12;
        player.vz = (player.z - e.z) * 12;
        showToast('⚠️ 触碰了绝对无敌的戈鲁多刺球！生命 -2！快绕开走！');
        updateHUD();
        if (player.hp <= 0) handlePlayerDown();
        return;
      }
      if (dist < 1.4) {
        player.hp -= 1;
        KirbyAudio.hit();
        // 击退
        player.vx = (player.x - e.x) * 6;
        player.vz = (player.z - e.z) * 6;
        showToast('💥 受到攻击！生命 -1');
        updateHUD();

        if (player.hp <= 0) {
          handlePlayerDown();
        }
      }
    });

    // 风语大树 空气弹与落果伤害判断
    if (whispy && !whispy.dead) {
      whispy.puffProjectiles.forEach(p => {
        if (!p.active) return;
        const dist = Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z);
        if (dist < 1.3) {
          p.active = false;
          if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
          player.hp -= 1;
          KirbyAudio.hit();
          showToast('💨 被风语大树吹出的空气炮击中！生命 -1');
          updateHUD();
          if (player.hp <= 0) handlePlayerDown();
        }
      });
      whispy.fallingApples.forEach(a => {
        if (!a.active) return;
        const dist = Math.hypot(a.mesh.position.x - player.x, a.mesh.position.z - player.z);
        if (dist < 1.1 && Math.abs(a.mesh.position.y - player.y) < 1.3) {
          a.active = false;
          if (a.mesh.parent) a.mesh.parent.remove(a.mesh);
          player.hp -= 1;
          KirbyAudio.hit();
          showToast('🍎 被掉落的苹果砸中！生命 -1');
          updateHUD();
          if (player.hp <= 0) handlePlayerDown();
        }
      });
    }

    // Boss 冲击波伤害判断
    if (boss && !boss.dead) {
      boss.shockwaves.forEach(sw => {
        const dist = Math.hypot(boss.mesh.position.x - player.x, boss.mesh.position.z - player.z);
        if (Math.abs(dist - sw.radius) < 0.8 && player.grounded) {
          // 未起跳被冲击波扫到
          player.hp -= 2;
          player.vy = 5;
          KirbyAudio.hit();
          showToast('💥 被 Boss 冲击波击中！按跳跃可躲避冲击波！');
          updateHUD();
          if (player.hp <= 0) handlePlayerDown();
        }
      });
    }
  }

  // ---------------- 玩家倒地与救援流程 (子棍 8 & 11) ----------------
  function handlePlayerDown() {
    player.hp = 0;
    player.isDown = true;
    KirbyAudio.defeat();

    if (mode === 'online') {
      // 联机状态
      KirbyMultiplayer.updatePlayerHp(1, 0); // 1 号主玩家倒地
      showToast('🚨 1号主玩家倒地！只有 10 秒紧急救援时间！');
      KirbyAudio.siren();
    } else {
      // 单机与无尽状态
      showModal('😭 你倒下了', '生命耗尽，星之卡比闭上了双眼... 是否从安全地点重新探索？', () => {
        const safe = KirbyStore.getSafePoint(worldKey);
        player.x = safe.x;
        player.y = safe.y;
        player.z = safe.z;
        player.hp = player.maxHp;
        player.isDown = false;
        hideModal();
        updateHUD();
      });
    }
  }

  // ---------------- 游戏主循环 ----------------
  let lastTime = performance.now();
  function gameLoop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!paused) {
      updatePhysics(dt);
      updateCamera(dt);
      updateProjectiles(dt);
      updateHeadStars(dt);
      checkEnemyCollisions(dt);

      // 敌人 AI 巡逻与追踪更新
      enemies.forEach(e => e.update(dt, player));

      // 向导卡比 3D 浮空伴随与智能动态指引
      if (guideKirby && player) {
        guideKirby.update(dt, player.x, player.y, player.z, player.yaw);
        updateGuideCompanionAI(dt);
      }

      // 常驻 Boss 风语大树更新
      if (whispy) {
        whispy.update(dt, player);
      }

      // 世界动态自然微风摇曳与微粒氛围系统更新 (Forgotten Land Wind Sway)
      if (currentWorld && currentWorld.update) {
        currentWorld.update(dt);
      }

      // Boss 更新 (最终 Boss: 梦魇帝王)
      if (boss) {
        boss.update(dt, player, (mx, mz) => {
          const add = KirbyEntities.createEnemy('awoofy', null, mx, 0.8, mz);
          enemies.push(add);
          scene.add(add.mesh);
        });
      }

      // 联机计时器与救援倒计时更新
      if (mode === 'online') {
        KirbyMultiplayer.update(dt,
          // 主玩家 10s 未被救活 -> 游戏结束
          () => {
            showModal('☠️ 救援失败，联机崩溃！', '1 号主玩家在 10 秒内未获得头部星星救活，联机房间溃散！', () => {
              KirbyMultiplayer.disconnect();
              window.MSV_SHOWCASE_RELOAD();
            });
          },
          // 普通队友 5min 未被救活 -> 该队友消失，整局继续
          (peer) => {
            showToast(`🕊️ 战友【${peer.name}】倒地超 5 分钟未获救援，已自动退出房间。`);
          }
        );
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
  }

  // ---------------- 向导卡比 (Guide Kirby) 智能情境提示逻辑 ----------------
  function updateGuideCompanionAI(dt) {
    guideAdviceTimer -= dt;
    if (guideAdviceTimer > 0) return;
    guideAdviceTimer = 3.6; // 每 3.6 秒评估一次周围环境

    let advice = '';

    // 1. 低血量危机
    if (player.hp <= 3) {
      advice = '⚠️ 危险波约！卡比生命值偏低，快打开小镇咖啡店吃个全回复M番茄或喝活力药水！';
    }
    // 2. 超级能量蓄满
    else if (superGauge >= 100 && superActiveTimer <= 0) {
      advice = '⚡ 超级能量已蓄满波约！按 [X] 键释放毁天灭地的超级大剑/怪兽烈焰！';
    }
    // 3. 靠近塞满嘴载具/道具
    else {
      let nearProp = null;
      for (const p of props) {
        if (p.active && Math.hypot(p.x - player.x, p.z - player.z) < 5.0) {
          nearProp = p;
          break;
        }
      }
      if (nearProp && !player.mouthfulMode) {
        if (nearProp.type === 'car') advice = '🚗 发现小汽车！靠近按【左键/攻/吸入】塞满嘴，按右键极速涡轮爆冲碾压！';
        else if (nearProp.type === 'cone') advice = '⚠️ 发现三角锥！靠近吸入塞满嘴，在空中按右键可极速泰山千斤顶下砸！';
        else if (nearProp.type === 'vending') advice = '🥤 发现自动贩卖机！靠近吸入塞满嘴，按右键能像加特林机关枪狂射易拉罐！';
        else if (nearProp.type === 'ring') advice = '🌀 发现金色圆环！靠近吸入塞满嘴，按右键呼啸喷吐狂暴飓风强风波！';
      }
      // 4. 靠近被困瓦豆鲁迪牢笼
      if (!advice) {
        for (const c of cages) {
          if (!c.saved && Math.hypot(c.x - player.x, c.z - player.z) < 7.0) {
            advice = '🏠 发现被困的瓦豆鲁迪！用普通攻击或塞满嘴撞击击碎铁笼救出他们吧波约！';
            break;
          }
        }
      }
      // 5. 靠近无敌刺球 Gordo
      if (!advice) {
        for (const e of enemies) {
          if (!e.dead && e.isInvincible && Math.hypot(e.x - player.x, e.z - player.z) < 6.5) {
            advice = '⚠️ 前方是绝对无敌的戈鲁多刺球！任何攻击都无法伤到它，千万不要触碰，快绕开走！';
            break;
          }
        }
      }
      // 6. 靠近风语大树
      if (!advice && whispy && !whispy.dead && Math.hypot(whispy.mesh.position.x - player.x, whispy.mesh.position.z - player.z) < 14.0) {
        advice = '🌲 风语大树首领来袭！注意躲避它吐出的空气弹，在受击前按 [C/闪] 触发慢动作反击！';
      }
      // 7. 靠近最终 Boss
      if (!advice && boss && !boss.dead && Math.hypot(boss.mesh.position.x - player.x, boss.mesh.position.z - player.z) < 16.0) {
        advice = '👾 遭遇星核霸王·梦魇帝王！利用贴地滑铲 (Shift) 穿过攻击，积蓄超级能量终结它！';
      }
      // 8. 默认趣味向导建议
      if (!advice) {
        const tips = [
          '波约！按 [Shift] 可以贴地滑铲突进，在空中浮空时按 [J/攻] 可以吐出空气弹并极速下落！',
          '波约！如果已经持有能力，必须先按 [Q] 舍弃才能换新能力哦，这是星之世界的铁律！',
          '波约！点击右上角的 [📖 图鉴]，随时查阅探索发现与豪华版的完整动作与进化表！',
          '波约！击败带星敌人掉落头部星星，收集不仅加分，还能充满超级能量槽！'
        ];
        advice = tips[Math.floor(Math.random() * tips.length)];
      }
    }

    if (advice && advice !== lastGuideTip) {
      lastGuideTip = advice;
      const bubbleText = document.getElementById('guide-bubble-text');
      if (bubbleText) bubbleText.textContent = advice;
    }
  }

  function triggerGuideAdvice() {
    guideAdviceTimer = 0;
    updateGuideCompanionAI(0);
    showToast('🌟 向导卡比：' + lastGuideTip);
    KirbyAudio.puff();
  }

  // ---------------- UI 状态刷新 ----------------
  function updateHUD() {
    if (!player) return;
    document.getElementById('hp-text').textContent = `${player.hp} / ${player.maxHp}`;
    document.getElementById('hp-bar-fill').style.width = `${(player.hp / player.maxHp) * 100}%`;

    // 复制能力与多阶进化
    const abEl = document.getElementById('current-ability-name');
    const lvlEl = document.getElementById('ability-level-badge');
    const btnEv = document.getElementById('btn-evolve');
    const btnDiscard = document.getElementById('btn-discard');

    if (player.ability) {
      const ab = KirbyEntities.ABILITIES[player.ability];
      let abDisplayName = ab.name;
      if (ab.levels && ab.levels[player.abilityLevel - 1]) {
        abDisplayName = ab.levels[player.abilityLevel - 1].name;
      }
      abEl.textContent = `${ab.icon} ${abDisplayName}`;
      if (lvlEl) {
        lvlEl.style.display = 'inline-block';
        lvlEl.textContent = `Lv.${player.abilityLevel}`;
      }
      if (btnEv) {
        btnEv.style.display = (ab.levels && ab.levels.length > 1) ? 'inline-block' : 'none';
      }
      if (btnDiscard) btnDiscard.style.display = 'inline-block';
    } else {
      abEl.textContent = '无能力 (请吸入怪物获取)';
      if (lvlEl) lvlEl.style.display = 'none';
      if (btnEv) btnEv.style.display = 'none';
      if (btnDiscard) btnDiscard.style.display = 'none';
    }

    // 《豪华版》超级大招能量槽
    const sgFill = document.getElementById('super-gauge-fill');
    if (sgFill) {
      sgFill.style.width = `${superActiveTimer > 0 ? (superActiveTimer / 16.0) * 100 : superGauge}%`;
    }
    const btnSup = document.getElementById('btn-super-power');
    if (btnSup) {
      btnSup.style.display = (superGauge >= 100 || superActiveTimer > 0) ? 'inline-block' : 'none';
      btnSup.textContent = superActiveTimer > 0 ? `⚡ 大招中 ${superActiveTimer.toFixed(0)}s` : '爆发 (X)';
    }
    const btnSupTouch = document.getElementById('btn-super-touch');
    if (btnSupTouch) {
      btnSupTouch.style.display = (superGauge >= 100 || superActiveTimer > 0) ? 'inline-block' : 'none';
    }

    // 《探索发现》塞满嘴状态浮动卡片
    const mCard = document.getElementById('mouthful-status-card');
    const mTitle = document.getElementById('mouthful-title');
    const mDesc = document.getElementById('mouthful-desc');
    const btnAtkTouch = document.getElementById('btn-attack');

    if (player.mouthfulMode === 'car') {
      if (mCard) mCard.style.display = 'flex';
      if (mTitle) mTitle.textContent = '🚗 汽车塞满嘴已激活！';
      if (mDesc) mDesc.textContent = '【右键/攻】极速涡轮爆冲破甲 · 【Q/弃】吐出解除';
      if (btnAtkTouch) btnAtkTouch.textContent = '冲';
    } else if (player.mouthfulMode === 'cone') {
      if (mCard) mCard.style.display = 'flex';
      if (mTitle) mTitle.textContent = '⚠️ 三角锥塞满嘴已激活！';
      if (mDesc) mDesc.textContent = '【空中右键/攻】千斤顶狂暴下砸 · 【Q/弃】吐出解除';
      if (btnAtkTouch) btnAtkTouch.textContent = '砸';
    } else if (player.mouthfulMode === 'vending') {
      if (mCard) mCard.style.display = 'flex';
      if (mTitle) mTitle.textContent = '🥤 自动贩卖机塞满嘴已激活！';
      if (mDesc) mDesc.textContent = '【右键/攻】易拉罐加特林超速连射 · 【Q/弃】吐出解除';
      if (btnAtkTouch) btnAtkTouch.textContent = '射';
    } else if (player.mouthfulMode === 'ring') {
      if (mCard) mCard.style.display = 'flex';
      if (mTitle) mTitle.textContent = '🌀 圈圈塞满嘴已激活！';
      if (mDesc) mDesc.textContent = '【右键/攻】强风呼啸飓风冲击波 · 【Q/弃】吐出解除';
      if (btnAtkTouch) btnAtkTouch.textContent = '风';
    } else {
      if (mCard) mCard.style.display = 'none';
      if (btnAtkTouch) btnAtkTouch.textContent = '攻';
    }

    // 营救瓦豆鲁迪计数
    const deeCount = document.getElementById('waddle-dee-counter');
    if (deeCount) deeCount.textContent = `${savedWaddleDees} / 3`;

    // 专属技能
    const char = KirbyEntities.CHARACTERS[characterKey] || KirbyEntities.CHARACTERS.pink;
    document.getElementById('skill-name').textContent = char.skillName;
    document.getElementById('skill-cd').textContent = skillCooldownTimer > 0 
      ? `冷却 ${skillCooldownTimer.toFixed(1)}s` 
      : '就绪';

    // 头部星星总数
    const user = KirbyStore.getCurrentUser();
    document.getElementById('star-count-display').textContent = user.headStars || 0;

    // 任务卡片
    document.getElementById('quest-title').textContent = quest.title;
    document.getElementById('quest-desc').textContent = `${quest.desc} (${quest.currentKills}/${quest.targetKills})`;

    // Boss 血条 (优先展示靠近的风语大树或最终 Boss 梦魇帝王)
    const bossHud = document.getElementById('boss-hud');
    if (whispy && !whispy.dead && Math.hypot(whispy.mesh.position.x - player.x, whispy.mesh.position.z - player.z) < 32) {
      bossHud.style.display = 'block';
      const titleSpan = bossHud.querySelector('.boss-title-row span');
      if (titleSpan) titleSpan.textContent = '🌳 经典常驻 Boss：风语大树 (Whispy Woods)';
      document.getElementById('boss-hp-fill').style.width = `${(whispy.hp / whispy.maxHp) * 100}%`;
      document.getElementById('boss-phase-tag').textContent = '风语之怒';
    } else if (boss && !boss.dead && Math.hypot(boss.mesh.position.x - player.x, boss.mesh.position.z - player.z) < 35) {
      bossHud.style.display = 'block';
      const titleSpan = bossHud.querySelector('.boss-title-row span');
      if (titleSpan) titleSpan.textContent = '👾 最终 Boss：星核霸王·梦魇帝王';
      document.getElementById('boss-hp-fill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      document.getElementById('boss-phase-tag').textContent = boss.phase === 2 ? '⚠️ 二阶段·狂暴' : '一阶段·常态';
    } else {
      bossHud.style.display = 'none';
    }

    // 联机队友列表
    if (mode === 'online') {
      const teamList = document.getElementById('online-team-list');
      const st = KirbyMultiplayer.getState();
      teamList.innerHTML = st.players.map(p => `
        <div class="team-member-badge ${p.isDead ? 'down' : ''}">
          <b>${p.isHost ? '👑 ' : ''}${p.name}</b>
          <div>${p.isDead ? `🚨 倒地救援倒计时: ${Math.max(0, Math.ceil(p.rescueTimer))}s` : `HP: ${p.hp}/10 · ${p.summoned ? '已在场' : '待召唤'}`}</div>
          ${p.isDead && p.slot !== 1 ? `<button class="btn-sm" onclick="KirbyGame.rescueTeammate(${p.slot})">用⭐施救</button>` : ''}
        </div>
      `).join('');
    }
  }

  function rescueTeammate(slot) {
    const res = KirbyMultiplayer.rescuePlayer(1, slot);
    showToast(res.msg);
    updateHUD();
  }

  // ---------------- 提示与模态框 ----------------
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function showModal(title, desc, onConfirm) {
    const m = document.getElementById('modal-dialog');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-desc').textContent = desc;
    document.getElementById('btn-modal-ok').onclick = () => {
      m.classList.remove('show');
      if (onConfirm) onConfirm();
    };
    m.classList.add('show');
  }

  function hideModal() {
    document.getElementById('modal-dialog').classList.remove('show');
  }

  function togglePause() {
    paused = !paused;
    if (paused) {
      showModal('⏸️ 游戏已暂停', '当前探索状态已冻结，点击确定继续冒险。', () => {
        paused = false;
        hideModal();
      });
    } else {
      hideModal();
    }
  }

  // 断开联机并平滑转入单机模式
  function disconnectToSolo() {
    if (mode === 'online') {
      KirbyMultiplayer.disconnect();
      mode = 'solo';
      const safe = KirbyStore.getSafePoint(worldKey);
      player.x = safe.x;
      player.y = safe.y;
      player.z = safe.z;
      document.getElementById('online-team-list').style.display = 'none';
      document.getElementById('dual-summon-pad').style.display = 'none';
      showToast(`🚪 已安全退出联机房间，平滑转入单机模式并送回安全营地【${safe.name}】！`);
      updateHUD();
    }
  }

  // ---------------- 瓦豆鲁迪武器工坊：能力觉醒进化 ----------------
  function equipTownWeapon(abilityKey, level = 1) {
    if (!player) return;
    const ab = KirbyEntities.ABILITIES[abilityKey];
    if (!ab) return;

    // 严苛机制：初始技能不能选，必须从怪物身上获取！
    if (!player.ability || player.ability !== abilityKey) {
      KirbyAudio.hit();
      const mobHint = abilityKey === 'sword' ? '利剑骑士 (Blade Knight)' :
                      abilityKey === 'fire' ? '火炎怪 (Hot Head)' :
                      abilityKey === 'ice' ? '奇力雪人 (Chilly)' : '对应属性怪物';
      showToast(`🔒 初始技能无法直接勾选！必须在冒险关卡中吸入【${mobHint}】获得基础能力后，才可在工坊觉醒进化！`);
      return;
    }

    player.abilityLevel = level;
    KirbyEntities.attachAbilityHat(playerModel.hatHolder, abilityKey, level);
    KirbyAudio.victory();
    const lvlName = (ab.levels && ab.levels[level - 1]) ? ab.levels[level - 1].name : ab.name;
    showToast(`⚔️ 武器工坊：已成功觉醒进化为【${lvlName}】(Lv.${level})！`);
    const tm = document.getElementById('town-modal');
    if (tm) tm.classList.remove('show');
    updateHUD();
  }

  // ---------------- 瓦豆鲁迪咖啡店：美食增益消费 ----------------
  function consumeCafeItem(itemType) {
    if (!player) return;
    const tm = document.getElementById('town-modal');
    if (tm) tm.classList.remove('show');

    if (itemType === 'tomato') {
      player.hp = player.maxHp;
      KirbyAudio.itemEat();
      KirbyAudio.victory();
      showToast('🌸 享用了甜美 M-番茄！生命值完全回满 (HP 10/10)！');
    } else if (itemType === 'candy') {
      invincibleTimer = 10.0;
      KirbyAudio.itemEat();
      KirbyAudio.skill();
      showToast('🍭 品尝了无敌糖果！获得 10 秒彩虹无敌，撞击敌人直接秒杀！');
    } else if (itemType === 'potion') {
      superGauge = 100;
      attackBoostTimer = 25.0;
      KirbyAudio.itemEat();
      KirbyAudio.superSword();
      showToast('⚡ 饮用了元气能量药水！超级能量瞬间 100% 满载，攻击伤害提升！随时按 X 爆发大招！');
    }
    updateHUD();
  }

  // ---------------- 刹那间居合斩小游戏 (Quick Draw Reflex Mini-Game) ----------------
  function startQuickDrawDuel() {
    qdState = 'waiting';
    const indicator = document.getElementById('qd-prompt-indicator');
    const statusText = document.getElementById('qd-status-text');
    const btnPrepare = document.getElementById('btn-qd-prepare');
    const btnSlash = document.getElementById('btn-qd-slash');

    if (indicator) {
      indicator.textContent = '…';
      indicator.classList.remove('flash');
    }
    if (statusText) statusText.textContent = '屏住呼吸... 凝视圆圈...';
    if (btnPrepare) btnPrepare.style.display = 'none';
    if (btnSlash) btnSlash.style.display = 'inline-block';

    if (qdTimeout) clearTimeout(qdTimeout);
    // 随机 1.5 - 3.8 秒后出现红色闪烁叹号
    const delay = 1500 + Math.random() * 2300;
    qdTimeout = setTimeout(() => {
      if (qdState !== 'waiting') return;
      qdState = 'ready';
      qdStartTime = performance.now();
      if (indicator) {
        indicator.textContent = '！';
        indicator.classList.add('flash');
      }
      if (statusText) statusText.textContent = '⚡ 斩！！！出刀！！！';
    }, delay);
  }

  function triggerQuickDrawSlash() {
    const indicator = document.getElementById('qd-prompt-indicator');
    const statusText = document.getElementById('qd-status-text');
    const btnPrepare = document.getElementById('btn-qd-prepare');
    const btnSlash = document.getElementById('btn-qd-slash');

    if (qdState === 'waiting') {
      // 抢跑犯规！
      if (qdTimeout) clearTimeout(qdTimeout);
      qdState = 'finished';
      KirbyAudio.defeat();
      if (indicator) {
        indicator.textContent = '✕';
        indicator.classList.remove('flash');
      }
      if (statusText) statusText.textContent = '💥 太心急了！抢跑犯规判负！';
      if (btnPrepare) {
        btnPrepare.style.display = 'inline-block';
        btnPrepare.textContent = '再次挑战';
      }
      if (btnSlash) btnSlash.style.display = 'none';
      return;
    }

    if (qdState === 'ready') {
      qdState = 'finished';
      const reactMs = Math.round(performance.now() - qdStartTime);
      KirbyAudio.quickDrawSlash();
      if (indicator) {
        indicator.textContent = '⚔️';
        indicator.classList.remove('flash');
      }
      if (reactMs <= 280) {
        KirbyStore.addHeadStars(3);
        KirbyAudio.victory();
        if (statusText) statusText.textContent = `🏆 神速斩！反应速度: ${reactMs} ms！击破对手，奖励 3 颗头部星星！`;
        showToast(`🎉 刹那居合拔刀胜利！反应速度 ${reactMs} ms！头部星星 +3！`);
      } else {
        if (statusText) statusText.textContent = `⏱️ 反应速度: ${reactMs} ms (稍慢了一拍，对手先击中了你！)`;
        showToast(`居合对决反应速度: ${reactMs} ms！差一点就赢了！`);
      }
      if (btnPrepare) {
        btnPrepare.style.display = 'inline-block';
        btnPrepare.textContent = '再次挑战';
      }
      if (btnSlash) btnSlash.style.display = 'none';
      updateHUD();
    }
  }

  return {
    init: initRenderer,
    start: startGame,
    discardAbility,
    triggerCharacterSkill,
    togglePause,
    disconnectToSolo,
    rescueTeammate,
    equipTownWeapon,
    consumeCafeItem,
    startQuickDrawDuel,
    triggerQuickDrawSlash,
    triggerGuideAdvice,
    performSlideDash,
    performAerialAirPuff,
    showToast
  };
})();

if (typeof window !== 'undefined') window.KirbyGame = KirbyGame;
if (typeof module !== 'undefined' && module.exports) module.exports = KirbyGame;
