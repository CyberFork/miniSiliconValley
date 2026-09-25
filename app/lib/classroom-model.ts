export const CLASSROOM_SCHEMA_VERSION = 1 as const;

export const CLASSROOM_PHASES = [
  "lobby",
  "identity",
  "private-read",
  "intel-brief",
  "intel-network",
  "dm-gate",
  "pdmo",
  "challenge-one",
  "challenge-two",
  "growth",
  "history",
  "debrief",
  "completed",
] as const;

export type ClassroomPhase = (typeof CLASSROOM_PHASES)[number];
export type CampaignStage =
  | "find"
  | "decide"
  | "build"
  | "market"
  | "operate"
  | "find-problem"
  | "validate-problem"
  | "design-solution"
  | "build-mvp"
  | "operate-brand";
export type PDMORole = "P" | "D" | "M" | "O";
export type ClassroomMemberRole = "dm" | "learner";
export type RelationshipKind = "causes" | "supports" | "limits" | "contradicts" | "hypothesis";
export type IntelligenceNodeKind = "person" | "user" | "need" | "event" | "technology" | "constraint" | "evidence";
export type InformationKind = "fact" | "observation" | "viewpoint" | "inference" | "rumor";
export type Credibility = "high" | "medium" | "low";
export type ChallengeLevel = 1 | 2 | 3;
export type AssetType = "research" | "product" | "market" | "operations" | "infrastructure" | "brand" | "channel";
export type ReputationDimension = "evidence" | "modeling" | "delivery" | "support" | "iteration" | "responsibility";
export type LedgerAccountKind = "system" | "team-treasury" | "personal-wallet";
export type LedgerCategory =
  | "mission-contract"
  | "user-validation"
  | "asset-revenue"
  | "financing"
  | "research"
  | "product"
  | "market"
  | "operations"
  | "maintenance"
  | "distribution"
  | "personal-purchase"
  | "reinvestment"
  | "correction";

export interface ClassroomSource {
  id: string;
  title: string;
  organization: string;
  url: string;
  kind: "official" | "university" | "research-paper" | "company-history";
  accessed: string;
}

export interface CaseIdentity {
  id: string;
  name: string;
  nature: "historical" | "historical-collaborator" | "composite";
  publicGoal: string;
  privateConcern: string;
  ability: string;
}

export interface ClassroomInfoCard {
  id: string;
  holderIdentityId: string;
  kind: InformationKind;
  title: string;
  body: string;
  sourceIds: string[];
  credibility: Credibility;
  sharePrompt: string;
}

export interface IntelGateDefinition {
  requiredSourceBackedEvidence: number;
  requireUserOrPerson: boolean;
  requireSceneLoss: boolean;
  requireConstraint: boolean;
  requireContradictionOrGap: boolean;
  requireLeadSupportLink: boolean;
}

export interface ClassroomChallenge {
  id: string;
  level: ChallengeLevel;
  title: string;
  prompt: string;
  requiredArtifact: string;
  recommendedLead: PDMORole;
  requiredSupport: PDMORole[];
  baseIncomeTenths: number;
}

export interface PressureEventDefinition {
  die: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  effect: string;
  mitigation: string;
}

export interface HistoryRevealDefinition {
  happened: string;
  comparisonPrompts: string[];
  sourceIds: string[];
}

export interface RealityMissionDefinition {
  title: string;
  deliverable: string;
  timeboxMinutes: number;
  acceptance: string[];
}

export interface ChapterFacilitatorGuide {
  opening: string;
  prompts: string[];
  watchFor: string[];
  debrief: string[];
}

export interface ClassroomChapter {
  id: string;
  order: number;
  stage: CampaignStage;
  title: string;
  timeRange: string;
  location: string;
  briefing: string;
  learningGoal: string;
  historicalBoundary: string[];
  /** Runtime deal contract; absent only on pre-T-085 legacy campaigns. */
  cardsPerLearner?: number;
  maxLearners?: number;
  identities: CaseIdentity[];
  infoCards: ClassroomInfoCard[];
  intelGate: IntelGateDefinition;
  challenges: ClassroomChallenge[];
  pressureEvents: PressureEventDefinition[];
  historyReveal: HistoryRevealDefinition;
  realityMission: RealityMissionDefinition;
  dm: ChapterFacilitatorGuide;
}

export interface ClassroomAssetDefinition {
  id: string;
  name: string;
  type: AssetType;
  priceTenths: number;
  valueTenths: number;
  maintenanceTenths: number;
  ability: string;
  prerequisiteRp: number;
  risk: string;
  unlocks: string;
}

export interface DemoDayDefinition {
  durationSeconds: 360;
  segments: Array<{
    id: string;
    startSecond: number;
    endSecond: number;
    title: string;
    requirement: string;
  }>;
  rubric: string[];
}

export interface ClassroomCampaign {
  schemaVersion: typeof CLASSROOM_SCHEMA_VERSION;
  id: string;
  title: string;
  organization: string;
  period: string;
  summary: string;
  /**
   * Optional answer-safe labels used for learner responses until the DM opens
   * the historical reveal. Internal IDs remain stable for persistence; these
   * labels prevent a campaign picker or room name from spoiling a mystery case.
   */
  learnerSeal?: {
    title: string;
    organization: string;
    summary: string;
    roomTitle: string;
  };
  sources: ClassroomSource[];
  assets: ClassroomAssetDefinition[];
  chapters: ClassroomChapter[];
  demoDay: DemoDayDefinition;
  /** Exact immutable Course Registry version. Missing only for legacy rooms. */
  courseRef?: import("./course-package").CoursePackageRef;
}

export interface IntelligenceNode {
  id: string;
  kind: IntelligenceNodeKind;
  title: string;
  explanation: string;
  sourceCardIds: string[];
  publishedByMemberId: string;
}

export interface RelationshipEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: RelationshipKind;
  explanation: string;
  createdByMemberId: string;
}

export interface IntelGateState {
  nodes: IntelligenceNode[];
  edges: RelationshipEdge[];
  hasSceneLoss: boolean;
  hasExplicitConstraint: boolean;
  hasContradictionOrGap: boolean;
  hasLeadSupportLink: boolean;
}

export interface IntelGateResult {
  passed: boolean;
  missing: string[];
  sourceBackedEvidenceCount: number;
}

export interface ChallengeRubric {
  evidence: 0 | 1;
  logic: 0 | 1;
  execution: 0 | 1;
  collaboration: 0 | 1;
}

export type ChallengeOutcome = "full-success" | "success" | "costly-success" | "learning-failure";

export interface ChallengeResolution {
  score: number;
  outcome: ChallengeOutcome;
  incomeTenths: number;
  insight: number;
  requiresConsequence: boolean;
}

export interface ReputationScores {
  evidence: number;
  modeling: number;
  delivery: number;
  support: number;
  iteration: number;
  responsibility: number;
}

export interface ReputationResult {
  total: number;
  cumulative: number;
  normalized: ReputationScores;
  unlockIds: string[];
}

export interface ReputationUnlock {
  id: string;
  threshold: number;
  name: string;
  ability: string;
}

export interface DistributionMemberInput {
  memberId: string;
  eligible: boolean;
  roleDeliveryScore: number;
}

export interface GratitudeVote {
  fromMemberId: string;
  toMemberId: string;
  reason: string;
}

export interface ProfitDistributionInput {
  availableProfitTenths: number;
  distributionPercent: 0 | 20 | 40;
  members: DistributionMemberInput[];
  gratitudeVotes: GratitudeVote[];
}

export interface ProfitDistributionResult {
  poolTenths: number;
  retainedTenths: number;
  payoutsTenths: Record<string, number>;
  invalidVotes: GratitudeVote[];
}

export interface LedgerTransaction {
  id: string;
  roomId: string;
  chapterId: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  amountTenths: number;
  category: LedgerCategory;
  sourceObjectId: string;
  createdByMemberId: string;
  createdAt: string;
  idempotencyKey: string;
  reason: string;
  reversalOf: string | null;
}

export interface ClassroomProfileView {
  id: string;
  nickname: string;
  reputation: number;
  walletTenths: number;
  unlockIds: string[];
}

export interface ClassroomMemberView {
  id: string;
  profile: ClassroomProfileView;
  role: ClassroomMemberRole;
  teamId: string | null;
  caseIdentityId: string | null;
}

export interface ClassroomRoomSummary {
  id: string;
  code: string;
  title: string;
  campaignId: string;
  chapterId: string;
  phase: ClassroomPhase;
  status: "active" | "archived";
  memberRole: ClassroomMemberRole;
  updatedAt: string;
}
