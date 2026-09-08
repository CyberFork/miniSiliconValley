import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../chatgpt-auth";
import workbenchDocument from "./workbench.html?raw";
import editorStyles from "../../../public/studio/editor-assets/editor.css?raw";
import previewStyles from "../../../public/studio/editor-assets/course-preview.css?raw";
import themeStyles from "../../../public/studio/editor-assets/ui-theme.css?raw";

export const dynamic = "force-dynamic";

const bodyMarkup = workbenchDocument.match(/<body>([\s\S]*?)<\/body>/)?.[1]
  ?.replace(/<script\b[\s\S]*?<\/script>/gi, "") ?? "";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export default async function CourseEditorPage() {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath("/studio/editor/"));
  requireCompletedPasswordSetup(user, "/studio/editor/");

  if (user.role !== "admin" && user.role !== "mentor") {
    return <>
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />
      <main className="editor-access-denied"><section><b>COURSE STUDIO · 受限工作区</b><h1>这里是导师的课程开发台</h1><p>你的学员账号没有课程编辑权限。请从课堂列表进入今天的任务。</p><Link href="/classroom/">返回课堂列表 →</Link></section></main>
    </>;
  }

  const markup = bodyMarkup.replace("__MSV_EDITOR_USER__", escapeHtml(user.displayName));
  return <>
    <style dangerouslySetInnerHTML={{ __html: `${editorStyles}\n${previewStyles}\n${themeStyles}` }} />
    <div className="editor-workbench-root" dangerouslySetInnerHTML={{ __html: markup }} />
    <Script src="/studio/editor-assets/ui-theme.js?v=t085-editor-r3" strategy="afterInteractive" />
    <Script src="/studio/editor-assets/card-view.js?v=t085-editor-r3" strategy="afterInteractive" />
    <Script src="/studio/editor-assets/course-preview.js?v=t085-editor-r3" strategy="afterInteractive" />
    <Script src="/studio/editor-assets/editor.js?v=t085-editor-r3" strategy="afterInteractive" />
  </>;
}
