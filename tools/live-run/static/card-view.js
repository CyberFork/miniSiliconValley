(function cardViewFactory(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MsvCardView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const boundaryLabels = Object.freeze({
    F: "F 有来源",
    R: "R 课堂模拟",
    G: "G 我们猜的",
    U: "U 还不知道",
  });
  const boundaryNotes = Object.freeze({
    F: "可查来源",
    R: "不是史实",
    G: "需要验证",
    U: "继续调查",
  });
  const cardStates = Object.freeze({
    held: "在我手中",
    unread: "未读",
    read: "已读",
    published: "已向团队讲出",
  });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    })[character]);
  }

  function expandBoundaryText(value) {
    return String(value ?? "")
      .replaceAll("F／R／G／U", "F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道")
      .replaceAll("F/R/G/U", "F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道")
      .replace(/有来源的\s*F(?!\s*有来源)/gu, "F 有来源")
      .replace(/课堂模拟\s*R(?!\s*课堂模拟)/gu, "R 课堂模拟")
      .replace(/F\s*卡(?!有来源)/gu, "F 有来源卡")
      .replace(/R\s*卡(?!课堂模拟)/gu, "R 课堂模拟卡")
      .replace(/标(?:为)?\s*R(?!\s*课堂模拟)/gu, "标为 R 课堂模拟")
      .replace(/贴成\s*G(?!\s*我们猜的)/gu, "贴成 G 我们猜的")
      .replace(/F(?=\s*[，。；、／/])/gu, "F 有来源")
      .replace(/R(?=\s*[，。；、／/])/gu, "R 课堂模拟")
      .replace(/G(?=\s*(?:[，。；、／/]|或|与|和))/gu, "G 我们猜的")
      .replace(/U(?=\s*(?:[，。；、／/]|或|与|和|$))/gu, "U 还不知道")
      .replace(/(?<![A-Za-z0-9.&-])F(?![A-Za-z0-9.&-]|\s*有来源)/gu, "F 有来源")
      .replace(/(?<![A-Za-z0-9.&-])R(?![A-Za-z0-9.&-]|\s*课堂模拟)/gu, "R 课堂模拟")
      .replace(/(?<![A-Za-z0-9.&-])G(?![A-Za-z0-9.&-]|\s*我们猜的)/gu, "G 我们猜的")
      .replace(/(?<![A-Za-z0-9.&-])U(?![A-Za-z0-9.&-]|\s*还不知道)/gu, "U 还不知道");
  }

  function cardBoundary(card) {
    const explicit = String(card?.evidenceBoundary || card?.boundary || "").toUpperCase();
    if (boundaryLabels[explicit]) return explicit;
    const prefix = String(card?.title || "").match(/^\s*([FRGU])-\d+/iu)?.[1]?.toUpperCase();
    if (prefix && boundaryLabels[prefix]) return prefix;
    const text = `${card?.body || ""} ${card?.sharePrompt || ""}`;
    if (/玩家模拟|课堂模拟|不是史实/u.test(text)) return "R";
    if (/推测|猜测|待验证/u.test(text)) return "G";
    if (/未知|还不知道|无法回答/u.test(text)) return "U";
    if (/来源|公开资料|历史边界/u.test(text)) return "F";
    return "U";
  }

  function cleanCardTitle(value) {
    return String(value ?? "")
      .replace(/^\s*(?:[FRGU](?:-\d+)?|C-\d+)\s*·\s*/u, "")
      .trim();
  }

  function renderLearnerCard(card, index = 0, options = {}) {
    const boundary = cardBoundary(card);
    const state = options.state || card?.state || "unread";
    const sources = Array.isArray(card?.sourceIds) ? card.sourceIds : [];
    const position = Number.isInteger(index) && index >= 0 ? index + 1 : 1;
    const sourceLine = boundary === "F"
      ? `<small class="card-source-ids">来源编号：${escapeHtml(sources.join(" · ") || "缺失，请告知导师")}</small>`
      : "";
    return `<article class="private-card" data-boundary="${escapeHtml(boundary)}" data-card-state="${escapeHtml(state)}">`
      + `<small class="private-card-meta">私密卡 ${position} · ${escapeHtml(boundaryLabels[boundary])} · ${escapeHtml(boundaryNotes[boundary])} · ${escapeHtml(cardStates[state] || "待确认")}</small>`
      + `<b>${escapeHtml(cleanCardTitle(card?.title))}</b>`
      + `<p>${escapeHtml(expandBoundaryText(card?.body))}</p>`
      + `<em><span>交给队友时说：</span>${escapeHtml(expandBoundaryText(card?.sharePrompt))}</em>`
      + sourceLine
      + `</article>`;
  }

  return Object.freeze({
    boundaryLabels,
    boundaryNotes,
    cardStates,
    escapeHtml,
    expandBoundaryText,
    cardBoundary,
    cleanCardTitle,
    renderLearnerCard,
  });
});
