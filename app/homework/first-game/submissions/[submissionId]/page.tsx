import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { BrandHomeLink } from "../../../../components/BrandHomeLink";
import { FIRST_GAME_HOMEWORK_SECTIONS, type FirstGameAnswer, type FirstGameField } from "../../../../lib/first-game-homework";
import { getFirstGameSubmission, HomeworkError } from "../../../../lib/homework-store";
import { publicPath } from "../../../../lib/public-path";
import styles from "../../../homework.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "第一款游戏｜作业详情", robots: { index: false, follow: false } };

export default async function FirstGameSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params; const db = getClassroomDb(); await ensureClassroomSchema(db);
  let submission;
  try { submission = await getFirstGameSubmission(db, decodeURIComponent(submissionId)); }
  catch (error) { if (error instanceof HomeworkError && error.status === 404) notFound(); throw error; }
  return <main className={styles.page} id="top">
    <header className={styles.top}><BrandHomeLink title="HOMEWORK ARCHIVE" subtitle="作业完整记录" /><nav><a href={publicPath("/homework/first-game/submissions/")}>全部提交</a><a href={publicPath("/homework/first-game/")}>填写新作业</a></nav></header>
    <section className={styles.detailHeader}><div><small className={styles.publicBadge}>免登录公开详情</small><h1>{submission.respondentNickname || "匿名 Young Builder"} 的游戏</h1></div><a className={styles.backLink} href={publicPath("/homework/first-game/submissions/")}>← 返回提交列表</a></section>
    <div className={styles.detailMeta}><span>提交时间：{formatTime(submission.createdAt)}</span><span>{submission.answeredCount} 项有内容</span><span>独立记录，不覆盖旧版本</span></div>
    {submission.respondentNote && <aside className={styles.respondentNote}><b>提交者想说</b><p>{submission.respondentNote}</p></aside>}
    {FIRST_GAME_HOMEWORK_SECTIONS.map((section) => { const visible = section.fields.filter((field) => hasContent(submission.answers[field.id])); if (!visible.length) return null; return <section className={styles.answerSection} key={section.id}><header><small>{section.level}</small><h2>{section.title}</h2></header><div>{visible.map((field) => <AnswerCard field={field} answer={submission.answers[field.id]} key={field.id} />)}</div></section>; })}
    {submission.answeredCount === 0 && <section className={styles.emptyList}><h2>旧版空白记录</h2><p>这是启用第一部分必填规则前保存的历史记录。</p></section>}
    <footer className={styles.footer}><b>公开与身份边界</b><p>本详情无需登录即可访问。昵称由提交者自行填写，不等于经过验证的平台账号；内容也不代表老师已审核。</p></footer><a className={styles.backTop} href="#top" aria-label="回到顶部">↑</a>
  </main>;
}

function AnswerCard({ field, answer }: { field: FirstGameField; answer: FirstGameAnswer }) {
  if (field.kind === "table" && Array.isArray(answer)) return <article className={styles.answerCard} data-wide="true"><b>{field.label}</b><div className={styles.tableScroll}><table><thead><tr><th>项目</th>{field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}</tr></thead><tbody>{answer.filter((row): row is Record<string, string> => typeof row === "object" && row !== null).map((row, index) => <tr key={`${row.rowId ?? index}`}><th>{field.rows?.find((item) => item.id === row.rowId)?.label ?? `第 ${index + 1} 行`}</th>{field.columns?.map((column) => <td key={column.id}>{row[column.id] || "—"}</td>)}</tr>)}</tbody></table></div></article>;
  if (Array.isArray(answer)) return <article className={styles.answerCard}><b>{field.label}</b><ul>{answer.filter((item): item is string => typeof item === "string").map((item) => <li key={item}>{item}</li>)}</ul></article>;
  return <article className={styles.answerCard}><b>{field.label}</b><p>{answer || "—"}</p></article>;
}

function hasContent(value: FirstGameAnswer | undefined): value is FirstGameAnswer {
  if (typeof value === "string") return Boolean(value.trim());
  return Array.isArray(value) && value.some((item) => typeof item === "string" ? Boolean(item.trim()) : Object.entries(item).some(([key, cell]) => key !== "rowId" && Boolean(String(cell).trim())));
}
function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
