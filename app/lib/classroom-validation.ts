import type { ClassroomAction } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import { normalizeTeamPublicId, TEAM_PUBLIC_ID_PATTERN } from "./team-access";
import type { ChallengeRubric, ReputationScores } from "./classroom-model";
import { DEFAULT_CLASSROOM_CAMPAIGN_ID } from "../data/classroom-campaigns";

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;

export function parseClassroomAction(value: unknown): ClassroomAction {
  const input = record(value, "action");
  const type = shortString(input.type, "type", 64);

  switch (type) {
    case "set-nickname":
      return { type, nickname: humanText(input.nickname, "nickname", 2, 32) };
    case "assign-and-deal":
    case "reveal-history":
    case "next-chapter":
    case "archive-room":
      return { type };
    case "move-phase":
      return { type, direction: enumValue(input.direction, "direction", ["next", "previous"] as const) };
    case "set-timer":
      return { type, minutes: positiveInteger(input.minutes, "minutes", 180) };
    case "toggle-pause":
      return { type, paused: booleanValue(input.paused, "paused") };
    case "create-team":
      return { type, name: humanText(input.name, "name", 2, 40) };
    case "decide-join-request":
      return {
        type,
        requestId: identifier(input.requestId, "requestId"),
        decision: enumValue(input.decision, "decision", ["approve", "reject"] as const),
      };
    case "add-learner":
      return { type, teamId: identifier(input.teamId, "teamId"), profileId: identifier(input.profileId, "profileId") };
    case "remove-member":
      return { type, memberId: identifier(input.memberId, "memberId") };
    case "assign-facilitator":
      return { type, username: accountUsername(input.username) };
    case "remove-facilitator":
      return { type, memberId: identifier(input.memberId, "memberId") };
    case "withdraw-card":
    case "grant-card":
      return { type, cardId: identifier(input.cardId, "cardId"), memberId: identifier(input.memberId, "memberId") };
    case "set-card-state":
      return {
        type,
        cardId: identifier(input.cardId, "cardId"),
        state: enumValue(input.state, "state", ["read", "published"] as const),
      };
    case "create-intelligence-node":
      return {
        type,
        kind: enumValue(input.kind, "kind", ["person", "user", "need", "event", "technology", "constraint", "evidence"] as const),
        title: humanText(input.title, "title", 2, 80),
        explanation: humanText(input.explanation, "explanation", 4, 500),
        sourceCardIds: idArray(input.sourceCardIds, "sourceCardIds", 0, 12),
      };
    case "create-intelligence-edge":
      return {
        type,
        fromNodeId: identifier(input.fromNodeId, "fromNodeId"),
        toNodeId: identifier(input.toNodeId, "toNodeId"),
        kind: enumValue(input.kind, "kind", ["causes", "supports", "limits", "contradicts", "hypothesis"] as const),
        explanation: humanText(input.explanation, "explanation", 4, 500),
      };
    case "submit-problem-statement":
      return {
        type,
        user: humanText(input.user, "user", 2, 300),
        sceneLoss: humanText(input.sceneLoss, "sceneLoss", 4, 600),
        evidenceSummary: humanText(input.evidenceSummary, "evidenceSummary", 4, 1_000),
        unknown: humanText(input.unknown, "unknown", 4, 600),
        decisionQuestion: humanText(input.decisionQuestion, "decisionQuestion", 4, 600),
      };
    case "select-challenge":
      return { type, teamId: identifier(input.teamId, "teamId"), challengeId: identifier(input.challengeId, "challengeId") };
    case "roll-pressure":
      return { type, teamId: identifier(input.teamId, "teamId") };
    case "submit-challenge-action":
      return {
        type,
        goal: humanText(input.goal, "goal", 4, 300),
        method: humanText(input.method, "method", 4, 500),
        evidence: humanText(input.evidence, "evidence", 2, 500),
        resource: humanText(input.resource, "resource", 1, 240),
        successSignal: humanText(input.successSignal, "successSignal", 2, 300),
        stopCondition: humanText(input.stopCondition, "stopCondition", 2, 300),
      };
    case "score-challenge":
      return {
        type,
        teamId: identifier(input.teamId, "teamId"),
        rubric: parseRubric(input.rubric),
        consequence: humanText(input.consequence, "consequence", 0, 500),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "award-reputation":
      return {
        type,
        memberId: identifier(input.memberId, "memberId"),
        scores: parseReputationScores(input.scores),
        evidenceObjectId: identifier(input.evidenceObjectId, "evidenceObjectId"),
        reason: humanText(input.reason, "reason", 4, 300),
      };
    case "gratitude-vote":
      return {
        type,
        toMemberId: identifier(input.toMemberId, "toMemberId"),
        reason: humanText(input.reason, "reason", 4, 240),
      };
    case "distribute-profit":
      return {
        type,
        teamId: identifier(input.teamId, "teamId"),
        percent: enumNumber(input.percent, "percent", [0, 20, 40] as const),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "propose-purchase":
      return { type, assetId: identifier(input.assetId, "assetId"), idempotencyKey: idempotencyKey(input.idempotencyKey) };
    case "vote-purchase":
      return {
        type,
        proposalId: identifier(input.proposalId, "proposalId"),
        approve: booleanValue(input.approve, "approve"),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "personal-purchase":
      return { type, itemId: identifier(input.itemId, "itemId"), idempotencyKey: idempotencyKey(input.idempotencyKey) };
    case "reinvest":
      return {
        type,
        teamId: identifier(input.teamId, "teamId"),
        amountTenths: positiveInteger(input.amountTenths, "amountTenths", 100_000),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "record-financing":
      return {
        type,
        teamId: identifier(input.teamId, "teamId"),
        amountTenths: positiveInteger(input.amountTenths, "amountTenths", 100_000),
        reason: humanText(input.reason, "reason", 8, 500),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "record-paper-ledger":
      return {
        type,
        teamId: identifier(input.teamId, "teamId"),
        flow: enumValue(input.flow, "flow", ["inflow", "outflow"] as const),
        category: enumValue(
          input.category,
          "category",
          ["user-validation", "asset-revenue", "research", "product", "market", "operations", "maintenance"] as const,
        ),
        amountTenths: positiveInteger(input.amountTenths, "amountTenths", 100_000),
        reason: humanText(input.reason, "reason", 8, 500),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "reverse-transaction":
      return {
        type,
        transactionId: identifier(input.transactionId, "transactionId"),
        reason: humanText(input.reason, "reason", 8, 500),
        idempotencyKey: idempotencyKey(input.idempotencyKey),
      };
    case "freeze-worldline":
      return {
        type,
        teamId: identifier(input.teamId, "teamId"),
        decision: humanText(input.decision, "decision", 8, 2_000),
        rationale: humanText(input.rationale, "rationale", 8, 2_000),
      };
    case "submit-reflection":
      return {
        type,
        answers: textArray(input.answers, "answers", 6, 6, 1_000),
        realityAction: humanText(input.realityAction, "realityAction", 8, 1_000),
      };
    case "submit-demo-day":
      return {
        type,
        title: humanText(input.title, "title", 2, 120),
        // Released Course Packages use the canonical six one-minute sections.
        // Legacy rooms may still be bound to the earlier seven-segment agenda;
        // submitDemoDay performs the exact campaign-length check once the room's
        // immutable campaign revision is known.
        segmentNotes: textArray(input.segmentNotes, "segmentNotes", 6, 7, 1_000),
      };
    default:
      throw new ClassroomError("INVALID_ACTION", `不支持的课堂操作：${type}`, 400);
  }
}

export function parseCreateRoom(value: unknown): { title: string; campaignId: string } {
  const input = record(value, "room");
  const campaignId = input.campaignId === undefined
    ? DEFAULT_CLASSROOM_CAMPAIGN_ID
    : identifier(input.campaignId, "campaignId");
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(campaignId)) throw new ClassroomError("CAMPAIGN_NOT_FOUND", "课程 ID 格式无效，请刷新后重新选择。", 400);
  return { title: humanText(input.title, "title", 2, 60), campaignId };
}

export function parseJoinRoom(value: unknown): { teamPublicId: string } {
  const input = record(value, "join");
  const teamPublicId = normalizeTeamPublicId(shortString(input.teamPublicId, "teamPublicId", 20));
  if (!TEAM_PUBLIC_ID_PATTERN.test(teamPublicId)) {
    throw new ClassroomError("INVALID_TEAM_ID", "队伍ID格式应为 TEAM- 加8位字符。", 400);
  }
  return { teamPublicId };
}

function parseRubric(value: unknown): ChallengeRubric {
  const input = record(value, "rubric");
  return {
    evidence: binary(input.evidence, "rubric.evidence"),
    logic: binary(input.logic, "rubric.logic"),
    execution: binary(input.execution, "rubric.execution"),
    collaboration: binary(input.collaboration, "rubric.collaboration"),
  };
}

function parseReputationScores(value: unknown): ReputationScores {
  const input = record(value, "scores");
  return {
    evidence: boundedInteger(input.evidence, "scores.evidence", 0, 2),
    modeling: boundedInteger(input.modeling, "scores.modeling", 0, 2),
    delivery: boundedInteger(input.delivery, "scores.delivery", 0, 3),
    support: boundedInteger(input.support, "scores.support", 0, 2),
    iteration: boundedInteger(input.iteration, "scores.iteration", 0, 2),
    responsibility: boundedInteger(input.responsibility, "scores.responsibility", 0, 1),
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("INVALID_INPUT", `${label}必须是对象。`, 400);
  return value as Record<string, unknown>;
}

function shortString(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new ClassroomError("INVALID_INPUT", `${label}格式无效。`, 400);
  }
  return value;
}

function humanText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new ClassroomError("INVALID_INPUT", `${label}必须是文本。`, 400);
  const normalized = Array.from(value).filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  }).join("").trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ClassroomError("INVALID_INPUT", `${label}长度必须在${min}—${max}字之间。`, 400);
  }
  return normalized;
}

function identifier(value: unknown, label: string): string {
  const result = shortString(value, label, 128);
  if (!ID_PATTERN.test(result)) throw new ClassroomError("INVALID_INPUT", `${label}不是合法标识。`, 400);
  return result;
}

function accountUsername(value: unknown): string {
  const result = shortString(value, "username", 32).trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(result)) {
    throw new ClassroomError("INVALID_INPUT", "导师用户名需为3–32位小写字母、数字、- 或 _。", 400);
  }
  return result;
}

function idempotencyKey(value: unknown): string {
  const result = shortString(value, "idempotencyKey", 128);
  if (!IDEMPOTENCY_PATTERN.test(result)) throw new ClassroomError("INVALID_INPUT", "这次操作的防重复编号无效，请刷新页面后再试。", 400);
  return result;
}

function idArray(value: unknown, label: string, min: number, max: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new ClassroomError("INVALID_INPUT", `${label}数量无效。`, 400);
  return Array.from(new Set(value.map((entry, index) => identifier(entry, `${label}[${index}]`))));
}

function textArray(value: unknown, label: string, min: number, max: number, itemMax: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new ClassroomError("INVALID_INPUT", `${label}数量无效。`, 400);
  return value.map((entry, index) => humanText(entry, `${label}[${index}]`, 1, itemMax));
}

function enumValue<const T extends readonly string[]>(value: unknown, label: string, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new ClassroomError("INVALID_INPUT", `${label}取值无效。`, 400);
  return value as T[number];
}

function enumNumber<const T extends readonly number[]>(value: unknown, label: string, allowed: T): T[number] {
  if (typeof value !== "number" || !allowed.includes(value)) throw new ClassroomError("INVALID_INPUT", `${label}取值无效。`, 400);
  return value as T[number];
}

function binary(value: unknown, label: string): 0 | 1 {
  return boundedInteger(value, label, 0, 1) as 0 | 1;
}

function boundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new ClassroomError("INVALID_INPUT", `${label}必须是${min}—${max}之间的整数。`, 400);
  }
  return value as number;
}

function positiveInteger(value: unknown, label: string, max: number): number {
  return boundedInteger(value, label, 1, max);
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ClassroomError("INVALID_INPUT", `${label}必须是布尔值。`, 400);
  return value;
}
