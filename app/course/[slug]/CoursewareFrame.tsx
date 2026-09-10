"use client";

import Link from "next/link";

import { AccountMenu, type AccountMenuUser } from "../../components/AccountMenu";
import type { CoursewareContent } from "../../lib/courseware-store";
import styles from "../course.module.css";

function exactHref(item: CoursewareContent, initialSlide?: number, initialStep?: number): string {
  const query = new URLSearchParams({ revision: String(item.revision), digest: item.digest });
  if (initialSlide !== undefined && initialSlide >= 1) query.set("slide", String(initialSlide));
  if (initialStep !== undefined) query.set("step", String(initialStep));
  return `/course/${encodeURIComponent(item.slug)}/?${query.toString()}`;
}

function playerHref(item: CoursewareContent, initialSlide?: number, initialStep?: number): string {
  const query = new URLSearchParams({ revision: String(item.revision), digest: item.digest });
  if (initialSlide !== undefined && initialSlide >= 1) query.set("slide", String(initialSlide));
  if (initialStep !== undefined) query.set("step", String(initialStep));
  return `${item.entryPath}?${query.toString()}`;
}

export default function CoursewareFrame({
  item,
  user,
  initialSlide,
  initialStep,
  backHref = "/course/",
  backLabel = "课件库",
  preview = false,
  returnToHref,
}: {
  item: CoursewareContent;
  user: AccountMenuUser;
  initialSlide?: number;
  initialStep?: number;
  backHref?: string;
  backLabel?: string;
  preview?: boolean;
  returnToHref?: string;
}) {
  const returnTo = returnToHref ?? (preview
    ? `/studio/courseware/${encodeURIComponent(item.packageId)}/?revision=${item.revision}&digest=${item.digest}`
    : exactHref(item, initialSlide, initialStep));
  const header = <header className={styles.viewerHeader}>
    <Link href={backHref}>← {backLabel}</Link>
    <b>Mini Silicon Valley · {item.mentorRole} 导师</b>
    <AccountMenu user={user} returnTo={returnTo} />
  </header>;
  const identity = <div className={styles.viewerMeta}>
    <small>{preview ? "INTERNAL EXACT PREVIEW" : item.releaseStatus === "historical" ? "HISTORICAL RELEASE" : "EXACT COURSEWARE"} · {item.mentorRole} · r{item.revision}</small>
    <h1>{item.title}</h1>
    <code>{item.packageId} · {item.digest}</code>
    {preview && !item.released && <span className={styles.previewWarning}>内部 Candidate · 未正式发布 · 不对学员目录开放</span>}
    {!preview && item.releaseStatus === "historical" && <span className={styles.previewWarning}>历史已发布版本 · 旧课堂 exact 引用仍可读取</span>}
  </div>;
  if (item.contentKind === "static-bundle" && item.entryPath) return <main className={styles.viewer}>
    {header}
    {identity}
    <div className={styles.staticLaunch}><section><span className={styles.warning}>固定版本 · 原样播放</span><h2>在独立页面打开完整课件</h2><p>系统保持这一版本的 HTML、图片与交互资源不变，并把当前课堂锁定到 exact revision／digest。</p><a className={styles.launch} href={playerHref(item, initialSlide, initialStep)}>进入全屏课件 →</a></section></div>
  </main>;
  return <main className={styles.viewer}>
    {header}
    {identity}
    <iframe className={styles.frame} title={item.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={item.htmlContent ?? ""} />
  </main>;
}
