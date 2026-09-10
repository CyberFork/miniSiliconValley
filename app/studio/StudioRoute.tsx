import Link from "../components/NavigationLink";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../chatgpt-auth";
import StudioApp, { type StudioSection } from "./StudioApp";
import styles from "./studio.module.css";

export default async function StudioRoute({
  section,
  initialCourseRef = null,
}: {
  section: StudioSection;
  initialCourseRef?: { courseId: string; revision: number; digest?: string } | null;
}) {
  const user = await getChatGPTUser();
  const routePath = `/studio/${section === "home" ? "" : `${section}/`}`;
  const returnTo = section === "preview" && initialCourseRef
    ? `${routePath}?${new URLSearchParams({
        course: initialCourseRef.courseId,
        revision: String(initialCourseRef.revision),
        ...(initialCourseRef.digest ? { digest: initialCourseRef.digest } : {}),
      }).toString()}`
    : routePath;
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  if (user.role !== "admin" && user.role !== "mentor") {
    return <main className={styles.forbidden}><section><b>COURSE STUDIO · 受限工作区</b><h1>这里是导师的课程开发台</h1><p>你的学员账号没有课程编辑权限。请从课堂列表进入今天的任务。</p><Link href="/classroom/">返回课堂列表 →</Link></section></main>;
  }
  return <StudioApp
    section={section}
    user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: user.impersonation }}
    initialCourseRef={initialCourseRef}
  />;
}
