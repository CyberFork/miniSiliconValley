import assert from "node:assert/strict";
import test from "node:test";

import { buildFactoryChecklist, exactPreviewHref, type FactoryChecklistInput } from "../app/lib/classroom-factory-readiness";

const course = { name: "AI 创业课", ref: { courseId: "ai/course 1", revision: 3, digest: "d".repeat(64) }, candidate: true, released: false };
const view = { receiptId: "view-1", valid: true, invalidReasons: [] as string[] };
const ui = { receiptId: "ui-1", valid: true, invalidReasons: [] as string[] };

function input(overrides: Partial<FactoryChecklistInput> = {}): FactoryChecklistInput {
  return {
    environment: "test", title: "课堂", course, viewReceipt: view, uiReceipt: null,
    coursewareRefs: [{ mentorRole: "P" }, { mentorRole: "D" }, { mentorRole: "M" }, { mentorRole: "O" }],
    mentorIds: ["p", "d", "m", "o"], learnerIds: ["l1", "l2"], learnerCount: 2,
    adminId: "admin", adminLockedToCreator: true, ...overrides,
  };
}
function item(result: ReturnType<typeof buildFactoryChecklist>, id: string) { return result.items.find((entry) => entry.id === id)!; }

test("no course and requested exact preview are reported", () => {
  const result = buildFactoryChecklist(input({ course: null, requestedRef: { courseId: "x y", revision: 2, digest: "z" } }));
  assert.equal(result.ready, false); assert.equal(result.firstIssueId, "course");
  assert.match(item(result, "course").message, /指定版本 x y/);
  assert.match(item(result, "view").actionHref!, /course=x\+y/);
  assert.equal(item(result, "learners").ready, false);
  assert.match(item(result, "learners").message, /先选择课程/);
});

test("missing or invalid View receipt exposes concrete reasons", () => {
  assert.match(item(buildFactoryChecklist(input({ viewReceipt: null })), "view").message, /还没有有效/);
  assert.match(item(buildFactoryChecklist(input({ viewReceipt: { receiptId: "v", valid: false, invalidReasons: ["digest 变化", "角色缺失"] } })), "view").message, /digest 变化；角色缺失/);
});

test("production requires Released course and UI receipt", () => {
  const notReleased = buildFactoryChecklist(input({ environment: "production" }));
  assert.match(item(notReleased, "course").message, /仍是 Candidate/);
  const missingUi = buildFactoryChecklist(input({ environment: "production", course: { ...course, released: true }, uiReceipt: null }));
  assert.equal(item(missingUi, "ui").ready, false);
});

test("current mentor courseware availability is independent from the selected script version and UI receipt", () => {
  assert.match(item(buildFactoryChecklist(input({ coursewareRefs: [{ mentorRole: "P" }] })), "courseware").message, /D／M／O/);
  const ready = item(buildFactoryChecklist(input({ environment: "production", course: { ...course, released: true }, uiReceipt: ui })), "courseware");
  assert.equal(ready.ready, true);
  assert.match(ready.message, /最新发布版/);
});

test("mentor and learner omissions or duplicates are blocked", () => {
  assert.match(item(buildFactoryChecklist(input({ mentorIds: ["p", "", "m", "o"] })), "mentors").message, /D/);
  assert.match(item(buildFactoryChecklist(input({ mentorIds: ["same", "same", "m", "o"] })), "mentors").message, /1 个重复/);
  assert.match(item(buildFactoryChecklist(input({ learnerIds: ["l1"] })), "learners").message, /还缺 1/);
  assert.match(item(buildFactoryChecklist(input({ learnerIds: ["l1", "l1"] })), "learners").message, /1 个重复/);
});

test("Admin lock, and fully ready Test/Production checklists", () => {
  assert.match(item(buildFactoryChecklist(input({ adminId: "" })), "admin").message, /请选择/);
  assert.equal(buildFactoryChecklist(input()).ready, true);
  assert.equal(buildFactoryChecklist(input({ environment: "production", course: { ...course, released: true }, uiReceipt: ui })).ready, true);
});

test("exactPreviewHref preserves exact encoded query", () => {
  assert.equal(exactPreviewHref({ courseId: "a/b? c", revision: 4, digest: "x+y" }), "/studio/preview/?course=a%2Fb%3F+c&revision=4&digest=x%2By");
  assert.equal(exactPreviewHref({ courseId: "a", revision: 1 }), "/studio/preview/?course=a&revision=1");
});
