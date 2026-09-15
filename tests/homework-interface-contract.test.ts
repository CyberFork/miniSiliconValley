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

test("T-119 keeps all eleven source topics, optional images and terminal entry", () => {
  const definition = source("app/lib/first-game-homework.ts"); const client = source("app/homework/first-game/FirstGameHomeworkClient.tsx"); const page = source("app/homework/first-game/page.tsx"); const store = source("app/lib/homework-store.ts"); const terminal = source("app/terminal/TerminalClient.tsx");
  for (const title of ["我的游戏是什么", "谁来玩我的游戏", "游戏怎么玩", "怎样算赢", "画出我的游戏世界", "角色故事", "关卡和任务", "敌人、障碍和道具", "奖励和成长", "胜利、失败和结局", "游戏画风、颜色和声音"]) assert.match(definition, new RegExp(title));
  assert.equal((definition.match(/kind: "image"/g) ?? []).length, 5); assert.equal((definition.match(/kind: "table"/g) ?? []).length, 3);
  assert.match(client, /localStorage\.setItem/); assert.match(client, /required aria-required="true"/); assert.match(client, /styles\.requiredMark/); assert.match(store, /boundedString\(raw\.respondentNickname, "姓名／昵称", 80, true\)/); assert.match(client, /capture="environment"/); assert.match(client, /compressImage/);
  for (const removed of ["可以只填一部分", "可以重复提交", "图片完全可选", "可以只交一部分"]) { assert.doesNotMatch(page, new RegExp(removed)); assert.doesNotMatch(client, new RegExp(removed)); }
  assert.match(terminal, /\/homework\/first-game\//); assert.doesNotMatch(terminal, /T-119 问卷系统伪装/);
});
