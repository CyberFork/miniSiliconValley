export type FirstGameTextAnswer = string;
export type FirstGameChoiceAnswer = string[];
export type FirstGameTableAnswer = Array<Record<string, string>>;
export type FirstGameAnswer = FirstGameTextAnswer | FirstGameChoiceAnswer | FirstGameTableAnswer;
export type FirstGameAnswers = Record<string, FirstGameAnswer>;

export type FirstGameField = {
  id: string;
  label: string;
  prompt?: string;
  kind: "short" | "long" | "single" | "multi" | "table";
  required?: boolean;
  options?: readonly string[];
  columns?: readonly { id: string; label: string }[];
  rows?: readonly { id: string; label: string }[];
};

export type FirstGameSection = {
  id: string;
  level: "第一层｜自己独立完成" | "第二层｜感兴趣再完成";
  title: string;
  intro: string;
  fields: readonly FirstGameField[];
};

const GAME_TYPES = ["闯关游戏", "冒险游戏", "角色扮演游戏", "益智游戏", "经营游戏", "战斗游戏", "竞速游戏", "卡牌游戏", "其他"] as const;
const FEELINGS = ["开心", "紧张", "刺激", "神秘", "成就感", "放松", "其他"] as const;
const ACTIONS = ["跑", "跳", "收集", "躲避", "战斗", "建造", "选择", "解谜", "交换", "其他"] as const;
const REWARDS = ["金币", "星星", "新角色", "新武器", "新地图", "新能力", "其他"] as const;
const ART_STYLES = ["可爱", "冒险", "神秘", "搞笑", "紧张", "科幻", "梦幻", "其他"] as const;

export const FIRST_GAME_HOMEWORK_SECTIONS: readonly FirstGameSection[] = [
  {
    id: "game",
    level: "第一层｜自己独立完成",
    title: "01｜我的游戏是什么？",
    intro: "先用短句讲清楚：它叫什么、是什么类型、玩家要做什么。",
    fields: [
      { id: "gameName", label: "我的游戏叫", kind: "short", required: true },
      { id: "gameTypes", label: "游戏类型", kind: "multi", options: GAME_TYPES, required: true },
      { id: "gameTypeOther", label: "其他类型（可选）", kind: "short" },
      { id: "oneSentence", label: "一句话介绍", prompt: "这是一个让【谁】通过【做什么】来完成【什么目标】的游戏。", kind: "long", required: true },
    ],
  },
  {
    id: "players",
    level: "第一层｜自己独立完成",
    title: "02｜谁来玩我的游戏？",
    intro: "想一个具体玩家，而不是“所有人”。",
    fields: [
      { id: "playerWho", label: "我的游戏是给谁玩的", kind: "long", required: true },
      { id: "playerAge", label: "适合几岁的小朋友", kind: "short", required: true },
      { id: "playMode", label: "一个人玩，还是和朋友一起玩", kind: "single", options: ["一个人玩", "和朋友一起玩", "两种都可以", "其他"], required: true },
      { id: "playModeOther", label: "其他玩法人数（可选）", kind: "short" },
      { id: "playerFeelings", label: "我希望玩家感受到", kind: "multi", options: FEELINGS, required: true },
      { id: "playerFeelingOther", label: "其他感受（可选）", kind: "short" },
      { id: "playerWhy", label: "我觉得玩家会喜欢它，是因为", kind: "long", required: true },
    ],
  },
  {
    id: "play",
    level: "第一层｜自己独立完成",
    title: "03｜游戏怎么玩？",
    intro: "按游戏开始后的顺序写，不需要一次写很多。",
    fields: [
      { id: "stepOne", label: "第一步｜玩家一开始要", kind: "long", required: true },
      { id: "stepTwo", label: "第二步｜接下来玩家要", kind: "long", required: true },
      { id: "stepThree", label: "第三步｜玩家继续要", kind: "long", required: true },
      { id: "mainActions", label: "玩家最常做的事情", kind: "multi", options: ACTIONS, required: true },
      { id: "mainActionOther", label: "其他主要动作（可选）", kind: "short" },
      { id: "playSentence", label: "玩法句式", prompt: "玩家看到 ______，就会 ______，然后得到 ______。", kind: "long", required: true },
    ],
  },
  {
    id: "win",
    level: "第一层｜自己独立完成",
    title: "04｜怎样算赢？",
    intro: "说清目标、成功和失败，玩家才知道自己为什么行动。",
    fields: [
      { id: "gameGoal", label: "玩家最终要完成什么事情", kind: "long", required: true },
      { id: "victoryCondition", label: "完成什么就算赢", kind: "long", required: true },
      { id: "failureCondition", label: "发生什么就会失败", kind: "long", required: true },
      { id: "afterWin", label: "玩家赢了以后会看到", kind: "long", required: true },
      { id: "afterLoss", label: "玩家输了以后可以", kind: "multi", options: ["重新开始", "回到上一关", "选择新的角色", "其他"], required: true },
      { id: "afterLossOther", label: "其他失败后选择（可选）", kind: "short" },
    ],
  },
  {
    id: "world",
    level: "第一层｜自己独立完成",
    title: "05｜画出我的游戏世界",
    intro: "至少想出发生地点、玩家角色和一个重要物品、障碍或敌人。",
    fields: [
      { id: "worldLocation", label: "游戏发生在哪里", kind: "long", required: true },
      { id: "worldPlayer", label: "玩家是谁", kind: "long", required: true },
      { id: "worldReason", label: "玩家为什么要开始游戏", kind: "long", required: true },
      { id: "worldImageNote", label: "游戏世界补充说明（可选）", kind: "long" },
    ],
  },
  {
    id: "characters",
    level: "第二层｜感兴趣再完成",
    title: "06｜角色故事",
    intro: "让角色有能力，也有真正会遇到的困难。",
    fields: [
      { id: "characterName", label: "玩家角色名称", kind: "short" },
      { id: "characterAbility", label: "角色最厉害的能力", kind: "long" },
      { id: "characterDifficulty", label: "角色最害怕或最容易遇到的困难", kind: "long" },
      { id: "characterGoal", label: "角色最想完成的事情", kind: "long" },
      { id: "otherCharacters", label: "游戏里还有谁", kind: "table", columns: [{ id: "name", label: "角色名称" }, { id: "who", label: "他是谁" }, { id: "action", label: "他会做什么" }], rows: [{ id: "1", label: "角色 1" }, { id: "2", label: "角色 2" }, { id: "3", label: "角色 3" }] },
    ],
  },
  {
    id: "levels",
    level: "第二层｜感兴趣再完成",
    title: "07｜关卡和任务",
    intro: "建议 3 关：学会基本玩法、遇到新规则、完成更大的挑战。",
    fields: [
      { id: "levelsTable", label: "关卡设计", kind: "table", columns: [{ id: "task", label: "玩家要完成的任务" }, { id: "challenge", label: "新的挑战" }, { id: "clear", label: "怎样通关" }], rows: [{ id: "level1", label: "第 1 关" }, { id: "level2", label: "第 2 关" }, { id: "level3", label: "第 3 关" }] },
    ],
  },
  {
    id: "obstacles",
    level: "第二层｜感兴趣再完成",
    title: "08｜敌人、障碍和道具",
    intro: "想一个阻挡玩家的东西，也可以设计一个帮助玩家的道具。",
    fields: [
      { id: "obstaclesTable", label: "敌人／障碍与道具", kind: "table", columns: [{ id: "name", label: "名称" }, { id: "what", label: "它是什么" }, { id: "action", label: "它会做什么" }, { id: "response", label: "玩家怎么应对" }], rows: [{ id: "obstacle", label: "敌人／障碍" }, { id: "tool", label: "道具" }] },
    ],
  },
  {
    id: "growth",
    level: "第二层｜感兴趣再完成",
    title: "09｜奖励和成长",
    intro: "奖励要让玩家知道自己变强了，而不只是数字变大。",
    fields: [
      { id: "rewards", label: "完成任务后会得到", kind: "multi", options: REWARDS },
      { id: "rewardOther", label: "其他奖励（可选）", kind: "short" },
      { id: "growthPath", label: "玩家怎样从“小菜鸟”变得越来越厉害", kind: "long" },
      { id: "laterDifficulty", label: "后面的关卡比前面难在哪里", kind: "long" },
    ],
  },
  {
    id: "ending",
    level: "第二层｜感兴趣再完成",
    title: "10｜胜利、失败和结局",
    intro: "除了普通输赢，还可以给故事一个完整结局。",
    fields: [
      { id: "victoryEnding", label: "完成最终任务后发生了什么", kind: "long" },
      { id: "failureEnding", label: "没有完成任务时发生了什么", kind: "long" },
      { id: "finalEnding", label: "游戏最后，玩家会", kind: "long" },
    ],
  },
  {
    id: "style",
    level: "第二层｜感兴趣再完成",
    title: "11｜游戏画风、颜色和声音",
    intro: "让别人闭上眼睛也能想象你的游戏是什么感觉。",
    fields: [
      { id: "overallStyle", label: "游戏整体感觉", kind: "multi", options: ART_STYLES },
      { id: "overallStyleOther", label: "其他整体感觉（可选）", kind: "short" },
      { id: "mainColors", label: "游戏主要使用的颜色", kind: "short" },
      { id: "characterStyle", label: "我希望角色画成", kind: "long" },
      { id: "sceneStyle", label: "我希望游戏场景画成", kind: "long" },
      { id: "victorySound", label: "玩家胜利时，我希望听到", kind: "long" },
      { id: "failureSound", label: "玩家失败时，我希望听到", kind: "long" },
    ],
  },
] as const;

export const FIRST_GAME_HOMEWORK_FIELDS = FIRST_GAME_HOMEWORK_SECTIONS.flatMap((section) => section.fields);
export const FIRST_GAME_REQUIRED_FIELDS = FIRST_GAME_HOMEWORK_FIELDS.filter((field) => field.required);

export function firstGameField(id: string): FirstGameField | undefined {
  return FIRST_GAME_HOMEWORK_FIELDS.find((field) => field.id === id);
}
