"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FIRST_GAME_HOMEWORK_SECTIONS, FIRST_GAME_REQUIRED_FIELDS, type FirstGameAnswer, type FirstGameAnswers, type FirstGameField } from "../../lib/first-game-homework";
import { publicPath } from "../../lib/public-path";
import styles from "../homework.module.css";

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };
type SubmitResult = { submission: { id: string; respondentNickname: string; answeredCount: number; createdAt: string }; replayed: boolean };
const DRAFT_KEY = "minisv.homework.first-game.draft.v1";

export default function FirstGameHomeworkClient() {
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState("");
  const [answers, setAnswers] = useState<FirstGameAnswers>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const requestId = useRef(newRequestId());
  const loaded = useRef(false);
  const answered = useMemo(() => Object.values(answers).filter(hasContent).length, [answers]);
  const missingRequired = useMemo(() => FIRST_GAME_REQUIRED_FIELDS.filter((field) => !hasContent(answers[field.id] ?? "")), [answers]);
  const secondPartUnlocked = missingRequired.length === 0;
  const firstMissing = missingRequired[0];
  const firstMissingSection = firstMissing ? FIRST_GAME_HOMEWORK_SECTIONS.find((section) => section.fields.some((field) => field.id === firstMissing.id)) : undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as { nickname?: string; note?: string; answers?: FirstGameAnswers } | null;
        if (saved) { setNickname(saved.nickname ?? ""); setNote(saved.note ?? ""); setAnswers(saved.answers ?? {}); }
      } catch { /* A broken local draft must not block the public form. */ }
      loaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ nickname, note, answers })); } catch { /* Device storage may be unavailable; the live form still remains. */ }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [nickname, note, answers]);

  function setAnswer(id: string, value: FirstGameAnswer) { setAnswers((current) => ({ ...current, [id]: value })); }
  function clearDraft() {
    setNickname(""); setNote(""); setAnswers({}); setResult(null); setMessage(""); requestId.current = newRequestId();
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setResult(null);
    if (missingRequired.length) {
      const first = missingRequired[0];
      setMessage(`请先完成第一部分必填项：${first.label}。`);
      focusRequiredField(first.id);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(publicPath("/api/public/homework/first-game/submissions"), {
        method: "POST", credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ respondentNickname: nickname, respondentNote: note, answers, clientRequestId: requestId.current }),
      });
      const envelope = await response.json().catch(() => null) as Envelope<SubmitResult> | null;
      if (!response.ok || !envelope?.ok || !envelope.data) throw new Error(envelope?.error?.message ?? "没有收到保存确认，请稍后重试。");
      setResult(envelope.data); setMessage("已保存为一份新的独立作业。"); requestId.current = newRequestId();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "网络没有完成提交；你填写的内容仍在本页。请稍后重试。");
    } finally { setBusy(false); }
  }

  return <form className={styles.form} onSubmit={submit}>
    <section className={styles.identityPanel} aria-labelledby="identity-title">
      <div><small>00 · SELF-REPORTED</small><h2 id="identity-title">先留下这次作业的称呼</h2><p>不创建账号，也不会和同名学员自动绑定。请填写姓名或常用昵称，不要填写手机号、证件、住址、密码等敏感资料。</p></div>
      <label><span>姓名／昵称 <b className={styles.requiredMark} aria-label="必填">*</b></span><input value={nickname} required aria-required="true" maxLength={80} autoComplete="nickname" placeholder="例如：小航／星星队 2 号" onChange={(event) => setNickname(event.target.value)} /></label>
      <label>想让查看者知道的话（可选）<textarea value={note} maxLength={300} placeholder="例如：这是我的第一版想法，还会继续改。" onChange={(event) => setNote(event.target.value)} /></label>
    </section>
    <nav className={styles.sectionJump} aria-label="作业主题快速跳转">{FIRST_GAME_HOMEWORK_SECTIONS.map((section, index) => <a href={`#section-${section.id}`} key={section.id}>{String(index + 1).padStart(2, "0")}</a>)}</nav>
    <section className={styles.partStatus} data-unlocked={secondPartUnlocked} aria-live="polite">
      <div><small>第一部分 · 01—05</small><b>{FIRST_GAME_REQUIRED_FIELDS.length - missingRequired.length}/{FIRST_GAME_REQUIRED_FIELDS.length} 个必填项已完成</b>{firstMissing && <span>最前面的未完成项：{firstMissingSection?.title} → {firstMissing.label}</span>}</div>
      <div><p>{secondPartUnlocked ? "✓ 第一部分已完成，第二部分 06—11 已解锁。" : `第二部分尚未解锁：还差 ${missingRequired.length} 个必填项。`}</p>{firstMissing && <button type="button" onClick={() => focusRequiredField(firstMissing.id)}>去填写“{firstMissing.label}” ↑</button>}</div>
    </section>
    {FIRST_GAME_HOMEWORK_SECTIONS.map((section, index) => index >= 5 && !secondPartUnlocked ? <section className={`${styles.section} ${styles.lockedSection}`} id={`section-${section.id}`} data-locked="true" key={section.id}>
      <header><span>{section.level}</span><h2>{section.title}</h2><p>{section.intro}</p><button type="button" onClick={() => firstMissing && focusRequiredField(firstMissing.id)}>🔒 去补第一处未完成项</button></header>
    </section> : <details className={styles.section} id={`section-${section.id}`} key={section.id} open={index < 5}>
      <summary><span>{section.level}</span><h2>{section.title}</h2><p>{section.intro}</p><b>展开／收起</b></summary>
      <div className={styles.fields}>{section.fields.map((field) => <HomeworkFieldControl field={field} value={answers[field.id]} onChange={(value) => setAnswer(field.id, value)} key={field.id} />)}</div>
    </details>)}
    <section className={styles.submitDock}>
      <div><small>填写进度</small><b>{answered} 项已有内容</b><p>提交前请检查姓名／昵称和当前填写内容。</p></div>
      <div className={styles.submitActions}><button type="button" className={styles.secondaryButton} onClick={clearDraft} disabled={busy}>清空本机草稿</button><button type="submit" disabled={busy}>{busy ? "正在保存…" : "提交这次作业 →"}</button></div>
    </section>
    {message && <section className={result ? styles.success : styles.failure} role="status"><b>{result ? "提交成功" : "还没有提交成功"}</b><p>{message}</p>{result && <div><a href={publicPath(`/homework/first-game/submissions/${encodeURIComponent(result.submission.id)}/`)}>查看刚提交的完整内容 →</a><code>{result.submission.id}</code></div>}</section>}
  </form>;
}

function HomeworkFieldControl({ field, value, onChange }: { field: FirstGameField; value: FirstGameAnswer | undefined; onChange: (value: FirstGameAnswer) => void }) {
  const requiredMark = field.required ? <span className={styles.requiredMark} aria-label="必填">*</span> : null;
  const isMissing = Boolean(field.required && !hasContent(value ?? ""));
  if (field.kind === "short" || field.kind === "long") return <label className={styles.field} data-field-id={field.id} data-required-missing={field.required ? isMissing : undefined}><b>{field.label} {requiredMark}</b>{field.prompt && <small>{field.prompt}</small>}{field.kind === "long" ? <textarea value={typeof value === "string" ? value : ""} required={field.required} aria-required={field.required} maxLength={1200} onChange={(event) => onChange(event.target.value)} /> : <input value={typeof value === "string" ? value : ""} required={field.required} aria-required={field.required} maxLength={1200} onChange={(event) => onChange(event.target.value)} />}</label>;
  if (field.kind === "single" || field.kind === "multi") {
    const choices = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <fieldset className={styles.field} data-field-id={field.id} data-required-missing={field.required ? isMissing : undefined} aria-required={field.required}><legend>{field.label} {requiredMark}</legend><div className={styles.choices}>{field.options?.map((option, index) => <label key={option}><input type={field.kind === "single" ? "radio" : "checkbox"} name={field.kind === "single" ? field.id : undefined} required={field.kind === "single" && field.required && index === 0} checked={choices.includes(option)} onChange={(event) => onChange(field.kind === "single" ? (event.target.checked ? [option] : []) : event.target.checked ? [...choices, option] : choices.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></fieldset>;
  }
  const rows = Array.isArray(value) ? value.filter((item): item is Record<string, string> => typeof item === "object" && item !== null) : [];
  return <fieldset className={`${styles.field} ${styles.tableField}`}><legend>{field.label}</legend><div className={styles.tableScroll}><table><thead><tr><th>项目</th>{field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}</tr></thead><tbody>{field.rows?.map((row, index) => { const current = rows[index] ?? { rowId: row.id }; return <tr key={row.id}><th>{row.label}</th>{field.columns?.map((column) => <td key={column.id}><textarea aria-label={`${row.label}：${column.label}`} maxLength={300} value={current[column.id] ?? ""} onChange={(event) => { const next = field.rows?.map((item, rowIndex) => ({ ...(rows[rowIndex] ?? { rowId: item.id }), rowId: item.id })) ?? []; next[index] = { ...current, rowId: row.id, [column.id]: event.target.value }; onChange(next); }} /></td>)}</tr>; })}</tbody></table></div></fieldset>;
}

function hasContent(value: FirstGameAnswer): boolean {
  if (typeof value === "string") return Boolean(value.trim());
  return value.some((item) => typeof item === "string" ? Boolean(item.trim()) : Object.entries(item).some(([key, cell]) => key !== "rowId" && Boolean(String(cell).trim())));
}
function focusRequiredField(fieldId: string) {
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>(`[data-field-id="${fieldId}"]`);
    if (!field) return;
    const details = field.closest("details");
    if (details) details.open = true;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.querySelector<HTMLElement>("input, textarea, button, [tabindex]")?.focus({ preventScroll: true });
  }, 0);
}
function newRequestId() { return `first-game.${Date.now()}.${crypto.randomUUID()}`; }
