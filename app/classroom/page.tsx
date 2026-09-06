import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { publicPath } from "../lib/public-path";
import { validTeamPublicId } from "../lib/team-access";
import ClassroomApp from "./ClassroomApp";
import { BrandHomeLink } from "../components/BrandHomeLink";
import styles from "./classroom.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Young Builder 协作课堂",
  description: "用真实账号进入同一个历史情境，协作完成情报网、攻坚局、成长盘、史实对照与现实迁移。",
};

export default async function ClassroomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawTeamPublicId = typeof params.team === "string" ? params.team : null;
  const initialTeamPublicId = validTeamPublicId(rawTeamPublicId) ?? "";
  const classroomReturnTo = initialTeamPublicId
    ? `/classroom?team=${encodeURIComponent(initialTeamPublicId)}`
    : "/classroom";
  const user = await getChatGPTUser();
  const proxyAuth = process.env.MSV_SELF_HOSTED_AUTH === "proxy-basic";
  const appSession = process.env.MSV_SELF_HOSTED_AUTH === "app-session";

  if (!user) {
    if (appSession) redirect(chatGPTSignInPath(classroomReturnTo));
    return (
      <main className={styles.loginPage}>
        <a className={styles.skipLink} href="#classroom-login">跳到登录</a>
        <nav className={styles.publicNav} aria-label="Mini Silicon Valley">
          <BrandHomeLink />
          <div><a href={publicPath("/")}>历史世界</a><a href="/framework/">课程框架</a></div>
        </nav>
        <section className={styles.loginHero} id="classroom-login">
          <div className={styles.eyebrow}>YOUNG BUILDER CLASSROOM · 多人协作战役</div>
          <h1>不是观看历史。<br /><em>是进入历史，做出你的判断。</em></h1>
          <p>
            DM创建课堂，四名学员使用各自账号加入。你会获得独立身份和私密情报，在线下互相讲解，
            再作为P／D／M／O团队共同攻坚、经营、复盘，并把历史能力带回真实项目。
          </p>
          <div className={styles.loginActions}>
            <a className={styles.primaryLink} href={proxyAuth ? `${publicPath("/classroom")}${initialTeamPublicId ? `?team=${encodeURIComponent(initialTeamPublicId)}` : ""}` : chatGPTSignInPath(classroomReturnTo)}>
              {proxyAuth ? "使用团队测试账号进入课堂 →" : "使用 ChatGPT 账号进入课堂 →"}
            </a>
            <a className={styles.secondaryLink} href={publicPath("/")}>先探索科技史地图</a>
          </div>
          <ul className={styles.trustList} aria-label="账号与隐私保障">
            <li><strong>真实独立身份</strong><span>没有“切换假账号”的演示捷径</span></li>
            <li><strong>权限隔离</strong><span>队友看不到你尚未发布的私密卡和钱包</span></li>
            <li><strong>持续成长</strong><span>RP、作品与课堂记录跨设备保存</span></li>
          </ul>
        </section>
        <section className={styles.loopStrip} aria-label="学习闭环">
          {['私密信息','互相讲解','情报建网','情境攻坚','公开结算','经营成长','史实对照','现实迁移'].map((step, index) => (
            <span key={step}><b>{String(index + 1).padStart(2, '0')}</b>{step}</span>
          ))}
        </section>
      </main>
    );
  }

  return (
    <ClassroomApp
      displayName={user.displayName}
      signOutPath={proxyAuth ? publicPath("/logout") : chatGPTSignOutPath("/classroom")}
      appSession={appSession}
      initialTeamPublicId={initialTeamPublicId}
    />
  );
}
