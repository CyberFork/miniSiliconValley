import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateCoursePackage } from "../app/lib/course-package";
import {
  buildStudioProjection,
  declaredCoursewareBindingIssues,
  privateDeckForBlock,
  validateCourseInstantiation,
} from "../app/lib/course-platform";

const candidatePath = new URL("../tools/live-run/courses/candidates/eleme-2008-product-development-t090.json", import.meta.url);
const t091Path = new URL("../tools/live-run/courses/candidates/eleme-2008-product-mentor-t091.json", import.meta.url);
const manifestPath = new URL("../public/courseware/development-mentor-ligun/SOURCE-MANIFEST.json", import.meta.url);

function candidate() {
  return validateCoursePackage(JSON.parse(readFileSync(candidatePath, "utf8")) as unknown);
}

function exactBindings() {
  const value = candidate();
  const declared = new Map(value.contentPackages!.scriptPackages.map((item) => [item.ownerMentorRole, item.coursewareRef]));
  return (["P", "D", "M", "O"] as const).map((mentorRole) => declared.get(mentorRole) ?? {
    mentorRole,
    packageId: `cw-${mentorRole.toLowerCase()}-fixture`,
    slug: `${mentorRole.toLowerCase()}-fixture`,
    revision: 0,
    digest: mentorRole.toLowerCase().repeat(64).slice(0, 64),
  });
}

test("T-090 composes P history with a source-free D simulation without rewriting T-091", () => {
  const value = candidate();
  const baseline = validateCoursePackage(JSON.parse(readFileSync(t091Path, "utf8")) as unknown);
  const [history, simulation] = value.contentPackages!.casePackages;

  assert.equal(baseline.contentPackages!.casePackages[0].caseType, "historical");
  assert.equal(history.caseType, "historical");
  assert.equal(history.caseId, value.course.id);
  assert.ok(history.sourceIds.length > 0);
  assert.ok(history.factCardIds.length > 0);
  assert.deepEqual({ caseType: simulation.caseType, caseId: simulation.caseId, owner: simulation.ownerMentorRole }, {
    caseType: "simulation", caseId: "device-booking-incident", owner: "D",
  });
  assert.deepEqual(simulation.sourceIds, []);
  assert.deepEqual(simulation.factCardIds, []);
  assert.match(simulation.scope, /纯课堂模拟/);
});

test("the D incident deck has twelve short R cards in the required 3/3/2/2/2 categories", () => {
  const value = candidate();
  const deck = value.decks.find((item) => item.id === "device-booking-incident-private-evidence")!;
  assert.equal(deck.cards.length, 12);
  assert.ok(deck.cards.every((card) => card.boundary === "R" && card.sourceIds.length === 0 && card.body.startsWith("课堂模拟：")));
  const counts = Object.fromEntries(["user-scene", "system-data", "business-rule", "test-record", "boundary-unknown"]
    .map((category) => [category, deck.cards.filter((card) => card.simulationCategory === category).length]));
  assert.deepEqual(counts, {
    "user-scene": 3,
    "system-data": 3,
    "business-rule": 2,
    "test-record": 2,
    "boundary-unknown": 2,
  });
  assert.ok(deck.cards.every((card) => card.body.length < 100 && card.sharePrompt.length < 80), "one card must carry one concise clue and one action");
});

test("D owns four stable checkpoints and an exact 18-slide courseware binding", () => {
  const value = candidate();
  const script = value.contentPackages!.scriptPackages.find((item) => item.ownerMentorRole === "D")!;
  assert.deepEqual(script.checkpoints.map((item) => item.id), [
    "d-a-system-failure", "d-b-establish-main-stick", "d-c-split-and-test", "d-d-incident-and-correction",
  ]);
  assert.deepEqual(script.checkpoints.flatMap((item) => item.blockIds), ["B05", "B06", "B07", "B08"]);
  assert.deepEqual(script.checkpoints.map((item) => [item.coursewareCue.slideStart, item.coursewareCue.slideEnd]), [[1, 5], [6, 10], [11, 15], [16, 18]]);
  assert.ok(script.checkpoints.every((item) => item.privateDeckIds[0] === "device-booking-incident-private-evidence"));
  assert.deepEqual(script.coursewareRef, {
    mentorRole: "D",
    packageId: "cw-development-mentor-ligun",
    slug: "development-mentor-ligun",
    revision: 0,
    digest: "cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d",
  });
  assert.doesNotMatch(JSON.stringify(script), /饿了么.*接口|饿了么.*日志|饿了么.*自动化测试/);
});

test("the frozen D courseware manifest binds the exact local 18-slide bytes", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    slideCount: number;
    contentTreeSha256: string;
    files: Array<{ path: string; sha256: string; bytes: number }>;
  };
  const root = new URL("../public/courseware/development-mentor-ligun/", import.meta.url);
  const canonical = manifest.files.map((item) => {
    const bytes = readFileSync(new URL(item.path, root));
    assert.equal(bytes.byteLength, item.bytes, item.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.path);
    return `${item.path}\0${item.sha256}\n`;
  }).join("");
  assert.equal(manifest.slideCount, 18);
  assert.equal(createHash("sha256").update(canonical).digest("hex"), manifest.contentTreeSha256);
  const registryCanonical = `static-bundle:/courseware/development-mentor-ligun/:t093:sha256:${manifest.contentTreeSha256}`;
  assert.equal(createHash("sha256").update(registryCanonical).digest("hex"), "cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d");
});

test("DevelopmentStick is a concrete ten-field D artifact handed to M at B09", () => {
  const value = candidate();
  const schema = value.contentPackages!.submissionSchemas.find((item) => item.id === "development-stick-v1")!;
  const script = value.contentPackages!.scriptPackages.find((item) => item.ownerMentorRole === "D")!;
  assert.equal(schema.kind, "development-stick");
  assert.equal(schema.ownerMentorRole, "D");
  assert.equal(schema.submitAtBlockId, "B08");
  assert.deepEqual(schema.fields.map((field) => field.id), [
    "current-situation", "user-task", "main-goal", "core-journey", "acceptance-criteria",
    "constraints", "sub-sticks", "micro-sticks", "tests", "correction-log",
  ]);
  assert.deepEqual(schema.fields.find((field) => field.id === "sub-sticks") && {
    minItems: schema.fields.find((field) => field.id === "sub-sticks")!.minItems,
    maxItems: schema.fields.find((field) => field.id === "sub-sticks")!.maxItems,
  }, { minItems: 2, maxItems: 3 });
  assert.equal(schema.fields.find((field) => field.id === "micro-sticks")!.minItems, 1);
  assert.equal(schema.fields.find((field) => field.id === "tests")!.minItems, 1);
  assert.deepEqual(script.handoff, {
    fromBlockId: "B08",
    availableAtBlockId: "B09",
    toMentorRole: "M",
    submissionSchemaId: "development-stick-v1",
    summary: "M 导师只读取 D 已验收的 DevelopmentStick，使用其中的用户任务、最小路径、验收标准和待验证信号进入市场验证；不继承 D 私密主持稿。",
  });
});

test("2, 4 and 6 learners receive persistent identity-free two-card views", () => {
  const value = candidate();
  assert.deepEqual(value.learnerPolicy, { defaultCount: 4, minCount: 2, maxCount: 6, cardsPerLearner: 2, dealPolicy: "unique-within-step" });
  for (const learnerCount of [2, 4, 6]) {
    assert.deepEqual(validateCourseInstantiation(value, learnerCount), { ok: true, issues: [] });
    const b05 = buildStudioProjection(value, { learnerCount, blockId: "B05", seed: "t090" });
    const b06 = buildStudioProjection(value, { learnerCount, blockId: "B06", seed: "t090" });
    assert.equal(b05.learnerViews.length, learnerCount);
    assert.ok(b05.learnerViews.every((view) => view.privateCards.length === 2 && view.privateDeckId === "device-booking-incident-private-evidence"));
    const dealt = b05.learnerViews.flatMap((view) => view.privateCards.map((card) => card.id));
    assert.equal(new Set(dealt).size, learnerCount * 2);
    assert.deepEqual(b06.learnerViews.map((view) => view.privateCards.map((card) => card.id)), b05.learnerViews.map((view) => view.privateCards.map((card) => card.id)));
    assert.ok(b05.learnerViews.every((view) => !/\b[PDMO]\b/.test(`${view.badge} ${view.task}`)));
  }
  assert.equal(validateCourseInstantiation(value, 7).issues[0]?.code, "LEARNER_COUNT_OUT_OF_RANGE");
  assert.equal(privateDeckForBlock(value, value.blocks[4]).id, "device-booking-incident-private-evidence");
});

test("T-090 validation fails closed across source, ownership, schema and exact-courseware boundaries", () => {
  const base = candidate();

  const simulatedSource = structuredClone(base);
  simulatedSource.contentPackages!.casePackages[1].sourceIds = [base.sources[0].id];
  assert.throws(() => validateCoursePackage(simulatedSource), /课堂模拟.*必须为空/);

  const simulatedFact = structuredClone(base);
  simulatedFact.contentPackages!.casePackages[1].factCardIds = [base.contentPackages!.casePackages[0].factCardIds[0]];
  assert.throws(() => validateCoursePackage(simulatedFact), /课堂模拟.*必须为空/);

  const contaminatedSimulationDeck = structuredClone(base);
  const simulatedDeck = contaminatedSimulationDeck.decks.find((item) => item.id === "device-booking-incident-private-evidence")!;
  delete simulatedDeck.cards[0].simulationCategory;
  simulatedDeck.cards[0].boundary = "G";
  assert.throws(
    () => validateCoursePackage(contaminatedSimulationDeck),
    /模拟卡组 device-booking-incident-private-evidence 只能包含无来源的 R 课堂模拟卡/,
  );

  const sourcedSimulationDeck = structuredClone(base);
  const sourcedCard = sourcedSimulationDeck.decks.find((item) => item.id === "device-booking-incident-private-evidence")!.cards[0];
  delete sourcedCard.simulationCategory;
  sourcedCard.sourceIds = [base.sources[0].id];
  assert.throws(
    () => validateCoursePackage(sourcedSimulationDeck),
    /模拟卡组 device-booking-incident-private-evidence 只能包含无来源的 R 课堂模拟卡/,
  );

  const missingHistory = structuredClone(base);
  missingHistory.contentPackages!.casePackages[0].factCardIds = [];
  assert.throws(() => validateCoursePackage(missingHistory), /factCardIds 不能为空/);

  const badOwner = structuredClone(base);
  badOwner.contentPackages!.scriptPackages[1].ownerMentorRole = "M";
  assert.throws(() => validateCoursePackage(badOwner), /ownerMentorRole 必须与 CasePackage/);

  const duplicateBlockArtifact = structuredClone(base);
  duplicateBlockArtifact.contentPackages!.submissionSchemas[1].submitAtBlockId = "B04";
  assert.throws(() => validateCoursePackage(duplicateBlockArtifact), /每个 Block 只能有一个/);

  const multiDeckCheckpoint = structuredClone(base);
  multiDeckCheckpoint.contentPackages!.scriptPackages[1].checkpoints[0].privateDeckIds.push(base.decks[0].id);
  assert.throws(() => validateCoursePackage(multiDeckCheckpoint), /只能声明一个/);

  const bindings = exactBindings();
  assert.deepEqual(declaredCoursewareBindingIssues(base, bindings), []);
  const wrongDigest = bindings.map((item) => item.mentorRole === "D" ? { ...item, digest: "0".repeat(64) } : item);
  assert.match(declaredCoursewareBindingIssues(base, wrongDigest).join("\n"), /开发立棍.*必须绑定/);
});
