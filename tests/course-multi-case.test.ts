import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateCoursePackage } from "../app/lib/course-package";

const fixturePath = new URL("../tools/live-run/courses/candidates/eleme-2008-product-development-t090.json", import.meta.url);

function multiCaseCourse() {
  const course = JSON.parse(readFileSync(fixturePath, "utf8"));
  course.course.id = "ai-entrepreneurship-evidence-lab";
  course.course.name = "AI 创业实践｜从真实问题到可验证产品";
  course.course.period = "1998—2030 · 多案例教学跨度";
  course.title = `Mini Silicon Valley｜${course.course.name}｜CourseDefinition`;

  const historical = course.contentPackages.casePackages[0];
  const cards = new Map<string, { sourceIds: string[] }>(
    course.decks.flatMap((deck: { cards: Array<{ id: string; sourceIds: string[] }> }) =>
      deck.cards.map((card): [string, { sourceIds: string[] }] => [card.id, card])),
  );
  const splitAt = Math.ceil(historical.factCardIds.length / 2);
  const firstFactIds = historical.factCardIds.slice(0, splitAt);
  const secondFactIds = historical.factCardIds.slice(splitAt);
  const sourcesFor = (cardIds: string[]) => [...new Set(cardIds.flatMap((id) => cards.get(id)?.sourceIds ?? []))];
  historical.caseId = "eleme-campus-ordering-2008";
  historical.title = "校园电话订餐与人工配送";
  historical.period = "2008—2009";
  historical.factCardIds = firstFactIds;
  historical.sourceIds = sourcesFor(firstFactIds);
  const secondHistorical = {
    ...structuredClone(historical),
    id: "case-campus-service-comparison",
    caseId: "campus-service-comparison-2012",
    title: "校园服务流程对照案例",
    period: "2012",
    scope: "用于对照人工流程、统一入口与履约约束，不替代第一个案例。",
    sourceIds: sourcesFor(secondFactIds),
    factCardIds: secondFactIds,
  };
  course.contentPackages.casePackages.splice(1, 0, secondHistorical);
  course.case.campaignId = historical.caseId;
  course.case.name = historical.title;
  course.case.period = historical.period;
  course.fieldModel = undefined;
  return course;
}

test("one neutral course validates two historical cases and one source-free simulation", () => {
  const course = validateCoursePackage(multiCaseCourse());
  assert.equal(course.course.id, "ai-entrepreneurship-evidence-lab");
  assert.doesNotMatch(course.course.name, /饿了么|Google/);
  assert.deepEqual(course.contentPackages!.casePackages.map((item) => [item.caseType, item.caseId]), [
    ["historical", "eleme-campus-ordering-2008"],
    ["historical", "campus-service-comparison-2012"],
    ["simulation", "device-booking-incident"],
  ]);
  assert.equal(course.case.campaignId, "eleme-campus-ordering-2008");
  assert.notEqual(course.course.period, course.case.period);
});

test("multi-case ownership rejects duplicate identities, crossed facts and unknown default case", () => {
  const duplicate = multiCaseCourse();
  duplicate.contentPackages.casePackages[1].caseId = duplicate.contentPackages.casePackages[0].caseId;
  assert.throws(() => validateCoursePackage(duplicate), /caseId 重复/);

  const crossed = multiCaseCourse();
  const cardId = crossed.contentPackages.casePackages[0].factCardIds[0];
  crossed.contentPackages.casePackages[1].factCardIds.push(cardId);
  assert.throws(() => validateCoursePackage(crossed), /已由另一个 CasePackage 声明/);

  const unknownDefault = multiCaseCourse();
  unknownDefault.case.campaignId = "unknown-case";
  assert.throws(() => validateCoursePackage(unknownDefault), /必须指向.*casePackages/);
});

test("renaming the course does not rewrite case, cards, sources or stable course id", () => {
  const before = validateCoursePackage(multiCaseCourse());
  const after = structuredClone(before);
  after.course.name = "跨时代产品判断训练";
  after.title = `Mini Silicon Valley｜${after.course.name}｜CourseDefinition`;
  const validated = validateCoursePackage(after);
  assert.equal(validated.course.id, before.course.id);
  assert.deepEqual(validated.case, before.case);
  assert.deepEqual(validated.contentPackages!.casePackages, before.contentPackages!.casePackages);
  assert.deepEqual(validated.decks, before.decks);
  assert.deepEqual(validated.sources, before.sources);
});

test("Studio names courses by teaching theme and does not re-couple cloned cases", () => {
  const editor = readFileSync(new URL("../public/studio/editor-assets/editor.js", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../app/studio/editor/workbench.html", import.meta.url), "utf8");
  assert.match(editor, /默认案例 ID（兼容字段）/);
  assert.match(editor, /与课程 ID 独立/);
  assert.doesNotMatch(editor, /if \(path === "course\.period"\) course\.case\.period = value/);
  assert.doesNotMatch(editor, /cloned\.case\.campaignId = newId|cloned\.case\.name = newName/);
  assert.match(shell, /课程按教学主题命名，可以包含多个历史或模拟案例/);
  assert.match(shell, /写教学主题，不必使用公司或案例名/);
  assert.doesNotMatch(shell, /placeholder="案例名｜五步创业闭环"/);
});
