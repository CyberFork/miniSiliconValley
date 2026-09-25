import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("AI quiz is public to answer but staff-only to review", () => {
  for (const path of ["app/homework/ai-daily-quiz/page.tsx", "app/homework/ai-daily-quiz/AiDailyQuizClient.tsx", "app/homework/ai-daily-quiz/submissions/page.tsx", "app/api/public/homework/ai-daily-quiz/submissions/route.ts", "app/api/homework/ai-daily-quiz/submissions/route.ts"]) assert.equal(existsSync(new URL(path, root)), true, `missing ${path}`);
  const page = source("app/homework/ai-daily-quiz/page.tsx"); const client = source("app/homework/ai-daily-quiz/AiDailyQuizClient.tsx"); const review = source("app/homework/ai-daily-quiz/submissions/page.tsx"); const protectedApi = source("app/api/homework/ai-daily-quiz/submissions/route.ts");
  assert.match(page, /getChatGPTUser/); assert.match(page, /user\?\.role === "admin" \|\| user\?\.role === "mentor"/); assert.match(page, /canReview &&/);
  assert.match(review, /chatGPTSignInPath/); assert.match(review, /user\.role !== "admin" && user\.role !== "mentor"/); assert.match(review, /user\.impersonation/);
  assert.match(protectedApi, /requireStudioRole\(user\)/); assert.match(client, /api\/public\/homework\/ai-daily-quiz\/submissions/);
  for (const insecure of ["minigu123", "teacher-password", "minigu_submissions", "localStorage"]) { assert.doesNotMatch(page + client + review, new RegExp(insecure)); }
});

test("AI quiz keeps real mouse, keyboard and touch controls with server results", () => {
  const client = source("app/homework/ai-daily-quiz/AiDailyQuizClient.tsx"); const css = source("app/homework/ai-daily-quiz/quiz.module.css"); const store = source("app/lib/ai-daily-quiz-store.ts");
  assert.match(client, /<button/); assert.match(client, /aria-pressed/); assert.match(client, /aria-current/); assert.match(client, /disabled=\{Boolean\(result\)\}/); assert.match(client, /question\.explain/);
  assert.match(css, /@media\(max-width:680px\)/); assert.match(css, /min-height:58px/); assert.match(store, /selected === day\.questions\[questionIndex\]\.answer/); assert.match(store, /coins = correctCount \* 100/);
});
