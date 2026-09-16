"use client";

import { useMemo, useState } from "react";
import { AI_DAILY_QUIZ, getAiQuizDay } from "../../lib/ai-daily-quiz";
import { publicPath } from "../../lib/public-path";
import styles from "./quiz.module.css";

type Submission = {
  id: string;
  respondentNickname: string;
  dayIndex: number;
  answers: number[];
  results: { questionIndex: number; selected: number; correctAnswer: number; correct: boolean }[];
  correctCount: number;
  totalCount: number;
  score: number;
  coins: number;
  createdAt: string;
};

type ApiResult = { ok: true; data: { submission: Submission; replayed: boolean } } | { ok: false; error?: { message?: string } };

export default function AiDailyQuizClient() {
  const [dayIndex, setDayIndex] = useState(() => new Date().getDay());
  const [nickname, setNickname] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [requestId, setRequestId] = useState("");
  const [result, setResult] = useState<Submission | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");
  const day = getAiQuizDay(dayIndex);
  const answeredCount = answers.filter(Number.isInteger).length;
  const firstMissing = useMemo(() => day.questions.findIndex((_, index) => !Number.isInteger(answers[index])), [answers, day.questions]);

  function selectDay(index: number) {
    if (status === "submitting") return;
    setDayIndex(index); setAnswers([]); setResult(null); setMessage(""); setRequestId("");
  }

  function choose(questionIndex: number, optionIndex: number) {
    if (result || status === "submitting") return;
    setAnswers((current) => { const next = [...current]; next[questionIndex] = optionIndex; return next; });
    setMessage("");
  }

  async function submit() {
    const cleanName = nickname.trim();
    if (!cleanName) { setMessage("请先填写姓名／昵称。"); document.getElementById("ai-quiz-nickname")?.focus(); return; }
    if (firstMissing >= 0) { setMessage(`请先完成第 ${firstMissing + 1} 题。`); document.getElementById(`ai-question-${firstMissing}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const operationId = requestId || `ai-quiz.${Date.now()}.${crypto.randomUUID()}`;
    setRequestId(operationId); setStatus("submitting"); setMessage("");
    try {
      const response = await fetch(publicPath("/api/public/homework/ai-daily-quiz/submissions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientRequestId: operationId, respondentNickname: cleanName, dayIndex, answers }) });
      const payload = await response.json() as ApiResult;
      if (!response.ok || !payload.ok) throw new Error(!payload.ok ? payload.error?.message || "提交失败，请稍后重试。" : "提交失败，请稍后重试。");
      setResult(payload.data.submission); setStatus("idle");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试。"); }
  }

  function restart() { setAnswers([]); setRequestId(""); setResult(null); setStatus("idle"); setMessage(""); }

  return <section className={styles.quizShell}>
    <nav className={styles.dayTabs} aria-label="选择测验日">
      {AI_DAILY_QUIZ.map((item, index) => <button aria-current={index === dayIndex ? "page" : undefined} key={item.day} onClick={() => selectDay(index)} type="button"><b>{item.day}</b><span>{item.theme}</span></button>)}
    </nav>
    <section className={styles.identity}>
      <div><small>TODAY&apos;S MISSION</small><h2>{day.day} · {day.theme}</h2><p>5 道选择题 · 每题答对可得 100 硅谷币</p></div>
      <label htmlFor="ai-quiz-nickname">姓名／昵称 <i>*</i><input autoComplete="nickname" id="ai-quiz-nickname" maxLength={80} onChange={(event) => setNickname(event.target.value)} required value={nickname} /></label>
    </section>
    <div className={styles.progress} aria-label={`已完成 ${answeredCount} / ${day.questions.length} 题`}><span style={{ width: `${answeredCount / day.questions.length * 100}%` }} /><b>{answeredCount} / {day.questions.length}</b></div>
    <ol className={styles.questions}>
      {day.questions.map((question, questionIndex) => <li className={styles.question} id={`ai-question-${questionIndex}`} key={question.q}>
        <header><span>Q{String(questionIndex + 1).padStart(2, "0")}</span><h3>{question.q}</h3></header>
        <div className={styles.options}>{question.options.map((option, optionIndex) => {
          const answerResult = result?.results[questionIndex];
          const selected = answers[questionIndex] === optionIndex;
          const correct = Boolean(result) && answerResult?.correctAnswer === optionIndex;
          const wrong = Boolean(result) && selected && !answerResult?.correct;
          return <button aria-pressed={selected} className={correct ? styles.correct : wrong ? styles.wrong : ""} disabled={Boolean(result)} key={option} onClick={() => choose(questionIndex, optionIndex)} type="button"><b>{String.fromCharCode(65 + optionIndex)}</b><span>{option}</span>{correct && <i>✓ 正确答案</i>}{wrong && <i>× 你的选择</i>}</button>;
        })}</div>
        {result && <aside className={styles.explanation}><b>{result.results[questionIndex]?.correct ? "答对了" : "再认识一下"}</b><p>{question.explain}</p></aside>}
      </li>)}
    </ol>
    <section className={styles.submitPanel}>
      {result ? <><div><small>MISSION COMPLETE</small><h2>{result.correctCount} / {result.totalCount} 题正确</h2><p>本次得分 {result.score} · 应得 {result.coins} 硅谷币</p></div><button onClick={restart} type="button">再答一次</button></> : <><div><small>READY TO CHECK</small><h2>{answeredCount === day.questions.length ? "已答完，可以交卷" : `还差 ${day.questions.length - answeredCount} 题`}</h2><p>提交后会保存本次答题记录，并显示每题解释。</p></div><button disabled={status === "submitting"} onClick={submit} type="button">{status === "submitting" ? "正在交卷…" : "提交答案"}</button></>}
    </section>
    {message && <p className={styles.error} role="alert">{message}</p>}
  </section>;
}
