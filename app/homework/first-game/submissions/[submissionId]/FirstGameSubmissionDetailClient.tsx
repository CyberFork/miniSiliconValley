"use client";

import { useEffect, useRef, useState } from "react";
import { FIRST_GAME_HOMEWORK_SECTIONS, type FirstGameAnswer, type FirstGameAnswers, type FirstGameField } from "../../../../lib/first-game-homework";
import type { FirstGameSubmission } from "../../../../lib/homework-store";
import { publicPath } from "../../../../lib/public-path";
import styles from "../../../homework.module.css";

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };
type EditTarget =
  | { kind: "identity"; id: "respondentNickname" | "respondentNote"; label: string }
  | { kind: "answer"; field: FirstGameField };

export default function FirstGameSubmissionDetailClient({ initialSubmission, canEdit }: { initialSubmission: FirstGameSubmission; canEdit: boolean }) {
  const [submission, setSubmission] = useState(initialSubmission);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState<FirstGameAnswer>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!target) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      setTarget(null); setMessage("");
      window.setTimeout(() => openerRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus(), 0);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [target, busy]);

  function openEditor(next: EditTarget, opener: HTMLElement) {
    if (!canEdit) return;
    openerRef.current = opener;
    setMessage("");
    setTarget(next);
    setDraft(next.kind === "identity" ? submission[next.id] : cloneAnswer(submission.answers[next.field.id] ?? emptyAnswer(next.field)));
  }
  function closeEditor() {
    if (busy) return;
    setTarget(null); setMessage("");
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }
  async function save() {
    if (!target || busy) return;
    setBusy(true); setMessage("");
    const respondentNickname = target.kind === "identity" && target.id === "respondentNickname" ? String(draft) : submission.respondentNickname;
    const respondentNote = target.kind === "identity" && target.id === "respondentNote" ? String(draft) : submission.respondentNote;
    const answers: FirstGameAnswers = target.kind === "answer" ? { ...submission.answers, [target.field.id]: draft } : submission.answers;
    try {
      const response = await fetch(publicPath(`/api/public/homework/first-game/submissions/${encodeURIComponent(submission.id)}`), {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: submission.revision, respondentNickname, respondentNote, answers }),
      });
      const envelope = await response.json().catch(() => null) as Envelope<FirstGameSubmission> | null;
      if (!response.ok || !envelope?.ok || !envelope.data) throw new Error(envelope?.error?.message ?? "没有收到保存确认，请稍后重试。");
      setSubmission(envelope.data); setTarget(null); setMessage("");
      window.setTimeout(() => openerRef.current?.focus(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "修改暂时没有保存成功，请稍后重试。");
    } finally { setBusy(false); }
  }

  return <>
    <section className={styles.detailHeader}>
      <div><small className={styles.publicBadge}>免登录公开详情</small>{canEdit && <small className={styles.staffEditBadge}>导师编辑模式</small>}
        {canEdit ? <button type="button" className={styles.identityEditButton} onClick={(event) => openEditor({ kind: "identity", id: "respondentNickname", label: "姓名／昵称" }, event.currentTarget)}><span>{submission.respondentNickname || "匿名 Young Builder"} 的游戏</span><b>点击修改姓名／昵称</b></button> : <h1>{submission.respondentNickname || "匿名 Young Builder"} 的游戏</h1>}
      </div>
      <a className={styles.backLink} href={publicPath("/homework/first-game/submissions/")}>← 返回提交列表</a>
    </section>
    <div className={styles.detailMeta}><span>提交时间：{formatTime(submission.createdAt)}</span><span>{submission.answeredCount} 项有内容</span><span>{submission.revision ? `已修订 r${submission.revision} · ${formatTime(submission.updatedAt)}` : "原始提交 r0"}</span></div>
    {canEdit ? <button type="button" className={`${styles.respondentNote} ${styles.respondentNoteButton}`} onClick={(event) => openEditor({ kind: "identity", id: "respondentNote", label: "公司名称" }, event.currentTarget)}><b>公司名称</b><p>{submission.respondentNote || "未填写"}</p><span>点击修改</span></button> : submission.respondentNote && <aside className={styles.respondentNote}><b>公司名称</b><p>{submission.respondentNote}</p></aside>}
    {FIRST_GAME_HOMEWORK_SECTIONS.map((section) => {
      const visible = canEdit ? section.fields : section.fields.filter((field) => hasContent(submission.answers[field.id]));
      if (!visible.length) return null;
      return <section className={styles.answerSection} key={section.id}><header><small>{section.level}</small><h2>{section.title}</h2></header><div>{visible.map((field) => <AnswerCard field={field} answer={submission.answers[field.id]} editable={canEdit} onEdit={openEditor} key={field.id} />)}</div></section>;
    })}
    {submission.answeredCount === 0 && !canEdit && <section className={styles.emptyList}><h2>旧版空白记录</h2><p>这是启用第一部分必填规则前保存的历史记录。</p></section>}
    {target && <div className={styles.editDialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
      <div className={styles.editDialog} role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title" ref={dialogRef}>
        <header><div><small>STAFF REVISION · r{submission.revision + 1}</small><h2 id="edit-dialog-title">修改：{target.kind === "identity" ? target.label : target.field.label}</h2></div><button type="button" aria-label="关闭修改弹窗" onClick={closeEditor} disabled={busy}>×</button></header>
        <div className={styles.editDialogBody}>{target.kind === "identity" ? <label className={styles.field}><b>{target.label} <span className={styles.requiredMark}>*</span></b><input value={typeof draft === "string" ? draft : ""} maxLength={target.id === "respondentNickname" ? 80 : 120} onChange={(event) => setDraft(event.target.value)} /></label> : <EditControl field={target.field} value={draft} onChange={setDraft} />}</div>
        {message && <p className={styles.editDialogError} role="alert">{message}</p>}
        <footer><p>保存会追加一条可审计修订，不覆盖原始提交。</p><div><button type="button" className={styles.dialogCancel} onClick={closeEditor} disabled={busy}>取消</button><button type="button" className={styles.dialogSave} onClick={save} disabled={busy}>{busy ? "正在保存…" : "保存修改 →"}</button></div></footer>
      </div>
    </div>}
  </>;
}

function AnswerCard({ field, answer, editable, onEdit }: { field: FirstGameField; answer: FirstGameAnswer | undefined; editable: boolean; onEdit: (target: EditTarget, opener: HTMLElement) => void }) {
  const content = <AnswerValue field={field} answer={answer} />;
  return <article className={`${styles.answerCard} ${editable ? styles.editableAnswerCard : ""}`} data-wide={field.kind === "table" || undefined} data-empty={!hasContent(answer) || undefined}>
    <b>{field.label}{field.required && <span className={styles.requiredMark}> *</span>}</b>{content}{editable && <><button type="button" className={styles.answerCardTrigger} aria-label={`修改：${field.label}`} onClick={(event) => onEdit({ kind: "answer", field }, event.currentTarget)} /><span className={styles.answerEditHint}>{hasContent(answer) ? "点击修改" : "＋ 添加内容"}</span></>}
  </article>;
}

function AnswerValue({ field, answer }: { field: FirstGameField; answer: FirstGameAnswer | undefined }) {
  if (field.kind === "table" && Array.isArray(answer)) return <div className={styles.tableScroll}><table><thead><tr><th>项目</th>{field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}</tr></thead><tbody>{field.rows?.map((row, index) => { const value = answer.find((item) => typeof item === "object" && item !== null && item.rowId === row.id) as Record<string, string> | undefined ?? (typeof answer[index] === "object" ? answer[index] as Record<string, string> : undefined); return <tr key={row.id}><th>{row.label}</th>{field.columns?.map((column) => <td key={column.id}>{value?.[column.id] || "—"}</td>)}</tr>; })}</tbody></table></div>;
  if (Array.isArray(answer)) return answer.length ? <ul>{answer.filter((item): item is string => typeof item === "string").map((item) => <li key={item}>{item}</li>)}</ul> : <p>未填写</p>;
  return <p>{answer || "未填写"}</p>;
}

function EditControl({ field, value, onChange }: { field: FirstGameField; value: FirstGameAnswer; onChange: (value: FirstGameAnswer) => void }) {
  const required = field.required ? <span className={styles.requiredMark}>*</span> : null;
  if (field.kind === "short" || field.kind === "long") return <label className={styles.field}><b>{field.label} {required}</b>{field.prompt && <small>{field.prompt}</small>}{field.kind === "long" ? <textarea value={typeof value === "string" ? value : ""} maxLength={1200} onChange={(event) => onChange(event.target.value)} /> : <input value={typeof value === "string" ? value : ""} maxLength={1200} onChange={(event) => onChange(event.target.value)} />}</label>;
  if (field.kind === "single" || field.kind === "multi") {
    const choices = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <fieldset className={styles.field}><legend>{field.label} {required}</legend><div className={styles.choices}>{field.options?.map((option) => <label key={option}><input type={field.kind === "single" ? "radio" : "checkbox"} name={`edit-${field.id}`} checked={choices.includes(option)} onChange={(event) => onChange(field.kind === "single" ? (event.target.checked ? [option] : []) : event.target.checked ? [...choices, option] : choices.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></fieldset>;
  }
  const rows = Array.isArray(value) ? value.filter((item): item is Record<string, string> => typeof item === "object" && item !== null) : [];
  return <fieldset className={`${styles.field} ${styles.tableField}`}><legend>{field.label}</legend><div className={styles.tableScroll}><table><thead><tr><th>项目</th>{field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}</tr></thead><tbody>{field.rows?.map((row, index) => { const current = rows[index] ?? { rowId: row.id }; return <tr key={row.id}><th>{row.label}</th>{field.columns?.map((column) => <td key={column.id}><textarea aria-label={`${row.label}：${column.label}`} maxLength={300} value={current[column.id] ?? ""} onChange={(event) => { const next = field.rows?.map((item, rowIndex) => ({ ...(rows[rowIndex] ?? { rowId: item.id }), rowId: item.id })) ?? []; next[index] = { ...current, rowId: row.id, [column.id]: event.target.value }; onChange(next); }} /></td>)}</tr>; })}</tbody></table></div></fieldset>;
}

function emptyAnswer(field: FirstGameField): FirstGameAnswer {
  if (field.kind === "single" || field.kind === "multi") return [];
  if (field.kind === "table") return field.rows?.map((row) => ({ rowId: row.id, ...Object.fromEntries((field.columns ?? []).map((column) => [column.id, ""])) })) ?? [];
  return "";
}
function cloneAnswer(answer: FirstGameAnswer): FirstGameAnswer { return JSON.parse(JSON.stringify(answer)) as FirstGameAnswer; }
function hasContent(value: FirstGameAnswer | undefined): value is FirstGameAnswer {
  if (typeof value === "string") return Boolean(value.trim());
  return Array.isArray(value) && value.some((item) => typeof item === "string" ? Boolean(item.trim()) : Object.entries(item).some(([key, cell]) => key !== "rowId" && Boolean(String(cell).trim())));
}
function formatTime(value: string) {
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return value;
  const shanghai = new Date(source.getTime() + 8 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${shanghai.getUTCFullYear()}年${shanghai.getUTCMonth() + 1}月${shanghai.getUTCDate()}日 ${pad(shanghai.getUTCHours())}:${pad(shanghai.getUTCMinutes())}`;
}
