export type ClassroomRuntimeRequestIdentity = {
  classroomId: string;
  blockId: string | null;
  viewProfileId: string | null;
  surface: "seat" | "control" | "screen";
};

export type ClassroomRuntimeResponseIdentity = {
  classroomId: string;
  blockId: string;
  viewProfileId: string | null;
  resetGeneration: number;
};

export function classroomRuntimeRequestKey(identity: ClassroomRuntimeRequestIdentity): string {
  return [identity.classroomId, identity.blockId ?? "latest", identity.viewProfileId ?? "actor", identity.surface].join("|");
}

export function classroomDeviceDraftKey(identity: {
  actorProfileId: string;
  viewProfileId: string;
  classroomId: string;
  runId: string;
  seatId: string;
  blockId: string;
  discriminator: string;
}): string {
  return [
    "minisv", "classroom-draft", "v1", identity.actorProfileId, identity.viewProfileId,
    identity.classroomId, identity.runId, identity.seatId, identity.blockId, identity.discriminator,
  ].map((part) => encodeURIComponent(part)).join(":");
}

/**
 * A late GET may only commit when it still belongs to the active request and
 * cannot move the browser back into an older Classroom run.  This helper is
 * shared by the real UI and deterministic weak-network regression tests.
 */
export function canCommitClassroomRuntimeResponse(input: {
  requestGeneration: number;
  latestRequestGeneration: number;
  expected: ClassroomRuntimeRequestIdentity;
  actual: ClassroomRuntimeResponseIdentity;
  currentResetGeneration: number | null;
}): boolean {
  const { expected, actual } = input;
  return input.requestGeneration === input.latestRequestGeneration
    && actual.classroomId === expected.classroomId
    && (expected.blockId === null || actual.blockId === expected.blockId)
    && (expected.viewProfileId === null || actual.viewProfileId === expected.viewProfileId)
    && (input.currentResetGeneration === null || actual.resetGeneration >= input.currentResetGeneration);
}
