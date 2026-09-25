import type { MissionChoice, MissionEvidence } from "./model";

export function missingEvidenceIds(choice: MissionChoice, selectedEvidenceIds: string[]) {
  const selected = new Set(selectedEvidenceIds);
  return (choice.requiresEvidenceIds ?? []).filter((id) => !selected.has(id));
}

export function countUnlockedChoices(choices: MissionChoice[], selectedEvidenceIds: string[]) {
  return choices.filter((choice) => missingEvidenceIds(choice, selectedEvidenceIds).length === 0).length;
}

export function evidenceTitles(evidence: MissionEvidence[], evidenceIds: string[]) {
  const titleById = new Map(evidence.map((item) => [item.id, item.title]));
  return evidenceIds.map((id) => titleById.get(id)).filter((title): title is string => Boolean(title));
}
