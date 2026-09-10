import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ensureClassroomSchema, getClassroomDb } from "../../db";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../chatgpt-auth";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { AccountMenu } from "../components/AccountMenu";
import { isCoursewareLibraryVisible, listCourseware } from "../lib/courseware-store";
import styles from "./course.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "课程目录" };

export default async function CourseLibrary() {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath("/course/"));
  requireCompletedPasswordSetup(user, "/course/");
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  if (user.role !== "admin" && user.role !== "mentor" && user.role !== "learner") notFound();

  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  const items = (await listCourseware(db)).filter(isCoursewareLibraryVisible);
  const canManage = user.role === "admin" || user.role === "mentor";
  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="课程目录" />
      <nav>
        <Link href="/classroom/">课堂中心</Link>
        {canManage && <Link href="/studio/courseware/">管理导师课件</Link>}
        <AccountMenu
          user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: null }}
          returnTo="/course/"
        />
      </nav>
    </header>
    <section className={styles.hero}>
      <small>COURSE LIBRARY · RELEASED &amp; READ-ONLY</small>
      <h1>课程目录</h1>
      <p>导师和 Young Builder 在这里查看已经正式发布的课件。每张卡都来自真实 CoursewarePackage 注册表，并锁定不可变 revision 与 digest；编辑和发布只在 Course Studio 进行。</p>
    </section>
    <section className={styles.grid}>{items.map((item) => <article className={styles.card} data-role={item.mentorRole} key={item.packageId}>
      <small>{item.mentorRole} · RELEASED COURSEWARE</small>
      <h2>{item.title}</h2>
      <p className={styles.meta}>packageId · {item.packageId}<br />slug · /{item.slug}/<br />revision · r{item.releasedRevision}<br />digest · {item.releasedDigest}</p>
      <Link href={`/course/${item.slug}/?revision=${item.releasedRevision}&digest=${item.releasedDigest}`}>打开只读课件 →</Link>
    </article>)}</section>
  </main>;
}
