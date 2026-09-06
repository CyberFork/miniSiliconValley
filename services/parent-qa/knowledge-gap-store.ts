import { createHash } from "node:crypto";
import { appendFile, chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type KnowledgeGapInput = {
  question: string;
  observedAt: number;
  model: string;
  sourceIds: string[];
};

export type KnowledgeGapReviewStatus =
  | "pending_dm_review"
  | "resolved_already_covered"
  | "resolved_added_to_knowledge"
  | "dismissed_out_of_scope";

export type KnowledgeGapEvent = {
  schemaVersion: 1;
  id: string;
  reviewStatus: KnowledgeGapReviewStatus;
  question: string;
  observedAt: string;
  model: string;
  sourceIds: string[];
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  knowledgeEntryId?: string;
};

export type KnowledgeGapRecorder = (input: KnowledgeGapInput) => Promise<void>;

export function createKnowledgeGapRecorder(filePath: string): KnowledgeGapRecorder {
  let pending: Promise<void> = Promise.resolve();

  return (input) => {
    const operation = pending.then(() => appendKnowledgeGap(filePath, input));
    pending = operation.catch(() => undefined);
    return operation;
  };
}

export function buildKnowledgeGapEvent(input: KnowledgeGapInput): KnowledgeGapEvent {
  const question = redactPotentialPersonalData(input.question).slice(0, 600);
  const normalized = question.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();
  const id = `gap_${createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;

  return {
    schemaVersion: 1,
    id,
    reviewStatus: "pending_dm_review",
    question,
    observedAt: new Date(input.observedAt).toISOString(),
    model: input.model.slice(0, 80),
    sourceIds: [...new Set(input.sourceIds)].slice(0, 8),
  };
}

export function applyKnowledgeGapReview(
  event: KnowledgeGapEvent,
  review: {
    status: Exclude<KnowledgeGapReviewStatus, "pending_dm_review">;
    reviewedAt: number;
    reviewedBy: string;
    note: string;
    knowledgeEntryId?: string;
  },
): KnowledgeGapEvent {
  return {
    ...event,
    reviewStatus: review.status,
    reviewedAt: new Date(review.reviewedAt).toISOString(),
    reviewedBy: redactPotentialPersonalData(review.reviewedBy).slice(0, 80),
    reviewNote: redactPotentialPersonalData(review.note).slice(0, 500),
    ...(review.knowledgeEntryId ? { knowledgeEntryId: review.knowledgeEntryId.slice(0, 120) } : {}),
  };
}

export function redactPotentialPersonalData(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已隐藏]")
    .replace(/(^|[^\d])\d{17}[\dXx](?!\d)/g, "$1[证件号已隐藏]")
    .replace(/(^|[^\d])\d{15}(?!\d)/g, "$1[证件号已隐藏]")
    .replace(/(^|[^\d])1[3-9]\d(?:[\s-]?\d){8}(?!\d)/g, "$1[手机号已隐藏]")
    .replace(
      /(微信|wechat|wx|手机号|电话|邮箱|家庭住址|家庭地址|学校名称)\s*(?:是|为|[:：])\s*[^\s，。；;]{2,64}/gi,
      "$1：[信息已隐藏]",
    )
    .replace(
      /(孩子|学生|家长|我)(叫|姓名是|名字是|姓名为|名字为)\s*[\u3400-\u9fff·]{2,8}/gu,
      "$1$2[姓名已隐藏]",
    )
    .trim();
}

async function appendKnowledgeGap(filePath: string, input: KnowledgeGapInput): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const event = buildKnowledgeGapEvent(input);
  await appendFile(filePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600);
}
