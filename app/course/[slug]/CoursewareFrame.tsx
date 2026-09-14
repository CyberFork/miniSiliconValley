"use client";

import Link from "../../components/NavigationLink";

import { AccountMenu, type AccountMenuUser } from "../../components/AccountMenu";
import { BrandHomeLink } from "../../components/BrandHomeLink";
import type { CoursewareContent } from "../../lib/courseware-store";
import styles from "../course.module.css";

function exactHref(item: CoursewareContent, initialSlide?: number, initialStep?: number): string {
  const query = new URLSearchParams({ revision: String(item.revision), digest: item.digest });
  if (initialSlide !== undefined && initialSlide >= 1) query.set("slide", String(initialSlide));
  if (initialStep !== undefined) query.set("step", String(initialStep));
  return `/course/${encodeURIComponent(item.slug)}/?${query.toString()}`;
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
    <div className={styles.viewerHeaderStart}><BrandHomeLink markOnly /><Link href={backHref}>← {backLabel}</Link></div>
    <b>Mini Silicon Valley · {item.mentorRole} 导师</b>
    <AccountMenu user={user} returnTo={returnTo} />
  </header>;
  const identity = <div className={styles.viewerMeta}>
    <small>{preview ? "INTERNAL EXACT PREVIEW" : item.releaseStatus === "historical" ? "HISTORICAL RELEASE" : "EXACT COURSEWARE"} · {item.mentorRole} · r{item.revision}</small>
    <h1>{item.title}</h1>
    <code>{item.packageId} · {item.digest}</code>
    {preview && !item.released && <span className={styles.previewWarning}>内部 Candidate · 未正式发布 · 不对学员目录开放</span>}
    {!preview && item.releaseStatus === "historical" && <span className={styles.previewWarning}>历史已发布版本 · 仅用于审计与明确版本预览</span>}
  </div>;
  // Static bundles are redirected server-side by every authenticated entry
  // route. This frame is deliberately only the inline-HTML renderer: there is
  // no second "enter courseware" gate or duplicate website shell.
  return <main className={styles.viewer}>
    {header}
    {identity}
    <iframe className={styles.frame} title={item.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={item.htmlContent ?? ""} />
  </main>;
}
