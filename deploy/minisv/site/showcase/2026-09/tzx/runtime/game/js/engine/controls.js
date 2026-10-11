// js/engine/controls.js - 双手多点触控（虚拟摇杆+视角滑动+开火换枪）与键鼠兼容输入系统

class InputController {
  constructor(gameScene) {
    this.gameScene = gameScene;

    // 移动向量 (-1 到 1)
    this.moveVector = new THREE.Vector2(0, 0);

    // 动作状态
    this.isFiring = false;
    // 单次点击开火请求，避免快速点按在一帧内被 touchend 清掉
    this.wantFire = false;
    this.wantSwitchWeapon = false;
    this.wantTacticalScan = false;

    // 触摸追踪
    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 50;

    this.lookTouchId = null;
    this.lastLookX = 0;
    this.lastLookY = 0;
    this.lastTouchInputAt = 0;
    this.lastSwitchInputAt = 0;
    this.lastScanInputAt = 0;

    // 键盘状态
    this.keys = {};

    // DOM 元素缓存
    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickStick = document.getElementById('joystick-stick');
    this.touchLookZone = document.getElementById('touch-look-zone');
    this.btnAttack = document.getElementById('btn-attack');
    this.btnSwitchWeapon = document.getElementById('btn-switch-weapon');
    this.btnTacticalScan = document.getElementById('btn-tactical-scan');

    this.init();
  }

  init() {
    this.bindTouchControls();
    this.bindKeyboardControls();
    this.bindButtonControls();
    window.addEventListener('blur', () => this.resetInput());
    window.addEventListener('resize', () => this.resetInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetInput();
    });
  }

  isInputBlocked() {
    return window.innerHeight > window.innerWidth || !!document.querySelector('.modal-layer.active');
  }

  resetInput() {
    this.joystickTouchId = null;
    this.lookTouchId = null;
    this.moveVector.set(0, 0);
    this.keys = {};
    this.isFiring = false;
    this.wantFire = false;
    this.wantSwitchWeapon = false;
    this.wantTacticalScan = false;
    if (this.joystickBase) this.joystickBase.classList.remove('active');
    if (this.joystickStick) this.joystickStick.style.transform = 'translate(0px, 0px)';
    if (this.btnAttack) this.btnAttack.classList.remove('firing');
  }

  // 1. 触屏多点触控绑定 (全屏智能分区：左侧摇杆 + 全局视角滑动，完美杜绝手势滚动中断)
  bindTouchControls() {
    const isInteractiveElement = (elem) => {
      if (!elem) return false;
      return !!(
        elem.closest('.interactive') ||
        elem.closest('.modal-layer.active') ||
        elem.closest('#action-controls') ||
        elem.closest('#enemy-target-panel') ||
        elem.closest('#left-mission-panel')
      );
    };

    const isJoystickZone = (touch, elem) => {
      if (elem && elem.closest('#joystick-zone')) return true;
      // 容错：触点落在屏幕左侧且偏下方（X < 45% 屏宽，且 Y > 35% 屏高）
      return (touch.clientX < window.innerWidth * 0.45 && touch.clientY > window.innerHeight * 0.35);
    };

    // 全局触摸按下监听 (passive: false 确保 preventDefault 阻止页面拖拽滚动)
    window.addEventListener('touchstart', (e) => {
      if (this.isInputBlocked()) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const target = touch.target;

        // 如果点击的是按键或对话框，不拦截，留给 UI 处理
        if (isInteractiveElement(target)) {
          continue;
        }

        e.preventDefault();

        // A. 摇杆触摸分配
        if (this.joystickTouchId === null && isJoystickZone(touch, target)) {
          this.joystickTouchId = touch.identifier;
          this.joystickCenter.x = touch.clientX;
          this.joystickCenter.y = touch.clientY;

          // 摇杆固定在左下角，不跟随触点跳动，避免在手机边缘被裁切。
          if (this.joystickBase) {
            this.joystickBase.classList.add('active');
            this.joystickRadius = (this.joystickBase.clientWidth - this.joystickStick.clientWidth) / 2;
          }
          if (this.joystickStick) {
            this.joystickStick.style.transform = 'translate(0px, 0px)';
          }
          this.moveVector.set(0, 0);
          continue;
        }

        // B. 视角滑动分配 (除摇杆与按键外，屏幕任意空白处皆可滑动旋转视角)
        if (this.lookTouchId === null) {
          this.lookTouchId = touch.identifier;
          this.lastLookX = touch.clientX;
          this.lastLookY = touch.clientY;
        }
      }
    }, { passive: false });

    // 全局触摸移动监听
    window.addEventListener('touchmove', (e) => {
      let handled = false;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // 1. 处理摇杆拖动
        if (touch.identifier === this.joystickTouchId) {
          handled = true;
          const dx = touch.clientX - this.joystickCenter.x;
          const dy = touch.clientY - this.joystickCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          const clampedDist = Math.min(dist, this.joystickRadius);
          const stickX = Math.cos(angle) * clampedDist;
          const stickY = Math.sin(angle) * clampedDist;

          if (this.joystickStick) {
            this.joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;
          }

          // 归一化移动向量 (x: 左右, y: 前后)
          this.moveVector.x = stickX / this.joystickRadius;
          this.moveVector.y = -stickY / this.joystickRadius; // 向上推为向前
        }

        // 2. 处理转视角拖拽
        if (touch.identifier === this.lookTouchId) {
          handled = true;
          const deltaX = touch.clientX - this.lastLookX;
          const deltaY = touch.clientY - this.lastLookY;
          this.lastLookX = touch.clientX;
          this.lastLookY = touch.clientY;

          this.rotateCamera(deltaX, deltaY);
        }
      }

      if (handled) {
        e.preventDefault();
      }
    }, { passive: false });

    const endTouchHandler = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          if (this.joystickBase) this.joystickBase.classList.remove('active');
          if (this.joystickStick) this.joystickStick.style.transform = 'translate(0px, 0px)';
          this.moveVector.set(0, 0);
        }
        if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        }
      }
    };

    window.addEventListener('touchend', endTouchHandler, { passive: false });
    window.addEventListener('touchcancel', endTouchHandler, { passive: false });
  }

  // 2. 右下角攻击与换枪大按键
  bindButtonControls() {
    if (this.btnAttack) {
      const startFire = (e) => {
        if (this.isInputBlocked()) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'mousedown' && performance.now() - this.lastTouchInputAt < 500) return;
        if (e.type === 'touchstart') this.lastTouchInputAt = performance.now();
        this.wantFire = true;
        this.isFiring = true;
        this.btnAttack.classList.add('firing');
      };
      const stopFire = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'mouseup' && performance.now() - this.lastTouchInputAt < 500) return;
        this.isFiring = false;
        this.btnAttack.classList.remove('firing');
      };

      this.btnAttack.addEventListener('touchstart', startFire, { passive: false });
      this.btnAttack.addEventListener('touchend', stopFire, { passive: false });
      this.btnAttack.addEventListener('touchcancel', stopFire, { passive: false });

      this.btnAttack.addEventListener('mousedown', startFire);
      window.addEventListener('mouseup', stopFire);
    }

    if (this.btnSwitchWeapon) {
      const switchWep = (e) => {
        if (this.isInputBlocked()) return;
        e.preventDefault();
        e.stopPropagation();
        const now = performance.now();
        if (e.type === 'click' && now - this.lastSwitchInputAt < 500) return;
        this.lastSwitchInputAt = now;
        this.wantSwitchWeapon = true;
      };
      this.btnSwitchWeapon.addEventListener('touchstart', switchWep, { passive: false });
      this.btnSwitchWeapon.addEventListener('click', switchWep);
    }

    if (this.btnTacticalScan) {
      const scanAction = (e) => {
        if (this.isInputBlocked()) return;
        e.preventDefault();
        e.stopPropagation();
        const now = performance.now();
        if (e.type === 'click' && now - this.lastScanInputAt < 500) return;
        this.lastScanInputAt = now;
        this.wantTacticalScan = true;
      };
      this.btnTacticalScan.addEventListener('touchstart', scanAction, { passive: false });
      this.btnTacticalScan.addEventListener('click', scanAction);
    }
  }

  // 3. PC 键盘与鼠标兼容支持 (测试与桌面游玩)
  bindKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      if (this.isInputBlocked()) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      if (e.code === 'KeyQ') {
        this.wantSwitchWeapon = true;
      }
      if (e.code === 'KeyE') {
        this.wantTacticalScan = true;
      }
      if (e.code === 'Space') {
        if (!this.isFiring) this.wantFire = true;
        this.isFiring = true;
        if (this.btnAttack) this.btnAttack.classList.add('firing');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') {
        this.isFiring = false;
        if (this.btnAttack) this.btnAttack.classList.remove('firing');
      }
    });

    // 全屏鼠标拖拽转视角 (排除交互按钮与弹窗)
    let isMouseDown = false;
    let mouseLastX = 0;
    let mouseLastY = 0;

    window.addEventListener('mousedown', (e) => {
      if (this.isInputBlocked()) return;
      if (e.button === 0) {
        const target = e.target;
        if (target && (target.closest('.interactive') || target.closest('.modal-layer.active'))) {
          return;
        }
        isMouseDown = true;
        mouseLastX = e.clientX;
        mouseLastY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - mouseLastX;
      const deltaY = e.clientY - mouseLastY;
      mouseLastX = e.clientX;
      mouseLastY = e.clientY;
      this.rotateCamera(deltaX, deltaY);
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });
    window.addEventListener('blur', () => { isMouseDown = false; });
    window.addEventListener('resize', () => { isMouseDown = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) isMouseDown = false;
    });
  }

  rotateCamera(deltaX, deltaY) {
    if (!this.gameScene) return;
    const sensitivity = 0.0075; // 流畅舒适的转动灵敏度
    this.gameScene.cameraYaw -= deltaX * sensitivity;
    this.gameScene.cameraPitch += deltaY * sensitivity;

    // 限制俯仰角度（避免反转镜头或过于贴地）
    this.gameScene.cameraPitch = Math.max(0.04, Math.min(1.22, this.gameScene.cameraPitch));
  }

  // 每帧更新输入向量
  update() {
    if (this.isInputBlocked()) {
      this.resetInput();
      return;
    }
    // 键盘叠加输入
    let kx = 0;
    let ky = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) kx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) ky += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) ky -= 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      this.moveVector.set(kx / len, ky / len);
    } else if (this.joystickTouchId === null) {
      this.moveVector.set(0, 0);
    }
  }

  consumeSwitchWeapon() {
    if (this.wantSwitchWeapon) {
      this.wantSwitchWeapon = false;
      return true;
    }
    return false;
  }

  consumeTacticalScan() {
    if (this.wantTacticalScan) {
      this.wantTacticalScan = false;
      return true;
    }
    return false;
  }

  consumeFire() {
    if (this.wantFire) {
      this.wantFire = false;
      return true;
    }
    return false;
  }
}

window.InputController = InputController;
