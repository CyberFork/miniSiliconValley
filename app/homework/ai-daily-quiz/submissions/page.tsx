import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../../../db";
import { AccountMenu } from "../../../components/AccountMenu";
import { BrandHomeLink } from "../../../components/BrandHomeLink";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../../chatgpt-auth";
import { AI_DAILY_QUIZ, getAiQuizDay } from "../../../lib/ai-daily-quiz";
import { listAiQuizSubmissions } from "../../../lib/ai-daily-quiz-store";
import { publicPath } from "../../../lib/public-path";
import styles from "../quiz.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI 每日一题｜教师查看", description: "教师查看 AI 每日一题提交", robots: { index: false, follow: false } };
const returnTo = "/homework/ai-daily-quiz/submissions/";

export default async function AiDailyQuizSubmissionsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation || (user.role !== "admin" && user.role !== "mentor")) return <main className={styles.denied}><section><small>403 · TEACHER ONLY</small><h1>这里是教师查看页</h1><p>只有真实登录的导师和管理员可以查看学生的答题记录。</p><a href={publicPath("/homework/ai-daily-quiz/")}>返回 AI 每日一题</a></section></main>;
  const rawPage = (await searchParams).page;
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? 1);
  const db = getClassroomDb(); await ensureClassroomSchema(db);
  const result = await listAiQuizSubmissions(db, page);
  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="HOMEWORK ARCHIVE" subtitle="AI 每日一题 · 教师查看" />
      <nav><a href={publicPath("/homework/ai-daily-quiz/")}>打开学生答题页</a><AccountMenu user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: null }} returnTo={returnTo} /></nav>
    </header>
    <section className={styles.reviewHeader}><div><small>MENTOR REVIEW · SERVER RECORDS</small><h1>AI 每日一题提交</h1><p>任何真实登录的导师或管理员都可查看。每次提交独立保存；页面不会把相同昵称合并成同一位学生。</p></div><b>{result.total} 份记录</b></section>
    {result.submissions.length ? <section className={styles.reviewGrid}>{result.submissions.map((submission) => {
      const day = getAiQuizDay(submission.dayIndex);
      return <article className={styles.submissionCard} key={submission.id}><small>{formatTime(submission.createdAt)}</small><header><div><h2>{submission.respondentNickname}</h2><span>{day.day} · {day.theme}</span></div><b>{submission.score} 分</b></header><div className={styles.submissionMeta}><span>{submission.correctCount}/{submission.totalCount} 题正确</span><span>应得 {submission.coins} 硅谷币</span></div><details><summary>展开逐题记录</summary><ol className={styles.answerList}>{submission.results.map((answer) => {
        const question = AI_DAILY_QUIZ[submission.dayIndex].questions[answer.questionIndex];
        return <li data-correct={answer.correct} key={answer.questionIndex}><b>{answer.questionIndex + 1}. {answer.correct ? "正确" : "错误"} · 选择 {String.fromCharCode(65 + answer.selected)}</b><span>{question.q}</span><p>正确答案：{String.fromCharCode(65 + answer.correctAnswer)} · {question.options[answer.correctAnswer]}</p><p>{question.explain}</p></li>;
      })}</ol></details></article>;
    })}</section> : <section className={styles.empty}><h2>还没有真实提交</h2><p>这里不预置演示记录。学生完成第一次提交后会出现在这里。</p></section>}
    {result.total > result.pageSize && <nav className={styles.pagination} aria-label="提交分页">{result.page > 1 && <a href={`?page=${result.page - 1}`}>← 上一页</a>}<b>{result.page} / {result.pageCount}</b>{result.page < result.pageCount && <a href={`?page=${result.page + 1}`}>下一页 →</a>}</nav>}
  </main>;
}

function formatTime(value: string): string { return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
