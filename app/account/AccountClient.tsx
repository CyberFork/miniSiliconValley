"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuthBrowserAccountSetSummary,
  AuthRole,
  AuthSessionSummary,
  AuthUser,
} from "../lib/auth-model";
import { publicPath } from "../lib/public-path";
import styles from "../auth/auth.module.css";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { AccountMenu } from "../components/AccountMenu";
import Link from "../components/NavigationLink";
import { announceAccountChange, approveAccountNavigation, mutateBrowserAccount } from "../components/browser-account-client";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

export default function AccountClient({ initialUser, firstLogin = false, returnTo = "/terminal/" }: { initialUser: AuthUser; firstLogin?: boolean; returnTo?: string }) {
  const [user, setUser] = useState(initialUser);
  const [sessions, setSessions] = useState<AuthSessionSummary[]>([]);
  const [accountSet, setAccountSet] = useState<AuthBrowserAccountSetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const sessionData = await request<{ user: AuthUser; sessions: AuthSessionSummary[]; accountSet: AuthBrowserAccountSetSummary | null }>("/api/auth/session");
      setUser(sessionData.user);
      setSessions(sessionData.sessions);
      setAccountSet(sessionData.accountSet);
      setError(null);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await refresh();
      return true;
    } catch (cause) {
      setError(messageOf(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.accountPage}>
      <a className={styles.skipLink} href="#account-main">跳到账户内容</a>
      <nav className={styles.accountNav} aria-label="Mini Silicon Valley">
        <BrandHomeLink />
        <div className={styles.navLinks}><a href={publicPath("/")}>首页</a><Link href="/terminal/">时空终端</Link><Link href="/course/">课件查看</Link><a href={publicPath("/classroom")}>进入课堂</a>{(user.role === "admin" || user.role === "mentor") && <Link href="/console/">工作台</Link>}<AccountMenu user={user} returnTo="/account/" /></div>
      </nav>
      <div className={styles.accountMain} id="account-main">
        <header className={styles.accountHero}>
          <div><span className={styles.kicker}>IDENTITY & SECURITY · PERSONAL ONLY</span><h1>我的账户</h1><p>这里只管理当前账号的昵称、密码和登录设备。学员目录、他人密码与 RBAC 已迁入 MINI硅谷工作台。</p></div>
          <div className={styles.identityBadge}><b>{initials(user.displayName)}</b><div><span>{user.displayName}</span><small>@{user.username} · {roleLabel(user.role)}</small></div></div>
        </header>
        {(error || notice) && <div className={error ? styles.formError : styles.formSuccess} role={error ? "alert" : "status"} style={{ marginTop: 24 }}>{error ?? notice}</div>}
        {(firstLogin || user.mustChangePassword) && <div className={styles.formSuccess} role="status" style={{ marginTop: 24 }}><strong>先完成账号启用：</strong>请使用下方“更新密码”把一次性初始密码换成只有你知道的密码。完成后系统会进入你的时空终端。</div>}
        <div className={styles.accountGrid}>
          <ProfileCard key={user.displayName} user={user} busy={busy} onRun={run} />
          <PasswordCard busy={busy} onRun={run} returnTo={firstLogin || user.mustChangePassword ? returnTo : null} />
          <SessionCard sessions={sessions} accountSet={accountSet} loading={loading} busy={busy} onRun={run} />
        </div>
      </div>
    </main>
  );
}

function ProfileCard({ user, busy, onRun }: { user: AuthUser; busy: boolean; onRun: Runner }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  return (
    <section className={styles.accountCard}>
      <header><div><span>01 · PROFILE</span><h2>课堂身份</h2><p>显示名称会出现在队友、作品和课堂记录中；用户名用于登录且保持稳定。</p></div></header>
      <form className={styles.authForm} onSubmit={(event) => { event.preventDefault(); void onRun(() => request("/api/auth/profile", { method: "PATCH", body: { displayName } }).then(() => undefined), "显示名称已更新。"); }}>
        <label className={styles.field}><span className={styles.fieldLabel}>学员ID / 用户名</span><input value={user.username} disabled /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>显示名称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} minLength={2} maxLength={40} required /></label>
        <button className={styles.secondaryButton} disabled={busy || displayName === user.displayName}>保存身份资料</button>
      </form>
    </section>
  );
}

function PasswordCard({ busy, onRun, returnTo }: { busy: boolean; onRun: Runner; returnTo: string | null }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  return (
    <section className={styles.accountCard}>
      <header><div><span>02 · PASSWORD</span><h2>更新密码</h2><p>修改后会退出其他设备，当前设备继续保持登录。</p></div></header>
      <form className={styles.authForm} onSubmit={(event) => {
        event.preventDefault();
        if (newPassword !== confirmation) return;
        void onRun(async () => {
          await request("/api/auth/profile", { method: "PATCH", body: { currentPassword, newPassword } });
          setCurrentPassword(""); setNewPassword(""); setConfirmation("");
        }, "密码已更新，其他设备已经退出。").then((updated) => { if (updated && returnTo) window.location.assign(publicPath(returnTo)); });
      }}>
        <label className={styles.field}><span className={styles.fieldLabel}>当前密码</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>新密码 <small>至少12个字符</small></span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>再次输入</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required aria-invalid={Boolean(confirmation && confirmation !== newPassword)} /></label>
        {confirmation && confirmation !== newPassword && <div className={styles.formError}>两次输入的新密码不一致。</div>}
        <button className={styles.secondaryButton} disabled={busy || newPassword.length < 12 || newPassword !== confirmation}>修改密码</button>
      </form>
    </section>
  );
}

function SessionCard({ sessions, accountSet, loading, busy, onRun }: {
  sessions: AuthSessionSummary[];
  accountSet: AuthBrowserAccountSetSummary | null;
  loading: boolean;
  busy: boolean;
  onRun: Runner;
}) {
  return (
    <section className={styles.accountCard}>
      <header><div><span>03 · DEVICES</span><h2>登录设备</h2><p>如果看到不认识的设备，立即退出它并修改密码。</p></div></header>
      {loading ? <p>正在读取设备…</p> : <ul className={styles.sessionList}>{sessions.map((session) => (
        <li key={session.id}><div><strong>{session.userAgent}{session.current && <span className={styles.statusPill}>当前</span>}</strong><span>最近活动 {formatTime(session.lastSeenAt)} · 到期 {formatTime(session.expiresAt)}</span></div>{!session.current && <button className={styles.tinyButton} disabled={busy} onClick={() => void onRun(() => request(`/api/auth/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" }).then(() => undefined), "该设备已经退出。")}>退出设备</button>}</li>
      ))}</ul>}
      <button className={styles.dangerButton} style={{ marginTop: 18 }} disabled={busy} onClick={() => void onRun(() => signOutCurrent(accountSet), "正在打开本设备账号列表…")}>退出当前账号</button>
    </section>
  );
}

type Runner = (action: () => Promise<void>, success: string) => Promise<boolean>;

async function request<T>(path: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> {
  const response = await fetch(publicPath(path), {
    method: options.method ?? "GET",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const envelope = await response.json() as Envelope<T>;
  if (!response.ok || !envelope.ok || envelope.data === undefined) throw new Error(envelope.error?.message ?? "账号服务没有完成这次操作。");
  return envelope.data;
}

async function signOutCurrent(accountSet: AuthBrowserAccountSetSummary | null) {
  if (accountSet) await mutateBrowserAccount("logout-current", accountSet);
  else {
    const response = await fetch(publicPath("/api/auth/logout"), { method: "POST", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("当前账号没有退出，请重试。");
  }
  announceAccountChange("logout-current");
  approveAccountNavigation();
  window.location.replace(`${publicPath("/auth/login")}?signedOut=current&select=1`);
}

function roleLabel(role: AuthRole): string {
  return { admin: "系统管理员", mentor: "DM导师", learner: "Young Builder", observer: "观察员" }[role];
}

function initials(value: string): string {
  return Array.from(value.trim()).slice(0, 2).join("").toUpperCase() || "MS";
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "账号服务没有完成这次操作。";
}
