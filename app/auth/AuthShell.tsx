import type { ReactNode } from "react";
import { publicPath } from "../lib/public-path";
import { BrandHomeLink } from "../components/BrandHomeLink";
import styles from "./auth.module.css";

export default function AuthShell({ children, title, accent, description }: {
  children: ReactNode;
  title: string;
  accent: string;
  description: string;
}) {
  return (
    <main className={styles.authPage}>
      <a className={styles.skipLink} href="#auth-form">跳到账号表单</a>
      <nav className={styles.authNav} aria-label="Mini Silicon Valley">
        <BrandHomeLink />
        <div className={styles.navLinks} data-msv-theme-slot><a href={publicPath("/")}>历史世界</a><a href="/framework/">课程框架</a><a href={publicPath("/classroom")}>协作课堂</a></div>
      </nav>
      <div className={styles.authGrid}>
        <section className={styles.storyPanel} aria-label="Young Builder账号说明">
          <div className={styles.storyCopy}>
            <span className={styles.kicker}>YOUNG BUILDER IDENTITY SYSTEM · 真实独立身份</span>
            <h1>{title}<br /><em>{accent}</em></h1>
            <p>{description}</p>
            <ol className={styles.storySteps}>
              <li><b>01 · IDENTITY</b><span>一个账号对应一条持续成长轨迹</span></li>
              <li><b>02 · PRIVACY</b><span>私密情报、钱包与作品按成员隔离</span></li>
              <li><b>03 · CONTINUITY</b><span>换设备后仍能恢复课堂与学习档案</span></li>
            </ol>
          </div>
          <div className={styles.privacyNote}><i>✓</i><span>不要求手机号、邮箱或社交账号。开放注册只创建学员身份；课堂权限由导师审批和服务端RBAC管理。</span></div>
        </section>
        <section className={styles.formPanel} id="auth-form" tabIndex={-1}>{children}</section>
      </div>
    </main>
  );
}
