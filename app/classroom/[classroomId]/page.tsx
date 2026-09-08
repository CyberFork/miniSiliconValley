import { redirect } from "next/navigation";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../chatgpt-auth";
import ClassroomRuntime from "../ClassroomRuntime";

export const dynamic = "force-dynamic";

export default async function ClassroomSeatPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  const user = await getChatGPTUser();
  const returnTo = `/classroom/${encodeURIComponent(classroomId)}/`;
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  return <ClassroomRuntime classroomId={classroomId} view="seat" signOutPath={chatGPTSignOutPath("/")} />;
}
