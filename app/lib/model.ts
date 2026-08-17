export const DATA_SCHEMA_VERSION = 1 as const;
export const CURRICULUM_SCHEMA_VERSION = 1 as const;

export type HistoryCategory =
  | "education"
  | "defense"
  | "semiconductor"
  | "computing"
  | "network"
  | "software"
  | "venture"
  | "mobile"
  | "cloud"
  | "ai"
  | "robotics"
  | "global";

export type SourceKind =
  | "official-archive"
  | "company-history"
  | "museum"
  | "university"
  | "government"
  | "standards-body"
  | "research-paper";

export interface SourceRecord {
  id: string;
  title: string;
  organization: string;
  url: string;
  kind: SourceKind;
  accessed: "2026-08-10";
  note?: string;
}

export interface EraRecord {
  id: string;
  start: number;
  end: number;
  title: string;
  shortTitle: string;
  question: string;
  description: string;
  accent: string;
  mapLayer: "1939" | "1968" | "1998" | "2026";
}

export interface PlaceRecord {
  id: string;
  name: string;
  region: string;
  country: string;
  description: string;
  x: number;
  y: number;
  portal?: boolean;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  kind: "company" | "university" | "government" | "lab" | "community" | "fund" | "standards";
  founded?: number;
  placeId: string;
  summary: string;
}

export interface PersonRecord {
  id: string;
  name: string;
  roles: string[];
  organizationIds: string[];
  summary: string;
}

export interface TechnologyRecord {
  id: string;
  name: string;
  kind: "product" | "technology" | "standard" | "business-model" | "practice";
  introduced: number;
  summary: string;
}

export interface HistoryEvent {
  id: string;
  year: number;
  date?: string;
  title: string;
  summary: string;
  significance: string;
  placeId: string;
  category: HistoryCategory;
  sourceIds: string[];
  organizationIds: string[];
  personIds: string[];
  technologyIds: string[];
  relatedEventIds: string[];
  tags: string[];
  missionId?: string;
  map: { x: number; y: number };
  certainty?: "documented" | "contested" | "approximate";
  caveat?: string;
}

export interface HistoryCatalog {
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  eras: EraRecord[];
  places: PlaceRecord[];
  organizations: OrganizationRecord[];
  people: PersonRecord[];
  technologies: TechnologyRecord[];
  sources: SourceRecord[];
  events: HistoryEvent[];
}

export type ResourceKey = "evidence" | "trust" | "runway" | "craft";
export type ResourceDelta = Partial<Record<ResourceKey, number>>;

export interface MissionEvidence {
  id: string;
  label: string;
  title: string;
  body: string;
  sourceIds: string[];
  tension: string;
}

export interface MissionChoice {
  id: string;
  label: string;
  action: string;
  rationale: string;
  requiresEvidenceIds?: string[];
  delta: ResourceDelta;
  outcomeTitle: string;
  outcome: string;
  consequence: string;
  capability: string;
}

export interface MissionRecord {
  id: string;
  eventId: string;
  order: number;
  title: string;
  subtitle: string;
  year: number;
  durationMinutes: number;
  domain: HistoryCategory;
  briefing: string;
  situation: string;
  historicalBoundary: string[];
  role: {
    name: string;
    goal: string;
    privateBrief: string;
    teamRoles: string[];
  };
  evidence: MissionEvidence[];
  decisionPrompt: string;
  choices: MissionChoice[];
  history: {
    title: string;
    happened: string;
    comparisonPrompts: string[];
    sourceIds: string[];
  };
  reflection: string[];
  realityMission: {
    title: string;
    deliverable: string;
    timeboxMinutes: number;
    acceptance: string[];
  };
  facilitator: {
    opening: string;
    prompts: string[];
    watchFor: string[];
    debrief: string[];
  };
}

export type ProjectStageId =
  | "find-problem"
  | "validate-problem"
  | "design-solution"
  | "mvp-vc"
  | "operate-brand"
  | "demo-day";

export type CurriculumMappingKind = "direct" | "course-analogy";

export interface CurriculumExample {
  id: string;
  organization: string;
  label: string;
  yearLabel: string;
  eventIds: string[];
  missionId?: string;
  mappingKind: CurriculumMappingKind;
  teachingUse: string;
}

export interface CurriculumStage {
  id: ProjectStageId;
  order: number;
  title: string;
  englishTitle: string;
  promise: string;
  coreQuestion: string;
  learningGoals: string[];
  actions: string[];
  artifacts: string[];
  completionGate: string[];
  examples: CurriculumExample[];
}

export interface CompanyJourneyStep {
  stageId: ProjectStageId;
  period: string;
  title: string;
  eventIds: string[];
  mappingKind: CurriculumMappingKind;
  teachingUse: string;
}

export interface CompanyJourney {
  id: string;
  organization: string;
  product: string;
  period: string;
  title: string;
  summary: string;
  missionId?: string;
  steps: CompanyJourneyStep[];
}

export interface CurriculumContributionField {
  key: string;
  label: string;
  requirement: string;
}

export interface CurriculumCatalog {
  schemaVersion: typeof CURRICULUM_SCHEMA_VERSION;
  stages: CurriculumStage[];
  companyJourneys: CompanyJourney[];
  contributionProtocol: CurriculumContributionField[];
  nonNegotiables: string[];
}

export interface MissionResult {
  missionId: string;
  choiceId: string;
  evidenceIds: string[];
  delta: ResourceDelta;
  resources: Record<ResourceKey, number>;
  reflection?: string;
  realityCommitment?: string;
  completedAt: string;
}

export interface PlayerState {
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  currentYear: number;
  selectedCategory: HistoryCategory | "all";
  query: string;
  visitedEventIds: string[];
  results: MissionResult[];
  resources: Record<ResourceKey, number>;
  activeMissionId?: string;
  savedAt: string;
}
