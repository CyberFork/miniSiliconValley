import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../../chatgpt-auth";
import ClassroomRuntime from "../../ClassroomRuntime";

export const dynamic = "force-dynamic";

export default async function ClassroomMembersPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  const user = await getChatGPTUser();
  const returnTo = `/classroom/${encodeURIComponent(classroomId)}/members`;
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation && user.impersonation.classroomId !== classroomId) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  return <ClassroomRuntime classroomId={classroomId} view="members" user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role ?? "learner", impersonation: user.impersonation }} />;
}
