"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AuthBrowserAccountSetSummary,
  AuthBrowserAccountStatus,
  AuthImpersonationContext,
  AuthRole,
} from "../lib/auth-model";
import { publicPath } from "../lib/public-path";
import {
  accountLoginPath,
  accountDestination,
  announceAccountChange,
  approveAccountNavigation,
  confirmAccountChange,
  ensureBrowserAccounts,
  hasUnsavedAccountWork,
  listenForAccountChanges,
  mutateBrowserAccount,
  readBrowserAccounts,
  safeAccountReturnTo,
} from "./browser-account-client";
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
  const [accountSet, setAccountSet] = useState<AuthBrowserAccountSetSummary | null>(null);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [identityChanged, setIdentityChanged] = useState(false);
  const safeReturnTo = safeAccountReturnTo(returnTo);
  const impersonation = user.impersonation ?? null;

  const refreshAccounts = useCallback(async (fromAnotherTab = false, upgradeLegacySession = false) => {
    if (impersonation) return null;
    try {
      let state = await readBrowserAccounts();
      if (!state && upgradeLegacySession) state = await ensureBrowserAccounts();
      setAccountSet(state);
      setAccountsLoaded(true);
      if (fromAnotherTab || state?.currentUserId !== user.userId) {
        setIdentityChanged(true);
      }
      return state;
    } catch (cause) {
      setError(messageOf(cause));
      setAccountsLoaded(true);
      return null;
    }
  }, [impersonation, user.userId]);

  useEffect(() => {
    if (impersonation) return;
    let active = true;
    const refresh = () => { if (active) void refreshAccounts(true, false); };
    const stopListening = listenForAccountChanges(refresh);
    const onFocus = () => { if (active) void refreshAccounts(false, false); };
    window.addEventListener("focus", onFocus);
    const timer = window.setTimeout(() => { if (active) void refreshAccounts(false, true); }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      stopListening();
    };
  }, [impersonation, refreshAccounts]);

  const loadOrEnsureAccounts = async () => {
    if (impersonation || accountSet || busy) return;
    setBusy("ensure");
    setError("");
    try {
      setAccountSet(await ensureBrowserAccounts());
      setAccountsLoaded(true);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  };

  const switchIdentity = async (targetUserId: string, restoring = false) => {
    if (!accountSet || busy || (!restoring && !confirmAccountChange())) return;
    setBusy(`switch:${targetUserId}`);
    setError("");
    try {
      const result = await mutateBrowserAccount("switch", accountSet, targetUserId);
      if (!result.accountSet || !result.user) throw new Error("账号列表已经失效，请重新登录。");
      setAccountSet(result.accountSet);
      announceAccountChange("switch");
      if (restoring && targetUserId === user.userId) {
        setIdentityChanged(false);
        return;
      }
      approveAccountNavigation();
      window.location.replace(publicPath(accountDestination(safeReturnTo, result.user)));
    } catch (cause) {
      setError(messageOf(cause));
      await refreshAccounts(false);
    } finally {
      setBusy(null);
    }
  };

  const removeAccount = async (targetUserId: string) => {
    if (!accountSet || busy) return;
    const target = accountSet.accounts.find((account) => account.userId === targetUserId);
    if (!target || !window.confirm(`从这台设备移除 ${target.displayName}？平台账号不会被删除。`)) return;
    setBusy(`remove:${targetUserId}`);
    setError("");
    try {
      const result = await mutateBrowserAccount("remove", accountSet, targetUserId);
      setAccountSet(result.accountSet);
      announceAccountChange("remove");
    } catch (cause) {
      setError(messageOf(cause));
      await refreshAccounts(false);
    } finally {
      setBusy(null);
    }
  };

  const logoutCurrent = async () => {
    if (!accountSet) {
      await legacyLogout();
      return;
    }
    if (busy || !confirmAccountChange()) return;
    setBusy("logout-current");
    setError("");
    try {
      await mutateBrowserAccount("logout-current", accountSet);
      announceAccountChange("logout-current");
      approveAccountNavigation();
      window.location.replace(loginSelectionPath(safeReturnTo, "current"));
    } catch (cause) {
      setError(messageOf(cause));
      await refreshAccounts(false);
      setBusy(null);
    }
  };

  const logoutAll = async () => {
    if (!accountSet || busy || !window.confirm("退出这台设备上的全部账号？所有保存的账号都需要重新输入密码。")) return;
    if (!confirmAccountChange()) return;
    setBusy("logout-all");
    setError("");
    try {
      await mutateBrowserAccount("logout-all", accountSet);
      announceAccountChange("logout-all");
      approveAccountNavigation();
      window.location.replace(loginSelectionPath(safeReturnTo, "all"));
    } catch (cause) {
      setError(messageOf(cause));
      await refreshAccounts(false);
      setBusy(null);
    }
  };

  const legacyLogout = async () => {
    if (busy || !confirmAccountChange()) return;
    setBusy("legacy-logout");
    setError("");
    try {
      await mutateEmpty("/api/auth/logout", "POST");
      announceAccountChange("logout-all");
      approveAccountNavigation();
      window.location.replace(loginSelectionPath(safeReturnTo, "all"));
    } catch (cause) {
      setError(messageOf(cause));
      setBusy(null);
    }
  };

  const returnToAdmin = async () => {
    setBusy("return");
    setError("");
    try {
      await mutateEmpty("/api/auth/impersonation", "DELETE");
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
    {identityChanged && !impersonation && <IdentityChangedGuard
      initialUser={user}
      accountSet={accountSet}
      busy={busy}
      error={error}
      onRestore={(target) => void switchIdentity(target, true)}
      onRefresh={() => {
        if (hasUnsavedAccountWork() && !window.confirm("放弃当前页未保存内容，并按这台设备的当前账号重新载入？")) return;
        approveAccountNavigation();
        window.location.reload();
      }}
    />}
    {impersonation && <div className={styles.impersonationBanner} role="status">
      <span><b>TEST 身份模拟</b><small>{impersonation.actor.displayName} → {impersonation.effective.displayName} · {expiresLabel(impersonation.expiresAt)}</small></span>
      <button type="button" onClick={() => void returnToAdmin()} disabled={busy !== null}>{busy === "return" ? "正在返回…" : "返回管理员身份"}</button>
    </div>}
    <details className={styles.menu} onToggle={(event) => {
      if ((event.currentTarget as HTMLDetailsElement).open && !accountSet) void loadOrEnsureAccounts();
    }}>
      <summary aria-label={`账户菜单：${user.displayName}`}>
        <span className={styles.avatar}>{initials(user.displayName)}</span>
        <span className={styles.summaryText}><b>{user.displayName}</b><small>@{user.username}</small></span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.panel}>
        <div className={styles.identity}>
          <span>{roleLabel(user.role)}{impersonation ? " · 模拟中" : " · 当前使用"}</span>
          <b>{user.displayName}</b>
          <small>@{user.username}</small>
        </div>
        {(context?.classroomTitle || context?.seatLabel) && <div className={styles.context}>
          {context.classroomTitle && <span>课堂：{context.classroomTitle}</span>}
          {context.seatLabel && <span>当前席位：{context.seatLabel}</span>}
        </div>}
        {error && <div className={styles.error} role="alert">{error}</div>}
        {!impersonation && <section className={styles.accountSection} aria-label="这台设备已登录账号">
          <div className={styles.sectionHeading}><b>这台设备的账号</b>{busy === "ensure" && <span>正在读取…</span>}</div>
          {accountSet?.accounts.map((account) => <div className={styles.accountRow} key={account.userId} data-current={account.current}>
            <span className={styles.miniAvatar}>{initials(account.displayName)}</span>
            <span className={styles.accountName}><b>{account.displayName}</b><small>@{account.username} · {roleLabel(account.role)}</small><em data-status={account.status}>{accountStatusLabel(account.status)}</em></span>
            <span className={styles.accountButtons}>
              {account.current
                ? <b className={styles.currentMark}>当前</b>
                : account.status === "available"
                  ? <button type="button" onClick={() => void switchIdentity(account.userId)} disabled={busy !== null}>{busy === `switch:${account.userId}` ? "切换中…" : "切换"}</button>
                  : account.status === "disabled"
                    ? <span className={styles.disabledMark}>不可用</span>
                    : <a href={accountLoginPath(safeReturnTo, account.username)}>重新验证</a>}
              {!account.current && <button className={styles.removeButton} type="button" aria-label={`从本设备移除 ${account.displayName}`} onClick={() => void removeAccount(account.userId)} disabled={busy !== null}>×</button>}
            </span>
          </div>)}
          {accountsLoaded && !accountSet?.accounts.length && <p className={styles.accountEmpty}>还没有其他已验证账号。</p>}
        </section>}
        <div className={styles.actions}>
          {!impersonation && <a href={publicPath("/account")}>账户中心</a>}
          {!impersonation && context?.testIdentityManagementHref && <a href={publicPath(context.testIdentityManagementHref)}>测试账号管理</a>}
          {!impersonation && <a href={accountLoginPath(safeReturnTo)}>＋ 添加账号</a>}
          {impersonation
            ? <button type="button" onClick={() => void returnToAdmin()} disabled={busy !== null}>返回管理员身份</button>
            : <button type="button" onClick={() => void logoutCurrent()} disabled={busy !== null}>{busy === "logout-current" ? "正在退出…" : "退出当前账号"}</button>}
          {!impersonation && accountSet && <button type="button" data-danger onClick={() => void logoutAll()} disabled={busy !== null}>{busy === "logout-all" ? "正在退出…" : "退出本设备全部账号"}</button>}
        </div>
      </div>
    </details>
  </div>;
}

function IdentityChangedGuard({
  initialUser,
  accountSet,
  busy,
  error,
  onRestore,
  onRefresh,
}: {
  initialUser: AccountMenuUser;
  accountSet: AuthBrowserAccountSetSummary | null;
  busy: string | null;
  error: string;
  onRestore: (targetUserId: string) => void;
  onRefresh: () => void;
}) {
  const original = accountSet?.accounts.find((account) => account.userId === initialUser.userId);
  const primaryAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const overlay = document.getElementById("msv-account-identity-guard");
    const changed: Array<{ node: HTMLElement; inert: boolean; ariaHidden: string | null }> = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child === overlay) continue;
      changed.push({ node: child, inert: child.inert, ariaHidden: child.getAttribute("aria-hidden") });
      child.inert = true;
      child.setAttribute("aria-hidden", "true");
    }
    primaryAction.current?.focus();
    return () => {
      for (const item of changed) {
        item.node.inert = item.inert;
        if (item.ariaHidden === null) item.node.removeAttribute("aria-hidden");
        else item.node.setAttribute("aria-hidden", item.ariaHidden);
      }
    };
  }, []);
  return createPortal(<div id="msv-account-identity-guard" className={styles.guard} data-msv-identity-overlay role="alertdialog" aria-modal="true" aria-labelledby="msv-account-guard-title">
    <section>
      <small>IDENTITY SAFETY LOCK</small>
      <h2 id="msv-account-guard-title">这台设备已切换账号</h2>
      <p>为避免把 <b>{initialUser.displayName}</b> 的页面内容误交给另一个账号，本页已经停止操作。未保存内容不会以新账号提交。</p>
      {hasUnsavedAccountWork() && <div className={styles.guardWarning}>检测到未保存内容：可先切回原账号继续编辑，或确认放弃后刷新。</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.guardActions}>
        {original?.status === "available" && <button type="button" onClick={() => onRestore(original.userId)} disabled={busy !== null}>{busy === `switch:${original.userId}` ? "正在切回…" : `切回 ${original.displayName}`}</button>}
        <button ref={primaryAction} type="button" onClick={onRefresh} disabled={busy !== null}>刷新为当前账号 →</button>
      </div>
    </section>
  </div>, document.body);
}

async function mutateEmpty(path: string, method: "POST" | "DELETE"): Promise<void> {
  const response = await fetch(publicPath(path), {
    method,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? "账户操作没有完成，请重试。");
}

function loginSelectionPath(returnTo: string, signedOut: "current" | "all"): string {
  const query = new URLSearchParams({ returnTo, select: "1", signedOut });
  return `${publicPath("/auth/login")}?${query.toString()}`;
}

function accountStatusLabel(status: AuthBrowserAccountStatus): string {
  return {
    available: "可直接切换",
    expired: "登录已到期",
    disabled: "账号已停用",
    reauthenticate: "需要重新验证",
  }[status];
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
