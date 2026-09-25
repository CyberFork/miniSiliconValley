import { ConsoleShell } from "../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../console-auth";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

export default async function ConsoleSettingsPage() {
  const returnTo = "/console/settings/";
  const user = await consoleUser(returnTo);
  if (!user || user.role !== "admin") return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo={returnTo}>
    <header className={styles.heading}><div><small>PLATFORM SETTINGS · ADMIN ONLY</small><h1>平台设置</h1><p>当前版本没有需要在网页修改的全局开关。域名、环境、密钥和数据库迁移继续由受控部署配置管理，不在浏览器中暴露。</p></div><span className={styles.badge}>平台管理员</span></header>
    <section className={styles.boundary}><h2>这里不是“按钮占位页”</h2><p>当出现确实需要由平台管理员在线维护、且具备审计和回滚契约的设置时，再作为明确模块加入。当前没有无效保存按钮，也不会显示服务器密钥。</p></section>
  </ConsoleShell>;
}
