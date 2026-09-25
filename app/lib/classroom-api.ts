import type {
  CaseIdentity,
  ChallengeRubric,
  ClassroomAssetDefinition,
  ClassroomChapter,
  ClassroomChallenge,
  ClassroomInfoCard,
  ClassroomMemberRole,
  ClassroomPhase,
  RelationshipKind,
  ReputationScores,
} from "./classroom-model";
import type { AuthRole } from "./auth-model";
import type { ClassroomCampaignSummary } from "../data/classroom-campaigns";

export interface AuthenticatedClassroomUser {
  userId: string;
  username?: string;
  displayName: string;
  platformRole?: AuthRole | null;
  actorProfileId?: string;
  effectiveProfileId?: string;
  impersonationId?: string | null;
  impersonationClassroomId?: string | null;
  impersonationExpiresAt?: string | null;
}

export interface ClassroomDashboardDto {
  campaigns: ClassroomCampaignSummary[];
  profile: {
    username: string;
    nickname: string;
    platformRole: AuthRole | null;
    reputation: number;
    walletTenths: number;
    canCreateRoom: boolean;
    canRequestTeamSeat: boolean;
  };
  rooms: Array<{
    id: string;
    teamPublicId: string | null;
    title: string;
    campaignId: string;
    courseRef?: import("./course-package").CoursePackageRef;
    role: ClassroomMemberRole;
    chapterId: string;
    phase: ClassroomPhase;
    status: "active" | "archived";
    updatedAt: string;
  }>;
  joinRequests: Array<{
    id: string;
    teamPublicId: string;
    teamName: string;
    roomTitle: string;
    status: "pending" | "approved" | "rejected";
    updatedAt: string;
  }>;
}

export interface ClassroomLearnerSearchResult {
  profileId: string;
  username: string;
  displayName: string;
  membershipStatus: "active" | "removed" | null;
  teamId: string | null;
}

/**
 * A learner may see the work, reward and completion contract for the challenge,
 * but never the facilitator's suggested P/D/M/O routing.  Those two fields are
 * deliberately optional so the same DTO can carry the full DM projection and
 * the redacted learner projection without teaching the client to infer secrets.
 */
export type ClassroomChallengeView = Omit<ClassroomChallenge, "recommendedLead" | "requiredSupport"> &
  Partial<Pick<ClassroomChallenge, "recommendedLead" | "requiredSupport">>;

export interface ClassroomRoomDto {
  serverTime: string;
  version: number;
  viewer: {
    memberId: string;
    nickname: string;
    role: ClassroomMemberRole;
    teamId: string | null;
    canManageFacilitators: boolean;
    reputation: number;
    walletTenths: number;
    unlockIds: string[];
  };
  room: {
    id: string;
    title: string;
    phase: ClassroomPhase;
    status: "active" | "archived";
    chapterId: string;
    playerTimelineFrozen: boolean;
    historyRevealed: boolean;
    paused: boolean;
    phaseDeadlineAt: string | null;
    teams: Array<{ id: string; name: string; memberCount: number; seatLimit: number; publicId: string }>;
    focusTeamId: string | null;
  };
  campaign: ClassroomCampaignSummary;
  chapter: Omit<ClassroomChapter, "identities" | "infoCards" | "historyReveal" | "dm" | "challenges"> & {
    identities: Array<Pick<CaseIdentity, "id" | "name" | "nature" | "publicGoal">>;
    infoCardCount: number;
    challenges: ClassroomChallengeView[];
    historyReveal: ClassroomChapter["historyReveal"] | null;
    dm: ClassroomChapter["dm"] | null;
    studentGuide: null | {
      scene: string;
      steps: readonly [string, string, string];
      doneWhen: string;
    };
  };
  myIdentity: CaseIdentity | null;
  dmSecrets: null | {
    identities: CaseIdentity[];
    allCards: ClassroomInfoCard[];
    cardGrants: Array<ClassroomInfoCard & { memberId: string; state: "unread" | "read" | "published" }>;
    historyReveal: ClassroomChapter["historyReveal"];
    joinRequests: Array<{
      id: string;
      profileId: string;
      username: string;
      displayName: string;
      teamId: string;
      teamName: string;
      teamPublicId: string;
      status: "pending" | "approved" | "rejected";
      createdAt: string;
      updatedAt: string;
    }>;
  };
  members: Array<{
    id: string;
    username: string | null;
    nickname: string;
    role: ClassroomMemberRole;
    teamId: string | null;
    seat: number | null;
    caseIdentityId: string | null;
    lastSeenAt: string;
    reputation: number;
    walletTenths: number | null;
    isRoomOwner: boolean;
  }>;
  myCards: Array<ClassroomInfoCard & { state: "unread" | "read" | "published" }>;
  intelligence: {
    publishedCards: Array<ClassroomInfoCard & { publishedByMemberId: string; publishedByNickname: string }>;
    nodes: Array<{
      id: string;
      teamId: string;
      kind: string;
      title: string;
      explanation: string;
      sourceCardIds: string[];
      publishedByMemberId: string;
    }>;
    edges: Array<{
      id: string;
      teamId: string;
      fromNodeId: string;
      toNodeId: string;
      kind: RelationshipKind;
      explanation: string;
      createdByMemberId: string;
    }>;
  };
  challenge: null | {
    id: string;
    teamId: string;
    challengeId: string;
    level: 1 | 2 | 3;
    pressureDie: number | null;
    round: number;
    status: string;
    consequence: string | null;
    rubric: ChallengeRubric | null;
    resolution: Record<string, unknown> | null;
    actions: Array<Record<string, string | number>>;
  };
  economy: {
    teamTreasuryTenths: number;
    chapterRevenueTenths: number;
    chapterCostTenths: number;
    chapterDistributedTenths: number;
    ledger: Array<{
      id: string;
      amountTenths: number;
      category: string;
      fromLabel: string;
      toLabel: string;
      reason: string;
      createdAt: string;
    }>;
    assets: Array<ClassroomAssetDefinition & { active: boolean; acquiredAt: string }>;
    proposals: Array<{
      id: string;
      assetId: string;
      status: string;
      proposedByMemberId: string;
      approvals: number;
      rejections: number;
    }>;
  };
  reputationEvidence: Array<{
    id: string;
    memberId: string;
    nickname: string;
    dimension: string;
    points: number;
    evidenceObjectId: string;
    reason: string;
    createdAt: string;
  }>;
  worldline: Array<{
    id: string;
    kind: string;
    memberId: string | null;
    teamId: string | null;
    content: Record<string, unknown>;
    frozenAt: string | null;
  }>;
  audit: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    detail: Record<string, unknown>;
    createdAt: string;
  }>;
  catalog: {
    assets: ClassroomAssetDefinition[];
    sources: Array<{ id: string; title: string; organization: string; url: string; kind: string }>;
    personalItems: Array<{
      id: string;
      name: string;
      priceTenths: number;
      description: string;
      prerequisiteRp: number;
    }>;
    reputationUnlocks: Array<{ id: string; threshold: number; name: string; ability: string }>;
    demoDay: {
      durationSeconds: number;
      segments: Array<{ id: string; startSecond: number; endSecond: number; title: string; requirement: string }>;
      rubric: string[];
    };
  };
}

export type ClassroomAction =
  | { type: "set-nickname"; nickname: string }
  | { type: "assign-and-deal" }
  | { type: "move-phase"; direction: "next" | "previous" }
  | { type: "set-timer"; minutes: number }
  | { type: "toggle-pause"; paused: boolean }
  | { type: "create-team"; name: string }
  | { type: "decide-join-request"; requestId: string; decision: "approve" | "reject" }
  | { type: "add-learner"; teamId: string; profileId: string }
  | { type: "remove-member"; memberId: string }
  | { type: "assign-facilitator"; username: string }
  | { type: "remove-facilitator"; memberId: string }
  | { type: "withdraw-card"; cardId: string; memberId: string }
  | { type: "grant-card"; cardId: string; memberId: string }
  | { type: "set-card-state"; cardId: string; state: "read" | "published" }
  | {
      type: "create-intelligence-node";
      kind: "person" | "user" | "need" | "event" | "technology" | "constraint" | "evidence";
      title: string;
      explanation: string;
      sourceCardIds: string[];
    }
  | {
      type: "create-intelligence-edge";
      fromNodeId: string;
      toNodeId: string;
      kind: RelationshipKind;
      explanation: string;
    }
  | {
      type: "submit-problem-statement";
      user: string;
      sceneLoss: string;
      evidenceSummary: string;
      unknown: string;
      decisionQuestion: string;
    }
  | { type: "select-challenge"; teamId: string; challengeId: string }
  | { type: "roll-pressure"; teamId: string }
  | {
      type: "submit-challenge-action";
      goal: string;
      method: string;
      evidence: string;
      resource: string;
      successSignal: string;
      stopCondition: string;
    }
  | {
      type: "score-challenge";
      teamId: string;
      rubric: ChallengeRubric;
      consequence: string;
      idempotencyKey: string;
    }
  | {
      type: "award-reputation";
      memberId: string;
      scores: ReputationScores;
      evidenceObjectId: string;
      reason: string;
    }
  | { type: "gratitude-vote"; toMemberId: string; reason: string }
  | { type: "distribute-profit"; teamId: string; percent: 0 | 20 | 40; idempotencyKey: string }
  | { type: "propose-purchase"; assetId: string; idempotencyKey: string }
  | { type: "vote-purchase"; proposalId: string; approve: boolean; idempotencyKey: string }
  | { type: "personal-purchase"; itemId: string; idempotencyKey: string }
  | { type: "reinvest"; teamId: string; amountTenths: number; idempotencyKey: string }
  | { type: "record-financing"; teamId: string; amountTenths: number; reason: string; idempotencyKey: string }
  | {
      type: "record-paper-ledger";
      teamId: string;
      flow: "inflow" | "outflow";
      category: "user-validation" | "asset-revenue" | "research" | "product" | "market" | "operations" | "maintenance";
      amountTenths: number;
      reason: string;
      idempotencyKey: string;
    }
  | { type: "reverse-transaction"; transactionId: string; reason: string; idempotencyKey: string }
  | { type: "freeze-worldline"; teamId: string; decision: string; rationale: string }
  | { type: "reveal-history" }
  | { type: "submit-reflection"; answers: string[]; realityAction: string }
  | { type: "submit-demo-day"; title: string; segmentNotes: string[] }
  | { type: "next-chapter" }
  | { type: "archive-room" };

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: string[] };
}
