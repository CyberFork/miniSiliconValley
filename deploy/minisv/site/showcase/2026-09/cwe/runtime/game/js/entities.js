/**
 * 星之卡比 CP版 · 角色、能力、敌人、Boss 与战斗模块 (子棍 4, 5, 6, 7, 8, 9)
 * 纯 3D 萌系卡比模型生成、四名角色专属技能、五大元素复制能力（严格先舍弃再获得）、头部星星与最终 Boss
 */
const KirbyEntities = (() => {
  // 角色专属技能定义
  const CHARACTERS = {
    pink: {
      name: '星之卡比',
      title: '粉红恶魔 · 贪吃勇者',
      bodyColor: 0xff7aa2,
      feetColor: 0xd81b60,
      skillName: '星光膨胀滑翔',
      skillDesc: '最高连续多段跳跃并滞空漂浮滑翔',
      cooldown: 5.0
    },
    meta: {
      name: '魅塔骑士',
      title: '假面剑豪 · 玛赫风暴',
      bodyColor: 0x1a237e,
      feetColor: 0x4a148c,
      skillName: '玛赫龙卷风',
      skillDesc: '拔出宝剑迦拉西亚高速旋风斩，牵引并连续重创周围敌人',
      cooldown: 5.0
    },
    dedede: {
      name: '帝帝帝大王',
      title: '噗噗噗国之王 · 喷射重锤',
      bodyColor: 0x29b6f6,
      feetColor: 0xf57c00,
      skillName: '喷射大锤跃击',
      skillDesc: '点燃推进器火箭跃空重砸，引发全屏毁灭级地裂震荡波',
      cooldown: 6.0
    },
    bandana: {
      name: '头巾瓦豆鲁迪',
      title: '忠诚近卫 · 连环神枪',
      bodyColor: 0xf57c00,
      feetColor: 0xd84315,
      skillName: '连环枪雨',
      skillDesc: '连击突刺化作残影，随后高速向前投掷三枚贯穿透甲飞枪',
      cooldown: 4.5
    },
    yellow: {
      name: '炽焰黄卡比',
      title: '烈火之灵',
      bodyColor: 0xffd54f,
      feetColor: 0xf57c00,
      skillName: '烈焰突刺冲锋',
      skillDesc: '超高速向前冲锋贯穿并击退敌人',
      cooldown: 6.0
    },
    blue: {
      name: '碧海蓝卡比',
      title: '波涛守护者',
      bodyColor: 0x4fc3f7,
      feetColor: 0x0288d1,
      skillName: '蔚蓝星盾',
      skillDesc: '展开 360° 星之护盾，完全免疫伤害并反弹',
      cooldown: 8.0
    },
    green: {
      name: '翠影绿卡比',
      title: '森之愈术师',
      bodyColor: 0x81c784,
      feetColor: 0x388e3c,
      skillName: '愈合之环',
      skillDesc: '释放治愈光环恢复 3 点生命并大幅提升救援速度',
      cooldown: 9.0
    }
  };

  // 六种可获得复制能力定义 (含探索发现多阶能力进化)
  const ABILITIES = {
    sword: {
      name: '利剑',
      color: 0x4caf50,
      auraColor: 0x81c784,
      icon: '⚔️',
      desc: '三连速斩、回旋斩与破甲冲击',
      levels: [
        { level: 1, name: '经典利剑', icon: '⚔️', desc: '快速三连斩与近战压制', color: 0x4caf50 },
        { level: 2, name: '庞大剑 (Gigant)', icon: '🛡️', desc: '重装战盔，破甲重斩带地裂冲击波', color: 0xffb300 },
        { level: 3, name: '摩弗之剑 (Morpho)', icon: '🦋', desc: '冥蝶光翼与暗金魔剑，攻击吸血恢复生命', color: 0xd81b60 }
      ]
    },
    fire: {
      name: '烈火',
      color: 0xff5722,
      auraColor: 0xff9800,
      icon: '🔥',
      desc: '发射火球弹与烈焰吐息，灼烧大范围敌人',
      levels: [
        { level: 1, name: '经典烈火', icon: '🔥', desc: '扇形狂暴烈焰吐息', color: 0xff5722 },
        { level: 2, name: '火山火 (Volcano)', icon: '🌋', desc: '抛射火山熔岩爆石，大范围持续灼烧', color: 0xe64a19 },
        { level: 3, name: '龙之火 (Dragon)', icon: '🐉', desc: '紫炎飞龙长程激光吐息，冲刺留火海', color: 0x8e24aa }
      ]
    },
    ice: {
      name: '冰',
      color: 0x4dd0e1,
      auraColor: 0xb2ebf2,
      icon: '❄️',
      desc: '喷射冰晶风暴，将敌人冰冻减速并碎裂爆伤',
      levels: [
        { level: 1, name: '冰霜晶雪', icon: '❄️', desc: '冰冻敌人并造成减速', color: 0x4dd0e1 },
        { level: 2, name: '暴风雪 (Frost)', icon: '🌨️', desc: '制造冰墙棱镜与连续寒气风暴', color: 0x00bcd4 },
        { level: 3, name: '狂野冰霜 (Wild)', icon: '🧊', desc: '雪怪冰块投掷与全屏绝对零度', color: 0x00838f }
      ]
    },
    spark: {
      name: '电',
      color: 0xffeb3b,
      auraColor: 0xfff59d,
      icon: '⚡',
      desc: '周身爆发出 360° 环形球状高压闪电雷暴'
    },
    water: {
      name: '水',
      color: 0x29b6f6,
      auraColor: 0x81d4fa,
      icon: '💧',
      desc: '释放奔腾涌动的水龙卷与水珠冲击波'
    },
    shadow: {
      name: '暗影',
      color: 0x7e57c2,
      auraColor: 0xb39ddb,
      icon: '🔮',
      desc: '挥出撕裂虚空的追踪暗夜月牙飞刃'
    }
  };

  // ---------------- 封面海报 1:1 原画级生成工具：立体胖胖五角星与高清纹理 ----------------
  function createPuffyStarGeometry(outerR = 0.22, innerR = 0.095, depth = 0.06) {
    const shape = new THREE.Shape();
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const r = (i % 2 === 0) ? outerR : innerR;
      const x = Math.sin(angle) * r;
      const y = Math.cos(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    return geo;
  }

  let cachedHeadbandTex = null;
  function getHeadbandCanvasTexture() {
    if (cachedHeadbandTex) return cachedHeadbandTex;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const canvas = document.createElement('canvas');
    if (!canvas || !canvas.getContext) return null;
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (ctx.createLinearGradient) {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 128);
      bgGrad.addColorStop(0, '#9e1224');
      bgGrad.addColorStop(0.15, '#c62828');
      bgGrad.addColorStop(0.5, '#d32f2f');
      bgGrad.addColorStop(0.85, '#c62828');
      bgGrad.addColorStop(1, '#8e001a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 128);
    } else if (ctx.fillRect) {
      ctx.fillStyle = '#c62828';
      ctx.fillRect(0, 0, 512, 128);
    }

    if (ctx.fillRect) {
      ctx.fillStyle = '#7f0000';
      ctx.fillRect(0, 0, 512, 6);
      ctx.fillRect(0, 122, 512, 6);
      ctx.fillStyle = '#ef5350';
      ctx.fillRect(0, 7, 512, 2);
      ctx.fillRect(0, 119, 512, 2);

      for (let x = 0; x < 512; x += 8) {
        ctx.fillStyle = 'rgba(74, 0, 10, 0.45)';
        ctx.fillRect(x, 10, 3, 108);
        ctx.fillStyle = 'rgba(255, 138, 128, 0.55)';
        ctx.fillRect(x + 3, 10, 2, 108);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x + 1, 10 + (x % 16), 1, 2);
      }
    }

    cachedHeadbandTex = new THREE.CanvasTexture(canvas);
    cachedHeadbandTex.wrapS = THREE.RepeatWrapping;
    cachedHeadbandTex.wrapT = THREE.ClampToEdgeWrapping;
    cachedHeadbandTex.repeat.set(6, 1);
    return cachedHeadbandTex;
  }

  let cachedLeftEyeTex = null;
  let cachedRightEyeTex = null;
  function getKirbyEyeCanvasTexture(isLeft = true) {
    if (isLeft && cachedLeftEyeTex) return cachedLeftEyeTex;
    if (!isLeft && cachedRightEyeTex) return cachedRightEyeTex;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const canvas = document.createElement('canvas');
    if (!canvas || !canvas.getContext) return null;
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (ctx.clearRect) ctx.clearRect(0, 0, 256, 384);

    if (ctx.save) ctx.save();
    if (ctx.beginPath) {
      ctx.beginPath();
      if (ctx.ellipse) {
        ctx.ellipse(128, 192, 112, 176, 0, 0, Math.PI * 2);
      } else if (ctx.arc) {
        ctx.arc(128, 192, 112, 0, Math.PI * 2);
      }
      if (ctx.closePath) ctx.closePath();
      if (ctx.clip) ctx.clip();
    }

    if (ctx.fillRect) {
      ctx.fillStyle = '#060d21';
      ctx.fillRect(0, 0, 256, 384);
    }

    if (ctx.createLinearGradient) {
      const irisGrad = ctx.createLinearGradient(128, 170, 128, 384);
      irisGrad.addColorStop(0, '#0d47a1');
      irisGrad.addColorStop(0.4, '#1976d2');
      irisGrad.addColorStop(0.75, '#0288d1');
      irisGrad.addColorStop(1, '#00e5ff');
      ctx.fillStyle = irisGrad;
    } else {
      ctx.fillStyle = '#1565c0';
    }
    if (ctx.beginPath) {
      ctx.beginPath();
      if (ctx.ellipse) {
        ctx.ellipse(128, 256, 96, 116, 0, 0, Math.PI * 2);
      } else if (ctx.arc) {
        ctx.arc(128, 256, 96, 0, Math.PI * 2);
      }
      if (ctx.fill) ctx.fill();
    }

    const hlX = isLeft ? 154 : 102;
    const hlY = 118;
    ctx.fillStyle = '#ffffff';
    if (ctx.beginPath) {
      ctx.beginPath();
      if (ctx.ellipse) {
        ctx.ellipse(hlX, hlY, 44, 62, isLeft ? -0.15 : 0.15, 0, Math.PI * 2);
      } else if (ctx.arc) {
        ctx.arc(hlX, hlY, 44, 0, Math.PI * 2);
      }
      if (ctx.fill) ctx.fill();
    }

    const hl2X = isLeft ? 84 : 172;
    const hl2Y = 276;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    if (ctx.beginPath) {
      ctx.beginPath();
      if (ctx.ellipse) {
        ctx.ellipse(hl2X, hl2Y, 18, 26, 0, 0, Math.PI * 2);
      } else if (ctx.arc) {
        ctx.arc(hl2X, hl2Y, 18, 0, Math.PI * 2);
      }
      if (ctx.fill) ctx.fill();
    }

    if (ctx.restore) ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    if (isLeft) cachedLeftEyeTex = tex;
    else cachedRightEyeTex = tex;
    return tex;
  }

  let cachedBlushTex = null;
  function getKirbyBlushCanvasTexture() {
    if (cachedBlushTex) return cachedBlushTex;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const canvas = document.createElement('canvas');
    if (!canvas || !canvas.getContext) return null;
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (ctx.clearRect) ctx.clearRect(0, 0, 128, 128);

    if (ctx.createRadialGradient) {
      const radGrad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
      radGrad.addColorStop(0, 'rgba(255, 64, 129, 0.88)');
      radGrad.addColorStop(0.4, 'rgba(255, 64, 129, 0.65)');
      radGrad.addColorStop(0.75, 'rgba(255, 82, 140, 0.28)');
      radGrad.addColorStop(1, 'rgba(255, 82, 140, 0)');
      ctx.fillStyle = radGrad;
      if (ctx.beginPath) {
        ctx.beginPath();
        if (ctx.arc) ctx.arc(64, 64, 62, 0, Math.PI * 2);
        if (ctx.fill) ctx.fill();
      }
    } else if (ctx.fillRect) {
      ctx.fillStyle = '#ff4081';
      ctx.fillRect(16, 16, 96, 96);
    }

    cachedBlushTex = new THREE.CanvasTexture(canvas);
    return cachedBlushTex;
  }

  // ---------------- 3D 卡比模型构造器 (含塞满嘴变形与超级剑) ----------------
  function createKirbyModel(charKey = 'pink') {
    const cfg = CHARACTERS[charKey] || CHARACTERS.pink;
    const group = new THREE.Group();
    group.name = 'KirbyRig';

    // 1. 常规卡比部件组
    const normalGroup = new THREE.Group();
    normalGroup.name = 'NormalGroup';
    group.add(normalGroup);

    // 身体 (超光滑高细分球体 64x52 - PBR Fake SSS 次表面漫透光，呈现桃皮绒面与内部温润透光感)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      emissive: (charKey === 'pink' ? 0xff4081 : 0x000000),
      emissiveIntensity: 0.09, // 模拟阳光穿透半透皮肤的柔和蜜桃色内发光
      roughness: 0.35,
      metalness: 0.02
    });
    const bodyGeo = new THREE.SphereGeometry(0.85, 64, 52);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 0.85;
    normalGroup.add(body);

    // 眼睛 (五层任天堂原版卡比高透水润眼眸：深邃墨蓝底 + 双阶宝蓝虹膜 + 水润高反光凸透角膜 + 双重纯白反光高光 + 柔嫩颊红)
    const eyeBaseMat = new THREE.MeshBasicMaterial({ color: 0x050b1a });
    const eyeMat = eyeBaseMat;
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x1565c0 });
    const eyeIrisBrightMat = new THREE.MeshBasicMaterial({ color: 0x29b6f6 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xff4081, roughness: 0.32, metalness: 0.02 });
    const corneaMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.03,
      metalness: 0.08,
      transparent: true,
      opacity: 0.28
    });

    function addEye(xOffset) {
      const isLeft = xOffset < 0;
      const eyeTex = getKirbyEyeCanvasTexture(isLeft);
      const blushTex = getKirbyBlushCanvasTexture();

      // 1. 底层墨蓝眼眶基底与水润虹膜/高光 (若 Canvas 纹理可用则使用高透贴图，否则降级为多层几何体)
      if (eyeTex) {
        const eyeDecal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.24, 0.36),
          new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true, depthWrite: false })
        );
        eyeDecal.position.set(xOffset, 0.98, 0.806);
        eyeDecal.rotation.y = xOffset * 0.32;
        eyeDecal.rotation.x = -0.15;
        normalGroup.add(eyeDecal);
      } else {
        const eyeGeo = new THREE.SphereGeometry(0.125, 24, 20);
        const eye = new THREE.Mesh(eyeGeo, eyeBaseMat);
        eye.scale.set(0.72, 1.55, 0.42);
        eye.position.set(xOffset, 0.98, 0.77);
        normalGroup.add(eye);

        const irisOuter = new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 14), eyeIrisMat);
        irisOuter.scale.set(0.75, 0.88, 0.36);
        irisOuter.position.set(xOffset, 0.91, 0.81);
        normalGroup.add(irisOuter);

        const irisInner = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), eyeIrisBrightMat);
        irisInner.scale.set(0.75, 0.75, 0.35);
        irisInner.position.set(xOffset, 0.88, 0.82);
        normalGroup.add(irisInner);

        const hlMain = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 12), eyeWhiteMat);
        hlMain.position.set(xOffset + (xOffset > 0 ? 0.015 : -0.015), 1.08, 0.835);
        normalGroup.add(hlMain);

        const hlSec = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), eyeWhiteMat);
        hlSec.position.set(xOffset + (xOffset > 0 ? -0.025 : 0.025), 0.94, 0.835);
        normalGroup.add(hlSec);
      }

      // 2. 仿玻璃凸透镜晶状角膜 (实时捕捉 4K 阳光反射高光与环境漫反射)
      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), corneaMat);
      cornea.scale.set(0.74, 1.58, 0.44);
      cornea.position.set(xOffset, 0.98, 0.806);
      normalGroup.add(cornea);

      // 3. 招牌柔和羽化蜜桃腮红 (Soft feathered peach blush)
      if (blushTex) {
        const blushDecal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.38, 0.20),
          new THREE.MeshBasicMaterial({ map: blushTex, transparent: true, opacity: 0.85, depthWrite: false })
        );
        blushDecal.position.set(xOffset * 1.85, 0.79, 0.715);
        blushDecal.rotation.y = xOffset * 0.58;
        blushDecal.rotation.x = 0.07;
        normalGroup.add(blushDecal);
      } else {
        const blush = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), blushMat);
        blush.scale.set(1.5, 0.55, 0.3);
        blush.position.set(xOffset * 1.88, 0.80, 0.73);
        normalGroup.add(blush);
      }
    }
    addEye(-0.25);
    addEye(0.25);

    // 海报同款大张开的开心笑嘴 (深暗红口腔 + 饱满粉润小舌头)
    const mouthGroup = new THREE.Group();
    mouthGroup.name = 'HappyMouth';
    mouthGroup.position.set(0, 0.74, 0.80);

    const mouthCavity = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 16, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x4a0012 })
    );
    mouthCavity.rotation.x = -Math.PI / 2;
    mouthGroup.add(mouthCavity);

    const mouthLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.016, 10, 24, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x880e4f })
    );
    mouthLip.rotation.x = -Math.PI / 2;
    mouthLip.position.set(0, 0, 0.01);
    mouthGroup.add(mouthLip);

    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff4081 })
    );
    tongue.scale.set(1.2, 0.55, 0.9);
    tongue.position.set(0, -0.035, 0.02);
    mouthGroup.add(tongue);

    normalGroup.add(mouthGroup);

    // 小巧的可爱手手 (左右两只)
    const handGeo = new THREE.SphereGeometry(0.28, 24, 20);
    const handMat = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      roughness: 0.38,
      metalness: 0.03
    });
    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(-0.95, 0.85, 0.1);
    leftHand.castShadow = true;
    normalGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.set(0.95, 0.85, 0.1);
    rightHand.castShadow = true;
    normalGroup.add(rightHand);

    // 红色/专属色彩饱满大脚丫 (左右两只)
    const footGeo = new THREE.SphereGeometry(0.38, 26, 22);
    const footMat = new THREE.MeshStandardMaterial({
      color: cfg.feetColor,
      roughness: 0.30,
      metalness: 0.05
    });
    
    const leftFoot = new THREE.Mesh(footGeo, footMat);
    leftFoot.scale.set(1.0, 0.65, 1.4);
    leftFoot.position.set(-0.45, 0.22, 0.15);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;
    normalGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, footMat);
    rightFoot.scale.set(1.0, 0.65, 1.4);
    rightFoot.position.set(0.45, 0.22, 0.15);
    rightFoot.castShadow = true;
    rightFoot.receiveShadow = true;
    normalGroup.add(rightFoot);

    // 封面海报 1:1 专属还原：鲜红织物勇者战意头巾 + 正中立体 3D 胖胖金星徽章
    if (!['meta', 'dedede', 'bandana'].includes(charKey)) {
      const warriorHeadbandGroup = new THREE.Group();
      warriorHeadbandGroup.name = 'WarriorHeadband_Cover';

      const bandTex = getHeadbandCanvasTexture();
      const bandMat = new THREE.MeshStandardMaterial({
        color: 0xd32f2f,
        roughness: 0.42,
        metalness: 0.05,
        map: bandTex || null
      });

      // 鲜红战意头巾主圈 (带真实微细罗纹编织与受光)
      const bandRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.078, 14, 48), bandMat);
      bandRing.rotation.x = Math.PI / 2.3;
      bandRing.position.set(0, 1.18, 0.02);
      bandRing.castShadow = true;
      warriorHeadbandGroup.add(bandRing);

      // 上下两侧编织压边边圈 (Ribbed stitching 细节)
      const stitchMat = new THREE.MeshStandardMaterial({ color: 0x8e001a, roughness: 0.55 });
      const topStitch = new THREE.Mesh(new THREE.TorusGeometry(0.863, 0.018, 8, 48), stitchMat);
      topStitch.rotation.x = Math.PI / 2.3;
      topStitch.position.set(0, 1.23, 0.01);
      warriorHeadbandGroup.add(topStitch);

      const bottomStitch = new THREE.Mesh(new THREE.TorusGeometry(0.863, 0.018, 8, 48), stitchMat);
      bottomStitch.rotation.x = Math.PI / 2.3;
      bottomStitch.position.set(0, 1.13, 0.03);
      warriorHeadbandGroup.add(bottomStitch);

      // 后脑勺扎带结与双飘带
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), bandMat);
      knot.position.set(0, 1.15, -0.84);
      warriorHeadbandGroup.add(knot);

      [-0.1, 0.1].forEach(kx => {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.035), bandMat);
        ribbon.position.set(kx, 0.93, -0.88);
        ribbon.rotation.z = kx > 0 ? -0.35 : 0.35;
        ribbon.rotation.x = 0.25;
        ribbon.castShadow = true;
        warriorHeadbandGroup.add(ribbon);
      });

      // 正中立体 3D 胖胖金色五角星徽章 (完全吻合海报特写，丰满圆润倒角)
      const starGeo = createPuffyStarGeometry(0.24, 0.11, 0.07);
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffa000,
        emissiveIntensity: 0.45,
        metalness: 0.88,
        roughness: 0.16
      });
      const starEmblem = new THREE.Mesh(starGeo, starMat);
      starEmblem.position.set(0, 1.25, 0.86);
      starEmblem.rotation.x = 0.18; // 贴合额头弧度前倾
      starEmblem.castShadow = true;
      warriorHeadbandGroup.add(starEmblem);

      normalGroup.add(warriorHeadbandGroup);
    }

    // 脚底地面柔和环境接触阴影 (Contact Shadow)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide
    });
    const groundShadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.set(0, 0.02, 0);
    group.add(groundShadow);

    // 能力帽子装饰挂载节点 (当获得利剑、火、冰等时动态展示)
    const hatHolder = new THREE.Group();
    hatHolder.name = 'HatHolder';
    hatHolder.position.set(0, 1.6, 0);
    normalGroup.add(hatHolder);

    // 梦幻四天王专属外观装扮 (魅塔骑士 / 帝帝帝大王 / 头巾瓦豆鲁迪)
    if (charKey === 'meta') {
      // 魅塔骑士：银亮假面具、黄色锐利双眼、暗蓝披风、恶魔蝙蝠翼、迦拉西亚金剑
      const maskMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.85, roughness: 0.25 });
      const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.82, 16, 1, false, -Math.PI * 0.42, Math.PI * 0.84), maskMat);
      mask.position.set(0, 0.9, 0.22);
      normalGroup.add(mask);

      // 黄色狭长目光
      const mEyeMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
      [-0.22, 0.22].forEach(x => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), mEyeMat);
        eye.rotation.z = x > 0 ? 0.25 : -0.25;
        eye.position.set(x, 0.98, 0.9);
        normalGroup.add(eye);
      });

      // 披风与暗紫恶魔翼
      const cape = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.55 }));
      cape.position.set(0, 0.72, -0.72);
      normalGroup.add(cape);

      const wingMat = new THREE.MeshStandardMaterial({ color: 0x311b92, roughness: 0.45, metalness: 0.15 });
      [-1, 1].forEach(dir => {
        const wing = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), wingMat);
        wing.scale.set(1.2, 0.4, 0.12);
        wing.position.set(dir * 1.05, 1.15, -0.65);
        wing.rotation.z = dir * 0.35;
        normalGroup.add(wing);
      });

      // 宝剑迦拉西亚 (Galaxia)
      const galaxia = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.06), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.88, roughness: 0.18 }));
      blade.position.y = 0.65;
      galaxia.add(blade);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xff9800, metalness: 0.8, roughness: 0.25 }));
      cross.position.y = 0.1;
      galaxia.add(cross);
      const ruby = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd50000, emissive: 0xb71c1c, emissiveIntensity: 0.7, roughness: 0.2 }));
      ruby.position.set(0, 0.1, 0.06);
      galaxia.add(ruby);
      galaxia.position.set(1.1, 0.7, 0.3);
      galaxia.rotation.x = 0.4;
      normalGroup.add(galaxia);

    } else if (charKey === 'dedede') {
      // 帝帝帝大王：霸气大体型、红白王袍、黄色鸟喙、蓝色国王睡帽、喷射大锤
      body.scale.set(1.2, 1.15, 1.2);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.58, 16), new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.35 }));
      beak.rotation.x = Math.PI / 2;
      beak.scale.set(1.1, 0.55, 1.0);
      beak.position.set(0, 0.75, 0.98);
      normalGroup.add(beak);

      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.06, 1.15, 20, 1, true, Math.PI * 0.3, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.55 }));
      robe.position.set(0, 0.82, -0.05);
      normalGroup.add(robe);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.15, 10, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 1.28, 0);
      normalGroup.add(collar);

      const crownCap = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.45 }));
      crownCap.position.set(0, 1.55, 0);
      normalGroup.add(crownCap);
      const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
      pompom.position.set(0, 2.15, 0);
      normalGroup.add(pompom);

      // 标志性喷射大锤 (Jet Hammer)
      const hammer = new THREE.Group();
      const hHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 }));
      hammer.add(hHandle);
      const hHead = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.1, 20), new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.5 }));
      hHead.rotation.z = Math.PI / 2;
      hHead.position.set(0, 0.7, 0);
      hammer.add(hHead);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x424242, metalness: 0.85, roughness: 0.25 }));
      nozzle.position.set(0, 0.7, -0.65);
      nozzle.rotation.x = Math.PI / 2;
      hammer.add(nozzle);
      hammer.position.set(1.25, 0.8, 0.2);
      hammer.rotation.x = 0.5;
      normalGroup.add(hammer);

    } else if (charKey === 'bandana') {
      // 头巾瓦豆鲁迪：米色面庞、醒目皇家蓝扎头巾、近卫金锋长枪
      const facePlate = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffe0b2, roughness: 0.5 }));
      facePlate.scale.set(0.9, 0.85, 0.35);
      facePlate.position.set(0, 0.88, 0.58);
      normalGroup.add(facePlate);

      const bandanaBand = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.12, 10, 24), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 }));
      bandanaBand.rotation.x = Math.PI / 2;
      bandanaBand.position.set(0, 1.25, 0.05);
      normalGroup.add(bandanaBand);

      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 }));
      knot.position.set(0, 1.25, -0.8);
      normalGroup.add(knot);

      [-0.15, 0.15].forEach(x => {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.06), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 }));
        tail.rotation.z = x > 0 ? -0.4 : 0.4;
        tail.position.set(x, 1.05, -0.85);
        normalGroup.add(tail);
      });

      const spear = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 10), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 }));
      shaft.position.y = 0.8;
      spear.add(shaft);
      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.9, roughness: 0.18 }));
      spearTip.position.y = 1.95;
      spear.add(spearTip);
      spear.position.set(1.05, 0.7, 0.2);
      spear.rotation.x = 0.3;
      normalGroup.add(spear);
    }

    // 2. 《探索发现》汽车塞满嘴 (Car Mouth) 专属 3D 模型
    const carMouthGroup = new THREE.Group();
    carMouthGroup.name = 'CarMouthGroup';
    carMouthGroup.visible = false;
    group.add(carMouthGroup);

    // 经典复古淡蓝车身
    const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, metalness: 0.65, roughness: 0.28 });
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.3), carBodyMat);
    carBody.position.set(0, 0.35, 0);
    carMouthGroup.add(carBody);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.85, roughness: 0.2 }));
    bumper.position.set(0, 0.25, 1.2);
    carMouthGroup.add(bumper);

    // 4个旋转车轮
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.8 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xffea00, metalness: 0.8, roughness: 0.2 });
    const carWheels = [];
    [[-0.85, 0.25, 0.75], [0.85, 0.25, 0.75], [-0.85, 0.25, -0.75], [0.85, 0.25, -0.75]].forEach(pos => {
      const wGroup = new THREE.Group();
      wGroup.position.set(pos[0], pos[1], pos[2]);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), wheelMat);
      tire.rotation.z = Math.PI / 2;
      wGroup.add(tire);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), hubMat);
      wGroup.add(hub);
      carMouthGroup.add(wGroup);
      carWheels.push(wGroup);
    });

    // 卡比粉色膨胀包裹车顶的巨大肚子
    const carKirbyBelly = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 28, 24),
      new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.38, metalness: 0.03 })
    );
    carKirbyBelly.scale.set(1.08, 0.72, 1.35);
    carKirbyBelly.position.set(0, 0.82, -0.05);
    carMouthGroup.add(carKirbyBelly);

    // 挡风玻璃上的卡比大眼睛
    [-0.32, 0.32].forEach(x => {
      const cEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), eyeMat);
      cEye.scale.set(0.8, 1.5, 0.3);
      cEye.position.set(x, 0.98, 0.92);
      carMouthGroup.add(cEye);
      const cHl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeWhiteMat);
      cHl.position.set(x, 1.06, 0.98);
      carMouthGroup.add(cHl);
      const cBlush = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), blushMat);
      cBlush.scale.set(1.4, 0.6, 0.3);
      cBlush.position.set(x * 1.7, 0.82, 0.88);
      carMouthGroup.add(cBlush);
    });

    // 车身两侧卡比扒住车门的小手
    [-1.05, 1.05].forEach(x => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), handMat);
      h.position.set(x, 0.72, 0.1);
      carMouthGroup.add(h);
    });

    // 前照车灯与后排气管
    [-0.55, 0.55].forEach(x => {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff59d, emissive: 0xffea00, emissiveIntensity: 0.8 }));
      light.position.set(x, 0.38, 1.15);
      carMouthGroup.add(light);
    });
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xff9800 });
    [-0.45, 0.45].forEach(x => {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 10), exhaustMat);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(x, 0.25, -1.2);
      carMouthGroup.add(ex);
    });

    // 3. 《探索发现》三角锥塞满嘴 (Cone Mouth) 专属 3D 模型
    const coneMouthGroup = new THREE.Group();
    coneMouthGroup.name = 'ConeMouthGroup';
    coneMouthGroup.visible = false;
    group.add(coneMouthGroup);

    const coneYellowMat = new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.35, metalness: 0.1 });
    const coneTip = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.7, 24), coneYellowMat);
    coneTip.position.set(0, 1.25, 0);
    coneMouthGroup.add(coneTip);

    const coneStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    coneStripe.position.set(0, 1.12, 0);
    coneMouthGroup.add(coneStripe);

    const coneBelly = new THREE.Mesh(new THREE.SphereGeometry(0.92, 24, 20), new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.38, metalness: 0.03 }));
    coneBelly.scale.set(1.15, 0.82, 1.15);
    coneBelly.position.set(0, 0.65, 0);
    coneMouthGroup.add(coneBelly);

    [-0.26, 0.26].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), eyeMat);
      eye.scale.set(0.8, 1.4, 0.3);
      eye.position.set(x, 0.68, 0.88);
      coneMouthGroup.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeWhiteMat);
      hl.position.set(x, 0.75, 0.94);
      coneMouthGroup.add(hl);
    });
    const coneBase = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.15, 1.35), coneYellowMat);
    coneBase.position.set(0, 0.15, 0);
    coneMouthGroup.add(coneBase);

    // 4. 《探索发现》自动贩卖机塞满嘴 (Vending Mouth) 专属 3D 模型
    const vendingMouthGroup = new THREE.Group();
    vendingMouthGroup.name = 'VendingMouthGroup';
    vendingMouthGroup.visible = false;
    group.add(vendingMouthGroup);

    const vendingBodyMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, metalness: 0.55, roughness: 0.28 });
    const vendingBox = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.85, 1.05), vendingBodyMat);
    vendingBox.position.set(0, 1.0, 0);
    vendingMouthGroup.add(vendingBox);

    // 贩卖机顶端被卡比粉色膨胀肚皮包裹覆盖
    const vendingKirbyTop = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 20), new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.38, metalness: 0.03 }));
    vendingKirbyTop.scale.set(1.15, 0.65, 1.15);
    vendingKirbyTop.position.set(0, 1.82, 0);
    vendingMouthGroup.add(vendingKirbyTop);

    // 卡比的大眼睛与腮红嵌在正面
    [-0.26, 0.26].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), eyeMat);
      eye.scale.set(0.8, 1.45, 0.3);
      eye.position.set(x, 1.75, 0.58);
      vendingMouthGroup.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeWhiteMat);
      hl.position.set(x, 1.82, 0.64);
      vendingMouthGroup.add(hl);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), blushMat);
      blush.scale.set(1.3, 0.55, 0.3);
      blush.position.set(x * 1.8, 1.62, 0.56);
      vendingMouthGroup.add(blush);
    });

    // 贩卖机展示柜玻璃与饮料罐模型
    const showcase = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0xe0f7fa }));
    showcase.position.set(0, 1.15, 0.54);
    vendingMouthGroup.add(showcase);
    [-0.32, 0, 0.32].forEach((cx, idx) => {
      const canMat = new THREE.MeshBasicMaterial({ color: [0xff1744, 0xffeb3b, 0x00e676][idx] });
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 10), canMat);
      can.position.set(cx, 1.15, 0.56);
      vendingMouthGroup.add(can);
    });

    // 出货口与退币槽
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.15), new THREE.MeshBasicMaterial({ color: 0x212121 }));
    chute.position.set(0, 0.38, 0.52);
    vendingMouthGroup.add(chute);

    // 贩卖机两侧抓着机身的小手与底下粉红大脚
    [-0.72, 0.72].forEach(x => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), handMat);
      h.position.set(x, 1.35, 0);
      vendingMouthGroup.add(h);
    });
    [-0.38, 0.38].forEach(x => {
      const f = new THREE.Mesh(footGeo, footMat);
      f.scale.set(0.9, 0.6, 1.3);
      f.position.set(x, 0.18, 0.1);
      vendingMouthGroup.add(f);
    });

    // 5. 《探索发现》圈圈塞满嘴 (Ring Mouth) 专属 3D 模型
    const ringMouthGroup = new THREE.Group();
    ringMouthGroup.name = 'RingMouthGroup';
    ringMouthGroup.visible = false;
    group.add(ringMouthGroup);

    // 金光灿灿的厚实大圆环
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.25 });
    const bigRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.24, 16, 32), ringMat);
    bigRing.position.set(0, 1.1, 0);
    ringMouthGroup.add(bigRing);

    // 卡比粉色膨胀肉身被撑成环状套在圈圈上
    const ringKirbyBelly = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.28, 14, 24),
      new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.38, metalness: 0.03 })
    );
    ringKirbyBelly.position.set(0, 1.1, 0.05);
    ringMouthGroup.add(ringKirbyBelly);

    // 圈圈顶部的卡比可爱双眼与腮红
    [-0.26, 0.26].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeMat);
      eye.scale.set(0.8, 1.45, 0.3);
      eye.position.set(x, 2.12, 0.2);
      ringMouthGroup.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeWhiteMat);
      hl.position.set(x, 2.18, 0.26);
      ringMouthGroup.add(hl);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), blushMat);
      blush.scale.set(1.3, 0.55, 0.3);
      blush.position.set(x * 1.8, 1.98, 0.18);
      ringMouthGroup.add(blush);
    });

    // 圈圈左右卡比两只小手与下方小脚
    [-1.08, 1.08].forEach(x => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), handMat);
      h.position.set(x, 1.1, 0);
      ringMouthGroup.add(h);
    });
    [-0.38, 0.38].forEach(x => {
      const f = new THREE.Mesh(footGeo, footMat);
      f.scale.set(0.95, 0.6, 1.35);
      f.position.set(x, 0.18, 0);
      ringMouthGroup.add(f);
    });

    // 6. 《豪华版》超级剑 (Ultra Sword) 7米霸天神剑
    const superSwordGroup = new THREE.Group();
    superSwordGroup.name = 'SuperSwordGroup';
    superSwordGroup.visible = false;
    group.add(superSwordGroup);

    const swordBladeMat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      emissive: 0xff007f,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.8
    });
    const sBlade = new THREE.Mesh(new THREE.BoxGeometry(0.68, 5.8, 0.18), swordBladeMat);
    sBlade.position.set(1.15, 3.2, 0);
    sBlade.rotation.z = -0.25;
    superSwordGroup.add(sBlade);

    const sTip = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 4), swordBladeMat);
    sTip.position.set(1.95, 6.15, 0);
    sTip.rotation.z = -0.25;
    superSwordGroup.add(sTip);

    const sHilt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    sHilt.position.set(0.65, 0.75, 0);
    sHilt.rotation.z = -0.25;
    superSwordGroup.add(sHilt);

    const sStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    sStar.position.set(0.65, 0.75, 0.15);
    superSwordGroup.add(sStar);

    // 专属护盾环
    const shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 16),
      new THREE.MeshLambertMaterial({ color: 0x00e5ff, transparent: true, opacity: 0, wireframe: true })
    );
    shieldMesh.position.y = 0.85;
    group.add(shieldMesh);

    // 任天堂 Switch 原生柔和接触环境阴影 (Contact Shadow Disc - 随跳跃高度渐变缩放透明度)
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.02, 0);
    group.add(contactShadow);

    return {
      mesh: group,
      normalGroup,
      carMouthGroup,
      coneMouthGroup,
      vendingMouthGroup,
      ringMouthGroup,
      superSwordGroup,
      carWheels,
      body,
      leftHand,
      rightHand,
      leftFoot,
      rightFoot,
      hatHolder,
      shieldMesh,
      contactShadow,
      contactShadowMat,
      walkTimer: 0,
      squashX: 1.0,
      squashY: 1.0,
      squashZ: 1.0,
      bankingAngle: 0.0,
      triggerLandingSquash() {
        this.squashX = 1.25;
        this.squashY = 0.72;
        this.squashZ = 1.25;
      },
      triggerJumpStretch() {
        this.squashX = 0.90;
        this.squashY = 1.20;
        this.squashZ = 0.90;
      },
      setMouthful(type) {
        normalGroup.visible = !type;
        carMouthGroup.visible = (type === 'car');
        coneMouthGroup.visible = (type === 'cone');
        vendingMouthGroup.visible = (type === 'vending');
        ringMouthGroup.visible = (type === 'ring');
      },
      setSuperSword(active) {
        superSwordGroup.visible = !!active;
      },
      animate(dt, moving, jumping, floating, mouthfulMode, isSlamming, isTurbo, groundY = 0, currentY = 0, vy = 0, targetBanking = 0) {
        // 更新接触阴影贴地位置与基于高度衰减
        if (contactShadow) {
          const altitude = Math.max(0, currentY - groundY);
          contactShadow.position.y = -altitude + 0.02;
          const shadowScale = Math.max(0.3, 1.0 - altitude * 0.12);
          contactShadow.scale.set(shadowScale, shadowScale, shadowScale);
          contactShadowMat.opacity = Math.max(0.04, 0.35 - altitude * 0.04);
        }

        // 柔和阻尼恢复物理压扁拉伸 (Squash & Stretch)
        this.squashX += (1.0 - this.squashX) * Math.min(1.0, dt * 10.0);
        this.squashY += (1.0 - this.squashY) * Math.min(1.0, dt * 10.0);
        this.squashZ += (1.0 - this.squashZ) * Math.min(1.0, dt * 10.0);

        // 运动转向惯性倾斜 (Banking)
        this.bankingAngle += (targetBanking - this.bankingAngle) * Math.min(1.0, dt * 8.0);
        normalGroup.rotation.z = this.bankingAngle;

        if (mouthfulMode === 'car') {
          const speedFactor = (isTurbo ? 32 : (moving ? 18 : 0));
          carWheels.forEach(w => {
            w.children[0].rotation.x += dt * speedFactor;
          });
          if (moving) {
            carBody.position.y = 0.35 + Math.sin(performance.now() * 0.02) * 0.03;
          }
          return;
        }
        if (mouthfulMode === 'cone') {
          if (isSlamming) {
            coneMouthGroup.rotation.x = Math.PI; // 尖头倒置向下冲刺下砸！
            coneMouthGroup.position.y = 1.6;
          } else {
            coneMouthGroup.rotation.x = 0;
            coneMouthGroup.position.y = 0;
          }
          return;
        }
        if (mouthfulMode === 'vending') {
          if (moving) {
            vendingMouthGroup.rotation.z = Math.sin(performance.now() * 0.015) * 0.06;
            vendingMouthGroup.position.y = Math.abs(Math.sin(performance.now() * 0.015)) * 0.06;
          } else {
            vendingMouthGroup.rotation.z = 0;
            vendingMouthGroup.position.y = 0;
          }
          return;
        }
        if (mouthfulMode === 'ring') {
          ringMouthGroup.scale.set(
            1 + Math.sin(performance.now() * 0.008) * 0.02,
            1 + Math.sin(performance.now() * 0.008) * 0.02,
            1
          );
          return;
        }
        if (moving) {
          this.walkTimer += dt * 14;
          this.leftFoot.position.z = 0.15 + Math.sin(this.walkTimer) * 0.25;
          this.rightFoot.position.z = 0.15 - Math.sin(this.walkTimer) * 0.25;
          this.leftFoot.position.y = 0.22 + Math.max(0, Math.cos(this.walkTimer) * 0.15);
          this.rightFoot.position.y = 0.22 + Math.max(0, -Math.cos(this.walkTimer) * 0.15);
          this.leftHand.position.set(-0.95, 0.85 + Math.sin(this.walkTimer) * 0.15, 0.1);
          this.rightHand.position.set(0.95, 0.85 - Math.sin(this.walkTimer) * 0.15, 0.1);
          this.leftHand.rotation.z = 0;
          this.rightHand.rotation.z = 0;
          this.body.position.y = 0.85 + Math.abs(Math.sin(this.walkTimer)) * 0.08;
        } else {
          this.walkTimer += dt * 3;
          this.leftFoot.position.set(-0.45, 0.22, 0.15);
          this.rightFoot.position.set(0.45, 0.22, 0.15);
          this.body.position.y = 0.85 + Math.sin(this.walkTimer) * 0.03;
          // 海报同款高高举起左手热情挥舞的元气姿态！
          this.leftHand.position.set(-0.95, 1.15 + Math.sin(this.walkTimer * 2) * 0.06, 0.15);
          this.leftHand.rotation.z = 0.35 + Math.sin(this.walkTimer * 2) * 0.12;
          this.rightHand.position.set(0.95, 0.85 + Math.sin(this.walkTimer) * 0.04, 0.1);
          this.rightHand.rotation.z = -0.12;
        }
        if (jumping || floating) {
          this.leftHand.position.set(-0.95, 1.25, 0.1);
          this.rightHand.position.set(0.95, 1.25, 0.1);
          this.leftHand.rotation.z = 0.4;
          this.rightHand.rotation.z = -0.4;
          const baseSx = floating ? 1.25 : 0.94;
          const baseSy = floating ? 1.25 : 1.14;
          const baseSz = floating ? 1.25 : 0.94;
          this.body.scale.set(this.squashX * baseSx, this.squashY * baseSy, this.squashZ * baseSz);
        } else {
          this.body.scale.set(this.squashX, this.squashY, this.squashZ);
        }
        if (superSwordGroup.visible) {
          sBlade.rotation.z = -0.25 + Math.sin(performance.now() * 0.005) * 0.08;
        }
      }
    };
  }

  // ---------------- 动态能力帽子生成 (含多阶进化) ----------------
  function attachAbilityHat(hatHolder, abilityKey, level = 1) {
    while (hatHolder.children.length > 0) {
      hatHolder.remove(hatHolder.children[0]);
    }
    if (!abilityKey || !ABILITIES[abilityKey]) return;

    if (abilityKey === 'sword') {
      const swordGroup = new THREE.Group();
      if (level === 1) {
        // 1阶: 经典绿长帽 + 银亮利剑
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.9, 12), new THREE.MeshToonMaterial({ color: 0x4caf50 }));
        cap.rotation.x = -0.4;
        cap.position.set(0, 0.35, -0.2);
        swordGroup.add(cap);
        const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
        pompom.position.set(0, 0.75, -0.45);
        swordGroup.add(pompom);
      } else if (level === 2) {
        // 2阶: 庞大剑 (Gigant Sword) - 重型战盔护额
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.8 }));
        swordGroup.add(helm);
        const shieldCrest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.15), new THREE.MeshBasicMaterial({ color: 0xffd54f }));
        shieldCrest.position.set(0, 0.5, 0.2);
        swordGroup.add(shieldCrest);
      } else {
        // 3阶: 摩弗之剑 (Morpho Knight Sword) - 炽红黑金冥蝶光翼
        const wingMat = new THREE.MeshBasicMaterial({ color: 0xd81b60, transparent: true, opacity: 0.85 });
        [-0.45, 0.45].forEach(x => {
          const wing = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), wingMat);
          wing.scale.set(0.3, 1.2, 0.8);
          wing.position.set(x, 0.3, -0.4);
          wing.rotation.z = x > 0 ? -0.4 : 0.4;
          swordGroup.add(wing);
        });
        const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
        crest.position.set(0, 0.45, 0.25);
        swordGroup.add(crest);
      }
      hatHolder.add(swordGroup);
    } else if (abilityKey === 'fire') {
      const flameGroup = new THREE.Group();
      if (level === 1) {
        // 1阶: 基础烈火王冠
        const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff3d00 }));
        baseRing.rotation.x = Math.PI / 2;
        flameGroup.add(baseRing);
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 8), new THREE.MeshBasicMaterial({ color: 0xff9100 }));
        cone1.position.set(0, 0.35, 0);
        flameGroup.add(cone1);
      } else if (level === 2) {
        // 2阶: 火山火 - 熔岩碎石角盔
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }));
        flameGroup.add(rock);
        const lava = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5722 }));
        lava.position.set(0, 0.35, 0);
        flameGroup.add(lava);
      } else {
        // 3阶: 龙之火 - 紫炎飞龙羽翼与龙角
        const hornMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff });
        [-0.3, 0.3].forEach(x => {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 6), hornMat);
          horn.position.set(x, 0.4, 0);
          horn.rotation.z = x > 0 ? -0.35 : 0.35;
          flameGroup.add(horn);
        });
        const dWingMat = new THREE.MeshBasicMaterial({ color: 0xe040fb, transparent: true, opacity: 0.75 });
        [-0.5, 0.5].forEach(x => {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.9), dWingMat);
          wing.position.set(x, 0.25, -0.35);
          wing.rotation.y = x > 0 ? 0.3 : -0.3;
          flameGroup.add(wing);
        });
      }
      hatHolder.add(flameGroup);
    } else if (abilityKey === 'ice') {
      const iceGroup = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + level * 0.04), new THREE.MeshBasicMaterial({ color: 0x80deea }));
        spike.position.set(Math.cos(ang) * 0.35, 0.2 + (i % 2 === 0 ? 0.2 : 0), Math.sin(ang) * 0.35);
        iceGroup.add(spike);
      }
      hatHolder.add(iceGroup);
    } else if (abilityKey === 'spark') {
      const sparkGroup = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x303f9f }));
      sparkGroup.add(cap);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
      antenna.position.set(0, 0.5, 0);
      sparkGroup.add(antenna);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
      ball.position.set(0, 0.8, 0);
      sparkGroup.add(ball);
      hatHolder.add(sparkGroup);
    } else if (abilityKey === 'water') {
      const waterGroup = new THREE.Group();
      const wave = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.12, 6, 16), new THREE.MeshBasicMaterial({ color: 0x00b0ff }));
      wave.rotation.x = Math.PI / 2;
      waterGroup.add(wave);
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0x80d8ff }));
      drop.position.set(0, 0.35, 0);
      waterGroup.add(drop);
      hatHolder.add(waterGroup);
    } else if (abilityKey === 'shadow') {
      const shadowGroup = new THREE.Group();
      const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0x311b92 }));
      horn1.position.set(-0.25, 0.3, 0);
      horn1.rotation.z = 0.4;
      shadowGroup.add(horn1);
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0x311b92 }));
      horn2.position.set(0.25, 0.3, 0);
      horn2.rotation.z = -0.4;
      shadowGroup.add(horn2);
      hatHolder.add(shadowGroup);
    }
  }

  // ---------------- 向导伴侣：艾菲灵 (Elfilin - 《探索发现》原版 1:1 飞天萌宠伴随模型) ----------------
  function createGuideKirbyModel() {
    const group = new THREE.Group();
    group.name = 'GuideElfilinCompanion';

    // 艾菲灵天青石湖蓝柔软毛皮 (PBR Cyan Fur)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00bcd4,
      emissive: 0x00838f,
      emissiveIntensity: 0.12,
      roughness: 0.42,
      metalness: 0.02
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, roughness: 0.5 });
    const emeraldEyeMat = new THREE.MeshBasicMaterial({ color: 0x00c853 });
    const darkEyeMat = new THREE.MeshBasicMaterial({ color: 0x0a192f });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushPinkMat = new THREE.MeshStandardMaterial({ color: 0xff4081, roughness: 0.35 });

    // 1. 天蓝萌系小球躯体
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.50, 24, 20), bodyMat);
    body.castShadow = true;
    group.add(body);

    // 2. 颈部厚实蓬松白绒毛围领 (Fluffy Neck Ruff)
    const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 10, 22), whiteMat);
    ruff.rotation.x = Math.PI / 2;
    ruff.position.set(0, -0.22, 0);
    group.add(ruff);

    // 3. 招牌超大灵动巨耳 (左耳带经典 V 字缺口咬痕特写 - 1:1 还原)
    [-0.34, 0.34].forEach(ex => {
      const isLeft = ex < 0;
      const earGroup = new THREE.Group();
      earGroup.position.set(ex, 0.42, -0.05);
      earGroup.rotation.z = isLeft ? 0.42 : -0.42;
      earGroup.rotation.y = isLeft ? -0.15 : 0.15;

      // 外耳廓
      const earBase = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), bodyMat);
      earBase.scale.set(0.65, 1.45, 0.28);
      earGroup.add(earBase);

      // 内耳米黄绒毛
      const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 12), innerEarMat);
      earInner.scale.set(0.55, 1.25, 0.25);
      earInner.position.set(0, 0.05, 0.05);
      earGroup.add(earInner);

      // 左耳上方的招牌 V 型耳缺口 Notch
      if (isLeft) {
        const notchMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.14, 0.35),
          new THREE.MeshBasicMaterial({ color: 0x00bcd4 })
        );
        notchMesh.position.set(-0.18, 0.25, 0);
        notchMesh.rotation.z = 0.35;
        earGroup.add(notchMesh);
      }

      group.add(earGroup);
    });

    // 4. 艾菲灵招牌翡翠翠绿深邃双眸与反光
    [-0.16, 0.16].forEach(x => {
      const eyeBase = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 10), darkEyeMat);
      eyeBase.scale.set(0.72, 1.45, 0.35);
      eyeBase.position.set(x, 0.10, 0.44);
      group.add(eyeBase);

      const eyeEmerald = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), emeraldEyeMat);
      eyeEmerald.scale.set(0.72, 0.95, 0.32);
      eyeEmerald.position.set(x, 0.06, 0.47);
      group.add(eyeEmerald);

      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeWhiteMat);
      hl.position.set(x + (x > 0 ? 0.015 : -0.015), 0.15, 0.50);
      group.add(hl);

      // 柔嫩粉腮红
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), blushPinkMat);
      blush.scale.set(1.3, 0.5, 0.3);
      blush.position.set(x * 1.85, -0.04, 0.43);
      group.add(blush);
    });

    // 5. 奶白色小嘴套与黑鼻
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), whiteMat);
    muzzle.scale.set(1.0, 0.7, 0.8);
    muzzle.position.set(0, -0.06, 0.45);
    group.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), darkEyeMat);
    nose.position.set(0, -0.03, 0.56);
    group.add(nose);

    // 6. 白绒绒小翅膀手与小脚爪
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), whiteMat);
    leftHand.position.set(-0.48, -0.08, 0.1);
    group.add(leftHand);

    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), whiteMat);
    rightHand.position.set(0.48, -0.08, 0.1);
    group.add(rightHand);

    [-0.18, 0.18].forEach(x => {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bodyMat);
      foot.scale.set(0.85, 0.5, 1.2);
      foot.position.set(x, -0.46, 0.05);
      group.add(foot);
    });

    // 7. 尾部带白绒毛球的灵动天蓝小尾巴
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), whiteMat);
    tail.position.set(0, -0.28, -0.45);
    group.add(tail);

    // 8. 专属黄金闪耀向导星之光环 (Warp Star Halo)
    const haloStar = new THREE.Mesh(
      createPuffyStarGeometry(0.18, 0.08, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffb300,
        emissiveIntensity: 0.65,
        metalness: 0.85,
        roughness: 0.2
      })
    );
    haloStar.position.set(0, 0.78, 0);
    group.add(haloStar);

    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.03, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffeb3b,
        emissive: 0xffd700,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85
      })
    );
    haloRing.rotation.x = Math.PI / 2;
    haloRing.position.set(0, 0.78, 0);
    group.add(haloRing);

    return {
      mesh: group,
      leftHand,
      rightHand,
      haloStar,
      haloRing,
      targetX: 0,
      targetY: 2.2,
      targetZ: 0,
      bobTimer: 0,
      update(dt, playerX, playerY, playerZ, playerYaw) {
        this.bobTimer += dt * 3.5;
        // 浮动在玩家身旁肩膀上方
        const offsetX = -Math.sin(playerYaw + 0.9) * 1.8;
        const offsetZ = Math.cos(playerYaw + 0.9) * 1.8;
        this.targetX = playerX + offsetX;
        this.targetY = playerY + 1.8 + Math.sin(this.bobTimer) * 0.25;
        this.targetZ = playerZ + offsetZ;

        // 平滑追踪
        group.position.x += (this.targetX - group.position.x) * dt * 4.5;
        group.position.y += (this.targetY - group.position.y) * dt * 4.5;
        group.position.z += (this.targetZ - group.position.z) * dt * 4.5;

        // 始终朝向玩家或略微向前倾
        group.rotation.y = playerYaw - 0.35;
        group.rotation.z = Math.sin(this.bobTimer * 0.8) * 0.08;

        // 挥手与旋转光环
        this.leftHand.position.y = 0.12 + Math.sin(this.bobTimer * 2.5) * 0.12;
        this.haloStar.rotation.y += dt * 4.0;
        this.haloStar.rotation.z += dt * 2.5;
      }
    };
  }

  // ---------------- 贴地滑铲星之碎屑特效 ----------------
  function createSlideDust(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.2, z);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 4; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + Math.random() * 0.08), starMat);
      star.position.set((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
      group.add(star);
    }
    return {
      mesh: group,
      starMat,
      life: 0.35,
      active: true,
      update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
          this.active = false;
          if (group.parent) group.parent.remove(group);
          return;
        }
        group.position.y += dt * 0.5;
        this.starMat.opacity = Math.max(0, this.life / 0.35);
      }
    };
  }

  // ---------------- 空中吐气空气弹 (Aerial Air Puff Bullet) ----------------
  function createAirPuffMesh(startX, startY, startZ, yaw) {
    const group = new THREE.Group();
    group.position.set(startX, startY + 0.6, startZ);

    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), cloudMat);
    cloud.scale.set(1.2, 0.9, 1.4);
    group.add(cloud);

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
    group.add(star);

    const speed = 22.0;
    const dx = Math.sin(yaw) * speed;
    const dz = -Math.cos(yaw) * speed;

    return {
      mesh: group,
      dx,
      dz,
      isAirPuff: true,
      life: 0.8,
      active: true,
      damage: 4,
      update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
          this.active = false;
          if (group.parent) group.parent.remove(group);
          return;
        }
        group.position.x += this.dx * dt;
        group.position.z += this.dz * dt;
        star.rotation.y += dt * 10;
        star.rotation.z += dt * 6;
        cloud.scale.multiplyScalar(1 + dt * 0.4);
      }
    };
  }

  // ---------------- 7大标志性怪物与原生生态 3D 体系 ----------------
  function createEnemy(type = 'minion', ability = null, x = 0, y = 0.8, z = -20) {
    const group = new THREE.Group();
    group.name = 'Enemy_' + type;
    group.position.set(x, y, z);

    let maxHp = 4;
    let name = '瓦豆鲁迪';
    let isInvincible = false;
    let dropsAbility = ability;
    let customUpdate = null;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x212121 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 地面柔和接触环境阴影 (Contact Shadow - Switch 原生自然着陆感)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const shadowRadius = type === 'gordo' ? 0.65 : 0.72;
    const enemyShadow = new THREE.Mesh(new THREE.CircleGeometry(shadowRadius, 20), shadowMat);
    enemyShadow.rotation.x = -Math.PI / 2;
    enemyShadow.position.set(0, type === 'bronto_burt' ? -y : -0.74, 0);
    group.add(enemyShadow);

    if (type === 'awoofy') {
      // 1. 加鲁鲁菲 (Awoofy - 《探索发现》原生野兽，毛茸茸狐狼)
      name = '加鲁鲁菲';
      maxHp = 4;
      dropsAbility = null;

      const furMat = new THREE.MeshStandardMaterial({ color: 0xf4511e, roughness: 0.65, metalness: 0.05 });
      const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.6, metalness: 0.02 });
      const earChocMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.7 });
      const earPinkMat = new THREE.MeshBasicMaterial({ color: 0xff80ab });
      const noseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.08, metalness: 0.15 });

      // 躯体
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.74, 20, 16), furMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 胸前与腹部白色绒毛围兜 (Cream bib)
      const bib = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), creamMat);
      bib.scale.set(0.85, 0.9, 0.45);
      bib.position.set(0, -0.12, 0.44);
      group.add(bib);

      // 嘴套 (Muzzle)
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), creamMat);
      muzzle.scale.set(1.1, 0.8, 1.0);
      muzzle.position.set(0, 0.05, 0.62);
      group.add(muzzle);

      // 黑色小纽扣鼻
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), noseMat);
      nose.position.set(0, 0.12, 0.88);
      group.add(nose);

      // 尖狐耳 (含深棕色耳尖与粉红内耳绒毛)
      [-0.32, 0.32].forEach(ex => {
        const earGroup = new THREE.Group();
        earGroup.position.set(ex, 0.68, 0);
        earGroup.rotation.z = ex > 0 ? -0.25 : 0.25;

        const earBase = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), furMat);
        earGroup.add(earBase);

        const earTip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 8), earChocMat);
        earTip.position.y = 0.22;
        earGroup.add(earTip);

        const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 6), earPinkMat);
        earInner.position.set(0, -0.02, 0.08);
        earGroup.add(earInner);

        group.add(earGroup);
      });

      // 灵动的大眼睛与双重高光
      [-0.22, 0.22].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1b0000 }));
        eye.scale.set(0.85, 1.25, 0.4);
        eye.position.set(ex, 0.24, 0.66);
        group.add(eye);

        const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeWhiteMat);
        hl1.position.set(ex + (ex > 0 ? 0.015 : -0.015), 0.28, 0.72);
        group.add(hl1);
        const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeWhiteMat);
        hl2.position.set(ex + (ex > 0 ? -0.015 : 0.015), 0.2, 0.71);
        group.add(hl2);
      });

      // 4 只独立脚爪与肉垫
      [-0.34, 0.34].forEach(px => {
        [0.26, -0.28].forEach(pz => {
          const paw = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), furMat);
          paw.scale.set(0.9, 0.55, 1.25);
          paw.position.set(px, -0.46, pz);
          paw.castShadow = true;
          group.add(paw);

          const pad = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), earChocMat);
          pad.scale.set(0.8, 0.2, 1.0);
          pad.position.set(px, -0.58, pz);
          group.add(pad);
        });
      });

      // 蓬松卷翘狐尾 (尾尖点缀奶白绒毛)
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, -0.05, -0.65);
      tailGroup.rotation.x = -1.1;

      const tailBase = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 10), furMat);
      tailGroup.add(tailBase);
      const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), creamMat);
      tailTip.position.y = 0.35;
      tailGroup.add(tailTip);
      group.add(tailGroup);

      let pounceTimer = 0;
      let pouncing = false;

      customUpdate = (dt, distToPlayer, angle) => {
        pounceTimer += dt;
        tailGroup.rotation.z = Math.sin(performance.now() * 0.008) * 0.25;
        if (distToPlayer < 7.5 && pounceTimer > 2.5 && !pouncing) {
          pouncing = true;
          pounceTimer = 0;
          group.position.y += 0.85;
          group.position.x += Math.sin(angle) * 3.5;
          group.position.z += Math.cos(angle) * 3.5;
          setTimeout(() => {
            pouncing = false;
            group.position.y = y;
          }, 450);
        }
      };

    } else if (type === 'blade_knight') {
      // 2. 利剑骑士 (Blade Knight - Switch《探索发现》哥特重装翡翠青钢剑豪)
      name = '利剑骑士';
      maxHp = 5;
      dropsAbility = 'sword';

      const armorMat = new THREE.MeshStandardMaterial({ color: 0x00695c, metalness: 0.88, roughness: 0.22 });
      const darkArmorMat = new THREE.MeshStandardMaterial({ color: 0x004d40, metalness: 0.85, roughness: 0.28 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.92, roughness: 0.16 });
      const silverMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.96, roughness: 0.14 });
      const visorGlowMat = new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 1.3 });

      // 头盔护体主壳体
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.74, 32, 28), armorMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 下颌护甲与胸甲微凸棱线
      const chinGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.35, 24, 1, false, -Math.PI * 0.35, Math.PI * 0.7), darkArmorMat);
      chinGuard.position.set(0, -0.22, 0.15);
      group.add(chinGuard);

      // 骑士 T 型面罩护额缝与发光翡翠绿双眸
      const visorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.22), new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.85, roughness: 0.2 }));
      visorPlate.position.set(0, 0.2, 0.65);
      group.add(visorPlate);

      // 双眼狭长翡翠光缝 (眼窝内陷立体感)
      [-0.18, 0.18].forEach(x => {
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.08), visorGlowMat);
        slit.position.set(x, 0.2, 0.75);
        slit.rotation.z = x > 0 ? 0.15 : -0.15;
        group.add(slit);
      });

      // 黄金展翅战盔顶冠 (Double Winged Crest)
      [-0.28, 0.28].forEach(x => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 12), goldMat);
        horn.position.set(x, 0.74, 0);
        horn.rotation.z = x > 0 ? -0.36 : 0.36;
        horn.rotation.x = -0.12;
        horn.castShadow = true;
        group.add(horn);

        const hornBase = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16), goldMat);
        hornBase.position.set(x, 0.7, 0);
        hornBase.rotation.x = Math.PI / 2;
        group.add(hornBase);
      });

      // 双层阶梯圆拱重装肩甲 (Layered Pauldrons with Gold Trim)
      [-0.84, 0.84].forEach(px => {
        const pauldronGroup = new THREE.Group();
        pauldronGroup.position.set(px, 0.45, 0.08);

        const pOuter = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), armorMat);
        pOuter.castShadow = true;
        pauldronGroup.add(pOuter);

        const pTrim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 20), goldMat);
        pTrim.rotation.x = Math.PI / 2;
        pauldronGroup.add(pTrim);

        group.add(pauldronGroup);
      });

      // 闪耀银钢重骑士大剑 (配备血槽、展翼金剑格与金属配重球)
      const swordGroup = new THREE.Group();
      swordGroup.position.set(0.95, 0.22, 0.45);
      swordGroup.rotation.x = 0.55;
      swordGroup.rotation.z = -0.2;

      // 剑身主锋与剑尖
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.08), silverMat);
      blade.position.y = 0.7;
      blade.castShadow = true;
      swordGroup.add(blade);

      // 剑身中央凹槽血槽 (Fuller Groove)
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, 0.09), new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.95, roughness: 0.2 }));
      fuller.position.y = 0.65;
      swordGroup.add(fuller);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 4), silverMat);
      tip.position.y = 1.48;
      swordGroup.add(tip);

      // 展翅金十字剑格 (Crossguard)
      const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.11, 0.18), goldMat);
      crossguard.position.y = 0.12;
      swordGroup.add(crossguard);

      // 剑柄与配重球
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), darkArmorMat);
      grip.position.y = -0.1;
      swordGroup.add(grip);

      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), goldMat);
      pommel.position.y = -0.28;
      swordGroup.add(pommel);

      group.add(swordGroup);

      // 沉稳剑豪呼吸微动
      customUpdate = (dt) => {
        const t = performance.now() * 0.005;
        swordGroup.rotation.x = 0.55 + Math.sin(t) * 0.12;
        swordGroup.rotation.y = Math.cos(t * 0.8) * 0.08;
      };

    } else if (type === 'hot_head') {
      // 3. 火炎怪 (Hot Head - 釉面绯红陶瓷身躯与湍流翻滚动态烈焰)
      name = '火炎怪';
      maxHp = 4;
      dropsAbility = 'fire';

      const flameBodyMat = new THREE.MeshStandardMaterial({
        color: 0xc62828,
        emissive: 0xbf360c,
        emissiveIntensity: 0.22,
        roughness: 0.18,
        metalness: 0.25
      });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.76, 28, 24), flameBodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 5段多维动态烈焰羽冠 (高光透光核心 + 层次翻滚)
      const flames = [];
      const flameData = [
        { x: -0.24, y: 0.72, z: -0.12, h: 0.75, col: 0xffa000, em: 0xff6d00, phase: 0 },
        { x: -0.12, y: 0.82, z: -0.05, h: 0.95, col: 0xffeb3b, em: 0xffab00, phase: 1.2 },
        { x: 0.0,   y: 0.88, z: 0.02,  h: 1.15, col: 0xfff59d, em: 0xffeb3b, phase: 2.4 },
        { x: 0.12,  y: 0.82, z: -0.05, h: 0.95, col: 0xffeb3b, em: 0xffab00, phase: 3.6 },
        { x: 0.24,  y: 0.72, z: -0.12, h: 0.75, col: 0xffa000, em: 0xff6d00, phase: 4.8 }
      ];

      flameData.forEach(fd => {
        const fMat = new THREE.MeshStandardMaterial({
          color: fd.col,
          emissive: fd.em,
          emissiveIntensity: 0.9,
          roughness: 0.2,
          transparent: true,
          opacity: 0.92
        });
        const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, fd.h, 12), fMat);
        flameMesh.position.set(fd.x, fd.y, fd.z);
        flameMesh.rotation.x = -0.22;
        group.add(flameMesh);
        flames.push({ mesh: flameMesh, baseH: fd.h, phase: fd.phase, mat: fMat });
      });

      // 晶状眼睛与向前突出的金色喷火气管
      [-0.22, 0.22].forEach(x => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), eyeMat);
        e.position.set(x, 0.18, 0.66);
        group.add(e);
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), eyeWhiteMat);
        hl.position.set(x + (x > 0 ? 0.02 : -0.02), 0.22, 0.73);
        group.add(hl);
      });

      // 纯铜锻造喷管 (带受热发蓝烧色外环)
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.38, 18), new THREE.MeshStandardMaterial({ color: 0xffa000, metalness: 0.85, roughness: 0.22 }));
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, -0.06, 0.76);
      group.add(snout);

      const nozzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 20), new THREE.MeshStandardMaterial({ color: 0x304ffe, metalness: 0.9, roughness: 0.1 }));
      nozzleRing.position.set(0, -0.06, 0.94);
      group.add(nozzleRing);

      // 金黄双脚
      [-0.32, 0.32].forEach(fx => {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), new THREE.MeshStandardMaterial({ color: 0xff8f00, roughness: 0.35 }));
        f.scale.set(0.9, 0.5, 1.3);
        f.position.set(fx, -0.45, 0.1);
        f.castShadow = true;
        group.add(f);
      });

      // 实时湍流火舌翻滚动画
      customUpdate = (dt) => {
        const t = performance.now() * 0.008;
        flames.forEach(f => {
          const s = 1 + Math.sin(t + f.phase) * 0.28 + Math.cos(t * 1.5 + f.phase) * 0.12;
          f.mesh.scale.set(1 + Math.cos(t + f.phase) * 0.15, s, 1 + Math.sin(t + f.phase) * 0.15);
          f.mesh.rotation.z = Math.sin(t * 0.8 + f.phase) * 0.15;
          f.mat.emissiveIntensity = 0.85 + Math.sin(t * 2 + f.phase) * 0.25;
        });
      };

    } else if (type === 'chilly') {
      // 4. 奇力雪人 (Chilly - 冰晶晶莹雪人、厚实羊毛织红围巾与高光黄铜铃铛)
      name = '奇力雪人';
      maxHp = 4;
      dropsAbility = 'ice';

      const snowMat = new THREE.MeshStandardMaterial({
        color: 0xf0f7ff,
        emissive: 0xd7ecff,
        emissiveIntensity: 0.15,
        roughness: 0.45,
        metalness: 0.12
      });

      const baseBall = new THREE.Mesh(new THREE.SphereGeometry(0.70, 26, 22), snowMat);
      baseBall.castShadow = true;
      baseBall.receiveShadow = true;
      group.add(baseBall);

      const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.50, 24, 20), snowMat);
      headBall.position.set(0, 0.65, 0);
      headBall.castShadow = true;
      group.add(headBall);

      // 皇家蓝折沿毛线帽
      const hatGroup = new THREE.Group();
      hatGroup.position.set(0, 1.02, -0.08);
      hatGroup.rotation.x = -0.28;

      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.11, 10, 24), new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.55 }));
      brim.rotation.x = Math.PI / 2;
      hatGroup.add(brim);

      const knitCap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.68, 20), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.55 }));
      knitCap.position.y = 0.26;
      hatGroup.add(knitCap);

      const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), snowMat);
      pompom.position.y = 0.65;
      hatGroup.add(pompom);
      group.add(hatGroup);

      // 鲜红羊毛编织立体围巾与后摆飘带
      const scarfMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.65 });
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.14, 12, 24), scarfMat);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 0.38, 0);
      group.add(scarf);

      const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.60, 0.08), scarfMat);
      scarfTail.position.set(0.32, 0.14, -0.44);
      scarfTail.rotation.x = -0.32;
      group.add(scarfTail);

      // 鲜明高反光黄铜胸前铃铛 (Brass Jingle Bell)
      const bellMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.95, roughness: 0.12 });
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bellMat);
      bell.position.set(0, 0.32, 0.52);
      bell.castShadow = true;
      group.add(bell);

      // 煤炭眼睛与胡萝卜尖鼻
      [-0.16, 0.16].forEach(x => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat);
        e.position.set(x, 0.72, 0.46);
        group.add(e);
      });
      const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0xff6d00, roughness: 0.45 }));
      carrot.rotation.x = Math.PI / 2;
      carrot.position.set(0, 0.62, 0.60);
      group.add(carrot);

      // 4 枚环绕飞舞的高透双棱寒冰晶钻 (Ice Diamond Shards)
      const crystals = [];
      for (let c = 0; c < 4; c++) {
        const cry = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.12),
          new THREE.MeshStandardMaterial({
            color: 0x80deea,
            emissive: 0x00e5ff,
            emissiveIntensity: 0.65,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.88
          })
        );
        group.add(cry);
        crystals.push(cry);
      }

      customUpdate = (dt) => {
        const t = performance.now() * 0.003;
        scarfTail.rotation.z = Math.sin(t * 3) * 0.22;
        bell.rotation.z = Math.sin(t * 4) * 0.15;
        crystals.forEach((c, idx) => {
          const ang = t * 2.2 + (idx * Math.PI * 2) / 4;
          c.position.set(Math.cos(ang) * 1.05, 0.55 + Math.sin(t * 3 + idx) * 0.28, Math.sin(ang) * 1.05);
          c.rotation.y += dt * 4.5;
          c.rotation.x += dt * 2.0;
        });
      };

    } else if (type === 'bronto_burt') {
      // 5. 蹦蹦鸟 (Bronto Burt - 经典空战飞鸟，粉嘟嘟圆雀羽翼)
      name = '蹦蹦鸟';
      maxHp = 3;
      dropsAbility = null;

      const birdMat = new THREE.MeshStandardMaterial({ color: 0xff8a80, roughness: 0.55 });
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.35 });

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14), birdMat);
      body.castShadow = true;
      group.add(body);

      // 羽翼组 (羽毛状梯形多段)
      const leftWingGroup = new THREE.Group();
      leftWingGroup.position.set(-0.62, 0.15, 0);
      const lWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.4), wingMat);
      lWing.position.set(-0.25, 0, 0);
      leftWingGroup.add(lWing);
      group.add(leftWingGroup);

      const rightWingGroup = new THREE.Group();
      rightWingGroup.position.set(0.62, 0.15, 0);
      const rWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.4), wingMat);
      rWing.position.set(0.25, 0, 0);
      rightWingGroup.add(rWing);
      group.add(rightWingGroup);

      // 眼睛与金色喙嘴
      [-0.18, 0.18].forEach(x => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), eyeMat);
        e.scale.set(0.75, 1.35, 0.4);
        e.position.set(x, 0.16, 0.62);
        group.add(e);
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeWhiteMat);
        hl.position.set(x + (x > 0 ? 0.015 : -0.015), 0.22, 0.68);
        group.add(hl);
      });

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -0.06, 0.74);
      group.add(beak);

      group.position.y = y + 1.8;

      let wingTimer = 0;
      customUpdate = (dt) => {
        wingTimer += dt * 18;
        leftWingGroup.rotation.z = Math.sin(wingTimer) * 0.55;
        rightWingGroup.rotation.z = -Math.sin(wingTimer) * 0.55;
        group.position.y = y + 1.8 + Math.sin(wingTimer * 0.22) * 0.4;
        enemyShadow.position.y = -group.position.y + 0.02;
        const altRatio = Math.max(0.35, 1.1 - (group.position.y - 1.2) * 0.2);
        enemyShadow.scale.setScalar(altRatio);
        shadowMat.opacity = Math.max(0.08, 0.28 * altRatio);
      };

    } else if (type === 'gordo') {
      // 6. 戈鲁多刺球 (Gordo - 经典绝对无敌黑金黑铁刺球)
      name = '戈鲁多刺球';
      maxHp = 9999;
      isInvincible = true;
      dropsAbility = null;

      const gordoMat = new THREE.MeshStandardMaterial({ color: 0x121820, metalness: 0.96, roughness: 0.14 });
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.94, roughness: 0.15 });

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 22, 18), gordoMat);
      body.castShadow = true;
      group.add(body);

      // 向四周对称排布的 14 根金属锋锐尖刺 (6轴向 + 8斜角)
      const spikeDirs = [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
        [0.7, 0.7, 0.7], [-0.7, 0.7, 0.7], [0.7, -0.7, 0.7], [-0.7, -0.7, 0.7],
        [0.7, 0.7, -0.7], [-0.7, 0.7, -0.7], [0.7, -0.7, -0.7], [-0.7, -0.7, -0.7]
      ];
      spikeDirs.forEach(dir => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 8), spikeMat);
        const v = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
        spike.position.copy(v.clone().multiplyScalar(0.72));
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
        group.add(spike);
      });

      // 标志性黄色冷酷圆眼与黑瞳
      [-0.18, 0.18].forEach(x => {
        const eyeRing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
        eyeRing.position.set(x, 0.12, 0.58);
        group.add(eyeRing);

        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
        pupil.position.set(x, 0.12, 0.68);
        group.add(pupil);
      });

      let gordoTimer = 0;
      customUpdate = (dt) => {
        gordoTimer += dt * 2.5;
        group.position.y = y + Math.sin(gordoTimer) * 1.25;
        group.rotation.y += dt * 1.5;
        enemyShadow.position.y = -group.position.y + 0.02;
        const altRatio = Math.max(0.4, 1.15 - (group.position.y - y) * 0.22);
        enemyShadow.scale.setScalar(altRatio);
        shadowMat.opacity = Math.max(0.1, 0.3 * altRatio);
      };

    } else if (type === 'sir_kibble') {
      // 7. 回旋镖骑士 (Sir Kibble - 经典纯金盔甲斩切回旋骑士)
      name = '回旋镖骑士';
      maxHp = 5;
      dropsAbility = 'sword';

      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.86, roughness: 0.24 });
      const darkMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16), goldMat);
      body.castShadow = true;
      group.add(body);

      // 头盔面罩护额视缝与内在微光
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.18), darkMat);
      slit.position.set(0, 0.16, 0.65);
      group.add(slit);

      [-0.14, 0.14].forEach(x => {
        const eyeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
        eyeGlow.position.set(x, 0.16, 0.74);
        group.add(eyeGlow);
      });

      // 标志性头顶可回旋旋转的月牙弯刀 (Cutter Blade)
      const cutterGroup = new THREE.Group();
      cutterGroup.position.set(0, 0.74, 0);
      const cutterBlade = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.085, 8, 20, Math.PI * 0.88),
        new THREE.MeshStandardMaterial({ color: 0xffea00, metalness: 0.9, roughness: 0.18 })
      );
      cutterBlade.rotation.x = Math.PI / 2;
      cutterGroup.add(cutterBlade);
      group.add(cutterGroup);

      // 金黄双脚
      [-0.32, 0.32].forEach(fx => {
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), goldMat);
        foot.scale.set(0.9, 0.5, 1.3);
        foot.position.set(fx, -0.45, 0.1);
        group.add(foot);
      });

      customUpdate = (dt) => {
        cutterGroup.rotation.y += dt * 6.0; // 弯刀持续高速旋转炫光
      };

    } else if (type === 'scarfy') {
      // 8. 斯卡菲 (Scarfy - 经典招牌猫耳浮游怪，橘金圆球萌眼与被触怒的暴走反差，1:1 还原官方原画)
      name = '斯卡菲';
      maxHp = 4;
      dropsAbility = 'fire';

      const orangeFurMat = new THREE.MeshStandardMaterial({
        color: 0xff9800,
        emissive: 0xff6f00,
        emissiveIntensity: 0.15,
        roughness: 0.38,
        metalness: 0.04
      });
      const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xbf360c, roughness: 0.5 });
      const scarfyEyeBlueMat = new THREE.MeshBasicMaterial({ color: 0x0288d1 });
      const scarfyEyeDarkMat = new THREE.MeshBasicMaterial({ color: 0x050b1a });
      const blushYellowMat = new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.4 });

      // 橘金色圆球躯体
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 24), orangeFurMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 头顶萌系猫耳 (尖尖立耳 + 内部红褐色耳窝)
      [-0.32, 0.32].forEach(ex => {
        const earGroup = new THREE.Group();
        earGroup.position.set(ex, 0.65, 0);
        earGroup.rotation.z = ex > 0 ? -0.22 : 0.22;
        earGroup.rotation.x = -0.08;

        const earCone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 10), orangeFurMat);
        earCone.castShadow = true;
        earGroup.add(earCone);

        const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 8), innerEarMat);
        innerEar.position.set(0, -0.04, 0.07);
        earGroup.add(innerEar);

        group.add(earGroup);
      });

      // 招牌清澈宝石蓝大眼睛与水润高光
      [-0.20, 0.20].forEach(x => {
        const eyeBase = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), scarfyEyeDarkMat);
        eyeBase.scale.set(0.72, 1.45, 0.38);
        eyeBase.position.set(x, 0.16, 0.68);
        group.add(eyeBase);

        const eyeBlue = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), scarfyEyeBlueMat);
        eyeBlue.scale.set(0.72, 0.9, 0.35);
        eyeBlue.position.set(x, 0.12, 0.72);
        group.add(eyeBlue);

        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeWhiteMat);
        hl.position.set(x + (x > 0 ? 0.016 : -0.016), 0.23, 0.74);
        group.add(hl);

        // 柔和鹅黄颊红 (Pale Yellow Blush)
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 10), blushYellowMat);
        cheek.scale.set(1.4, 0.55, 0.28);
        cheek.position.set(x * 1.9, 0.02, 0.65);
        group.add(cheek);
      });

      // 开心微张的治愈系微笑与小舌头
      const mouth = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 10, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x880e4f })
      );
      mouth.rotation.x = -Math.PI / 2;
      mouth.position.set(0, -0.05, 0.72);
      group.add(mouth);

      const tongue = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4081 })
      );
      tongue.position.set(0, -0.07, 0.73);
      group.add(tongue);

      // 浮空巡弋与靠近警觉狂暴动效
      let scarfyTimer = 0;
      customUpdate = (dt, distToPlayer, angle) => {
        scarfyTimer += dt * 3.2;
        group.position.y = y + 1.2 + Math.sin(scarfyTimer) * 0.3;
        group.rotation.y = Math.sin(scarfyTimer * 0.6) * 0.18;

        // 动态阴影贴合高度
        enemyShadow.position.y = -group.position.y + 0.02;
        const altRatio = Math.max(0.35, 1.15 - (group.position.y - y) * 0.25);
        enemyShadow.scale.setScalar(altRatio);
        shadowMat.opacity = Math.max(0.1, 0.28 * altRatio);

        // 斯卡菲招牌机制：当卡比靠近（小于 5.0 格）时龇牙咧嘴警觉变脸发红
        if (distToPlayer < 5.0) {
          orangeFurMat.emissive.setHex(0xd50000);
          orangeFurMat.emissiveIntensity = 0.65 + Math.sin(performance.now() * 0.015) * 0.35;
        } else {
          orangeFurMat.emissive.setHex(0xff6f00);
          orangeFurMat.emissiveIntensity = 0.15;
        }
      };

    } else if (type === 'sandbag') {
      // 9. 沙袋先生 (Sandbag - 《探索发现》武器店专属靶场沙袋，高拟真麻布十字纽扣眼)
      name = '沙袋先生 (训练打靶)';
      maxHp = 9999;
      isInvincible = false;
      dropsAbility = null;

      const burlapMat = new THREE.MeshStandardMaterial({
        color: 0xd7ccc8,
        roughness: 0.78,
        metalness: 0.02
      });
      const darkLeatherMat = new THREE.MeshStandardMaterial({
        color: 0x5d4037,
        roughness: 0.65,
        metalness: 0.08
      });
      const buttonMat = new THREE.MeshStandardMaterial({
        color: 0x212121,
        roughness: 0.2,
        metalness: 0.4
      });
      const threadMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      // 1. 下方重心底座 (Heavy Base)
      const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.66, 0.28, 24), darkLeatherMat);
      baseMesh.position.y = -0.62;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      // 2. 躯体麻布袋主柱 (Cylindrical Burlap Sack)
      const sackMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.54, 1.15, 24), burlapMat);
      sackMesh.position.y = 0.05;
      sackMesh.castShadow = true;
      group.add(sackMesh);

      // 3. 顶部圆顶袋头 (Dome Top)
      const topDome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), burlapMat);
      topDome.position.y = 0.62;
      topDome.castShadow = true;
      group.add(topDome);

      // 4. 头顶扎带收口与褶皱荷叶边 (Top Tie & Ruffle)
      const tieRing = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.045, 8, 16), darkLeatherMat);
      tieRing.rotation.x = Math.PI / 2;
      tieRing.position.set(0, 1.08, 0);
      group.add(tieRing);

      const ruffle = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 10, 1, true), burlapMat);
      ruffle.position.set(0, 1.22, 0);
      group.add(ruffle);

      // 5. 侧边缝合线 (Stitched Seam & Cross Ties)
      [-0.15, 0.1, 0.35].forEach(sy => {
        const stitchH = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), darkLeatherMat);
        stitchH.position.set(0.48, sy, 0.2);
        stitchH.rotation.y = -0.4;
        group.add(stitchH);
      });

      // 6. 招牌黑色纽扣眼睛与白色十字交叉缝线 (+)
      [-0.18, 0.18].forEach(bx => {
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 14), buttonMat);
        btn.rotation.x = Math.PI / 2;
        btn.position.set(bx, 0.46, 0.52);
        btn.castShadow = true;
        group.add(btn);

        const threadV = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.10, 0.02), threadMat);
        threadV.position.set(bx, 0.46, 0.545);
        group.add(threadV);

        const threadH = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.02, 0.02), threadMat);
        threadH.position.set(bx, 0.46, 0.545);
        group.add(threadH);
      });

      // 7. 萌系缝线小嘴
      const mouthStitch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.02), darkLeatherMat);
      mouthStitch.position.set(0, 0.22, 0.53);
      group.add(mouthStitch);

      // 真实沙袋弹簧阻尼晃动物理学 (Spring-damper wobble physics)
      let wobbleAngle = 0;
      let wobbleVelocity = 0;

      group.userData.onHit = (hitAngle = 0, hitForce = 0.45) => {
        wobbleAngle = hitForce;
        wobbleVelocity = hitForce * 8.0;
      };

      customUpdate = (dt) => {
        const springK = 65.0;
        const damping = 5.5;
        const springAcc = -springK * wobbleAngle - damping * wobbleVelocity;
        wobbleVelocity += springAcc * dt;
        wobbleAngle += wobbleVelocity * dt;

        group.rotation.z = Math.sin(wobbleAngle) * 0.45;
        group.rotation.x = Math.cos(wobbleAngle * 0.8) * 0.18;
      };

    } else {
      // 10. 经典原版瓦豆鲁迪 (Waddle Dee - 招牌橘红球体、心形脸庞、橙黄大脚)
      let baseColor = 0xff7043;
      if (type === 'knight') {
        maxHp = 6;
        baseColor = 0x78909c;
        name = '剑士守卫';
        dropsAbility = 'sword';
      } else if (type === 'ability') {
        maxHp = 5;
        const ab = ABILITIES[ability] || ABILITIES.fire;
        baseColor = ab.color;
        name = ab.name + '之兽';
        dropsAbility = ability;
      }

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.74, 20, 16),
        new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.48, metalness: 0.05 })
      );
      body.castShadow = true;
      group.add(body);

      // 招牌米桃色面庞 (Peach/Cream face plate)
      const facePlate = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 16, 14),
        new THREE.MeshStandardMaterial({ color: 0xffe0b2, roughness: 0.5, metalness: 0.02 })
      );
      facePlate.scale.set(0.9, 0.85, 0.36);
      facePlate.position.set(0, 0.05, 0.52);
      group.add(facePlate);

      // 大大的水汪汪深眸与反光点
      [-0.18, 0.18].forEach(x => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), new THREE.MeshBasicMaterial({ color: 0x212121 }));
        eye.scale.set(0.65, 1.45, 0.4);
        eye.position.set(x, 0.16, 0.72);
        group.add(eye);

        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), eyeWhiteMat);
        hl.position.set(x + (x > 0 ? 0.015 : -0.015), 0.23, 0.77);
        group.add(hl);
      });

      // 招牌橙黄大脚丫
      [-0.34, 0.34].forEach(fx => {
        const foot = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.4 })
        );
        foot.scale.set(1.0, 0.55, 1.4);
        foot.position.set(fx, -0.45, 0.12);
        foot.castShadow = true;
        group.add(foot);
      });

      // 瓦豆鲁迪小巧可爱的左右手
      const handMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.48, metalness: 0.05 });
      [-0.82, 0.82].forEach(hx => {
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), handMat);
        hand.position.set(hx, -0.05, 0.12);
        hand.castShadow = true;
        group.add(hand);
      });
    }

    // 头顶能力指示光晶 (璀璨多面水晶与外层光环，让玩家一眼认出可吸入获取的能力！)
    let auraMesh = null;
    if (dropsAbility && ABILITIES[dropsAbility]) {
      const ab = ABILITIES[dropsAbility];
      const gemGroup = new THREE.Group();
      gemGroup.position.set(0, 1.55, 0);

      const auraCrystal = new THREE.Mesh(
        createPuffyStarGeometry(0.24, 0.10, 0.06),
        new THREE.MeshStandardMaterial({
          color: ab.auraColor,
          emissive: ab.color,
          emissiveIntensity: 0.9,
          roughness: 0.15,
          metalness: 0.45
        })
      );
      gemGroup.add(auraCrystal);

      // 外层微型星环
      const auraRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.035, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: ab.auraColor, emissiveIntensity: 0.5 })
      );
      auraRing.rotation.x = Math.PI / 3;
      gemGroup.add(auraRing);

      group.add(gemGroup);
      auraMesh = gemGroup;
    }

    return {
      mesh: group,
      auraMesh,
      type,
      ability: dropsAbility,
      name,
      hp: maxHp,
      maxHp,
      isInvincible,
      x,
      y,
      z,
      dead: false,
      frozenTime: 0,
      patrolDir: 1,
      patrolRange: 4.5 + Math.random() * 4,
      startX: x,
      update(dt, playerPos) {
        if (this.dead) return;
        if (this.frozenTime > 0) {
          this.frozenTime -= dt;
          return;
        }

        if (this.auraMesh) {
          this.auraMesh.rotation.y += dt * 3.5;
          this.auraMesh.rotation.x += dt * 1.5;
          this.auraMesh.position.y = 1.55 + Math.sin(performance.now() * 0.005) * 0.12;
        }

        const distToPlayer = Math.hypot(this.mesh.position.x - playerPos.x, this.mesh.position.z - playerPos.z);
        const angleToPlayer = Math.atan2(playerPos.x - this.mesh.position.x, playerPos.z - this.mesh.position.z);

        if (customUpdate) {
          customUpdate(dt, distToPlayer, angleToPlayer);
        }

        if (!this.isInvincible && this.type !== 'sandbag') {
          if (distToPlayer < 9.0) {
            this.mesh.position.x += Math.sin(angleToPlayer) * dt * 2.2;
            this.mesh.position.z += Math.cos(angleToPlayer) * dt * 2.2;
            this.mesh.rotation.y = angleToPlayer;
          } else {
            this.mesh.position.x += this.patrolDir * dt * 1.5;
            if (Math.abs(this.mesh.position.x - this.startX) > this.patrolRange) {
              this.patrolDir *= -1;
            }
            this.mesh.rotation.y = this.patrolDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }

        this.x = this.mesh.position.x;
        this.y = this.mesh.position.y;
        this.z = this.mesh.position.z;
      }
    };
  }

  // ---------------- 头部星星掉落物 (Head Stars) ----------------
  function createHeadStar(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.5, z);

    // 经典闪耀五角星 3D 模型 (使用 1:1 丰满立体胖胖五角星)
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffd600,
      emissiveIntensity: 0.65,
      metalness: 0.82,
      roughness: 0.2
    });
    const starMesh = new THREE.Mesh(createPuffyStarGeometry(0.32, 0.14, 0.08), starMat);
    group.add(starMesh);

    // 辅助光晕
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 12), new THREE.MeshBasicMaterial({ color: 0xfff59d, side: THREE.DoubleSide }));
    group.add(halo);

    return {
      mesh: group,
      x,
      y: y + 0.5,
      z,
      vy: 4.5,
      collected: false,
      rotSpeed: 4.5,
      life: 25.0, // 25秒存活
      update(dt) {
        if (this.collected) return;
        this.life -= dt;
        group.rotation.y += this.rotSpeed * dt;
        group.rotation.z += (this.rotSpeed * 0.5) * dt;

        // 物理落地轻弹
        if (this.vy !== 0) {
          this.vy -= 9.8 * dt;
          group.position.y += this.vy * dt;
          if (group.position.y <= y + 0.35) {
            group.position.y = y + 0.35;
            this.vy = 0;
          }
        }
        this.x = group.position.x;
        this.y = group.position.y;
        this.z = group.position.z;
      }
    };
  }

  // ---------------- 投掷爱心 / 星星收服飞行物 ----------------
  function createHeartProjectile(startX, startY, startZ, yaw) {
    const group = new THREE.Group();
    group.position.set(startX, startY + 0.8, startZ);

    // 粉色爱心
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff4081 });
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), heartMat);
    h1.position.set(-0.12, 0.1, 0);
    group.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), heartMat);
    h2.position.set(0.12, 0.1, 0);
    group.add(h2);
    const h3 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 8), heartMat);
    h3.rotation.z = Math.PI;
    h3.position.set(0, -0.15, 0);
    group.add(h3);

    const speed = 18.0;
    const dx = Math.sin(yaw) * speed;
    const dz = -Math.cos(yaw) * speed;

    return {
      mesh: group,
      dx,
      dz,
      life: 1.2,
      update(dt) {
        this.life -= dt;
        group.position.x += this.dx * dt;
        group.position.z += this.dz * dt;
        group.rotation.y += dt * 8.0;
      }
    };
  }

  // ---------------- 最终高难度 Boss: 星核霸王·梦魇帝王 ----------------
  function createFinalBoss(x = 0, y = 2.0, z = -118) {
    const group = new THREE.Group();
    group.name = 'FinalBoss_DreamNightmare';
    group.position.set(x, y, z);

    // 核心巨大球体 (紫黑色星云躯体)
    const coreMat = new THREE.MeshToonMaterial({ color: 0x4a148c, emissive: 0x12005e, emissiveIntensity: 0.4 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 20), coreMat);
    core.castShadow = true;
    group.add(core);

    // 核心下方地面大暗影光晕 (Contact Shadow)
    const bossShadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    bossShadow.rotation.x = -Math.PI / 2;
    bossShadow.position.set(0, -y + 0.04, 0);
    group.add(bossShadow);

    // 巨型猩红独眼
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), eyeMat);
    eye.position.set(0, 0.4, 2.0);
    group.add(eye);

    const pupil = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
    pupil.position.set(0, 0.4, 2.7);
    group.add(pupil);

    // 悬浮巨掌双手
    const handMat = new THREE.MeshLambertMaterial({ color: 0x7c43bd });
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.8), handMat);
    leftHand.position.set(-3.8, 0, 0.8);
    leftHand.castShadow = true;
    group.add(leftHand);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.8), handMat);
    rightHand.position.set(3.8, 0, 0.8);
    rightHand.castShadow = true;
    group.add(rightHand);

    // 狂暴光环 (二阶段激活)
    const enrageHalo = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.25, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff1744, wireframe: true, transparent: true, opacity: 0 })
    );
    enrageHalo.position.set(0, 0, 0);
    group.add(enrageHalo);

    return {
      mesh: group,
      core,
      eye,
      leftHand,
      rightHand,
      enrageHalo,
      maxHp: 40,
      hp: 40,
      phase: 1,
      dead: false,
      attackTimer: 2.0,
      slamAnim: 0,
      shockwaves: [],
      projectiles: [],
      update(dt, playerPos, spawnMinionCb) {
        if (this.dead) return;

        // 浮动动画
        group.position.y = 2.0 + Math.sin(performance.now() / 450) * 0.45;
        this.leftHand.position.y = Math.sin(performance.now() / 320) * 0.35;
        this.rightHand.position.y = -Math.sin(performance.now() / 320) * 0.35;

        // 阶段转换检查 (HP <= 20 进入狂暴二阶段)
        if (this.hp <= 20 && this.phase === 1) {
          this.phase = 2;
          this.enrageHalo.material.opacity = 0.9;
          this.core.material.color.setHex(0xb71c1c);
          KirbyAudio.bossRoar();
        }

        // 攻击循环决策
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          if (this.phase === 1) {
            // 一阶段：巨掌地面重砸产生环形震荡波 / 召唤小怪
            const rnd = Math.random();
            if (rnd > 0.4) {
              this.slamAttack();
            } else if (spawnMinionCb) {
              spawnMinionCb(group.position.x - 4, group.position.z + 5);
              spawnMinionCb(group.position.x + 4, group.position.z + 5);
            }
            this.attackTimer = 3.5;
          } else {
            // 二阶段狂暴：星弹连发 + 地面震荡波
            this.starBarrage(playerPos);
            this.slamAttack();
            this.attackTimer = 2.6;
          }
        }

        // 更新冲击波
        this.shockwaves.forEach(sw => sw.update(dt));
        this.shockwaves = this.shockwaves.filter(sw => sw.active);

        // 更新星弹
        this.projectiles.forEach(pj => pj.update(dt));
        this.projectiles = this.projectiles.filter(pj => pj.active);
      },

      slamAttack() {
        KirbyAudio.hit();
        // 瞬间将双手下砸并产生冲击波
        this.leftHand.position.y = -1.5;
        this.rightHand.position.y = -1.5;
        const sw = createShockwave(group.position.x, 0.2, group.position.z);
        this.shockwaves.push(sw);
        group.parent.add(sw.mesh);
      },

      starBarrage(playerPos) {
        KirbyAudio.bossRoar();
        for (let i = -1; i <= 1; i++) {
          const pj = createBossStarProjectile(group.position.x + i * 2, group.position.y + 1, group.position.z + 2, playerPos);
          this.projectiles.push(pj);
          group.parent.add(pj.mesh);
        }
      }
    };
  }

  // Boss 地面冲击波
  function createShockwave(x, y, z) {
    const geo = new THREE.RingGeometry(0.5, 1.2, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff1744, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);

    return {
      mesh,
      radius: 0.5,
      maxRadius: 18.0,
      active: true,
      update(dt) {
        this.radius += dt * 11.0;
        mesh.scale.set(this.radius, this.radius, 1);
        mesh.material.opacity = Math.max(0, 1 - (this.radius / this.maxRadius));
        if (this.radius >= this.maxRadius) {
          this.active = false;
          if (mesh.parent) mesh.parent.remove(mesh);
        }
      }
    };
  }

  // Boss 暗星飞弹
  function createBossStarProjectile(x, y, z, targetPos) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshBasicMaterial({ color: 0xe040fb })
    );
    mesh.position.set(x, y, z);
    const angle = Math.atan2(targetPos.x - x, targetPos.z - z);
    const speed = 12.0;

    return {
      mesh,
      dx: Math.sin(angle) * speed,
      dz: Math.cos(angle) * speed,
      active: true,
      life: 4.0,
      update(dt) {
        this.life -= dt;
        mesh.position.x += this.dx * dt;
        mesh.position.z += this.dz * dt;
        mesh.rotation.y += dt * 6.0;
        if (this.life <= 0) {
          this.active = false;
          if (mesh.parent) mesh.parent.remove(mesh);
        }
      }
    };
  }

  // ---------------- 场景中的可吸入汽车道具 (触发汽车塞满嘴) ----------------
  function createCarProp(x = 4, y = 0.5, z = -10) {
    const group = new THREE.Group();
    group.name = 'Prop_CarMouth';
    group.position.set(x, y, z);

    const carBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.45, 2.3),
      new THREE.MeshToonMaterial({ color: 0x42a5f5 })
    );
    carBody.position.y = 0.35;
    group.add(carBody);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.4, 1.2),
      new THREE.MeshToonMaterial({ color: 0xffffff })
    );
    roof.position.set(0, 0.75, -0.2);
    group.add(roof);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
    [[-0.85, 0.25, 0.75], [0.85, 0.25, 0.75], [-0.85, 0.25, -0.75], [0.85, 0.25, -0.75]].forEach(p => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], p[1], p[2]);
      group.add(w);
    });

    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshBasicMaterial({ color: 0xffea00 })
    );
    badge.position.set(0, 1.8, 0);
    group.add(badge);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.75, 16),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, side: THREE.DoubleSide })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.05, 0);
    group.add(ring);

    return {
      type: 'car',
      mesh: group,
      x, y, z,
      active: true,
      update(dt) {
        badge.rotation.y += dt * 3;
        badge.position.y = 1.8 + Math.sin(performance.now() * 0.005) * 0.15;
        ring.rotation.z += dt * 2;
      }
    };
  }

  // ---------------- 场景中的可吸入交通三角锥 (触发三角锥塞满嘴) ----------------
  function createConeProp(x = -4, y = 0.5, z = -22) {
    const group = new THREE.Group();
    group.name = 'Prop_ConeMouth';
    group.position.set(x, y, z);

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 1.7, 16),
      new THREE.MeshToonMaterial({ color: 0xffd600 })
    );
    cone.position.y = 0.85;
    group.add(cone);

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.48, 0.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    stripe.position.y = 0.75;
    group.add(stripe);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.15, 1.3),
      new THREE.MeshToonMaterial({ color: 0xffb300 })
    );
    base.position.y = 0.08;
    group.add(base);

    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32),
      new THREE.MeshBasicMaterial({ color: 0xffeb3b })
    );
    badge.position.set(0, 2.1, 0);
    group.add(badge);

    return {
      type: 'cone',
      mesh: group,
      x, y, z,
      active: true,
      update(dt) {
        badge.rotation.y += dt * 3;
        badge.position.y = 2.1 + Math.sin(performance.now() * 0.005) * 0.12;
      }
    };
  }

  // ---------------- 金色瓦豆鲁迪牢笼 (被困的瓦豆鲁迪，可攻击击破救出) ----------------
  function createWaddleDeeCage(x = 5, y = 0.6, z = -32, id = 1) {
    const group = new THREE.Group();
    group.name = 'WaddleDeeCage_' + id;
    group.position.set(x, y, z);

    const cageBars = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.2 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), goldMat);
      bar.position.set(Math.cos(ang) * 0.85, 0.8, Math.sin(ang) * 0.85);
      cageBars.add(bar);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
    dome.position.y = 1.6;
    cageBars.add(dome);
    const starTop = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
    starTop.position.y = 2.45;
    cageBars.add(starTop);
    group.add(cageBars);

    const deeGroup = new THREE.Group();
    deeGroup.position.set(0, 0.45, 0);

    const deeBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 14),
      new THREE.MeshToonMaterial({ color: 0xf57c00 })
    );
    deeGroup.add(deeBody);

    const deeFace = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 14, 12),
      new THREE.MeshToonMaterial({ color: 0xffe0b2 })
    );
    deeFace.scale.set(0.9, 0.85, 0.4);
    deeFace.position.set(0, 0.05, 0.3);
    deeGroup.add(deeFace);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x212121 });
    [-0.14, 0.14].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
      eye.scale.set(0.6, 1.4, 0.4);
      eye.position.set(ex, 0.15, 0.48);
      deeGroup.add(eye);
    });

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 6, 16), new THREE.MeshBasicMaterial({ color: 0x1976d2 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.35;
    deeGroup.add(band);

    [-0.26, 0.26].forEach(fx => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshToonMaterial({ color: 0xd84315 }));
      f.scale.set(1.1, 0.5, 1.4);
      f.position.set(fx, -0.4, 0.1);
      deeGroup.add(f);
    });
    group.add(deeGroup);

    return {
      id,
      mesh: group,
      x, y, z,
      hp: 2,
      saved: false,
      celebrating: false,
      celebTimer: 0,
      hit(dmg = 1) {
        this.hp -= dmg;
        if (this.hp <= 0 && !this.saved) {
          this.saved = true;
          this.celebrating = true;
          cageBars.visible = false;
        }
      },
      update(dt) {
        if (this.celebrating) {
          this.celebTimer += dt;
          deeGroup.rotation.y += dt * 10;
          deeGroup.position.y = 0.45 + Math.sin(this.celebTimer * 8) * 0.6;
        } else {
          deeGroup.position.y = 0.45 + Math.sin(performance.now() * 0.004) * 0.04;
        }
      }
    };
  }

  // ---------------- 剑气弧光飞刃特效 (用于利剑与超级剑) ----------------
  function createSlashWaveMesh(x, y, z, yaw, scale = 1.0, color = 0x81c784) {
    const geo = new THREE.RingGeometry(1.2 * scale, 2.2 * scale, 24, 1, 0, Math.PI * 0.85);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = -yaw + Math.PI / 4;
    mesh.position.set(x, y + 0.8, z);

    return {
      mesh,
      life: 0.28,
      update(dt) {
        this.life -= dt;
        mesh.material.opacity = Math.max(0, this.life / 0.28);
        mesh.scale.multiplyScalar(1 + dt * 3.5);
      }
    };
  }

  // ---------------- 场景中的自动贩卖机道具 (探索发现 塞满嘴) ----------------
  function createVendingProp(x = -4, y = 0.5, z = -14) {
    const group = new THREE.Group();
    group.name = 'Prop_VendingMouth';
    group.position.set(x, y, z);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.85, 1.05),
      new THREE.MeshToonMaterial({ color: 0x0288d1 })
    );
    body.position.y = 0.95;
    group.add(body);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0xe0f7fa }));
    glass.position.set(0, 1.15, 0.53);
    group.add(glass);

    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshBasicMaterial({ color: 0x00e676 })
    );
    badge.position.set(0, 2.25, 0);
    group.add(badge);

    return {
      type: 'vending',
      mesh: group,
      x, y, z,
      active: true,
      update(dt) {
        badge.rotation.y += dt * 3;
        badge.position.y = 2.25 + Math.sin(performance.now() * 0.005) * 0.12;
      }
    };
  }

  // ---------------- 场景中的圈圈古代金环道具 (探索发现 塞满嘴) ----------------
  function createRingProp(x = 4, y = 0.5, z = -18) {
    const group = new THREE.Group();
    group.name = 'Prop_RingMouth';
    group.position.set(x, y, z);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.22, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.2 })
    );
    ring.position.y = 1.1;
    group.add(ring);

    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshBasicMaterial({ color: 0xffeb3b })
    );
    badge.position.set(0, 2.35, 0);
    group.add(badge);

    return {
      type: 'ring',
      mesh: group,
      x, y, z,
      active: true,
      update(dt) {
        badge.rotation.y += dt * 3;
        badge.position.y = 2.35 + Math.sin(performance.now() * 0.005) * 0.12;
      }
    };
  }

  // ---------------- 贩卖机塞满嘴 易拉罐子弹 (Can Gatling) ----------------
  function createSodaCanProjectile(x, y, z, yaw) {
    const geo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 10);
    const colors = [0xff1744, 0x00e676, 0xffea00, 0x2979ff];
    const mat = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y + 0.9, z);

    const speed = 28.0;
    const dx = Math.sin(yaw) * speed;
    const dz = -Math.cos(yaw) * speed;

    return {
      mesh,
      dx,
      dz,
      life: 0.85,
      update(dt) {
        this.life -= dt;
        mesh.position.x += this.dx * dt;
        mesh.position.z += this.dz * dt;
        mesh.rotation.z += dt * 18;
      }
    };
  }

  // ---------------- 圈圈塞满嘴 强风飓风冲击波 (Hurricane Blast) ----------------
  function createWindBlastMesh(x, y, z, yaw) {
    const geo = new THREE.RingGeometry(0.5, 1.4, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xb2ebf2, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = -yaw + Math.PI / 2;
    mesh.position.set(x, y + 0.9, z);

    const speed = 22.0;
    const dx = Math.sin(yaw) * speed;
    const dz = -Math.cos(yaw) * speed;

    return {
      mesh,
      dx,
      dz,
      scale: 1.0,
      life: 1.1,
      update(dt) {
        this.life -= dt;
        mesh.position.x += this.dx * dt;
        mesh.position.z += this.dz * dt;
        this.scale += dt * 4.5;
        mesh.scale.set(this.scale, this.scale, 1);
        mesh.material.opacity = Math.max(0, this.life / 1.1);
      }
    };
  }

  // ---------------- 超级怪兽烈焰 巨龙扫荡 (Monster Flame) ----------------
  function createMonsterFlameMesh(x, y, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, y + 1.2, z);

    // 火焰巨龙龙头
    const headMat = new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.95 });
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.8, 12), headMat);
    head.rotation.x = Math.PI / 2;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    [-0.8, 0.8].forEach(ex => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), eyeMat);
      e.position.set(ex, 0.6, 0.8);
      group.add(e);
    });

    const speed = 20.0;
    const dx = Math.sin(yaw) * speed;
    const dz = -Math.cos(yaw) * speed;
    group.rotation.y = yaw + Math.PI;

    return {
      mesh: group,
      dx,
      dz,
      life: 1.6,
      update(dt) {
        this.life -= dt;
        group.position.x += this.dx * dt;
        group.position.z += this.dz * dt;
        group.scale.addScalar(dt * 1.8);
      }
    };
  }

  // ---------------- 超级全垒打木槌 重力震击 (Grand Hammer) ----------------
  function createHammerSlamMesh(x, y, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.1, z);

    // 环状冲击波与地裂碎块
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 2.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb300, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    for (let i = 0; i < 6; i++) {
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x8d6e63 })
      );
      const ang = (i / 6) * Math.PI * 2;
      chunk.position.set(Math.cos(ang) * 1.6, 0.3, Math.sin(ang) * 1.6);
      group.add(chunk);
    }

    return {
      mesh: group,
      scale: 1.0,
      life: 0.7,
      update(dt) {
        this.life -= dt;
        this.scale += dt * 8.0;
        group.scale.set(this.scale, 1, this.scale);
        ring.material.opacity = Math.max(0, this.life / 0.7);
      }
    };
  }

  // ---------------- 经典常驻 Boss: 风语大树 (Whispy Woods) ----------------
  function createWhispyWoods(x = 0, y = 0, z = -65) {
    const group = new THREE.Group();
    group.name = 'Boss_WhispyWoods';
    group.position.set(x, y, z);

    // 粗壮棕褐树干 (PBR 树皮木质纹理与泥土根系)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.86, metalness: 0.04 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 7.5, 20), trunkMat);
    trunk.position.y = 3.75;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 树木底部蜿蜒扎根地面的 5 条原木根系 (Root buttresses)
    for (let r = 0; r < 5; r++) {
      const ang = (r * Math.PI * 2) / 5 + 0.35;
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.2, 8), trunkMat);
      root.position.set(Math.cos(ang) * 2.3, 0.45, Math.sin(ang) * 2.3);
      root.rotation.x = Math.sin(ang) * 0.45;
      root.rotation.z = -Math.cos(ang) * 0.45;
      root.scale.set(1.0, 0.5, 1.5);
      group.add(root);
    }

    // 树底地面大型柔和接触阴影 (Large Contact Shadow Disc)
    const treeShadow = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    treeShadow.rotation.x = -Math.PI / 2;
    treeShadow.position.set(0, 0.03, 0);
    group.add(treeShadow);

    // 茂密葱郁的多层巨型树冠 (微光柔绒 Switch 森林质感)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.65, metalness: 0.02 });
    const leafMatDark = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.72, metalness: 0.02 });
    const canopy = new THREE.Group();
    canopy.position.y = 7.5;
    [
      [0, 1.2, 0, 3.2, leafMat],
      [-1.8, 0.4, 0.5, 2.4, leafMatDark],
      [1.8, 0.4, -0.5, 2.4, leafMat],
      [0, 2.2, 0.5, 2.6, leafMatDark],
      [0.8, 1.8, -1.2, 2.2, leafMat]
    ].forEach(([cx, cy, cz, cr, mat]) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(cr, 18, 14), mat);
      c.position.set(cx, cy, cz);
      c.castShadow = true;
      canopy.add(c);
    });
    group.add(canopy);

    // 树冠上悬挂的鲜红诱人苹果 (高光反射果皮)
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.22, metalness: 0.08 });
    const appleStemMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.7 });
    const apples = [];
    [[-1.5, 6.8, 1.8], [1.4, 7.2, 1.6], [0, 8.2, 2.2]].forEach((pos) => {
      const aGroup = new THREE.Group();
      aGroup.position.set(pos[0], pos[1], pos[2]);
      const app = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 12), appleMat);
      app.castShadow = true;
      aGroup.add(app);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6), appleStemMat);
      stem.position.y = 0.35;
      aGroup.add(stem);
      group.add(aGroup);
      apples.push(aGroup);
    });

    // 树干上的拟人化五官 (大眼睛、长树枝木鼻、大张的嘴巴)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x212121 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.8, 0.8].forEach(ex => {
      const eyeHole = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), eyeMat);
      eyeHole.scale.set(0.8, 1.3, 0.4);
      eyeHole.position.set(ex, 4.8, 2.2);
      group.add(eyeHole);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), pupilMat);
      pupil.position.set(ex, 4.95, 2.3);
      group.add(pupil);
    });

    // 突出的圆锥长木鼻
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 10), trunkMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 4.3, 2.8);
    group.add(nose);

    // 吹出空气弹的圆圆大嘴
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1b0000 });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.12, 8, 16), mouthMat);
    mouth.position.set(0, 3.2, 2.25);
    group.add(mouth);

    return {
      name: '风语大树 (Whispy Woods)',
      mesh: group,
      trunk,
      canopy,
      apples,
      maxHp: 30,
      hp: 30,
      dead: false,
      attackTimer: 2.5,
      puffProjectiles: [],
      fallingApples: [],
      shakeTimer: 0,
      update(dt, playerPos) {
        if (this.dead) return;

        // 树冠微风摇曳
        canopy.rotation.z = Math.sin(performance.now() * 0.002) * 0.04;
        canopy.rotation.x = Math.cos(performance.now() * 0.002) * 0.03;

        // 受击颤抖
        if (this.shakeTimer > 0) {
          this.shakeTimer -= dt;
          group.position.x = x + Math.sin(this.shakeTimer * 50) * 0.25;
        } else {
          group.position.x = x;
        }

        // 攻击计时
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          const rnd = Math.random();
          if (rnd > 0.45) {
            this.blowAirPuff(playerPos);
          } else {
            this.dropApples(playerPos);
          }
          this.attackTimer = 3.2;
        }

        // 更新吹出的空气炮弹
        this.puffProjectiles.forEach(p => p.update(dt));
        this.puffProjectiles = this.puffProjectiles.filter(p => p.active);

        // 更新滚落苹果
        this.fallingApples.forEach(a => a.update(dt));
        this.fallingApples = this.fallingApples.filter(a => a.active);
      },
      blowAirPuff(playerPos) {
        KirbyAudio.whispyPuff();
        const startPos = new THREE.Vector3(x, 3.2, z + 2.5);
        [-0.35, 0, 0.35].forEach(offsetAngle => {
          const p = createAirPuffProjectile(startPos.x, startPos.y, startPos.z, playerPos, offsetAngle);
          this.puffProjectiles.push(p);
          if (group.parent) group.parent.add(p.mesh);
        });
      },
      dropApples(playerPos) {
        KirbyAudio.hit();
        this.shakeTimer = 0.6;
        for (let i = 0; i < 2; i++) {
          const app = createFallingApple(x + (Math.random() - 0.5) * 4, 8.0, z + 2.0 + Math.random() * 2, playerPos);
          this.fallingApples.push(app);
          if (group.parent) group.parent.add(app.mesh);
        }
      },
      takeDamage(dmg) {
        this.hp -= dmg;
        this.shakeTimer = 0.4;
        KirbyAudio.hit();
        if (this.hp <= 0) {
          this.dead = true;
          canopy.position.y = 4.0;
          canopy.scale.set(0.9, 0.6, 0.9);
          KirbyAudio.victory();
        }
      }
    };
  }

  // 风语大树 空气炮弹
  function createAirPuffProjectile(sx, sy, sz, targetPos, angleOffset = 0) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    mesh.position.set(sx, sy, sz);
    const baseAngle = Math.atan2(targetPos.x - sx, targetPos.z - sz) + angleOffset;
    const speed = 9.5;

    return {
      mesh,
      dx: Math.sin(baseAngle) * speed,
      dz: Math.cos(baseAngle) * speed,
      active: true,
      life: 3.5,
      update(dt) {
        this.life -= dt;
        mesh.position.x += this.dx * dt;
        mesh.position.z += this.dz * dt;
        mesh.scale.addScalar(dt * 0.4);
        mesh.material.opacity = Math.max(0, this.life / 3.5);
        if (this.life <= 0) {
          this.active = false;
          if (mesh.parent) mesh.parent.remove(mesh);
        }
      }
    };
  }

  // 风语大树 掉落滚落苹果
  function createFallingApple(sx, sy, sz, targetPos) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshToonMaterial({ color: 0xd50000 })
    );
    mesh.position.set(sx, sy, sz);

    return {
      mesh,
      vy: 0,
      active: true,
      life: 5.0,
      bounced: 0,
      update(dt) {
        this.life -= dt;
        this.vy -= 18.0 * dt;
        mesh.position.y += this.vy * dt;
        mesh.position.z += 2.5 * dt;
        if (mesh.position.y <= 0.42) {
          mesh.position.y = 0.42;
          this.vy = -this.vy * 0.65;
          this.bounced++;
        }
        if (this.bounced > 4 || this.life <= 0) {
          this.active = false;
          if (mesh.parent) mesh.parent.remove(mesh);
        }
      }
    };
  }

  return {
    CHARACTERS,
    ABILITIES,
    createKirbyModel,
    attachAbilityHat,
    createEnemy,
    createHeadStar,
    createHeartProjectile,
    createFinalBoss,
    createWhispyWoods,
    createCarProp,
    createConeProp,
    createVendingProp,
    createRingProp,
    createSodaCanProjectile,
    createWindBlastMesh,
    createMonsterFlameMesh,
    createHammerSlamMesh,
    createWaddleDeeCage,
    createSlashWaveMesh,
    createGuideKirbyModel,
    createSlideDust,
    createAirPuffMesh
  };
})();

if (typeof window !== 'undefined') window.KirbyEntities = KirbyEntities;
if (typeof module !== 'undefined' && module.exports) module.exports = KirbyEntities;
