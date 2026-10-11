/**
 * 星之卡比 CP版 · 进度、账号与跨设备同步模块 (子棍 1 & 子棍 12)
 * 支持多账号、本地持久化、安全地点恢复、跨设备导入导出同步
 */
const KirbyStore = (() => {
  const STORAGE_KEY = 'kirby_cp_profiles_v1';
  const CURRENT_USER_KEY = 'kirby_cp_current_user_v1';

  // 默认初始数据
  function createDefaultProfile(username = '星之旅行者') {
    return {
      username,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      unlockedWorlds: ['grassland', 'bunker', 'dark', 'arena'],
      unlockedAbilities: ['fire', 'ice', 'spark', 'water', 'shadow'],
      unlockedCharacters: ['pink', 'yellow', 'blue', 'green'],
      headStars: 0,
      bossesDefeated: 0,
      endlessBestScore: 0,
      endlessBestStage: 1,
      lastWorld: 'grassland',
      lastCharacter: 'pink',
      // 四个世界的安全地点定义
      safePoints: {
        grassland: { x: 0, y: 0.5, z: 12, name: '草原绿茵营地' },
        bunker: { x: 0, y: 1.0, z: 12, name: '地堡前沿掩体' },
        dark: { x: 0, y: 0.8, z: 12, name: '荧光安全树亭' },
        arena: { x: 0, y: 0.5, z: 14, name: '星环试炼祭坛' }
      }
    };
  }

  const memStore = {};
  function safeGetItem(key) {
    try {
      if (typeof window !== 'undefined' && window.MSV_SHOWCASE_STORAGE) {
        return window.MSV_SHOWCASE_STORAGE.getItem(key);
      }
    } catch (e) {
      console.warn('localStorage getItem blocked:', e);
    }
    return memStore[key] || null;
  }

  function safeSetItem(key, val) {
    try {
      if (typeof window !== 'undefined' && window.MSV_SHOWCASE_STORAGE) {
        window.MSV_SHOWCASE_STORAGE.setItem(key, String(val));
        return;
      }
    } catch (e) {
      console.warn('localStorage setItem blocked:', e);
    }
    memStore[key] = String(val);
  }

  function loadAllProfiles() {
    try {
      const raw = safeGetItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
    const def = createDefaultProfile();
    const map = { [def.username]: def };
    saveAllProfiles(map);
    return map;
  }

  function saveAllProfiles(profiles) {
    try {
      safeSetItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error('Failed to save profiles:', e);
    }
  }

  let profiles = loadAllProfiles();
  let currentUsername = safeGetItem(CURRENT_USER_KEY) || Object.keys(profiles)[0] || '星之旅行者';
  if (!profiles[currentUsername]) {
    profiles[currentUsername] = createDefaultProfile(currentUsername);
    saveAllProfiles(profiles);
  }

  return {
    getCurrentUser() {
      if (!profiles[currentUsername]) {
        profiles[currentUsername] = createDefaultProfile(currentUsername);
      }
      return profiles[currentUsername];
    },

    getAllUsers() {
      return Object.keys(profiles);
    },

    switchUser(username) {
      if (!username) return;
      if (!profiles[username]) {
        profiles[username] = createDefaultProfile(username);
      }
      currentUsername = username;
      safeSetItem(CURRENT_USER_KEY, currentUsername);
      saveAllProfiles(profiles);
      return profiles[currentUsername];
    },

    saveProgress(updates) {
      const user = this.getCurrentUser();
      Object.assign(user, updates, { updatedAt: Date.now() });
      profiles[currentUsername] = user;
      saveAllProfiles(profiles);
      return user;
    },

    addHeadStars(count = 1) {
      const user = this.getCurrentUser();
      user.headStars = (user.headStars || 0) + count;
      return this.saveProgress({ headStars: user.headStars });
    },

    consumeHeadStars(count = 1) {
      const user = this.getCurrentUser();
      if ((user.headStars || 0) < count) return false;
      user.headStars -= count;
      this.saveProgress({ headStars: user.headStars });
      return true;
    },

    recordBossDefeat() {
      const user = this.getCurrentUser();
      const count = (user.bossesDefeated || 0) + 1;
      return this.saveProgress({ bossesDefeated: count });
    },

    recordEndlessStage(stage, kills) {
      const user = this.getCurrentUser();
      const bestStage = Math.max(user.endlessBestStage || 1, stage);
      const bestScore = Math.max(user.endlessBestScore || 0, kills);
      return this.saveProgress({ endlessBestStage: bestStage, endlessBestScore: bestScore });
    },

    getSafePoint(worldKey) {
      const user = this.getCurrentUser();
      return user.safePoints && user.safePoints[worldKey] 
        ? user.safePoints[worldKey] 
        : { x: 0, y: 0.5, z: 12, name: '默认安全起点' };
    },

    // 跨设备同步：导出数据字符串 (标准 UTF-8 Base64)
    exportSyncData() {
      const user = this.getCurrentUser();
      const str = JSON.stringify(user);
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
      }));
    },

    // 跨设备同步：导入数据字符串
    importSyncData(syncString) {
      try {
        const raw = syncString.trim();
        const json = decodeURIComponent(atob(raw).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const data = JSON.parse(json);
        if (!data || !data.username) {
          return { success: false, message: '同步码格式有误' };
        }
        // 如果导入的档案时间较旧，进行冲突预警
        const current = profiles[data.username];
        if (current && current.updatedAt > data.updatedAt) {
          return {
            success: false,
            message: '本地已有更新的进度，不能以旧覆盖新',
            conflict: true
          };
        }
        profiles[data.username] = data;
        currentUsername = data.username;
        safeSetItem(CURRENT_USER_KEY, currentUsername);
        saveAllProfiles(profiles);
        return { success: true, message: `已成功同步账号【${data.username}】的云端进度！` };
      } catch (e) {
        return { success: false, message: '解析同步数据失败：' + e.message };
      }
    }
  };
})();

if (typeof window !== 'undefined') window.KirbyStore = KirbyStore;
if (typeof module !== 'undefined' && module.exports) module.exports = KirbyStore;
