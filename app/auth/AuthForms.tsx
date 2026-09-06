"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../lib/auth-model";
import { publicPath } from "../lib/public-path";
import styles from "./auth.module.css";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

export function LoginForm({ returnTo, initialUser, signedOut }: {
  returnTo: string;
  initialUser: AuthUser | null;
  signedOut: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { username, password, remember });
      window.location.assign(publicPath(safeReturnTo(returnTo)));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <header className={styles.cardHeading}>
        <span>ACCOUNT ACCESS</span>
        <h2>进入你的世界线</h2>
        <p>账号只使用用户名和密码。课堂归属在登录后通过队伍ID申请。</p>
      </header>
      {initialUser && <div className={styles.signedInNote}>当前已登录为 <strong>{initialUser.displayName}</strong>。你可以直接继续，或切换账号。</div>}
      {signedOut && <div className={styles.formSuccess} role="status">已经安全退出当前账号。</div>}
      <form className={styles.authForm} onSubmit={submit} noValidate>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>用户名</span>
          <input name="username" value={username} onChange={(event) => setUsername(normalizeUsernameInput(event.target.value))} autoComplete="username" minLength={3} maxLength={32} required aria-invalid={Boolean(error)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>密码</span>
          <span className={styles.inputWrap}>
            <input name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={128} required aria-invalid={Boolean(error)} />
            <button className={styles.showPassword} type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? "隐藏" : "显示"}</button>
          </span>
        </label>
        <div className={styles.checkRow}>
          <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />在这台私人设备上保持登录</label>
          <a className={styles.textLink} href={publicPath("/auth/recover")}>忘记密码</a>
        </div>
        {error && <div className={styles.formError} role="alert">{error}</div>}
        <button className={styles.primaryButton} disabled={busy || username.length < 3 || !password}>{busy ? "正在验证…" : "进入 Mini Silicon Valley →"}</button>
        {initialUser && <button type="button" className={styles.secondaryButton} onClick={() => window.location.assign(publicPath(safeReturnTo(returnTo)))}>继续使用 {initialUser.displayName}</button>}
      </form>
      <p className={styles.formFoot}>还没有账号？ <a className={styles.textLink} href={`${publicPath("/auth/register")}?returnTo=${encodeURIComponent(returnTo)}`}>直接注册 Young Builder</a></p>
    </div>
  );
}

export function RegisterForm({ returnTo }: { returnTo: string }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordScore = useMemo(() => scorePassword(password), [password]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }
    if (!agreed) {
      setError("请先确认你会保护账号和课堂私密信息。");
      return;
    }
    setBusy(true);
    try {
      await api<{ user: AuthUser }>("/api/auth/register", { username, displayName, password, remember });
      window.location.assign(publicPath(safeReturnTo(returnTo)));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <header className={styles.cardHeading}>
        <span>CREATE YOUNG BUILDER ID</span>
        <h2>直接创建成长账号</h2>
        <p>无需邀请代码。注册成功后，用队伍ID向具体团队申请加入。</p>
      </header>
      <form className={styles.authForm} onSubmit={submit} noValidate>
        <label className={styles.field}><span className={styles.fieldLabel}>用户名 <small>3–32位，注册后保持稳定</small></span><input value={username} onChange={(event) => setUsername(normalizeUsernameInput(event.target.value))} autoComplete="username" minLength={3} maxLength={32} pattern="[a-z][a-z0-9_-]{2,31}" required /><p className={styles.fieldHint}>以小写字母开头，可使用数字、- 和 _。</p></label>
        <label className={styles.field}><span className={styles.fieldLabel}>课堂显示名称 <small>可以使用安全昵称</small></span><input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} autoComplete="nickname" minLength={2} maxLength={40} required /></label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>设置密码 <small>至少12个字符</small></span>
          <span className={styles.inputWrap}><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /><button className={styles.showPassword} type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "隐藏" : "显示"}</button></span>
          <span className={styles.passwordMeter} aria-label={`密码长度强度 ${passwordScore}/4`}>{[1, 2, 3, 4].map((level) => <i key={level} data-on={level <= passwordScore} />)}</span>
          <p className={styles.fieldHint}>推荐使用一句只有你知道、容易记住的长短语。</p>
        </label>
        <label className={styles.field}><span className={styles.fieldLabel}>再次输入密码</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required aria-invalid={Boolean(confirmation && confirmation !== password)} /></label>
        <div className={styles.checkRow}><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />在这台私人设备上保持登录</label></div>
        <div className={styles.checkRow}><label><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />我会保护私密情报、尊重队友，不共享个人密码</label></div>
        {confirmation && confirmation !== password && <div className={styles.formError}>两次输入的密码不一致。</div>}
        {error && <div className={styles.formError} role="alert">{error}</div>}
        <button className={styles.primaryButton} disabled={busy || !agreed || password.length < 12 || password !== confirmation}>{busy ? "正在创建身份…" : "创建账号并进入课堂 →"}</button>
      </form>
      <p className={styles.formFoot}>已经有账号？ <a className={styles.textLink} href={`${publicPath("/auth/login")}?returnTo=${encodeURIComponent(returnTo)}`}>返回登录</a></p>
    </div>
  );
}

export function RecoveryGuide() {
  return (
    <div className={styles.authCard}>
      <header className={styles.cardHeading}><span>ACCOUNT RECOVERY</span><h2>请联系你的导师</h2><p>当前不收集邮箱或手机号，因此不会向外部服务发送验证码。</p></header>
      <div className={styles.recoverySheet}>
        <h3>只需要两步</h3>
        <ol>
          <li>把你的用户名或课堂昵称告诉DM导师。</li>
          <li>DM生成30分钟有效的一次性重置链接，私下发给你；打开后设置新密码。</li>
        </ol>
        <p>导师看不到你的新密码。链接使用一次立即失效；重置成功会退出其他设备。导师和管理员账号由后台维护，不使用这个流程。</p>
      </div>
      <p className={styles.formFoot}><a className={styles.textLink} href={publicPath("/auth/login")}>返回登录</a></p>
    </div>
  );
}

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.hash.slice(1)).get("token");
    // Remove the secret from the address bar and browser history immediately.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const timer = window.setTimeout(() => {
      if (raw && /^[A-Za-z0-9_-]{40,128}$/.test(raw)) setToken(raw);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (newPassword !== confirmation) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { token, newPassword });
      setToken(null);
      window.location.replace(publicPath("/classroom"));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className={styles.authCard}><p>正在安全读取重置链接…</p></div>;
  if (!token) {
    return (
      <div className={styles.authCard}>
        <header className={styles.cardHeading}><span>RESET LINK</span><h2>这个链接不可用</h2><p>链接可能不完整、已经使用或已经过期。请让DM重新生成，不要转发旧链接。</p></header>
        <p className={styles.formFoot}><a className={styles.textLink} href={publicPath("/auth/recover")}>查看找回说明</a></p>
      </div>
    );
  }

  return (
    <div className={styles.authCard}>
      <header className={styles.cardHeading}><span>ONE-TIME RESET LINK</span><h2>设置你的新密码</h2><p>链接已从地址栏清除，并只保存在当前页面内存中。</p></header>
      <form className={styles.authForm} onSubmit={submit} noValidate>
        <label className={styles.field}><span className={styles.fieldLabel}>新密码 <small>至少12个字符</small></span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>再次输入新密码</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required aria-invalid={Boolean(confirmation && confirmation !== newPassword)} /></label>
        {confirmation && confirmation !== newPassword && <div className={styles.formError}>两次输入的新密码不一致。</div>}
        {error && <div className={styles.formError} role="alert">{error}</div>}
        <button className={styles.primaryButton} disabled={busy || newPassword.length < 12 || newPassword !== confirmation}>{busy ? "正在重置…" : "设置新密码并登录 →"}</button>
      </form>
    </div>
  );
}

async function api<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(publicPath(path), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const envelope = await response.json() as Envelope<T>;
  if (!response.ok || !envelope.ok || envelope.data === undefined) {
    throw new Error(envelope.error?.message ?? "账号服务没有完成这次操作。");
  }
  return envelope.data;
}

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth")) return "/classroom";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local" ? `${url.pathname}${url.search}${url.hash}` : "/classroom";
  } catch {
    return "/classroom";
  }
}

function normalizeUsernameInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "账号服务没有完成这次操作。";
}

function scorePassword(value: string): number {
  if (!value) return 0;
  let score = value.length >= 12 ? 1 : 0;
  if (value.length >= 16) score += 1;
  if (new Set(value).size >= 8) score += 1;
  if (/\s/.test(value) || /[^a-zA-Z0-9]/.test(value) || value.length >= 24) score += 1;
  return Math.min(4, score);
}
