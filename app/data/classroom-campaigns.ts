import { elemeClassroomCampaign } from "./eleme-classroom-campaign";
import { googleClassroomCampaign } from "./google-classroom-campaign";
import type { ClassroomCampaign } from "../lib/classroom-model";

export const DEFAULT_CLASSROOM_CAMPAIGN_ID = googleClassroomCampaign.id;

export const classroomCampaigns: readonly ClassroomCampaign[] = [
  googleClassroomCampaign,
  elemeClassroomCampaign,
];

export interface ClassroomCampaignSummary {
  id: string;
  title: string;
  organization: string;
  period: string;
  summary: string;
  chapterCount: number;
  courseRef?: ClassroomCampaign["courseRef"];
  chapters: Array<{
    id: string;
    order: number;
    stage: ClassroomCampaign["chapters"][number]["stage"];
    title: string;
  }>;
}

export function getClassroomCampaign(id: string): ClassroomCampaign | undefined {
  return classroomCampaigns.find((campaign) => campaign.id === id);
}

export function toClassroomCampaignSummary(campaign: ClassroomCampaign): ClassroomCampaignSummary {
  return {
    id: campaign.id,
    title: campaign.title,
    organization: campaign.organization,
    period: campaign.period,
    summary: campaign.summary,
    chapterCount: campaign.chapters.length,
    ...(campaign.courseRef ? { courseRef: campaign.courseRef } : {}),
    chapters: campaign.chapters.map(({ id, order, stage, title }) => ({ id, order, stage, title })),
  };
}

export function toLearnerCampaignSummary(
  campaign: ClassroomCampaign,
  historyRevealed: boolean,
): ClassroomCampaignSummary {
  const summary = toClassroomCampaignSummary(campaign);
  if (historyRevealed || !campaign.learnerSeal) return summary;
  return {
    ...summary,
    title: campaign.learnerSeal.title,
    organization: campaign.learnerSeal.organization,
    summary: campaign.learnerSeal.summary,
  };
}

export function toLearnerRoomTitle(
  campaign: ClassroomCampaign,
  authoredTitle: string,
  historyRevealed: boolean,
): string {
  return !historyRevealed && campaign.learnerSeal ? campaign.learnerSeal.roomTitle : authoredTitle;
}

export const classroomCampaignCatalog = classroomCampaigns.map(toClassroomCampaignSummary);

export function assertClassroomCampaignRegistry(campaigns: readonly ClassroomCampaign[] = classroomCampaigns): void {
  const ids: string[] = [];
  const chapterIds: string[] = [];
  const identityIds: string[] = [];
  const cardIds: string[] = [];
  const assetIds: string[] = [];

  for (const campaign of campaigns) {
    ids.push(campaign.id);
    if (!campaign.chapters.length) throw new Error(`Campaign has no chapters: ${campaign.id}`);
    if (!campaign.assets.length) throw new Error(`Campaign has no assets: ${campaign.id}`);
    if (campaign.learnerSeal) {
      for (const [field, value] of Object.entries(campaign.learnerSeal)) {
        if (!value.trim()) throw new Error(`Campaign learner seal ${field} is empty: ${campaign.id}`);
        if (value.includes(campaign.organization)) throw new Error(`Campaign learner seal exposes organization: ${campaign.id}`);
      }
    }
    const sourceIds = new Set(campaign.sources.map((source) => source.id));
    const expectedOrders = campaign.chapters.map((_, index) => index + 1);
    if (campaign.chapters.some((chapter, index) => chapter.order !== expectedOrders[index])) {
      throw new Error(`Campaign chapter order is not contiguous: ${campaign.id}`);
    }
    for (const chapter of campaign.chapters) {
      chapterIds.push(chapter.id);
      identityIds.push(...chapter.identities.map((identity) => identity.id));
      cardIds.push(...chapter.infoCards.map((card) => card.id));
      if (chapter.identities.length !== 4) throw new Error(`Chapter must have exactly 4 identities: ${chapter.id}`);
      if (chapter.infoCards.length !== 12) throw new Error(`Chapter must have exactly 12 cards: ${chapter.id}`);
      if (chapter.challenges.length !== 3 || chapter.challenges.some((challenge, index) => challenge.level !== index + 1)) {
        throw new Error(`Chapter must have L1/L2/L3 challenges: ${chapter.id}`);
      }
      if (chapter.pressureEvents.length !== 6 || chapter.pressureEvents.some((event, index) => event.die !== index + 1)) {
        throw new Error(`Chapter must have die 1–6 pressure events: ${chapter.id}`);
      }
      const localIdentityIds = new Set(chapter.identities.map((identity) => identity.id));
      for (const card of chapter.infoCards) {
        if (!localIdentityIds.has(card.holderIdentityId)) throw new Error(`Unknown card holder ${card.holderIdentityId}: ${card.id}`);
        for (const sourceId of card.sourceIds) {
          if (!sourceIds.has(sourceId)) throw new Error(`Unknown card source ${sourceId}: ${card.id}`);
        }
      }
      for (const sourceId of chapter.historyReveal.sourceIds) {
        if (!sourceIds.has(sourceId)) throw new Error(`Unknown history source ${sourceId}: ${chapter.id}`);
      }
    }
    assetIds.push(...campaign.assets.map((asset) => asset.id));
    if (campaign.demoDay.durationSeconds !== 360 || campaign.demoDay.segments.length !== 7) {
      throw new Error(`Campaign Demo Day must be 360 seconds with 7 segments: ${campaign.id}`);
    }
    let cursor = 0;
    for (const segment of campaign.demoDay.segments) {
      if (segment.startSecond !== cursor || segment.endSecond <= segment.startSecond) {
        throw new Error(`Campaign Demo Day segments are not contiguous: ${campaign.id}`);
      }
      cursor = segment.endSecond;
    }
    if (cursor !== 360) throw new Error(`Campaign Demo Day does not end at 360 seconds: ${campaign.id}`);
  }

  for (const [label, values] of [
    ["campaign", ids],
    ["chapter", chapterIds],
    ["identity", identityIds],
    ["card", cardIds],
    ["asset", assetIds],
  ] as const) {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} id in classroom campaign registry.`);
  }
}

assertClassroomCampaignRegistry();
