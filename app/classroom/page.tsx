import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../chatgpt-auth";
import ClassroomHub from "./ClassroomHub";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mini Silicon Valley Classroom",
  description: "按 exact 课程与课件版本创建的真实课堂列表。",
};

export default async function ClassroomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath("/classroom/"));
  requireCompletedPasswordSetup(user, "/classroom/");
  const query = await searchParams;
  const courseId = typeof query.course === "string" ? query.course : null;
  const revision = typeof query.revision === "string" && /^\d+$/.test(query.revision) ? Number(query.revision) : null;
  const digest = typeof query.digest === "string" ? query.digest : undefined;
  const environment = query.environment === "production" ? "production" : query.environment === "test" ? "test" : undefined;
  const viewReceiptId = typeof query.viewReceipt === "string" ? query.viewReceipt : undefined;
  const uiReceiptId = typeof query.uiReceipt === "string" ? query.uiReceipt : undefined;
  return <ClassroomHub
    user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role ?? "learner", impersonation: user.impersonation }}
    initialCourse={courseId && revision !== null ? {
      courseId,
      revision,
      ...(digest ? { digest } : {}),
      ...(environment ? { environment } : {}),
      ...(viewReceiptId ? { viewReceiptId } : {}),
      ...(uiReceiptId ? { uiReceiptId } : {}),
    } : null}
  />;
}
