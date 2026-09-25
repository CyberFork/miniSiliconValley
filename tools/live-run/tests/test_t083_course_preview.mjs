import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const sandbox = {console};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const name of ["static/card-view.js", "static/course-preview.js"]) {
  vm.runInContext(readFileSync(new URL(name, root), "utf8"), sandbox, {filename: name});
}
const Preview = sandbox.MsvCoursePreview;
assert.ok(Preview, "shared preview renderer must load");
const snapshot = {};
for (const file of ["live-run-script.json", "live-run-script-eleme.json"]) {
  const course = JSON.parse(readFileSync(new URL(file, root), "utf8"));
  assert.equal(course.macroSteps.length, 5);
  assert.equal(course.blocks.length, 13);
  for (let blockIndex = 0; blockIndex < course.blocks.length; blockIndex += 1) {
    const options = {blockIndex, status: ["ready", "executing", "awaiting-acceptance", "error", "completed"][blockIndex % 5], seed: "T083-FIXED-SEED", revision: 7, digest: "d".repeat(64)};
    const first = Preview.projectCourse(course, options);
    const second = Preview.projectCourse(course, options);
    assert.equal(first.block.id, course.blocks[blockIndex].id);
    assert.equal(first.seats.length, 8);
    assert.equal(first.mentors.length, 4);
    assert.equal(first.learners.length, 4);
    assert.equal(first.mentors.filter((seat) => seat.subidentity === "本块由你主导").length, 1);
    assert.ok(first.seats.every((seat) => seat.blockId === first.block.id));
    const dealtIds = first.learners.flatMap((seat) => seat.cards.map((card) => card.id));
    assert.equal(dealtIds.length, 12);
    assert.equal(new Set(dealtIds).size, 12);
    assert.deepEqual(dealtIds, second.learners.flatMap((seat) => seat.cards.map((card) => card.id)));
    assert.ok(first.learners.every((seat) => !Object.hasOwn(seat, "account") && !Object.hasOwn(seat, "nickname") && !Object.hasOwn(seat, "submissions")));
    const seatHtml = first.seats.map((seat) => Preview.renderSeatSurface(seat, {editable: true})).join("");
    const controllerHtml = Preview.renderControllerSurface(first.controller, {editable: true});
    assert.ok(seatHtml.includes("编辑预览 · 非真实课堂"));
    assert.ok(seatHtml.includes("data-course-path="));
    assert.ok(seatHtml.includes("data-derived-explain="));
    assert.ok(controllerHtml.includes(`data-block-id="${first.block.id}"`));
    assert.ok(controllerHtml.includes(`${first.blockPath}.studentPrompt`));
    assert.ok(!seatHtml.includes("undefined"));
    snapshot[`${course.course.id}/${first.block.id}`] = {
      step: first.step.id,
      status: first.status,
      seats: first.seats.map((seat) => ({id: seat.id, kind: seat.kind, blockId: seat.blockId, cards: (seat.cards || []).map((card) => card.id)})),
      controllerBlock: first.controller.block.id,
    };
  }
  const seedA = Preview.projectCourse(course, {blockIndex: 0, seed: "A"}).learners.flatMap((seat) => seat.cards.map((card) => card.id));
  const seedB = Preview.projectCourse(course, {blockIndex: 0, seed: "B"}).learners.flatMap((seat) => seat.cards.map((card) => card.id));
  assert.notDeepEqual(seedA, seedB, "changing seed should produce a different deterministic deal");
}
assert.equal(Object.keys(snapshot).length, 26);
const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
console.log(JSON.stringify({ok: true, contracts: Object.keys(snapshot).length, digest, sharedRenderer: true, deterministicDeal: true, roleIsolation: true}, null, 2));
