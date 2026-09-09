import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateCoursePackage } from "../app/lib/course-package";
import { buildStudioProjection, validateCourseInstantiation } from "../app/lib/course-platform";
import { migrateCourseFieldIsolation, updateCourseFieldById, validateCourseFieldModel } from "../app/lib/course-field-model";

const source = JSON.parse(readFileSync(new URL("../tools/live-run/courses/candidates/eleme-2008-product-development-t090.json", import.meta.url), "utf8"));
const base = validateCoursePackage(source);
const migrated = migrateCourseFieldIsolation(base).course;

test("T-095 migration creates six stable, independent seat fields", () => {
  assert.equal(migrated.learnerPolicy?.maxCount, 6);
  validateCourseFieldModel(migrated, migrated.fieldModel!);
  for (const block of migrated.blocks) {
    const nodes = ["learner01", "learner02", "learner03", "learner04", "learner05", "learner06"].map((id) => block.seatTasks[id]);
    for (let i = 1; i < nodes.length; i += 1) assert.notEqual(nodes[i], nodes[0]);
    for (const id of ["learner01", "learner02", "learner03", "learner04", "learner05", "learner06"]) {
      const f = migrated.fieldModel!.fields.find((x) => x.path.endsWith(`seatTasks.${id}.task`) && x.blockId === block.id)!;
      assert.equal(f.ownerId, id); assert.equal(f.scope, "seat"); assert.match(f.path, /^blocks\.\d+\.seatTasks\.learner\d{2}\.task$/);
    }
  }
});

test("seat, mentor, card and explicit global aliases update in isolation", () => {
  const seat = migrated.fieldModel!.fields.find((x) => x.ownerId === "learner06" && x.fieldType === "task")!;
  const changed = updateCourseFieldById(migrated, seat.fieldId, "独立六号任务");
  assert.equal(changed.blocks[0].seatTasks.learner06.task, "独立六号任务");
  for (const id of ["learner01", "learner02", "learner03", "learner04", "learner05"]) assert.equal(changed.blocks[0].seatTasks[id].task, migrated.blocks[0].seatTasks[id].task);
  const p = migrated.fieldModel!.fields.find((x) => x.scope === "mentorRole" && x.ownerId === "mentor01" && x.fieldType === "task")!;
  const pChanged = updateCourseFieldById(migrated, p.fieldId, "P 专属");
  assert.notEqual(pChanged.blocks[0].seatTasks.mentor01.task, migrated.blocks[0].seatTasks.mentor01.task);
  assert.equal(pChanged.blocks[0].seatTasks.mentor02.task, migrated.blocks[0].seatTasks.mentor02.task);
  const card = migrated.fieldModel!.fields.find((x) => x.scope === "card" && x.fieldType === "body")!;
  const cardChanged = updateCourseFieldById(migrated, card.fieldId, "卡片独立正文");
  assert.equal(cardChanged.decks.flatMap((d) => d.cards).find((c) => c.id === card.ownerId)!.body, "卡片独立正文");
  const global = migrated.fieldModel!.fields.find((x) => x.path === "course.period")!;
  const globalChanged = updateCourseFieldById(migrated, global.fieldId, "新时间范围");
  assert.equal(globalChanged.course.period, "新时间范围"); assert.equal(globalChanged.case.period, "新时间范围");
});

test("six-to-four migration retains inactive seats and rejects malformed models", () => {
  const reduced = { ...migrated, learnerPolicy: { ...migrated.learnerPolicy!, maxCount: 4 } };
  const again = migrateCourseFieldIsolation(reduced).course;
  assert.equal(again.fieldModel!.studentSeats.find((x) => x.seatId === "learner06")!.status, "inactive");
  assert.ok(again.blocks.every((b) => b.seatTasks.learner06));
  assert.throws(() => validateCourseFieldModel(again, { ...again.fieldModel!, fields: again.fieldModel!.fields.map((x, i) => i ? x : { ...x, ownerId: "learner01" }) }));
  assert.throws(() => validateCourseFieldModel(again, { ...again.fieldModel!, fields: [...again.fieldModel!.fields, { ...again.fieldModel!.fields[0] }] }));
  assert.throws(() => validateCourseFieldModel(again, { ...again.fieldModel!, fields: again.fieldModel!.fields.map((x, i) => i ? x : { ...x, path: "course.nope" }) }));
});

test("2/4/6 projections and unique dealing satisfy learner policy", () => {
  for (const count of [2, 4, 6]) {
    assert.equal(validateCourseInstantiation(migrated, count).ok, true);
    const view = buildStudioProjection(migrated, { learnerCount: count, blockId: "B01", seed: `t095-${count}` });
    assert.equal(view.learnerViews.length, count);
    assert.equal(new Set(view.learnerViews.flatMap((x) => x.privateCards.map((c) => c.id))).size, count * migrated.learnerPolicy!.cardsPerLearner);
  }
});
