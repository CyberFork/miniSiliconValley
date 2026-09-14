import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../../db";
import { BrandHomeLink } from "../../components/BrandHomeLink";
import { PixelAvatar } from "../../components/PixelAvatar";
import { ClassroomError } from "../../lib/classroom-errors";
import { publicPath } from "../../lib/public-path";
import { getPublicTerminalSpace } from "../../lib/terminal-store";
import styles from "../space.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ studentId: string }> }): Promise<Metadata> {
  const { studentId } = await params;
  return { title: `${decodeURIComponent(studentId)} 的硅谷空间`, description: "Young Builder 公开创意空间", robots: { index: false, follow: true } };
}

export default async function PublicSpacePage({ params }: { params: Promise<{ studentId: string }> }) {
  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  const { studentId } = await params;
  let space;
  try { space = await getPublicTerminalSpace(db, decodeURIComponent(studentId)); }
  catch (error) { if (error instanceof ClassroomError && error.status === 404) notFound(); throw error; }
  const spaceGlyph = space.equipment.space === "space-moon-rocket" ? "🚀" : space.equipment.space === "space-pixel-plant" ? "🌱" : "＋";
  return <main className={styles.page}>
    <header className={styles.top}><BrandHomeLink title="YOUNG BUILDER SPACE" subtitle="公开创意基地" /><nav><a href={publicPath("/world/")}>探索世界</a><a href={publicPath("/course/")}>课件查看</a><a href={publicPath("/terminal/")}>打开时空终端</a></nav></header>
    <section className={styles.hero}><small>PUBLIC SPACE · @{space.studentId}</small><h1>{space.displayName} 的<br />像素创意基地</h1><p>{space.intro || "我正在学习把问题变成可以行动的方案。"}</p></section>
    <section className={styles.room} data-identity-frame={space.equipment.identity ?? "default"}>
      <div className={styles.window}><span /><span /><span /></div>
      <article className={styles.identity}><PixelAvatar seed={space.avatarSeed} label={space.displayName} size="large" /><h2>{space.displayName}</h2><small>@{space.studentId}</small></article>
      <article className={styles.project}><small>作品工作台</small><h2>{space.projectTitle || "作品准备中"}</h2><p>{space.projectSummary || "这位 Young Builder 还没有放上公开作品。"}</p>{space.projectUrl && <a href={space.projectUrl} target="_blank" rel="noreferrer">访问公开作品 ↗</a>}</article>
      <article className={styles.team}><small>TEAM ATTRIBUTION</small><h3>{space.teamName || "个人探索"}</h3><p>{space.contribution || "团队与个人贡献将在这里明确标注。"}</p></article>
      <div className={styles.item} aria-label="空间装饰">{spaceGlyph}</div>
    </section>
    <footer className={styles.privacy}><b>公开边界</b><p>本页只展示主人主动填写的公开副本与已装备装饰，不展示作业草稿、私密卡、钱包、密码、登录信息或管理备注。</p><a href={publicPath("/")}>返回 MINI硅谷 →</a></footer>
  </main>;
}
