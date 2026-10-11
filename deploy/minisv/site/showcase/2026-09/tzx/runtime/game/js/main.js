// js/main.js - 游戏主启动入口、生命周期管理与主渲染循环

window.MSV_SHOWCASE_READY.then(() => {
  const uiManager = new UIManager();

  // 1. 实例化各个子系统模块。任意资源初始化失败都要落到可读的加载错误，而不是黑屏。
  let gameScene;
  let controls;
  let combatSystem;
  let aiManager;
  let englishJudge;
  let levelManager;
  try {
    gameScene = new GameScene('canvas-container');
    controls = new InputController(gameScene);
    combatSystem = new CombatSystem(gameScene);
    aiManager = new AIManager(gameScene, combatSystem);
    englishJudge = new EnglishJudge();
    levelManager = new LevelManager(gameScene, combatSystem, aiManager, englishJudge, uiManager);
  } catch (error) {
    console.error('游戏初始化失败', error);
    uiManager.setLoadingProgress(100, '月球战场初始化失败');
    uiManager.showLoadingError('当前浏览器无法创建 3D 战场，请刷新页面或更换支持 WebGL 的浏览器。');
    return;
  }

  // 2. 模拟加载阶段 (启动模块)
  let loadProgress = 0;
  const loadSteps = [
    { target: 25, desc: "正在加载月球高精地表与环形山..." },
    { target: 55, desc: "装配艾拉、凯恩、纪元行者与 10 人机甲战队..." },
    { target: 80, desc: "校准木星冰铁陨石与六档英语输入攻击链路..." },
    { target: 100, desc: "月球基地球面连接建立！请进入战场！" }
  ];

  let currentStepIdx = 0;
  const loadInterval = setInterval(() => {
    if (currentStepIdx < loadSteps.length) {
      const step = loadSteps[currentStepIdx];
      loadProgress += 4;
      uiManager.setLoadingProgress(Math.min(loadProgress, step.target), step.desc);
      if (loadProgress >= step.target) {
        currentStepIdx++;
      }
    } else {
      clearInterval(loadInterval);
      uiManager.setLoadingProgress(100, "星际战场初始化完毕！");
      uiManager.showStartButton(() => {
        // 先选英语等级，再选角色，最后进入第 1 关。
        uiManager.showGradeSelect((selectedGradeId) => {
          uiManager.showCharSelect((selectedCharId) => {
            levelManager.startNewGame(selectedCharId, selectedGradeId);
          });
        });
      });
    }
  }, 40);

  // 3. 游戏主循环 (Game Loop)
  function animate() {
    requestAnimationFrame(animate);

    // 渲染 3D 场景并获取增量时间
    const delta = Math.min(gameScene.render(), 0.1);

    // 刷新输入控制器
    controls.update();

    const player = levelManager.player;

    // 当且仅当玩家存在且游戏未被暂停时更新战斗与操作
    if (player && player.isAlive && !levelManager.isGamePaused) {

      // A. 玩家移动控制 (根据摄像机水平 Yaw 映射移动向量)
      const mv = controls.moveVector;
      const isMoving = mv.lengthSq() > 0.01;

      if (isMoving) {
        const yaw = gameScene.cameraYaw;
        // 计算基于摄像机朝向的前进与右移向量
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const rightX = -forwardZ;
        const rightZ = forwardX;

        // 综合移动方向
        const moveDir = new THREE.Vector3(
          rightX * mv.x + forwardX * mv.y,
          0,
          rightZ * mv.x + forwardZ * mv.y
        ).normalize();

        // 移动角色
        player.mesh.position.addScaledVector(moveDir, player.moveSpeed * delta);

        // 限制在战斗圆圈内
        aiManager.clampToArena(player.mesh.position);

        // 角色面朝移动方向平滑旋转
        const targetRotY = Math.atan2(moveDir.x, moveDir.z);
        player.mesh.rotation.y = THREE.MathUtils.lerp(player.mesh.rotation.y, targetRotY, 0.2);
      } else {
        // 待机时面朝摄像机前方
        const aimRotY = gameScene.cameraYaw + Math.PI;
        player.mesh.rotation.y = THREE.MathUtils.lerp(player.mesh.rotation.y, aimRotY, 0.08);
      }

      // 玩家肢体动画更新
      player.updateAnimation(delta, isMoving);

      // B. 换枪响应
      if (controls.consumeSwitchWeapon()) {
        const newWep = combatSystem.switchWeapon(player);
        uiManager.updateWeaponButton(newWep);
      }

      // C. 战术声呐扫描响应 (Delta Force 寻敌技能)
      if (controls.consumeTacticalScan()) {
        levelManager.performTacticalScan();
      }

      // D. 开火响应 (沿第三人称准星视线方向射击)
      const shootDir = new THREE.Vector3(
        -Math.sin(gameScene.cameraYaw),
        -Math.sin(gameScene.cameraPitch * 0.5),
        -Math.cos(gameScene.cameraYaw)
      ).normalize();

      const wantsSingleShot = controls.consumeFire();
      if (wantsSingleShot || controls.isFiring) {
        const didShoot = combatSystem.shoot(player, shootDir);
        if (didShoot) uiManager.showShotFeedback();
      }

      // E. 准星磁吸与敌人目标瞄准锁定检测 (瞄准敌人准星变红)
      let isTargetingEnemy = false;
      const aimRay = new THREE.Ray(player.mesh.position, shootDir);
      levelManager.enemies.forEach(e => {
        if (e.isAlive) {
          const dToLine = aimRay.distanceToPoint(e.mesh.position);
          const distToPlayer = player.mesh.position.distanceTo(e.mesh.position);
          if (dToLine < (e.isBoss ? 4.0 : 1.8) && distToPlayer < 35) {
            isTargetingEnemy = true;
          }
        }
      });
      uiManager.setReticleLocked(isTargetingEnemy);

      // F. 摄像机第三人称平滑跟踪玩家
      gameScene.updateCamera(player.mesh.position, player.mesh.rotation.y);

      // G. 同步更新玩家状态 HUD
      uiManager.updatePlayerHud(player);
    }

    // 4. 驱动 AI、弹道与陨石世界逻辑 (未暂停时)
    if (player && !levelManager.isGamePaused) {
      // 弹道与命中 (传递 uiManager 提供 Hitmarker 与伤害浮字反馈)
      combatSystem.update(delta, levelManager.allies, levelManager.enemies, (deadUnit, shooter) => {
        // 击杀精英掉落 Boss 钥匙
        if (deadUnit.isElite && levelManager.currentLevel === 2) {
          gameScene.spawnBossKeyDrop(deadUnit.mesh.position);
          uiManager.showRadioChatter('凯恩', '金色芯片已掉落', true);
        }
      }, null, uiManager);

      // 4 名电脑队友 (战术护卫与无线电呼叫)
      aiManager.updateAllies(delta, levelManager.allies, levelManager.enemies, player, uiManager);

      // 敌方巡逻机器人与 Boss (警戒巡逻与开火预警激光)
      aiManager.updateEnemies(delta, levelManager.enemies, levelManager.allies, player, (bossPos) => {
        levelManager.spawnBossMinion(bossPos);
      }, uiManager);

      // 木星冰铁陨石更新与碰撞
      gameScene.updateMeteors(delta, player, (dmg, pushDir) => {
        if (player && player.isAlive) {
          player.takeDamage(dmg);
          player.mesh.position.addScaledVector(pushDir, 5.0);
          aiManager.clampToArena(player.mesh.position);
          uiManager.updatePlayerHud(player);
          uiManager.showDamageVignette();
        }
      });

      // 关卡主控更新 (任务统计、胜负判定、英语判定流转)
      levelManager.update(delta);
    }
  }

  // 启动主渲染循环
  animate();
});
