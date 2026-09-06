import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClassroomRoomDto } from "../app/lib/classroom-api";

const port = 4300 + Math.floor(Math.random() * 400);
const externalBase = process.env.MSV_E2E_BASE_URL;
const base = externalBase ?? `http://127.0.0.1:${port}`;
const apiPrefix = normalizePrefix(process.env.MSV_E2E_API_PREFIX ?? "");
const accountFile = process.env.MSV_E2E_ACCOUNT_FILE;
const configuredAccounts = accountFile ? await loadAccounts(accountFile) : null;
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const dm = configuredAccounts ? accountUser(configuredAccounts.dm, "DM导师") : user(`dm-${run}`, "DM导师");
const learners = configuredAccounts
  ? configuredAccounts.learners.map((account, index) => accountUser(account, `Builder ${index + 1}`))
  : Array.from({ length: 4 }, (_, index) => user(`learner-${index + 1}-${run}`, `Builder ${index + 1}`));
const outsider = configuredAccounts ? accountUser(configuredAccounts.outsider, "Observer") : user(`outsider-${run}`, "Outsider");
let server: ChildProcess | null = null;
let persistPath: string | null = null;
const cleanupRoomIds: string[] = [];
let cleanupDone = false;

type Account = { username: string; password: string; name?: string };
type AccountSet = { dm: Account; learners: Account[]; outsider: Account };
type User = { id: string; email: string; name: string; username?: string; password?: string; cookie?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

try {
  if (!externalBase) {
    persistPath = await mkdtemp(join(tmpdir(), "msv-d1-e2e-"));
    server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, MSV_PERSIST_PATH: persistPath, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let diagnostics = "";
    server.stdout?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-8_000); });
    server.stderr?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-8_000); });
    await waitUntilReady(diagnostics);
  }

  if (configuredAccounts) await Promise.all([dm, ...learners, outsider].map(loginExternalUser));

  const anonymousResponse = await fetch(endpoint("/api/classroom/bootstrap"));
  assert.equal(anonymousResponse.status, 401);
  if (!configuredAccounts) {
    const anonymous = await anonymousResponse.json() as Envelope<unknown>;
    assert.equal(anonymous.error?.code, "AUTH_REQUIRED");
  }
  const crossOrigin = await fetch(endpoint("/api/classroom/rooms"), { method: "POST", headers: { ...authHeaders(dm), "Content-Type": "application/json", Origin: "https://attacker.invalid" }, body: JSON.stringify({ title: "跨站请求" }) });
  assert.equal(crossOrigin.status, 403);
  const crossOriginBody = await crossOrigin.text();
  assert.match(crossOriginBody, /Forbidden|ORIGIN_FORBIDDEN/);
  const oversized = await fetch(endpoint("/api/classroom/rooms"), { method: "POST", headers: { ...authHeaders(dm), "Content-Type": "application/json" }, body: JSON.stringify({ title: "x".repeat(33_000) }) });
  assert.equal(oversized.status, 413);
  assert.equal(((await oversized.json()) as Envelope<unknown>).error?.code, "BODY_TOO_LARGE");
  const dashboard = await request<import("../app/lib/classroom-api").ClassroomDashboardDto>("/api/classroom/bootstrap", dm);
  assert.deepEqual(
    dashboard.data?.campaigns
      .map((campaign) => [campaign.id, campaign.chapterCount] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
    [
      ["eleme-2008-find-problem", 5],
      ["google-1995-2004", 5],
    ],
  );
  const created = await request<{ roomId: string; teamPublicId: string }>("/api/classroom/rooms", dm, { title: "Google 多账号自动验收战役" });
  assert.ok(created.data?.roomId && created.data.teamPublicId);
  const roomId = created.data.roomId;
  cleanupRoomIds.push(roomId);
  const teamPublicId = created.data.teamPublicId;
  assert.match(teamPublicId, /^TEAM-[A-Z2-9]{8}$/);

  const joinRequestIds: string[] = [];
  for (const learner of learners) {
    const joined = await request<{ requestId: string; status: string }>("/api/classroom/join", learner, { teamPublicId });
    assert.equal(joined.data?.status, "pending");
    assert.ok(joined.data?.requestId);
    joinRequestIds.push(joined.data.requestId);
    assert.equal((await request(`/api/classroom/rooms/${roomId}`, learner, undefined, 403)).error?.code, "NOT_A_MEMBER");
  }
  for (const requestId of joinRequestIds) {
    await action(roomId, dm, { type: "decide-join-request", requestId, decision: "approve" });
  }
  assert.equal((await request(`/api/classroom/rooms/${roomId}`, outsider, undefined, 403)).error?.code, "NOT_A_MEMBER");
  if (configuredAccounts) {
    assert.equal((await request("/api/classroom/join", outsider, { teamPublicId }, 403)).error?.code, "LEARNER_ACCOUNT_REQUIRED");
  }
  assert.equal((await action(roomId, learners[0], { type: "move-phase", direction: "next" }, 403)).error?.code, "DM_REQUIRED");

  await action(roomId, dm, { type: "set-timer", minutes: 3 });
  let dmRoom = await room(roomId, dm);
  assert.ok(dmRoom.room.phaseDeadlineAt);
  await action(roomId, dm, { type: "toggle-pause", paused: true });
  assert.equal((await action(roomId, learners[0], { type: "set-nickname", nickname: "Paused Builder" }, 409)).error?.code, "ROOM_PAUSED");
  await action(roomId, dm, { type: "toggle-pause", paused: false });
  await action(roomId, learners[0], { type: "set-nickname", nickname: "Navigator One" });
  dmRoom = await room(roomId, dm);
  assert.equal(dmRoom.room.teams[0]?.publicId, teamPublicId, "public team ID must remain stable throughout the campaign");

  await action(roomId, dm, { type: "assign-and-deal" });
  const learnerStates = await assertConcreteLearnerDeal(roomId);
  let learnerOne = learnerStates[0];
  assert.equal(learnerOne.dmSecrets, null);
  assert.equal(learnerOne.chapter.historyReveal, null);
  assert.equal(learnerOne.catalog.sources.length, 0, "source titles and links stay sealed with the history answer");
  assert.ok(dmRoom.catalog.sources.length > 0);
  assert.equal(learnerOne.members.find((member) => member.id !== learnerOne.viewer.memberId && member.role === "learner")?.walletTenths, null);
  const repairCard = learnerOne.myCards[0].id;
  await action(roomId, dm, { type: "withdraw-card", cardId: repairCard, memberId: learnerOne.viewer.memberId });
  assert.equal((await room(roomId, learners[0])).myCards.length, 2);
  await action(roomId, dm, { type: "grant-card", cardId: repairCard, memberId: learnerOne.viewer.memberId });
  assert.equal((await room(roomId, learners[0])).myCards.length, 3);

  await next(roomId);
  for (const learner of learners) {
    const state = await room(roomId, learner);
    for (const card of state.myCards) {
      await action(roomId, learner, { type: "set-card-state", cardId: card.id, state: "read" });
      await action(roomId, learner, { type: "set-card-state", cardId: card.id, state: "published" });
    }
  }
  await next(roomId);
  await next(roomId);
  learnerOne = await room(roomId, learners[0]);
  assert.equal(learnerOne.intelligence.publishedCards.length, 12);
  const cards = learnerOne.intelligence.publishedCards.map((card) => card.id);
  const nodes = [
    ["user", "校园研究者", "用户搜索已知论文时浪费大量时间", cards[0]],
    ["need", "网页发现损失", "相关页面被关键词噪声掩盖而无法发现", cards[1]],
    ["constraint", "算力与规模约束", "有限服务器必须处理快速增长的网页集合", cards[2]],
    ["evidence", "链接是关系信号", "网页链接结构提供不同于词频的排序线索", cards[3]],
  ] as const;
  for (const [kind, title, explanation, cardId] of nodes) {
    await action(roomId, learners[0], { type: "create-intelligence-node", kind, title, explanation, sourceCardIds: [cardId] });
  }
  learnerOne = await room(roomId, learners[0]);
  const nodeIds = Object.fromEntries(learnerOne.intelligence.nodes.map((node) => [node.title, node.id]));
  await action(roomId, learners[0], { type: "create-intelligence-edge", fromNodeId: nodeIds["校园研究者"], toNodeId: nodeIds["网页发现损失"], kind: "causes", explanation: "检索失败直接造成任务时间损失" });
  await action(roomId, learners[0], { type: "create-intelligence-edge", fromNodeId: nodeIds["算力与规模约束"], toNodeId: nodeIds["网页发现损失"], kind: "limits", explanation: "规模压力限制相关性与响应速度" });
  await next(roomId);
  assert.equal((await action(roomId, dm, { type: "move-phase", direction: "next" }, 409)).error?.code, "PROBLEM_STATEMENT_REQUIRED");
  await action(roomId, learners[0], { type: "submit-problem-statement", user: "校园研究者", sceneLoss: "已知论文对应网页被噪声掩盖，查找时间持续增加", evidenceSummary: "团队发布卡与情报网同时指出结果噪声、链接关系和算力约束", unknown: "普通用户是否也把相关性而不是结果数量视为首要损失", decisionQuestion: "是否先验证链接关系排序能显著降低查找时间" });
  await next(roomId);
  const beginnerTeam = await room(roomId, learners[0]);
  assert.ok(beginnerTeam.members.filter((member) => member.role === "learner").every((member) => !("pdmoRole" in member) && !("supportCommitment" in member)));
  await next(roomId);
  dmRoom = await room(roomId, dm);
  const teamId = dmRoom.room.focusTeamId!;
  const selectedChallenge = dmRoom.chapter.challenges[1];
  const expectedChallengeRevenue = selectedChallenge.baseIncomeTenths + 20;
  await action(roomId, dm, { type: "select-challenge", teamId, challengeId: selectedChallenge.id });
  await action(roomId, dm, { type: "roll-pressure", teamId });
  await assertConcreteLearnerChallenge(roomId);
  for (const [index, learner] of learners.entries()) await challengeAction(roomId, learner, index + 1, false);
  const teamworkRound = await room(roomId, learners[0]);
  assert.equal(teamworkRound.challenge?.actions.length, 4);
  assert.ok(teamworkRound.challenge?.actions.every((item) => !("pdmo_role" in item)));
  await next(roomId);
  for (const [index, learner] of learners.entries()) await challengeAction(roomId, learner, index + 1, true);
  const scoreKey = key("score");
  const score = { type: "score-challenge", teamId, rubric: { evidence: 1, logic: 1, execution: 1, collaboration: 1 }, consequence: "", idempotencyKey: scoreKey };
  assert.equal((await action<{ version: number; replayed?: boolean }>(roomId, dm, score)).data?.replayed, false);
  assert.equal((await action<{ version: number; replayed?: boolean }>(roomId, dm, score)).data?.replayed, true);
  await next(roomId);

  dmRoom = await room(roomId, dm);
  assert.equal(dmRoom.economy.chapterRevenueTenths, expectedChallengeRevenue);
  const treasuryBeforeFinance = dmRoom.economy.teamTreasuryTenths;
  const financeKey = key("finance");
  await action(roomId, dm, { type: "record-financing", teamId, amountTenths: 50, reason: "获得服务器额度但下一章必须提交稳定性报告", idempotencyKey: financeKey });
  dmRoom = await room(roomId, dm);
  assert.equal(dmRoom.economy.teamTreasuryTenths, treasuryBeforeFinance + 50);
  assert.equal(dmRoom.economy.chapterRevenueTenths, expectedChallengeRevenue, "financing must not become distributable revenue");
  const financing = dmRoom.economy.ledger.find((entry) => entry.category === "financing" && entry.reason.includes("稳定性"));
  assert.ok(financing);
  const reverseKey = key("reverse");
  await action(roomId, dm, { type: "reverse-transaction", transactionId: financing.id, reason: "导师录入到错误融资轮次，需要完整撤销", idempotencyKey: reverseKey });
  assert.equal((await action<{ replayed?: boolean }>(roomId, dm, { type: "reverse-transaction", transactionId: financing.id, reason: "导师录入到错误融资轮次，需要完整撤销", idempotencyKey: reverseKey })).data?.replayed, true);
  assert.equal((await room(roomId, dm)).economy.teamTreasuryTenths, treasuryBeforeFinance);

  const paperIncomeKey = key("paper-income");
  const paperIncome = { type: "record-paper-ledger", teamId, flow: "inflow", category: "user-validation", amountTenths: 70, reason: "纸单P03断网期间完成七名用户验证", idempotencyKey: paperIncomeKey };
  assert.equal((await action<{ replayed?: boolean }>(roomId, dm, paperIncome)).data?.replayed, false);
  assert.equal((await action<{ replayed?: boolean }>(roomId, dm, paperIncome)).data?.replayed, true);
  await action(roomId, dm, { type: "record-paper-ledger", teamId, flow: "outflow", category: "research", amountTenths: 10, reason: "纸单P04支付现场访谈材料成本", idempotencyKey: key("paper-cost") });
  assert.equal((await action(roomId, dm, { type: "record-paper-ledger", teamId, flow: "inflow", category: "research", amountTenths: 10, reason: "不允许把调研成本伪装成项目收入", idempotencyKey: key("paper-invalid") }, 400)).error?.code, "LEDGER_CATEGORY_DIRECTION_MISMATCH");
  dmRoom = await room(roomId, dm);
  assert.equal(dmRoom.economy.teamTreasuryTenths, treasuryBeforeFinance + 60);
  assert.equal(dmRoom.economy.chapterRevenueTenths, expectedChallengeRevenue + 70);
  assert.equal(dmRoom.economy.chapterCostTenths, 10);

  const members = (await room(roomId, dm)).members.filter((member) => member.role === "learner");
  for (const member of members) await action(roomId, dm, { type: "award-reputation", memberId: member.id, scores: { evidence: 1, modeling: 0, delivery: 1, support: 0, iteration: 0, responsibility: 0 }, evidenceObjectId: `work:${key("rp")}`, reason: "引用来源完成两轮可验证行动" });
  for (const [index, learner] of learners.entries()) await action(roomId, learner, { type: "gratitude-vote", toMemberId: members[(index + 1) % 4].id, reason: "第二轮提供了具体证据与支撑" });
  const distributionKey = key("distribution");
  const distribution = { type: "distribute-profit", teamId, percent: 40, idempotencyKey: distributionKey };
  await action(roomId, dm, distribution);
  assert.equal((await action<{ replayed?: boolean }>(roomId, dm, distribution)).data?.replayed, true);

  const personalBefore = await room(roomId, learners[0]);
  assert.ok(personalBefore.viewer.walletTenths >= 11, "distribution should fund one personal tool and a small reinvestment");
  const personalKey = key("personal");
  const personalPurchase = { type: "personal-purchase", itemId: "support-ticket", idempotencyKey: personalKey };
  assert.equal((await action<{ replayed?: boolean }>(roomId, learners[0], personalPurchase)).data?.replayed, false);
  assert.equal((await action<{ replayed?: boolean }>(roomId, learners[0], personalPurchase)).data?.replayed, true);
  const personalAfter = await room(roomId, learners[0]);
  assert.equal(personalAfter.viewer.walletTenths, personalBefore.viewer.walletTenths - 10);
  assert.ok(personalAfter.worldline.some((entry) => entry.kind === "personal-item"));
  assert.ok(!(await room(roomId, learners[1])).worldline.some((entry) => entry.kind === "personal-item"), "personal purchases stay private from teammates");
  const treasuryBeforeReinvest = personalAfter.economy.teamTreasuryTenths;
  await action(roomId, learners[0], { type: "reinvest", teamId, amountTenths: 1, idempotencyKey: key("reinvest") });
  assert.equal((await room(roomId, learners[0])).economy.teamTreasuryTenths, treasuryBeforeReinvest + 1);

  const teamAssetId = dmRoom.catalog.assets[0].id;
  await action(roomId, learners[0], { type: "propose-purchase", assetId: teamAssetId, idempotencyKey: key("proposal") });
  const proposal = (await room(roomId, learners[0])).economy.proposals.find((entry) => entry.assetId === teamAssetId)!;
  for (const learner of learners.slice(1, 3)) await action(roomId, learner, { type: "vote-purchase", proposalId: proposal.id, approve: true, idempotencyKey: key("vote") });
  assert.ok((await room(roomId, learners[0])).economy.assets.some((asset) => asset.id === teamAssetId));

  await action(roomId, learners[0], { type: "freeze-worldline", teamId, decision: "优先用链接关系改善校园研究者的网页发现任务", rationale: "团队证据显示关键词噪声、链接关系和算力约束同时存在" });
  await next(roomId);
  await action(roomId, dm, { type: "reveal-history" });
  const revealedLearner = await room(roomId, learners[1]);
  assert.ok(revealedLearner.chapter.historyReveal);
  assert.ok(revealedLearner.catalog.sources.length > 0);
  const revealedDm = await room(roomId, dm);
  assert.equal(revealedLearner.chapter.historyReveal.sourceIds.join(","), revealedDm.chapter.historyReveal?.sourceIds.join(","));
  assert.ok(revealedLearner.chapter.historyReveal.happened.length >= 12);
  await next(roomId);
  for (const [index, learner] of learners.entries()) await action(roomId, learner, { type: "submit-reflection", answers: Array.from({ length: 6 }, (_, question) => `学员${index + 1}对问题${question + 1}的证据复盘`), realityAction: `学员${index + 1}将在48小时内访谈真实用户并提交记录` });

  const archive = await request<Record<string, unknown>>(`/api/classroom/rooms/${roomId}/export`, dm);
  const archiveText = JSON.stringify(archive.data);
  assert.doesNotMatch(archiveText, /@example\.test/);
  assert.doesNotMatch(archiveText, new RegExp(dm.id));
  for (const learner of learners) assert.doesNotMatch(archiveText, new RegExp(learner.id));
  assert.match(archiveText, /mini-silicon-valley-classroom-archive/);
  await action(roomId, dm, { type: "next-chapter" });
  const chapterTwo = await room(roomId, dm);
  assert.equal(chapterTwo.chapter.order, 2);
  assert.equal(chapterTwo.room.phase, "lobby");
  for (let order = 2; order <= 5; order += 1) await completeCurrentChapter(roomId, order, order === 5);
  const completedCampaign = await room(roomId, dm);
  assert.equal(completedCampaign.chapter.order, 5);
  assert.equal(completedCampaign.room.phase, "completed");
  assert.ok(completedCampaign.worldline.some((entry) => entry.kind === "demo-day"));
  const finalArchive = await request<Record<string, unknown>>(`/api/classroom/rooms/${roomId}/export`, dm);
  assert.match(JSON.stringify(finalArchive.data), /demo-day/);

  const elemeRoom = await request<{ roomId: string; teamPublicId: string }>("/api/classroom/rooms", dm, {
    title: "饿了么宿舍订餐调查自动验收",
    campaignId: "eleme-2008-find-problem",
  });
  assert.ok(elemeRoom.data);
  cleanupRoomIds.push(elemeRoom.data.roomId);
  const elemeRequestIds: string[] = [];
  for (const learner of learners) {
    const joined: Envelope<{ requestId: string; roomTitle: string }> = await request(
      "/api/classroom/join",
      learner,
      { teamPublicId: elemeRoom.data.teamPublicId },
    );
    assert.ok(joined.data?.requestId);
    assert.equal(joined.data?.roomTitle, "2008 宿舍订餐创业小队｜Young Builder 课堂");
    elemeRequestIds.push(joined.data.requestId);
  }
  for (const requestId of elemeRequestIds) {
    await action(elemeRoom.data.roomId, dm, { type: "decide-join-request", requestId, decision: "approve" });
  }
  const elemeStart = await room(elemeRoom.data.roomId, dm);
  assert.equal(elemeStart.campaign.id, "eleme-2008-find-problem");
  assert.equal(elemeStart.campaign.chapterCount, 5);
  assert.equal(elemeStart.chapter.stage, "find");
  assert.equal(elemeStart.chapter.infoCardCount, 12);
  const elemeLearnerStart = await room(elemeRoom.data.roomId, learners[0]);
  assert.equal(elemeLearnerStart.room.title, "2008 宿舍订餐创业小队｜Young Builder 课堂");
  assert.equal(elemeLearnerStart.campaign.title, "2008 宿舍订餐创业小队｜五步创业闭环");
  assert.equal(elemeLearnerStart.campaign.organization, "2008 宿舍订餐创业小队");
  assert.equal(elemeLearnerStart.chapter.location, "2008—2009 · 创业现场");
  assert.doesNotMatch(elemeLearnerStart.chapter.location, /上海交通大学/);
  assert.doesNotMatch(JSON.stringify(elemeLearnerStart), /饿了么|张旭豪|上海交通大学/);
  const elemeLearnerDashboard = await request<import("../app/lib/classroom-api").ClassroomDashboardDto>("/api/classroom/bootstrap", learners[0]);
  assert.equal(elemeLearnerDashboard.data?.rooms.find((candidate) => candidate.id === elemeRoom.data!.roomId)?.title, "2008 宿舍订餐创业小队｜Young Builder 课堂");
  assert.doesNotMatch(JSON.stringify(elemeLearnerDashboard.data), /饿了么|张旭豪|上海交通大学/);
  const elemeStages = ["find", "decide", "build", "market", "operate"] as const;
  for (let order = 1; order <= elemeStages.length; order += 1) {
    const chapter = await room(elemeRoom.data.roomId, dm);
    assert.equal(chapter.chapter.order, order);
    assert.equal(chapter.chapter.stage, elemeStages[order - 1]);
    assert.equal(chapter.chapter.infoCardCount, 12);
    await assertElemeCurrentChapterSealed(elemeRoom.data.roomId, order);
    await completeCurrentChapter(elemeRoom.data.roomId, order, order === elemeStages.length, /饿了么|张旭豪|上海交通大学/);
  }
  const elemeCompleted = await room(elemeRoom.data.roomId, dm);
  assert.equal(elemeCompleted.room.phase, "completed");
  assert.equal(elemeCompleted.chapter.order, 5);
  assert.equal(elemeCompleted.campaign.organization, "饿了么：2008 宿舍订餐五步创业战役");
  const elemeRevealedLearner = await room(elemeRoom.data.roomId, learners[0]);
  assert.equal(elemeRevealedLearner.room.title, "饿了么宿舍订餐调查自动验收");
  assert.equal(elemeRevealedLearner.campaign.organization, "饿了么：2008 宿舍订餐五步创业战役");
  assert.ok(elemeCompleted.worldline.some((entry) => entry.kind === "demo-day"));
  const elemeArchive = await request<Record<string, unknown>>(`/api/classroom/rooms/${elemeRoom.data.roomId}/export`, dm);
  assert.match(JSON.stringify(elemeArchive.data), /eleme-2008-find-problem/);
  assert.match(JSON.stringify(elemeArchive.data), /e08-f-01/);
  for (const chapterId of ["find", "decide", "build", "market", "operate"])
    assert.match(JSON.stringify(elemeArchive.data), new RegExp(`eleme-2008-find-problem:${chapterId}`));

  const concurrentRoom = await request<{ roomId: string; teamPublicId: string }>("/api/classroom/rooms", dm, { title: "并发入场验收" });
  assert.ok(concurrentRoom.data);
  cleanupRoomIds.push(concurrentRoom.data.roomId);
  const concurrentRequests = await Promise.all([
    ...learners.map((learner) => request<{ requestId: string }>("/api/classroom/join", learner, { teamPublicId: concurrentRoom.data!.teamPublicId })),
    request<{ requestId: string }>("/api/classroom/join", learners[0], { teamPublicId: concurrentRoom.data.teamPublicId }),
  ]);
  const uniqueRequestIds = [...new Set(concurrentRequests.map((entry) => entry.data?.requestId).filter((id): id is string => Boolean(id)))];
  assert.equal(uniqueRequestIds.length, 4, "duplicate requests must collapse to one pending request per learner");
  await Promise.all(uniqueRequestIds.map((requestId) => action(concurrentRoom.data!.roomId, dm, {
    type: "decide-join-request", requestId, decision: "approve",
  })));
  const concurrentState = await room(concurrentRoom.data.roomId, dm);
  const concurrentMembers = concurrentState.members.filter((member) => member.role === "learner");
  assert.equal(concurrentMembers.length, 4);
  assert.equal(new Set(concurrentMembers.map((member) => member.seat)).size, 4);
  await action(concurrentRoom.data.roomId, dm, { type: "assign-and-deal" });
  if (process.env.MSV_E2E_ARCHIVE === "1") {
    await action(roomId, dm, { type: "archive-room" });
    await action(elemeRoom.data.roomId, dm, { type: "archive-room" });
    await action(concurrentRoom.data.roomId, dm, { type: "archive-room" });
    assert.equal((await room(roomId, dm)).room.status, "archived");
    assert.equal((await room(concurrentRoom.data.roomId, dm)).room.status, "archived");
    cleanupDone = true;
  }
  console.log(`CLASSROOM_E2E_PASS googleRoom=${roomId} googleChapters=5 elemeRoom=${elemeRoom.data.roomId} elemeChapters=5 phase=${elemeCompleted.room.phase} audit=${completedCampaign.audit.length}`);
} finally {
  if (externalBase && process.env.MSV_E2E_ARCHIVE === "1" && !cleanupDone) {
    await Promise.all(cleanupRoomIds.map((roomId) => archiveWithoutAssertion(roomId)));
  }
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!server.killed) server.kill("SIGKILL");
  }
  if (persistPath) await rm(persistPath, { recursive: true, force: true });
}

function user(id: string, name: string): User { return { id, name, email: `${id}@example.test` }; }
function accountUser(account: Account, fallbackName: string): User {
  return {
    id: account.username,
    email: `${account.username}@work.cyberforker.com`,
    name: account.name ?? fallbackName,
    username: account.username,
    password: account.password,
  };
}
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function authHeaders(actingUser: User): Record<string, string> {
  if (actingUser.cookie) {
    return {
      Accept: "application/json",
      Cookie: actingUser.cookie,
      ...(externalBase ? { Origin: new URL(externalBase).origin } : {}),
    };
  }
  return {
    Accept: "application/json",
    "oai-authenticated-user-id": actingUser.id,
    "oai-authenticated-user-email": actingUser.email,
    "oai-authenticated-user-full-name": encodeURIComponent(actingUser.name),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  };
}

async function loginExternalUser(actingUser: User): Promise<void> {
  assert.ok(externalBase && actingUser.username && actingUser.password);
  const response = await fetch(endpoint("/api/auth/login"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Origin: new URL(externalBase).origin },
    body: JSON.stringify({ mode: "password", username: actingUser.username, password: actingUser.password, remember: false }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, `login ${actingUser.username}: ${body}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.match(cookie ?? "", /^__Secure-msv_session=.+/);
  actingUser.cookie = cookie;
}
async function waitUntilReady(diagnostics: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(endpoint("/api/classroom/bootstrap")); if (response.status === 401) return; } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server did not become ready. ${diagnostics}`);
}
async function request<T = Record<string, unknown>>(path: string, actingUser: User | null, body?: unknown, expectedStatus = 200): Promise<Envelope<T>> {
  const headers: Record<string, string> = actingUser ? authHeaders(actingUser) : { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(endpoint(path), { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const envelope = await response.json() as Envelope<T>;
  assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(envelope)}`);
  assert.equal(envelope.ok, expectedStatus < 400, `${path}: ${JSON.stringify(envelope)}`);
  return envelope;
}

function endpoint(path: string): string { return `${base}${apiPrefix}${path}`; }

function normalizePrefix(value: string): string {
  if (!value) return "";
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  if (!normalized.startsWith("/") || normalized.includes("..") || normalized.includes("//")) {
    throw new Error(`MSV_E2E_API_PREFIX must be a normalized absolute path: ${value}`);
  }
  return normalized;
}

async function loadAccounts(path: string): Promise<AccountSet> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<AccountSet>;
  assert.ok(parsed.dm && parsed.outsider && Array.isArray(parsed.learners), "account file must contain dm, four learners, and outsider");
  assert.equal(parsed.learners.length, 4, "account file must contain exactly four learners");
  const accounts = [parsed.dm, ...parsed.learners, parsed.outsider];
  for (const account of accounts) {
    assert.equal(typeof account.username, "string");
    assert.ok(account.username.length > 0);
    assert.equal(typeof account.password, "string");
    assert.ok(account.password.length >= 16);
  }
  assert.equal(new Set(accounts.map((account) => account.username)).size, accounts.length, "account usernames must be unique");
  return parsed as AccountSet;
}

async function archiveWithoutAssertion(roomId: string): Promise<void> {
  try {
    await fetch(endpoint(`/api/classroom/rooms/${roomId}/actions`), {
      method: "POST",
      headers: { ...authHeaders(dm), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "archive-room" }),
    });
  } catch {
    // Best-effort production cleanup after a failed assertion.
  }
}
async function action<T = { version: number; replayed?: boolean }>(roomId: string, actingUser: User, body: unknown, status = 200) { return request<T>(`/api/classroom/rooms/${roomId}/actions`, actingUser, body, status); }
async function room(roomId: string, actingUser: User): Promise<ClassroomRoomDto> {
  const response = await request<ClassroomRoomDto>(`/api/classroom/rooms/${roomId}`, actingUser);
  assert.ok(response.data, "room response must contain data");
  return response.data;
}
async function next(roomId: string) { await action(roomId, dm, { type: "move-phase", direction: "next" }); }
async function challengeAction(roomId: string, learner: User, index: number, second: boolean) {
  await action(roomId, learner, { type: "submit-challenge-action", goal: `完成第${index}项验证目标${second ? "并缩小范围" : ""}`, method: second ? `根据压力反馈改用第${index}种对照测试` : `使用角色方法${index}执行小规模测试`, evidence: second ? `补充反证与团队节点${index}` : `引用团队证据节点${index}`, resource: second ? "减少范围并投入一份原型" : "投入一小时和一份原型", successSignal: `至少获得${index + (second ? 1 : 0)}个可观察信号`, stopCondition: second ? "达到判断阈值或连续两次无信号" : "连续两次没有新增信号时停止" });
}

async function assertConcreteLearnerDeal(roomId: string): Promise<ClassroomRoomDto[]> {
  const [dmState, ...learnerStates] = await Promise.all([room(roomId, dm), ...learners.map((learner) => room(roomId, learner))]);
  assert.ok(dmState.dmSecrets);
  assert.ok(dmState.chapter.dm, "the facilitator keeps the source-rich guide");
  assert.equal(dmState.chapter.studentGuide, null);
  assert.equal(dmState.dmSecrets.cardGrants.length, 12);

  const dealtCardIds = learnerStates.flatMap((state) => state.myCards.map((card) => card.id));
  assert.equal(dealtCardIds.length, 12, "four learners must each receive three cards");
  assert.equal(new Set(dealtCardIds).size, 12, "the complete twelve-card pool must be dealt without duplicates");

  for (const state of learnerStates) {
    assert.equal(state.myCards.length, 3);
    assert.ok(state.myIdentity);
    assert.equal(state.chapter.dm, null, "abstract facilitator theory must not leak into the learner payload");
    assert.ok(state.chapter.studentGuide);
    assert.equal(state.chapter.studentGuide.steps.length, 3);
    assert.equal(state.chapter.challenges.length, 0, "unselected challenge alternatives stay hidden from learners");
    assert.equal(state.chapter.pressureEvents.length, 0, "unrolled pressure alternatives stay hidden from learners");
    assert.ok(["找真问题", "定真方案", "做真产品", "进真市场", "跑真运营"].includes(state.chapter.title));
    assert.ok(state.chapter.briefing.length >= 20, "learner briefing must remain a concrete playable scene");

    const originalIdentity: NonNullable<ClassroomRoomDto["myIdentity"]> | undefined = dmState.dmSecrets.identities.find((identity) => identity.id === state.myIdentity?.id);
    assert.ok(originalIdentity);
    assert.equal(state.myIdentity.nature, originalIdentity.nature);
    assert.doesNotMatch(state.myIdentity.name, /P\s*\/\s*D\s*\/\s*M\s*\/\s*O|产品导师|开发导师|市场导师|运营导师/);
    assert.ok(state.myIdentity.ability.length >= 4);

    for (const learnerCard of state.myCards) {
      const originalCard: NonNullable<ClassroomRoomDto["dmSecrets"]>["allCards"][number] | undefined = dmState.dmSecrets.allCards.find((card) => card.id === learnerCard.id);
      assert.ok(originalCard);
      assert.equal(learnerCard.kind, originalCard.kind);
      assert.equal(learnerCard.credibility, originalCard.credibility);
      assert.deepEqual(learnerCard.sourceIds, originalCard.sourceIds);
      assert.ok(learnerCard.body.length >= 8, "learner card must contain a concrete clue");
      assert.ok(learnerCard.sharePrompt.length >= 4, "learner card must tell the learner what to share");
    }
  }

  const learnerAsset = learnerStates[0].catalog.assets[0];
  const dmAsset = dmState.catalog.assets.find((asset) => asset.id === learnerAsset.id);
  assert.ok(dmAsset);
  assert.equal(learnerAsset.priceTenths, dmAsset.priceTenths);
  assert.ok(learnerAsset.ability.length >= 8);
  assert.equal(learnerStates[0].catalog.demoDay.durationSeconds, dmState.catalog.demoDay.durationSeconds);
  assert.ok((learnerStates[0].catalog.demoDay.segments[0]?.requirement.length ?? 0) >= 4);
  return learnerStates;
}

async function assertConcreteLearnerChallenge(roomId: string): Promise<void> {
  const [dmState, learnerState] = await Promise.all([room(roomId, dm), room(roomId, learners[0])]);
  assert.ok(dmState.challenge);
  assert.ok(dmState.challenge.pressureDie);
  assert.equal(learnerState.chapter.challenges.length, 1, "learners only receive the challenge that the DM actually selected");
  assert.equal(learnerState.chapter.pressureEvents.length, 1, "learners only receive the pressure event that was rolled");

  const learnerChallenge = learnerState.chapter.challenges[0];
  const originalChallenge = dmState.chapter.challenges.find((challenge) => challenge.id === learnerChallenge.id);
  assert.ok(originalChallenge);
  assert.equal(learnerChallenge.level, originalChallenge.level);
  assert.equal(learnerChallenge.baseIncomeTenths, originalChallenge.baseIncomeTenths);
  assert.ok(learnerChallenge.prompt.length >= 12);
  assert.ok(learnerChallenge.requiredArtifact.length >= 4);
  assert.equal(Object.hasOwn(learnerChallenge, "recommendedLead"), false);
  assert.equal(Object.hasOwn(learnerChallenge, "requiredSupport"), false);

  const learnerPressure = learnerState.chapter.pressureEvents[0];
  const originalPressure = dmState.chapter.pressureEvents.find((pressure) => pressure.die === learnerPressure.die);
  assert.ok(originalPressure);
  assert.ok(learnerPressure.effect.length >= 8);
  assert.ok(learnerPressure.mitigation.length >= 4);
}

async function assertElemeCurrentChapterSealed(roomId: string, expectedOrder: number): Promise<void> {
  const learnerState = await room(roomId, learners[0]);
  assert.equal(learnerState.chapter.order, expectedOrder);
  assert.equal(learnerState.chapter.historyReveal, null, `Ele.me chapter ${expectedOrder} history must stay sealed before the team freezes its answer`);
  assert.equal(learnerState.catalog.sources.length, 0, `Ele.me chapter ${expectedOrder} source catalog must stay sealed`);
  assert.doesNotMatch(
    JSON.stringify({
      roomTitle: learnerState.room.title,
      campaign: learnerState.campaign,
      chapter: learnerState.chapter,
      myCards: learnerState.myCards,
    }),
    /饿了么|张旭豪|上海交通大学/,
    `Ele.me chapter ${expectedOrder} must not reveal the historical answer before history reveal`,
  );
}

async function completeCurrentChapter(
  roomId: string,
  expectedOrder: number,
  finalChapter = false,
  sealedAnswer?: RegExp,
): Promise<void> {
  let state = await room(roomId, dm);
  assert.equal(state.chapter.order, expectedOrder);
  assert.equal(state.room.phase, "lobby");
  await action(roomId, dm, { type: "assign-and-deal" });
  assert.equal((await room(roomId, dm)).room.phase, "identity");
  const dealtLearners = await assertConcreteLearnerDeal(roomId);
  if (sealedAnswer) {
    assert.doesNotMatch(
      JSON.stringify(dealtLearners.map((learner) => ({
        roomTitle: learner.room.title,
        campaign: learner.campaign,
        chapter: learner.chapter,
        myCards: learner.myCards,
      }))),
      sealedAnswer,
      `chapter ${expectedOrder} dealt cards must preserve the learner history seal`,
    );
  }
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "private-read");
  for (const learner of learners) {
    const learnerState = await room(roomId, learner);
    assert.equal(learnerState.myCards.length, 3);
    for (const card of learnerState.myCards) {
      await action(roomId, learner, { type: "set-card-state", cardId: card.id, state: "read" });
      await action(roomId, learner, { type: "set-card-state", cardId: card.id, state: "published" });
    }
  }
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "intel-brief");
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "intel-network");
  state = await room(roomId, learners[0]);
  const publishedCards = state.intelligence.publishedCards;
  assert.equal(publishedCards.length, 12);
  const sourceBacked = publishedCards.filter((card) => card.sourceIds.length > 0);
  assert.ok(sourceBacked.length >= 2, "every chapter must expose at least two source-backed cards for the intel gate");
  const selectedCards = [...sourceBacked.slice(0, 2), ...publishedCards.filter((card) => !sourceBacked.slice(0, 2).some((source) => source.id === card.id))].slice(0, 4);
  const cards = selectedCards.map((card) => card.id);
  const definitions = [
    ["user", `M${expectedOrder}目标用户`, "一个处在具体任务场景中的明确用户", cards[0]],
    ["need", `M${expectedOrder}场景损失`, "当前替代方式造成可以观察的时间与质量损失", cards[1]],
    ["constraint", `M${expectedOrder}关键约束`, "团队必须在有限时间、资源与信任边界内行动", cards[2]],
    ["evidence", `M${expectedOrder}来源证据`, "已发布信息支持当前判断但仍需要反证", cards[3]],
  ] as const;
  for (const [kind, title, explanation, cardId] of definitions) {
    await action(roomId, learners[0], { type: "create-intelligence-node", kind, title, explanation, sourceCardIds: [cardId] });
  }
  state = await room(roomId, learners[0]);
  const ids = Object.fromEntries(state.intelligence.nodes.map((node) => [node.title, node.id]));
  await action(roomId, learners[0], { type: "create-intelligence-edge", fromNodeId: ids[`M${expectedOrder}目标用户`], toNodeId: ids[`M${expectedOrder}场景损失`], kind: "causes", explanation: "用户任务受阻直接产生可观察损失" });
  await action(roomId, learners[0], { type: "create-intelligence-edge", fromNodeId: ids[`M${expectedOrder}关键约束`], toNodeId: ids[`M${expectedOrder}场景损失`], kind: "limits", explanation: "资源与信任约束限制当前解决路径" });
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "dm-gate");
  await action(roomId, learners[0], { type: "submit-problem-statement", user: `M${expectedOrder}的具体目标用户`, sceneLoss: "用户在当前任务中持续付出额外时间并承受结果质量损失", evidenceSummary: "两条来源节点和限制关系共同支持这项可证伪判断", unknown: "尚不确定该损失在更大样本中是否同样频繁", decisionQuestion: "下一轮应采用哪项最小行动验证核心因果关系" });
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "pdmo");
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "challenge-one");
  state = await room(roomId, dm);
  const teamId = state.room.focusTeamId!;
  await action(roomId, dm, { type: "select-challenge", teamId, challengeId: state.chapter.challenges[0].id });
  await action(roomId, dm, { type: "roll-pressure", teamId });
  await assertConcreteLearnerChallenge(roomId);
  for (const [index, learner] of learners.entries()) await challengeAction(roomId, learner, index + 1, false);
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "challenge-two");
  for (const [index, learner] of learners.entries()) await challengeAction(roomId, learner, index + 1, true);
  await action(roomId, dm, { type: "score-challenge", teamId, rubric: { evidence: 1, logic: 1, execution: 1, collaboration: 1 }, consequence: "", idempotencyKey: key(`score-m${expectedOrder}`) });
  await next(roomId);
  state = await room(roomId, dm);
  assert.equal(state.room.phase, "growth");
  const learnerMembers = state.members.filter((member) => member.role === "learner");
  for (const member of learnerMembers) {
    await action(roomId, dm, {
      type: "award-reputation",
      memberId: member.id,
      scores: { evidence: 1, modeling: 0, delivery: 0, support: 0, iteration: 1, responsibility: 0 },
      evidenceObjectId: `work:${key(`m${expectedOrder}-growth`)}`,
      reason: `M${expectedOrder}完成两轮行动并根据反馈改出第二版`,
    });
  }
  for (const [index, learner] of learners.entries()) {
    await action(roomId, learner, {
      type: "gratitude-vote",
      toMemberId: learnerMembers[(index + 1) % learnerMembers.length].id,
      reason: `M${expectedOrder}第二轮主动帮团队检查证据和停止条件`,
    });
  }
  await action(roomId, learners[0], { type: "freeze-worldline", teamId, decision: `M${expectedOrder}选择先运行最小可验证行动`, rationale: "团队依据来源证据、明确约束和两轮行动迭代形成共同判断" });
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "history");
  await action(roomId, dm, { type: "reveal-history" });
  const revealedLearner = await room(roomId, learners[0]);
  const revealedDm = await room(roomId, dm);
  assert.ok(revealedLearner.chapter.historyReveal);
  assert.equal(revealedLearner.chapter.historyReveal.sourceIds.join(","), revealedDm.chapter.historyReveal?.sourceIds.join(","));
  assert.ok(revealedLearner.chapter.historyReveal.happened.length >= 12);
  await next(roomId);
  assert.equal((await room(roomId, dm)).room.phase, "debrief");
  for (const [index, learner] of learners.entries()) {
    await action(roomId, learner, { type: "submit-reflection", answers: Array.from({ length: 6 }, (_, question) => `M${expectedOrder}学员${index + 1}对复盘问题${question + 1}的证据回答`), realityAction: `M${expectedOrder}学员${index + 1}将在48小时内提交一份可验收现实作品` });
  }
  if (finalChapter) {
    assert.equal((await action(roomId, dm, { type: "next-chapter" }, 409)).error?.code, "DEMO_DAY_REQUIRED");
    assert.equal(state.catalog.demoDay.durationSeconds, 360);
    assert.ok(state.catalog.demoDay.segments.length >= 6);
    assert.equal(state.catalog.demoDay.segments.at(-1)?.endSecond, 360);
    await action(roomId, learners[0], { type: "submit-demo-day", title: `${state.campaign.organization}六分钟发布`, segmentNotes: state.catalog.demoDay.segments.map((segment, index) => `第${index + 1}段：${segment.requirement}，并引用本次战役作品证据`) });
  }
  await action(roomId, dm, { type: "next-chapter" });
  const advanced = await room(roomId, dm);
  assert.equal(advanced.room.phase, finalChapter ? "completed" : "lobby");
  assert.equal(advanced.chapter.order, finalChapter ? expectedOrder : expectedOrder + 1);
}
