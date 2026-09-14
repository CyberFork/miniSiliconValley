"use client";

import { usePathname } from "next/navigation";
import type { AuthRole } from "../lib/auth-model";
import styles from "./console.module.css";

const groups = [
  { label: "总览", items: [{ href: "/console/", code: "00", label: "工作台首页" }] },
  { label: "课程生产", items: [
    { href: "/console/studio/", code: "01", label: "Course Studio" },
    { href: "/console/studio/editor/", code: "02", label: "课程编辑器" },
    { href: "/console/studio/preview/", code: "03", label: "多角色视图验收" },
    { href: "/console/studio/releases/", code: "04", label: "验收与发布" },
    { href: "/console/courseware/", code: "05", label: "导师课件管理" },
  ] },
  { label: "课堂交付", items: [
    { href: "/console/classrooms/", code: "06", label: "课堂管理" },
    { href: "/console/accounts/", code: "07", label: "账号与协助" },
    { href: "/terminal/grants/", code: "08", label: "发放硅谷币" },
  ] },
  { label: "质量与资料", items: [
    { href: "/console/qa/", code: "09", label: "质量检查" },
    { href: "/console/archive/", code: "10", label: "资料与历史" },
    { href: "/console/settings/", code: "11", label: "平台设置", adminOnly: true },
  ] },
] as const;

export function ConsoleNav({ role }: { role: AuthRole }) {
  const pathname = usePathname();
  return <aside className={styles.navWrap}>
    <details className={styles.mobileNav}>
      <summary>工作台导航</summary>
      <NavGroups role={role} pathname={pathname} />
    </details>
    <nav className={styles.nav} aria-label="MINI硅谷工作台"><NavGroups role={role} pathname={pathname} /></nav>
  </aside>;
}

function NavGroups({ role, pathname }: { role: AuthRole; pathname: string }) {
  return <>{groups.map((group) => <section key={group.label}>
    <b>{group.label}</b>
    {group.items.filter((item) => !("adminOnly" in item && item.adminOnly) || role === "admin").map((item) => {
      const active = item.href === "/console/" ? pathname === item.href : pathname.startsWith(item.href);
      return <a key={item.href} href={item.href} aria-current={active ? "page" : undefined}><span>{item.code}</span>{item.label}</a>;
    })}
  </section>)}</>;
}
