import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storeUrl = new URL("../app/lib/classroom-store.ts", import.meta.url);
const uiUrl = new URL("../app/classroom/ClassroomApp.tsx", import.meta.url);
const semanticsUrl = new URL("../docs/COURSE_SEMANTICS.md", import.meta.url);
const facilitatorUrl = new URL("../docs/DM_MENTOR_MANUAL.md", import.meta.url);

test("learners never claim PDMO and enter challenges as one Young Builder team", async () => {
  const store = await readFile(storeUrl, "utf8");

  assert.doesNotMatch(store, /PDMO_INCOMPLETE/);
  assert.doesNotMatch(store, /PDMO_REQUIRED/);
  assert.doesNotMatch(store, /async function choosePdmo/);
  assert.doesNotMatch(store, /type: "choose-pdmo"/);
  assert.match(store, /contributionMode: "young-builder-team"/);
  assert.match(store, /legacy_pdmo_role/,
    "historic exports keep a clearly named compatibility field without exposing a learner role");
});

test("learner UI presents concrete team work and keeps PDMO on the mentor side", async () => {
  const ui = await readFile(uiUrl, "utf8");

  for (const copy of [
    "商量团队计划",
    "你不是某一个字母角色",
    "四个人面对同一个问题",
    "谁先做、谁帮忙、何时交、看什么结果",
    "四类导师支援 · 不是学员角色",
  ]) assert.match(ui, new RegExp(copy));

  assert.doesNotMatch(ui, /PDMO OPTIONAL/);
  assert.doesNotMatch(ui, /pdmoRole/);
  assert.doesNotMatch(ui, /supportCommitment/);
  assert.doesNotMatch(ui, /P同学|P／D／M／O四个学员席位/);
});

test("current course documentation preserves the four-mentor five-step truth", async () => {
  const semantics = await readFile(semanticsUrl, "utf8");
  const facilitator = await readFile(facilitatorUrl, "utf8");

  for (const copy of [
    "四类导师分工",
    "找真问题",
    "定真方案",
    "做真产品",
    "进真市场",
    "跑真运营",
    "Demo Day 是独立终局",
    "F 有来源",
    "R 课堂模拟",
    "G 我们猜的",
    "U 还不知道",
  ]) assert.match(semantics, new RegExp(copy));

  assert.match(facilitator, /四导师、五步骤、六分钟/);
  assert.match(facilitator, /不要求学员认领 P／D／M／O/);
  assert.doesNotMatch(facilitator, /四角色、五任务|7段式|七段式/);
});
