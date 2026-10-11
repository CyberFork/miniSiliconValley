// js/game/ui.js - HUD界面同步、弹窗管理、横竖屏自适应与玩家交互调度

class UIManager {
  constructor() {
    // 缓存所有核心 DOM 节点
    this.orientationOverlay = document.getElementById('orientation-overlay');
    this.modalLoading = document.getElementById('modal-loading');
    this.loadingFill = document.getElementById('loading-fill');
    this.loadingDesc = document.getElementById('loading-desc');
    this.loadingError = document.getElementById('loading-error');
    this.btnStartGame = document.getElementById('btn-start-game');

    this.modalGradeSelect = document.getElementById('modal-grade-select');
    this.gradeCards = document.querySelectorAll('.grade-card');
    this.btnConfirmGrade = document.getElementById('btn-confirm-grade');

    this.modalCharSelect = document.getElementById('modal-char-select');
    this.charCards = document.querySelectorAll('.char-card');
    this.btnConfirmChar = document.getElementById('btn-confirm-char');

    this.topHud = document.getElementById('top-hud');
    this.avatarIcon = document.getElementById('player-avatar-icon');
    this.playerName = document.getElementById('player-name-text');
    this.hpBarFill = document.getElementById('hp-bar-fill');
    this.hpText = document.getElementById('hp-text');

    this.bannerLevel = document.getElementById('banner-level-text');
    this.bannerEnemyCount = document.getElementById('banner-enemy-count');
    this.bannerStatus = document.getElementById('banner-status-text');
    this.bannerGrade = document.getElementById('banner-grade-text');
    this.bannerKey = document.getElementById('banner-boss-key');

    this.starCountText = document.getElementById('star-count-text');
    this.coinCountText = document.getElementById('coin-count-text');

    this.missionItems = document.getElementById('mission-items-container');
    this.teamStatusTag = document.getElementById('team-status-tag');
    this.tutorialBanner = document.getElementById('tutorial-guide-banner');
    this.teamCountText = document.getElementById('team-count-text');
    this.currentGoalText = '';

    this.weaponBtnName = document.getElementById('weapon-btn-name');
    this.weaponBtnAmmo = document.getElementById('weapon-btn-ammo');
    this.switchWeaponButton = document.getElementById('btn-switch-weapon');

    this.bossKeyToast = document.getElementById('boss-key-toast');
    this.whiteFadeOverlay = document.getElementById('white-fade-overlay');

    this.modalDefeat = document.getElementById('modal-defeat');
    this.defeatReasonText = document.getElementById('defeat-reason-text');
    this.btnPrevLevel = document.getElementById('btn-prev-level');
    this.btnRetryLevel = document.getElementById('btn-retry-level');

    this.modalVictory = document.getElementById('modal-victory');
    this.victoryStatsText = document.getElementById('victory-stats-text');
    this.btnRestartAll = document.getElementById('btn-restart-all');

    // 三角洲战术搜索与遭遇战 HUD 节点
    this.compassTape = document.getElementById('tactical-compass-tape');
    this.compassReadout = document.getElementById('compass-target-readout');
    this.reticleContainer = document.getElementById('reticle-container');
    this.hitmarker = document.getElementById('hitmarker');
    this.floatingDmgContainer = document.getElementById('floating-dmg-container');
    this.damageVignette = document.getElementById('damage-vignette');
    this.radioChatterBox = document.getElementById('radio-chatter-box');
    this.radioSpeakerName = document.getElementById('radio-speaker-name');
    this.radioSpeakerContent = document.getElementById('radio-speaker-content');
    this.btnTacticalScan = document.getElementById('btn-tactical-scan');
    this.scanCdText = document.getElementById('scan-cd-text');
    this.radarBlipsContainer = document.getElementById('radar-blips-container');

    // 状态缓存
    this.selectedCharId = 'ayla'; // 默认艾拉
    this.selectedGradeId = 'junior1_up';
    this.radioHideTimeout = null;
    this.currency = this.readProgress();
    this.updateCurrency(this.currency);

    this.bindGlobalEvents();
    this.checkOrientation();
  }

  bindGlobalEvents() {
    // 监听屏幕旋转与窗口尺寸变化
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.checkOrientation(), 150);
    });

    // 选英语等级卡片高亮切换
    this.gradeCards.forEach(card => {
      card.addEventListener('click', () => {
        this.gradeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedGradeId = card.getAttribute('data-grade') || 'junior1_up';
      });
    });

    // 选角色卡片高亮切换
    this.charCards.forEach(card => {
      card.addEventListener('click', () => {
        this.charCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedCharId = card.getAttribute('data-char');
      });
    });
  }

  // 1. 横竖屏检测：竖屏强制提示横屏
  checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (this.orientationOverlay) {
      this.orientationOverlay.style.display = isPortrait ? 'flex' : 'none';
    }
  }

  // 2. 加载进度更新
  setLoadingProgress(percent, desc) {
    if (this.loadingFill) this.loadingFill.style.width = `${percent}%`;
    if (this.loadingDesc) this.loadingDesc.textContent = desc || "正在加载星际资源...";
  }

  showLoadingError(message) {
    if (this.loadingError) {
      this.loadingError.textContent = message;
      this.loadingError.classList.add('show');
    }
    if (this.btnStartGame) this.btnStartGame.style.display = 'none';
  }

  showStartButton(onStart) {
    if (this.btnStartGame) {
      this.btnStartGame.style.display = 'inline-block';
      this.btnStartGame.onclick = () => {
        if (window.soundSystem) window.soundSystem.init();
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
        this.modalLoading.classList.remove('active');
        if (onStart) onStart();
      };
    }
  }

  // 3. 选英语等级界面呼出
  showGradeSelect(onConfirm) {
    if (!this.modalGradeSelect) {
      if (onConfirm) onConfirm(this.selectedGradeId);
      return;
    }
    this.modalGradeSelect.classList.add('active');
    if (this.btnConfirmGrade) {
      this.btnConfirmGrade.onclick = () => {
        this.modalGradeSelect.classList.remove('active');
        if (onConfirm) onConfirm(this.selectedGradeId);
      };
    }
  }

  // 4. 选角色界面呼出
  showCharSelect(onConfirm) {
    this.modalCharSelect.classList.add('active');
    this.btnConfirmChar.onclick = () => {
      this.modalCharSelect.classList.remove('active');
      if (onConfirm) onConfirm(this.selectedCharId);
    };
  }

  // 5. 实时同步玩家 HUD
  updatePlayerHud(player) {
    if (!player) return;
    const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    this.hpBarFill.style.width = `${hpPercent}%`;
    this.hpText.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;

    if (hpPercent < 30) {
      this.hpBarFill.classList.add('danger');
    } else {
      this.hpBarFill.classList.remove('danger');
    }

    // 角色身份展示
    if (this.playerName) {
      const names = { ayla: '艾拉', kane: '凯恩', walker: '纪元行者' };
      this.playerName.textContent = names[player.charId] || '英雄';
    }
    if (this.avatarIcon) {
      const avatars = {
        ayla: 'assets/characters/card_ayla.png',
        kane: 'assets/characters/card_kane.png',
        walker: 'assets/characters/card_walker.png'
      };
      const source = avatars[player.charId] || avatars.ayla;
      if (!this.avatarIcon.querySelector('img')) {
        this.avatarIcon.innerHTML = '<img class="avatar-image" alt="玩家角色">';
      }
      const avatarImage = this.avatarIcon.querySelector('img');
      if (avatarImage) {
        if (avatarImage.src !== new URL(source, window.location.href).href) avatarImage.src = source;
        avatarImage.alt = this.playerName ? this.playerName.textContent : '玩家';
      }
    }
  }

  readProgress() {
    const fallback = { stars: 120, coins: 850 };
    try {
      const raw = window.MSV_SHOWCASE_STORAGE.getItem('phantom-game-progress');
      const saved = raw ? JSON.parse(raw) : {};
      return {
        stars: Number.isFinite(saved.stars) ? saved.stars : fallback.stars,
        coins: Number.isFinite(saved.coins) ? saved.coins : fallback.coins
      };
    } catch (error) {
      return fallback;
    }
  }

  saveProgress() {
    try {
      window.MSV_SHOWCASE_STORAGE.setItem('phantom-game-progress', JSON.stringify(this.currency));
    } catch (error) {
      // 本机存储不可用时不影响当前回合
    }
  }

  updateCurrency(currency) {
    if (!currency) return;
    this.currency = { ...this.currency, ...currency };
    if (this.starCountText) this.starCountText.textContent = this.currency.stars;
    if (this.coinCountText) this.coinCountText.textContent = this.currency.coins;
  }

  grantRewards(rewards = {}) {
    this.updateCurrency({
      stars: this.currency.stars + (rewards.stars || 0),
      coins: this.currency.coins + (rewards.coins || 0)
    });
    this.saveProgress();
  }

  // 6. 顶部状态横条与任务
  updateTopHud(levelNumber, enemiesRemaining, hasBossKey, isBossLevel, gradeLabel) {
    if (this.bannerLevel) {
      this.bannerLevel.textContent = `第 ${levelNumber} 关`;
    }
    if (this.bannerEnemyCount) {
      this.bannerEnemyCount.textContent = isBossLevel ? `最终BOSS战` : `敌人 × ${enemiesRemaining}`;
    }
    if (this.bannerGrade && gradeLabel) {
      this.bannerGrade.textContent = gradeLabel;
    }
    if (this.bannerKey) {
      this.bannerKey.style.display = hasBossKey ? 'flex' : 'none';
    }
  }

  updateTeamStatus(aliveAllies, isPaused = false) {
    if (!this.teamStatusTag) return;
    const teammates = Math.max(0, aliveAllies - 1);
    if (this.teamCountText) {
      this.teamCountText.textContent = teammates;
      this.teamStatusTag.setAttribute('aria-label', `${teammates} 名队友存活`);
    }
  }

  // 更新任务清单
  updateMissions(tasks) {
    if (!this.missionItems) return;
    this.missionItems.innerHTML = '';
    tasks.forEach(t => {
      const item = document.createElement('div');
      item.className = `mission-item ${t.completed ? 'completed' : ''}`;
      item.innerHTML = `<span class="hex-icon"></span><span>${t.title}</span>`;
      this.missionItems.appendChild(item);
    });
  }

  // 更新武器按钮展示
  updateWeaponButton(weapon) {
    if (!weapon) return;
    if (this.weaponBtnName) this.weaponBtnName.textContent = weapon.name;
    if (this.weaponBtnAmmo) this.weaponBtnAmmo.textContent = weapon.splash > 0 ? "高爆重能" : "脉冲连射";
    if (this.switchWeaponButton) {
      this.switchWeaponButton.classList.toggle('heavy-weapon', weapon.splash > 0);
      const label = `切换武器 · 当前${weapon.name}`;
      this.switchWeaponButton.title = label;
      this.switchWeaponButton.setAttribute('aria-label', label);
    }
  }

  // 提示新手指导
  setTutorialText(text) {
    if (!this.tutorialBanner) return;
    if (text && text !== this.currentGoalText) {
      this.currentGoalText = text;
      this.tutorialBanner.textContent = text;
      this.tutorialBanner.style.display = 'block';
      this.tutorialBanner.classList.remove('goal-changed');
      void this.tutorialBanner.offsetWidth;
      this.tutorialBanner.classList.add('goal-changed');
    } else {
      this.tutorialBanner.style.display = text ? 'block' : 'none';
    }
  }

  updateGameplayGoal(levelNumber, aliveEnemies, hasBossKey, bossAlive = false, bossShieldActive = false) {
    let goal = '';
    if (levelNumber === 1) {
      goal = aliveEnemies > 0 ? '消灭 Alpha 据点哨兵 · 0/1' : '完成英语口令挑战，进入第 2 关';
    } else if (levelNumber === 2) {
      if (aliveEnemies > 0) goal = `清除三处据点敌人 · ${Math.max(0, 7 - aliveEnemies)}/7`;
      else if (!hasBossKey) goal = '靠近金色芯片，拾取通关密钥';
      else goal = '完成单词拼写，开启 Boss 关';
    } else if (levelNumber === 3) {
      if (bossShieldActive) goal = '朗读英语口令，解除 Boss 护盾';
      else if (bossAlive) goal = '击败 Boss，并清除召唤的小怪';
      else if (aliveEnemies > 0) goal = `清除剩余小怪 · ${aliveEnemies} 只`;
      else goal = '完成朗读和拼写，赢得胜利';
    }
    this.setTutorialText(goal);
  }

  // 弹出获取 Boss 钥匙 Toast
  showBossKeyToast() {
    if (!this.bossKeyToast) return;
    this.bossKeyToast.classList.add('show');
    if (window.soundSystem) window.soundSystem.playCorrect();
    setTimeout(() => {
      this.bossKeyToast.classList.remove('show');
    }, 3200);
  }

  // 7. 失败界面 (被打死或英语答错)
  showDefeat(reason, onPrevLevel, onRetry) {
    if (reason === 'english') {
      this.defeatReasonText.textContent = "【英语核能校验未通过】发音或拼写不符，任务中断！";
    } else {
      this.defeatReasonText.textContent = "【机甲生命值归零】受到致命摧毁，任务失败！";
    }
    this.modalDefeat.classList.add('active');

    this.btnPrevLevel.onclick = () => {
      this.modalDefeat.classList.remove('active');
      if (onPrevLevel) onPrevLevel();
    };

    this.btnRetryLevel.onclick = () => {
      this.modalDefeat.classList.remove('active');
      if (onRetry) onRetry();
    };
  }

  // 8. 胜利界面 (通关第3关)
  showVictory(stats, onRestart) {
    if (this.victoryStatsText) {
      this.victoryStatsText.textContent = `击败敌人总数: ${stats.playerKills || 0} 个 ｜ 科技评级: S 级极光`;
    }

    // 白色终局统一效果 (策划要求：最后会变成一片白色，然后科技统一宇宙每个角落)
    if (this.whiteFadeOverlay) {
      this.whiteFadeOverlay.classList.add('show');
      setTimeout(() => {
        this.whiteFadeOverlay.classList.remove('show');
        this.modalVictory.classList.add('active');
        if (window.soundSystem) window.soundSystem.playVictory();
      }, 1600);
    } else {
      this.modalVictory.classList.add('active');
      if (window.soundSystem) window.soundSystem.playVictory();
    }

    this.btnRestartAll.onclick = () => {
      this.modalVictory.classList.remove('active');
      if (onRestart) onRestart();
    };
  }

  // 9. 三角洲战术方位罗盘更新 (Tactical Compass System)
  updateTacticalCompass(cameraYaw, playerPos, enemies, outposts, currentLevel, gameScene) {
    if (!this.compassTape || !playerPos) return;

    // 当前相机朝向（水平方位角 0~360 度，北=0, 东=90, 南=180, 西=270）
    // cameraYaw=0 对应 -Z 轴（北）
    const currentHeadingDeg = ((-cameraYaw * 180 / Math.PI) % 360 + 360) % 360;
    const fovDeg = 110; // 罗盘视野跨度 110 度

    let html = '';

    // A. 基础主方位标（N, E, S, W 及中间刻度）
    const cardinals = [
      { deg: 0, label: 'N' },
      { deg: 45, label: '45' },
      { deg: 90, label: 'E' },
      { deg: 135, label: '135' },
      { deg: 180, label: 'S' },
      { deg: 225, label: '225' },
      { deg: 270, label: 'W' },
      { deg: 315, label: '315' }
    ];

    cardinals.forEach(card => {
      let delta = (card.deg - currentHeadingDeg + 540) % 360 - 180;
      if (Math.abs(delta) <= fovDeg / 2) {
        const pct = 50 + (delta / (fovDeg / 2)) * 46;
        const isCard = ['N', 'E', 'S', 'W'].includes(card.label);
        html += `<span class="compass-marker ${isCard ? 'cardinal' : ''}" style="left: ${pct}%;">${card.label}</span>`;
      }
    });

    // 只标记当前推进目标，完整战区分布仍保留在雷达中。
    let waypoint = null;
    if (outposts && currentLevel === 1 && enemies.some(enemy => enemy.isAlive)) {
      waypoint = { ...outposts.alpha, name: 'Alpha', campClass: 'camp-a' };
    } else if (outposts && currentLevel === 2) {
      const activeCamp = [
        { key: 'alpha', prefix: 'l2_a', campClass: 'camp-a' },
        { key: 'bravo', prefix: 'l2_b', campClass: 'camp-b' },
        { key: 'charlie', prefix: 'l2_c', campClass: 'camp-c' }
      ].find(camp => enemies.some(enemy => enemy.isAlive && enemy.id.startsWith(camp.prefix)));
      if (activeCamp) waypoint = { ...outposts[activeCamp.key], campClass: activeCamp.campClass };
      else if (gameScene.bossKeyDrop) waypoint = { pos: gameScene.bossKeyDrop.mesh.position, name: '芯片', campClass: 'camp-c' };
    } else if (currentLevel === 3) {
      const target = enemies.find(enemy => enemy.isBoss && enemy.isAlive) || enemies.find(enemy => enemy.isAlive);
      if (target) waypoint = { pos: target.mesh.position, name: target.isBoss ? 'BOSS' : '小怪', campClass: 'camp-c' };
    }
    if (waypoint) {
      const dir = new THREE.Vector3().subVectors(waypoint.pos, playerPos);
      const dist = Math.round(playerPos.distanceTo(waypoint.pos));
      const bearing = (Math.atan2(dir.x, -dir.z) * 180 / Math.PI + 360) % 360;

      const delta = (bearing - currentHeadingDeg + 540) % 360 - 180;
      const campClass = waypoint.campClass;
      const shortName = waypoint.name.split(' ')[0];

      if (Math.abs(delta) <= fovDeg / 2) {
        const pct = 50 + (delta / (fovDeg / 2)) * 44;
        html += `<span class="compass-waypoint ${campClass}" style="left: ${pct}%;">${shortName} ${dist}m</span>`;
      } else if (delta < 0) {
        html += `<span class="compass-waypoint ${campClass} pinned-edge" style="left: 4%;">◄ ${shortName} ${dist}m</span>`;
      } else {
        html += `<span class="compass-waypoint ${campClass} pinned-edge" style="left: 96%; transform: translateX(-100%);">${shortName} ${dist}m ►</span>`;
      }
    }

    // C. 正在交火或被扫描到的敌人声纹/雷达标 (Soundprints)
    if (enemies) {
      enemies.forEach(e => {
        if (!e.isAlive) return;
        if (e.isBoss) return;

        // 如果敌人正在开火、警戒或者被扫描到，在罗盘上显示红标
        if (e.aiState === 'ENGAGED' || e.isScanned || (e.alertTimer > 0)) {
          const dir = new THREE.Vector3().subVectors(e.mesh.position, playerPos);
          const dist = Math.round(playerPos.distanceTo(e.mesh.position));
          const bearing = (Math.atan2(dir.x, -dir.z) * 180 / Math.PI + 360) % 360;

          let delta = (bearing - currentHeadingDeg + 540) % 360 - 180;
          if (Math.abs(delta) <= fovDeg / 2) {
            const pct = 50 + (delta / (fovDeg / 2)) * 44;
            html += `<span class="compass-waypoint enemy-sound" style="left: ${pct}%;" title="敌方动静 ${dist}m">◆</span>`;
          }
        }
      });
    }

    this.compassTape.innerHTML = html;

  }

  // 10. 右上角小雷达红点更新
  updateRadarWidget(playerPos, cameraYaw, enemies, outposts) {
    if (!this.radarBlipsContainer || !playerPos) return;

    let html = '';
    const radarRadius = 22; // 容器半宽
    const radarRange = 45; // 探测半径 45 米

    if (enemies) {
      enemies.forEach(e => {
        if (!e.isAlive) return;
        const dx = e.mesh.position.x - playerPos.x;
        const dz = e.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radarRange) {
          // 根据相机角度旋转到雷达屏幕坐标
          const angle = Math.atan2(dz, dx) - cameraYaw - Math.PI / 2;
          const r = (dist / radarRange) * radarRadius;
          const bx = 25 + Math.cos(angle) * r;
          const by = 25 + Math.sin(angle) * r;
          html += `<div class="radar-blip ${e.isBoss ? 'boss' : 'enemy'}" style="left:${bx}px; top:${by}px;"></div>`;
        }
      });
    }

    this.radarBlipsContainer.innerHTML = html;
  }

  // 11. 命中反馈 (Hitmarker)
  showHitmarker(isCrit = false) {
    if (!this.hitmarker) return;
    this.hitmarker.classList.remove('show', 'crit');
    void this.hitmarker.offsetWidth; // 触发 reflow
    this.hitmarker.classList.add('show');
    if (isCrit) this.hitmarker.classList.add('crit');

    setTimeout(() => {
      if (this.hitmarker) this.hitmarker.classList.remove('show');
    }, 150);
  }

  // 开火成功反馈：快速点击和长按都给出明确的视觉确认
  showShotFeedback() {
    const attackButton = document.getElementById('btn-attack');
    if (attackButton) {
      attackButton.classList.remove('shot');
      void attackButton.offsetWidth;
      attackButton.classList.add('shot');
      setTimeout(() => attackButton.classList.remove('shot'), 170);
    }
    if (this.reticleContainer) {
      this.reticleContainer.classList.remove('shot');
      void this.reticleContainer.offsetWidth;
      this.reticleContainer.classList.add('shot');
      setTimeout(() => this.reticleContainer.classList.remove('shot'), 170);
    }
  }

  // 12. 浮动伤害跳字 (World to Screen Projection)
  showFloatingDamage(worldPos, damageText, isCrit = false, camera) {
    if (!this.floatingDmgContainer || !worldPos) return;

    let screenX = window.innerWidth / 2;
    let screenY = window.innerHeight / 2 - 40;

    if (camera) {
      const v = worldPos.clone().project(camera);
      screenX = (v.x * 0.5 + 0.5) * window.innerWidth;
      screenY = (-(v.y * 0.5) + 0.5) * window.innerHeight;
    }

    // 随机微小偏移，防止重叠
    screenX += (Math.random() - 0.5) * 30;
    screenY += (Math.random() - 0.5) * 20;

    const el = document.createElement('div');
    el.className = `dmg-number ${isCrit ? 'crit' : ''}`;
    el.textContent = damageText;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;

    this.floatingDmgContainer.appendChild(el);
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }

  // 13. 受击红光边缘预警
  showDamageVignette() {
    if (!this.damageVignette) return;
    this.damageVignette.classList.add('hit');
    setTimeout(() => {
      if (this.damageVignette) this.damageVignette.classList.remove('hit');
    }, 280);
  }

  // 14. 战术无线电通讯字幕
  showRadioChatter(speaker, text, isEvent = false) {
    if (!isEvent || !this.radioChatterBox || document.querySelector('.modal-layer.active')) return;
    if (this.radioSpeakerName) this.radioSpeakerName.textContent = `无线电通讯 - ${speaker}`;
    if (this.radioSpeakerContent) this.radioSpeakerContent.textContent = text;

    this.radioChatterBox.style.display = 'flex';
    try {
      if (window.soundSystem && typeof window.soundSystem.playBeep === 'function') {
        window.soundSystem.playBeep();
      }
    } catch (e) {}

    if (this.radioHideTimeout) clearTimeout(this.radioHideTimeout);
    this.radioHideTimeout = setTimeout(() => {
      if (this.radioChatterBox) this.radioChatterBox.style.display = 'none';
    }, 2200);
  }

  // 15. 战术声呐按钮状态更新
  updateScannerButton(scanCooldown, maxCooldown = 12.0) {
    if (!this.btnTacticalScan || !this.scanCdText) return;
    if (scanCooldown <= 0) {
      this.scanCdText.textContent = '';
      this.scanCdText.classList.remove('in-cd');
      this.btnTacticalScan.classList.remove('scanning');
      this.btnTacticalScan.setAttribute('aria-label', '侦测敌人');
    } else {
      this.scanCdText.textContent = `${Math.ceil(scanCooldown)}s`;
      this.scanCdText.classList.add('in-cd');
      this.btnTacticalScan.setAttribute('aria-label', `侦测冷却 ${Math.ceil(scanCooldown)} 秒`);
    }
  }

  // 16. 十字准星锁定状态
  setReticleLocked(isLocked) {
    if (!this.reticleContainer) return;
    if (isLocked) {
      this.reticleContainer.classList.add('locked');
    } else {
      this.reticleContainer.classList.remove('locked');
    }
  }
}

window.UIManager = UIManager;
