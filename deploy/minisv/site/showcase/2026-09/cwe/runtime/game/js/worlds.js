/**
 * 星之卡比 CP版 · 3D 世界与地图模块 (子棍 3)
 * 构建 4 个完整的 3D 探索世界，包含地形、碰撞体、特定可穿透地面 (半透平台) 及安全地点
 */
const KirbyWorlds = (() => {
  // ---------------- 真实手绘级程序化材质纹理生成器 (对齐 Nintendo 风格与封面 title.png) ----------------
  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  let cachedGrassTex = null;
  function getGrassCanvasTexture() {
    if (cachedGrassTex) return cachedGrassTex;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // 任天堂Switch原画级亮丽草绿柔和底色渐变
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, '#5ea832');
    grad.addColorStop(0.35, '#6cb838');
    grad.addColorStop(0.7, '#59a22d');
    grad.addColorStop(1, '#4e8c26');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 细致高密度草叶笔触 (3200+ 根草丝，分层次明暗交织)
    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const len = 8 + Math.random() * 22;
      const rVal = Math.random();
      ctx.strokeStyle = rVal > 0.6 ? '#88dc45' : (rVal > 0.25 ? '#6ebd36' : '#3f7c1e');
      ctx.lineWidth = 1.6 + Math.random() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 6, y - len * 0.5);
      ctx.lineTo(x + (Math.random() - 0.5) * 10, y - len);
      ctx.stroke();
    }

    // 鲜嫩三叶草丛 (Clover patches)
    for (let c = 0; c < 120; c++) {
      const cx = Math.random() * 1024;
      const cy = Math.random() * 1024;
      ctx.fillStyle = '#498c25';
      for (let leaf = 0; leaf < 3; leaf++) {
        const ang = (leaf * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * 4.5, cy + Math.sin(ang) * 4.5, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 鲜嫩小雏菊、樱粉小花与金黄蒲公英斑点
    for (let i = 0; i < 180; i++) {
      const fx = Math.random() * 1024;
      const fy = Math.random() * 1024;
      const fType = Math.random();
      if (fType > 0.65) {
        // 白雏菊与黄花蕊
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(fx, fy, 2.0, 0, Math.PI * 2);
        ctx.fill();
      } else if (fType > 0.3) {
        // 金黄蒲公英
        ctx.fillStyle = '#ffee58';
        ctx.beginPath();
        ctx.arc(fx, fy, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f57f17';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 樱粉春之花
        ctx.fillStyle = '#ff80ab';
        ctx.beginPath();
        ctx.arc(fx, fy, 4.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    cachedGrassTex = new THREE.CanvasTexture(canvas);
    cachedGrassTex.wrapS = THREE.RepeatWrapping;
    cachedGrassTex.wrapT = THREE.RepeatWrapping;
    cachedGrassTex.repeat.set(5, 15);
    return cachedGrassTex;
  }

  let cachedStoneTileTex = null;
  function getStoneTileCanvasTexture() {
    if (cachedStoneTileTex) return cachedStoneTileTex;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 暖调古典石基底
    ctx.fillStyle = '#bcaaa4';
    ctx.fillRect(0, 0, 1024, 1024);

    // 经典竞技场大道石砖格 (1:1 还原封面 title.png 罗马石砖古道)
    const size = 128;
    for (let y = 0; y < 1024; y += size) {
      for (let x = 0; x < 1024; x += size) {
        const offset = ((y / size) % 2 === 0 ? 0 : size / 2);
        const px = (x + offset) % 1024;

        // 石砖主体微暖色差
        ctx.fillStyle = Math.random() > 0.5 ? '#d7ccc8' : (Math.random() > 0.5 ? '#cfd8dc' : '#b0bec5');
        ctx.fillRect(px + 4, y + 4, size - 8, size - 8);

        // 砖块高光与立体倒角投影
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 4, y + size - 4);
        ctx.lineTo(px + 4, y + 4);
        ctx.lineTo(px + size - 4, y + 4);
        ctx.stroke();

        ctx.strokeStyle = '#6d4c41';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px + size - 4, y + 4);
        ctx.lineTo(px + size - 4, y + size - 4);
        ctx.lineTo(px + 4, y + size - 4);
        ctx.stroke();

        // 砂石微粒肌理
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let p = 0; p < 45; p++) {
          ctx.fillRect(px + 8 + Math.random() * (size - 20), y + 8 + Math.random() * (size - 20), 2.5, 2.5);
        }
      }
    }

    // 《探索发现》废墟自然：公路中央风化明黄虚线分道标线 (Forgotten Land Overgrown Highway Yellow Lines)
    ctx.fillStyle = '#fbc02d';
    for (let sy = 0; sy < 1024; sy += 128) {
      if (sy % 256 < 128) {
        ctx.fillRect(504, sy + 16, 16, 96);
      }
    }
    // 标线斑驳风化破损缺口
    ctx.fillStyle = '#bcaaa4';
    for (let w = 0; w < 30; w++) {
      const wy = Math.random() * 1024;
      ctx.fillRect(502 + Math.random() * 20, wy, 4, 6);
    }

    // 古道风化石缝裂纹与顽强生命嫩绿苔藓杂草 (Weathered Fissures & Mossy Tufts)
    for (let c = 0; c < 28; c++) {
      const cx = Math.random() * 1024;
      const cy = Math.random() * 1024;
      ctx.strokeStyle = 'rgba(78, 52, 46, 0.65)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let curX = cx;
      let curY = cy;
      for (let s = 0; s < 4; s++) {
        curX += (Math.random() - 0.5) * 45;
        curY += (Math.random() - 0.5) * 45;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();

      if (Math.random() > 0.35) {
        ctx.fillStyle = '#689f38';
        ctx.beginPath();
        ctx.arc(curX, curY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    cachedStoneTileTex = new THREE.CanvasTexture(canvas);
    cachedStoneTileTex.wrapS = THREE.RepeatWrapping;
    cachedStoneTileTex.wrapT = THREE.RepeatWrapping;
    cachedStoneTileTex.repeat.set(2, 12);
    return cachedStoneTileTex;
  }

  let cachedBannerTex = null;
  function getBannerCanvasTexture() {
    if (cachedBannerTex) return cachedBannerTex;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 鲜红王城皇家织锦挂旗与双重金镶边
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(0, 0, 256, 512);

    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 500);

    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 220, 476);

    // 金黄色经典五角星 (封面 title.png 左侧挂旗造型)
    ctx.fillStyle = '#ffea00';
    drawStar(ctx, 128, 190, 5, 72, 32);

    // 金黄色麦穗/王室星辉饰纹
    ctx.fillStyle = '#ffd54f';
    for (let d = 0; d < 7; d++) {
      ctx.beginPath();
      ctx.arc(60 + d * 22, 320, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    cachedBannerTex = new THREE.CanvasTexture(canvas);
    return cachedBannerTex;
  }

  const WORLD_CONFIGS = {
    grassland: {
      name: '草原长路',
      subtitle: '明亮丘陵与安全坡地',
      skyColor: 0x4fc3f7,  // 还原封面阳光碧空
      groundColor: 0x43a047,
      roadColor: 0xd7ccc8,
      fogColor: 0x81d4fa,
      fogDensity: 0.006,
      ambient: 0xffffff,
      ambientInt: 0.72,
      dirLight: 0xfff9e6,
      dirInt: 1.45,
      safePoint: { x: 0, y: 0.5, z: 12, name: '草原绿茵营地' },
      bounds: { minX: -26, maxX: 26, minZ: -140, maxZ: 20 }
    },
    bunker: {
      name: '地堡裂谷',
      subtitle: '岩层、平台与窄路',
      skyColor: 0x4a2e24,
      groundColor: 0x7c4931,
      roadColor: 0x9c6145,
      fogColor: 0x5d352b,
      fogDensity: 0.013,
      ambient: 0xffc4a0,
      ambientInt: 0.70,
      dirLight: 0xff9100,
      dirInt: 1.15,
      safePoint: { x: 0, y: 1.0, z: 12, name: '地堡前沿掩体' },
      bounds: { minX: -22, maxX: 22, minZ: -140, maxZ: 20 }
    },
    dark: {
      name: '夜行森林',
      subtitle: '低光照与发光地形',
      skyColor: 0x090c20,
      groundColor: 0x1a1d3f,
      roadColor: 0x2b305b,
      fogColor: 0x121533,
      fogDensity: 0.015,
      ambient: 0x8c9eff,
      ambientInt: 0.65,
      dirLight: 0x69f0ae,
      dirInt: 0.95,
      safePoint: { x: 0, y: 0.8, z: 12, name: '荧光安全树亭' },
      bounds: { minX: -24, maxX: 24, minZ: -140, maxZ: 20 }
    },
    arena: {
      name: '星环试炼',
      subtitle: 'Boss 与阶段目标',
      skyColor: 0x1f1033,
      groundColor: 0x4a148c,
      roadColor: 0x7b1fa2,
      fogColor: 0x311b92,
      fogDensity: 0.011,
      ambient: 0xffd180,
      ambientInt: 0.75,
      dirLight: 0xffea00,
      dirInt: 1.35,
      safePoint: { x: 0, y: 0.5, z: 14, name: '星环试炼祭坛' },
      bounds: { minX: -30, maxX: 30, minZ: -140, maxZ: 24 }
    }
  };

  function createWorld(scene, worldKey = 'grassland') {
    const cfg = WORLD_CONFIGS[worldKey] || WORLD_CONFIGS.grassland;
    const worldGroup = new THREE.Group();
    worldGroup.name = 'WorldGroup';

    const colliders = [];

    // 1. 全局影院级 5 点立体照明系统 (达到任天堂 Switch《探索发现》通透柔和质感)：
    // A. 天穹半球光 (天光 + 地光真实双色漫反射)
    const hemiLight = new THREE.HemisphereLight(cfg.skyColor, cfg.groundColor, 0.78);
    worldGroup.add(hemiLight);

    // B. 全局漫反射环境光
    const ambientLight = new THREE.AmbientLight(cfg.ambient, cfg.ambientInt);
    worldGroup.add(ambientLight);

    // C. 4K 阳光主平行直射光 (4096x4096 超精细柔和阴影 + 消除球体自阴影伪影)
    const dirLight = new THREE.DirectionalLight(cfg.dirLight, cfg.dirInt);
    dirLight.position.set(32, 60, 28);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 240;
    const d = 58;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.normalBias = 0.035; // 关键：消除曲面自阴影阶梯伪影，让卡比球体光滑如玉
    dirLight.shadow.radius = 2.2;
    worldGroup.add(dirLight);

    // D. 任天堂 Switch 招牌金色轮廓逆光 (Rim Light - 赋予卡比与角色背部极具质感的金芒边缘高光)
    const rimLight = new THREE.DirectionalLight(0xfff9c4, 0.95);
    rimLight.position.set(-28, 38, -55);
    worldGroup.add(rimLight);

    // E. 柔和冷色补光 (Fill Light - 避免暗面死黑，丰富暗部暗调层次)
    const fillLight = new THREE.DirectionalLight(0x90caf9, 0.42);
    fillLight.position.set(20, 20, -30);
    worldGroup.add(fillLight);

    // 2. 雾气与背景天空
    scene.background = new THREE.Color(cfg.skyColor);
    scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);

    // 辅助函数：创建碰撞箱
    function addBoxCollider(x, y, z, w, h, d, mat, isPassthrough = false) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      mesh.castShadow = !isPassthrough;
      worldGroup.add(mesh);

      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        isPassthrough,
        mesh
      });
      return mesh;
    }

    // 3. 构建不同世界专属场景
    const animatables = [];
    if (worldKey === 'grassland') {
      buildGrassland(worldGroup, colliders, addBoxCollider, cfg, animatables);
    } else if (worldKey === 'bunker') {
      buildBunker(worldGroup, colliders, addBoxCollider, cfg, animatables);
    } else if (worldKey === 'dark') {
      buildDarkForest(worldGroup, colliders, addBoxCollider, cfg, animatables);
    } else if (worldKey === 'arena') {
      buildStarArena(worldGroup, colliders, addBoxCollider, cfg, animatables);
    }

    // 4. 添加世界微粒氛围特效 (漂浮花粉/火星/荧光孢子/星屑)
    createAtmosphericParticles(worldGroup, worldKey, animatables);

    scene.add(worldGroup);
    return {
      group: worldGroup,
      colliders,
      config: cfg,
      animatables,
      update(dt) {
        const time = performance.now() * 0.001;
        for (let i = 0; i < animatables.length; i++) {
          const item = animatables[i];
          if (item.type === 'grass') {
            item.mesh.rotation.z = Math.sin(time * 2.2 + item.seed) * 0.06;
          } else if (item.type === 'tree') {
            item.foliage.rotation.z = Math.sin(time * 1.5 + item.seed) * 0.035;
            item.foliageTop.rotation.z = Math.sin(time * 1.8 + item.seed) * 0.05;
          } else if (item.type === 'cloud') {
            item.mesh.position.x += item.speed * dt;
            if (item.mesh.position.x > 35) item.mesh.position.x = -35;
          } else if (item.type === 'banner') {
            item.mesh.rotation.x = Math.sin(time * 2.5 + item.seed) * 0.08;
          } else if (item.type === 'particles') {
            const count = item.group.children.length;
            for (let c = 0; c < count; c++) {
              const p = item.group.children[c];
              p.position.y += Math.sin(time * 2 + c) * 0.003;
              p.rotation.y += dt * 0.8;
            }
          }
        }
      },
      cleanup() {
        scene.remove(worldGroup);
      }
    };
  }

  // ---------------- 草原长路 (封面 title.png 罗马斗兽场城寨与蓝天草地真实还原) ----------------
  function buildGrassland(group, colliders, addBox, cfg, animatables = null) {
    const grassTex = getGrassCanvasTexture();
    const stoneTileTex = getStoneTileCanvasTexture();

    const groundMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.65,
      metalness: 0.05
    });
    const roadMat = new THREE.MeshStandardMaterial({
      map: stoneTileTex,
      roughness: 0.55,
      metalness: 0.1
    });
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x4e8c3a,
      roughness: 0.7
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      roughness: 0.6
    });
    const grateMat = new THREE.MeshStandardMaterial({
      color: 0xdeb887,
      transparent: true,
      opacity: 0.88,
      roughness: 0.4
    });

    // 主道路与连续地面段
    for (let z = 20; z >= -130; z -= 30) {
      addBox(0, -0.5, z, 36, 1, 30, groundMat, false);
      addBox(0, 0.03, z, 10, 0.06, 30, roadMat, false); // 中间石砖铺道 (还原 title.png 石砖小径)
    }

    // 沿途 3D 鲜花与草丛装饰点缀 (消除单调空旷，提升次时代丰满度)
    const flowerMatPink = new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.4 });
    const flowerMatYellow = new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.4 });
    const flowerCenterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const grassTuftMat = new THREE.MeshStandardMaterial({ color: 0x76c836, roughness: 0.5 });

    for (let fz = 18; fz >= -125; fz -= 6) {
      [-5.6, 5.6].forEach((fx, idx) => {
        const clump = new THREE.Group();
        const randOffset = (Math.sin(fz * 1.5) * 1.2);
        clump.position.set(fx + randOffset, 0.05, fz);

        // 立体草丛簇
        for (let b = 0; b < 4; b++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6 + (b % 2) * 0.2, 4), grassTuftMat);
          blade.position.set((b - 1.5) * 0.18, 0.3, (b % 2) * 0.15);
          blade.rotation.z = (b - 1.5) * 0.25;
          clump.add(blade);
        }

        // 小花花朵
        const isPink = (idx + Math.floor(fz / 6)) % 2 === 0;
        const petMat = isPink ? flowerMatPink : flowerMatYellow;
        for (let p = 0; p < 5; p++) {
          const pet = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), petMat);
          const pAng = (p * Math.PI * 2) / 5;
          pet.position.set(Math.cos(pAng) * 0.14, 0.42, Math.sin(pAng) * 0.14);
          clump.add(pet);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), flowerCenterMat);
        center.position.set(0, 0.45, 0);
        clump.add(center);

        group.add(clump);
        if (animatables) {
          animatables.push({ type: 'grass', mesh: clump, seed: fz + idx });
        }
      });
    }

    // 安全地点标识：星光圆环营地
    const campRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.25, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffa000, emissiveIntensity: 0.6, roughness: 0.2 })
    );
    campRing.rotation.x = Math.PI / 2;
    campRing.position.set(0, 0.05, 12);
    group.add(campRing);

    // 平台与丘陵 (包含特定可穿过地面 isPassthrough = true)
    addBox(-10, 2.5, -20, 8, 1, 8, hillMat, false);
    addBox(10, 3.5, -35, 8, 1, 8, hillMat, false);

    // 【可穿透木质栅格跳台】(站在上面按蹲下 Shift 可穿过掉落)
    addBox(0, 3.0, -15, 7, 0.3, 5, grateMat, true);
    addBox(-6, 5.0, -45, 6, 0.3, 5, grateMat, true);
    addBox(6, 4.5, -70, 6, 0.3, 5, grateMat, true);
    addBox(0, 4.0, -95, 8, 0.3, 6, grateMat, true);

    // 装饰：卡通风格立体蓬松树木
    for (let i = 0; i < 28; i++) {
      const tx = (i % 2 === 0 ? 1 : -1) * (14 + Math.random() * 8);
      const tz = 10 - i * 5;
      createCuteTree(group, tx, 0, tz, 0x4caf50, animatables);
    }

    // 装饰：天空中漂浮的蓬松 3D 萌系白云
    for (let c = 0; c < 8; c++) {
      createFluffyCloud(group, (Math.random() - 0.5) * 60, 16 + Math.random() * 8, -20 - c * 15, animatables);
    }

    // 封面 title.png 专属背景：宏伟罗马竞技场城寨石拱门与星徽王旗
    createColosseumBackground(group, 0, 0, -140, animatables);

    // 最终 Boss 区域大擂台
    addBox(0, 0.5, -115, 38, 2, 36, new THREE.MeshStandardMaterial({ map: stoneTileTex, roughness: 0.5 }), false);
  }

  // ---------------- 地堡裂谷 ----------------
  function buildBunker(group, colliders, addBox, cfg) {
    const rockMat = new THREE.MeshStandardMaterial({ color: cfg.groundColor, roughness: 0.8, metalness: 0.1 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.35, metalness: 0.65 });
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.4, metalness: 0.55 });
    const passthroughGrate = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, transparent: true, opacity: 0.88, roughness: 0.3 });

    // 安全前哨
    addBox(0, 0, 10, 24, 2, 20, rockMat, false);

    // 裂谷深渊：由断裂的高低岩台与工业金属桥连通
    addBox(-6, 1.5, -15, 12, 5, 16, rockMat, false);
    addBox(8, 2.5, -38, 12, 7, 18, rockMat, false);
    addBox(-7, 3.0, -62, 14, 8, 18, rockMat, false);
    addBox(5, 4.0, -88, 14, 10, 20, rockMat, false);

    // 【地堡半透工业金属格栅平台】(Crouch 穿透)
    addBox(1, 4.0, -26, 7, 0.3, 7, passthroughGrate, true);
    addBox(0, 5.2, -50, 7, 0.3, 7, passthroughGrate, true);
    addBox(-1, 6.5, -75, 7, 0.3, 7, passthroughGrate, true);

    // 连通悬空金属钢梁
    addBox(1, 2.2, -15, 3, 0.5, 14, metalMat, false);
    addBox(0, 3.6, -62, 3, 0.5, 14, bridgeMat, false);

    // Boss 决战地堡平台
    addBox(0, 2.0, -118, 34, 4, 32, metalMat, false);

    // 岩浆与警示警灯柱
    for (let z = 5; z >= -100; z -= 20) {
      createWarningPillar(group, -12, 2, z);
      createWarningPillar(group, 12, 2, z);
    }
  }

  // ---------------- 夜行森林 ----------------
  function buildDarkForest(group, colliders, addBox, cfg) {
    const mossMat = new THREE.MeshStandardMaterial({ color: cfg.groundColor, roughness: 0.75, metalness: 0.05 });
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x4527a0, roughness: 0.6, metalness: 0.1 });
    const leafGrate = new THREE.MeshStandardMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.88, roughness: 0.35 });

    // 主森林地面
    for (let z = 20; z >= -130; z -= 30) {
      addBox(0, -0.5, z, 34, 1, 30, mossMat, false);
      addBox(0, 0.02, z, 8, 0.05, 30, pathMat, false);
    }

    // 【可穿透巨型荧光树叶与蘑菇顶跳台】
    addBox(-5, 2.8, -18, 6, 0.3, 6, leafGrate, true);
    addBox(5, 3.8, -42, 6, 0.3, 6, leafGrate, true);
    addBox(-4, 5.0, -68, 6, 0.3, 6, leafGrate, true);
    addBox(3, 4.2, -92, 7, 0.3, 6, leafGrate, true);

    // 发光巨型蘑菇
    for (let i = 0; i < 22; i++) {
      const mx = (i % 2 === 0 ? 1 : -1) * (11 + Math.random() * 7);
      const mz = 8 - i * 6;
      createGlowingMushroom(group, mx, 0, mz, (i % 2 === 0 ? 0x00e676 : 0xd500f9));
    }

    // Boss 森林古树祭坛
    addBox(0, 0.8, -115, 36, 2.5, 34, new THREE.MeshStandardMaterial({ color: 0x283593, roughness: 0.5 }), false);
  }

  // ---------------- 星环试炼 ----------------
  function buildStarArena(group, colliders, addBox, cfg) {
    const cosmicMat = new THREE.MeshStandardMaterial({ color: cfg.groundColor, emissive: 0x1a0933, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.2 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffab00, emissiveIntensity: 0.65, roughness: 0.2, metalness: 0.8 });
    const starGrate = new THREE.MeshStandardMaterial({ color: 0xff80ab, transparent: true, opacity: 0.88, roughness: 0.3 });

    // 悬浮星空擂台与通道
    addBox(0, 0, 12, 18, 1.5, 16, cosmicMat, false);
    addBox(0, 0, -10, 14, 1.5, 24, cosmicMat, false);
    addBox(0, 1.0, -40, 16, 1.5, 24, cosmicMat, false);
    addBox(0, 1.8, -72, 18, 1.5, 26, cosmicMat, false);

    // 【可穿透星光跃迁平台】
    addBox(-6, 3.5, -25, 6, 0.3, 5, starGrate, true);
    addBox(6, 4.5, -55, 6, 0.3, 5, starGrate, true);
    addBox(0, 5.5, -85, 7, 0.3, 6, starGrate, true);

    // 巨型 Boss 星环决战场
    addBox(0, 1.5, -118, 42, 3, 40, cosmicMat, false);

    // 环绕宏伟星环 (Torus)
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(18 + r * 6, 0.45, 12, 64),
        ringMat
      );
      ring.position.set(0, 5 + r * 2, -118);
      ring.rotation.x = Math.PI / 2.5;
      ring.rotation.y = (r * Math.PI) / 4;
      group.add(ring);
    }

    // 试炼金符星碑
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = Math.cos(ang) * 19;
      const pz = -118 + Math.sin(ang) * 18;
      createStarPillar(group, px, 3, pz);
    }
  }

  // ---------------- 装饰物辅助构造 (PBR 真实标准材质) ----------------
  function createCuteTree(group, x, y, z, leafColor, animatables = null) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7, metalness: 0.05 });
    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.55, metalness: 0.02 });
    const leafBrightMat = new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.5, metalness: 0.02 });

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.48, 2.6, 12),
      trunkMat
    );
    trunk.position.set(x, y + 1.3, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 任天堂风格多层丰满球冠
    const foliageMain = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 14), leafMat);
    foliageMain.position.set(x, y + 3.2, z);
    foliageMain.castShadow = true;
    foliageMain.receiveShadow = true;
    group.add(foliageMain);

    const foliageTop = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), leafBrightMat);
    foliageTop.position.set(x, y + 4.1, z);
    foliageTop.castShadow = true;
    group.add(foliageTop);

    if (animatables) {
      animatables.push({ type: 'tree', foliage: foliageMain, foliageTop, seed: (x + z) * 0.1 });
    }
  }

  function createGlowingMushroom(group, x, y, z, glowColor) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.52, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xd1c4e9, roughness: 0.5 })
    );
    stem.position.set(x, y + 1.1, z);
    stem.castShadow = true;
    group.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 0.6, roughness: 0.3 })
    );
    cap.position.set(x, y + 2.1, z);
    cap.castShadow = true;
    group.add(cap);

    // 蘑菇上的小光斑
    for (let s = 0; s < 5; s++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const sang = (s * Math.PI * 2) / 5;
      spot.position.set(x + Math.cos(sang) * 0.9, y + 2.45, z + Math.sin(sang) * 0.9);
      group.add(spot);
    }
  }

  function createWarningPillar(group, x, y, z) {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 3.2, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.7, roughness: 0.35 })
    );
    col.position.set(x, y + 1.6, z);
    col.castShadow = true;
    group.add(col);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0xff3d00, emissiveIntensity: 0.85, roughness: 0.2 })
    );
    beacon.position.set(x, y + 3.4, z);
    group.add(beacon);
  }

  function createStarPillar(group, x, y, z) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.85, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a148c, metalness: 0.5, roughness: 0.35 })
    );
    pillar.position.set(x, y + 3, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);

    const starTop = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85),
      new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffd600, emissiveIntensity: 0.85, metalness: 0.8, roughness: 0.2 })
    );
    starTop.position.set(x, y + 6.8, z);
    group.add(starTop);
  }

  // ---------------- 全局世界漂浮微粒氛围粒子 (Pollen / Sparks / Spores / Stardust) ----------------
  function createAtmosphericParticles(group, worldKey, animatables = null) {
    const pCount = 100;
    const pGroup = new THREE.Group();
    pGroup.name = 'AtmosphericParticles';

    let pColor = 0xffeb3b;
    let emissiveCol = 0xffa000;
    if (worldKey === 'bunker') {
      pColor = 0xff5722;
      emissiveCol = 0xff3d00;
    } else if (worldKey === 'dark') {
      pColor = 0x69f0ae;
      emissiveCol = 0x00e676;
    } else if (worldKey === 'arena') {
      pColor = 0xffd54f;
      emissiveCol = 0xffab00;
    }

    const pMat = new THREE.MeshStandardMaterial({
      color: pColor,
      emissive: emissiveCol,
      emissiveIntensity: 0.8,
      roughness: 0.3
    });

    const pGeo = new THREE.OctahedronGeometry(0.08);
    for (let i = 0; i < pCount; i++) {
      const pm = new THREE.Mesh(pGeo, pMat);
      pm.position.set(
        (Math.random() - 0.5) * 45,
        1.0 + Math.random() * 8,
        15 - Math.random() * 140
      );
      pGroup.add(pm);
    }
    group.add(pGroup);
    if (animatables) {
      animatables.push({ type: 'particles', group: pGroup });
    }
  }

  function createFluffyCloud(group, x, y, z, animatables = null) {
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(x, y, z);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0
    });
    const puffs = [
      { r: 2.2, ox: 0, oy: 0, oz: 0 },
      { r: 1.6, ox: -1.8, oy: -0.2, oz: 0.2 },
      { r: 1.7, ox: 1.8, oy: -0.1, oz: -0.1 },
      { r: 1.3, ox: -3.0, oy: -0.5, oz: 0 },
      { r: 1.4, ox: 2.9, oy: -0.4, oz: 0.1 },
      { r: 1.2, ox: 0, oy: 1.2, oz: 0 }
    ];
    puffs.forEach(p => {
      const puffMesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 12, 10), cloudMat);
      puffMesh.position.set(p.ox, p.oy, p.oz);
      cloudGroup.add(puffMesh);
    });
    group.add(cloudGroup);
    if (animatables) {
      animatables.push({ type: 'cloud', mesh: cloudGroup, speed: 0.35 + Math.random() * 0.25 });
    }
    return cloudGroup;
  }

  function createColosseumBackground(group, x, y, z, animatables = null) {
    const colGroup = new THREE.Group();
    colGroup.position.set(x, y, z);

    const stoneTex = getStoneTileCanvasTexture();
    const bannerTex = getBannerCanvasTexture();

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.6,
      metalness: 0.1
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.7,
      metalness: 0.1
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa000,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2
    });
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.4,
      side: THREE.DoubleSide
    });

    // 1. 宏伟竞技场后墙 (弧形/平直巨石城墙)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(70, 18, 5), stoneMat);
    backWall.position.set(0, 9, 0);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    colGroup.add(backWall);

    // 2. 罗马石拱门门廊群 (Archways)
    const archCount = 5;
    const archSpacing = 11;
    for (let i = -2; i <= 2; i++) {
      const ax = i * archSpacing;
      const leftCol = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 12, 12), stoneMat);
      leftCol.position.set(ax - 2.8, 6, 2.8);
      colGroup.add(leftCol);

      const rightCol = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 12, 12), stoneMat);
      rightCol.position.set(ax + 2.8, 6, 2.8);
      colGroup.add(rightCol);

      const archTop = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.7, 8, 16, Math.PI), stoneMat);
      archTop.position.set(ax, 12, 2.8);
      colGroup.add(archTop);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.2, 2), stoneMat);
      beam.position.set(ax, 13, 2.8);
      colGroup.add(beam);

      const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 7.5), bannerMat);
      banner.position.set(ax, 7.5, 3.2);
      colGroup.add(banner);

      if (animatables) {
        animatables.push({ type: 'banner', mesh: banner, seed: i });
      }
    }

    // 3. 左右两侧防卫石塔 (Stone Watchtowers)
    [-35, 35].forEach(tx => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 24, 16), stoneMat);
      tower.position.set(tx, 12, 1);
      colGroup.add(tower);

      const towerRoof = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2, 16), darkStoneMat);
      towerRoof.position.set(tx, 24.5, 1);
      colGroup.add(towerRoof);

      const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), goldMat);
      star.position.set(tx, 27.5, 1);
      colGroup.add(star);
    });

    // 4. 中央凯旋拱顶上的巨型金色星之勋章
    const centerStar = new THREE.Mesh(new THREE.OctahedronGeometry(2.4), goldMat);
    centerStar.position.set(0, 19.5, 2.5);
    colGroup.add(centerStar);

    group.add(colGroup);
    return colGroup;
  }

  return {
    WORLD_CONFIGS,
    createWorld
  };
})();

if (typeof window !== 'undefined') window.KirbyWorlds = KirbyWorlds;
if (typeof module !== 'undefined' && module.exports) module.exports = KirbyWorlds;
