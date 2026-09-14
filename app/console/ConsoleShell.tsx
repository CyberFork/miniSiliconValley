import type { ReactNode } from "react";

import Link from "../components/NavigationLink";
import { AccountMenu, type AccountMenuUser } from "../components/AccountMenu";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { ConsoleNav } from "./ConsoleNav";
import styles from "./console.module.css";

export function ConsoleShell({ user, returnTo, children }: { user: AccountMenuUser; returnTo: string; children: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.topbar}>
      <BrandHomeLink className={styles.brand} title="MINI硅谷工作台" subtitle="内部课程生产与课堂交付" />
      <div className={styles.topActions}>
        <Link href="/terminal/">个人时空终端</Link>
        <Link href="/classroom/">进入我的课堂</Link>
        <AccountMenu user={user} returnTo={returnTo} />
      </div>
    </header>
    <div className={styles.shell}>
      <ConsoleNav role={user.role} />
      <section className={styles.content}>{children}</section>
    </div>
  </main>;
}
