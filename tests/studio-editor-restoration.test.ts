import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { bundledCoursePackages } from "../app/lib/course-package";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("the full direct-edit Course Studio replaces the regressed summary-card editor", () => {
  const html = source("app/studio/editor/workbench.html");
  for (const marker of [
    "课程编排工作台", "COURSE LIBRARY", "全课程时序轴", "多角色直改",
    "高级结构", "抽卡内容", "JSON 源码", "课程中控视窗", "版本历史",
    "保存整门课程", "VISIBLE ELEMENT → UNIQUE SOURCE PATH",
  ]) assert.match(html, new RegExp(marker), `missing restored editor marker: ${marker}`);
  assert.match(html, /id="courseTimeline"/);
  assert.match(html, /id="seatPreviewGrid"/);
  assert.match(html, /id="previewController"/);
  assert.match(html, /id="fieldDialog"/);
  assert.doesNotMatch(html, /<script[^>]+src="[^"]*\/studio\/editor-assets\/(?:ui-theme|card-view|course-projection-core|course-preview|editor)\.js[^"]*"/);

  const page = source("app/studio/editor/page.tsx");
  assert.match(page, /workbench\.html\?raw/);
  assert.match(page, /editor-assets\/editor-loader\.js/);
  assert.doesNotMatch(page, /\/studio\/editor-assets\/(?:ui-theme|card-view|course-projection-core|course-preview|editor)\.js/);
  assert.match(page, /dangerouslySetInnerHTML/);
});

test("editor-loader script ordering and failure surface are explicit and deterministic", () => {
  const loader = source("public/studio/editor-assets/editor-loader.js");
  const phaseOrder = ["ui-theme.js", "card-view.js", "course-projection-core.js", "course-preview.js", "editor.js"];
  const positions = phaseOrder.map((name) => loader.indexOf(name));
  assert.ok(positions.every((index) => index >= 0), "editor loader is missing one or more ordered dependencies");
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], `loader order must be ${phaseOrder.join(" -> ")}`);
  }
  assert.match(loader, /error|catch|Promise\.allSettled|Promise\.all|finally/i);
  assert.match(loader, /status|indicator|feedback|toast|banner|notice|aria-live/i);
});

test("the restored editor speaks only to the versioned Studio API", () => {
  const js = source("public/studio/editor-assets/editor.js");
  for (const endpoint of ["/api/studio/bootstrap", "/api/studio/validate", "/api/studio/candidates"]) {
    assert.match(js, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(js, /api\/courses|api\/state|api\/control|X-Live-Run-Token|\/control\/editor/);
  assert.match(js, /data-course-path/);
  assert.match(js, /openFieldEditor/);
  assert.match(js, /undoStack/);
  assert.match(js, /restoredFrom/);
  assert.match(js, /window\.location\.assign\("\/studio\/releases\/"\)/);
  assert.match(js, /exactViewReceipt/);
  assert.match(js, /exactUiReceipt/);
  assert.match(js, /前往多角色视图验收/);
  assert.doesNotMatch(js, /studioData\.receipts/);

  const route = source("app/api/studio/validate/route.ts");
  assert.match(route, /requireStudioRole\(user\)/);
  assert.match(route, /migrateCourseFieldIsolation\(raw\.course/);
  assert.match(route, /validateCoursePackage\(migration\.course\)/);
  assert.match(route, /coursePackageDigest/);
  assert.doesNotMatch(route, /saveCourseCandidate/);
});

test("T-094 editor surfaces immutable data identity and does not fabricate it for a Working Copy", () => {
  const js = source("public/studio/editor-assets/editor.js");
  assert.match(js, /function exactCourseDataId/);
  assert.match(js, /\$\{course\.course\.id\}@r\$\{Number\(meta\.revision\)\}:\$\{meta\.digest\}/);
  assert.match(js, /未保存 Working Copy；没有不可变数据 ID/);
  assert.match(js, /courseDataId/);
  assert.match(js, /Working Copy 只在浏览器中变化，不会静默热更新任何课堂/);
});

test("the browser projector renders the same full editor for 4 mentors plus dynamic N learners", () => {
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source("public/studio/editor-assets/card-view.js"), context);
  vm.runInNewContext(source("public/studio/editor-assets/course-projection-core.js"), context);
  vm.runInNewContext(source("public/studio/editor-assets/course-preview.js"), context);
  const preview = context.MsvCoursePreview as {
    projectCourse: (course: unknown, options: Record<string, unknown>) => {
      seats: Array<{ id: string; taskPath: string; cards: unknown[] }>;
      learners: Array<{ id: string; taskPath: string; cards: unknown[] }>;
      mentors: unknown[];
      deal: { dealtCount: number; uniqueCount: number };
      capacity: { ok: boolean; issues: Array<{ message: string }> };
    };
  };
  assert.ok(preview);

  const course = structuredClone(bundledCoursePackages()[0]);
  course.learnerPolicy = { defaultCount: 4, minCount: 2, maxCount: 6, cardsPerLearner: 3, dealPolicy: "unique-within-step" };
  for (const block of course.blocks) block.learnerTaskTemplate = { badge: "Young Builder", task: block.studentPrompt };
  for (const [deckIndex, deck] of course.decks.entries()) {
    while (deck.cards.length < 18) {
      const copy = structuredClone(deck.cards[deck.cards.length % 12]);
      copy.id = `${course.course.id}-editor-${deckIndex}-${deck.cards.length + 1}`;
      deck.cards.push(copy);
    }
  }

  const projected = preview.projectCourse(course, { blockIndex: 0, seed: "editor-regression", learnerCount: 6, status: "ready" });
  assert.equal(projected.mentors.length, 4);
  assert.equal(projected.learners.length, 6);
  assert.equal(projected.seats.length, 10);
  assert.equal(projected.learners[4].id, "learner05");
  assert.equal(projected.learners[4].taskPath, "blocks.0.learnerTaskTemplate.task");
  assert.equal(projected.deal.dealtCount, 18);
  assert.equal(projected.deal.uniqueCount, 18);
  const invalid = preview.projectCourse(course, { blockIndex: 0, seed: "editor-regression", learnerCount: 24, status: "ready" });
  assert.equal(invalid.learners.length, 24, "an invalid authoring scenario must not be silently clipped");
  assert.equal(invalid.capacity.ok, false);
  assert.match(invalid.capacity.issues[0].message, /当前选择 24 名/);
});

test("desktop editor CSS preserves the old three-column workbench and responsive no-overlap fallbacks", () => {
  const css = source("public/studio/editor-assets/editor.css");
  assert.match(css, /\.studio\{[^}]*grid-template-columns:minmax\(230px,270px\) minmax\(0,1fr\) minmax\(230px,280px\)/);
  assert.match(css, /@media\(max-width:1040px\)[^{]*\{[^}]*\.studio/);
  assert.match(css, /@container course-workspace \(max-width:720px\)/);
  assert.match(css, /\.seat-preview-grid\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.card-studio\{[^}]*grid-template-columns:minmax\(240px,285px\) minmax\(0,1fr\)/);
});
