import { readParentQaReviewSnapshot, writeParentQaReviewAction, type ParentQaReviewAction } from "../../../lib/parent-qa-review-client";
import { ClassroomError } from "../../../lib/classroom-errors";
import { objectValue, stringValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ user }) => {
    requireStudioRole(user);
    return readParentQaReviewSnapshot();
  });
}

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const action = stringValue(raw.action, "操作", 32);
    if (action === "retry-failed") return writeParentQaReviewAction({ action });
    const id = stringValue(raw.id, "缺口 ID", 64);
    const note = stringValue(raw.note, "人工审核说明", 500);
    const actor = user.displayName;
    let requestAction: ParentQaReviewAction;
    if (action === "reopen") {
      requestAction = { action, id, note, actor };
    } else if (action === "review") {
      const status = stringValue(raw.status, "处置结果", 64);
      if (status !== "resolved_already_covered" && status !== "resolved_added_to_knowledge" && status !== "dismissed_out_of_scope") {
        throw new ClassroomError("KNOWLEDGE_GAP_REVIEW_STATUS_INVALID", "请选择明确的人工处置。", 400);
      }
      requestAction = {
        action,
        id,
        note,
        actor,
        status,
        ...(raw.knowledgeEntryId == null ? {} : { knowledgeEntryId: stringValue(raw.knowledgeEntryId, "知识条目 ID", 120) }),
      };
    } else {
      throw new ClassroomError("KNOWLEDGE_GAP_ACTION_INVALID", "不支持的审核操作。", 400);
    }
    return writeParentQaReviewAction(requestAction);
  });
}
