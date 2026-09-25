import StudioApp, { type StudioSection } from "../../studio/StudioApp";
import { ConsoleShell } from "../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../console-auth";

export async function ConsoleStudioRoute({ section, initialCourseRef = null }: {
  section: StudioSection;
  initialCourseRef?: { courseId: string; revision: number; digest?: string } | null;
}) {
  const suffix = section === "home" ? "" : `${section}/`;
  const base = `/console/studio/${suffix}`;
  const returnTo = section === "preview" && initialCourseRef
    ? `${base}?${new URLSearchParams({ course: initialCourseRef.courseId, revision: String(initialCourseRef.revision), ...(initialCourseRef.digest ? { digest: initialCourseRef.digest } : {}) }).toString()}`
    : base;
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo={returnTo}><StudioApp section={section} user={user} initialCourseRef={initialCourseRef} embedded /></ConsoleShell>;
}
