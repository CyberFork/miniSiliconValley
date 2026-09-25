import type { Metadata } from "next";
import { BrandHomeLink } from "../../components/BrandHomeLink";
import { getChatGPTUser } from "../../chatgpt-auth";
import { publicPath } from "../../lib/public-path";
import AiDailyQuizClient from "./AiDailyQuizClient";
import styles from "./quiz.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI 每日一题｜课后作业", description: "MINI硅谷 AI 基础知识课后测验", robots: { index: false, follow: false } };

export default async function AiDailyQuizPage() {
  const user = await getChatGPTUser();
  const canReview = !user?.impersonation && (user?.role === "admin" || user?.role === "mentor");
  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="HOMEWORK LAB" subtitle="AI 每日一题" />
      {canReview && <nav><a href={publicPath("/homework/ai-daily-quiz/submissions/")}>查看全部提交</a></nav>}
    </header>
    <section className={styles.hero}>
      <div><small>7 DAYS · 35 QUESTIONS</small><h1>每天五题，<br />识破 AI。</h1></div>
      <p>从基础概念到安全伦理，再到创业联想。选择一天完成 5 道题，提交后立即查看答案与解释。</p>
    </section>
    <aside className={styles.notice}><b>⚠ 隐私提醒</b><span>请使用昵称，不要填写手机号、住址、证件、密码或他人的私密信息。</span></aside>
    <AiDailyQuizClient />
    <footer className={styles.footer}><b>AI 是助手，不是替身。</b><span>先自己判断，再查看解释；答错不是失败，而是发现下一步该学什么。</span></footer>
  </main>;
}
