import {
  DATA_SCHEMA_VERSION,
  type MissionChoice,
  type MissionRecord,
  type MissionResult,
  type PlayerState,
  type ResourceDelta,
  type ResourceKey,
} from "./model";

export const STORAGE_KEY = "msv-world-state-v1";

export const INITIAL_RESOURCES: Record<ResourceKey, number> = {
  evidence: 2,
  trust: 2,
  runway: 2,
  craft: 2,
};

function isoNow() {
  return new Date().toISOString();
}

export function createInitialState(): PlayerState {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    currentYear: 1939,
    selectedCategory: "all",
    query: "",
    visitedEventIds: [],
    results: [],
    resources: { ...INITIAL_RESOURCES },
    savedAt: isoNow(),
  };
}

export function recordEventVisit(state: PlayerState, eventId: string): PlayerState {
  return {
    ...state,
    visitedEventIds: state.visitedEventIds.includes(eventId)
      ? state.visitedEventIds
      : [...state.visitedEventIds, eventId],
    savedAt: isoNow(),
  };
}

export function clampResource(value: number) {
  return Math.max(0, Math.min(9, Math.round(value)));
}

export function applyChoice(
  state: PlayerState,
  mission: MissionRecord,
  choice: MissionChoice,
  evidenceIds: string[],
): PlayerState {
  const draftResult: MissionResult = {
    missionId: mission.id,
    choiceId: choice.id,
    evidenceIds: [...new Set(evidenceIds)],
    delta: { ...choice.delta },
    resources: { ...INITIAL_RESOURCES },
    completedAt: isoNow(),
  };
  const results = [...state.results.filter((entry) => entry.missionId !== mission.id), draftResult];
  const resources = calculateResources(results);
  const result = { ...draftResult, resources };

  return {
    ...state,
    currentYear: mission.year,
    resources,
    activeMissionId: undefined,
    results: results.map((entry) => entry.missionId === mission.id ? result : { ...entry, resources }),
    savedAt: isoNow(),
  };
}

export function updateMissionNotes(
  state: PlayerState,
  missionId: string,
  reflection: string,
  realityCommitment: string,
): PlayerState {
  return {
    ...state,
    results: state.results.map((entry) =>
      entry.missionId === missionId
        ? { ...entry, reflection, realityCommitment }
        : entry,
    ),
    savedAt: isoNow(),
  };
}

export function serializeState(state: PlayerState) {
  return JSON.stringify(state, null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const categoryValues = new Set<PlayerState["selectedCategory"]>([
  "all", "education", "defense", "semiconductor", "computing", "network",
  "software", "venture", "mobile", "cloud", "ai", "robotics", "global",
]);

const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

function hasDangerousKey(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (Array.isArray(value)) return value.some((child) => hasDangerousKey(child, depth + 1));
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) =>
    dangerousKeys.has(key) || hasDangerousKey(child, depth + 1),
  );
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

function safeDelta(value: unknown): ResourceDelta {
  if (!isObject(value)) return {};
  const result: ResourceDelta = {};
  (Object.keys(INITIAL_RESOURCES) as ResourceKey[]).forEach((key) => {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      result[key] = Math.max(-9, Math.min(9, Math.round(candidate)));
    }
  });
  return result;
}

function safeMissionResult(value: unknown): MissionResult | undefined {
  if (!isObject(value)) return undefined;
  const missionId = safeText(value.missionId, 80);
  const choiceId = safeText(value.choiceId, 80);
  if (!missionId || !choiceId) return undefined;
  const delta = safeDelta(value.delta);
  const evidenceIds = Array.isArray(value.evidenceIds)
    ? [...new Set(value.evidenceIds.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 80)))].slice(0, 16)
    : [];
  return {
    missionId,
    choiceId,
    evidenceIds,
    delta,
    resources: { ...INITIAL_RESOURCES },
    reflection: safeText(value.reflection, 900),
    realityCommitment: safeText(value.realityCommitment, 600),
    completedAt: safeText(value.completedAt, 40) ?? isoNow(),
  };
}

function calculateResources(results: MissionResult[]) {
  const resources = { ...INITIAL_RESOURCES };
  results.forEach(({ delta }) => {
    (Object.keys(INITIAL_RESOURCES) as ResourceKey[]).forEach((key) => {
      resources[key] += delta[key] ?? 0;
    });
  });
  (Object.keys(resources) as ResourceKey[]).forEach((key) => {
    resources[key] = clampResource(resources[key]);
  });
  return resources;
}

export function parseState(raw: string): PlayerState {
  const value: unknown = JSON.parse(raw);
  if (!isObject(value)) throw new Error("存档根节点必须是对象。");
  if (hasDangerousKey(value)) throw new Error("存档包含不允许的字段。");
  if (value.schemaVersion !== DATA_SCHEMA_VERSION) {
    throw new Error(`不支持的存档版本：${String(value.schemaVersion)}`);
  }

  const fallback = createInitialState();
  const parsedResults = Array.isArray(value.results)
    ? value.results.map(safeMissionResult).filter((item): item is MissionResult => Boolean(item))
    : [];
  const deduplicatedResults = [...new Map(parsedResults.map((result) => [result.missionId, result])).values()].slice(-8);
  const safeResources = calculateResources(deduplicatedResults);
  const results = deduplicatedResults.map((result) => ({ ...result, resources: safeResources }));
  const selectedCategory = typeof value.selectedCategory === "string" && categoryValues.has(value.selectedCategory as PlayerState["selectedCategory"])
    ? value.selectedCategory as PlayerState["selectedCategory"]
    : "all";

  return {
    ...fallback,
    currentYear:
      typeof value.currentYear === "number"
        ? Math.max(1891, Math.min(2026, Math.round(value.currentYear)))
        : fallback.currentYear,
    selectedCategory,
    query: typeof value.query === "string" ? value.query.slice(0, 120) : "",
    visitedEventIds: Array.isArray(value.visitedEventIds)
      ? [...new Set(value.visitedEventIds.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 100)))].slice(0, 500)
      : [],
    results,
    resources: safeResources,
    activeMissionId:
      safeText(value.activeMissionId, 80),
    savedAt: safeText(value.savedAt, 40) ?? fallback.savedAt,
  };
}
