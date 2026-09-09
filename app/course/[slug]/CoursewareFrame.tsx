"use client";

import Link from "next/link";

import { AccountMenu, type AccountMenuUser } from "../../components/AccountMenu";
import type { CoursewareContent } from "../../lib/courseware-store";
import styles from "../course.module.css";

function exactHref(item: CoursewareContent, initialSlide?: number, initialStep?: number): string {
  const query = new URLSearchParams({ revision: String(item.revision) });
  if (initialSlide !== undefined && initialSlide >= 1) query.set("slide", String(initialSlide));
  if (initialStep !== undefined) query.set("step", String(initialStep));
  return `/course/${encodeURIComponent(item.slug)}/?${query.toString()}`;
}

function playerHref(item: CoursewareContent, initialSlide?: number, initialStep?: number): string {
  const query = new URLSearchParams({ revision: String(item.revision) });
  if (initialSlide !== undefined && initialSlide >= 1) query.set("slide", String(initialSlide));
  if (initialStep !== undefined) query.set("step", String(initialStep));
  return `${item.entryPath}?${query.toString()}`;
}

export default function CoursewareFrame({
  item,
  user,
  initialSlide,
  initialStep,
}: {
  item: CoursewareContent;
  user: AccountMenuUser;
  initialSlide?: number;
  initialStep?: number;
}) {
  const returnTo = exactHref(item, initialSlide, initialStep);
  const header = <header className={styles.viewerHeader}>
    <Link href="/course/">← 课件库</Link>
    <b>Mini Silicon Valley · {item.mentorRole} 导师</b>
    <AccountMenu user={user} returnTo={returnTo} />
  </header>;
  if (item.contentKind === "static-bundle" && item.entryPath) return <main className={styles.viewer}>
    {header}
    <div className={styles.viewerMeta}><small>EXACT COURSEWARE · r{item.revision} · {item.digest.slice(0, 12)}</small><h1>{item.title}</h1></div>
    <div className={styles.staticLaunch}><section><span className={styles.warning}>固定版本 · 原样播放</span><h2>在独立页面打开完整课件</h2><p>系统保持这一版本的 HTML、图片与交互资源不变，并把当前课堂锁定到 exact revision／digest。</p><a className={styles.launch} href={playerHref(item, initialSlide, initialStep)}>进入全屏课件 →</a></section></div>
  </main>;
  return <main className={styles.viewer}>
    {header}
    <div className={styles.viewerMeta}><small>EXACT COURSEWARE · r{item.revision} · {item.digest.slice(0, 12)}</small><h1>{item.title}</h1></div>
    <iframe className={styles.frame} title={item.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={item.htmlContent ?? ""} />
  </main>;
}
