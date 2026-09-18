import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url); const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("T-119 keeps the form public while showing its archive entry only to staff", () => {
  for (const path of ["app/homework/first-game/page.tsx", "app/homework/first-game/submissions/page.tsx", "app/homework/first-game/submissions/[submissionId]/page.tsx", "app/api/public/homework/first-game/submissions/route.ts", "app/api/public/homework/first-game/submissions/[submissionId]/route.ts"]) assert.equal(existsSync(new URL(path, root)), true, `missing ${path}`);
  const page = source("app/homework/first-game/page.tsx"); const shared = source("app/api/public/homework/_shared.ts");
  assert.match(page, /getChatGPTUser/); assert.match(page, /user\?\.role === "admin" \|\| user\?\.role === "mentor"/); assert.match(page, /canReviewSubmissions &&/);
  assert.match(page, /请使用昵称，不要填写手机号、住址、证件、密码或他人的私密信息/); assert.doesNotMatch(page, />时空终端</); assert.doesNotMatch(shared, /requireChatGPTUser|authenticateSession/);
  assert.match(shared, /assertSameOrigin/); assert.match(shared, /MAX_BODY_BYTES/);
});

test("T-119 keeps eleven topics, gates part two, requires part one and removes image uploads", () => {
  const definition = source("app/lib/first-game-homework.ts"); const client = source("app/homework/first-game/FirstGameHomeworkClient.tsx"); const page = source("app/homework/first-game/page.tsx"); const store = source("app/lib/homework-store.ts"); const detail = source("app/homework/first-game/submissions/[submissionId]/page.tsx"); const terminal = source("app/terminal/TerminalClient.tsx");
  for (const title of ["我的游戏是什么", "谁来玩我的游戏", "游戏怎么玩", "怎样算赢", "画出我的游戏世界", "角色故事", "关卡和任务", "敌人、障碍和道具", "奖励和成长", "胜利、失败和结局", "游戏画风、颜色和声音"]) assert.match(definition, new RegExp(title));
  assert.equal((definition.match(/kind: "image"/g) ?? []).length, 0); assert.equal((definition.match(/kind: "table"/g) ?? []).length, 3); assert.equal((definition.match(/required: true/g) ?? []).length, 20);
  assert.match(client, /localStorage\.setItem/); assert.match(client, /公司名称[\s\S]*required aria-required="true"/); assert.match(client, /styles\.requiredMark/); assert.match(client, /FIRST_GAME_REQUIRED_FIELDS/); assert.match(client, /第二部分尚未解锁/); assert.match(store, /HOMEWORK_REQUIRED_MISSING/); assert.match(store, /boundedString\(raw\.respondentNickname, "姓名／昵称", 80, true\)/); assert.match(store, /boundedString\(raw\.respondentNote, "公司名称", 120, true\)/);
  assert.doesNotMatch(definition, /playSentence|玩法句式|玩家看到 ______/);
  for (const removed of ["growthPath", "玩家怎样从“小菜鸟”变得越来越厉害", "laterDifficulty", "后面的关卡比前面难在哪里", "finalEnding", "游戏最后，玩家会"]) assert.doesNotMatch(definition, new RegExp(removed));
  assert.match(client, /最前面的未完成项/); assert.match(client, /去填写“/); assert.match(client, /focusRequiredField/); assert.match(client, /data-required-missing/);
  for (const removed of ["type=\"file\"", "ImageField", "compressImage", "capture=\"environment\"", "kind === \"image\""]) { assert.doesNotMatch(client, new RegExp(removed)); assert.doesNotMatch(detail, new RegExp(removed)); }
  for (const removed of ["可以只填一部分", "可以重复提交", "图片完全可选", "可以只交一部分"]) { assert.doesNotMatch(page, new RegExp(removed)); assert.doesNotMatch(client, new RegExp(removed)); }
  assert.match(terminal, /\/homework\/first-game\//); assert.doesNotMatch(terminal, /T-119 问卷系统伪装/);
});

test("T-119 explains the two-part homework and Silicon Valley coin rewards", () => {
  const page = source("app/homework/first-game/page.tsx");
  assert.match(page, /第一节课我们已经对自己要设计的游戏有了初步的构想/);
  assert.match(page, /第一部分01-05大题必答/);
  assert.match(page, /完成第一部分作业即可获得500积分硅谷币/);
  assert.match(page, /进阶完成第二部分作业，额外还可获得500积分硅谷币/);
  assert.doesNotMatch(page, /这不是作文，也不是比谁写得多/);
});
