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
    <section className={styles.hero}>
      <small>FIXED MISSION · NO LOGIN</small><h1>把脑中的游戏<br />讲清楚。</h1>
      <p>第一节课我们已经对自己要设计的游戏有了初步的构想。请同学们利用休息的时间再进一步细化自己的游戏设置，以下是本周的作业内容。</p>
      <p>作业共分为两个部分，第一部分01-05大题必答。第二部分根据同学们的时间安排、兴趣程度自愿完成。</p>
      <p>完成第一部分作业即可获得500积分硅谷币。进阶完成第二部分作业，额外还可获得500积分硅谷币。硅谷币作为各位最终的创业基金使用，请大家妥善保管哦！</p>
    </section>
    <aside className={styles.publicWarning} role="note"><strong>⚠ 请注意</strong><p>请使用昵称，不要填写手机号、住址、证件、密码或他人的私密信息。</p></aside>
    <FirstGameHomeworkClient />
    <footer className={styles.footer}><b>来源边界</b><p>本表单根据《我的第一款游戏，课后作业》整理，并按当前教学安排保留第一部分 1—5、兴趣扩展 6—10。原文只提到“第三层：老师协助整理”，没有展开题目，因此本页没有凭空补题。</p></footer>
  </main>;
}
