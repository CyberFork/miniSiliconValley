import type { Metadata } from "next";
import { ensureClassroomSchema, getClassroomDb } from "../../../../db";
import { BrandHomeLink } from "../../../components/BrandHomeLink";
import { listFirstGameSubmissions } from "../../../lib/homework-store";
import { publicPath } from "../../../lib/public-path";
import styles from "../../homework.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "第一款游戏｜公开提交", description: "免登录查看《我的第一款游戏》作业提交", robots: { index: false, follow: false } };

export default async function FirstGameSubmissionsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const rawPage = (await searchParams).page; const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? 1);
  const db = getClassroomDb(); await ensureClassroomSchema(db); const result = await listFirstGameSubmissions(db, page);
  return <main className={styles.page}>
    <header className={styles.top}><BrandHomeLink title="HOMEWORK ARCHIVE" subtitle="公开提交查看" /><nav><a href={publicPath("/homework/first-game/")}>填写一份新作业</a></nav></header>
    <section className={styles.listHeader}><div><small className={styles.publicBadge}>免登录公开查看</small><h1>第一款游戏档案</h1><p>共 {result.total} 份独立提交。相同昵称也不会合并或覆盖。</p></div><a className={styles.backLink} href={publicPath("/homework/first-game/")}>＋ 填写新作业</a></section>
    {result.submissions.length ? <section className={styles.submissionGrid}>{result.submissions.map((item) => <a className={styles.submissionCard} href={publicPath(`/homework/first-game/submissions/${encodeURIComponent(item.id)}/`)} key={item.id}><small>{formatTime(item.createdAt)}</small><h2>{item.respondentNickname || "匿名 Young Builder"}</h2><p>{item.respondentNote || "没有填写补充说明。"}</p><div><span>{item.answeredCount} 项有内容</span></div><b>打开完整作业 →</b></a>)}</section> : <section className={styles.emptyList}><h2>还没有提交</h2><p>这里不会预置假数据。第一份真实提交保存后会出现在这里。</p><a className={styles.backLink} href={publicPath("/homework/first-game/")}>填写第一份作业 →</a></section>}
    {result.total > result.pageSize && <nav className={styles.pagination} aria-label="提交分页">{result.page > 1 && <a href={`?page=${result.page - 1}`}>← 上一页</a>}<b>{result.page} / {result.pageCount}</b>{result.page < result.pageCount && <a href={`?page=${result.page + 1}`}>下一页 →</a>}</nav>}
    <footer className={styles.footer}><b>提醒</b><p>公开查看不等于经过老师审核，也不代表同名提交来自同一个人。每份内容只代表提交者当时填写的版本。</p></footer>
  </main>;
}

function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
