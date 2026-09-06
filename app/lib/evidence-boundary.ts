export type EvidenceBoundaryCode = "F" | "R" | "G" | "U";

export const EVIDENCE_BOUNDARY_LABELS: Record<EvidenceBoundaryCode, string> = {
  F: "F 有来源",
  R: "R 课堂模拟",
  G: "G 我们猜的",
  U: "U 还不知道",
};

export const EVIDENCE_BOUNDARY_GUIDE = Object.values(EVIDENCE_BOUNDARY_LABELS).join("｜");

type EvidenceCardLike = {
  title?: string;
  body?: string;
  kind?: string;
  sourceIds?: readonly string[];
};

/**
 * Resolve the learner-facing evidence boundary without pretending that a
 * source attached for context turns a role viewpoint or inference into fact.
 * Explicit classroom-simulation wording wins over all other hints.
 */
export function evidenceBoundaryForCard(card: EvidenceCardLike): EvidenceBoundaryCode {
  const title = card.title ?? "";
  const text = `${title} ${card.body ?? ""}`;
  const explicit = title.match(/^\s*([FRGU])(?:-|\s|·)/u)?.[1] as EvidenceBoundaryCode | undefined;
  if (explicit) return explicit;
  if (/^\s*C-\d+/u.test(title) && (card.sourceIds?.length ?? 0) > 0) return "F";
  if (/课堂模拟|玩家模拟|角色模拟|角色演练|模拟用户|模拟订单|模拟收入|模拟成本|模拟投入|模拟反馈/u.test(text)) return "R";
  if (card.kind === "viewpoint" || card.kind === "inference" || card.kind === "rumor") return "G";
  if ((card.sourceIds?.length ?? 0) > 0) return "F";
  if (/当前未知|还不知道|暂时不知道|现有信息无法回答/u.test(text)) return "U";
  return "U";
}

export function evidenceBoundaryLabel(card: EvidenceCardLike): string {
  return EVIDENCE_BOUNDARY_LABELS[evidenceBoundaryForCard(card)];
}

/** Remove opaque card prefixes after the full boundary label is shown. */
export function learnerCardTitle(title: string): string {
  return title.replace(/^\s*(?:[FRGUC])-\d+\s*·\s*/u, "").trim();
}

/**
 * Expand shorthand in every learner-visible sentence.  The replacement is
 * deliberately idempotent so projections may call it at multiple boundaries.
 */
export function expandEvidenceBoundaryShorthand(value: string): string {
  return value
    .replaceAll("F／R／G／U", EVIDENCE_BOUNDARY_GUIDE)
    .replaceAll("F/R/G/U", EVIDENCE_BOUNDARY_GUIDE)
    .replaceAll("F / R / G / U", EVIDENCE_BOUNDARY_GUIDE)
    .replace(/有来源的\s*F(?!\s*有来源)/gu, "F 有来源")
    .replace(/课堂模拟\s*R(?!\s*课堂模拟)/gu, "R 课堂模拟")
    .replace(/F\s*卡(?!有来源)/gu, "F 有来源卡")
    .replace(/R\s*卡(?!课堂模拟)/gu, "R 课堂模拟卡")
    .replace(/G\s*卡(?!我们猜的)/gu, "G 我们猜的卡")
    .replace(/U\s*卡(?!还不知道)/gu, "U 还不知道卡")
    .replace(/写着\s*F(?!\s*有来源)/gu, "写着 F 有来源")
    .replace(/写着\s*R(?!\s*课堂模拟)/gu, "写着 R 课堂模拟")
    .replace(/标(?:为)?\s*R(?!\s*课堂模拟)/gu, "标为 R 课堂模拟")
    .replace(/贴成\s*G(?!\s*我们猜的)/gu, "贴成 G 我们猜的")
    .replace(/F(?=\s*[，。；、／/])/gu, "F 有来源")
    .replace(/R(?=\s*[，。；、／/])/gu, "R 课堂模拟")
    .replace(/G(?=\s*(?:[，。；、／/]|或|与|和))/gu, "G 我们猜的")
    .replace(/U(?=\s*(?:[，。；、／/]|或|与|和|$))/gu, "U 还不知道")
    .replace(/(?<![A-Za-z0-9.&-])F(?![A-Za-z0-9.&-]|\s*有来源)/gu, "F 有来源")
    .replace(/(?<![A-Za-z0-9.&-])R(?![A-Za-z0-9.&-]|\s*课堂模拟)/gu, "R 课堂模拟")
    .replace(/(?<![A-Za-z0-9.&-])G(?![A-Za-z0-9.&-]|\s*我们猜的)/gu, "G 我们猜的")
    .replace(/(?<![A-Za-z0-9.&-])U(?![A-Za-z0-9.&-]|\s*还不知道)/gu, "U 还不知道")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

/** Apply the same learner-safe expansion to JSON-shaped user-authored data. */
export function expandEvidenceBoundaryValue<T>(value: T): T {
  if (typeof value === "string") return expandEvidenceBoundaryShorthand(value) as T;
  if (Array.isArray(value)) return value.map(expandEvidenceBoundaryValue) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expandEvidenceBoundaryValue(item)]),
    ) as T;
  }
  return value;
}
