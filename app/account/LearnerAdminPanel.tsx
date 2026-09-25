"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ManagedLearnerAccount,
  ManagedLearnerBulkDeletionPreview,
  ManagedLearnerBulkDeletionResult,
  ManagedLearnerPage,
} from "../lib/auth-model";
import { PixelAvatar } from "../components/PixelAvatar";
import { publicPath } from "../lib/public-path";
import styles from "../auth/auth.module.css";

type Mode = "create" | "edit" | "password" | "delete" | "bulk-delete" | null;
type DeletionPreview = {
  userId: string;
  username: string;
  displayName: string;
  deletable: boolean;
  blockers: Array<{ code: string; label: string; count: number }>;
};

export function LearnerAdminPanel({ onChanged }: { onChanged?: () => Promise<void> | void }) {
  const [data, setData] = useState<ManagedLearnerPage | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [target, setTarget] = useState<ManagedLearnerAccount | null>(null);
  const [selected, setSelected] = useState<Map<string, ManagedLearnerAccount>>(() => new Map());
  const loadSequence = useRef(0);

  const load = useCallback(async (nextPage = page, nextQuery = submittedQuery, nextStatus = status) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: nextQuery, status: nextStatus, page: String(nextPage), pageSize: "20" });
      const next = await request<ManagedLearnerPage>(`/api/auth/admin/learners?${params.toString()}`);
      if (sequence !== loadSequence.current) return;
      setData(next);
      setPage(next.page);
    } catch (cause) {
      if (sequence === loadSequence.current) setError(messageOf(cause));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [page, status, submittedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(1, "", "all"); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const search = (event: FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    setSubmittedQuery(next);
    setPage(1);
    void load(1, next, status);
  };
  const changeStatusFilter = (next: "all" | "active" | "disabled") => {
    setStatus(next);
    setPage(1);
    void load(1, submittedQuery, next);
  };
  const open = (nextMode: Exclude<Mode, null>, learner: ManagedLearnerAccount | null = null) => {
    setMode(nextMode); setTarget(learner); setError(""); setNotice("");
  };
  const close = () => { setMode(null); setTarget(null); };
  const changed = async (message: string) => {
    close(); setNotice(message); await load(page, submittedQuery, status); await onChanged?.();
  };
  const visibleIds = useMemo(() => data?.items.map((item) => item.id) ?? [], [data?.items]);
  const selectedOnPage = visibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedOnPage === visibleIds.length;
  const toggleLearner = (learner: ManagedLearnerAccount, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(learner.id, learner); else next.delete(learner.id);
      return next;
    });
  };
  const toggleVisible = (checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      for (const learner of data?.items ?? []) {
        if (checked) next.set(learner.id, learner); else next.delete(learner.id);
      }
      return next;
    });
  };
  const bulkChanged = async (result: ManagedLearnerBulkDeletionResult) => {
    close();
    setSelected((current) => {
      const next = new Map(current);
      for (const item of result.deleted) next.delete(item.userId);
      return next;
    });
    const retained = result.blocked.length ? `；${result.blocked.length} 个有历史记录的账号已安全保留` : "";
    setNotice(`已永久删除 ${result.deleted.length} 个学员账号${retained}。`);
    await load(page, submittedQuery, status);
    await onChanged?.();
  };

  return <section className={styles.learnerAdmin} aria-labelledby="learner-admin-title">
    <header className={styles.adminToolbar}>
      <div><span>ADMIN · LEARNER DIRECTORY</span><h2 id="learner-admin-title">学员账号管理</h2><p>平台账号与课堂席位分开管理。昵称可改，登录账号和底层 ID 保持不变。</p></div>
      <button className={styles.primaryButton} type="button" onClick={() => open("create")}>＋ 新增学员</button>
    </header>
    <form className={styles.adminSearch} onSubmit={search}>
      <label className={styles.field}><span className={styles.fieldLabel}>搜索 ID／账号／昵称</span><input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))} placeholder="例如 @msv-student-03 或 学员 03" /></label>
      <label className={styles.field}><span className={styles.fieldLabel}>账号状态</span><select value={status} onChange={(event) => changeStatusFilter(event.target.value as typeof status)}><option value="all">全部</option><option value="active">启用</option><option value="disabled">停用</option></select></label>
      <button className={styles.secondaryButton} disabled={loading}>{loading ? "正在读取…" : "搜索"}</button>
    </form>
    {error && <div className={styles.formError} role="alert">{error} <button className={styles.inlineRetry} type="button" onClick={() => void load()}>重试</button></div>}
    {notice && <div className={styles.formSuccess} role="status">{notice}</div>}
    <div className={styles.adminListMeta}><b>{data ? `${data.total} 个学员账号` : "正在读取账号…"}</b><span>备注仅平台 Admin 可见；密码从不在列表中显示。</span></div>
    {data?.items.length ? <div className={styles.bulkSelectionBar} data-active={selected.size > 0}>
      <SelectionCheckbox
        label="选择本页学员"
        checked={allVisibleSelected}
        mixed={selectedOnPage > 0 && !allVisibleSelected}
        onChange={toggleVisible}
      />
      <span>{selected.size > 0 ? `已选 ${selected.size} 个学员${selectedOnPage < selected.size ? `（本页 ${selectedOnPage} 个）` : ""}` : "可跨搜索与分页继续选择"}</span>
      <div>
        {selected.size > 0 && <button className={styles.tinyButton} type="button" onClick={() => setSelected(new Map())}>取消选择</button>}
        <button className={styles.dangerButton} type="button" disabled={selected.size === 0} onClick={() => open("bulk-delete")}>批量删除{selected.size ? `（${selected.size}）` : ""}</button>
      </div>
    </div> : null}
    {!loading && data?.items.length === 0 && <div className={styles.adminEmpty}><b>{submittedQuery ? "没有匹配账号" : "还没有学员账号"}</b><p>{submittedQuery ? "可以清空关键词重试，或创建一个新的学员身份。" : "点击“新增学员”创建第一个编号式账号。"}</p></div>}
    <div className={styles.learnerTable} aria-busy={loading}>
      {data?.items.map((learner) => <article key={learner.id} className={styles.learnerRow} data-status={learner.status} data-selected={selected.has(learner.id)}>
        <SelectionCheckbox label={`选择 ${learner.displayName} @${learner.username}`} checked={selected.has(learner.id)} onChange={(checked) => toggleLearner(learner, checked)} />
        <PixelAvatar seed={learner.avatarSeed} label={learner.displayName} />
        <div className={styles.learnerIdentity}><b>{learner.displayName}</b><span>@{learner.username}</span><code title={learner.id}>{learner.id}</code></div>
        <div className={styles.learnerFacts}><span data-status={learner.status}>{learner.status === "active" ? "启用" : "已停用"}</span><small>{learner.mustChangePassword ? "待首次改密" : "密码已启用"} · {learner.activeSessions} 个活动会话</small><small>{learner.classrooms.length ? `课堂：${learner.classrooms.map((room) => room.title).join("、")}` : "尚未加入课堂"}</small></div>
        <p className={styles.notesPreview}>{learner.adminNotes || "暂无管理备注"}</p>
        <div className={styles.learnerActions}><button className={styles.tinyButton} type="button" onClick={() => open("edit", learner)}>编辑</button><button className={styles.tinyButton} type="button" onClick={() => open("password", learner)}>重置密码</button><button className={styles.deleteTextButton} type="button" onClick={() => open("delete", learner)}>删除</button></div>
      </article>)}
    </div>
    {data && data.total > data.pageSize && <nav className={styles.pagination} aria-label="学员账号列表分页"><button type="button" disabled={loading || data.page <= 1} onClick={() => void load(data.page - 1)}>上一页</button><span>第 {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))} 页</span><button type="button" disabled={loading || data.page * data.pageSize >= data.total} onClick={() => void load(data.page + 1)}>下一页</button></nav>}
    {mode === "create" && <CreateLearnerDialog onClose={close} onChanged={changed} />}
    {mode === "edit" && target && <EditLearnerDialog learner={target} onClose={close} onChanged={changed} />}
    {mode === "password" && target && <PasswordDialog learner={target} onClose={close} onChanged={changed} />}
    {mode === "delete" && target && <DeleteDialog learner={target} onClose={close} onChanged={changed} />}
    {mode === "bulk-delete" && selected.size > 0 && <BulkDeleteDialog learners={[...selected.values()]} onClose={close} onChanged={bulkChanged} />}
  </section>;
}

function SelectionCheckbox({ label, checked, mixed = false, onChange }: { label: string; checked: boolean; mixed?: boolean; onChange: (checked: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) input.current.indeterminate = mixed; }, [mixed]);
  return <label className={styles.selectionCheckbox} title={label}>
    <input ref={input} type="checkbox" checked={checked} aria-label={label} onChange={(event) => onChange(event.target.checked)} />
    <span aria-hidden="true">{checked ? "✓" : mixed ? "−" : ""}</span>
  </label>;
}

function CreateLearnerDialog({ onClose, onChanged }: DialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mutationKey = useRef(crypto.randomUUID());
  const firstField = useInitialDialogFocus();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request<{ learner: ManagedLearnerAccount; created: boolean }>("/api/auth/admin/learners", { method: "POST", body: { displayName, initialPassword, adminNotes: notes, idempotencyKey: mutationKey.current } });
      await onChanged(`${result.learner.displayName} 已${result.created ? "创建" : "恢复"}：@${result.learner.username}。初始密码不会再次显示，学员登录后必须修改。`);
    } catch (cause) { setInitialPassword(""); setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  return <Dialog title="新增学员" eyebrow="ADMIN · CREATE LEARNER" onClose={onClose} busy={busy}><form className={styles.authForm} onSubmit={submit}>
    <p className={styles.dialogLead}>系统会分配下一个未占用的 <code>msv-student-XX</code> 登录账号，并生成一个稳定像素头像。</p>
    <label className={styles.field}><span className={styles.fieldLabel}>学员昵称</span><input ref={firstField} value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} minLength={2} maxLength={40} required /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>一次性初始密码 <small>至少 12 个字符</small></span><input type="password" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Admin 备注 <small>仅管理员可见</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 500))} maxLength={500} placeholder="不要填写密码或无关敏感信息" /></label>
    {error && <div className={styles.formError} role="alert">{error}</div>}
    <DialogActions busy={busy} onClose={onClose} primary="创建学员账号" />
  </form></Dialog>;
}

function EditLearnerDialog({ learner, onClose, onChanged }: DialogProps & { learner: ManagedLearnerAccount }) {
  const [displayName, setDisplayName] = useState(learner.displayName);
  const [notes, setNotes] = useState(learner.adminNotes);
  const [status, setStatus] = useState(learner.status);
  const [regenerateAvatar, setRegenerateAvatar] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(learner.avatarSeed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request(`/api/auth/admin/learners/${encodeURIComponent(learner.id)}`, { method: "PATCH", body: { displayName, adminNotes: notes, status, regenerateAvatar } });
      await onChanged(`${displayName} 的资料已经保存。`);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  return <Dialog title={`编辑 ${learner.displayName}`} eyebrow="ADMIN · EDIT LEARNER" onClose={onClose} busy={busy}><form className={styles.authForm} onSubmit={submit}>
    <div className={styles.avatarEditor}><PixelAvatar seed={previewSeed} label={displayName} size="large" /><div><b>@{learner.username}</b><code>{learner.id}</code><button className={styles.tinyButton} type="button" onClick={() => { setRegenerateAvatar(true); setPreviewSeed(`preview:${crypto.randomUUID()}`); }}>换一个像素头像</button><small>保存后才会生效；取消不会改变原头像。</small></div></div>
    <label className={styles.field}><span className={styles.fieldLabel}>昵称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} minLength={2} maxLength={40} required /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>状态</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="active">启用</option><option value="disabled">停用并退出所有设备</option></select></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Admin 备注 <small>仅管理员可见</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 500))} maxLength={500} /></label>
    {error && <div className={styles.formError} role="alert">{error}</div>}
    <DialogActions busy={busy} onClose={onClose} primary="保存资料" />
  </form></Dialog>;
}

function PasswordDialog({ learner, onClose, onChanged }: DialogProps & { learner: ManagedLearnerAccount }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstField = useInitialDialogFocus();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) return setError("两次输入的新密码不一致。");
    setBusy(true); setError("");
    try {
      await request(`/api/auth/admin/learners/${encodeURIComponent(learner.id)}/password`, { method: "POST", body: { newPassword: password } });
      await onChanged(`${learner.displayName} 的密码已重置；旧密码和既有会话已经失效。`);
    } catch (cause) { setPassword(""); setConfirmation(""); setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  return <Dialog title="重置学员密码" eyebrow="ADMIN · PASSWORD RESET" onClose={onClose} busy={busy}><form className={styles.authForm} onSubmit={submit}>
    <p className={styles.dialogLead}>目标：<b>{learner.displayName}</b> · @{learner.username}。完成后所有设备退出，学员下次登录必须再次修改密码。</p>
    <label className={styles.field}><span className={styles.fieldLabel}>新的一次性密码</span><input ref={firstField} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>再次输入</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required aria-invalid={Boolean(confirmation && confirmation !== password)} /></label>
    {error && <div className={styles.formError} role="alert">{error}</div>}
    <DialogActions busy={busy} onClose={onClose} primary="确认重置密码" danger />
  </form></Dialog>;
}

function DeleteDialog({ learner, onClose, onChanged }: DialogProps & { learner: ManagedLearnerAccount }) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const firstField = useInitialDialogFocus(preview?.deletable ?? false);
  useEffect(() => {
    let active = true;
    void request<DeletionPreview>(`/api/auth/admin/learners/${encodeURIComponent(learner.id)}?deletePreview=1`)
      .then((value) => { if (active) setPreview(value); })
      .catch((cause) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [learner.id]);
  const remove = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview?.deletable || confirm !== learner.username) return;
    setBusy(true); setError("");
    try {
      await request(`/api/auth/admin/learners/${encodeURIComponent(learner.id)}`, { method: "DELETE" });
      await onChanged(`@${learner.username} 已永久删除。`);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  return <Dialog title="删除学员账号" eyebrow="ADMIN · PERMANENT DELETE" onClose={onClose} busy={busy}><form className={styles.authForm} onSubmit={remove}>
    <p className={styles.dialogLead}>目标：<b>{learner.displayName}</b> · @{learner.username} · <code>{learner.id}</code>。这不是“从课堂移除”或“退出本设备”。</p>
    {busy && !preview && <div className={styles.formSuccess}>正在检查课堂、作品、资金和验收依赖…</div>}
    {preview && !preview.deletable && <div className={styles.formError}><b>不能删除，必须保留历史证据：</b><ul>{preview.blockers.map((blocker) => <li key={blocker.code}>{blocker.label} · {blocker.count} 项</li>)}</ul><span>可以取消后将账号状态改为“停用”。</span></div>}
    {preview?.deletable && <><div className={styles.deleteWarning}>该账号没有历史依赖，可以永久删除。删除后旧 ID 不会交给新学员。</div><label className={styles.field}><span className={styles.fieldLabel}>输入登录账号确认</span><input ref={firstField} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={learner.username} autoComplete="off" /></label></>}
    {error && <div className={styles.formError} role="alert">{error}</div>}
    <div className={styles.dialogActions}><button className={styles.secondaryButton} type="button" onClick={onClose} disabled={busy}>取消</button><button className={styles.dangerButton} type="submit" disabled={busy || !preview?.deletable || confirm !== learner.username}>永久删除账号</button></div>
  </form></Dialog>;
}

function BulkDeleteDialog({ learners, onClose, onChanged }: {
  learners: ManagedLearnerAccount[];
  onClose: () => void;
  onChanged: (result: ManagedLearnerBulkDeletionResult) => Promise<void>;
}) {
  const [preview, setPreview] = useState<ManagedLearnerBulkDeletionPreview | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const userIds = useMemo(() => learners.map((learner) => learner.id), [learners]);
  const firstField = useInitialDialogFocus(Boolean(preview?.deletable.length));
  useEffect(() => {
    let active = true;
    void request<ManagedLearnerBulkDeletionPreview>("/api/auth/admin/learners/bulk-delete", { method: "POST", body: { userIds } })
      .then((value) => { if (active) setPreview(value); })
      .catch((cause) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [userIds]);
  const remove = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview?.deletable.length || confirm !== preview.confirmationText) return;
    setBusy(true); setError("");
    try {
      const result = await request<ManagedLearnerBulkDeletionResult>("/api/auth/admin/learners/bulk-delete", {
        method: "DELETE",
        body: { userIds, confirmation: confirm },
      });
      await onChanged(result);
    } catch (cause) { setError(messageOf(cause)); setConfirm(""); }
    finally { setBusy(false); }
  };
  return <Dialog title={`批量删除 ${learners.length} 个学员`} eyebrow="ADMIN · BULK PERMANENT DELETE" onClose={onClose} busy={busy}><form className={styles.authForm} onSubmit={remove}>
    <p className={styles.dialogLead}>这会检查所选账号的课堂、作品、声望和资金记录。<b>有历史证据的账号绝不会删除</b>，仍可稍后单独停用。</p>
    {busy && !preview && <div className={styles.formSuccess}>正在检查 {learners.length} 个账号的删除条件…</div>}
    {preview && <div className={styles.bulkPreviewSummary}>
      <div data-kind="delete"><b>{preview.deletable.length}</b><span>可永久删除</span></div>
      <div data-kind="keep"><b>{preview.blocked.length}</b><span>因历史记录保留</span></div>
    </div>}
    {preview?.deletable.length ? <section className={styles.bulkPreviewList} aria-label="将永久删除的账号"><h3>将永久删除</h3>{preview.deletable.map((item) => <p key={item.userId}><b>{item.displayName}</b><span>@{item.username}</span></p>)}</section> : null}
    {preview?.blocked.length ? <section className={styles.bulkPreviewList} data-kind="blocked" aria-label="因历史记录保留的账号"><h3>不会删除</h3>{preview.blocked.map((item) => <p key={item.userId}><b>{item.displayName}</b><span>@{item.username} · {item.blockers.map((blocker) => `${blocker.label} ${blocker.count} 项`).join("；")}</span></p>)}</section> : null}
    {preview?.deletable.length ? <><div className={styles.deleteWarning}>永久删除后无法恢复。请再次确认目标和数量。</div><label className={styles.field}><span className={styles.fieldLabel}>输入确认文字：<code>{preview.confirmationText}</code></span><input ref={firstField} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" /></label></> : null}
    {preview && preview.deletable.length === 0 && <div className={styles.formError}>所选账号都有历史依赖，本次没有可永久删除的账号。</div>}
    {error && <div className={styles.formError} role="alert">{error}</div>}
    <div className={styles.dialogActions}><button className={styles.secondaryButton} type="button" onClick={onClose} disabled={busy}>取消</button><button className={styles.dangerButton} type="submit" disabled={busy || !preview?.deletable.length || confirm !== preview.confirmationText}>{busy ? "正在处理…" : `永久删除 ${preview?.deletable.length ?? 0} 个账号`}</button></div>
  </form></Dialog>;
}

function Dialog({ title, eyebrow, onClose, busy, children }: { title: string; eyebrow: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  return <div className={styles.adminDialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className={styles.adminDialog} role="dialog" aria-modal="true" aria-labelledby="account-dialog-title"><header><div><span>{eyebrow}</span><h2 id="account-dialog-title">{title}</h2></div><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>×</button></header>{children}</section></div>;
}

function DialogActions({ busy, onClose, primary, danger = false }: { busy: boolean; onClose: () => void; primary: string; danger?: boolean }) {
  return <div className={styles.dialogActions}><button className={styles.secondaryButton} type="button" onClick={onClose} disabled={busy}>取消</button><button className={danger ? styles.dangerButton : styles.primaryButton} type="submit" disabled={busy}>{busy ? "正在处理…" : primary}</button></div>;
}

type DialogProps = { onClose: () => void; onChanged: (message: string) => Promise<void> };

function useInitialDialogFocus(ready = true) {
  const target = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => target.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [ready]);
  return target;
}

async function request<T>(path: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> {
  const response = await fetch(publicPath(path), {
    method: options.method ?? "GET",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    credentials: "same-origin",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const envelope = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!response.ok || !envelope?.ok || envelope.data === undefined) throw new Error(envelope?.error?.message ?? "学员账号操作没有完成，请重试。");
  return envelope.data;
}

function messageOf(cause: unknown): string { return cause instanceof Error ? cause.message : "学员账号操作没有完成，请重试。"; }
