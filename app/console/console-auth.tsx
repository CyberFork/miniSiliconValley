import Link from "../components/NavigationLink";
import { redirect } from "next/navigation";

import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../chatgpt-auth";
import type { AccountMenuUser } from "../components/AccountMenu";
import styles from "./console.module.css";

export async function consoleUser(returnTo: string): Promise<AccountMenuUser | null> {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  if (user.role !== "admin" && user.role !== "mentor") return null;
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    impersonation: null,
  };
}

export function ConsoleForbidden() {
  return <main className={styles.forbidden}>
    <section>
      <small>403 · INTERNAL WORKBENCH</small>
      <h1>这里是团队内部工作台</h1>
      <p>当前账号可以继续使用个人时空终端、课堂与课件，但没有读取课程草稿、账号目录或课堂管理数据的权限。</p>
      <div><Link href="/terminal/">回到时空终端</Link><Link href="/classroom/">进入我的课堂</Link></div>
    </section>
  </main>;
}
