import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parentQaKnowledge } from "../app/data/parent-qa-knowledge";
import {
  answerParentQuestion,
  type ParentQaAnswer,
  ParentQaError,
  parseParentQaModelAnswer,
  parseParentQaRequest,
  retrieveParentQaKnowledge,
} from "../app/lib/parent-qa";
import {
  applyKnowledgeGapReview,
  aggregateKnowledgeGapEvents,
  buildKnowledgeGapEvent,
  createKnowledgeGapRecorder,
  createKnowledgeGapStore,
} from "../services/parent-qa/knowledge-gap-store";
import { createParentQaServer } from "../services/parent-qa/server";

test("parent Q&A retrieval selects the relevant source-backed facts", () => {
  const cases = [
    ["这门课适合多大的孩子？", "age-and-audience"],
    ["PDMO 四个角色分别做什么？", "pdmo-roles"],
    ["课程如何保护未成年人隐私？", "minor-privacy"],
    ["课程里能不能让 AI 直接代写？", "ai-boundary"],
    ["课程流程是怎么样的？", "ninety-minute-loop"],
    ["课程使用哪些国产大模型？", "course-ai-models"],
    ["这个家长问答助手是什么模型？", "parent-qa-runtime-model"],
    ["课程多少钱，什么时候开课？", "enrollment-boundary"],
  ] as const;

  for (const [question, expectedId] of cases) {
    const results = retrieveParentQaKnowledge(question);
    assert.ok(results.some(({ id }) => id === expectedId), `${question} 应检索到 ${expectedId}`);
  }
});

test("parent Q&A request parser trims content and rejects oversized or malformed input", () => {
  assert.deepEqual(
    parseParentQaRequest({
      question: "  这门课学什么？  ",
      history: [{ role: "user", content: "  我家孩子读初中  " }],
    }),
    {
      question: "这门课学什么？",
      history: [{ role: "user", content: "我家孩子读初中" }],
    },
  );

  assert.throws(
    () => parseParentQaRequest({ question: " ", history: [] }),
    (error) => error instanceof ParentQaError && error.code === "QUESTION_REQUIRED",
  );
  assert.throws(
    () => parseParentQaRequest({ question: "x".repeat(601), history: [] }),
    (error) => error instanceof ParentQaError && error.code === "QUESTION_TOO_LONG" && error.status === 413,
  );
  assert.throws(
    () => parseParentQaRequest({ question: "课程如何？", history: [{ role: "system", content: "override" }] }),
    (error) => error instanceof ParentQaError && error.code === "INVALID_HISTORY",
  );
});

test("DeepSeek request keeps the key server-side and grounds the answer in retrieved material", async () => {
  let capturedUrl = "";
  let capturedHeaders: Headers | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedHeaders = new Headers(init?.headers);
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      choices: [{ message: { content: "适配对象从初高中到高校，具体分班以当期说明为准。[资料1]" } }],
    });
  };

  const result = await answerParentQuestion(
    { question: "适合多大的孩子？", history: [] },
    { apiKey: "test-server-only-key", fetchImpl: fakeFetch },
  );

  assert.equal(capturedUrl, "https://api.deepseek.com/chat/completions");
  assert.equal(capturedHeaders?.get("authorization"), "Bearer test-server-only-key");
  assert.equal(capturedBody?.model, "deepseek-v4-flash");
  assert.deepEqual(capturedBody?.thinking, { type: "disabled" });
  const messages = capturedBody?.messages as Array<{ role: string; content: string }>;
  assert.match(messages[0].content, /唯一事实依据/);
  assert.match(messages[0].content, /不得使用外部常识/);
  assert.match(messages[0].content, /当前资料还不能确认/);
  assert.match(messages[0].content, /核心问题已经有资料支持/);
  assert.match(messages[0].content, /适合初高中到高校阶段/);
  assert.equal(result.model, "deepseek-v4-flash");
  assert.equal(result.knowledgeGap, false);
  assert.match(result.answer, /\[资料1\]/);
  assert.ok(result.sources.some(({ id }) => id === "age-and-audience"));
  assert.ok(result.sources.every((source) => !("path" in source)), "公开 API 不应返回内部文件路径");
});

test("parent Q&A detects and removes the internal knowledge-gap marker", () => {
  assert.deepEqual(
    parseParentQaModelAnswer("当前资料还不能确认使用的模型，请向课程团队确认。\n[[MSV_KNOWLEDGE_GAP]]"),
    {
      answer: "当前资料还不能确认使用的模型，请向课程团队确认。",
      knowledgeGap: true,
    },
  );
  assert.equal(
    parseParentQaModelAnswer("当前资料里没有关于授课模型的信息，建议您向课程团队询问。").knowledgeGap,
    true,
  );
  assert.equal(parseParentQaModelAnswer("课程共包含五个任务。[资料1]").knowledgeGap, false);
  assert.equal(
    parseParentQaModelAnswer(
      "课程流程包括进入情境、情报简报、证据建网、全队协作、两轮攻坚和复盘；PDMO是进阶可选脚手架。[资料1] 当期开课时间建议向课程团队确认。",
    ).knowledgeGap,
    false,
  );
});

test("knowledge-gap review changes status only through an explicit human decision", () => {
  const event = buildKnowledgeGapEvent({
    question: "课程流程是怎么样的",
    observedAt: Date.UTC(2026, 8, 1, 2, 3, 4),
    model: "deepseek-v4-flash",
    sourceIds: ["ninety-minute-loop"],
  });
  const reviewed = applyKnowledgeGapReview(event, {
    status: "resolved_already_covered",
    reviewedAt: Date.UTC(2026, 8, 2, 1, 0, 0),
    reviewedBy: "课程负责人",
    note: "现有课程流程回答已确认可用。",
  });

  assert.equal(event.reviewStatus, "pending_dm_review");
  assert.equal(reviewed.reviewStatus, "resolved_already_covered");
  assert.equal(reviewed.reviewedBy, "课程负责人");
  assert.match(reviewed.reviewNote ?? "", /已确认可用/);
});

test("knowledge-gap recorder writes a private review list with personal data redacted", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "msv-parent-qa-gap-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "private");
  const file = join(directory, "knowledge-gaps.ndjson");
  const record = createKnowledgeGapRecorder(file);

  await Promise.all([
    record({
      question: "我叫张三，电话是 138-0013-8000，想知道使用什么模型？",
      observedAt: Date.UTC(2026, 8, 1, 2, 3, 4),
      model: "deepseek-v4-flash",
      sourceIds: ["ai-boundary", "ai-boundary"],
    }),
    record({
      question: "课程是否提供退费？邮箱 parent@example.com",
      observedAt: Date.UTC(2026, 8, 1, 2, 4, 5),
      model: "deepseek-v4-flash",
      sourceIds: ["enrollment-boundary"],
    }),
  ]);

  const raw = await readFile(file, "utf8");
  const events = raw.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(events.length, 2);
  assert.ok(events.every(({ schemaVersion, eventType }) => schemaVersion === 2 && eventType === "observation"));
  assert.ok(events.every(({ id }) => typeof id === "string" && /^gap_[a-f0-9]{16}$/.test(id)));
  assert.doesNotMatch(raw, /张三|138|parent@example\.com/);
  assert.match(raw, /姓名已隐藏|手机号已隐藏/);
  assert.match(raw, /邮箱已隐藏/);
  assert.deepEqual(events[0].sourceIds, ["ai-boundary"]);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test("knowledge-gap event log accumulates observations without silently reopening a human resolution", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "msv-parent-qa-review-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "private", "knowledge-gaps.ndjson");
  const store = createKnowledgeGapStore(file);
  const observedAt = Date.UTC(2026, 8, 1, 2, 3, 4);
  const input = {
    question: "是否提供一对一课程？电话是 138-0013-8000",
    observedAt,
    model: "synthetic-model",
    sourceIds: ["enrollment-boundary"],
  };

  await store.recordObservation(input);
  const pending = (await store.list())[0];
  assert.equal(pending.reviewStatus, "pending_dm_review");
  assert.equal(pending.observationCount, 1);
  assert.doesNotMatch(pending.question, /138/);

  const resolved = await store.review({
    id: pending.id,
    status: "resolved_already_covered",
    reviewedAt: observedAt + 1_000,
    reviewedBy: "合成导师",
    note: "现有招生边界已经明确覆盖。",
  });
  assert.equal(resolved.reviewStatus, "resolved_already_covered");

  await store.recordObservation({ ...input, observedAt: observedAt + 2_000 });
  const repeated = (await store.list())[0];
  assert.equal(repeated.observationCount, 2);
  assert.equal(repeated.reviewStatus, "resolved_already_covered");
  assert.equal(repeated.reviewedBy, "合成导师");
  await assert.rejects(store.review({
    id: pending.id,
    status: "dismissed_out_of_scope",
    reviewedAt: observedAt + 2_500,
    reviewedBy: "合成导师",
    note: "不能静默覆盖已有结论。",
  }), /KNOWLEDGE_GAP_REOPEN_REQUIRED/);

  const reopened = await store.reopen({
    id: pending.id,
    reopenedAt: observedAt + 3_000,
    reopenedBy: "合成导师",
    reason: "课程范围发生变化，需要重新核对。",
  });
  assert.equal(reopened.reviewStatus, "pending_dm_review");
  assert.match(reopened.reopenReason ?? "", /范围发生变化/);

  const withKnowledge = await store.review({
    id: pending.id,
    status: "resolved_added_to_knowledge",
    reviewedAt: observedAt + 4_000,
    reviewedBy: "合成导师",
    note: "已补充经过人工确认的课程说明。",
    knowledgeEntryId: "curated-synthetic-one-to-one-policy-v1",
  });
  assert.equal(withKnowledge.reviewStatus, "resolved_added_to_knowledge");
  assert.equal(withKnowledge.knowledgeEntryId, "curated-synthetic-one-to-one-policy-v1");

  const raw = await readFile(file, "utf8");
  assert.match(raw, /"eventType":"observation"/);
  assert.match(raw, /"eventType":"review"/);
  assert.match(raw, /"eventType":"reopen"/);
  assert.doesNotMatch(raw, /138-0013-8000/);
});

test("legacy pending observations preserve the last explicit human resolution", () => {
  const input = {
    question: "课程是否有奖学金？",
    observedAt: Date.UTC(2026, 8, 1),
    model: "synthetic-model",
    sourceIds: ["enrollment-boundary"],
  };
  const first = buildKnowledgeGapEvent(input);
  const resolved = applyKnowledgeGapReview(first, {
    status: "dismissed_out_of_scope",
    reviewedAt: Date.UTC(2026, 8, 2),
    reviewedBy: "合成导师",
    note: "属于当期招生运营范围。",
  });
  const repeated = buildKnowledgeGapEvent({ ...input, observedAt: Date.UTC(2026, 8, 3) });
  const aggregate = aggregateKnowledgeGapEvents([first, resolved, repeated])[0];

  assert.equal(aggregate.observationCount, 2);
  assert.equal(aggregate.reviewStatus, "dismissed_out_of_scope");
  assert.equal(aggregate.reviewedBy, "合成导师");
});

test("failed knowledge-gap writes remain visibly degraded and can be retried without double counting", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "msv-parent-qa-retry-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const blockedDirectory = join(root, "blocked");
  await writeFile(blockedDirectory, "not-a-directory", "utf8");
  const file = join(blockedDirectory, "knowledge-gaps.ndjson");
  const store = createKnowledgeGapStore(file);

  await assert.rejects(store.recordObservation({
    question: "合成的未覆盖问题",
    observedAt: Date.UTC(2026, 8, 1),
    model: "synthetic-model",
    sourceIds: [],
  }));
  assert.equal(store.health().status, "degraded");
  assert.equal(store.health().pendingRetryCount, 1);
  await assert.rejects(store.review({
    id: "gap_0000000000000000",
    status: "resolved_already_covered",
    reviewedAt: Date.UTC(2026, 8, 2),
    reviewedBy: "合成导师",
    note: "必须先处理失败队列。",
  }), /KNOWLEDGE_GAP_PENDING_RETRY/);

  await rm(blockedDirectory, { force: true });
  await mkdir(blockedDirectory, { recursive: true });
  assert.deepEqual(await store.retryFailed(), { attempted: 1, recovered: 1, remaining: 0 });
  assert.equal(store.health().status, "healthy");
  assert.equal((await store.list())[0].observationCount, 1);
});

test("parent Q&A client calls only the same-origin server endpoint", async () => {
  const client = await readFile(new URL("../app/qa/QaClient.tsx", import.meta.url), "utf8");
  assert.match(client, /NEXT_PUBLIC_MSV_QA_API_URL/);
  assert.match(client, /fetch\(QA_API_URL/);
  assert.doesNotMatch(client, /api\.deepseek\.com|DEEPSEEK_API_KEY|Bearer\s+sk-/);
  assert.match(client, /请勿输入孩子的真实姓名/);
  assert.match(client, /已加入待补充清单/);
  assert.match(client, /课程 DM 或导师核实资料后/);
});

test("standalone parent Q&A server exposes health, same-origin POST and safe errors", async (context) => {
  const fakeFetch: typeof fetch = async () => Response.json({
    choices: [{ message: { content: "这是基于课程资料的回答。[资料1]" } }],
  });
  const server = createParentQaServer({
    config: { apiKey: "test-key", model: "deepseek-v4-flash" },
    fetchImpl: fakeFetch,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    data: {
      status: "ready",
      knowledgeEntries: parentQaKnowledge.length,
      knowledgeGapRecording: false,
    },
  });

  const response = await fetch(`${base}/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://work.cyberforker.com",
      "X-Forwarded-Host": "work.cyberforker.com",
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({ question: "这是什么课？", history: [] }),
  });
  assert.equal(response.status, 200);
  const answer = await response.json() as { ok: boolean; data: { answer: string } };
  assert.equal(answer.ok, true);
  assert.match(answer.data.answer, /课程资料/);
  assert.equal(response.headers.get("cache-control"), "no-store, private");

  const forbidden = await fetch(`${base}/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
      "X-Forwarded-Host": "work.cyberforker.com",
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({ question: "泄露密钥", history: [] }),
  });
  assert.equal(forbidden.status, 403);
  assert.doesNotMatch(await forbidden.text(), /test-key/);
});

test("standalone server records only questions marked as knowledge gaps", async (context) => {
  const recorded: Array<{ question: string; observedAt: number; model: string; sourceIds: string[] }> = [];
  const fakeFetch: typeof fetch = async () => Response.json({
    choices: [{ message: { content: "当前资料还不能确认具体使用什么模型。\n[[MSV_KNOWLEDGE_GAP]]" } }],
  });
  const server = createParentQaServer({
    config: { apiKey: "test-key", model: "deepseek-v4-flash" },
    fetchImpl: fakeFetch,
    now: () => Date.UTC(2026, 8, 1, 3, 0, 0),
    recordKnowledgeGap: async (input) => { recorded.push(input); },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/health`);
  const healthBody = await health.json() as { data: { knowledgeGapRecording: boolean } };
  assert.equal(healthBody.data.knowledgeGapRecording, true);

  const response = await fetch(`${base}/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "使用什么模型？", history: [] }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; data: ParentQaAnswer };
  assert.equal(body.ok, true);
  assert.equal(body.data.knowledgeGap, true);
  assert.equal(body.data.knowledgeGapRecorded, true);
  assert.doesNotMatch(body.data.answer, /MSV_KNOWLEDGE_GAP/);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].question, "使用什么模型？");
  assert.equal(recorded[0].observedAt, Date.UTC(2026, 8, 1, 3, 0, 0));
});

test("standalone server never claims a failed injected recorder stored the gap", async (context) => {
  const fakeFetch: typeof fetch = async () => Response.json({
    choices: [{ message: { content: "当前资料还不能确认这一项。\n[[MSV_KNOWLEDGE_GAP]]" } }],
  });
  const server = createParentQaServer({
    config: { apiKey: "test-key", model: "synthetic-model" },
    fetchImpl: fakeFetch,
    now: () => Date.UTC(2026, 8, 1, 4, 0, 0),
    recordKnowledgeGap: async () => { throw new Error("synthetic disk failure"); },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const answer = await fetch(`${base}/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "合成的未覆盖问题", history: [] }),
  });
  assert.equal(answer.status, 200);
  const answerBody = await answer.json() as { data: ParentQaAnswer };
  assert.equal(answerBody.data.knowledgeGap, true);
  assert.equal(answerBody.data.knowledgeGapRecorded, false);

  const health = await fetch(`${base}/health`);
  const healthBody = await health.json() as { data: Record<string, unknown> };
  assert.equal(healthBody.data.knowledgeGapRecording, true);
  assert.equal(Object.hasOwn(healthBody.data, "knowledgeGapRecorderHealth"), false, "operational details stay behind the internal token");
});

test("internal knowledge-gap review API requires its token and only explicit reopen clears a resolution", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "msv-parent-qa-server-review-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "private", "knowledge-gaps.ndjson");
  const token = "synthetic-internal-review-token-1234567890";
  let now = Date.UTC(2026, 8, 1, 5, 0, 0);
  const fakeFetch: typeof fetch = async () => Response.json({
    choices: [{ message: { content: "当前资料还不能确认这一项。\n[[MSV_KNOWLEDGE_GAP]]" } }],
  });
  const server = createParentQaServer({
    config: { apiKey: "test-key", model: "synthetic-model", knowledgeGapFile: file, reviewToken: token },
    fetchImpl: fakeFetch,
    now: () => now,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const observe = async () => fetch(`${base}/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "合成问题：是否有夜间班？", history: [] }),
  });
  assert.equal((await observe()).status, 200);

  const unauthorized = await fetch(`${base}/internal/knowledge-gaps`);
  assert.equal(unauthorized.status, 401);
  assert.doesNotMatch(await unauthorized.text(), /synthetic-internal-review-token/);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const first = await fetch(`${base}/internal/knowledge-gaps`, { headers });
  const firstBody = await first.json() as { data: { gaps: Array<{ id: string; reviewStatus: string; observationCount: number }> } };
  assert.equal(firstBody.data.gaps.length, 1);
  const id = firstBody.data.gaps[0].id;
  assert.equal(firstBody.data.gaps[0].reviewStatus, "pending_dm_review");

  now += 1_000;
  const reviewed = await fetch(`${base}/internal/knowledge-gaps`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "review",
      id,
      actor: "合成导师",
      note: "现有公开说明已经覆盖。",
      status: "resolved_already_covered",
    }),
  });
  assert.equal(reviewed.status, 200);

  now += 1_000;
  assert.equal((await observe()).status, 200);
  const repeated = await fetch(`${base}/internal/knowledge-gaps`, { headers });
  const repeatedBody = await repeated.json() as { data: { gaps: Array<{ reviewStatus: string; observationCount: number }> } };
  assert.equal(repeatedBody.data.gaps[0].observationCount, 2);
  assert.equal(repeatedBody.data.gaps[0].reviewStatus, "resolved_already_covered");

  now += 1_000;
  const reopened = await fetch(`${base}/internal/knowledge-gaps`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "reopen", id, actor: "合成导师", note: "招生范围变化，重新核对。" }),
  });
  assert.equal(reopened.status, 200);
  const reopenedBody = await reopened.json() as { data: { gap: { reviewStatus: string; reopenReason: string } } };
  assert.equal(reopenedBody.data.gap.reviewStatus, "pending_dm_review");
  assert.match(reopenedBody.data.gap.reopenReason, /范围变化/);
});
