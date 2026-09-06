import test from "node:test";
import assert from "node:assert/strict";
import { parseClassroomAction, parseCreateRoom, parseJoinRoom } from "../app/lib/classroom-validation";
import { ClassroomError } from "../app/lib/classroom-errors";
import { normalizeTeamPublicId, validTeamPublicId } from "../app/lib/team-access";

const key = "request-1234";
const id = "team-1";
function rejects(value: unknown) { assert.throws(() => parseClassroomAction(value), ClassroomError); }
function action(type: string, fields: Record<string, unknown> = {}) { return parseClassroomAction({ type, ...fields }); }

test("normalizes text, enums, identifiers and public team IDs", () => {
  assert.deepEqual(action("set-nickname", { nickname: "  Ada\u0000 Lovelace  " }), { type: "set-nickname", nickname: "Ada Lovelace" });
  assert.deepEqual(action("move-phase", { direction: "next" }), { type: "move-phase", direction: "next" });
  assert.deepEqual(action("set-card-state", { cardId: "card:1", state: "published" }), { type: "set-card-state", cardId: "card:1", state: "published" });
  assert.deepEqual(parseCreateRoom({ title: "  Test room  " }), { title: "Test room", campaignId: "google-1995-2004" });
  assert.deepEqual(parseCreateRoom({ title: "饿了么调查", campaignId: "eleme-2008-find-problem" }), { title: "饿了么调查", campaignId: "eleme-2008-find-problem" });
  assert.deepEqual(parseJoinRoom({ teamPublicId: " team-abcd2345! " }), { teamPublicId: "TEAM-ABCD2345" });
});

test("normalizes shared team IDs once and rejects incomplete link parameters", () => {
  assert.equal(normalizeTeamPublicId(" team—mhknjeag "), "TEAM-MHKNJEAG");
  assert.equal(normalizeTeamPublicId("mhknjeag"), "TEAM-MHKNJEAG");
  assert.equal(validTeamPublicId("TEAM-MHKNJEAG"), "TEAM-MHKNJEAG");
  assert.equal(validTeamPublicId("team-mhknjeag"), "TEAM-MHKNJEAG");
  assert.equal(validTeamPublicId("TEAM-MHKNJEA"), null);
  assert.equal(validTeamPublicId(["TEAM-MHKNJEAG"]), null);
});

test("parses intelligence nodes and edges", () => {
  const node = action("create-intelligence-node", { kind: "need", title: "Need", explanation: "A useful need", sourceCardIds: ["c1", "c1"] });
  assert.equal(node.type, "create-intelligence-node");
  if (node.type !== "create-intelligence-node") throw new Error("unexpected action type");
  assert.deepEqual(node.sourceCardIds, ["c1"]);
  assert.equal(action("create-intelligence-edge", { fromNodeId: "n1", toNodeId: "n2", kind: "supports", explanation: "Evidence supports" }).type, "create-intelligence-edge");
  assert.equal(action("submit-problem-statement", { user: "校园研究者", sceneLoss: "找到可信页面需要反复翻页", evidenceSummary: "两张已发布卡和情报网支持这个判断", unknown: "尚不知道普通用户是否有同样损失", decisionQuestion: "是否先验证链接排序能降低查找时间" }).type, "submit-problem-statement");
});

test("parses challenge, six-question action, scoring and reputation", () => {
  assert.deepEqual(action("submit-challenge-action", { goal: "goal", method: "method", evidence: "evidence", resource: "x", successSignal: "yes", stopCondition: "stop" }).type, "submit-challenge-action");
  const scored = action("score-challenge", { teamId: id, rubric: { evidence: 1, logic: 0, execution: 1, collaboration: 1 }, consequence: "", idempotencyKey: key });
  assert.equal(scored.type, "score-challenge");
  if (scored.type !== "score-challenge") throw new Error("unexpected action type");
  assert.deepEqual(scored.rubric, { evidence: 1, logic: 0, execution: 1, collaboration: 1 });
  assert.deepEqual(action("award-reputation", { memberId: "m1", scores: { evidence: 2, modeling: 1, delivery: 3, support: 0, iteration: 2, responsibility: 1 }, evidenceObjectId: "ev1", reason: "clear reason" }).type, "award-reputation");
  assert.equal(action("submit-demo-day", { title: "Google世界线发布", segmentNotes: Array.from({ length: 6 }, (_, index) => `第${index + 1}段发布内容`) }).type, "submit-demo-day");
  assert.equal(action("submit-demo-day", { title: "旧版七段发布", segmentNotes: Array.from({ length: 7 }, (_, index) => `第${index + 1}段发布内容`) }).type, "submit-demo-day");
});

test("parses economy amounts, booleans and idempotency keys", () => {
  assert.equal(action("distribute-profit", { teamId: id, percent: 20, idempotencyKey: key }).type, "distribute-profit");
  assert.equal(action("vote-purchase", { proposalId: "p1", approve: false, idempotencyKey: key }).type, "vote-purchase");
  assert.equal(action("reinvest", { teamId: id, amountTenths: 100000, idempotencyKey: key }).type, "reinvest");
  assert.deepEqual(action("set-timer", { minutes: 180 }), { type: "set-timer", minutes: 180 });
  assert.deepEqual(action("toggle-pause", { paused: true }), { type: "toggle-pause", paused: true });
  assert.deepEqual(action("create-team", { name: "第二小队" }), { type: "create-team", name: "第二小队" });
  assert.deepEqual(action("decide-join-request", { requestId: "request:1", decision: "approve" }), { type: "decide-join-request", requestId: "request:1", decision: "approve" });
  assert.deepEqual(action("add-learner", { teamId: "team:1", profileId: "profile:1" }), { type: "add-learner", teamId: "team:1", profileId: "profile:1" });
  assert.deepEqual(action("remove-member", { memberId: "member:1" }), { type: "remove-member", memberId: "member:1" });
  assert.deepEqual(action("assign-facilitator", { username: "  MSV-Mentor-01  " }), { type: "assign-facilitator", username: "msv-mentor-01" });
  assert.deepEqual(action("remove-facilitator", { memberId: "member:dm-2" }), { type: "remove-facilitator", memberId: "member:dm-2" });
  assert.deepEqual(action("withdraw-card", { cardId: "card:1", memberId: "member:1" }), { type: "withdraw-card", cardId: "card:1", memberId: "member:1" });
  assert.deepEqual(action("grant-card", { cardId: "card:1", memberId: "member:1" }), { type: "grant-card", cardId: "card:1", memberId: "member:1" });
  assert.equal(action("record-financing", { teamId: id, amountTenths: 50, reason: "服务器额度附带稳定性报告", idempotencyKey: key }).type, "record-financing");
  assert.deepEqual(action("record-paper-ledger", { teamId: id, flow: "outflow", category: "research", amountTenths: 10, reason: "纸单P03断网调研支出", idempotencyKey: key }), { type: "record-paper-ledger", teamId: id, flow: "outflow", category: "research", amountTenths: 10, reason: "纸单P03断网调研支出", idempotencyKey: key });
  assert.equal(action("reverse-transaction", { transactionId: "transaction:1", reason: "纸账本录入到了错误的轮次", idempotencyKey: key }).type, "reverse-transaction");
});

test("rejects malformed, malicious, out-of-range and wrong JSON values", () => {
  for (const value of [null, [], "x", { type: "unknown" }, { type: "set-nickname", nickname: "a" }, { type: "move-phase", direction: "sideways" }, { type: "set-timer", minutes: 0 }, { type: "set-timer", minutes: 181 }, { type: "toggle-pause", paused: "true" }, { type: "assign-facilitator", username: "not an account" }, { type: "remove-facilitator", memberId: "bad id" }, { type: "withdraw-card", cardId: "bad id", memberId: "member:1" }, { type: "create-intelligence-node", kind: "need", title: "ok", explanation: "text", sourceCardIds: ["bad id"] }, { type: "submit-problem-statement", user: "x", sceneLoss: "loss", evidenceSummary: "evidence", unknown: "unknown", decisionQuestion: "question" }, { type: "distribute-profit", teamId: id, percent: 10, idempotencyKey: key }, { type: "reinvest", teamId: id, amountTenths: 0, idempotencyKey: key }, { type: "record-financing", teamId: id, amountTenths: 5, reason: "太短", idempotencyKey: key }, { type: "record-paper-ledger", teamId: id, flow: "sideways", category: "research", amountTenths: 10, reason: "纸单P03断网调研支出", idempotencyKey: key }, { type: "record-paper-ledger", teamId: id, flow: "outflow", category: "financing", amountTenths: 10, reason: "纸单P03断网调研支出", idempotencyKey: key }, { type: "reverse-transaction", transactionId: "transaction:1", reason: "太短", idempotencyKey: key }, { type: "vote-purchase", proposalId: "p", approve: "true", idempotencyKey: key }, { type: "score-challenge", teamId: id, rubric: { evidence: 2, logic: 0, execution: 0, collaboration: 0 }, consequence: "", idempotencyKey: "short" }, { type: "submit-reflection", answers: ["a"], realityAction: "valid action" }, { type: "submit-demo-day", title: "Demo", segmentNotes: ["only one"] }, { type: "submit-demo-day", title: "Demo", segmentNotes: Array.from({ length: 8 }, (_, index) => `第${index + 1}段`) }, { type: "set-nickname", nickname: "\u0001\u0002" }]) rejects(value);
  assert.throws(() => parseCreateRoom({ title: "x" }), ClassroomError);
  // Syntax is checked at the request boundary; Released-course existence is
  // checked against D1 by createClassroomRoom rather than a duplicated bundle.
  assert.deepEqual(parseCreateRoom({ title: "有效课堂", campaignId: "missing-campaign" }), { title: "有效课堂", campaignId: "missing-campaign" });
  assert.throws(() => parseJoinRoom({ teamPublicId: "ABC123" }), ClassroomError);
  assert.throws(() => parseJoinRoom({ teamPublicId: 123456 }), ClassroomError);
  assert.throws(() => parseJoinRoom({ code: "ABC123" }), ClassroomError);
});
