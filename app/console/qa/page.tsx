import { ConsoleShell } from "../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../console-auth";
import styles from "../console.module.css";

export const dynamic = "force-dynamic";

export default async function ConsoleQaPage() {
  const returnTo = "/console/qa/";
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo={returnTo}>
    <header className={styles.heading}><div><small>QUALITY GATES · NO SILENT PASS</small><h1>质量检查</h1><p>把课程内容审核、两级验收与公开家长问答分开检查。这里不代替团队签署 View／UI 人工回执。</p></div><span className={styles.badge}>内部质量入口</span></header>
    <div className={styles.dashboard}>
      <article className={styles.card}><small>CONTENT REVIEW</small><h2>人工审核工作台</h2><p>处理来源边界、待审核内容与重复出现的知识缺口。</p><a href="/console/studio/reviews/">进入人工审核 →</a></article>
      <article className={styles.card}><small>VIEW ACCEPTANCE</small><h2>多角色视图验收</h2><p>逐 Block 检查四导师、N 学员与中控投影，签发 exact View 回执。</p><a href="/console/studio/preview/">开始视图验收 →</a></article>
      <article className={styles.card}><small>UI ACCEPTANCE</small><h2>真实 Test Classroom</h2><p>用正式运行组件完成最终 UI 验收，不以缩略预览替代。</p><a href="/console/classrooms/#factory">打开测试课堂 →</a></article>
      <article className={styles.card}><small>PUBLIC QA</small><h2>家长问答成品</h2><p>从公开访客视角检查已发布的家长问答，不把内部审核信息泄露到官网。</p><a href="/parents/" target="_blank" rel="noreferrer">打开公开页面 ↗</a></article>
    </div>
  </ConsoleShell>;
}
