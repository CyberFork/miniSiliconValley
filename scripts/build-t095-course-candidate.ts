import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { coursePackageDigest, validateCoursePackage, type CoursePackage } from "../app/lib/course-package";
import { migrateCourseFieldIsolation } from "../app/lib/course-field-model";

const sourcePath = resolve("tools/live-run/courses/candidates/eleme-2008-product-development-t090.json");
const targetPath = resolve("tools/live-run/courses/candidates/eleme-2008-unified-t095.json");
const reportPath = resolve("docs/TODO_095_FIELD_ISOLATION_MIGRATION.json");
const generatedAt = "2026-09-09T16:00:00Z";

const source = validateCoursePackage(JSON.parse(await readFile(sourcePath, "utf8")) as unknown);
const working = structuredClone(source) as CoursePackage;
working.id = "msv-eleme-unified-live-run-t095-v1";
working.title = "Mini Silicon Valley｜饿了么五步课堂｜六席独立 CourseDefinition";
working.authoring = {
  status: "candidate",
  revision: 3,
  updatedAt: generatedAt,
  createdBy: "T-095 deterministic field-isolation migration",
  sourceArtifact: "eleme-2008-product-development-t090.json",
};
// T-090 expanded the classroom to 2–6 learners with two cards each, but B01
// still described the old fixed four-by-three deal in several visible fields.
// Correct every observable count in this new Candidate only; the immutable
// T-090 artifact remains untouched.
const b01 = working.blocks.find((block) => block.id === "B01")!;
const normalizeB01Copy = (value: string): string => value
  .replaceAll("系统把 12 张线索完全随机分给四人，每人三张。", "系统按本场人数从 12 张线索中随机发牌，每人两张且同轮不重复。")
  .replaceAll("四人各有三张随机私密卡且 12 张不重复", "每名学员各有两张随机私密卡且同轮不重复")
  .replaceAll("导师逐窗确认每人三张", "导师按实际席位确认每人两张")
  .replaceAll("建立 4 导师＋4 学员席位", "建立 4 导师＋本场学员席位")
  .replaceAll("三张卡", "两张卡")
  .replaceAll("三张私密卡", "两张私密卡")
  .replaceAll("随机发完 12 张课件信息卡", "按本场人数随机发牌，每人两张且同轮不重复")
  .replaceAll("每人三张", "每人两张");
b01.studentPrompt = normalizeB01Copy(b01.studentPrompt);
b01.mentorScript = b01.mentorScript.map(normalizeB01Copy);
b01.studentActions = b01.studentActions.map(normalizeB01Copy);
b01.systemActions = b01.systemActions.map(normalizeB01Copy);
b01.evidenceGate = b01.evidenceGate.map(normalizeB01Copy);
b01.manualInteraction = normalizeB01Copy(b01.manualInteraction);
if (b01.learnerTaskTemplate) b01.learnerTaskTemplate.task = normalizeB01Copy(b01.learnerTaskTemplate.task);
for (const seatId of ["learner01", "learner02", "learner03", "learner04"]) {
  b01.seatTasks[seatId].task = normalizeB01Copy(b01.seatTasks[seatId].task);
}

const variableLearnerCopy = new Map([
  ["导师席 4、学员席 4", "导师席 4、本场学员席齐全"],
  ["四人各公开至少一张卡", "每名学员各公开至少一张卡"],
  ["汇总四人公开线索", "汇总全员公开线索"],
  ["四人都讲过且各至少公开一张", "每名学员都讲过且各至少公开一张"],
  ["四人各写一份 48 小时行动", "每名学员各写一份 48 小时行动"],
  ["记录四人的 TEAM 行动与个人 RP", "记录全员的 TEAM 行动与个人 RP"],
  ["四人反思和现实行动齐全", "全员反思和现实行动齐全"],
  ["进入四人钱包", "进入学员个人钱包"],
  ["四人反思齐全", "全员反思齐全"],
  ["四人 RP 有理由", "全员 RP 有理由"],
  ["四人协作完成六段发布", "全员协作完成六段发布"],
]);
function normalizeVariableLearnerCopy(value: unknown): unknown {
  if (typeof value === "string") {
    let normalized = value;
    for (const [before, after] of variableLearnerCopy) normalized = normalized.replaceAll(before, after);
    return normalized;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeVariableLearnerCopy(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeVariableLearnerCopy(item)]));
  }
  return value;
}
working.blocks = normalizeVariableLearnerCopy(working.blocks) as CoursePackage["blocks"];

const migration = migrateCourseFieldIsolation(working);
const candidate = validateCoursePackage(migration.course);
const [sourceDigest, candidateDigest] = await Promise.all([coursePackageDigest(source), coursePackageDigest(candidate)]);
const report = {
  schemaVersion: 1,
  todo: "T-095",
  generatedAt,
  source: {
    path: "tools/live-run/courses/candidates/eleme-2008-product-development-t090.json",
    courseId: source.course.id,
    digest: sourceDigest,
    immutable: true,
  },
  candidate: {
    path: "tools/live-run/courses/candidates/eleme-2008-unified-t095.json",
    courseId: candidate.course.id,
    digest: candidateDigest,
    fieldModelSchemaVersion: candidate.fieldModel!.schemaVersion,
    fieldCount: candidate.fieldModel!.fields.length,
    studentSeats: candidate.fieldModel!.studentSeats,
  },
  migration: migration.report,
  contentCorrection: {
    blockId: "B01",
    reason: "learnerPolicy supports 2–6 learners with two unique cards each; legacy copy incorrectly described a fixed four-by-three deal",
    oldArtifactChanged: false,
  },
};

await writeFile(targetPath, `${JSON.stringify(candidate, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.candidate, null, 2));
