import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateCoursePackage } from "../app/lib/course-package";
import {
  parseStoredSubmissionPayload,
  projectLearnerSubmissionSchema,
  projectMentorSubmissionSchema,
  submissionPlainText,
  validateStructuredSubmissionValues,
} from "../app/lib/course-submission";

const course = validateCoursePackage(JSON.parse(readFileSync(new URL("../tools/live-run/courses/candidates/eleme-2008-product-mentor-t091.json", import.meta.url), "utf8")) as unknown);
const schema = course.contentPackages!.submissionSchemas[0];
const developmentCourse = validateCoursePackage(JSON.parse(readFileSync(new URL("../tools/live-run/courses/candidates/eleme-2008-product-development-t090.json", import.meta.url), "utf8")) as unknown);
const developmentSchema = developmentCourse.contentPackages!.submissionSchemas.find((item) => item.id === "development-stick-v1")!;

function validValues(): Record<string, string> {
  return Object.fromEntries(schema.fields.map((field) => [field.id, "一条足够具体并符合最短长度的课堂测试内容"]));
}

test("learner ProductBrief projection omits mentor-only rubric and prompts", () => {
  const view = projectLearnerSubmissionSchema(schema);
  assert.equal(view.ownerMentorRole, "P");
  assert.equal(view.mentorRubric, null);
  assert.equal(JSON.stringify(view).includes("mentorPrompt"), false);
  assert.equal(JSON.stringify(view).includes(schema.mentorRubric[0]), false);
  assert.equal(view.fields.length, 10);
});

test("P mentor ProductBrief projection keeps the exact review rubric", () => {
  const view = projectMentorSubmissionSchema(schema);
  assert.deepEqual(view.mentorRubric, schema.mentorRubric);
  assert.deepEqual(view.fields.map((field) => field.mentorPrompt), schema.fields.map((field) => field.mentorPrompt));
});

test("structured values reject unknown, missing, short and oversized fields", () => {
  assert.deepEqual(validateStructuredSubmissionValues(schema, validValues()), validValues());
  assert.throws(() => validateStructuredSubmissionValues(schema, { ...validValues(), injected: "no" }), /未声明的字段/);
  const missing = validValues(); delete missing["target-user"];
  assert.throws(() => validateStructuredSubmissionValues(schema, missing), /目标用户.*没有填写/);
  assert.throws(() => validateStructuredSubmissionValues(schema, { ...validValues(), "target-user": "短" }), /目标用户.*4—160/);
  assert.throws(() => validateStructuredSubmissionValues(schema, { ...validValues(), "target-user": "x".repeat(161) }), /目标用户.*4—160/);
});

test("stored payload parsing fails closed and renders a deterministic plain-text fallback", () => {
  assert.deepEqual(parseStoredSubmissionPayload("not-json"), {});
  const values = validValues();
  const payload = parseStoredSubmissionPayload(JSON.stringify({ schemaId: schema.id, values, review: { feedback: "继续", reviewedAt: "2026-09-09T00:00:00Z", reviewerSecret: "hidden" } }));
  assert.equal(payload.review?.feedback, "继续");
  assert.equal("reviewerSecret" in (payload.review ?? {}), false);
  const text = submissionPlainText(payload, schema);
  assert.match(text, /^目标用户：/);
  assert.match(text, /边界与不能做的事：/);
});

function validDevelopmentValues(): Record<string, string> {
  return {
    "current-situation": "学生预约相机后页面显示成功，但管理员名单没有这条记录。",
    "user-task": "学生要在社团活动前预约一台相机，并确认管理员能看到记录。",
    "main-goal": "让一名学生预约一个时段，并从名单回读到唯一且真实的预约结果。",
    "core-journey": "打开空闲时段\n提交预约\n保存记录\n重新打开名单确认",
    "acceptance-criteria": "提交后名单出现且内容一致\n两人同时预约时只能一人成功",
    constraints: "不得显示假成功\n不得收集家庭住址和家长电话",
    "sub-sticks": "保存唯一预约｜名单只有一条\n回读真实结果｜刷新后仍能看到",
    "micro-sticks": "冲突判断函数｜同设备同时段第二次写入失败",
    tests: "两台设备同时提交同一时段 → 只有一台成功且名单一条",
    "correction-log": "偏差是页面先报成功、保存随后失败；旧测试只看提示；新增保存后回读测试。",
  };
}

test("DevelopmentStick projection and item counts remain enforceable on touch-friendly list fields", () => {
  const learner = projectLearnerSubmissionSchema(developmentSchema);
  assert.equal(learner.ownerMentorRole, "D");
  assert.equal(learner.fields.length, 10);
  assert.equal(learner.mentorRubric, null);
  assert.equal(JSON.stringify(learner).includes("mentorPrompt"), false);
  assert.equal(learner.fields.find((field) => field.id === "sub-sticks")?.minItems, 2);
  assert.deepEqual(validateStructuredSubmissionValues(developmentSchema, validDevelopmentValues()), validDevelopmentValues());

  const oneSubStick = validDevelopmentValues();
  oneSubStick["sub-sticks"] = "只有一根子棍｜这不够分解复杂任务";
  assert.throws(() => validateStructuredSubmissionValues(developmentSchema, oneSubStick), /二级子棍.*至少需要 2 条/);

  const fourSubSticks = validDevelopmentValues();
  fourSubSticks["sub-sticks"] = "子棍一｜完成\n子棍二｜完成\n子棍三｜完成\n子棍四｜超出上限";
  assert.throws(() => validateStructuredSubmissionValues(developmentSchema, fourSubSticks), /二级子棍.*最多填写 3 条/);

  const noTest = validDevelopmentValues();
  noTest.tests = "";
  assert.throws(() => validateStructuredSubmissionValues(developmentSchema, noTest), /可执行测试.*没有填写/);
});
