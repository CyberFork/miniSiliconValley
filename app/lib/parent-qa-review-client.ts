import type { KnowledgeGapAggregate, KnowledgeGapRecorderHealth, KnowledgeGapReviewDisposition } from "../../services/parent-qa/knowledge-gap-store";
import { ClassroomError } from "./classroom-errors";

export type ParentQaReviewSnapshot = {
  gaps: KnowledgeGapAggregate[];
  health: KnowledgeGapRecorderHealth;
};

export type ParentQaReviewAction =
  | { action: "retry-failed" }
  | { action: "review"; id: string; actor: string; note: string; status: KnowledgeGapReviewDisposition; knowledgeEntryId?: string }
  | { action: "reopen"; id: string; actor: string; note: string };

export async function readParentQaReviewSnapshot(): Promise<ParentQaReviewSnapshot> {
  const response = await callParentQaReviewService("GET");
  return response.data as ParentQaReviewSnapshot;
}

export async function writeParentQaReviewAction(action: ParentQaReviewAction): Promise<unknown> {
  const response = await callParentQaReviewService("POST", action);
  return response.data;
}

async function callParentQaReviewService(method: "GET" | "POST", body?: ParentQaReviewAction): Promise<{ data: unknown }> {
  const { endpoint, token } = internalReviewConfig();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new ClassroomError("PARENT_QA_REVIEW_UNAVAILABLE", "家长问答待补充清单暂时不可用；课程审核仍可独立进行。", 503);
  }
  let payload: { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
  try { payload = await response.json() as typeof payload; }
  catch { throw new ClassroomError("PARENT_QA_REVIEW_INVALID_RESPONSE", "家长问答审核服务返回了无效响应。", 502); }
  if (!response.ok || payload.ok !== true || payload.data === undefined) {
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new ClassroomError(
      payload.error?.code || "PARENT_QA_REVIEW_FAILED",
      payload.error?.message || "家长问答审核服务没有完成这次操作。",
      status,
    );
  }
  return { data: payload.data };
}

function internalReviewConfig(): { endpoint: string; token: string } {
  const token = process.env.QA_INTERNAL_REVIEW_TOKEN?.trim() ?? "";
  if (token.length < 24) throw new ClassroomError("PARENT_QA_REVIEW_NOT_CONFIGURED", "家长问答人工审核尚未完成安全配置。", 503);
  const raw = process.env.PARENT_QA_INTERNAL_URL?.trim() || "http://127.0.0.1:18789/internal/knowledge-gaps";
  let endpoint: URL;
  try { endpoint = new URL(raw); }
  catch { throw new ClassroomError("PARENT_QA_REVIEW_CONFIG_INVALID", "家长问答审核服务地址无效。", 503); }
  if (
    endpoint.protocol !== "http:"
    || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
    || endpoint.pathname !== "/internal/knowledge-gaps"
    || endpoint.username
    || endpoint.password
  ) throw new ClassroomError("PARENT_QA_REVIEW_CONFIG_INVALID", "家长问答审核服务必须使用固定的本机内部地址。", 503);
  return { endpoint: endpoint.toString(), token };
}
