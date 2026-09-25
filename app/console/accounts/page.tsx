import { LearnerAdminPanel } from "../../account/LearnerAdminPanel";
import { ConsoleShell } from "../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../console-auth";
import consoleStyles from "../console.module.css";
import accountStyles from "../../auth/auth.module.css";
import { PasswordAssistancePanel } from "./PasswordAssistancePanel";

export const dynamic = "force-dynamic";

export default async function ConsoleAccountsPage() {
  const returnTo = "/console/accounts/";
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo={returnTo}>
    <header className={consoleStyles.heading}><div><small>ACCOUNT OPERATIONS · SERVER RBAC</small><h1>账号与协助</h1><p>这是管理他人的内部页面。个人昵称、密码、设备和退出登录仍在“我的账户”中完成。</p></div><span className={consoleStyles.badge}>{user.role === "admin" ? "全平台账号范围" : "仅本人课堂范围"}</span></header>
    {user.role === "admin" ? <LearnerAdminPanel /> : <div className={accountStyles.accountGrid}><PasswordAssistancePanel /></div>}
  </ConsoleShell>;
}
