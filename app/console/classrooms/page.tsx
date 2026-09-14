import ClassroomHub from "../../classroom/ClassroomHub";
import { ConsoleShell } from "../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../console-auth";

export const dynamic = "force-dynamic";

export default async function ConsoleClassroomsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const serialized = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") serialized.set(key, value);
  const returnTo = `/console/classrooms/${serialized.size ? `?${serialized.toString()}` : ""}`;
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  const courseId = typeof query.course === "string" ? query.course : null;
  const revision = typeof query.revision === "string" && /^\d+$/.test(query.revision) ? Number(query.revision) : null;
  const digest = typeof query.digest === "string" ? query.digest : undefined;
  const environment = query.environment === "production" ? "production" : query.environment === "test" ? "test" : undefined;
  const viewReceiptId = typeof query.viewReceipt === "string" ? query.viewReceipt : undefined;
  const uiReceiptId = typeof query.uiReceipt === "string" ? query.uiReceipt : undefined;
  return <ConsoleShell user={user} returnTo={returnTo}>
    <ClassroomHub mode="manage" user={user} initialCourse={courseId && revision !== null ? { courseId, revision, ...(digest ? { digest } : {}), ...(environment ? { environment } : {}), ...(viewReceiptId ? { viewReceiptId } : {}), ...(uiReceiptId ? { uiReceiptId } : {}) } : null} />
  </ConsoleShell>;
}
