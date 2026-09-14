import type { Metadata } from "next";
import { BrandHomeLink } from "../../components/BrandHomeLink";
import { getChatGPTUser } from "../../chatgpt-auth";
import { publicPath } from "../../lib/public-path";
import FirstGameHomeworkClient from "./FirstGameHomeworkClient";
import styles from "../homework.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的第一款游戏｜课后作业", description: "不需要登录的第一款游戏策划作业", robots: { index: false, follow: false } };

export default async function FirstGameHomeworkPage() {
  const user = await getChatGPTUser();
  const canReviewSubmissions = user?.role === "admin" || user?.role === "mentor";
  return <main className={styles.page}>
    <header className={styles.top}><BrandHomeLink title="HOMEWORK LAB" subtitle="我的第一款游戏" />{canReviewSubmissions && <nav><a href={publicPath("/homework/first-game/submissions/")}>查看全部提交</a></nav>}</header>
    <section className={styles.hero}><small>FIXED MISSION · NO LOGIN</small><h1>把脑中的游戏<br />讲清楚。</h1><p>这不是作文，也不是比谁写得多。用短句、表格和图片，让别人知道你的游戏是什么、怎么玩、为什么好玩。</p><div><b>可以只填一部分</b><b>可以重复提交</b><b>图片完全可选</b></div></section>
    <aside className={styles.publicWarning} role="note"><strong>⚠ 请注意</strong><p>请使用昵称，不要填写手机号、住址、证件、密码或他人的私密信息。</p></aside>
    <FirstGameHomeworkClient />
    <footer className={styles.footer}><b>来源边界</b><p>固定内容来自《我的第一款游戏，课后作业》原文：第一层 1—5、兴趣扩展 6—11。原文只提到“第三层：老师协助整理”，没有展开题目，因此本页没有凭空补题。</p></footer>
  </main>;
}
