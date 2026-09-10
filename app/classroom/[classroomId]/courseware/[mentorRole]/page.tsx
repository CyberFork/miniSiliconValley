import { notFound, redirect } from "next/navigation";

import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../../../chatgpt-auth";
import CoursewareFrame from "../../../../course/[slug]/CoursewareFrame";
import { getClassroomInstance } from "../../../../lib/classroom-platform-store";
import { CLASSROOM_MENTOR_ROLES, type ClassroomMentorRole } from "../../../../lib/classroom-factory";
import { loadCoursewareExact } from "../../../../lib/courseware-store";
import styles from "../../../../course/course.module.css";

export const dynamic = "force-dynamic";

export default async function ClassroomCoursewarePage({ params }: { params: Promise<{ classroomId: string; mentorRole: string }> }) {
  const { classroomId, mentorRole: rawRole } = await params;
  const role = rawRole.toUpperCase() as ClassroomMentorRole;
  if (!(CLASSROOM_MENTOR_ROLES as readonly string[]).includes(role)) notFound();
  const returnTo = `/classroom/${encodeURIComponent(classroomId)}/courseware/${role}/`;
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation && user.impersonation.classroomId !== classroomId) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  const actor = {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    platformRole: user.role,
    actorProfileId: user.impersonation?.actor.userId ?? user.userId,
    effectiveProfileId: user.userId,
    impersonationId: user.impersonation?.id ?? null,
    impersonationClassroomId: user.impersonation?.classroomId ?? null,
    impersonationExpiresAt: user.impersonation?.expiresAt ?? null,
  };
  const classroom = await getClassroomInstance(db, actor, classroomId);
  const ref = classroom.courseware.find((item) => item.mentorRole === role);
  if (!ref) notFound();
  const item = await loadCoursewareExact(db, ref.packageId, ref.revision, ref.digest);
  if (item.availability === "placeholder") {
    return <main className={styles.viewer}>
      <header className={styles.viewerHeader}><a href={`/classroom/${encodeURIComponent(classroomId)}/`}>← 返回课堂</a><b>Mini Silicon Valley · {role} 导师</b></header>
      <div className={styles.viewerMeta}><small>COURSEWARE PLACEHOLDER · {role}</small><h1>尚未提供真实导师课件</h1><code>{item.packageId} · r{item.revision} · {item.digest}</code></div>
      <div className={styles.staticLaunch}><section><span className={styles.warning}>内部占位 · 不是正式课件</span><h2>{item.title}</h2><p>这条绑定只用于 Test Classroom 验证四导师结构。课程组尚未上传并发布 {role} 导师真实课件，因此系统不会展示一个看似可用、实际失效的播放链接。</p></section></div>
    </main>;
  }
  return <CoursewareFrame
    item={item}
    preview={!item.released}
    returnToHref={returnTo}
    backHref={`/classroom/${encodeURIComponent(classroomId)}/`}
    backLabel="返回课堂"
    user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role ?? "learner", impersonation: user.impersonation }}
  />;
}
