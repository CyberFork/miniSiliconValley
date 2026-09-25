import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../../chatgpt-auth";
import { ClassroomScreenRuntime } from "../../ClassroomRuntime";

export const dynamic = "force-dynamic";

export default async function ClassroomScreenPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  const user = await getChatGPTUser();
  const returnTo = `/classroom/${encodeURIComponent(classroomId)}/screen`;
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  return <ClassroomScreenRuntime classroomId={classroomId} />;
}
