import ClassroomRuntime from "../../../../classroom/ClassroomRuntime";
import { ConsoleForbidden, consoleUser } from "../../../console-auth";

export const dynamic = "force-dynamic";

export default async function ClassroomControlPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  const returnTo = `/console/classrooms/${encodeURIComponent(classroomId)}/control/`;
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  return <ClassroomRuntime classroomId={classroomId} view="control" user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: null }} />;
}
