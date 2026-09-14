import Script from "next/script";

import workbenchDocument from "../../../studio/editor/workbench.html?raw";
import editorStyles from "../../../../public/studio/editor-assets/editor.css?raw";
import previewStyles from "../../../../public/studio/editor-assets/course-preview.css?raw";
import themeStyles from "../../../../public/studio/editor-assets/ui-theme.css?raw";
import { ConsoleShell } from "../../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../../console-auth";
import consoleStyles from "../../console.module.css";

export const dynamic = "force-dynamic";

const bodyMarkup = workbenchDocument.match(/<body>([\s\S]*?)<\/body>/)?.[1]
  ?.replace(/<script\b[\s\S]*?<\/script>/gi, "")
  ?.replace(/<span class="editor-user"[\s\S]*?<\/span>/, "") ?? "";

export default async function CourseEditorPage() {
  const returnTo = "/console/studio/editor/";
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo={returnTo}>
    <div className={consoleStyles.moduleFrame}>
      <style dangerouslySetInnerHTML={{ __html: `${editorStyles}\n${previewStyles}\n${themeStyles}` }} />
      <div className="editor-workbench-root" dangerouslySetInnerHTML={{ __html: bodyMarkup }} />
      <Script src="/studio/editor-assets/editor-loader.js?v=t123-console-r1" strategy="afterInteractive" />
    </div>
  </ConsoleShell>;
}
