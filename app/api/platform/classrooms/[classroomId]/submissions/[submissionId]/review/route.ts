import { reviewClassroomSubmission } from "../../../../../../../lib/classroom-platform-store";
import { ClassroomError } from "../../../../../../../lib/classroom-errors";
import { integerValue, objectValue, parseRunExpectation, stringValue } from "../../../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ classroomId: string; submissionId: string }> },
): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId, submissionId } = await context.params;
    const status = stringValue(raw.status, "验收结论", 16);
    if (status !== "accepted" && status !== "rejected") {
      throw new ClassroomError("SUBMISSION_REVIEW_STATUS_INVALID", "验收结论只能是 accepted 或 rejected。", 400);
    }
    const result = await reviewClassroomSubmission(db, user, classroomId, submissionId, {
      ...parseRunExpectation(raw),
      status,
      // “通过”允许不写附言；“退回”所需的具体建议由领域层按
      // status 校验。不要让通用非空字符串解析器误伤合法的空附言。
      feedback: raw.feedback == null || raw.feedback === "" ? "" : stringValue(raw.feedback, "导师反馈", 1_000),
      expectedVersion: integerValue(raw.expectedVersion, "作品版本", 1, 1_000_000),
      idempotencyKey: stringValue(raw.idempotencyKey, "幂等键", 128),
      ...(raw.viewAsProfileId == null ? {} : { viewAsProfileId: stringValue(raw.viewAsProfileId, "测试视角账号", 128) }),
    });
    return { reviewed: true, status, ...result };
  });
}
