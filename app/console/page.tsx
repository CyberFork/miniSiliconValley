import Link from "../components/NavigationLink";
import { ConsoleShell } from "./ConsoleShell";
import { ConsoleForbidden, consoleUser } from "./console-auth";
import styles from "./console.module.css";

export const dynamic = "force-dynamic";

export default async function ConsoleHome() {
  const user = await consoleUser("/console/");
  if (!user) return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo="/console/">
    <header className={styles.heading}><div><small>INTERNAL WORKBENCH · ROLE SCOPED</small><h1>团队工作台</h1><p>课程生产、课件管理、课堂交付和质量检查在这里完成；个人终端、学员课堂和公开官网保持独立。</p></div><span className={styles.badge}>{user.role === "admin" ? "平台管理员" : "导师工作区"}</span></header>
    <div className={styles.dashboard}>
      <article className={styles.card}><small>01 · COURSE STUDIO</small><h2>编辑、预览与发布</h2><p>维护唯一 CourseDefinition，完成多角色视图和真实 Test Classroom 两级验收。</p><Link href="/console/studio/">进入 Course Studio →</Link></article>
      <article className={styles.card}><small>02 · COURSEWARE</small><h2>导师课件管理</h2><p>上传、检查和发布 P／D／M／O 导师课件；学员播放仍走独立课件入口。</p><Link href="/console/courseware/">管理导师课件 →</Link></article>
      <article className={styles.card}><small>03 · CLASSROOM DELIVERY</small><h2>创建和管理课堂</h2><p>创建 TEST／Production、管理历史实例，并进入对应课堂中控。</p><Link href="/console/classrooms/">打开课堂管理 →</Link></article>
      <article className={styles.card}><small>04 · ACCOUNT SCOPE</small><h2>{user.role === "admin" ? "账号与 RBAC" : "课堂账号协助"}</h2><p>{user.role === "admin" ? "管理学员账号、昵称、备注、密码和平台状态。" : "只在既有课堂授权范围内帮助学员重置密码。"}</p><Link href="/console/accounts/">进入账号工作区 →</Link></article>
      <article className={styles.card}><small>05 · REWARD</small><h2>发放硅谷币</h2><p>按课堂和环境向学员手动发币；正式币与 TEST 币完全隔离，所有流水可追溯。</p><Link href="/terminal/grants/">进入发币终端 →</Link></article>
      <article className={styles.card}><small>06 · QA & ARCHIVE</small><h2>质量与历史</h2><p>处理人工审核项，回看早期 Workshop，同时保持历史资料只读。</p><Link href="/console/qa/">查看质量检查 →</Link></article>
    </div>
    <section className={styles.boundary}><h2>同一账号体系，清晰的站点边界</h2><p><b>官网／终端／课堂／课件</b>服务学习与展示；<b>工作台</b>服务内部生产和管理。知道 URL 不等于拥有权限，每项数据操作仍由服务端 RBAC 校验。</p></section>
  </ConsoleShell>;
}
