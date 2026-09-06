export const TEAM_PUBLIC_ID_PATTERN = /^TEAM-[A-Z2-9]{8}$/;

/**
 * Accept IDs with or without the visual dash and normalize pasted punctuation.
 * The generated alphabet deliberately excludes ambiguous 0 and 1.
 */
export function normalizeTeamPublicId(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (clean.length <= 4 && "TEAM".startsWith(clean)) return clean;
  const suffix = (clean.startsWith("TEAM") ? clean.slice(4) : clean).slice(0, 8);
  return suffix ? `TEAM-${suffix}` : "";
}

export function validTeamPublicId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeTeamPublicId(value);
  return TEAM_PUBLIC_ID_PATTERN.test(normalized) ? normalized : null;
}
