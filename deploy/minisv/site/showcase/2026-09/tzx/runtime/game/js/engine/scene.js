// js/engine/scene.js - 3D 月球战场、宇宙星空与物理边界渲染系统

class GameScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 场景元素
    this.moonGround = null;
    this.earthMesh = null;
    this.starPoints = null;
    this.boundaryField = null;
    this.arenaRadius = 45; // 战斗圈半径

    // 陨石列表
    this.meteors = [];

    // 粒子系统
    this.particles = [];

    // 摄像机控制状态
    this.cameraYaw = 0; // 水平角度
    this.cameraPitch = 0.16; // 俯仰角 (弧度)
    this.cameraDistance = 14.0;
    this.cameraHeightOffset = 3.0;

    // 三角洲战术据点地标数据与网格集合
    this.outposts = {
      alpha: { id: 'alpha', name: 'Alpha 补给前哨', pos: new THREE.Vector3(-18, 0, 4), color: 0x00f0ff },
      bravo: { id: 'bravo', name: 'Bravo 雷达阵列', pos: new THREE.Vector3(20, 0, -10), color: 0xffaa00 },
      charlie: { id: 'charlie', name: 'Charlie 反应堆终端', pos: new THREE.Vector3(0, 0, -28), color: 0xff3366 }
    };
    this.outpostMeshes = [];

    // 战术声呐脉冲扫描光波对象
    this.sonarWave = null;

    // 3D 掉落 Boss 钥匙对象
    this.bossKeyDrop = null;

    // 天基 3D 光柱信标与全息路标集合
    this.skyBeacons = [];

    this.init();
  }

  init() {
    // 1. 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050818);
    this.scene.fog = new THREE.FogExp2(0x060918, 0.008);

    // 2. 摄像机
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 10);

    // 3. 渲染器 (自动根据设备调整画质)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 800;
    this.renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2.0));
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. 灯光
    this.setupLighting();

    // 5. 宇宙与星空背景、地球
    this.createCosmicSky();

    // 6. 月球地形与环形山
    this.createMoonTerrain();
    // 地球放在地面之后加入，避免被月面深度缓冲遮住。
    if (this.earthMesh) this.scene.add(this.earthMesh);

    // 7. 环形防护力场边界
    this.createBoundaryField();

    // 8. 创建三大战术据点与主控终端机
    this.createOutposts();

    // 9. 窗口尺寸监听
    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  setupLighting() {
    // 宇宙微弱环境光（偏冷蓝）
    const ambientLight = new THREE.AmbientLight(0x1a264a, 1.2);
    this.scene.add(ambientLight);

    // 类似太阳方向光，照亮月球与角色，投射阴影
    const dirLight = new THREE.DirectionalLight(0xddeeff, 2.0);
    dirLight.position.set(40, 60, -30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -45;
    dirLight.shadow.camera.right = 45;
    dirLight.shadow.camera.top = 45;
    dirLight.shadow.camera.bottom = -45;
    this.scene.add(dirLight);

    // 幽蓝地平线补充点光
    const blueFillLight = new THREE.PointLight(0x00f0ff, 1.5, 90);
    blueFillLight.position.set(-20, 10, 20);
    this.scene.add(blueFillLight);
  }

  createCosmicSky() {
    // 1. 繁星背景
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 250 + Math.random() * 80;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 10; // 大多在水平面以上
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // 星光微弱蓝紫白偏色
      const colChoice = Math.random();
      if (colChoice > 0.7) {
        colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0;
      } else if (colChoice > 0.4) {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 0.6;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });
    this.starPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starPoints);

    // 2. 悬空高精度蔚蓝母星（地球）
    const earthGeo = new THREE.SphereGeometry(22, 32, 32);
    // 生成带云层质感的地球贴图
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 512;
    earthCanvas.height = 256;
    const ctx = earthCanvas.getContext('2d');
    // 海洋底色
    ctx.fillStyle = '#0b4ca1';
    ctx.fillRect(0, 0, 512, 256);
    // 大陆斑块
    ctx.fillStyle = '#39a46b';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, 20 + Math.random() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    // 白云
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, 15 + Math.random() * 35, 0, Math.PI * 2);
      ctx.fill();
    }
    const earthTex = new THREE.CanvasTexture(earthCanvas);
    const earthMat = new THREE.MeshBasicMaterial({ map: earthTex, depthTest: false, depthWrite: false });
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthMesh.renderOrder = 5;
    // 放在默认第三人称视野的左上方，确保战斗中能认出月球与地球的关系。
    this.earthMesh.position.set(-20, 5, 0);
    this.earthMesh.scale.setScalar(0.25);

    // 地球外圈淡蓝大气辉光
    const glowGeo = new THREE.SphereGeometry(23.5, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x33aaff,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide
    });
    const earthGlow = new THREE.Mesh(glowGeo, glowMat);
    this.earthMesh.add(earthGlow);
  }

  createMoonTerrain() {
    // 动态生成细腻高品质月球沙尘地貌 (避免突兀黑斑与波点)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 月球深灰微蓝基底
    const baseGrad = ctx.createLinearGradient(0, 0, 512, 512);
    baseGrad.addColorStop(0, '#1c2230');
    baseGrad.addColorStop(0.5, '#222838');
    baseGrad.addColorStop(1, '#1e2434');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 512, 512);

    // 细微月壤沙砾微粒
    for (let i = 0; i < 6000; i++) {
      const brightness = Math.floor(30 + Math.random() * 35);
      ctx.fillStyle = `rgba(${brightness}, ${brightness + 4}, ${brightness + 10}, 0.25)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // 自然柔和月面凹坑 (低对比度，带微光溅射边沿)
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 20 + Math.random() * 40;
      
      // 坑底
      const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
      grad.addColorStop(0, 'rgba(15, 18, 26, 0.45)');
      grad.addColorStop(0.8, 'rgba(25, 30, 42, 0.2)');
      grad.addColorStop(1, 'rgba(45, 55, 75, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // 坑缘亮环
      ctx.strokeStyle = 'rgba(65, 80, 110, 0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    }

    const moonTex = new THREE.CanvasTexture(canvas);
    moonTex.wrapS = THREE.RepeatWrapping;
    moonTex.wrapT = THREE.RepeatWrapping;
    moonTex.repeat.set(4, 4);

    // 月面几何体，轻微顶点起伏
    const groundGeo = new THREE.PlaneGeometry(120, 120, 64, 64);
    groundGeo.rotateX(-Math.PI / 2);

    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // 中间战斗区域平坦，边缘有环形山起伏
      const dist = Math.sqrt(x * x + z * z);
      let y = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 0.4;
      if (dist > this.arenaRadius - 5) {
        y += Math.pow((dist - (this.arenaRadius - 5)) * 0.5, 1.4);
      }
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.9,
      metalness: 0.15
    });

    this.moonGround = new THREE.Mesh(groundGeo, groundMat);
    this.moonGround.receiveShadow = true;
    this.scene.add(this.moonGround);

    // 散落的月球陨石块
    this.createMoonRocks();
  }

  createMoonRocks() {
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3d4352,
      roughness: 0.95
    });

    for (let i = 0; i < 35; i++) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * (this.arenaRadius - 12);
      const scale = 0.6 + Math.random() * 1.5;
      rock.scale.set(scale * (0.8 + Math.random() * 0.4), scale, scale * (0.8 + Math.random() * 0.4));
      rock.position.set(Math.cos(angle) * radius, scale * 0.3, Math.sin(angle) * radius);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  createBoundaryField() {
    // 战斗圈半透明环形全息能量力场（防角色掉出地图）
    const cylinderGeo = new THREE.CylinderGeometry(this.arenaRadius, this.arenaRadius, 14, 48, 1, true);
    cylinderGeo.translate(0, 7, 0);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(256, y);
      ctx.stroke();
    }
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 256);
      ctx.stroke();
    }

    const fieldTex = new THREE.CanvasTexture(canvas);
    fieldTex.wrapS = THREE.RepeatWrapping;
    fieldTex.wrapT = THREE.RepeatWrapping;
    fieldTex.repeat.set(16, 2);

    const fieldMat = new THREE.MeshBasicMaterial({
      map: fieldTex,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.boundaryField = new THREE.Mesh(cylinderGeo, fieldMat);
    this.scene.add(this.boundaryField);
  }

  // 7. 构建三大三角洲战术据点（Alpha/Bravo/Charlie）与中央终端机
  createOutposts() {
    // 通用金属材质与全息发光材质
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a3344, roughness: 0.7, metalness: 0.8 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3b4d66, roughness: 0.6, metalness: 0.5 });

    // A. Alpha 据点 (前哨登陆通信站)
    const alphaGroup = new THREE.Group();
    alphaGroup.position.copy(this.outposts.alpha.pos);

    // 通信天线杆与天线锅
    const mastGeo = new THREE.CylinderGeometry(0.2, 0.4, 6, 8);
    const mast = new THREE.Mesh(mastGeo, metalMat);
    mast.position.y = 3;
    alphaGroup.add(mast);

    const dishGeo = new THREE.CylinderGeometry(1.6, 0.3, 0.4, 16);
    dishGeo.rotateX(Math.PI / 3);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x4a6080, metalness: 0.9, roughness: 0.3 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, 5.8, 0.3);
    alphaGroup.add(dish);

    // 补给集装箱掩体 (为玩家提供切角射击掩护)
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 1.6), crateMat);
    crate1.position.set(-2.5, 0.9, 1.0);
    crate1.rotation.y = 0.3;
    alphaGroup.add(crate1);

    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 2.0), crateMat);
    crate2.position.set(2.2, 0.7, -1.2);
    alphaGroup.add(crate2);

    // Alpha 3D 贯通天际的青色天基光柱与悬浮全息路牌
    const alphaBeacon = this.createSkyBeacon(0x00f0ff, 'ALPHA 营地', '搜寻排查暗哨');
    alphaGroup.add(alphaBeacon);

    this.scene.add(alphaGroup);
    this.outpostMeshes.push(alphaGroup);

    // B. Bravo 据点 (环形山大雷达阵列)
    const bravoGroup = new THREE.Group();
    bravoGroup.position.copy(this.outposts.bravo.pos);

    // 旋转雷达基座与网格锅
    const baseTower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 5, 8), metalMat);
    baseTower.position.y = 2.5;
    bravoGroup.add(baseTower);

    const radarDishGeo = new THREE.SphereGeometry(2.4, 16, 12, 0, Math.PI);
    radarDishGeo.rotateX(-Math.PI / 2);
    const radarMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, wireframe: true });
    this.bravoRadarDish = new THREE.Mesh(radarDishGeo, radarMat);
    this.bravoRadarDish.position.set(0, 5.2, 0);
    bravoGroup.add(this.bravoRadarDish);

    // 防御防爆隔板
    const barrierGeo = new THREE.BoxGeometry(3.5, 1.6, 0.5);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x3d485c, metalness: 0.6 });
    const barrier1 = new THREE.Mesh(barrierGeo, barrierMat);
    barrier1.position.set(0, 0.8, 3.0);
    bravoGroup.add(barrier1);

    // Bravo 3D 琥珀金天基光柱与全息路牌
    const bravoBeacon = this.createSkyBeacon(0xffaa00, 'BRAVO 雷达', '战术警戒防线');
    bravoGroup.add(bravoBeacon);

    this.scene.add(bravoGroup);
    this.outpostMeshes.push(bravoGroup);

    // C. Charlie 据点 (能源裂隙、重装反应堆与主控黑客终端)
    const charlieGroup = new THREE.Group();
    charlieGroup.position.copy(this.outposts.charlie.pos);

    // 巨型反应堆立柱
    const reactorCoreGeo = new THREE.CylinderGeometry(2.2, 2.6, 7, 12);
    const reactorCore = new THREE.Mesh(reactorCoreGeo, metalMat);
    reactorCore.position.y = 3.5;
    charlieGroup.add(reactorCore);

    // 反应堆旋转能量光环
    const ringGeo = new THREE.TorusGeometry(3.0, 0.15, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3366, wireframe: true });
    this.charlieReactorRing = new THREE.Mesh(ringGeo, ringMat);
    this.charlieReactorRing.position.y = 4.0;
    this.charlieReactorRing.rotation.x = Math.PI / 2;
    charlieGroup.add(this.charlieReactorRing);

    // 中央战术终端机 (Terminal) —— 玩家拾取 Boss 密钥后前往此处进行拼写破译！
    const termPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 8), metalMat);
    termPedestal.position.set(0, 0.6, 4.2);
    charlieGroup.add(termPedestal);

    // 全息屏幕
    const screenGeo = new THREE.PlaneGeometry(1.2, 0.8);
    screenGeo.rotateX(-0.3);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const termScreen = new THREE.Mesh(screenGeo, screenMat);
    termScreen.position.set(0, 1.4, 4.2);
    charlieGroup.add(termScreen);

    // Charlie 3D 绯红天基光柱与主控终端全息路牌
    const charlieBeacon = this.createSkyBeacon(0xff3366, 'CHARLIE 反应堆', '密码破译终端');
    charlieBeacon.position.set(0, 0, 4.2); // 准确位于终端机正上方
    charlieGroup.add(charlieBeacon);

    this.terminalWorldPos = new THREE.Vector3(this.outposts.charlie.pos.x, 0, this.outposts.charlie.pos.z + 4.2);

    this.scene.add(charlieGroup);
    this.outpostMeshes.push(charlieGroup);
  }

  // 战术天基光柱与 3D 全息路牌生成器 (Delta Force 战区超远距视觉导引)
  createSkyBeacon(colorHex, labelText, subText) {
    const beaconGroup = new THREE.Group();

    // 1. 垂直贯通天际的能量光柱 (高45米，加法高亮半透明，全图任意角度一眼可辨)
    const beamHeight = 45;
    const beamGeo = new THREE.CylinderGeometry(0.6, 1.5, beamHeight, 16, 1, true);
    beamGeo.translate(0, beamHeight / 2, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const outerBeam = new THREE.Mesh(beamGeo, beamMat);
    beaconGroup.add(outerBeam);

    // 内部高能白炽光芯 (光柱中轴亮线)
    const coreGeo = new THREE.CylinderGeometry(0.16, 0.28, beamHeight, 12, 1, true);
    coreGeo.translate(0, beamHeight / 2, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const coreBeam = new THREE.Mesh(coreGeo, coreMat);
    beaconGroup.add(coreBeam);

    // 2. 地面战术全息扩散光环
    const ringGeo = new THREE.RingGeometry(1.2, 3.8, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const groundRing = new THREE.Mesh(ringGeo, ringMat);
    groundRing.position.y = 0.08;
    beaconGroup.add(groundRing);

    // 3. 悬浮 3D 全息路牌 (Sprite Billboard - 无论视角怎么转都面向玩家)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    const hexStr = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = 'rgba(6, 14, 30, 0.88)';
    ctx.strokeStyle = hexStr;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(8, 8, 240, 80, 10) : ctx.rect(8, 8, 240, 80);
    ctx.fill();
    ctx.stroke();

    // 发光圆标
    ctx.fillStyle = hexStr;
    ctx.shadowColor = hexStr;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(32, 36, 7, 0, Math.PI * 2);
    ctx.fill();

    // 标题文字
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, 48, 42);

    // 副标题
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.fillStyle = '#a0d8ff';
    ctx.shadowBlur = 0;
    ctx.fillText(subText, 48, 70);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const tagSprite = new THREE.Sprite(spriteMat);
    tagSprite.scale.set(7.2, 2.7, 1.0);
    tagSprite.position.set(0, 8.2, 0);
    beaconGroup.add(tagSprite);

    beaconGroup.userData = { groundRing, outerBeam, tagSprite, time: Math.random() * 10 };
    this.skyBeacons.push(beaconGroup);
    return beaconGroup;
  }

  // 战术声呐脉冲扫描触发 (Delta Force 寻敌技能)
  triggerSonarScan(originPos, enemies) {
    if (!this.sonarWave) {
      const ringGeo = new THREE.RingGeometry(0.2, 1.5, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      this.sonarWave = new THREE.Mesh(ringGeo, ringMat);
      this.sonarWave.position.y = 0.15;
      this.scene.add(this.sonarWave);
    }

    this.sonarWave.position.x = originPos.x;
    this.sonarWave.position.z = originPos.z;
    this.sonarWave.scale.set(1, 1, 1);
    this.sonarWave.visible = true;
    this.sonarWaveProgress = 0;

    // 扫描标记周围 50 米内的敌人 (持续 4 秒高亮透视)
    const scannedEnemies = [];
    if (enemies) {
      enemies.forEach(e => {
        if (e.isAlive) {
          const d = originPos.distanceTo(e.mesh.position);
          if (d <= 50) {
            e.isScanned = true;
            e.scannedTimer = 4.0;
            scannedEnemies.push(e);
          }
        }
      });
    }

    return scannedEnemies;
  }

  // 生成 3D 掉落 Boss 钥匙 (Charlie 精英击败后在地面旋转发光)
  spawnBossKeyDrop(pos) {
    if (this.bossKeyDrop) {
      this.scene.remove(this.bossKeyDrop.mesh);
    }

    const keyGroup = new THREE.Group();
    // 金色加密核心芯片
    const chipGeo = new THREE.BoxGeometry(0.8, 0.8, 0.25);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.7,
      metalness: 0.9,
      roughness: 0.2
    });
    const chip = new THREE.Mesh(chipGeo, chipMat);
    keyGroup.add(chip);

    // 金色通天光柱
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.4, 12, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 6;
    keyGroup.add(beam);

    keyGroup.position.set(pos.x, 1.2, pos.z);
    this.scene.add(keyGroup);

    this.bossKeyDrop = {
      mesh: keyGroup,
      isPicked: false
    };
  }

  updateBossKeyDrop(delta, player, onPickup) {
    if (!this.bossKeyDrop || this.bossKeyDrop.isPicked) return;

    this.bossKeyDrop.mesh.rotation.y += 2.0 * delta;
    this.bossKeyDrop.mesh.position.y = 1.2 + Math.sin(Date.now() * 0.004) * 0.25;

    if (player && player.isAlive) {
      const d = player.mesh.position.distanceTo(this.bossKeyDrop.mesh.position);
      if (d < 2.5) {
        this.bossKeyDrop.isPicked = true;
        this.createExplosion(this.bossKeyDrop.mesh.position, 0xffd700, 30);
        this.scene.remove(this.bossKeyDrop.mesh);
        this.bossKeyDrop = null;
        if (onPickup) onPickup();
      }
    }
  }

  // 生成来自木星的冰铁心残骸陨石
  spawnMeteor(count = 1) {
    for (let i = 0; i < count; i++) {
      const radius = 1.2 + Math.random() * 1.0;
      const meteorGeo = new THREE.IcosahedronGeometry(radius, 1);
      
      // 顶点轻微凹凸
      const pos = meteorGeo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const factor = 0.85 + Math.random() * 0.3;
        pos.setXYZ(j, pos.getX(j) * factor, pos.getY(j) * factor, pos.getZ(j) * factor);
      }
      meteorGeo.computeVertexNormals();

      // 木星冰铁心质感（冰蓝与暗铁复合材质）
      const meteorMat = new THREE.MeshStandardMaterial({
        color: 0x6e889e,
        emissive: 0x004488,
        emissiveIntensity: 0.4,
        roughness: 0.6,
        metalness: 0.8
      });

      const mesh = new THREE.Mesh(meteorGeo, meteorMat);
      // 出生在半空并向地面漂移
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * (this.arenaRadius - 10);
      mesh.position.set(Math.cos(angle) * dist, 18 + Math.random() * 8, Math.sin(angle) * dist);
      mesh.castShadow = true;

      // 冰晶尾迹光晕
      const trailLight = new THREE.PointLight(0x00e1ff, 2.0, 12);
      mesh.add(trailLight);

      this.scene.add(mesh);

      this.meteors.push({
        mesh,
        hp: 40,
        radius,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          -4 - Math.random() * 3, // 向下冲撞
          (Math.random() - 0.5) * 2
        ),
        rotSpeed: new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random() * 2)
      });
    }
  }

  updateMeteors(delta, player, onPlayerHit) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.mesh.position.addScaledVector(m.velocity, delta);
      m.mesh.rotation.x += m.rotSpeed.x * delta;
      m.mesh.rotation.y += m.rotSpeed.y * delta;

      // 落地或触碰地面产生冲击
      if (m.mesh.position.y <= m.radius) {
        m.mesh.position.y = m.radius;
        // 落地反弹或碎裂成小漂浮物
        m.velocity.y = Math.abs(m.velocity.y) * 0.35;
        if (m.velocity.lengthSq() < 1.0) {
          m.velocity.set(0, 0, 0);
        }
      }

      // 与玩家碰撞检测
      if (player && player.isAlive) {
        const pPos = player.mesh.position;
        const dist = m.mesh.position.distanceTo(pPos);
        if (dist < m.radius + 1.2) {
          // 木星陨石碰撞：击退并扣血（策划：把人拽入宇宙物理效果）
          const pushDir = new THREE.Vector3().subVectors(pPos, m.mesh.position).normalize();
          pushDir.y = 0.2;
          if (onPlayerHit) onPlayerHit(20, pushDir);
          this.createExplosion(m.mesh.position, 0x00f0ff, 15);
          window.soundSystem.playExplosion();
          
          this.scene.remove(m.mesh);
          this.meteors.splice(i, 1);
          continue;
        }
      }

      // 边界限制
      const distFromCenter = Math.sqrt(m.mesh.position.x ** 2 + m.mesh.position.z ** 2);
      if (distFromCenter > this.arenaRadius) {
        this.scene.remove(m.mesh);
        this.meteors.splice(i, 1);
      }
    }
  }

  // 击中或摧毁陨石
  damageMeteor(meteorIndex, dmg) {
    const m = this.meteors[meteorIndex];
    if (!m) return false;
    m.hp -= dmg;
    // 闪烁冰晶白色
    m.mesh.material.emissive.setHex(0xffffff);
    setTimeout(() => {
      if (m.mesh && m.mesh.material) m.mesh.material.emissive.setHex(0x004488);
    }, 80);

    if (m.hp <= 0) {
      this.createExplosion(m.mesh.position, 0x00f0ff, 25);
      window.soundSystem.playExplosion();
      this.scene.remove(m.mesh);
      this.meteors.splice(meteorIndex, 1);
      return true; // 陨石已碎裂
    }
    return false;
  }

  // 粒子爆炸效果
  createExplosion(position, color = 0x00f0ff, count = 20) {
    const pGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(count * 3);
    const velArr = [];

    for (let i = 0; i < count; i++) {
      posArr[i * 3] = position.x;
      posArr[i * 3 + 1] = position.y;
      posArr[i * 3 + 2] = position.z;

      velArr.push(new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 2,
        (Math.random() - 0.5) * 12
      ));
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const pMat = new THREE.PointsMaterial({
      color: color,
      size: 0.6,
      transparent: true,
      opacity: 1.0
    });

    const pSystem = new THREE.Points(pGeo, pMat);
    this.scene.add(pSystem);

    this.particles.push({
      mesh: pSystem,
      velArr,
      life: 0.6,
      maxLife: 0.6
    });
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const ratio = p.life / p.maxLife;
      p.mesh.material.opacity = ratio;

      const pos = p.mesh.geometry.attributes.position;
      for (let j = 0; j < p.velArr.length; j++) {
        p.velArr[j].y -= 9.8 * delta; // 重力
        pos.setXYZ(
          j,
          pos.getX(j) + p.velArr[j].x * delta,
          pos.getY(j) + p.velArr[j].y * delta,
          pos.getZ(j) + p.velArr[j].z * delta
        );
      }
      pos.needsUpdate = true;
    }
  }

  // 更新第三人称摄像机追踪
  updateCamera(targetPosition, targetHeading) {
    if (!targetPosition) return;

    // 根据摄像机 Yaw 和 Pitch 计算后方位置
    const horizontalDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraPitch) + this.cameraHeightOffset;

    const angle = this.cameraYaw;
    // 相机放在角色后方，和 controls.js 中 yaw=0 的前进方向（-Z）保持一致。
    const targetCamX = targetPosition.x + Math.sin(angle) * horizontalDist;
    const targetCamZ = targetPosition.z + Math.cos(angle) * horizontalDist;
    const targetCamY = targetPosition.y + verticalDist;

    // 平滑跟随插值
    this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.15);

    // 瞄准点设定在角色腰部略高位置
    const lookAtPos = new THREE.Vector3(targetPosition.x, targetPosition.y + 1.4, targetPosition.z);
    this.camera.lookAt(lookAtPos);
  }

  // 瞬间将相机重置至角色后方（关卡加载时瞬间对焦）
  snapCamera(targetPosition) {
    if (!targetPosition) return;
    const horizontalDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraPitch) + this.cameraHeightOffset;
    const angle = this.cameraYaw;
    this.camera.position.set(
      targetPosition.x + Math.sin(angle) * horizontalDist,
      targetPosition.y + verticalDist,
      targetPosition.z + Math.cos(angle) * horizontalDist
    );
    this.camera.lookAt(new THREE.Vector3(targetPosition.x, targetPosition.y + 1.4, targetPosition.z));
  }

  clearMeteors() {
    this.meteors.forEach(m => this.scene.remove(m.mesh));
    this.meteors = [];
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    const delta = this.clock.getDelta();
    // 母星地球微小自转
    if (this.earthMesh) {
      this.earthMesh.rotation.y += 0.0008;
    }
    // 星空缓动
    if (this.starPoints) {
      this.starPoints.rotation.y += 0.0001;
    }

    // Bravo 据点大雷达缓动旋转
    if (this.bravoRadarDish) {
      this.bravoRadarDish.rotation.z += 0.6 * delta;
    }

    // Charlie 据点反应堆光环旋转
    if (this.charlieReactorRing) {
      this.charlieReactorRing.rotation.z += 1.2 * delta;
    }

    // 战术声呐脉冲扩散动画 (Delta Force 寻敌技能波)
    if (this.sonarWave && this.sonarWave.visible) {
      this.sonarWaveProgress += delta * 1.5;
      const curRadius = this.sonarWaveProgress * 48.0;
      this.sonarWave.scale.set(curRadius, curRadius, 1);
      const opacity = Math.max(0, 0.8 * (1.0 - this.sonarWaveProgress));
      this.sonarWave.material.opacity = opacity;

      if (this.sonarWaveProgress >= 1.0) {
        this.sonarWave.visible = false;
      }
    }

    // 战术天基光柱与地面信标环呼吸动画
    if (this.skyBeacons && this.skyBeacons.length > 0) {
      this.skyBeacons.forEach(b => {
        if (!b.userData) return;
        b.userData.time += delta * 2.2;
        const pulse = 1.0 + Math.sin(b.userData.time) * 0.12;
        if (b.userData.groundRing) {
          b.userData.groundRing.scale.set(pulse, pulse, 1);
        }
        if (b.userData.outerBeam) {
          b.userData.outerBeam.material.opacity = 0.28 + Math.sin(b.userData.time * 0.9) * 0.09;
        }
      });
    }

    this.updateParticles(delta);

    this.renderer.render(this.scene, this.camera);
    return delta;
  }
}

window.GameScene = GameScene;
