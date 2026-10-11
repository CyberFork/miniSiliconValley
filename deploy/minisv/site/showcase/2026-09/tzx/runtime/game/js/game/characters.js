// js/game/characters.js - 高精3D机甲、动漫英雄（艾拉/凯恩/纪元行者）与可爱高科技机器人模型系统

class CharacterBuilder {
  // 生成动漫面部贴图 (艾拉)
  static createAnimeFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // 肤色底色
    ctx.fillStyle = '#ffeedd';
    ctx.fillRect(0, 0, 256, 256);

    // 腮红
    const blushL = ctx.createRadialGradient(70, 150, 2, 70, 150, 28);
    blushL.addColorStop(0, 'rgba(255, 120, 140, 0.45)');
    blushL.addColorStop(1, 'rgba(255, 238, 221, 0)');
    ctx.fillStyle = blushL;
    ctx.beginPath(); ctx.arc(70, 150, 28, 0, Math.PI * 2); ctx.fill();

    const blushR = ctx.createRadialGradient(186, 150, 2, 186, 150, 28);
    blushR.addColorStop(0, 'rgba(255, 120, 140, 0.45)');
    blushR.addColorStop(1, 'rgba(255, 238, 221, 0)');
    ctx.fillStyle = blushR;
    ctx.beginPath(); ctx.arc(186, 150, 28, 0, Math.PI * 2); ctx.fill();

    // 绘制水灵灵的大动漫眼 (左眼 & 右眼)
    const drawEye = (x, y) => {
      // 眼白
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y, 24, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      // 蓝绿渐变眼眸
      const irisGrad = ctx.createLinearGradient(x, y - 28, x, y + 28);
      irisGrad.addColorStop(0, '#0055aa');
      irisGrad.addColorStop(0.5, '#00aaff');
      irisGrad.addColorStop(1, '#00f0ff');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 18, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      // 瞳孔
      ctx.fillStyle = '#002244';
      ctx.beginPath();
      ctx.arc(x, y + 6, 9, 0, Math.PI * 2);
      ctx.fill();

      // 高光 (大亮点与小亮点)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 6, y - 10, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x + 7, y + 8, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 睫毛与上眼线
      ctx.strokeStyle = '#2b1b17';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y - 4, 25, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    };

    drawEye(75, 115);
    drawEye(181, 115);

    // 小巧嘴巴
    ctx.strokeStyle = '#d45566';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 172, 12, 0.2, Math.PI - 0.2);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  // 生成友方机器人呆萌发光护目镜贴图
  static createRobotFaceTexture(colorHex = '#00f0ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // 深邃高亮黑色护目镜
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, 256, 128);

    // 发光数码双眼
    ctx.fillStyle = colorHex;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 15;

    // 左眼 (带萌感圆角矩形/椭圆)
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(45, 36, 50, 48, 16) : ctx.ellipse(70, 60, 25, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // 右眼
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(161, 36, 50, 48, 16) : ctx.ellipse(186, 60, 25, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  // 生成敌方巡逻机器人凶悍发光护目镜贴图
  static createEnemyFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#110608';
    ctx.fillRect(0, 0, 256, 128);

    // 红色条状单眼或锐利双眼
    ctx.fillStyle = '#ff2255';
    ctx.shadowColor = '#ff2255';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.moveTo(35, 45); ctx.lineTo(110, 68); ctx.lineTo(105, 82); ctx.lineTo(35, 58);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(221, 45); ctx.lineTo(146, 68); ctx.lineTo(151, 82); ctx.lineTo(221, 58);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  // 1. 构建艾拉 (Ayla) - 金发宇宙治愈天使
  static createAylaModel(scale = 1.0) {
    const group = new THREE.Group();

    // 优质材质
    const whiteArmorMat = new THREE.MeshStandardMaterial({
      color: 0xf5f8fc,
      metalness: 0.35,
      roughness: 0.25
    });
    const cyanTrimMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x004466,
      emissiveIntensity: 0.3
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.8,
      roughness: 0.2
    });
    const darkSuitMat = new THREE.MeshStandardMaterial({
      color: 0x18243b,
      roughness: 0.5
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0xffd24d,
      roughness: 0.45,
      metalness: 0.1
    });
    const neonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff
    });

    // A. 躯干 (曲线流线型战甲)
    const torso = new THREE.Group();
    torso.position.y = 1.35 * scale;

    // 上胸甲
    const chestGeo = new THREE.CylinderGeometry(0.36 * scale, 0.28 * scale, 0.55 * scale, 16);
    const chest = new THREE.Mesh(chestGeo, whiteArmorMat);
    chest.castShadow = true;
    torso.add(chest);

    // 胸口微型发光宝石核心
    const gemGeo = new THREE.OctahedronGeometry(0.12 * scale);
    const gem = new THREE.Mesh(gemGeo, neonGlowMat);
    gem.position.set(0, 0.08 * scale, 0.26 * scale);
    torso.add(gem);

    // 金色镶边腰带
    const beltGeo = new THREE.TorusGeometry(0.3 * scale, 0.04 * scale, 8, 24);
    beltGeo.rotateX(Math.PI / 2);
    const belt = new THREE.Mesh(beltGeo, goldMat);
    belt.position.y = -0.22 * scale;
    torso.add(belt);

    // 战甲短裙摆
    const skirtGeo = new THREE.CylinderGeometry(0.28 * scale, 0.44 * scale, 0.3 * scale, 16, 1, true);
    const skirt = new THREE.Mesh(skirtGeo, whiteArmorMat);
    skirt.position.y = -0.34 * scale;
    torso.add(skirt);

    group.add(torso);

    // B. 头部 (萌系动漫脸 + 金发 + 耳机天线)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.95 * scale, 0);

    // 面部球体
    const faceTex = CharacterBuilder.createAnimeFaceTexture();
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.6
    });
    const headGeo = new THREE.SphereGeometry(0.36 * scale, 24, 24);
    headGeo.rotateY(-Math.PI / 2); // 贴图面朝正前方
    const headMesh = new THREE.Mesh(headGeo, faceMat);
    headGroup.add(headMesh);

    // 金色头发组
    const hairGroup = new THREE.Group();
    // 前刘海
    for (let i = -3; i <= 3; i++) {
      const bangGeo = new THREE.ConeGeometry(0.08 * scale, 0.38 * scale, 8);
      bangGeo.rotateX(Math.PI);
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(i * 0.09 * scale, 0.18 * scale, 0.28 * scale);
      bang.rotation.z = -i * 0.15;
      bang.rotation.x = 0.2;
      hairGroup.add(bang);
    }
    // 后脑丰满发髻
    const backHairGeo = new THREE.SphereGeometry(0.42 * scale, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 0.05 * scale, -0.06 * scale);
    hairGroup.add(backHair);

    // 双马尾/长发侧束
    const tailL = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.9 * scale, 8), hairMat);
    tailL.position.set(-0.35 * scale, -0.15 * scale, -0.15 * scale);
    tailL.rotation.z = 0.35;
    hairGroup.add(tailL);

    const tailR = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.9 * scale, 8), hairMat);
    tailR.position.set(0.35 * scale, -0.15 * scale, -0.15 * scale);
    tailR.rotation.z = -0.35;
    hairGroup.add(tailR);

    // 科技猫耳/光子耳机
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.08 * scale, 12), cyanTrimMat);
    earL.position.set(-0.38 * scale, 0.05 * scale, 0);
    earL.rotation.z = Math.PI / 2;
    headGroup.add(earL);

    const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.08 * scale, 12), cyanTrimMat);
    earR.position.set(0.38 * scale, 0.05 * scale, 0);
    earR.rotation.z = Math.PI / 2;
    headGroup.add(earR);

    headGroup.add(hairGroup);
    group.add(headGroup);

    // C. 手臂与武器
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.46 * scale, 1.55 * scale, 0);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.46 * scale, 1.55 * scale, 0);

    // 圆润圆球肩甲
    const shGeo = new THREE.SphereGeometry(0.16 * scale, 12, 12);
    leftArmGroup.add(new THREE.Mesh(shGeo, cyanTrimMat));
    rightArmGroup.add(new THREE.Mesh(shGeo, cyanTrimMat));

    // 上臂与手套
    const armGeo = new THREE.CylinderGeometry(0.09 * scale, 0.11 * scale, 0.65 * scale, 12);
    armGeo.translate(0, -0.35 * scale, 0);
    leftArmGroup.add(new THREE.Mesh(armGeo, whiteArmorMat));
    rightArmGroup.add(new THREE.Mesh(armGeo, whiteArmorMat));

    // 艾拉法杖/光子光束枪
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.65 * scale, 0.25 * scale);

    const staffGeo = new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 1.4 * scale, 8);
    staffGeo.rotateX(Math.PI / 2);
    const staff = new THREE.Mesh(staffGeo, goldMat);
    weaponGroup.add(staff);

    // 法杖前端发光聚合水晶
    const tipRingGeo = new THREE.TorusGeometry(0.16 * scale, 0.03 * scale, 8, 16);
    const tipRing = new THREE.Mesh(tipRingGeo, cyanTrimMat);
    tipRing.position.set(0, 0, 0.7 * scale);
    weaponGroup.add(tipRing);

    const tipCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * scale), neonGlowMat);
    tipCrystal.position.set(0, 0, 0.7 * scale);
    weaponGroup.add(tipCrystal);

    rightArmGroup.add(weaponGroup);

    group.add(leftArmGroup);
    group.add(rightArmGroup);

    // D. 腿部与铠甲战靴
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.18 * scale, 0.88 * scale, 0);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.18 * scale, 0.88 * scale, 0);

    const thighGeo = new THREE.CylinderGeometry(0.11 * scale, 0.13 * scale, 0.45 * scale, 12);
    thighGeo.translate(0, -0.22 * scale, 0);
    leftLegGroup.add(new THREE.Mesh(thighGeo, darkSuitMat));
    rightLegGroup.add(new THREE.Mesh(thighGeo, darkSuitMat));

    // 科技护膝与战靴
    const bootGeo = new THREE.CylinderGeometry(0.14 * scale, 0.16 * scale, 0.55 * scale, 12);
    bootGeo.translate(0, -0.68 * scale, 0.03 * scale);
    leftLegGroup.add(new THREE.Mesh(bootGeo, whiteArmorMat));
    rightLegGroup.add(new THREE.Mesh(bootGeo, whiteArmorMat));

    group.add(leftLegGroup);
    group.add(rightLegGroup);

    // E. 璀璨光之羽翼 (半透明青白渐变)
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const createWingMesh = (isLeft) => {
      const wingG = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, (1.1 - i * 0.25) * scale, 4), wingMat);
        feather.rotation.z = (isLeft ? -1 : 1) * (0.4 + i * 0.28);
        feather.rotation.y = (isLeft ? 0.3 : -0.3);
        feather.position.set((isLeft ? -0.35 - i * 0.15 : 0.35 + i * 0.15) * scale, (0.2 - i * 0.15) * scale, -0.2 * scale);
        wingG.add(feather);
      }
      return wingG;
    };

    const wings = new THREE.Group();
    wings.position.set(0, 1.45 * scale, -0.15 * scale);
    wings.add(createWingMesh(true));
    wings.add(createWingMesh(false));
    group.add(wings);

    // 头顶高科技全息血条 (紧凑流线型)
    const billboard = CharacterBuilder.createSciFiBillboard('艾拉 · 宇宙治疗者', 'ally', scale);
    billboard.position.y = 2.65 * scale;
    group.add(billboard);

    return {
      mesh: group,
      parts: {
        torso,
        headGroup,
        leftArmGroup,
        rightArmGroup,
        leftLegGroup,
        rightLegGroup,
        weaponGroup,
        wings,
        billboard
      }
    };
  }

  // 2. 构建凯恩 (Kane) - 宇宙重装勇士 (参考 UI 凯恩立绘)
  static createKaneModel(scale = 1.0) {
    const group = new THREE.Group();

    const redArmorMat = new THREE.MeshStandardMaterial({
      color: 0xdd2244,
      metalness: 0.5,
      roughness: 0.3
    });
    const blueSuitMat = new THREE.MeshStandardMaterial({
      color: 0x142c54,
      metalness: 0.6,
      roughness: 0.35
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xdde5f0,
      metalness: 0.8,
      roughness: 0.2
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // 躯干
    const torso = new THREE.Group();
    torso.position.y = 1.4 * scale;

    const chestGeo = new THREE.CylinderGeometry(0.44 * scale, 0.34 * scale, 0.65 * scale, 12);
    const chest = new THREE.Mesh(chestGeo, redArmorMat);
    chest.castShadow = true;
    torso.add(chest);

    // 三角胸甲发光反应堆
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.18 * scale, 0.12 * scale, 3), glowMat);
    coreMesh.rotateX(Math.PI / 2);
    coreMesh.position.set(0, 0.1 * scale, 0.32 * scale);
    torso.add(coreMesh);

    // 强化腹甲
    const abGeo = new THREE.CylinderGeometry(0.33 * scale, 0.36 * scale, 0.3 * scale, 10);
    const abs = new THREE.Mesh(abGeo, blueSuitMat);
    abs.position.y = -0.38 * scale;
    torso.add(abs);

    group.add(torso);

    // 头部 (帅气热血机甲战士)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.05 * scale, 0);

    const helmGeo = new THREE.SphereGeometry(0.38 * scale, 16, 16);
    const helmet = new THREE.Mesh(helmGeo, blueSuitMat);
    headGroup.add(helmet);

    // 金红发光护目镜
    const visorGeo = new THREE.BoxGeometry(0.44 * scale, 0.16 * scale, 0.22 * scale);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    visor.position.set(0, 0, 0.28 * scale);
    headGroup.add(visor);

    // 战术尖刺冠角
    const crestGeo = new THREE.ConeGeometry(0.15 * scale, 0.45 * scale, 4);
    crestGeo.rotateX(-0.3);
    const crest = new THREE.Mesh(crestGeo, redArmorMat);
    crest.position.set(0, 0.35 * scale, 0.05 * scale);
    headGroup.add(crest);

    group.add(headGroup);

    // 粗壮肩甲与重装双臂
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.58 * scale, 1.62 * scale, 0);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.58 * scale, 1.62 * scale, 0);

    const pauldronGeo = new THREE.SphereGeometry(0.24 * scale, 12, 12);
    const pauldronL = new THREE.Mesh(pauldronGeo, redArmorMat);
    const pauldronR = new THREE.Mesh(pauldronGeo, redArmorMat);
    leftArmGroup.add(pauldronL);
    rightArmGroup.add(pauldronR);

    const armGeo = new THREE.CylinderGeometry(0.13 * scale, 0.15 * scale, 0.7 * scale, 12);
    armGeo.translate(0, -0.38 * scale, 0);
    leftArmGroup.add(new THREE.Mesh(armGeo, silverMat));
    rightArmGroup.add(new THREE.Mesh(armGeo, silverMat));

    // 重型脉冲枪
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.7 * scale, 0.3 * scale);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.25 * scale, 0.9 * scale), silverMat);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.8 * scale, 8), redArmorMat);
    gunBarrel.rotateX(Math.PI / 2);
    gunBarrel.position.z = 0.5 * scale;
    weaponGroup.add(gunBody);
    weaponGroup.add(gunBarrel);
    rightArmGroup.add(weaponGroup);

    group.add(leftArmGroup);
    group.add(rightArmGroup);

    // 粗壮腿部
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.22 * scale, 0.92 * scale, 0);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.22 * scale, 0.92 * scale, 0);

    const legGeo = new THREE.CylinderGeometry(0.15 * scale, 0.18 * scale, 0.95 * scale, 12);
    legGeo.translate(0, -0.48 * scale, 0);
    leftLegGroup.add(new THREE.Mesh(legGeo, blueSuitMat));
    rightLegGroup.add(new THREE.Mesh(legGeo, blueSuitMat));

    group.add(leftLegGroup);
    group.add(rightLegGroup);

    const billboard = CharacterBuilder.createSciFiBillboard('凯恩 · 宇宙战斗者', 'ally', scale);
    billboard.position.y = 2.75 * scale;
    group.add(billboard);

    return {
      mesh: group,
      parts: {
        torso,
        headGroup,
        leftArmGroup,
        rightArmGroup,
        leftLegGroup,
        rightLegGroup,
        weaponGroup,
        billboard
      }
    };
  }

  // 3. 构建智能战术电脑队友
  static createChibiAllyRobot(name = '战术机甲', scale = 1.0) {
    const group = new THREE.Group();

    // 陶瓷白与科技电光蓝
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf0f5fa,
      metalness: 0.3,
      roughness: 0.25
    });
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x0088ff,
      metalness: 0.6,
      roughness: 0.3
    });
    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // 躯干 (饱满圆滑胶囊形)
    const torso = new THREE.Group();
    torso.position.y = 1.35 * scale;

    const bodyGeo = new THREE.SphereGeometry(0.42 * scale, 20, 20);
    bodyGeo.scale(1.0, 1.15, 0.88);
    const body = new THREE.Mesh(bodyGeo, whiteMat);
    body.castShadow = true;
    torso.add(body);

    // 圆形胸口微型聚能环
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.15 * scale, 0.035 * scale, 8, 20), blueMat);
    coreRing.position.set(0, 0.08 * scale, 0.34 * scale);
    torso.add(coreRing);

    const coreLight = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 12, 12), cyanGlowMat);
    coreLight.position.set(0, 0.08 * scale, 0.33 * scale);
    torso.add(coreLight);

    group.add(torso);

    // 头部 (大圆萌高科技机甲头盔)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.05 * scale, 0);

    const domeGeo = new THREE.SphereGeometry(0.44 * scale, 24, 24);
    const dome = new THREE.Mesh(domeGeo, whiteMat);
    headGroup.add(dome);

    // 弧面护目镜面板 (带发光萌眼)
    const visorTex = CharacterBuilder.createRobotFaceTexture('#00f0ff');
    const visorMat = new THREE.MeshBasicMaterial({ map: visorTex });
    const visorGeo = new THREE.SphereGeometry(0.445 * scale, 20, 20, 0, Math.PI, 0, Math.PI * 0.6);
    visorGeo.rotateY(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.02 * scale, 0.02 * scale);
    headGroup.add(visor);

    // 两侧科技耳机天线
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.08 * scale, 16), blueMat);
    earL.position.set(-0.44 * scale, 0, 0);
    earL.rotation.z = Math.PI / 2;
    headGroup.add(earL);

    const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.08 * scale, 16), blueMat);
    earR.position.set(0.44 * scale, 0, 0);
    earR.rotation.z = Math.PI / 2;
    headGroup.add(earR);

    group.add(headGroup);

    // 手臂与武器
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.52 * scale, 1.55 * scale, 0);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.52 * scale, 1.55 * scale, 0);

    const shGeo = new THREE.SphereGeometry(0.18 * scale, 16, 16);
    leftArmGroup.add(new THREE.Mesh(shGeo, blueMat));
    rightArmGroup.add(new THREE.Mesh(shGeo, blueMat));

    const armGeo = new THREE.CylinderGeometry(0.1 * scale, 0.13 * scale, 0.6 * scale, 12);
    armGeo.translate(0, -0.3 * scale, 0);
    leftArmGroup.add(new THREE.Mesh(armGeo, whiteMat));
    rightArmGroup.add(new THREE.Mesh(armGeo, whiteMat));

    // 手持轻型速射脉冲枪
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.58 * scale, 0.22 * scale);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.7 * scale, 10), blueMat);
    gun.rotateX(Math.PI / 2);
    weaponGroup.add(gun);
    rightArmGroup.add(weaponGroup);

    group.add(leftArmGroup);
    group.add(rightArmGroup);

    // 粗圆战靴腿部 (Q版可爱英雄站姿)
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2 * scale, 0.85 * scale, 0);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2 * scale, 0.85 * scale, 0);

    const legGeo = new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 0.85 * scale, 16);
    legGeo.translate(0, -0.42 * scale, 0.02 * scale);
    leftLegGroup.add(new THREE.Mesh(legGeo, whiteMat));
    rightLegGroup.add(new THREE.Mesh(legGeo, whiteMat));

    group.add(leftLegGroup);
    group.add(rightLegGroup);

    const billboard = CharacterBuilder.createSciFiBillboard(name, 'ally', scale);
    billboard.position.y = 2.7 * scale;
    group.add(billboard);

    return {
      mesh: group,
      parts: {
        torso,
        headGroup,
        leftArmGroup,
        rightArmGroup,
        leftLegGroup,
        rightLegGroup,
        weaponGroup,
        billboard
      }
    };
  }

  // 4. 构建敌方巡逻机器人 (红黑 Q版战斗机器人，参考 UI 红色机甲)
  static createChibiEnemyRobot(name = '巡逻机器人', scale = 1.0) {
    const group = new THREE.Group();

    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xcc1133,
      metalness: 0.5,
      roughness: 0.3
    });
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x222633,
      metalness: 0.8,
      roughness: 0.35
    });
    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff2255 });

    // 躯干
    const torso = new THREE.Group();
    torso.position.y = 1.35 * scale;

    const bodyGeo = new THREE.SphereGeometry(0.42 * scale, 20, 20);
    bodyGeo.scale(1.0, 1.15, 0.88);
    const body = new THREE.Mesh(bodyGeo, crimsonMat);
    body.castShadow = true;
    torso.add(body);

    // 红色胸口高能反应堆
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.15 * scale, 0.035 * scale, 8, 20), gunmetalMat);
    coreRing.position.set(0, 0.08 * scale, 0.34 * scale);
    torso.add(coreRing);

    const coreLight = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 12, 12), redGlowMat);
    coreLight.position.set(0, 0.08 * scale, 0.33 * scale);
    torso.add(coreLight);

    group.add(torso);

    // 头部 (带红光锐利目镜)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.05 * scale, 0);

    const domeGeo = new THREE.SphereGeometry(0.44 * scale, 24, 24);
    const dome = new THREE.Mesh(domeGeo, crimsonMat);
    headGroup.add(dome);

    const visorTex = CharacterBuilder.createEnemyFaceTexture();
    const visorMat = new THREE.MeshBasicMaterial({ map: visorTex });
    const visorGeo = new THREE.SphereGeometry(0.445 * scale, 20, 20, 0, Math.PI, 0, Math.PI * 0.6);
    visorGeo.rotateY(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.02 * scale, 0.02 * scale);
    headGroup.add(visor);

    // 战术警示角
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.35 * scale, 8), gunmetalMat);
    horn.position.set(0, 0.45 * scale, 0);
    headGroup.add(horn);

    group.add(headGroup);

    // 手臂与武器
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.52 * scale, 1.55 * scale, 0);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.52 * scale, 1.55 * scale, 0);

    const shGeo = new THREE.SphereGeometry(0.18 * scale, 16, 16);
    leftArmGroup.add(new THREE.Mesh(shGeo, gunmetalMat));
    rightArmGroup.add(new THREE.Mesh(shGeo, gunmetalMat));

    const armGeo = new THREE.CylinderGeometry(0.11 * scale, 0.14 * scale, 0.6 * scale, 12);
    armGeo.translate(0, -0.3 * scale, 0);
    leftArmGroup.add(new THREE.Mesh(armGeo, crimsonMat));
    rightArmGroup.add(new THREE.Mesh(armGeo, crimsonMat));

    // 激光发射炮
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.58 * scale, 0.22 * scale);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 0.75 * scale, 10), gunmetalMat);
    cannon.rotateX(Math.PI / 2);
    weaponGroup.add(cannon);
    rightArmGroup.add(weaponGroup);

    group.add(leftArmGroup);
    group.add(rightArmGroup);

    // 腿部
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2 * scale, 0.85 * scale, 0);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2 * scale, 0.85 * scale, 0);

    const legGeo = new THREE.CylinderGeometry(0.13 * scale, 0.17 * scale, 0.85 * scale, 16);
    legGeo.translate(0, -0.42 * scale, 0.02 * scale);
    leftLegGroup.add(new THREE.Mesh(legGeo, gunmetalMat));
    rightLegGroup.add(new THREE.Mesh(legGeo, gunmetalMat));

    group.add(leftLegGroup);
    group.add(rightLegGroup);

    const billboard = CharacterBuilder.createSciFiBillboard(name, 'enemy', scale);
    billboard.position.y = 2.7 * scale;
    group.add(billboard);

    return {
      mesh: group,
      parts: {
        torso,
        headGroup,
        leftArmGroup,
        rightArmGroup,
        leftLegGroup,
        rightLegGroup,
        weaponGroup,
        billboard
      }
    };
  }

  // 5. 巨大机甲 BOSS (第3关 最终银河怪物)
  static createGiantBoss() {
    const scale = 3.6;
    const group = new THREE.Group();

    const redArmorMat = new THREE.MeshStandardMaterial({
      color: 0xb30e2a,
      metalness: 0.6,
      roughness: 0.25
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1b2230,
      metalness: 0.85,
      roughness: 0.2
    });
    const cyanReactorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    // 宏伟重型躯干
    const torso = new THREE.Group();
    torso.position.y = 1.4 * scale;

    const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * scale, 0.42 * scale, 0.8 * scale, 12), redArmorMat);
    chestMesh.castShadow = true;
    torso.add(chestMesh);

    // 巨大胸前脉冲聚能环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24 * scale, 0.06 * scale, 12, 24), darkSteelMat);
    ring.position.set(0, 0.1 * scale, 0.44 * scale);
    torso.add(ring);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 16, 16), cyanReactorMat);
    core.position.set(0, 0.1 * scale, 0.42 * scale);
    torso.add(core);

    // 双肩巨炮发射舱
    const cannonL = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 1.8 * scale, 12), darkSteelMat);
    cannonL.rotateX(Math.PI / 2);
    cannonL.position.set(-0.85 * scale, 0.45 * scale, 0);
    torso.add(cannonL);

    const cannonR = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 1.8 * scale, 12), darkSteelMat);
    cannonR.rotateX(Math.PI / 2);
    cannonR.position.set(0.85 * scale, 0.45 * scale, 0);
    torso.add(cannonR);

    group.add(torso);

    // 头部 (霸气巨兽面甲)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.1 * scale, 0);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 16, 16), darkSteelMat);
    headGroup.add(helm);

    const bossVisor = new THREE.Mesh(new THREE.BoxGeometry(0.48 * scale, 0.15 * scale, 0.25 * scale), cyanReactorMat);
    bossVisor.position.set(0, 0.05 * scale, 0.3 * scale);
    headGroup.add(bossVisor);

    // 巨型王冠犄角
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.7 * scale, 8), redArmorMat);
    hornL.position.set(-0.35 * scale, 0.45 * scale, 0);
    hornL.rotation.z = -0.4;
    headGroup.add(hornL);

    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.7 * scale, 8), redArmorMat);
    hornR.position.set(0.35 * scale, 0.45 * scale, 0);
    hornR.rotation.z = 0.4;
    headGroup.add(hornR);

    group.add(headGroup);

    // 巨型手臂
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.85 * scale, 1.7 * scale, 0);
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.85 * scale, 1.7 * scale, 0);

    const armGeo = new THREE.CylinderGeometry(0.2 * scale, 0.26 * scale, 0.9 * scale, 12);
    armGeo.translate(0, -0.45 * scale, 0);
    leftArmGroup.add(new THREE.Mesh(armGeo, redArmorMat));
    rightArmGroup.add(new THREE.Mesh(armGeo, redArmorMat));

    group.add(leftArmGroup);
    group.add(rightArmGroup);

    // 巨型腿部
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.35 * scale, 0.95 * scale, 0);
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.35 * scale, 0.95 * scale, 0);

    const legGeo = new THREE.CylinderGeometry(0.24 * scale, 0.32 * scale, 1.1 * scale, 16);
    legGeo.translate(0, -0.55 * scale, 0.05 * scale);
    leftLegGroup.add(new THREE.Mesh(legGeo, darkSteelMat));
    rightLegGroup.add(new THREE.Mesh(legGeo, darkSteelMat));

    group.add(leftLegGroup);
    group.add(rightLegGroup);

    const billboard = CharacterBuilder.createSciFiBillboard('银河外掠食者 · 极光核心', 'boss', scale);
    billboard.position.y = 2.9 * scale;
    group.add(billboard);

    return {
      mesh: group,
      parts: {
        torso,
        headGroup,
        leftArmGroup,
        rightArmGroup,
        leftLegGroup,
        rightLegGroup,
        billboard
      }
    };
  }

  // 6. 精美科幻悬浮血条 (告别巨大绿色厚方块，打造流线型全息HUD)
  static createSciFiBillboard(name, type, scale = 1.0) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 82;
    const ctx = canvas.getContext('2d');

    CharacterBuilder.drawSciFiBillboardContent(ctx, name, 100, type);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(mat);

    // 敌人词牌需要在第三人称远景中仍然可读；友方名称保持紧凑，避免战场拥挤。
    const enemyLabel = type === 'enemy' || type === 'boss';
    const labelWidth = enemyLabel ? (type === 'boss' ? 2.7 : 2.25) : 1.55;
    const labelHeight = enemyLabel ? (type === 'boss' ? 0.86 : 0.74) : 0.5;
    sprite.scale.set(labelWidth * Math.min(scale, 1.8), labelHeight * Math.min(scale, 1.8), 1);
    sprite.userData = { canvas, ctx, texture, type, name, english: null };
    return sprite;
  }

  static drawSciFiBillboardContent(ctx, name, hpPercent, type, english = null) {
    ctx.clearRect(0, 0, 256, 82);

    const isAlly = type === 'ally' || type === 'player';
    const mainColor = isAlly ? '#00f0ff' : '#ff3366';
    const glowColor = isAlly ? 'rgba(0, 240, 255, 0.6)' : 'rgba(255, 51, 102, 0.6)';

    // 半透明全息底板 (圆角发光胶囊)
    ctx.fillStyle = 'rgba(6, 12, 28, 0.78)';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(10, 6, 236, 70, 12) : ctx.rect(10, 6, 236, 70);
    ctx.fill();
    ctx.stroke();

    // 角色名称
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 6;
    ctx.fillText(name, 22, 24);

    // 敌人头顶显示英语目标，同时保留真实生命条；英文提示不再代表攻击次数。
    if (english && english.word) {
      ctx.font = '900 23px -apple-system, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 7;
      const englishLabel = `${english.word}  英语目标`;
      let englishFontSize = 23;
      while (englishFontSize > 15) {
        ctx.font = `900 ${englishFontSize}px -apple-system, sans-serif`;
        if (ctx.measureText(englishLabel).width <= 218) break;
        englishFontSize -= 1;
      }
      ctx.fillText(englishLabel, 22, 49);

      const combatBarX = 22;
      const combatBarY = 58;
      const combatBarW = 212;
      const combatBarH = 12;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(combatBarX, combatBarY, combatBarW, combatBarH, 4) : ctx.rect(combatBarX, combatBarY, combatBarW, combatBarH);
      ctx.fill();
      const combatFillW = Math.max(0, Math.min(combatBarW, combatBarW * (hpPercent / 100)));
      if (combatFillW > 0) {
        ctx.fillStyle = isAlly ? '#00ff88' : '#ff6688';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(combatBarX, combatBarY, combatFillW, combatBarH, 4) : ctx.rect(combatBarX, combatBarY, combatFillW, combatBarH);
        ctx.fill();
      }
      return;
    }

    // 生命槽外框
    const barX = 22;
    const barY = 48;
    const barW = 212;
    const barH = 12;

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(barX, barY, barW, barH, 4) : ctx.rect(barX, barY, barW, barH);
    ctx.fill();

    // 生命填充条 (渐变流光)
    const fillW = Math.max(0, Math.min(barW, barW * (hpPercent / 100)));
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      if (isAlly) {
        grad.addColorStop(0, '#00e5ff');
        grad.addColorStop(1, '#00ff88');
      } else {
        grad.addColorStop(0, '#ff9900');
        grad.addColorStop(1, '#ff3366');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(barX, barY, fillW, barH, 4) : ctx.rect(barX, barY, fillW, barH);
      ctx.fill();
    }
  }

  static updateHealthBillboard(sprite, hpPercent) {
    if (!sprite || !sprite.userData || !sprite.userData.ctx) return;
    const { ctx, texture, type, name } = sprite.userData;
    CharacterBuilder.drawSciFiBillboardContent(ctx, name, hpPercent, type, sprite.userData.english);
    texture.needsUpdate = true;
  }

  static updateEnglishBillboard(sprite, english) {
    if (!sprite || !sprite.userData || !sprite.userData.ctx) return;
    sprite.userData.english = english ? { ...english } : null;
    const { ctx, texture, type, name } = sprite.userData;
    CharacterBuilder.drawSciFiBillboardContent(ctx, name, 100, type, sprite.userData.english);
    texture.needsUpdate = true;
  }
}

// 角色实体类封装
class CharacterEntity {
  constructor(options = {}) {
    this.id = options.id || `char_${Math.random()}`;
    this.name = options.name || '机甲';
    this.team = options.team || 'ally'; // 'ally' | 'enemy'
    this.isPlayer = options.isPlayer || false;
    this.charId = options.charId || 'kane';
    this.isBoss = options.isBoss || false;

    // 属性
    this.maxHp = options.maxHp || (this.isBoss ? 800 : 100);
    this.hp = this.maxHp;
    this.moveSpeed = options.moveSpeed || (this.isBoss ? 3.2 : 6.8);
    this.isAlive = true;

    // 英语目标状态仅用于展示词汇提示，普通射击伤害不依赖这些字段。
    this.englishTarget = options.englishTarget || null;
    this.englishProgress = 0;
    this.englishRequiredHits = options.englishRequiredHits || 3;
    this.englishPhase = 1;
    this.englishPhases = options.englishPhases || (this.isBoss ? 3 : 1);
    this.suppressedTimer = 0;

    // 武器属性
    this.weaponType = 'laser';
    this.fireCooldown = 0;
    this.damage = options.damage || (this.isBoss ? 18 : 15);

    // 动画状态
    this.walkCycle = 0;
    this.isWalking = false;
    this.flashTimer = 0;
    this.idleTimer = Math.random() * 5;

    // 三角洲战术侦查与护盾状态
    this.isScanned = false;
    this.scannedTimer = 0;
    this.isShieldActive = false;
    this.shieldMesh = null;

    // 构建模型：根据角色身份专属定制
    if (this.isBoss) {
      this.modelData = CharacterBuilder.createGiantBoss();
    } else if (this.isPlayer) {
      if (this.charId === 'ayla') {
        this.modelData = CharacterBuilder.createAylaModel(1.05);
      } else if (this.charId === 'kane') {
        this.modelData = CharacterBuilder.createKaneModel(1.05);
      } else {
        // 纪元行者 (敏捷突击机甲)
        this.modelData = CharacterBuilder.createChibiAllyRobot('纪元行者', 1.05);
      }
    } else {
      if (this.team === 'ally') {
        this.modelData = CharacterBuilder.createChibiAllyRobot(this.name, 0.95);
      } else {
        this.modelData = CharacterBuilder.createChibiEnemyRobot(this.name, 0.95);
      }
    }

    this.mesh = this.modelData.mesh;
    this.parts = this.modelData.parts;

    if (this.englishTarget) this.setEnglishTarget(this.englishTarget);
  }

  takeDamage(amount) {
    if (!this.isAlive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 0.15;

    CharacterBuilder.updateHealthBillboard(this.parts.billboard, (this.hp / this.maxHp) * 100);

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  setEnglishTarget(wordObj) {
    this.englishTarget = { ...wordObj, word: String(wordObj.word || '').toUpperCase() };
    this.englishProgress = 0;
    this.englishPhase = 1;
    this.updateEnglishBillboard();
  }

  updateEnglishBillboard() {
    if (!this.parts || !this.parts.billboard || !this.englishTarget) return;
    CharacterBuilder.updateEnglishBillboard(this.parts.billboard, {
      word: this.englishTarget.word,
      progress: this.englishProgress,
      required: this.englishRequiredHits,
      phase: this.englishPhase,
      phases: this.englishPhases
    });
  }

  getEnglishProgressLabel() {
    return this.englishTarget ? `英语目标：${this.englishTarget.word}` : '英语学习提示';
  }

  markSuppressed(duration = 0.7) {
    if (!this.isAlive) return;
    this.suppressedTimer = Math.max(this.suppressedTimer, duration);
    this.flashTimer = Math.max(this.flashTimer, 0.16);
  }

  applyEnglishHit() {
    // 兼容旧英语练习调用，但绝不改变战斗生命值或死亡状态。
    if (!this.isAlive || !this.englishTarget) return { defeated: false, phaseCleared: false };
    this.englishProgress += 1;
    this.updateEnglishBillboard();
    return { defeated: false, phaseCleared: false, practiced: true };
  }

  die() {
    this.isAlive = false;
    this.hp = 0;
    if (this.team === 'enemy') this.mesh.visible = false;
    if (this.parts.billboard) this.parts.billboard.visible = false;
  }

  revive() {
    this.isAlive = true;
    this.hp = this.maxHp;
    this.mesh.visible = true;
    this.mesh.rotation.x = 0;
    this.mesh.rotation.z = 0;
    this.mesh.position.y = 0;
    if (this.parts.billboard) {
      this.parts.billboard.visible = true;
      CharacterBuilder.updateHealthBillboard(this.parts.billboard, 100);
    }
  }

  updateAnimation(delta, isMoving) {
    if (this.suppressedTimer > 0) this.suppressedTimer = Math.max(0, this.suppressedTimer - delta);

    // 战术声呐扫描高亮计时
    if (this.scannedTimer > 0) {
      this.scannedTimer -= delta;
      if (this.scannedTimer <= 0) this.isScanned = false;
    }

    // Boss 偏转护盾网格更新
    if (this.isBoss && this.isShieldActive) {
      if (!this.shieldMesh) {
        const sGeo = new THREE.IcosahedronGeometry(4.2, 2);
        const sMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          wireframe: true,
          transparent: true,
          opacity: 0.6
        });
        this.shieldMesh = new THREE.Mesh(sGeo, sMat);
        this.shieldMesh.position.y = 4.0;
        this.mesh.add(this.shieldMesh);
      }
      this.shieldMesh.visible = true;
      this.shieldMesh.rotation.y += 1.8 * delta;
      this.shieldMesh.rotation.x += 0.8 * delta;
    } else if (this.shieldMesh) {
      this.shieldMesh.visible = false;
    }

    if (!this.isAlive) {
      if (this.mesh.rotation.x > -Math.PI / 2) {
        this.mesh.rotation.x -= 4.0 * delta;
        this.mesh.position.y = Math.max(0.3, this.mesh.position.y - 2.0 * delta);
      }
      return;
    }

    this.idleTimer += delta;

    // 艾拉光之翼轻微扇动浮动
    if (this.parts.wings) {
      this.parts.wings.rotation.y = Math.sin(this.idleTimer * 3.5) * 0.15;
    }

    // 肢体步态动画
    if (isMoving) {
      this.walkCycle += delta * (this.isBoss ? 4.5 : 11);
      const legAngle = Math.sin(this.walkCycle) * 0.45;
      const armAngle = Math.cos(this.walkCycle) * 0.4;

      if (this.parts.leftLegGroup) this.parts.leftLegGroup.rotation.x = legAngle;
      if (this.parts.rightLegGroup) this.parts.rightLegGroup.rotation.x = -legAngle;
      if (this.parts.leftArmGroup) this.parts.leftArmGroup.rotation.x = -armAngle;
      if (this.parts.rightArmGroup) this.parts.rightArmGroup.rotation.x = armAngle * 0.5;

      // 躯干轻微随步伐律动
      if (this.parts.torso) {
        this.parts.torso.position.y = (this.isBoss ? 1.4 * 3.6 : 1.35) + Math.abs(Math.sin(this.walkCycle * 2)) * 0.06;
      }
    } else {
      // 待机轻微呼吸浮动
      const breath = Math.sin(this.idleTimer * 2.5) * 0.03;
      if (this.parts.torso) {
        this.parts.torso.position.y = (this.isBoss ? 1.4 * 3.6 : 1.35) + breath;
      }
      if (this.parts.leftLegGroup) this.parts.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.parts.leftLegGroup.rotation.x, 0, 0.1);
      if (this.parts.rightLegGroup) this.parts.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.parts.rightLegGroup.rotation.x, 0, 0.1);
      if (this.parts.leftArmGroup) this.parts.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.parts.leftArmGroup.rotation.x, 0, 0.1);
      if (this.parts.rightArmGroup) this.parts.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.parts.rightArmGroup.rotation.x, 0, 0.1);
    }
  }
}

window.CharacterBuilder = CharacterBuilder;
window.CharacterEntity = CharacterEntity;
