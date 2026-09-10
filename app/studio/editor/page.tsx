import Link from "../../components/NavigationLink";
import Script from "next/script";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../chatgpt-auth";
import { AccountMenu } from "../../components/AccountMenu";
import workbenchDocument from "./workbench.html?raw";
import editorStyles from "../../../public/studio/editor-assets/editor.css?raw";
import previewStyles from "../../../public/studio/editor-assets/course-preview.css?raw";
import themeStyles from "../../../public/studio/editor-assets/ui-theme.css?raw";

export const dynamic = "force-dynamic";

const bodyMarkup = workbenchDocument.match(/<body>([\s\S]*?)<\/body>/)?.[1]
  ?.replace(/<script\b[\s\S]*?<\/script>/gi, "") ?? "";

export default async function CourseEditorPage() {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath("/studio/editor/"));
  requireCompletedPasswordSetup(user, "/studio/editor/");
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);

  if (user.role !== "admin" && user.role !== "mentor") {
    return <>
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />
      <main className="editor-access-denied"><section><b>COURSE STUDIO · 受限工作区</b><h1>这里是导师的课程开发台</h1><p>你的学员账号没有课程编辑权限。请从课堂列表进入今天的任务。</p><Link href="/classroom/">返回课堂列表 →</Link></section></main>
    </>;
  }

  const markup = bodyMarkup
    .replace(/<span class="editor-user"[\s\S]*?<\/span>/, "");
  return <>
    <style dangerouslySetInnerHTML={{ __html: `${editorStyles}\n${previewStyles}\n${themeStyles}` }} />
    <div className="editor-workbench-root" dangerouslySetInnerHTML={{ __html: markup }} />
    <div className="editor-account-slot"><AccountMenu
      user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: user.impersonation }}
      returnTo="/studio/editor/"
    /></div>
    <Script src="/studio/editor-assets/editor-loader.js?v=studio-startup-r3" strategy="afterInteractive" />
  </>;
}
