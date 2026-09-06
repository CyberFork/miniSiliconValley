(() => {
  "use strict";

  const SNAPSHOT_URL = "confirmed-baseline.json";
  const MAX_BYTES = 1024 * 1024;
  const BASELINE_KEY = "msv.workshop.confirmed-baseline.v1";
  const BACKUP_KEY = "msv.workshop.confirmed-baseline.backup.v1";
  const PROPOSAL_KEY = "msv.workshop.baseline.proposals.v1";
  const DECISION_KEY = "msv.workshop.baseline.decisions.v1";
  const AUDIT_KEY = "msv.workshop.baseline.audit.v1";
  const ACTOR_KEY = "msv.workshop.baseline.actor.v1";
  const STEP_IDS = ["find", "decide", "build", "market", "operate"];
  const BOUNDARIES = ["F", "R", "G", "U"];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
  let current = null;
  let latest = null;
  let diffReviewed = false;
  let diffResult = null;
  let proposals = readArray(PROPOSAL_KEY);
  let decisions = readArray(DECISION_KEY);
  let audit = readArray(AUDIT_KEY).slice(-100);

  function safeParse(raw, label) {
    if (typeof raw !== "string" || new Blob([raw]).size > MAX_BYTES) throw new Error(`${label} 超过 1 MiB 安全上限。`);
    const value = JSON.parse(raw);
    assertSafe(value);
    return value;
  }

  function assertSafe(value, depth = 0, seen = new Set()) {
    if (depth > 18) throw new Error("数据嵌套过深。");
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) throw new Error("数据包含循环结构。");
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error(`拒绝危险字段：${key}`);
      assertSafe(value[key], depth + 1, seen);
    }
    seen.delete(value);
  }

  function readArray(key) {
    try {
      const value = safeParse(localStorage.getItem(key) || "[]", key);
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function digest(value) {
    const bytes = new TextEncoder().encode(stable(value));
    const result = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(result)].map((item) => item.toString(16).padStart(2, "0")).join("");
  }

  async function validateSnapshot(snapshot) {
    assertSafe(snapshot);
    if (!snapshot || snapshot.snapshotVersion !== 1 || snapshot.scope !== "public-redacted-summary") throw new Error("只接受 Workshop Snapshot v1 的公开脱敏投影。");
    if (snapshot.source?.registry !== "course-registry" || snapshot.source?.channel !== "released") throw new Error("快照不是 Course Registry 的 Released 通道。");
    if (!Array.isArray(snapshot.courses) || !snapshot.courses.length || snapshot.courses.length !== snapshot.source.courseCount) throw new Error("快照课程数量不完整。");
    if (snapshot.confirmedFramework?.learnerRole !== "学员统一为 Young Builder；不固定分成 P/D/M/O。") throw new Error("快照仍含旧的学员 P/D/M/O 定位。");
    if (!Array.isArray(snapshot.mentorRoles) || snapshot.mentorRoles.map((item) => item.code).join("") !== "PDMO") throw new Error("四导师 P/D/M/O 定位不完整。");
    const refs = [];
    for (const course of snapshot.courses) {
      if (course.status !== "released" || !/^[a-f0-9]{64}$/.test(course.digest) || !Number.isInteger(course.revision) || course.revision < 0) throw new Error(`${course.courseId || "未知课程"} 不是 exact Released 引用。`);
      if (!Array.isArray(course.macroSteps) || course.macroSteps.map((item) => item.id).join(",") !== STEP_IDS.join(",")) throw new Error(`${course.courseId} 不是已确认五步。`);
      if (!Array.isArray(course.blocks) || course.blocks.length !== 13 || course.blocks.some((item, index) => item.order !== index + 1)) throw new Error(`${course.courseId} 不是 13 个有序 Block。`);
      if (!Array.isArray(course.deckSummary) || course.deckSummary.length !== 5) throw new Error(`${course.courseId} 缺少五组卡组。`);
      const allIds = [];
      for (const deck of course.deckSummary) {
        if (deck.cardCount < 12 || !Array.isArray(deck.stableCardIds) || deck.stableCardIds.length !== deck.cardCount) throw new Error(`${course.courseId} 的 ${deck.id} 不足 12 张或 ID 不完整。`);
        if (BOUNDARIES.some((key) => !Number.isInteger(deck.boundaryCounts?.[key]))) throw new Error(`${deck.id} 缺少 F/R/G/U 统计。`);
        if (Object.values(deck.boundaryCounts).reduce((sum, count) => sum + count, 0) !== deck.cardCount || deck.factCardsWithSources !== deck.boundaryCounts.F) throw new Error(`${deck.id} 的来源边界统计不通过。`);
        allIds.push(...deck.stableCardIds);
      }
      if (new Set(allIds).size !== allIds.length) throw new Error(`${course.courseId} 存在重复卡牌 ID。`);
      refs.push({courseId:course.courseId,schemaVersion:course.schemaVersion,revision:course.revision,digest:course.digest,status:course.status});
    }
    if (await digest(refs) !== snapshot.source.aggregateDigest) throw new Error("课程引用 aggregate digest 不匹配。");
    const unsigned = Object.fromEntries(Object.entries(snapshot).filter(([key]) => !["integrity", "confirmedAt", "confirmedBy"].includes(key)));
    if (snapshot.integrity?.algorithm !== "sha256" || await digest(unsigned) !== snapshot.integrity.digest) throw new Error("快照 integrity digest 不匹配；继续保留旧基线。");
    return snapshot;
  }

  function short(value) { return value ? String(value).slice(0, 12) : "—"; }
  function stamp(snapshot) { return snapshot ? `${snapshot.courses.length} 门 · ${short(snapshot.integrity.digest)}` : "尚未载入"; }
  function selectedCourse(snapshot = current) {
    if (!snapshot) return null;
    const selected = $("#baselineCourseSelect")?.value;
    return snapshot.courses.find((course) => course.courseId === selected) || snapshot.courses[0];
  }

  function compareSnapshots(from, to) {
    const changes = [];
    const blocked = [];
    if (!from) changes.push(`首次建立会议基线：${to.courses.length} 门 Released 课程。`);
    const before = new Map((from?.courses || []).map((course) => [course.courseId, course]));
    const after = new Map(to.courses.map((course) => [course.courseId, course]));
    for (const [id, oldCourse] of before) {
      const nextCourse = after.get(id);
      if (!nextCourse) { blocked.push(`课程 ${id} 从最新快照中消失。`); continue; }
      if (nextCourse.revision < oldCourse.revision) blocked.push(`${id} 从 r${oldCourse.revision} 倒退到 r${nextCourse.revision}。`);
      else if (nextCourse.revision === oldCourse.revision && nextCourse.digest !== oldCourse.digest) blocked.push(`${id} 同一 r${oldCourse.revision} 出现不同 digest。`);
      else if (nextCourse.digest !== oldCourse.digest) changes.push(`${id}: r${oldCourse.revision}/${short(oldCourse.digest)} → r${nextCourse.revision}/${short(nextCourse.digest)}`);
    }
    for (const [id, course] of after) if (!before.has(id)) changes.push(`新增 ${id} r${course.revision}/${short(course.digest)}`);
    if (from && from.integrity.digest === to.integrity.digest) changes.push("已与课程源最新 Released 快照一致。");
    return {changes, blocked, safe: blocked.length === 0};
  }

  function addAudit(action, result, fromDigest = current?.integrity?.digest || null, toDigest = latest?.integrity?.digest || null, actor = $("#baselineActor")?.value.trim() || "anonymous") {
    audit.push({at:now(), actor:actor.slice(0,60), action, result, fromDigest, toDigest});
    audit = audit.slice(-100); write(AUDIT_KEY, audit); renderAudit();
  }

  function showError(message) {
    const node = $("#baselineError"); node.hidden = !message; node.textContent = message || "";
    if (message) $("#baselineLoadState").dataset.state = "error";
  }

  function renderSource() {
    $("#baselineCurrentSource").textContent = stamp(current);
    $("#baselineCurrentTime").textContent = current ? `确认于 ${new Date(current.confirmedAt || current.generatedAt).toLocaleString("zh-CN")}` : "等待人工确认";
    $("#baselineLatestSource").textContent = stamp(latest);
    $("#baselineLatestTime").textContent = latest ? `生成于 ${new Date(latest.generatedAt).toLocaleString("zh-CN")}` : "—";
    const state = $("#baselineLoadState");
    state.textContent = latest ? current?.integrity.digest === latest.integrity.digest ? "已同步" : "有待审阅更新" : current ? "沿用旧基线" : "未就绪";
    state.dataset.state = latest ? current?.integrity.digest === latest.integrity.digest ? "current" : "pending" : "error";
    const courses = (current || latest)?.courses || [];
    const previous = $("#baselineCourseSelect").value;
    $("#baselineCourseSelect").innerHTML = courses.map((course) => `<option value="${esc(course.courseId)}">${esc(course.title)} · r${course.revision}</option>`).join("");
    if (courses.some((course) => course.courseId === previous)) $("#baselineCourseSelect").value = previous;
    $("#previewBaselineDiff").disabled = !latest;
    $("#applyBaselineUpdate").disabled = !diffReviewed || !diffResult?.safe || current?.integrity.digest === latest?.integrity.digest;
  }

  function renderBaseline() {
    const course = selectedCourse();
    if (!current || !course) {
      $("#baselineFramework").innerHTML = "<p>尚未建立会议基线。核验并审阅差异后，再明确点击刷新。</p>";
      $("#baselineSteps").innerHTML = ""; $("#baselineDecks").innerHTML = ""; return;
    }
    const framework = current.confirmedFramework;
    const items = [
      ["1 · 一世界", framework.oneWorld], ["2 · 两轨线", framework.twoTracks.join(" × ")],
      ["3 · 三引擎", framework.threeEngines.join("；")], ["4 · 四导师", framework.fourMentors.join(" / ")],
      ["5 · 五步骤", framework.fiveSteps.join(" → ")], ["6 · 六分钟", framework.sixMinuteFinale],
    ];
    $("#baselineFramework").innerHTML = items.map(([name, value]) => `<div><b>${esc(name)}</b><span>${esc(value)}</span></div>`).join("");
    const blockCounts = Object.fromEntries(STEP_IDS.map((id) => [id, course.blocks.filter((block) => block.macroStepId === id).length]));
    $("#baselineSteps").innerHTML = course.macroSteps.map((step) => `<div class="baseline-step"><span>${step.order}</span><div><b>${esc(step.name)}</b><small>${esc(step.exitGate)}</small></div><em>${blockCounts[step.id]} Block</em></div>`).join("");
    const cards = course.deckSummary.reduce((sum, deck) => sum + deck.cardCount, 0);
    $("#baselineDecks").innerHTML = `<b>${esc(course.title)} · r${course.revision} · ${short(course.digest)}</b><br>${course.blocks.length} Block · 5 组卡组 / ${cards} 张 · F 卡 ${course.sourceSummary.factCardsWithSources}/${course.sourceSummary.factCardCount} 均有来源 · ${course.sourceSummary.count} 条来源。`;
  }

  function decisionFor(proposalId) { return [...decisions].reverse().find((item) => item.proposalId === proposalId); }
  function renderCollaboration() {
    const baseDigest = current?.integrity?.digest;
    $("#baselineProposalCount").textContent = String(proposals.length);
    $("#baselineProposalList").innerHTML = proposals.length ? proposals.map((item) => {
      const stale = item.baseDigest !== baseDigest;
      return `<div class="baseline-item" data-stale="${stale}" data-proposal-id="${esc(item.id)}"><b>${esc(item.title)}</b><span>${esc(item.body)}</span><small>${stale ? "⚠ 基线已更新：该提案仍绑定旧 digest，回流前必须重新审阅。" : `基于 ${short(item.baseDigest)}`} · 负责人 ${esc(item.owner)} · ${new Date(item.createdAt).toLocaleString("zh-CN")}</small><div class="baseline-item-actions"><button type="button" data-baseline-action="delete">删除提案</button></div></div>`;
    }).join("") : '<p class="baseline-empty">暂无提案。对只读基线的任何修改都从这里开始。</p>';
    $("#baselineDecisionCount").textContent = String(decisions.length);
    $("#baselineDecisionList").innerHTML = proposals.length ? proposals.map((item) => {
      const decision = decisionFor(item.id);
      return `<div class="baseline-item" data-proposal-id="${esc(item.id)}"><b>${esc(item.title)}</b><span>${decision ? (decision.outcome === "accepted" ? "已同意回流" : "已拒绝") : "等待会议决定"}</span><small>${decision ? `${esc(decision.actor)} · ${new Date(decision.at).toLocaleString("zh-CN")}` : `负责人 ${esc(item.owner)}`}</small><div class="baseline-item-actions"><button type="button" data-baseline-decision="accepted">同意回流</button><button type="button" data-baseline-decision="rejected">拒绝</button></div></div>`;
    }).join("") : '<p class="baseline-empty">还没有需要决议的提案。</p>';
    const accepted = proposals.filter((item) => decisionFor(item.id)?.outcome === "accepted");
    $("#baselineReturnCount").textContent = String(accepted.length);
    $("#baselineReturnList").innerHTML = accepted.length ? accepted.map((item) => `<div class="baseline-item"><b>${esc(item.title)}</b><span>待课程编辑器人工审核</span><small>base ${short(item.baseDigest)} · 负责人 ${esc(item.owner)}</small></div>`).join("") : '<p class="baseline-empty">没有已同意的回流变更。</p>';
    $("#exportBaselineChanges").disabled = !accepted.length;
  }

  function renderAudit() {
    $("#baselineAuditLog").innerHTML = audit.length ? [...audit].reverse().map((item) => `<li><time>${new Date(item.at).toLocaleString("zh-CN")}</time> · ${esc(item.actor)} · ${esc(item.action)} · ${esc(item.result)} · ${short(item.fromDigest)} → ${short(item.toDigest)}</li>`).join("") : "<li>暂无基线操作。</li>";
  }

  function renderAll() { renderSource(); renderBaseline(); renderCollaboration(); renderAudit(); }

  async function restoreCurrent() {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (!raw) return;
    try { current = await validateSnapshot(safeParse(raw, "当前会议基线")); }
    catch (error) { showError(`本机会议基线无效：${error.message}。未用于显示。`); addAudit("restore", "invalid-local-baseline", null, null); }
  }

  async function loadLatest() {
    diffReviewed = false; diffResult = null; $("#applyBaselineUpdate").disabled = true;
    try {
      const response = await fetch(SNAPSHOT_URL, {cache:"no-store", headers:{Accept:"application/json"}});
      if (!response.ok) throw new Error(`课程源返回 ${response.status}`);
      const raw = await response.text();
      latest = await validateSnapshot(safeParse(raw, "Released 快照"));
      showError("");
    } catch (error) {
      latest = null; showError(`无法载入新的 Released 快照：${error.message}。${current ? "继续沿用上一版会议基线。" : "尚无可用基线。"}`);
      addAudit("source-load", "failed-old-baseline-preserved", current?.integrity?.digest || null, null);
    }
    $("#baselineDiff").dataset.state = "";
    $("#baselineDiff").innerHTML = "<b>差异尚未审阅</b><span>核验完成后点击“预览差异”；系统不会静默替换会议基线。</span>";
    renderAll();
  }

  function reviewDiff() {
    if (!latest) return;
    diffResult = compareSnapshots(current, latest); diffReviewed = true;
    const node = $("#baselineDiff"); node.dataset.state = diffResult.safe ? "safe" : "blocked";
    const lines = [...diffResult.changes, ...diffResult.blocked.map((item) => `阻断：${item}`)];
    node.innerHTML = `<b>${diffResult.safe ? "差异已审阅，可以明确确认" : "差异被阻断，旧基线保持不变"}</b><span>${lines.map(esc).join("<br>")}</span>`;
    $("#applyBaselineUpdate").disabled = !diffResult.safe || current?.integrity.digest === latest.integrity.digest;
    addAudit("diff-review", diffResult.safe ? "safe" : "blocked");
  }

  function openConfirm() {
    if (!latest || !diffReviewed || !diffResult?.safe) return;
    $("#baselineConfirmSummary").textContent = `${stamp(current)} → ${stamp(latest)}。将先备份旧基线；${proposals.length} 条提案与 ${decisions.length} 条决议保持不变。`;
    $("#baselineConfirmActor").value = $("#baselineActor").value.trim();
    $("#baselineConfirmDialog").showModal();
  }

  async function confirmUpdate() {
    const actor = $("#baselineConfirmActor").value.trim();
    if (!actor) { showError("刷新基线前必须填写操作人。"); return; }
    const verified = await validateSnapshot(latest);
    const monotonic = compareSnapshots(current, verified);
    if (!monotonic.safe) { showError(`刷新被阻止：${monotonic.blocked.join("；")}`); return; }
    const previous = current;
    if (previous) write(BACKUP_KEY, previous);
    current = {...verified, confirmedAt:now(), confirmedBy:actor};
    // confirmedAt/By are Workshop metadata and not part of source integrity.
    write(BASELINE_KEY, current);
    localStorage.setItem(ACTOR_KEY, actor); $("#baselineActor").value = actor;
    addAudit("baseline-update", "confirmed", previous?.integrity?.digest || null, verified.integrity.digest, actor);
    diffReviewed = false; diffResult = null; showError(""); renderAll();
    $("#baselineDiff").dataset.state = "safe";
    $("#baselineDiff").innerHTML = "<b>基线已明确刷新</b><span>旧版已写入本机 backup key；提案和决议未被改写。</span>";
  }

  function createProposal(event) {
    event.preventDefault();
    if (!current) return showError("先明确建立会议基线，再创建绑定 digest 的提案。");
    const course = selectedCourse();
    const title = $("#baselineProposalTitle").value.trim();
    const body = $("#baselineProposalBody").value.trim();
    const owner = $("#baselineProposalOwner").value.trim();
    if (!title || !body || !owner) return;
    proposals.unshift({id:uid("proposal"), title, body, owner, courseId:course.courseId, baseSnapshotDigest:current.integrity.digest, baseDigest:current.integrity.digest, baseCourseRef:{courseId:course.courseId,revision:course.revision,digest:course.digest}, status:"discussing", createdAt:now()});
    proposals = proposals.slice(0, 100); write(PROPOSAL_KEY, proposals); event.currentTarget.reset();
    addAudit("proposal-create", title); renderCollaboration();
  }

  function deleteProposal(id) {
    const item = proposals.find((proposal) => proposal.id === id); if (!item) return;
    proposals = proposals.filter((proposal) => proposal.id !== id);
    decisions = decisions.filter((decision) => decision.proposalId !== id);
    write(PROPOSAL_KEY, proposals); write(DECISION_KEY, decisions); addAudit("proposal-delete", item.title); renderCollaboration();
  }

  function decide(proposalId, outcome) {
    const actor = $("#baselineActor").value.trim();
    if (!actor) return showError("记录会议决议前，请填写操作人。");
    const proposal = proposals.find((item) => item.id === proposalId); if (!proposal) return;
    decisions.push({id:uid("decision"), proposalId, outcome, actor, at:now(), baseDigest:proposal.baseDigest});
    decisions = decisions.slice(-200); write(DECISION_KEY, decisions); localStorage.setItem(ACTOR_KEY, actor);
    addAudit("meeting-decision", `${outcome}:${proposal.title}`, current?.integrity?.digest || null, current?.integrity?.digest || null, actor); showError(""); renderCollaboration();
  }

  function exportChanges() {
    const requests = proposals.flatMap((proposal) => {
      const decision = decisionFor(proposal.id);
      if (decision?.outcome !== "accepted") return [];
      return [{schemaVersion:1, requestId:uid("change"), type:"course-change-request", reviewStatus:"pending-editor-review", baseSnapshotDigest:proposal.baseSnapshotDigest, baseCourseRef:proposal.baseCourseRef, proposal:{id:proposal.id,title:proposal.title,body:proposal.body,owner:proposal.owner}, meetingDecision:decision}];
    });
    if (!requests.length) return;
    const value = {schemaVersion:1, exportType:"msv-workshop-course-change-requests", exportedAt:now(), target:"/control/editor/", writesCourse:false, requests};
    const blob = new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json"});
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href=url; anchor.download=`msv-workshop-change-requests-${new Date().toISOString().slice(0,10)}.json`; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),0);
    addAudit("change-request-export", `${requests.length} pending-editor-review`);
  }

  $("#reloadBaselineSource")?.addEventListener("click", loadLatest);
  $("#previewBaselineDiff")?.addEventListener("click", reviewDiff);
  $("#applyBaselineUpdate")?.addEventListener("click", openConfirm);
  $("#baselineCourseSelect")?.addEventListener("change", renderBaseline);
  $("#baselineProposalForm")?.addEventListener("submit", createProposal);
  $("#baselineProposalList")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-proposal-id]");
    if (item && event.target.closest('[data-baseline-action="delete"]')) deleteProposal(item.dataset.proposalId);
  });
  $("#baselineDecisionList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-baseline-decision]"); const item = event.target.closest("[data-proposal-id]");
    if (button && item) decide(item.dataset.proposalId, button.dataset.baselineDecision);
  });
  $("#baselineActor")?.addEventListener("change", (event) => localStorage.setItem(ACTOR_KEY, event.target.value.trim()));
  $("#exportBaselineChanges")?.addEventListener("click", exportChanges);
  $("#baselineConfirmDialog")?.addEventListener("close", () => { if ($("#baselineConfirmDialog").returnValue === "confirm") void confirmUpdate(); });

  $("#baselineActor").value = localStorage.getItem(ACTOR_KEY) || "";
  void (async () => { await restoreCurrent(); renderAll(); await loadLatest(); })();
})();
