// js/game/combat.js - 激光弹道、命中判定、换枪、陨石交互与战斗结算系统

class CombatSystem {
  constructor(gameScene) {
    this.gameScene = gameScene;
    this.projectiles = [];

    // 武器定义
    this.weapons = {
      laser: {
        name: '星芒脉冲步枪',
        fireRate: 0.16, // 秒/发 (高射速)
        damage: 18,
        speed: 55,
        color: 0x00f0ff,
        size: { radius: 0.08, length: 1.2 },
        splash: 0,
        sound: 'playLaser'
      },
      plasma: {
        name: '极光聚能重炮',
        fireRate: 0.52, // 秒/发 (高威能)
        damage: 48,
        speed: 38,
        color: 0xffaa00,
        size: { radius: 0.28, length: 0.6 },
        splash: 3.2,
        sound: 'playPlasma'
      }
    };

    // 统计数据
    this.stats = {
      playerKills: 0,
      totalDamageDealt: 0,
      hasSwitchedWeapon: false
    };

    // 艾拉复活冷却计时器
    this.reviveCooldown = 8.0;
  }

  // 角色开火发射子弹
  shoot(shooter, targetDirection) {
    if (!shooter || !shooter.isAlive) return false;

    const wep = this.weapons[shooter.weaponType || 'laser'];
    if (shooter.fireCooldown > 0) return false;

    shooter.fireCooldown = wep.fireRate;

    // 确定子弹发射起点 (角色枪口附近)
    const spawnPos = shooter.mesh.position.clone();
    spawnPos.y += shooter.isBoss ? 5.2 : 1.35;
    const forward = targetDirection ? targetDirection.clone().normalize() : new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), shooter.mesh.rotation.y);
    spawnPos.addScaledVector(forward, shooter.isBoss ? 2.5 : 0.8);

    // 几何体 (采用内外层自发光双管，零动态光源开销，超高帧率)
    const geo = new THREE.CylinderGeometry(wep.size.radius, wep.size.radius, wep.size.length, 6);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: wep.color });
    const mesh = new THREE.Mesh(geo, mat);

    // 外层霓虹光晕护套 (Additive 叠加自发光，性能极高且有电影级光效)
    const glowGeo = new THREE.CylinderGeometry(wep.size.radius * 2.2, wep.size.radius * 2.2, wep.size.length * 1.05, 6);
    glowGeo.rotateX(Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: wep.color,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    mesh.add(new THREE.Mesh(glowGeo, glowMat));

    mesh.position.copy(spawnPos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);

    this.gameScene.scene.add(mesh);
    // 枪口短闪，让单发和连射都有明确的发射位置反馈
    if (shooter.isPlayer && this.gameScene.createExplosion) {
      this.gameScene.createExplosion(spawnPos, wep.color, 4);
    }

    this.projectiles.push({
      mesh,
      velocity: forward.multiplyScalar(wep.speed),
      shooter,
      team: shooter.team,
      damage: wep.damage,
      splash: wep.splash,
      color: wep.color,
      life: 2.5
    });

    // 播放音效与记录射击数据
    if (shooter.isPlayer) {
      this.stats.playerShotsFired = (this.stats.playerShotsFired || 0) + 1;
      if (wep.sound === 'playPlasma') {
        window.soundSystem.playPlasma();
      } else {
        window.soundSystem.playLaser();
      }
    }

    return true;
  }

  // 换枪 (支持激光步枪与聚能重炮轮换)
  switchWeapon(player) {
    if (!player) return;
    player.weaponType = player.weaponType === 'laser' ? 'plasma' : 'laser';
    this.stats.hasSwitchedWeapon = true;
    window.soundSystem.playSwitchWeapon();
    return this.weapons[player.weaponType];
  }

  // 每帧更新弹道与碰撞
  update(delta, allies, enemies, onKill, onHit, uiManager) {
    // 1. 更新子弹
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;

      const prevPos = p.mesh.position.clone();
      p.mesh.position.addScaledVector(p.velocity, delta);

      // 击中地面
      if (p.mesh.position.y <= 0.1) {
        this.gameScene.createExplosion(p.mesh.position, p.color, 8);
        this.removeProjectile(i);
        continue;
      }

      // 超出射程或生命周期耗尽
      if (p.life <= 0) {
        this.removeProjectile(i);
        continue;
      }

      // 碰撞检测：根据子弹归属阵营选择目标集合
      const targets = p.team === 'ally' ? enemies : allies;
      let hasHit = false;

      for (let t = 0; t < targets.length; t++) {
        const target = targets[t];
        if (!target.isAlive) continue;

        // 若处于 Boss 无敌全息护盾阶段，免疫伤害
        if (target.isBoss && target.isShieldActive) {
          const targetPos = target.mesh.position;
          const dist = p.mesh.position.distanceTo(new THREE.Vector3(targetPos.x, targetPos.y + 2.0, targetPos.z));
          if (dist < 4.2) {
            this.gameScene.createExplosion(p.mesh.position, 0x00f0ff, 10);
            if (p.shooter && p.shooter.isPlayer && uiManager) {
              uiManager.showFloatingDamage(p.mesh.position, 'IMMUNE', false);
            }
            this.removeProjectile(i);
            hasHit = true;
            break;
          }
          continue;
        }

        const targetPos = target.mesh.position;
        const hitRadius = target.isBoss ? 3.0 : 1.1;
        const dist = p.mesh.position.distanceTo(new THREE.Vector3(targetPos.x, targetPos.y + 1.2, targetPos.z));

        if (dist < hitRadius) {
          const dead = target.takeDamage(p.damage);
          this.gameScene.createExplosion(p.mesh.position, p.color, target.isBoss ? 20 : 12);
          window.soundSystem.playHit();

          // 敌人受击硬直与警觉传播
          if (target.team === 'enemy') {
            target.markSuppressed(0.4);
            target.aiState = 'ENGAGED';
            target.alertTimer = 10.0;
            // 唤醒 25 米内的其他巡逻队友 (三角洲警觉联动)
            enemies.forEach(other => {
              if (other.isAlive && other.mesh.position.distanceTo(targetPos) < 25) {
                other.aiState = 'ENGAGED';
                other.alertTimer = 8.0;
              }
            });
          }

          // 玩家击中目标反馈：Hitmarker 与 浮动伤害跳字
          if (p.shooter && p.shooter.isPlayer && uiManager) {
            uiManager.showHitmarker(target.isBoss);
            uiManager.showFloatingDamage(p.mesh.position, p.damage, target.isBoss);
            this.stats.totalDamageDealt += p.damage;
          }

          // 玩家自身受击反馈：屏幕红光边缘预警
          if (target.isPlayer && uiManager) {
            uiManager.showDamageVignette();
          }

          if (onHit) onHit(target, p.shooter, false);

          if (dead) {
            this.gameScene.createExplosion(target.mesh.position, target.team === 'enemy' ? 0xff3366 : 0x00f0ff, 35);
            window.soundSystem.playExplosion();
            if (p.shooter && p.shooter.isPlayer) {
              this.stats.playerKills++;
            }
            if (onKill) onKill(target, p.shooter);
          }

          // 溅射伤害 (重炮范围杀伤)
          if (p.splash > 0) {
            targets.forEach(other => {
              if (other !== target && other.isAlive) {
                const splashDist = other.mesh.position.distanceTo(targetPos);
                if (splashDist < p.splash) {
                  const splashDmg = Math.floor(p.damage * (1 - splashDist / p.splash));
                  const isDead = other.takeDamage(splashDmg);
                  if (other.team === 'enemy') other.markSuppressed(0.3);
                  if (onHit) onHit(other, p.shooter, false);
                  if (isDead && onKill) onKill(other, p.shooter);
                }
              }
            });
          }

          hasHit = true;
          break;
        }
      }

      if (hasHit) {
        this.removeProjectile(i);
        continue;
      }

      // 碰撞检测：击打浮游木星冰铁陨石
      if (this.gameScene.meteors && this.gameScene.meteors.length > 0) {
        for (let m = 0; m < this.gameScene.meteors.length; m++) {
          const meteor = this.gameScene.meteors[m];
          const distToMeteor = p.mesh.position.distanceTo(meteor.mesh.position);
          if (distToMeteor < meteor.radius + 0.3) {
            // 击中陨石
            this.gameScene.damageMeteor(m, p.damage);
            this.removeProjectile(i);
            hasHit = true;
            break;
          }
        }
      }
    }

    // 2. 艾拉复活被动逻辑 (宇宙治疗者：寻找倒下队友进行复活)
    this.reviveCooldown -= delta;
    if (this.reviveCooldown <= 0) {
      this.checkAylaRevive(allies);
    }
  }

  // 艾拉治愈复活检测
  checkAylaRevive(allies) {
    const ayla = allies.find(a => a.charId === 'ayla' && a.isAlive);
    if (!ayla) return;

    const fallenAlly = allies.find(a => !a.isAlive && !a.isBoss);
    if (fallenAlly) {
      const dist = ayla.mesh.position.distanceTo(fallenAlly.mesh.position);
      if (dist < 18) { // 治愈光环范围内
        fallenAlly.revive();
        this.gameScene.createExplosion(fallenAlly.mesh.position, 0x00ff88, 30);
        window.soundSystem.playRevive();
        this.reviveCooldown = 12.0; // 冷却 12 秒
      }
    }
  }

  removeProjectile(index) {
    const p = this.projectiles[index];
    if (!p) return;
    this.gameScene.scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
    this.projectiles.splice(index, 1);
  }

  clearAllProjectiles() {
    this.projectiles.forEach(p => {
      this.gameScene.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.projectiles = [];
  }
}

window.CombatSystem = CombatSystem;
