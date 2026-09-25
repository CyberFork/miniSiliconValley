"use client";

import { type FormEvent, useState } from "react";
import type { IssuedPasswordResetLink, ManagedAuthUser } from "../../lib/auth-model";
import { publicPath } from "../../lib/public-path";
import styles from "../../auth/auth.module.css";

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

export function PasswordAssistancePanel() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ManagedAuthUser[]>([]);
  const [issued, setIssued] = useState<IssuedPasswordResetLink | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setMessage(""); setIssued(null);
    try {
      const data = await request<ManagedAuthUser[]>(`/api/auth/admin/users?q=${encodeURIComponent(query.trim())}`);
      setUsers(data); if (!data.length) setMessage("没有找到你有权协助的学员。导师只能看到自己课堂范围内的账号。");
    } catch (cause) { setMessage(messageOf(cause)); }
    finally { setWorking(false); }
  }
  async function issue(username: string) {
    setWorking(true); setMessage(""); setIssued(null);
    try { setIssued(await request<IssuedPasswordResetLink>("/api/auth/admin/reset-links", { method: "POST", body: { username } })); }
    catch (cause) { setMessage(messageOf(cause)); }
    finally { setWorking(false); }
  }

  return <section className={`${styles.accountCard} ${styles.wideCard}`}>
    <header><div><span>MENTOR · PASSWORD ASSISTANCE</span><h2>帮助课堂学员重置密码</h2><p>搜索你所带课堂中的学员，生成 30 分钟有效、只能使用一次的重置链接。导师看不到学员的新密码。</p></div></header>
    {issued && <div className={styles.issuedSecret} role="status"><small>一次性重置链接 · 仅展示一次</small><strong>{issued.resetUrl}</strong><span>{issued.displayName} · @{issued.username} · {new Date(issued.expiresAt).toLocaleString("zh-CN")} 失效</span><div className={styles.buttonRow} style={{ marginTop: 14 }}><button className={styles.tinyButton} onClick={() => void navigator.clipboard.writeText(issued.resetUrl)}>复制链接</button><button className={styles.tinyButton} onClick={() => setIssued(null)}>我已发送</button></div></div>}
    <form className={styles.authForm} onSubmit={search}><label className={styles.field}><span className={styles.fieldLabel}>学员 ID、用户名或昵称</span><input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))} minLength={2} maxLength={80} placeholder="至少输入 2 个字符" required /></label><button className={styles.secondaryButton} disabled={working || query.trim().length < 2}>{working ? "正在查找…" : "查找学员"}</button></form>
    {message && <div className={styles.formError} role="status">{message}</div>}
    {users.length > 0 && <ul className={styles.adminList}>{users.map((target) => <li key={target.id}><div><strong>{target.displayName}</strong><span>@{target.username}</span></div><div className={styles.adminActions}><button className={styles.tinyButton} disabled={working || target.status !== "active"} onClick={() => void issue(target.username)}>生成重置链接</button></div></li>)}</ul>}
  </section>;
}

async function request<T>(path: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> {
  const response = await fetch(publicPath(path), { method: options.method ?? "GET", headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const envelope = await response.json() as Envelope<T>;
  if (!response.ok || !envelope.ok || envelope.data === undefined) throw new Error(envelope.error?.message ?? "账号服务没有完成这次操作。");
  return envelope.data;
}
function messageOf(cause: unknown) { return cause instanceof Error ? cause.message : "账号服务没有完成这次操作。"; }
