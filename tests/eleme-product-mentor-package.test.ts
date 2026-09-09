import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  bundledCoursePackages,
  coursePackageDigest,
  validateCoursePackage,
} from "../app/lib/course-package";
import {
  buildStudioProjection,
  declaredCoursewareBindingIssues,
} from "../app/lib/course-platform";

const candidatePath = new URL("../tools/live-run/courses/candidates/eleme-2008-product-mentor-t091.json", import.meta.url);
const inventoryPath = new URL("../docs/ELEME_T091_CONTENT_INVENTORY.json", import.meta.url);

function candidate() {
  return validateCoursePackage(JSON.parse(readFileSync(candidatePath, "utf8")) as unknown);
}

test("T-091 keeps immutable bundled r0 intact and adds an importable Candidate", async () => {
  const bundled = bundledCoursePackages().find((course) => course.course.id === "eleme-2008-find-problem");
  assert.ok(bundled);
  assert.equal(await coursePackageDigest(bundled), "407a24b43ead68ddccf0871fe7910ae21f1ca64ec4b7232a2bc0afeb2cfecb6c");
  assert.equal(bundled.contentPackages, undefined);

  const value = candidate();
  assert.equal(value.course.id, bundled.course.id);
  assert.notEqual(await coursePackageDigest(value), await coursePackageDigest(bundled));
  assert.equal(value.course.completeFiveStep, true);
  assert.deepEqual(value.blocks.map((block) => block.id), Array.from({ length: 13 }, (_, index) => `B${String(index + 1).padStart(2, "0")}`));
});

test("Ele.me CasePackage and historical ScriptPackage have one explicit P owner", () => {
  const value = candidate();
  const packages = value.contentPackages!;
  assert.equal(packages.casePackages.length, 1);
  assert.equal(packages.scriptPackages.length, 1);
  assert.equal(packages.casePackages[0].ownerMentorRole, "P");
  assert.equal(packages.scriptPackages[0].ownerMentorRole, "P");
  assert.deepEqual(packages.scriptPackages[0].checkpoints.map((item) => item.id), [
    "p-a-enter-2008",
    "p-b-find-real-problem",
    "p-c-rebuild-early-mvp",
    "p-d-transfer-project",
  ]);
  assert.deepEqual(packages.scriptPackages[0].checkpoints.flatMap((item) => item.blockIds), ["B01", "B02", "B03", "B04"]);
  assert.equal(packages.scriptPackages[0].checkpoints.some((item) => item.coursewareCue.slideStart <= 21 && item.coursewareCue.slideEnd >= 21), false);
  assert.ok(packages.reviewQueue.some((item) => item.id === "review-p-courseware-slide-21-app" && item.status === "open"));
});

test("all F cards are enumerated by the evidence revision and R/G/U copy keeps its boundary", () => {
  const value = candidate();
  const cards = value.decks.flatMap((deck) => deck.cards);
  const facts = cards.filter((card) => card.boundary === "F");
  assert.deepEqual(new Set(value.contentPackages!.casePackages[0].factCardIds), new Set(facts.map((card) => card.id)));
  assert.ok(facts.every((card) => card.sourceIds.length > 0));
  assert.ok(cards.filter((card) => card.boundary === "R").every((card) => card.body.startsWith("课堂模拟：")));
  assert.ok(cards.filter((card) => card.boundary === "G").every((card) => card.body.startsWith("团队推测：")));
  assert.ok(cards.filter((card) => card.boundary === "U").every((card) => card.body.startsWith("当前未知：")));
});

test("T-091 validator rejects incomplete or mis-owned content packages", () => {
  const base = candidate();
  const fact = base.decks.flatMap((deck) => deck.cards).find((card) => card.boundary === "F");
  assert.ok(fact);
  const missingFact = structuredClone(base);
  missingFact.contentPackages!.casePackages[0].factCardIds = missingFact.contentPackages!.casePackages[0].factCardIds.filter((id) => id !== fact.id);
  assert.throws(() => validateCoursePackage(missingFact), /未归档 F 卡/);

  const badCaseOwner = structuredClone(base);
  badCaseOwner.contentPackages!.casePackages[0].ownerMentorRole = "D";
  assert.throws(() => validateCoursePackage(badCaseOwner), /ownerMentorRole 必须与 CasePackage/);
  const badScriptOwner = structuredClone(base);
  badScriptOwner.contentPackages!.scriptPackages[0].ownerMentorRole = "D";
  assert.throws(() => validateCoursePackage(badScriptOwner), /ownerMentorRole 必须与 CasePackage/);
});

test("T-091 validator rejects invalid handoffs and duplicate schema kinds", () => {
  const base = candidate();
  const sameOwner = structuredClone(base);
  sameOwner.contentPackages!.scriptPackages[0].handoff!.toMentorRole = "P";
  assert.throws(() => validateCoursePackage(sameOwner), /handoff/);

  const nonLaterBlock = structuredClone(base);
  nonLaterBlock.contentPackages!.scriptPackages[0].handoff!.availableAtBlockId = "B04";
  assert.throws(() => validateCoursePackage(nonLaterBlock), /handoff/);

  const wrongSchemaBlock = structuredClone(base);
  wrongSchemaBlock.contentPackages!.scriptPackages[0].handoff!.fromBlockId = "B03";
  assert.throws(() => validateCoursePackage(wrongSchemaBlock), /handoff/);

  const duplicateKind = structuredClone(base);
  duplicateKind.contentPackages!.submissionSchemas.push({
    ...structuredClone(duplicateKind.contentPackages!.submissionSchemas[0]),
    id: "another-product-brief",
  });
  assert.throws(() => validateCoursePackage(duplicateKind), /kind 重复/);
});

test("ProductBrief is a concrete 10-field P-owned artifact handed to D at B05", () => {
  const value = candidate();
  const schema = value.contentPackages!.submissionSchemas[0];
  const script = value.contentPackages!.scriptPackages[0];
  assert.equal(schema.id, "product-brief-v1");
  assert.equal(schema.kind, "product-brief");
  assert.equal(schema.ownerMentorRole, "P");
  assert.equal(schema.submitAtBlockId, "B04");
  assert.equal(schema.fields.length, 10);
  assert.deepEqual(schema.fields.map((field) => field.id), [
    "target-user", "user-task", "observed-problem", "facts-and-sources", "assumptions",
    "unknowns", "value-hypothesis", "core-journey", "mvp-hypothesis", "boundaries",
  ]);
  assert.deepEqual(script.handoff, {
    fromBlockId: "B04",
    availableAtBlockId: "B05",
    toMentorRole: "D",
    submissionSchemaId: "product-brief-v1",
    summary: "D 导师只读取 P 已验收的 ProductBrief 作为开发上游输入；不重新拥有或讲解饿了么历史调查。",
  });
});

test("only the active mentor receives the current private script; D/M/O do not inherit P history", () => {
  const value = candidate();
  const b01 = buildStudioProjection(value, { learnerCount: 4, blockId: "B01", seed: "t091" });
  const pAtB01 = b01.mentorViews.find((view) => view.mentorRole === "P")!;
  assert.ok(pAtB01.privateScript.length > 0);
  assert.equal(pAtB01.contentContext.mode, "owner");
  for (const role of ["D", "M", "O"] as const) {
    const view = b01.mentorViews.find((item) => item.mentorRole === role)!;
    assert.deepEqual(view.privateScript, []);
    assert.equal(view.contentContext.mode, "none");
  }

  const b05 = buildStudioProjection(value, { learnerCount: 4, blockId: "B05", seed: "t091" });
  assert.equal(b05.mentorViews.find((view) => view.mentorRole === "P")!.privateScript.length, 0);
  const dAtB05 = b05.mentorViews.find((view) => view.mentorRole === "D")!;
  assert.ok(dAtB05.privateScript.length > 0);
  assert.equal(dAtB05.contentContext.mode, "handoff");
});

test("declared P courseware exact ref fails closed without affecting other mentor toolkits", () => {
  const value = candidate();
  const expected = value.contentPackages!.scriptPackages[0].coursewareRef;
  const bindings = [
    expected,
    { mentorRole: "D" as const, packageId: "cw-d", slug: "d", revision: 9, digest: "a".repeat(64) },
    { mentorRole: "M" as const, packageId: "cw-m", slug: "m", revision: 9, digest: "b".repeat(64) },
    { mentorRole: "O" as const, packageId: "cw-o", slug: "o", revision: 9, digest: "c".repeat(64) },
  ];
  assert.deepEqual(declaredCoursewareBindingIssues(value, bindings), []);
  assert.match(declaredCoursewareBindingIssues(value, bindings.map((item) => item.mentorRole === "P" ? { ...item, digest: "0".repeat(64) } : item))[0], /必须绑定/);
});

test("T-091 machine inventory remains aligned with the auditable Candidate", () => {
  const value = candidate();
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
    courseTruth: { candidate: { courseId: string; caseType: string; ownerMentorRole: string; blocks: string[] } };
    pCourseware: { runtimeExactRef: { packageId: string; slug: string; revision: number; digest: string }; checkpoints: Array<{ id: string; blocks: string[]; slides: number[] }> };
    evidence: { revision: string; cardCounts: Record<string, number>; factCardIds: string[] };
    productBrief: { schemaId: string; fields: string[] };
    openReviewQueue: string[];
  };
  const packages = value.contentPackages!;
  const casePackage = packages.casePackages[0];
  const scriptPackage = packages.scriptPackages[0];
  const schema = packages.submissionSchemas[0];
  const cards = value.decks.flatMap((deck) => deck.cards);
  assert.deepEqual(inventory.courseTruth.candidate, {
    courseId: value.course.id,
    status: "importable Candidate, not Released",
    path: "tools/live-run/courses/candidates/eleme-2008-product-mentor-t091.json",
    casePackageId: casePackage.id,
    caseType: casePackage.caseType,
    scriptPackageId: scriptPackage.id,
    ownerMentorRole: scriptPackage.ownerMentorRole,
    blocks: scriptPackage.checkpoints.flatMap((checkpoint) => checkpoint.blockIds),
    action: "edit/review here; persist through Studio Candidate workflow",
  });
  assert.deepEqual(inventory.pCourseware.runtimeExactRef, scriptPackage.coursewareRef);
  assert.deepEqual(inventory.pCourseware.checkpoints, scriptPackage.checkpoints.map((checkpoint) => ({
    id: checkpoint.id,
    blocks: checkpoint.blockIds,
    slides: [checkpoint.coursewareCue.slideStart, checkpoint.coursewareCue.slideEnd],
  })));
  assert.equal(inventory.evidence.revision, casePackage.evidenceRevision);
  assert.deepEqual(new Set(inventory.evidence.factCardIds), new Set(casePackage.factCardIds));
  assert.deepEqual(inventory.evidence.cardCounts, {
    total: cards.length,
    F: cards.filter((card) => card.boundary === "F").length,
    R: cards.filter((card) => card.boundary === "R").length,
    G: cards.filter((card) => card.boundary === "G").length,
    U: cards.filter((card) => card.boundary === "U").length,
  });
  assert.deepEqual({ schemaId: inventory.productBrief.schemaId, fields: inventory.productBrief.fields }, {
    schemaId: schema.id,
    fields: schema.fields.map((field) => field.id),
  });
  assert.deepEqual(new Set(inventory.openReviewQueue), new Set(packages.reviewQueue.map((item) => item.id)));
});
