"use client";

import { useState } from "react";

import type { AuthImpersonationContext, AuthRole } from "../lib/auth-model";
import { publicPath } from "../lib/public-path";
import styles from "./account-menu.module.css";

export type AccountMenuUser = {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
  impersonation?: AuthImpersonationContext | null;
};

export type AccountMenuContext = {
  classroomId?: string | null;
  classroomTitle?: string | null;
  seatLabel?: string | null;
  testIdentityManagementHref?: string | null;
};

export function AccountMenu({
  user,
  returnTo,
  context,
  className = "",
}: {
  user: AccountMenuUser;
  returnTo: string;
  context?: AccountMenuContext;
  className?: string;
}) {
  const [busy, setBusy] = useState<"switch" | "logout" | "return" | null>(null);
  const [error, setError] = useState("");
  const safeReturnTo = safeRelativePath(returnTo);
  const impersonation = user.impersonation ?? null;

  const logout = async (mode: "switch" | "logout") => {
    setBusy(mode);
    setError("");
    try {
      await mutate("/api/auth/logout", "POST");
      const query = new URLSearchParams(mode === "switch"
        ? { returnTo: safeReturnTo, switched: "1" }
        : { signedOut: "1" });
      window.location.replace(`${publicPath("/auth/login")}?${query.toString()}`);
    } catch (cause) {
      setError(messageOf(cause));
      setBusy(null);
    }
  };

  const returnToAdmin = async () => {
    setBusy("return");
    setError("");
    try {
      await mutate("/api/auth/impersonation", "DELETE");
      const destination = impersonation?.classroomId
        ? `/classroom/${encodeURIComponent(impersonation.classroomId)}/`
        : "/classroom/";
      window.location.replace(publicPath(destination));
    } catch (cause) {
      setError(messageOf(cause));
      setBusy(null);
    }
  };

  return <div className={`${styles.wrap} ${className}`.trim()} data-impersonating={Boolean(impersonation)}>
    {impersonation && <div className={styles.impersonationBanner} role="status">
      <span><b>TEST 身份模拟</b><small>{impersonation.actor.displayName} → {impersonation.effective.displayName} · {expiresLabel(impersonation.expiresAt)}</small></span>
      <button type="button" onClick={() => void returnToAdmin()} disabled={busy !== null}>{busy === "return" ? "正在返回…" : "返回管理员身份"}</button>
    </div>}
    <details className={styles.menu}>
      <summary aria-label={`账户菜单：${user.displayName}`}>
        <span className={styles.avatar}>{initials(user.displayName)}</span>
        <span className={styles.summaryText}><b>{user.displayName}</b><small>@{user.username}</small></span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.panel}>
        <div className={styles.identity}>
          <span>{roleLabel(user.role)}{impersonation ? " · 模拟中" : ""}</span>
          <b>{user.displayName}</b>
          <small>@{user.username}</small>
        </div>
        {(context?.classroomTitle || context?.seatLabel) && <div className={styles.context}>
          {context.classroomTitle && <span>课堂：{context.classroomTitle}</span>}
          {context.seatLabel && <span>当前席位：{context.seatLabel}</span>}
        </div>}
        {error && <div className={styles.error} role="alert">{error}</div>}
        <div className={styles.actions}>
          {!impersonation && <a href={publicPath("/account")}>账户中心</a>}
          {!impersonation && context?.testIdentityManagementHref && <a href={publicPath(context.testIdentityManagementHref)}>测试账号管理</a>}
          {!impersonation && <button type="button" onClick={() => void logout("switch")} disabled={busy !== null}>{busy === "switch" ? "正在切换…" : "切换账号"}</button>}
          {impersonation
            ? <button type="button" onClick={() => void returnToAdmin()} disabled={busy !== null}>返回管理员身份</button>
            : <button type="button" data-danger onClick={() => void logout("logout")} disabled={busy !== null}>{busy === "logout" ? "正在退出…" : "退出登录"}</button>}
        </div>
      </div>
    </details>
  </div>;
}

async function mutate(path: string, method: "POST" | "DELETE"): Promise<void> {
  const response = await fetch(publicPath(path), {
    method,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? "账户操作没有完成，请重试。");
}

function safeRelativePath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/classroom/";
  try {
    const url = new URL(value, "https://minisv.local");
    if (url.origin !== "https://minisv.local" || url.pathname.startsWith("/auth/")) return "/classroom/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/classroom/";
  }
}

function roleLabel(role: AuthRole): string {
  return { admin: "平台管理员", mentor: "导师账号", learner: "Young Builder", observer: "观察员" }[role];
}

function initials(value: string): string {
  return Array.from(value.trim()).slice(0, 2).join("").toUpperCase() || "MS";
}

function expiresLabel(value: string): string {
  const ms = Date.parse(value) - Date.now();
  if (ms <= 0) return "即将失效";
  return `约 ${Math.max(1, Math.ceil(ms / 60_000))} 分钟后失效`;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "账户操作没有完成，请重试。";
}
