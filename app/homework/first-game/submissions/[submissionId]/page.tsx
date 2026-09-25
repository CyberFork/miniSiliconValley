import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { BrandHomeLink } from "../../../../components/BrandHomeLink";
import { getFirstGameSubmission, HomeworkError } from "../../../../lib/homework-store";
import { publicPath } from "../../../../lib/public-path";
import FirstGameSubmissionDetailClient from "./FirstGameSubmissionDetailClient";
import styles from "../../../homework.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "第一款游戏｜作业详情", robots: { index: false, follow: false } };

export default async function FirstGameSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params; const db = getClassroomDb(); await ensureClassroomSchema(db);
  let submission;
  try { submission = await getFirstGameSubmission(db, decodeURIComponent(submissionId)); }
  catch (error) { if (error instanceof HomeworkError && error.status === 404) notFound(); throw error; }
  const user = await getChatGPTUser();
  const canEdit = Boolean(user && !user.mustChangePassword && !user.impersonation && (user.role === "admin" || user.role === "mentor"));
  return <main className={styles.page} id="top">
    <header className={styles.top}><BrandHomeLink title="HOMEWORK ARCHIVE" subtitle="作业完整记录" /><nav><a href={publicPath("/homework/first-game/submissions/")}>全部提交</a><a href={publicPath("/homework/first-game/")}>填写新作业</a></nav></header>
    <FirstGameSubmissionDetailClient initialSubmission={submission} canEdit={canEdit} />
    <footer className={styles.footer}><b>公开与修改边界</b><p>本详情无需登录即可阅读。只有真实登录的导师或管理员能够修改；每次修改都会追加修订记录，不覆盖原始提交。昵称由提交者自行填写，不等于经过验证的平台账号。</p></footer><a className={styles.backTop} href="#top" aria-label="回到顶部">↑</a>
  </main>;
}
