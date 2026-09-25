import { createHash, randomUUID } from "node:crypto";
import { appendFile, chmod, mkdir, readFile } from "node:fs/promises";
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
export type KnowledgeGapReviewDisposition = Exclude<KnowledgeGapReviewStatus, "pending_dm_review">;

/** Legacy schema-v1 snapshot. New persistence uses schema-v2 events below. */
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

export type KnowledgeGapObservationEvent = {
  schemaVersion: 2;
  eventType: "observation";
  eventId: string;
  id: string;
  question: string;
  observedAt: string;
  model: string;
  sourceIds: string[];
};

export type KnowledgeGapReviewEvent = {
  schemaVersion: 2;
  eventType: "review";
  eventId: string;
  id: string;
  status: KnowledgeGapReviewDisposition;
  reviewedAt: string;
  reviewedBy: string;
  note: string;
  knowledgeEntryId?: string;
};

export type KnowledgeGapReopenEvent = {
  schemaVersion: 2;
  eventType: "reopen";
  eventId: string;
  id: string;
  reopenedAt: string;
  reopenedBy: string;
  reason: string;
};

export type KnowledgeGapLogEvent =
  | KnowledgeGapEvent
  | KnowledgeGapObservationEvent
  | KnowledgeGapReviewEvent
  | KnowledgeGapReopenEvent;

export type KnowledgeGapAggregate = {
  id: string;
  question: string;
  reviewStatus: KnowledgeGapReviewStatus;
  observationCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  lastModel: string;
  sourceIds: string[];
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  knowledgeEntryId?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  eventCount: number;
};

export type KnowledgeGapRecorderHealth = {
  status: "healthy" | "degraded";
  failedWriteCount: number;
  pendingRetryCount: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
};

export type KnowledgeGapReviewInput = {
  id: string;
  status: KnowledgeGapReviewDisposition;
  reviewedAt: number;
  reviewedBy: string;
  note: string;
  knowledgeEntryId?: string;
};

export type KnowledgeGapReopenInput = {
  id: string;
  reopenedAt: number;
  reopenedBy: string;
  reason: string;
};

export type KnowledgeGapStore = {
  recordObservation(input: KnowledgeGapInput): Promise<void>;
  list(): Promise<KnowledgeGapAggregate[]>;
  review(input: KnowledgeGapReviewInput): Promise<KnowledgeGapAggregate>;
  reopen(input: KnowledgeGapReopenInput): Promise<KnowledgeGapAggregate>;
  retryFailed(): Promise<{ attempted: number; recovered: number; remaining: number }>;
  health(): KnowledgeGapRecorderHealth;
};

export type KnowledgeGapRecorder = (input: KnowledgeGapInput) => Promise<void>;

export function createKnowledgeGapStore(filePath: string): KnowledgeGapStore {
  let pending: Promise<unknown> = Promise.resolve();
  const retryQueue: KnowledgeGapLogEvent[] = [];
  let failedWriteCount = 0;
  let lastFailureAt: string | null = null;
  let lastSuccessAt: string | null = null;

  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const operation = pending.then(work, work);
    pending = operation.catch(() => undefined);
    return operation;
  };
  const write = async (event: KnowledgeGapLogEvent, enqueue: boolean): Promise<void> => {
    try {
      await appendKnowledgeGapEvent(filePath, event);
      lastSuccessAt = new Date().toISOString();
    } catch (error) {
      failedWriteCount += 1;
      lastFailureAt = new Date().toISOString();
      if (enqueue && !retryQueue.some((item) => eventIdentity(item) === eventIdentity(event))) {
        retryQueue.push(event); // already redacted
      }
      throw error;
    }
  };
  // Only durable events are part of the human-review truth. Failed writes stay
  // visible through health()/retryFailed(), but must never look committed.
  const listUnsafe = async () => aggregateKnowledgeGapEvents(await readKnowledgeGapEvents(filePath));

  return {
    recordObservation(input) {
      const event = buildKnowledgeGapObservationEvent(input);
      return exclusive(() => write(event, true));
    },
    list() {
      return exclusive(listUnsafe);
    },
    review(input) {
      return exclusive(async () => {
        if (retryQueue.length) throw new Error("KNOWLEDGE_GAP_PENDING_RETRY");
        const id = safeGapId(input.id);
        const current = (await listUnsafe()).find((item) => item.id === id);
        if (!current) throw new Error("KNOWLEDGE_GAP_NOT_FOUND");
        if (current.reviewStatus !== "pending_dm_review") throw new Error("KNOWLEDGE_GAP_REOPEN_REQUIRED");
        await write(buildKnowledgeGapReviewEvent(input), true);
        const updated = (await listUnsafe()).find((item) => item.id === id);
        if (!updated) throw new Error("KNOWLEDGE_GAP_REVIEW_NOT_PERSISTED");
        return updated;
      });
    },
    reopen(input) {
      return exclusive(async () => {
        if (retryQueue.length) throw new Error("KNOWLEDGE_GAP_PENDING_RETRY");
        const id = safeGapId(input.id);
        const current = (await listUnsafe()).find((item) => item.id === id);
        if (!current) throw new Error("KNOWLEDGE_GAP_NOT_FOUND");
        if (current.reviewStatus === "pending_dm_review") throw new Error("KNOWLEDGE_GAP_ALREADY_PENDING");
        await write(buildKnowledgeGapReopenEvent(input), true);
        const updated = (await listUnsafe()).find((item) => item.id === id);
        if (!updated) throw new Error("KNOWLEDGE_GAP_REOPEN_NOT_PERSISTED");
        return updated;
      });
    },
    retryFailed() {
      return exclusive(async () => {
        const attempted = retryQueue.length;
        let recovered = 0;
        while (retryQueue.length) {
          try {
            await write(retryQueue[0], false);
            retryQueue.shift();
            recovered += 1;
          } catch {
            break;
          }
        }
        return { attempted, recovered, remaining: retryQueue.length };
      });
    },
    health() {
      return {
        status: retryQueue.length ? "degraded" : "healthy",
        failedWriteCount,
        pendingRetryCount: retryQueue.length,
        lastFailureAt,
        lastSuccessAt,
      };
    },
  };
}

export function createKnowledgeGapRecorder(filePath: string): KnowledgeGapRecorder {
  const store = createKnowledgeGapStore(filePath);
  return (input) => store.recordObservation(input);
}

/** Compatibility helper for callers reading schema-v1 snapshots. */
export function buildKnowledgeGapEvent(input: KnowledgeGapInput): KnowledgeGapEvent {
  const event = buildKnowledgeGapObservationEvent(input);
  return {
    schemaVersion: 1,
    id: event.id,
    reviewStatus: "pending_dm_review",
    question: event.question,
    observedAt: event.observedAt,
    model: event.model,
    sourceIds: event.sourceIds,
  };
}

export function buildKnowledgeGapObservationEvent(input: KnowledgeGapInput): KnowledgeGapObservationEvent {
  const question = redactPotentialPersonalData(input.question).slice(0, 600);
  const normalized = question.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("KNOWLEDGE_GAP_QUESTION_REQUIRED");
  return {
    schemaVersion: 2,
    eventType: "observation",
    eventId: "gapobs_" + randomUUID(),
    id: "gap_" + createHash("sha256").update(normalized).digest("hex").slice(0, 16),
    question,
    observedAt: validIso(input.observedAt, "KNOWLEDGE_GAP_OBSERVED_AT_INVALID"),
    model: redactPotentialPersonalData(input.model).slice(0, 80),
    sourceIds: [...new Set(input.sourceIds.map((item) => safeText(item, 120)).filter(Boolean))].slice(0, 8),
  };
}

export function buildKnowledgeGapReviewEvent(input: KnowledgeGapReviewInput): KnowledgeGapReviewEvent {
  if (!isDisposition(input.status)) throw new Error("KNOWLEDGE_GAP_REVIEW_STATUS_INVALID");
  const knowledgeEntryId = input.knowledgeEntryId ? safeText(input.knowledgeEntryId, 120) : "";
  if (input.status === "resolved_added_to_knowledge" && !knowledgeEntryId) throw new Error("KNOWLEDGE_GAP_ENTRY_REQUIRED");
  return {
    schemaVersion: 2,
    eventType: "review",
    eventId: "gapreview_" + randomUUID(),
    id: safeGapId(input.id),
    status: input.status,
    reviewedAt: validIso(input.reviewedAt, "KNOWLEDGE_GAP_REVIEWED_AT_INVALID"),
    reviewedBy: requiredText(input.reviewedBy, 80, "KNOWLEDGE_GAP_REVIEWER_REQUIRED"),
    note: requiredText(input.note, 500, "KNOWLEDGE_GAP_REVIEW_NOTE_REQUIRED"),
    ...(knowledgeEntryId ? { knowledgeEntryId } : {}),
  };
}

export function buildKnowledgeGapReopenEvent(input: KnowledgeGapReopenInput): KnowledgeGapReopenEvent {
  return {
    schemaVersion: 2,
    eventType: "reopen",
    eventId: "gapreopen_" + randomUUID(),
    id: safeGapId(input.id),
    reopenedAt: validIso(input.reopenedAt, "KNOWLEDGE_GAP_REOPENED_AT_INVALID"),
    reopenedBy: requiredText(input.reopenedBy, 80, "KNOWLEDGE_GAP_REOPENER_REQUIRED"),
    reason: requiredText(input.reason, 500, "KNOWLEDGE_GAP_REOPEN_REASON_REQUIRED"),
  };
}

export function aggregateKnowledgeGapEvents(events: readonly KnowledgeGapLogEvent[]): KnowledgeGapAggregate[] {
  const gaps = new Map<string, KnowledgeGapAggregate>();
  const seen = new Set<string>();
  for (const event of events) {
    const identity = eventIdentity(event);
    if (seen.has(identity)) continue;
    seen.add(identity);

    if (event.schemaVersion === 1) {
      const id = safeGapId(event.id);
      const terminal = event.reviewStatus !== "pending_dm_review";
      let current = gaps.get(id);
      if (!current) {
        current = newAggregate(id, event.question, event.observedAt, event.model, event.sourceIds);
        gaps.set(id, current);
      } else if (!terminal || current.lastObservedAt !== event.observedAt) {
        observe(current, event.question, event.observedAt, event.model, event.sourceIds);
      }
      current.eventCount += 1;
      if (terminal) {
        current.reviewStatus = event.reviewStatus;
        current.reviewedAt = event.reviewedAt;
        current.reviewedBy = event.reviewedBy;
        current.reviewNote = event.reviewNote;
        current.knowledgeEntryId = event.knowledgeEntryId;
        clearReopen(current);
      }
      continue; // legacy pending never implicitly reopens a human decision
    }

    if (event.eventType === "observation") {
      const current = gaps.get(event.id);
      if (current) observe(current, event.question, event.observedAt, event.model, event.sourceIds);
      else gaps.set(event.id, newAggregate(event.id, event.question, event.observedAt, event.model, event.sourceIds));
      gaps.get(event.id)!.eventCount += 1;
      continue;
    }

    const current = gaps.get(event.id);
    if (!current) continue; // a review cannot manufacture a retrievable fact
    current.eventCount += 1;
    if (event.eventType === "review") {
      current.reviewStatus = event.status;
      current.reviewedAt = event.reviewedAt;
      current.reviewedBy = event.reviewedBy;
      current.reviewNote = event.note;
      current.knowledgeEntryId = event.knowledgeEntryId;
      clearReopen(current);
    } else {
      current.reviewStatus = "pending_dm_review";
      delete current.reviewedAt;
      delete current.reviewedBy;
      delete current.reviewNote;
      delete current.knowledgeEntryId;
      current.reopenedAt = event.reopenedAt;
      current.reopenedBy = event.reopenedBy;
      current.reopenReason = event.reason;
    }
  }
  return [...gaps.values()].sort((left, right) => {
    const pending = Number(right.reviewStatus === "pending_dm_review") - Number(left.reviewStatus === "pending_dm_review");
    return pending || right.lastObservedAt.localeCompare(left.lastObservedAt) || left.id.localeCompare(right.id);
  });
}

export function applyKnowledgeGapReview(event: KnowledgeGapEvent, review: Omit<KnowledgeGapReviewInput, "id">): KnowledgeGapEvent {
  const applied = buildKnowledgeGapReviewEvent({ id: event.id, ...review });
  return {
    ...event,
    reviewStatus: applied.status,
    reviewedAt: applied.reviewedAt,
    reviewedBy: applied.reviewedBy,
    reviewNote: applied.note,
    ...(applied.knowledgeEntryId ? { knowledgeEntryId: applied.knowledgeEntryId } : {}),
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

async function appendKnowledgeGapEvent(filePath: string, event: KnowledgeGapLogEvent): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await appendFile(filePath, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function readKnowledgeGapEvents(filePath: string): Promise<KnowledgeGapLogEvent[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const events: KnowledgeGapLogEvent[] = [];
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(line) as unknown; }
    catch { throw new Error("KNOWLEDGE_GAP_LOG_INVALID:" + (index + 1)); }
    events.push(parseStoredEvent(parsed, index + 1));
  }
  return events;
}

function parseStoredEvent(value: unknown, line: number): KnowledgeGapLogEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("KNOWLEDGE_GAP_LOG_INVALID:" + line);
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion === 1 && typeof raw.id === "string" && typeof raw.question === "string") {
    if (!isStatus(raw.reviewStatus)) throw new Error("KNOWLEDGE_GAP_LOG_INVALID:" + line);
    return raw as KnowledgeGapEvent;
  }
  if (raw.schemaVersion !== 2 || typeof raw.eventId !== "string" || typeof raw.id !== "string") {
    throw new Error("KNOWLEDGE_GAP_LOG_INVALID:" + line);
  }
  if (raw.eventType === "observation" && typeof raw.question === "string" && typeof raw.observedAt === "string") return raw as KnowledgeGapObservationEvent;
  if (raw.eventType === "review" && isDisposition(raw.status) && typeof raw.reviewedAt === "string") return raw as KnowledgeGapReviewEvent;
  if (raw.eventType === "reopen" && typeof raw.reopenedAt === "string") return raw as KnowledgeGapReopenEvent;
  throw new Error("KNOWLEDGE_GAP_LOG_INVALID:" + line);
}

function newAggregate(id: string, question: string, observedAt: string, model: string, sourceIds: string[]): KnowledgeGapAggregate {
  return {
    id,
    question,
    reviewStatus: "pending_dm_review",
    observationCount: 1,
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    lastModel: model,
    sourceIds: [...new Set(sourceIds)].slice(0, 24),
    eventCount: 0,
  };
}

function observe(current: KnowledgeGapAggregate, question: string, at: string, model: string, sourceIds: string[]): void {
  current.observationCount += 1;
  if (at < current.firstObservedAt) current.firstObservedAt = at;
  if (at >= current.lastObservedAt) {
    current.lastObservedAt = at;
    current.question = question;
    current.lastModel = model;
  }
  current.sourceIds = [...new Set([...current.sourceIds, ...sourceIds])].slice(0, 24);
}

function clearReopen(current: KnowledgeGapAggregate): void {
  delete current.reopenedAt;
  delete current.reopenedBy;
  delete current.reopenReason;
}

function safeGapId(value: string): string {
  const id = String(value).trim();
  if (!/^gap_[a-f0-9]{16}$/.test(id)) throw new Error("KNOWLEDGE_GAP_ID_INVALID");
  return id;
}

function safeText(value: string, length: number): string {
  return [...redactPotentialPersonalData(String(value))].filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("").trim().slice(0, length);
}

function requiredText(value: string, length: number, code: string): string {
  const text = safeText(value, length);
  if (!text) throw new Error(code);
  return text;
}

function validIso(value: number, code: string): string {
  const date = new Date(value);
  if (!Number.isFinite(value) || Number.isNaN(date.valueOf())) throw new Error(code);
  return date.toISOString();
}

function isStatus(value: unknown): value is KnowledgeGapReviewStatus {
  return value === "pending_dm_review" || isDisposition(value);
}

function isDisposition(value: unknown): value is KnowledgeGapReviewDisposition {
  return value === "resolved_already_covered"
    || value === "resolved_added_to_knowledge"
    || value === "dismissed_out_of_scope";
}

function eventIdentity(event: KnowledgeGapLogEvent): string {
  if (event.schemaVersion === 2) return event.eventId;
  return ["legacy", event.id, event.observedAt, event.reviewedAt ?? "", event.reviewStatus].join(":");
}
