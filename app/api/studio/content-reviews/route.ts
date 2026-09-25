import { recordCourseContentReviewEvent, type CourseContentReviewDisposition } from "../../../lib/course-content-review";
import { ClassroomError } from "../../../lib/classroom-errors";
import { integerValue, objectValue, parseCourseRef, stringValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const action = stringValue(raw.action, "审核操作", 32);
    if (action !== "decision" && action !== "reopen") {
      throw new ClassroomError("COURSE_REVIEW_ACTION_INVALID", "请选择审核决定或显式重开。", 400);
    }
    let disposition: CourseContentReviewDisposition | undefined;
    if (raw.disposition != null) {
      const value = stringValue(raw.disposition, "审核处置", 64);
      if (value !== "revision-required" && value !== "source-added" && value !== "excluded-this-release") {
        throw new ClassroomError("COURSE_REVIEW_DISPOSITION_INVALID", "审核处置无效。", 400);
      }
      disposition = value;
    }
    return recordCourseContentReviewEvent(db, {
      courseRef: parseCourseRef(raw.courseRef),
      itemId: stringValue(raw.itemId, "待核对项 ID", 128),
      expectedSequence: integerValue(raw.expectedSequence, "审核序号", 0, 1_000_000),
      idempotencyKey: stringValue(raw.idempotencyKey, "幂等键", 128),
      action,
      ...(disposition ? { disposition } : {}),
      note: stringValue(raw.note, "人工审核说明", 500),
      ...(raw.sourceRef == null ? {} : { sourceRef: stringValue(raw.sourceRef, "来源引用", 512) }),
    }, user.userId);
  });
}
