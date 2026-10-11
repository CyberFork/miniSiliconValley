// js/game/ai.js - 三角洲战术搜索小队与敌方巡逻/警戒/遭遇交火行为树系统

class AIManager {
  constructor(gameScene, combatSystem) {
    this.gameScene = gameScene;
    this.combatSystem = combatSystem;

    // Boss 召唤小怪计时器
    this.bossSummonTimer = 0;
    this.bossSummonInterval = 9.0;

    // 战术无线电冷却与状态
    this.lastRadioTime = 0;

    // 瞄准激光材质缓存 (复用，零 GC 压力)
    this.laserGeo = new THREE.BufferGeometry();
    this.laserGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.laserMat = new THREE.LineBasicMaterial({
      color: 0xff1144,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });
    this.aimLaserLine = new THREE.Line(this.laserGeo, this.laserMat);
    this.aimLaserLine.visible = false;
    this.gameScene.scene.add(this.aimLaserLine);
  }

  // 1. 更新 4 名电脑队友 (三角洲战术护卫与报点系统)
  updateAllies(delta, allies, enemies, player, uiManager) {
    const aliveEnemies = enemies.filter(e => e.isAlive);

    allies.forEach((ally, idx) => {
      if (ally.isPlayer || !ally.isAlive) return;

      if (ally.fireCooldown > 0) ally.fireCooldown -= delta;

      let isMoving = false;
      const currentPos = ally.mesh.position;

      // 计算战术护卫编队偏移量 (相对于玩家)
      // 0: 左侧掩护, 1: 右侧掩护, 2: 左后方殿后, 3: 右后方殿后
      const formationOffsets = [
        { x: -4.5, z: 2.0 },
        { x: 4.5, z: 2.0 },
        { x: -6.5, z: 6.0 },
        { x: 6.5, z: 6.0 }
      ];
      const formOffset = formationOffsets[(idx - 1) % formationOffsets.length] || { x: 0, z: 4 };

      // 寻找视野内已激活或距离较近的敌人 (24m 以内，支持战术静默跟随)
      const targetEnemy = this.findTacticalTarget(currentPos, aliveEnemies, player);

      if (targetEnemy) {
        const targetPos = targetEnemy.mesh.position;
        const dist = currentPos.distanceTo(targetPos);

        // 面向目标
        const dir = new THREE.Vector3().subVectors(targetPos, currentPos);
        dir.y = 0;
        const targetAngle = Math.atan2(dir.x, dir.z);
        ally.mesh.rotation.y = THREE.MathUtils.lerp(ally.mesh.rotation.y, targetAngle, 0.14);

        // 保持中远距离掩体架枪射击 (10 到 18 米)
        if (dist > 18) {
          dir.normalize();
          currentPos.addScaledVector(dir, ally.moveSpeed * delta);
          isMoving = true;
        } else if (dist < 7) {
          dir.normalize().negate();
          currentPos.addScaledVector(dir, ally.moveSpeed * 0.7 * delta);
          isMoving = true;
        }

        // 队友开火射击 (带轻微点射间隔)
        if (dist < 26 && ally.fireCooldown <= 0) {
          const aimSpread = new THREE.Vector3(
            (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.9
          );
          const shootDir = new THREE.Vector3().subVectors(targetPos, currentPos).add(aimSpread);
          this.combatSystem.shoot(ally, shootDir);
          ally.fireCooldown = 0.45 + Math.random() * 0.3; // 节奏点射
        }
      } else if (player && player.isAlive) {
        // 无敌人时：保持三角洲战术跟随阵型
        const pPos = player.mesh.position;
        // 计算跟随的目标坐标 (围绕玩家朝向旋转)
        const pAngle = player.mesh.rotation.y;
        const worldOffsetX = formOffset.x * Math.cos(pAngle) + formOffset.z * Math.sin(pAngle);
        const worldOffsetZ = -formOffset.x * Math.sin(pAngle) + formOffset.z * Math.cos(pAngle);
        const targetFollowPos = new THREE.Vector3(pPos.x + worldOffsetX, 0, pPos.z + worldOffsetZ);

        const distToSlot = currentPos.distanceTo(targetFollowPos);
        if (distToSlot > 1.8) {
          const followDir = new THREE.Vector3().subVectors(targetFollowPos, currentPos);
          followDir.y = 0;
          followDir.normalize();
          const speed = distToSlot > 8 ? ally.moveSpeed * 1.3 : ally.moveSpeed;
          currentPos.addScaledVector(followDir, speed * delta);
          ally.mesh.rotation.y = THREE.MathUtils.lerp(ally.mesh.rotation.y, Math.atan2(followDir.x, followDir.z), 0.12);
          isMoving = true;
        } else {
          // 归位后面向玩家前方戒备
          ally.mesh.rotation.y = THREE.MathUtils.lerp(ally.mesh.rotation.y, player.mesh.rotation.y, 0.08);
        }
      }

      this.clampToArena(currentPos);
      ally.updateAnimation(delta, isMoving);
    });

    // 随机战术无线电报点 (有敌人且距离适中时触发)
    this.checkRadioChatter(delta, allies, aliveEnemies, player, uiManager);
  }

  // 战术无线电语音提示
  checkRadioChatter(delta, allies, aliveEnemies, player, uiManager) {
    if (!uiManager) return;
    this.lastRadioTime += delta;
    if (this.lastRadioTime < 9.0) return; // 至少间隔 9 秒

    const nearestEnemy = player ? this.findNearestAlive(player.mesh.position, aliveEnemies) : null;
    if (nearestEnemy && player) {
      const dist = player.mesh.position.distanceTo(nearestEnemy.mesh.position);
      if (dist < 35 && dist > 10) {
        const ally = allies.find(a => !a.isPlayer && a.isAlive);
        if (ally) {
          const lines = [
            `“侦测到前方据点有敌方机甲！注意拉开间距寻找掩体！”`,
            `“敌兵进入雷达红区，准备同步突击！”`,
            `“右侧有机械守卫巡逻，保持静默，可以先手伏击！”`,
            `“发现敌方警戒信号，队长，随时可开火！”`
          ];
          const text = lines[Math.floor(Math.random() * lines.length)];
          uiManager.showRadioChatter(ally.name, text);
          this.lastRadioTime = 0;
        }
      }
    }
  }

  // 2. 更新敌方单位及 Boss (Delta Force 三级警戒与开火节奏系统)
  updateEnemies(delta, enemies, allies, player, onSpawnMinion, uiManager) {
    const allyTargets = allies.filter(a => a.isAlive);
    if (allyTargets.length === 0) return;

    let activeAimingLaser = null;

    enemies.forEach(enemy => {
      if (!enemy.isAlive) return;

      // 初始化特战 AI 属性
      if (enemy.aiState === undefined) {
        enemy.aiState = enemy.isBoss ? 'ENGAGED' : 'PATROL'; // 初始为巡逻驻守状态
        enemy.patrolOrigin = enemy.mesh.position.clone();
        enemy.patrolAngle = Math.random() * Math.PI * 2;
        enemy.patrolRadius = 4.0 + Math.random() * 3.0;
        enemy.preFireTimer = 0;
        enemy.burstRemaining = 3;
        enemy.reloadTimer = 0;
        enemy.alertTimer = 0;
      }

      if (enemy.fireCooldown > 0) enemy.fireCooldown -= delta;
      if (enemy.reloadTimer > 0) enemy.reloadTimer -= delta;

      const currentPos = enemy.mesh.position;
      let isMoving = false;

      if (enemy.isBoss) {
        // --- BOSS 行为逻辑 ---
        let primaryTarget = allyTargets.find(a => a.charId === 'kane');
        if (!primaryTarget) {
          primaryTarget = this.findNearestAlive(currentPos, allyTargets);
        }

        if (primaryTarget) {
          const tPos = primaryTarget.mesh.position;
          const dist = currentPos.distanceTo(tPos);

          const dir = new THREE.Vector3().subVectors(tPos, currentPos);
          dir.y = 0;
          const targetAngle = Math.atan2(dir.x, dir.z);
          enemy.mesh.rotation.y = THREE.MathUtils.lerp(enemy.mesh.rotation.y, targetAngle, 0.08);

          // 保持重型压迫逼近 (12 到 22 米)
          if (dist > 14) {
            dir.normalize();
            currentPos.addScaledVector(dir, enemy.moveSpeed * delta);
            isMoving = true;
          }

          // Boss 攻击前摇与蓄力红外激光
          if (dist < 32 && enemy.fireCooldown <= 0) {
            enemy.preFireTimer += delta;
            activeAimingLaser = { from: currentPos.clone().add(new THREE.Vector3(0, 4.5, 0)), to: tPos.clone().add(new THREE.Vector3(0, 1.2, 0)) };

            if (enemy.preFireTimer >= 0.7) { // 蓄力 0.7 秒后发射
              enemy.preFireTimer = 0;
              const shootDir = new THREE.Vector3().subVectors(tPos, currentPos);
              shootDir.y += 0.5;
              this.combatSystem.shoot(enemy, shootDir);
              enemy.fireCooldown = 1.4; // 较长开火间隔，留给玩家反击与规避空间
            }
          } else {
            enemy.preFireTimer = 0;
          }
        }

        // Boss 定时召唤小怪
        this.bossSummonTimer += delta;
        if (this.bossSummonTimer >= this.bossSummonInterval) {
          this.bossSummonTimer = 0;
          const minionCount = enemies.filter(e => !e.isBoss && e.isAlive).length;
          if (minionCount < 4 && onSpawnMinion) {
            onSpawnMinion(currentPos);
          }
        }

      } else {
        // --- 三角洲巡逻机器人敌人逻辑 ---
        const target = this.findNearestAlive(currentPos, allyTargets);
        const distToTarget = target ? currentPos.distanceTo(target.mesh.position) : 999;

        // A. 警戒感应与状态迁移
        if (enemy.aiState === 'PATROL') {
          // 未发现玩家时：在据点内小范围巡视
          enemy.patrolAngle += 0.45 * delta;
          const patrolTargetX = enemy.patrolOrigin.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
          const patrolTargetZ = enemy.patrolOrigin.z + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;
          const walkDir = new THREE.Vector3(patrolTargetX - currentPos.x, 0, patrolTargetZ - currentPos.z);
          
          if (walkDir.lengthSq() > 0.2) {
            walkDir.normalize();
            currentPos.addScaledVector(walkDir, enemy.moveSpeed * 0.45 * delta);
            enemy.mesh.rotation.y = THREE.MathUtils.lerp(enemy.mesh.rotation.y, Math.atan2(walkDir.x, walkDir.z), 0.08);
            isMoving = true;
          }

          // 感应视线锥 (视距 28 米，前方 110 度视线扇区，或近身 10 米脚步声察觉)
          if (target && distToTarget < 28) {
            const toTarget = new THREE.Vector3().subVectors(target.mesh.position, currentPos).normalize();
            const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), enemy.mesh.rotation.y);
            const dot = forward.dot(toTarget);

            if (dot > 0.35 || distToTarget < 10) { // 进入视野或进入听觉距离
              enemy.aiState = 'ALERT';
              enemy.alertTimer = 1.2; // 1.2 秒警觉确认期（头上出现 ？号）
            }
          }
        } else if (enemy.aiState === 'ALERT') {
          // 警觉期：停步转向可疑声音方向进行确认
          if (target) {
            const dir = new THREE.Vector3().subVectors(target.mesh.position, currentPos);
            dir.y = 0;
            enemy.mesh.rotation.y = THREE.MathUtils.lerp(enemy.mesh.rotation.y, Math.atan2(dir.x, dir.z), 0.15);
          }
          enemy.alertTimer -= delta;
          if (enemy.alertTimer <= 0) {
            enemy.aiState = 'ENGAGED'; // 确认敌对目标，呼叫警报开火！
            enemy.burstRemaining = 3;
            enemy.preFireTimer = 0;
          }
        } else if (enemy.aiState === 'ENGAGED') {
          // 战斗交火状态
          if (target) {
            const tPos = target.mesh.position;
            const dist = currentPos.distanceTo(tPos);

            const dir = new THREE.Vector3().subVectors(tPos, currentPos);
            dir.y = 0;
            const targetAngle = Math.atan2(dir.x, dir.z);
            enemy.mesh.rotation.y = THREE.MathUtils.lerp(enemy.mesh.rotation.y, targetAngle, 0.12);

            // 战术推进与掩护：保持 12 到 20 米距离
            if (dist > 18) {
              dir.normalize();
              currentPos.addScaledVector(dir, enemy.moveSpeed * 0.7 * delta);
              isMoving = true;
            } else if (dist < 8) {
              dir.normalize().negate();
              currentPos.addScaledVector(dir, enemy.moveSpeed * 0.5 * delta);
              isMoving = true;
            }

            // 开火与换弹节奏控制 (3连发 + 2.2秒换弹装填窗口)
            if (enemy.reloadTimer > 0) {
              // 换弹装填中：暂时不开火，给玩家拉枪线和反打机会
              enemy.preFireTimer = 0;
            } else if (dist < 26) {
              // 射击瞄准前摇 (0.45 秒红外激光预警)
              enemy.preFireTimer += delta;
              if (!activeAimingLaser && target.isPlayer) {
                activeAimingLaser = {
                  from: currentPos.clone().add(new THREE.Vector3(0, 1.35, 0)),
                  to: tPos.clone().add(new THREE.Vector3(0, 1.2, 0))
                };
              }

              if (enemy.preFireTimer >= 0.45 && enemy.fireCooldown <= 0) {
                // 开火！
                const shootDir = new THREE.Vector3().subVectors(tPos, currentPos);
                // 轻微弹道散布
                shootDir.x += (Math.random() - 0.5) * 0.8;
                shootDir.z += (Math.random() - 0.5) * 0.8;
                this.combatSystem.shoot(enemy, shootDir);

                enemy.burstRemaining--;
                enemy.fireCooldown = 0.22; // 连发微间隔

                if (enemy.burstRemaining <= 0) {
                  // 打完 3 发，进入换弹装填冷却 2.2 秒！
                  enemy.reloadTimer = 2.2;
                  enemy.burstRemaining = 3;
                  enemy.preFireTimer = 0;
                }
              }
            }
          }
        }
      }

      this.clampToArena(currentPos);
      enemy.updateAnimation(delta, isMoving);
    });

    // 更新屏幕上的敌方瞄准红外激光线 (Delta Force 真实受瞄预警)
    if (activeAimingLaser) {
      const posAttr = this.laserGeo.attributes.position;
      posAttr.setXYZ(0, activeAimingLaser.from.x, activeAimingLaser.from.y, activeAimingLaser.from.z);
      posAttr.setXYZ(1, activeAimingLaser.to.x, activeAimingLaser.to.y, activeAimingLaser.to.z);
      posAttr.needsUpdate = true;
      this.aimLaserLine.visible = true;
    } else {
      this.aimLaserLine.visible = false;
    }
  }

  // 寻找适合协同交火的目标 (三角洲战术：暗哨未惊动且玩家未开火时保持静默护卫，让玩家亲自搜寻与先手交火)
  findTacticalTarget(pos, enemies, player) {
    let nearest = null;
    let minDist = 24.0;
    const playerEngaged = this.combatSystem && (
      (this.combatSystem.stats.playerShotsFired || 0) > 0 ||
      (this.combatSystem.stats.totalDamageDealt || 0) > 0
    );

    enemies.forEach(e => {
      if (!e.isAlive) return;
      const d = pos.distanceTo(e.mesh.position);

      // 如果敌人处于巡逻状态且未被惊动警觉，且玩家尚未先手开火，且距玩家>9米：队友保持战术护卫，不抢先开火抢人头
      if (e.aiState === 'PATROL' && !e.isAlert && (e.alertTimer || 0) <= 0 && !playerEngaged) {
        if (player) {
          const dToPlayer = player.mesh.position.distanceTo(e.mesh.position);
          if (dToPlayer > 9.0) return;
        }
      }

      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    });
    return nearest;
  }

  findNearestAlive(pos, units) {
    let nearest = null;
    let minDist = Infinity;
    units.forEach(u => {
      if (!u.isAlive) return;
      const d = pos.distanceTo(u.mesh.position);
      if (d < minDist) {
        minDist = d;
        nearest = u;
      }
    });
    return nearest;
  }

  clampToArena(pos) {
    const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const maxR = this.gameScene.arenaRadius - 3.0;
    if (r > maxR) {
      pos.x = (pos.x / r) * maxR;
      pos.z = (pos.z / r) * maxR;
    }
  }
}

window.AIManager = AIManager;
