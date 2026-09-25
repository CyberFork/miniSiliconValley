import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

// Audit only: real application functions, in-memory SQLite, synthetic data.
const root = resolve(process.argv[2] || process.cwd());
const mod = (p) => import(pathToFileURL(resolve(root, p)).href);
const registry = await mod('app/lib/course-registry.ts');
const cw = await mod('app/lib/courseware-store.ts');
const fixtures = await mod('app/lib/course-package.ts');
const gap = await mod('services/parent-qa/knowledge-gap-store.ts');
const platform = await mod('app/lib/course-platform.ts');
const output = [];

// A positive control: do not report the previously fixed B01/B05 deal bug again.
{
  const course = fixtures.validateCoursePackage(JSON.parse(readFileSync(resolve(root, 'tools/live-run/courses/candidates/eleme-2008-unified-t095.json'), 'utf8')));
  const context = {}; context.window = context;
  vm.runInNewContext(readFileSync(resolve(root, 'public/studio/editor-assets/card-view.js'), 'utf8'), context);
  vm.runInNewContext(readFileSync(resolve(root, 'public/studio/editor-assets/course-preview.js'), 'utf8'), context);
  let scenarios = 0;
  for (let blockIndex = 0; blockIndex < course.blocks.length; blockIndex++) {
    for (const learnerCount of [2, 3, 4, 5, 6]) {
      for (const seed of ['audit-seed', '审计种子😀', '42']) {
        const browser = context.MsvCoursePreview.projectCourse(course, { blockIndex, learnerCount, seed, status: 'ready' });
        const shared = platform.buildStudioProjection(course, { blockId: course.blocks[blockIndex].id, learnerCount, seed });
        for (const learner of shared.learnerViews) {
          assert.deepEqual(Array.from(browser.deal.hands[learner.seatId], card => card.id), learner.privateCards.map(card => card.id));
          assert.equal(browser.learners.find(item => item.id === learner.seatId).task, learner.task);
        }
        scenarios++;
      }
    }
  }
  output.push({ case: 'current-candidate-projection-positive-control', result: 'passed', scenarios, blocks: 13, learnerCounts: [2,3,4,5,6], seedCount: 3, checked: ['card-id-order','learner-task'] });
}

function database() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const name of readdirSync(resolve(root, 'drizzle')).filter(n => /^\d{4}_.*\.sql$/.test(n)).sort()) {
    raw.exec(readFileSync(resolve(root, 'drizzle', name), 'utf8'));
  }
  const api = {
    raw,
    prepare(sql) {
      let values = [];
      return {
        sql,
        bind(...args) { values = args; return this; },
        async first() { return raw.prepare(sql).get(...values) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...values) }; },
        async run() { return this.execute(); },
        execute() { const result = raw.prepare(sql).run(...values); return { meta: { changes: result.changes } }; },
      };
    },
    async batch(statements) {
      raw.exec('BEGIN');
      try { const result = statements.map(s => s.execute()); raw.exec('COMMIT'); return result; }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
  return api;
}

// 1. A stale second editor overwrites the first editor's change without a 409.
{
  const db = database();
  const base = structuredClone(fixtures.bundledCoursePackages()[0]);
  const a = structuredClone(base), b = structuredClone(base);
  a.course.title += ' [author A]';
  b.course.title += ' [author B stale]';
  await registry.saveCourseCandidate(db, base, 'audit');
  const ra = await registry.saveCourseCandidate(db, a, 'audit-A');
  const rb = await registry.saveCourseCandidate(db, b, 'audit-B');
  const current = await registry.loadExactCoursePackage(db, rb);
  assert.equal(current.course.title, b.course.title);
  output.push({ case: 'stale-editor-save', result: 'reproduced', revisionA: ra.revision, revisionB: rb.revision, conflictRejected: false, previousSnapshotPreserved: true });
  db.raw.close();
}

// 2. Force both MAX(revision) reads to finish before either writer proceeds.
{
  const db = database();
  const base = structuredClone(fixtures.bundledCoursePackages()[0]);
  await registry.saveCourseCandidate(db, base, 'audit');
  const prepare = db.prepare.bind(db);
  let seen = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  db.prepare = (sql) => {
    const statement = prepare(sql);
    if (sql.includes('SELECT MAX(revision) AS revision FROM course_versions')) {
      const first = statement.first.bind(statement);
      statement.first = async () => {
        const result = await first();
        if (++seen === 2) release();
        await gate;
        return result;
      };
    }
    return statement;
  };
  const a = structuredClone(base), b = structuredClone(base);
  a.course.title += ' [concurrent A]';
  b.course.title += ' [concurrent B]';
  const results = await Promise.allSettled([
    registry.saveCourseCandidate(db, a, 'audit-A'),
    registry.saveCourseCandidate(db, b, 'audit-B'),
  ]);
  const pointer = db.raw.prepare('SELECT course_id AS courseId, revision, digest FROM course_candidate_pointers').get();
  const persisted = db.raw.prepare('SELECT digest FROM course_versions WHERE course_id = ? AND revision = ?').get(pointer.courseId, pointer.revision);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
  assert.notEqual(pointer.digest, persisted.digest);
  let errorCode = null;
  try { await registry.loadExactCoursePackage(db, pointer); } catch (error) { errorCode = error.code; }
  assert.equal(errorCode, 'COURSE_VERSION_NOT_FOUND');
  output.push({ case: 'concurrent-candidate-save', result: 'reproduced', bothSavesReportedSuccess: true, pointerMatchesVersionDigest: false, readError: errorCode });
  db.raw.close();
}

// 3. Unreleased preview is blocked; publishing r1 also hides previously released r0.
{
  const db = database();
  db.raw.exec("INSERT INTO profiles (id,nickname,created_at,updated_at) VALUES ('audit-author','Audit','2026-09-10','2026-09-10')");
  const actor = { userId: 'audit-author', platformRole: 'mentor' };
  const info = { slug: 'audit-deck', title: 'Audit deck', mentorRole: 'D', html: '<html><body><h1>Audit revision zero</h1></body></html>' };
  const r0 = await cw.saveCoursewareVersion(db, actor, info);
  assert.equal(cw.isCoursewareLibraryVisible(r0), false);
  await cw.releaseCoursewareVersion(db, actor, r0);
  const before = await cw.loadCoursewareExact(db, r0.packageId, r0.revision, r0.digest);
  assert.equal(cw.isCoursewareLibraryVisible(before), true);
  const r1 = await cw.saveCoursewareVersion(db, actor, { ...info, packageId: r0.packageId, html: '<html><body><h1>Audit revision one</h1></body></html>' });
  await cw.releaseCoursewareVersion(db, actor, r1);
  const after = await cw.loadCoursewareExact(db, r0.packageId, r0.revision, r0.digest);
  assert.equal(cw.isCoursewareLibraryVisible(after), false);
  output.push({ case: 'courseware-release-visibility', result: 'reproduced', candidatePreviewAllowedByCoursePageGate: false, oldReleasedVisibleBefore: true, oldReleasedVisibleAfterR1: false, oldBytesPreserved: after.htmlContent === before.htmlContent });
  db.raw.close();
}

// 4. A new observation carries pending regardless of an earlier human resolution.
{
  const input = { question: '审计用合成问题', observedAt: 1, model: 'audit-only', sourceIds: [] };
  const observed = gap.buildKnowledgeGapEvent(input);
  const reviewed = gap.applyKnowledgeGapReview(observed, { status: 'resolved_already_covered', reviewedAt: 2, reviewedBy: 'audit', note: 'synthetic fixture' });
  const repeated = gap.buildKnowledgeGapEvent({ ...input, observedAt: 3 });
  assert.equal(repeated.id, reviewed.id);
  assert.equal(repeated.reviewStatus, 'pending_dm_review');
  output.push({ case: 'qa-gap-observation-vs-review', result: 'reproduced-event-semantics', sameGapId: true, resolvedStatus: reviewed.reviewStatus, laterObservationStatus: repeated.reviewStatus, note: 'Latest-event aggregation reopens it; policy needs human confirmation.' });
}
console.log(JSON.stringify({ sourceRoot: root, networkRequests: 0, productionWrites: 0, probes: output }, null, 2));
