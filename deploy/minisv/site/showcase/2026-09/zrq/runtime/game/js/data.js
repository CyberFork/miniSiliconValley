/* ============================================================
   data.js —— 全部游戏数据（技能 / 物品 / 合成 / 丧尸 / 配置）
   改平衡数值只要改这个文件
   ============================================================ */
const CONFIG = {
  SAVE_KEY: 'doomsday_endless_v1',

  // 一天的现实秒数：白天 60% + 黑夜 40%
  DAY_SECONDS: 300,
  DAY_RATIO: 0.6,
  START_HOUR: 8,

  // 饥饿：每秒下降，归零后掉血
  HUNGER_DECAY: 0.11,
  STARVE_DPS: 1.6,

  BAG_CAPACITY: 12,          // 背包格数上限（每种物品占 1 格，可叠放；满了要先用掉或合成）
  SAFE_RADIUS: 13,           // 安全屋安全半径
  MAP_SIZE: 150,             // 地图边长（米）

  // 丧尸刷新
  ZOMBIE_MIN: 7,             // 第 1 天白天最少丧尸
  ZOMBIE_PER_DAY: 3,         // 每天增加
  ZOMBIE_MAX: 18,            // 同屏上限（手机性能友好）
  NIGHT_MULT: 1.7,           // 夜晚数量倍数
  NIGHT_SPEED: 1.35,         // 夜晚速度倍数
  SPAWN_DIST: 34,            // 在玩家多远外刷新

  PICKUP_DIST: 1.9,          // 拾取距离
  DROP_CHANCE: 0.55,         // 丧尸掉落物品概率

  SWITCH_CD: 6,              // 切换角色冷却（秒）
  SWITCH_SLOWMO: 1.2,        // 切换慢动作时长（秒）
  SLOWMO_SCALE: 0.22,        // 慢动作时间倍率

  MOVE_SPEED: 4.4,           // 步行速度 m/s
  EYE_HEIGHT: 1.62,
};

/* ---------------- 角色 ---------------- */
const CHARS = {
  jy: {
    id: 'jy', name: '姜叶凡', role: '主C', sheet: 'hero', face: '🧑‍🚀',
    hp: 120, hunger: 100,
    desc: '近战输出核心：冲在前面清丧尸，攻击力最高。',
    equip: ['flame', 'jump', 'bandage'],
  },
  zy: {
    id: 'zy', name: '张艺凡', role: '辅助', sheet: 'mate', face: '🧚‍♀️',
    hp: 95, hunger: 100,
    desc: '辅助与治疗：治疗、冰冻控场、补充体力，别让她冲到最前面。',
    equip: ['bandage', 'frost', 'dash'],
  },
};

/* ---------------- 技能库（每人上阵 3 个） ---------------- */
const SKILLS = {
  flame: {
    id: 'flame', name: '火焰斩', icon: '🔥', cd: 2.6, cost: 0,
    desc: '向前方劈出火焰，命中范围内所有丧尸，伤害 55。',
    type: 'cone', range: 4.2, angle: 75, damage: 55, color: 0xff6a2b,
  },
  jump: {
    id: 'jump', name: '跳跃', icon: '🦘', cd: 5.5, cost: 0,
    desc: '向前跳 6 米，跳跃瞬间不会被打到（躲扑咬用）。',
    type: 'dash', distance: 6.0, damage: 0, invul: 0.6, color: 0x9ad0ff,
  },
  bandage: {
    id: 'bandage', name: '治疗绷带', icon: '🩹', cd: 11, cost: 0,
    desc: '包扎伤口，立刻回复 38 点生命。',
    type: 'heal', heal: 38, color: 0x7fd06a,
  },
  frost: {
    id: 'frost', name: '冰冻陷阱', icon: '❄️', cd: 9, cost: 0,
    desc: '在脚下炸开寒冰，周围丧尸受伤 30 并被冻住 3 秒。',
    type: 'nova', radius: 7.5, damage: 30, freeze: 3, color: 0x6fd8ff,
  },
  dash: {
    id: 'dash', name: '冲锋撞击', icon: '💨', cd: 6.5, cost: 0,
    desc: '向前猛冲 8 米，撞到的丧尸受伤 45 并被撞退。',
    type: 'dash', distance: 8.0, damage: 45, color: 0xd9a441,
  },
  throw: {
    id: 'throw', name: '燃烧瓶', icon: '🍾', cd: 8, cost: 1,
    desc: '扔出燃烧瓶，着火范围内丧尸每秒受 22 点伤害，持续 4 秒。',
    type: 'fire', range: 12, radius: 5, dps: 22, duration: 4, color: 0xff8a3b,
  },
};

/* ---------------- 物品 ---------------- */
const ITEMS = {
  bandage:   { id:'bandage',   icon:'🩹', name:'绷带',       kind:'heal',   heal:18,  desc:'包扎伤口，回复 18 点生命。' },
  food_can:  { id:'food_can',  icon:'🥫', name:'午餐肉罐头', kind:'food',   food:38,  desc:'吃掉，回复 38 点饥饿。' },
  food_bar:  { id:'food_bar',  icon:'🍫', name:'能量棒',     kind:'food',   food:26,  desc:'吃掉，回复 26 点饥饿。' },
  water:     { id:'water',     icon:'💧', name:'瓶装水',     kind:'food',   food:14,  desc:'喝掉，回复 14 点饥饿。' },
  medkit:    { id:'medkit',    icon:'🧰', name:'急救箱',     kind:'heal',   heal:60,  desc:'回复 60 点生命。' },
  cloth:     { id:'cloth',     icon:'🧵', name:'破布',       kind:'material', desc:'合成材料。' },
  alcohol:   { id:'alcohol',   icon:'🧪', name:'酒精',       kind:'material', desc:'合成材料。' },
  metal:     { id:'metal',     icon:'🔩', name:'金属零件',   kind:'material', desc:'合成材料。' },
  wood:      { id:'wood',      icon:'🪵', name:'木板',       kind:'material', desc:'合成材料。' },
  bandage_hi:{ id:'bandage_hi',icon:'🏥', name:'高级绷带',   kind:'heal',   heal:45,  desc:'回复 45 点生命。' },
  molotov:   { id:'molotov',   icon:'🍾', name:'燃烧瓶',     kind:'throw',  radius:5, dps:22, duration:4, desc:'出发后投向前方；半径 5 米内每秒伤害 22，持续 4 秒。背包投掷和燃烧瓶技能共用库存。' },
  armor:     { id:'armor',     icon:'🛡️', name:'铁甲护具',   kind:'passive',bonus:{maxHp:25}, desc:'永久装备：两名角色生命上限各 +25，不直接回血，不重复叠加。' },
  knife:     { id:'knife',     icon:'🗡️', name:'猎刀',       kind:'passive',bonus:{atk:12},   desc:'永久装备：普通攻击及直接伤害技能 +12；不增加回血或燃烧伤害，不重复叠加。' },
  flashlight:{ id:'flashlight',icon:'🔦', name:'手电筒',     kind:'passive',bonus:{light:true},desc:'永久装备：夜间增加照明并减淡远处雾气，不重复叠加。' },
};

/* ---------------- 合成配方（安全屋合成台） ---------------- */
const RECIPES = [
  { id:'r_bandage_hi', out:'bandage_hi', n:1, need:{ cloth:2, alcohol:1 },      name:'高级绷带' },
  { id:'r_molotov',    out:'molotov',    n:2, need:{ alcohol:2, cloth:1 },      name:'燃烧瓶 ×2' },
  { id:'r_armor',      out:'armor',      n:1, need:{ metal:3, wood:1 },         name:'铁甲护具' },
  { id:'r_knife',      out:'knife',      n:1, need:{ metal:2, cloth:1 },        name:'猎刀' },
  { id:'r_flashlight', out:'flashlight', n:1, need:{ wood:1, metal:1 },         name:'手电筒' },
  { id:'r_medkit',     out:'medkit',     n:1, need:{ cloth:3, alcohol:2, metal:1 }, name:'急救箱' },
];

/* ---------------- 丧尸 ---------------- */
const ZOMBIES = {
  walker: {
    id:'walker', name:'游荡者', sheet:'zombie', face:'🧟',
    hp:60, speed:1.5, damage:9, attackCd:1.4, attackRange:1.9, scale:1.5,
    cr:2, notice:16,
  },
  runner: {
    id:'runner', name:'奔跑者', sheet:'zombie', face:'🧟‍♂️',
    hp:38, speed:3.4, damage:12, attackCd:1.1, attackRange:1.9, scale:1.35,
    cr:3, notice:24,
  },
  brute: {
    id:'brute', name:'巨力丧尸', sheet:'boss', face:'👹',
    hp:180, speed:1.2, damage:22, attackCd:1.9, attackRange:2.3, scale:2.3,
    cr:7, notice:18,
  },
};

/* ---------------- 关卡/难度曲线（无尽生存，按天数） ---------------- */
function dayPlan(day, isNight) {
  const pool = [];
  pool.push('walker');
  if (day >= 2) pool.push('walker', 'runner');
  if (day >= 4) pool.push('runner');
  if (day >= 5) pool.push('brute');
  if (day >= 8) pool.push('brute', 'runner');
  const base = CONFIG.ZOMBIE_MIN + (day - 1) * CONFIG.ZOMBIE_PER_DAY;
  const total = Math.min(CONFIG.ZOMBIE_MAX, Math.round(base * (isNight ? CONFIG.NIGHT_MULT : 1)));
  return { pool, total };
}
