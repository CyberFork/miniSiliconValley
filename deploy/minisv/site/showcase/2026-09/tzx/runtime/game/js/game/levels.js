// js/game/levels.js - 三角洲战术三关骨架、据点搜索清剿、Boss密钥夺取与英语剧情核验调度器

class LevelManager {
  constructor(gameScene, combatSystem, aiManager, englishJudge, uiManager) {
    this.gameScene = gameScene;
    this.combatSystem = combatSystem;
    this.aiManager = aiManager;
    this.englishJudge = englishJudge;
    this.uiManager = uiManager;

    // 关卡数据状态
    this.currentLevel = 1;
    this.hasBossKey = false;
    this.isLevelTransitioning = false;
    this.isGamePaused = false;

    // 队伍角色容器
    this.player = null;
    this.allies = [];
    this.enemies = [];

    // 当前关卡任务项
    this.missions = [];

    // 陨石生成计时器
    this.meteorSpawnTimer = 0;
    this.meteorSpawnInterval = 6.0;

    // 战术声呐脉冲扫描冷却计时 (12秒CD)
    this.scanCooldown = 0;
    this.maxScanCooldown = 12.0;

    // Boss 护盾破盾事件触发状态 (Level 3)
    this.bossShieldTriggered = false;

    // 选取的玩家角色 (ayla / kane / walker)
    this.selectedCharId = 'ayla';
    this.selectedGradeId = 'junior1_up';
  }

  // 初始化关卡流程
  startNewGame(charId = 'ayla', gradeId = 'junior1_up') {
    this.selectedCharId = charId;
    this.selectedGradeId = gradeId || 'junior1_up';
    this.currentLevel = 1;
    this.hasBossKey = false;
    this.meteorSpawnTimer = 0;
    this.scanCooldown = 0;
    this.combatSystem.stats = { playerKills: 0, totalDamageDealt: 0, hasSwitchedWeapon: false };
    this.loadLevel(1);
  }

  // 加载指定关卡
  loadLevel(levelNum) {
    this.currentLevel = levelNum;
    this.isLevelTransitioning = false;
    this.isGamePaused = false;
    this.meteorSpawnTimer = 0;
    this.bossShieldTriggered = false;
    if (this.aiManager) this.aiManager.bossSummonTimer = 0;

    // 清理旧角色与旧子弹、陨石、掉落物
    this.clearArena();

    // 1. 生成玩家与 4 名电脑队友 (蓝队 5 人战术小队)
    this.spawnBlueTeam();
    if (this.player) {
      if (levelNum === 1 || levelNum === 2) {
        // 初始镜头与玩家面朝前方 Alpha 战术据点 (-18, 0, 4)，一进入战场正中央就是青色冲天光柱！
        this.gameScene.cameraYaw = 0.91;
        this.player.mesh.rotation.y = this.gameScene.cameraYaw + Math.PI;
      } else {
        // 第 3 关镜头直面对准巨大 Boss 极光核心 (0, 0, -22)
        this.gameScene.cameraYaw = 0;
        this.player.mesh.rotation.y = this.gameScene.cameraYaw + Math.PI;
      }
      this.gameScene.snapCamera(this.player.mesh.position);
    }

    // 2. 根据关卡配置生成敌方单位 (三角洲据点驻防)
    this.setupLevelContent(levelNum);

    // 3. 更新 UI
    const gradeConfig = this.englishJudge.getGradeConfig(this.selectedGradeId);
    this.uiManager.updateTopHud(this.currentLevel, this.getAliveEnemyCount(), this.hasBossKey, levelNum === 3, gradeConfig.label);
    this.uiManager.updateMissions(this.missions);
    this.uiManager.updatePlayerHud(this.player);
    this.uiManager.updateWeaponButton(this.combatSystem.weapons[this.player.weaponType]);
    this.uiManager.updateTeamStatus(this.allies.filter(a => a.isAlive).length, false);
    this.uiManager.updateScannerButton(this.scanCooldown, this.maxScanCooldown);
    this.updateGameplayGoal();
  }

  // 清空战场对象
  clearArena() {
    this.combatSystem.clearAllProjectiles();
    this.gameScene.clearMeteors();

    if (this.gameScene.bossKeyDrop) {
      this.gameScene.scene.remove(this.gameScene.bossKeyDrop.mesh);
      this.gameScene.bossKeyDrop = null;
    }

    this.allies.forEach(a => {
      this.gameScene.scene.remove(a.mesh);
    });
    this.enemies.forEach(e => {
      this.gameScene.scene.remove(e.mesh);
    });

    this.allies = [];
    this.enemies = [];
    this.player = null;
  }

  // 生成我方 5 人战术队伍 (玩家 1 + 电脑队友 4)
  spawnBlueTeam() {
    this.player = new CharacterEntity({
      id: 'player',
      name: this.selectedCharId === 'ayla' ? '艾拉' : (this.selectedCharId === 'kane' ? '凯恩' : '纪元行者'),
      team: 'ally',
      isPlayer: true,
      charId: this.selectedCharId,
      maxHp: 100,
      damage: 18
    });
    this.player.mesh.position.set(0, 0, 18);
    this.gameScene.scene.add(this.player.mesh);
    this.allies.push(this.player);

    // 4 名电脑队友
    const allyConfigs = [
      { x: -4.5, z: 20, name: '苍穹先锋' },
      { x: 4.5, z: 20, name: '星核支援' },
      { x: -6.5, z: 24, name: '重装机卫' },
      { x: 6.5, z: 24, name: '聚能射手' }
    ];

    allyConfigs.forEach((cfg, idx) => {
      let allyCharId = 'kane';
      if (this.selectedCharId !== 'ayla' && idx === 0) {
        allyCharId = 'ayla';
      }
      const ally = new CharacterEntity({
        id: `ally_${idx}`,
        name: cfg.name,
        team: 'ally',
        isPlayer: false,
        charId: allyCharId,
        maxHp: 90,
        damage: 14
      });
      ally.mesh.position.set(cfg.x, 0, cfg.z);
      this.gameScene.scene.add(ally.mesh);
      this.allies.push(ally);
    });
  }

  // 各关卡具体配置 (严格遵循策划案与三角洲战术搜寻规则)
  setupLevelContent(levelNum) {
    if (levelNum === 1) {
      // 第 1 关 新手战术搜寻关：搜索 Alpha 营地、击杀哨兵、换枪、无线电口令朗读
      this.missions = [
        { id: 'kill_sentry', title: '搜寻并清除 Alpha 营地哨兵 (0/1)', completed: false },
        { id: 'switch_gun', title: '尝试切换一次武器 [Q/换枪]', completed: false },
        { id: 'english', title: '通过前哨电台战术口令核验 (朗读)', completed: false }
      ];

      // 在 Alpha 据点驻守 1 名巡逻暗哨
      const sentry = new CharacterEntity({
        id: 'enemy_l1_scout',
        name: 'Alpha 侦察哨兵',
        team: 'enemy',
        maxHp: 75,
        damage: 10
      });
      sentry.mesh.position.set(-18, 0, 5);
      this.gameScene.scene.add(sentry.mesh);
      this.enemies.push(sentry);


    } else if (levelNum === 2) {
      // 第 2 关 进阶战术据点清缴：7 名敌兵分布于 Alpha/Bravo/Charlie 三大据点，夺取 Boss 密钥，拼写破译终端
      this.hasBossKey = false;
      this.missions = [
        { id: 'kill_all', title: '清空三大战术据点敌兵 (0/7)', completed: false },
        { id: 'meteor', title: '躲避并击毁木星冰铁陨石', completed: false },
        { id: 'key', title: '搜寻并拾取 Boss 加密芯片', completed: false },
        { id: 'english', title: '前往中央终端破译密码解锁核心舱 (拼写)', completed: false }
      ];

      // 生成 7 名增援机器人敌人（分布在三大据点）
      const enemySpawns = [
        // Alpha 据点：2 名巡逻守卫
        { id: 'l2_a1', name: 'Alpha 突击守卫', pos: [-17, 0, 3], hp: 70, dmg: 11, isElite: false },
        { id: 'l2_a2', name: 'Alpha 侦察机甲', pos: [-20, 0, 6], hp: 70, dmg: 11, isElite: false },
        // Bravo 据点：2 名雷达守备
        { id: 'l2_b1', name: 'Bravo 狙击机兵', pos: [19, 0, -9], hp: 80, dmg: 12, isElite: false },
        { id: 'l2_b2', name: 'Bravo 警戒机甲', pos: [22, 0, -12], hp: 80, dmg: 12, isElite: false },
        // Charlie 据点：2 名重装近卫 + 1 名手握芯片的精英指挥官
        { id: 'l2_c1', name: 'Charlie 重装卫士', pos: [-3, 0, -28], hp: 90, dmg: 13, isElite: false },
        { id: 'l2_c2', name: 'Charlie 聚能机兵', pos: [3, 0, -28], hp: 90, dmg: 13, isElite: false },
        { id: 'l2_c_elite', name: 'Charlie 精英指挥官 [密钥持有者]', pos: [0, 0, -29], hp: 130, dmg: 15, isElite: true }
      ];

      enemySpawns.forEach(cfg => {
        const enemy = new CharacterEntity({
          id: cfg.id,
          name: cfg.name,
          team: 'enemy',
          maxHp: cfg.hp,
          damage: cfg.dmg
        });
        enemy.isElite = cfg.isElite;
        enemy.mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        this.gameScene.scene.add(enemy.mesh);
        this.enemies.push(enemy);
      });

      // 率先生成 2 颗木星陨石
      this.gameScene.spawnMeteor(2);


    } else if (levelNum === 3) {
      // 第 3 关 斩首行动：Boss 极光核心 + 护卫兵 + 动态破盾 + 双重终极安全核验
      this.missions = [
        { id: 'kill_boss', title: '击败巨大银河机甲 BOSS', completed: false },
        { id: 'kill_minions', title: '清除所有召唤机械小怪', completed: false },
        { id: 'english', title: '完成终局双重安全核验 (口令+代码)', completed: false }
      ];

      // 生成巨大机甲 Boss
      const boss = new CharacterEntity({
        id: 'boss_final',
        name: '银河外掠食者 · 极光核心',
        team: 'enemy',
        isBoss: true,
        maxHp: 750,
        damage: 22
      });
      boss.mesh.position.set(0, 0, -22);
      this.gameScene.scene.add(boss.mesh);
      this.enemies.push(boss);

      // 初始伴随 2 名护卫小怪
      for (let i = 0; i < 2; i++) {
        const minion = new CharacterEntity({
          id: `minion_init_${i}`,
          name: `近卫小怪 ${i + 1}`,
          team: 'enemy',
          maxHp: 50,
          damage: 10
        });
        minion.mesh.position.set(i === 0 ? -7 : 7, 0, -20);
        this.gameScene.scene.add(minion.mesh);
        this.enemies.push(minion);
      }

    }
  }

  // 触发战术脉冲扫描 (玩家点击按钮或按 E 键)
  performTacticalScan() {
    if (this.scanCooldown > 0 || !this.player || !this.player.isAlive) return false;

    this.scanCooldown = this.maxScanCooldown;
    const scanned = this.gameScene.triggerSonarScan(this.player.mesh.position, this.enemies);

    try {
      if (window.soundSystem && typeof window.soundSystem.playBeep === 'function') {
        window.soundSystem.playBeep();
      }
    } catch (e) {}
    this.uiManager.showRadioChatter('系统', `侦测到 ${scanned.length} 个敌人`, true);
    return true;
  }

  // Boss 召唤小怪回调
  spawnBossMinion(bossPos) {
    const minion = new CharacterEntity({
      id: `minion_${Date.now()}`,
      name: '掠食召唤小怪',
      team: 'enemy',
      maxHp: 45,
      damage: 11
    });
    const angle = Math.random() * Math.PI * 2;
    minion.mesh.position.set(bossPos.x + Math.cos(angle) * 5, 0, bossPos.z + Math.sin(angle) * 5);
    this.gameScene.scene.add(minion.mesh);
    this.enemies.push(minion);

    this.gameScene.createExplosion(minion.mesh.position, 0xff0055, 18);
  }

  // 每帧更新关卡逻辑
  update(delta) {
    if (this.isLevelTransitioning) return;
    if (this.isGamePaused) return;

    // 1. 扫描冷却倒计时
    if (this.scanCooldown > 0) {
      this.scanCooldown -= delta;
      this.uiManager.updateScannerButton(this.scanCooldown, this.maxScanCooldown);
    }

    // 2. 检查玩家是否阵亡 (失败规则)
    if (this.player && !this.player.isAlive) {
      this.handlePlayerDeath();
      return;
    }

    // 3. 第 2 关 3D Boss 钥匙拾取检测
    if (this.currentLevel === 2 && this.gameScene.bossKeyDrop) {
      this.gameScene.updateBossKeyDrop(delta, this.player, () => {
        this.hasBossKey = true;
        this.uiManager.showBossKeyToast();
        this.uiManager.showRadioChatter('艾拉', '芯片已拾取', true);
      });
    }

    // 4. 陨石定期掉落逻辑 (第2关和第3关)
    if (this.currentLevel >= 2) {
      this.meteorSpawnTimer += delta;
      if (this.meteorSpawnTimer >= this.meteorSpawnInterval) {
        this.meteorSpawnTimer = 0;
        this.gameScene.spawnMeteor(1);
      }
    }

    // 5. 第 3 关 Boss 半血护盾事件
    if (this.currentLevel === 3 && !this.bossShieldTriggered) {
      const boss = this.enemies.find(e => e.isBoss && e.isAlive);
      if (boss && boss.hp <= boss.maxHp * 0.5) {
        this.bossShieldTriggered = true;
        boss.isShieldActive = true;
        this.uiManager.showRadioChatter('HQ 指挥部', '“警告！Boss 核心开启了高频偏转护盾！立即呼叫口令过载破盾！”');
        // 触发快速破盾挑战
        this.triggerBossShieldBreak(boss);
      }
    }

    // 6. 检查任务完成情况与 UI 战术罗盘同步
    this.checkMissionProgress();

    // 7. 检查是否满足过关或触发英语答题条件
    this.checkLevelCleared();
  }

  checkMissionProgress() {
    if (this.currentLevel === 1) {
      const sentry = this.enemies.find(e => e.id === 'enemy_l1_scout');
      const mKill = this.missions.find(m => m.id === 'kill_sentry');
      if (mKill && sentry) {
        mKill.completed = !sentry.isAlive;
        mKill.title = `搜寻并清除 Alpha 营地哨兵 (${sentry.isAlive ? 0 : 1}/1)`;
      }
      const mSwitch = this.missions.find(m => m.id === 'switch_gun');
      if (mSwitch && this.combatSystem.stats.hasSwitchedWeapon) {
        mSwitch.completed = true;
      }
    } else if (this.currentLevel === 2) {
      const deadEnemies = this.enemies.filter(e => !e.isAlive).length;
      const mKill = this.missions.find(m => m.id === 'kill_all');
      if (mKill) {
        mKill.title = `清空三大战术据点敌兵 (${deadEnemies}/7)`;
        mKill.completed = deadEnemies >= 7;
      }
      const mKey = this.missions.find(m => m.id === 'key');
      if (mKey) mKey.completed = this.hasBossKey;
    } else if (this.currentLevel === 3) {
      const boss = this.enemies.find(e => e.isBoss);
      const mBoss = this.missions.find(m => m.id === 'kill_boss');
      if (mBoss && boss) mBoss.completed = !boss.isAlive;

      const minions = this.enemies.filter(e => !e.isBoss);
      const mMinions = this.missions.find(m => m.id === 'kill_minions');
      if (mMinions) {
        const aliveMinions = minions.filter(m => m.isAlive).length;
        mMinions.completed = (minions.length > 0 && aliveMinions === 0);
      }
    }

    this.uiManager.updateMissions(this.missions);
    const gradeConfig = this.englishJudge.getGradeConfig(this.selectedGradeId);
    this.uiManager.updateTopHud(this.currentLevel, this.getAliveEnemyCount(), this.hasBossKey, this.currentLevel === 3, gradeConfig.label);
    this.uiManager.updateTeamStatus(this.allies.filter(a => a.isAlive).length, this.isGamePaused);
    if (!this.englishJudge.modal.classList.contains('active')) this.updateGameplayGoal();

    // 刷新战术方位罗盘
    if (this.player) {
      this.uiManager.updateTacticalCompass(
        this.gameScene.cameraYaw,
        this.player.mesh.position,
        this.enemies,
        this.gameScene.outposts,
        this.currentLevel,
        this.gameScene
      );
      this.uiManager.updateRadarWidget(
        this.player.mesh.position,
        this.gameScene.cameraYaw,
        this.enemies,
        this.gameScene.outposts
      );
    }
  }

  updateGameplayGoal() {
    const boss = this.enemies.find(enemy => enemy.isBoss);
    this.uiManager.updateGameplayGoal(
      this.currentLevel,
      this.getAliveEnemyCount(),
      this.hasBossKey,
      !!(boss && boss.isAlive),
      !!(boss && boss.isShieldActive)
    );
  }

  // 检查是否清空敌人并触发过关 / 英语考核环节
  checkLevelCleared() {
    const aliveEnemies = this.getAliveEnemyCount();

    if (this.currentLevel === 1) {
      // 第 1 关：哨兵被击败后，触发战术电台口令呼叫 (原文档朗读题)
      if (aliveEnemies === 0 && !this.isLevelTransitioning) {
        this.isLevelTransitioning = true;
        this.isGamePaused = true;
        this.uiManager.showRadioChatter('系统', '“防空屏障已锁定！走向 Alpha 通信杆，呼叫无线电战术口令解除封锁！”');
        setTimeout(() => {
          this.triggerLevel1English();
        }, 1200);
      }
    } else if (this.currentLevel === 2) {
      // 第 2 关：必须 7 个怪全清，并且持有 Boss 钥匙，走到中央终端触发填空拼写题
      if (aliveEnemies === 0 && this.hasBossKey && !this.isLevelTransitioning) {
        this.isLevelTransitioning = true;
        this.isGamePaused = true;
        this.uiManager.showRadioChatter('HQ 指挥部', '“三大据点已肃清！正在将 Boss 芯片插入终端进行密码破译！”');
        setTimeout(() => {
          this.triggerLevel2English();
        }, 1500);
      }
    } else if (this.currentLevel === 3) {
      // 第 3 关：必须 Boss 和所有小怪全清，才算打败怪物，触发双重英语考核
      const boss = this.enemies.find(e => e.isBoss);
      const isBossDead = boss && !boss.isAlive;
      const areMinionsDead = this.enemies.filter(e => !e.isBoss && e.isAlive).length === 0;

      if (isBossDead && areMinionsDead && !this.isLevelTransitioning) {
        this.isLevelTransitioning = true;
        this.isGamePaused = true;
        setTimeout(() => {
          this.triggerLevel3English();
        }, 1000);
      }
    }
  }

  // 第 1 关英语：战术对讲机口令核验 (朗读)
  triggerLevel1English() {
    this.uiManager.setTutorialText('朗读英语口令，通过后进入第 2 关');
    this.isGamePaused = true;
    const wordObj = this.englishJudge.getWordForChallenge(this.selectedGradeId, 'read');

    this.englishJudge.startReadingChallenge(wordObj, (passed) => {
      if (passed) {
        this.uiManager.setTutorialText('口令通过，正在进入第 2 关');
        const mEng = this.missions.find(m => m.id === 'english');
        if (mEng) mEng.completed = true;
        this.uiManager.updateMissions(this.missions);
        this.uiManager.showRadioChatter('HQ 指挥部', '“口令验证通过！防空屏障解除，开启进入深空据点传送阵！”');

        // 晋级第 2 关
        setTimeout(() => {
          this.loadLevel(2);
        }, 1200);
      } else {
        // 答错失败：回到第 1 关开头 (策划规则)
        this.handleFailure('english');
      }
    }, {
      title: '📻 战术对讲机：代号核验',
      subtitle: '大声朗读电台呼号单词，向轨道母舰确认身份以解除防空电磁屏障'
    });
  }

  // 第 2 关英语：主控黑客终端密码破译 (填空，战斗暂停)
  triggerLevel2English() {
    this.uiManager.setTutorialText('完成单词拼写，开启 Boss 关');
    this.isGamePaused = true;
    const wordObj = this.englishJudge.getWordForChallenge(this.selectedGradeId, 'spell');

    this.englishJudge.startSpellingChallenge(wordObj, (passed) => {
      if (passed) {
        this.uiManager.setTutorialText('拼写通过，正在进入 Boss 关');
        const mEng = this.missions.find(m => m.id === 'english');
        if (mEng) mEng.completed = true;
        this.uiManager.updateMissions(this.missions);
        this.uiManager.showRadioChatter('终端系统', '“【ACCESS GRANTED】密码破译成功！通往 Boss 核心舱门已开启！”');

        // 晋级第 3 关
        setTimeout(() => {
          this.loadLevel(3);
        }, 1200);
      } else {
        // 答错失败：回到上一关 (第 1 关) (策划规则)
        this.handleFailure('english');
      }
    }, {
      title: '💻 战术主控终端：黑客破译',
      subtitle: '已连接 Charlie 能源核心终端，输入解密字母代码解除防爆门'
    });
  }

  // 第 3 关 Boss 动态破盾挑战 (听辨/朗读快速破盾)
  triggerBossShieldBreak(boss) {
    this.uiManager.setTutorialText('朗读英语口令，解除 Boss 护盾');
    this.isGamePaused = true;
    const wordObj = this.englishJudge.getWordForChallenge(this.selectedGradeId, 'read');

    this.englishJudge.startReadingChallenge(wordObj, (passed) => {
      this.isGamePaused = false;
      if (boss && boss.isAlive) {
        boss.isShieldActive = false; // 解除护盾
        this.updateGameplayGoal();
        if (passed) {
          // 破盾成功：Boss 陷入 5 秒硬直瘫痪！
          boss.markSuppressed(5.0);
          this.gameScene.createExplosion(boss.mesh.position, 0x00f0ff, 40);
          this.uiManager.showRadioChatter('系统', '破盾成功，Boss 暂时瘫痪', true);
        } else {
          this.uiManager.showRadioChatter('系统', '护盾已消散，继续攻击', true);
        }
      }
    }, {
      title: '⚡ 战术破盾：电磁干扰过载',
      subtitle: 'Boss 护盾频段暴露！立即读出解密指令，过载使其瘫痪！'
    });
  }

  // 第 3 关英语：双考核 (朗读口令 + 核心代码填空)
  triggerLevel3English() {
    this.uiManager.setTutorialText('朗读停机口令，完成最终挑战');
    this.isGamePaused = true;
    const readWord = this.englishJudge.getWordForChallenge(this.selectedGradeId, 'read');
    const spellWord = this.englishJudge.getWordForChallenge(this.selectedGradeId, 'spell');

    // 先考朗读口令
    this.englishJudge.startReadingChallenge(readWord, (readPassed) => {
      if (!readPassed) {
        this.handleFailure('english');
        return;
      }

      // 再考填空核心安全码
      setTimeout(() => {
        this.uiManager.setTutorialText('完成核心代码拼写，赢得胜利');
        this.isGamePaused = true;
        this.englishJudge.startSpellingChallenge(spellWord, (spellPassed) => {
          if (spellPassed) {
            const mEng = this.missions.find(m => m.id === 'english');
            if (mEng) mEng.completed = true;
            this.uiManager.updateMissions(this.missions);

            this.triggerVictory();
          } else {
            // 答错失败：回到上一关 (第 2 关)
            this.handleFailure('english');
          }
        }, {
          title: '🔐 终极安全程序：核心代码输入',
          subtitle: '输入基地重置核心代码，彻底终止银河掠食者智械威胁'
        });
      }, 800);
    }, {
      title: '🎙️ 终极安全程序：停机口令确认',
      subtitle: '大声朗读最高权限安全口令，锁定空间站自毁程序'
    });
  }

  // 失败处理 (死亡或英语答错)
  handleFailure(reason) {
    this.isGamePaused = true;
    this.uiManager.setTutorialText('');
    if (window.soundSystem) window.soundSystem.playWrong();

    this.uiManager.showDefeat(
      reason,
      // "回到上一关"
      () => {
        const targetLevel = Math.max(1, this.currentLevel - 1);
        this.loadLevel(targetLevel);
      },
      // "重新挑战本关"
      () => {
        this.loadLevel(this.currentLevel);
      }
    );
  }

  handlePlayerDeath() {
    this.handleFailure('hp_zero');
  }

  // 胜利结算
  triggerVictory() {
    this.isGamePaused = true;
    this.uiManager.setTutorialText('');
    this.uiManager.grantRewards({ coins: 2000, stars: 250 });
    this.uiManager.showVictory(this.combatSystem.stats, () => {
      this.startNewGame(this.selectedCharId, this.selectedGradeId);
    });
  }

  getAliveEnemyCount() {
    return this.enemies.filter(e => e.isAlive).length;
  }
}

window.LevelManager = LevelManager;
