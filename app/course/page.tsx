import type { Metadata } from "next";
import Link from "../components/NavigationLink";
import { notFound, redirect } from "next/navigation";

import { ensureClassroomSchema, getClassroomDb } from "../../db";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../chatgpt-auth";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { AccountMenu } from "../components/AccountMenu";
import { coursewarePresenterSurface } from "../lib/courseware-navigation";
import { isCoursewareLibraryVisible, listCourseware } from "../lib/courseware-store";
import { groupCoursewareByMentor } from "../lib/courseware-groups";
import styles from "./course.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "课件查看" };

export default async function CourseLibrary() {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath("/course/"));
  requireCompletedPasswordSetup(user, "/course/");
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  if (user.role !== "admin" && user.role !== "mentor" && user.role !== "learner") notFound();

  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  const items = (await listCourseware(db)).filter(isCoursewareLibraryVisible);
  const groups = groupCoursewareByMentor(items);
  const canManage = user.role === "admin" || user.role === "mentor";
  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="课件查看" />
      <nav>
        <Link href="/classroom/">课堂中心</Link>
        {canManage && <Link href="/console/courseware/">管理课件</Link>}
        <AccountMenu
          user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: null }}
          returnTo="/course/"
        />
      </nav>
    </header>
    <section className={styles.hero}>
      <small>COURSE LIBRARY · RELEASED &amp; READ-ONLY</small>
      <h1>课件查看</h1>
      <p>按导师方向查找课件，直接打开学习。开发导师课件建议先看 P1《模块思维》，再看 P2《立棍》。这里仅供查看，编辑与发布请进入工作台。</p>
    </section>
    <nav className={styles.mentorNav} aria-label="按导师查找课件">
      {groups.map((group) => <a key={group.role} href={`#mentor-${group.role}`} data-role={group.role}>
        <b>{group.role}</b><span>{group.label}</span><small>{group.items.length} 份课件</small>
      </a>)}
    </nav>
    <div className={styles.groups}>{groups.map((group) => <section
      className={styles.mentorGroup} id={`mentor-${group.role}`} data-mentor-group={group.role}
      aria-labelledby={`mentor-${group.role}-title`} key={group.role}
    >
      <header className={styles.groupHeader}>
        <span className={styles.roleBadge} data-role={group.role} aria-hidden="true">{group.role}</span>
        <div><h2 id={`mentor-${group.role}-title`}>{group.label}</h2><p>{group.description}</p></div>
        <span className={styles.groupCount}>{group.items.length} 份课件</span>
      </header>
      {group.items.length === 0 ? <p className={styles.empty}>暂无已发布课件，发布后会显示在这里。</p> : <div className={styles.grid}>{group.items.map((item) => {
      const presenter = canManage ? coursewarePresenterSurface(item.packageId) : null;
      return <article className={styles.card} data-role={item.mentorRole} key={item.packageId}>
        <small>{group.label} · 已发布课件</small>
        <h3>{item.title}</h3>
        <details className={styles.versionDetails}><summary>版本信息 · r{item.releasedRevision}</summary><p className={styles.meta}>packageId · {item.packageId}<br />slug · /{item.slug}/<br />revision · r{item.releasedRevision}<br />digest · {item.releasedDigest}</p></details>
        {presenter && <aside className={styles.presenterNotice}>
          <b>双屏导师课件</b>
          <span>{presenter.description}</span>
          <small>上课请先进入导师控制台，再由控制台点击“打开投屏窗口”。</small>
        </aside>}
        <div className={styles.cardActions}>
          {presenter && <a className={styles.presenterLaunch} href={presenter.href} target="_blank" rel="noopener noreferrer">{presenter.label} ↗</a>}
          <Link href={`/course/${item.slug}/?revision=${item.releasedRevision}&digest=${item.releasedDigest}`}>{presenter ? "只打开投屏画面 →" : "打开只读课件 →"}</Link>
        </div>
      </article>;
    })}</div>}
    </section>)}</div>
  </main>;
}
