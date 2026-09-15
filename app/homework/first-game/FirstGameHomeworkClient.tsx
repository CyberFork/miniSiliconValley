"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FIRST_GAME_HOMEWORK_SECTIONS, type FirstGameAnswer, type FirstGameAnswers, type FirstGameField } from "../../lib/first-game-homework";
import { publicPath } from "../../lib/public-path";
import styles from "../homework.module.css";

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };
type SubmitResult = { submission: { id: string; respondentNickname: string; answeredCount: number; imageCount: number; createdAt: string }; replayed: boolean };
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
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ nickname, note, answers })); } catch { /* Large image drafts may exceed device storage; live form still remains. */ }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [nickname, note, answers]);

  function setAnswer(id: string, value: FirstGameAnswer) { setAnswers((current) => ({ ...current, [id]: value })); }
  function clearDraft() {
    setNickname(""); setNote(""); setAnswers({}); setResult(null); setMessage(""); requestId.current = newRequestId();
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setResult(null);
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
    {FIRST_GAME_HOMEWORK_SECTIONS.map((section, index) => <details className={styles.section} id={`section-${section.id}`} key={section.id} open={index < 5}>
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
  if (field.kind === "short" || field.kind === "long") return <label className={styles.field}><b>{field.label}</b>{field.prompt && <small>{field.prompt}</small>}{field.kind === "long" ? <textarea value={typeof value === "string" ? value : ""} maxLength={1200} onChange={(event) => onChange(event.target.value)} /> : <input value={typeof value === "string" ? value : ""} maxLength={1200} onChange={(event) => onChange(event.target.value)} />}</label>;
  if (field.kind === "single" || field.kind === "multi") {
    const choices = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <fieldset className={styles.field}><legend>{field.label}</legend><div className={styles.choices}>{field.options?.map((option) => <label key={option}><input type={field.kind === "single" ? "radio" : "checkbox"} name={field.kind === "single" ? field.id : undefined} checked={choices.includes(option)} onChange={(event) => onChange(field.kind === "single" ? (event.target.checked ? [option] : []) : event.target.checked ? [...choices, option] : choices.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></fieldset>;
  }
  if (field.kind === "image") return <ImageField field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />;
  const rows = Array.isArray(value) ? value.filter((item): item is Record<string, string> => typeof item === "object" && item !== null) : [];
  return <fieldset className={`${styles.field} ${styles.tableField}`}><legend>{field.label}</legend><div className={styles.tableScroll}><table><thead><tr><th>项目</th>{field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}</tr></thead><tbody>{field.rows?.map((row, index) => { const current = rows[index] ?? { rowId: row.id }; return <tr key={row.id}><th>{row.label}</th>{field.columns?.map((column) => <td key={column.id}><textarea aria-label={`${row.label}：${column.label}`} maxLength={300} value={current[column.id] ?? ""} onChange={(event) => { const next = field.rows?.map((item, rowIndex) => ({ ...(rows[rowIndex] ?? { rowId: item.id }), rowId: item.id })) ?? []; next[index] = { ...current, rowId: row.id, [column.id]: event.target.value }; onChange(next); }} /></td>)}</tr>; })}</tbody></table></div></fieldset>;
}

function ImageField({ field, value, onChange }: { field: FirstGameField; value: string; onChange: (value: FirstGameAnswer) => void }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setWorking(true); setError("");
    try { onChange(await compressImage(file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "图片没有处理成功。"); }
    finally { setWorking(false); event.target.value = ""; }
  }
  return <fieldset className={`${styles.field} ${styles.imageField}`}><legend>{field.label}</legend>{field.prompt && <small>{field.prompt}</small>}<div>{value ? <Image src={value} width={1200} height={900} unoptimized alt={`${field.label}预览`} /> : <span className={styles.imageBlank}>＋<small>还没有图片</small></span>}<label className={styles.uploadButton}>{working ? "正在压缩…" : value ? "更换图片" : "拍照或选择图片"}<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" disabled={working} onChange={(event) => void select(event)} /></label>{value && <button type="button" className={styles.removeImage} onClick={() => onChange("")}>移除图片</button>}</div>{error && <p className={styles.inlineError}>{error}</p>}<p className={styles.help}>设备会自动缩小图片；仅接受 PNG、JPEG、WebP，不接受 SVG 或可执行文件。</p></fieldset>;
}

async function compressImage(file: File): Promise<string> {
  if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) throw new Error("请选择 PNG、JPEG 或 WebP 图片。");
  if (file.size <= 170_000) return readImageAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width; let height = bitmap.height; const maxSide = 1280;
  if (Math.max(width, height) > maxSide) { const ratio = maxSide / Math.max(width, height); width = Math.round(width * ratio); height = Math.round(height * ratio); }
  const canvas = document.createElement("canvas"); const context = canvas.getContext("2d");
  if (!context) throw new Error("这台设备暂时不能处理图片。");
  for (const [scale, quality] of [[1, .78], [.82, .68], [.68, .58], [.52, .5]] as const) {
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", quality); if (data.length * .75 <= 175_000) { bitmap.close(); return data; }
  }
  bitmap.close(); throw new Error("图片仍然太大，请裁剪后再上传。");
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片没有读取成功。"));
    reader.onerror = () => reject(new Error("图片没有读取成功。"));
    reader.readAsDataURL(file);
  });
}

function hasContent(value: FirstGameAnswer): boolean {
  if (typeof value === "string") return Boolean(value.trim());
  return value.some((item) => typeof item === "string" ? Boolean(item.trim()) : Object.entries(item).some(([key, cell]) => key !== "rowId" && Boolean(String(cell).trim())));
}
function newRequestId() { return `first-game.${Date.now()}.${crypto.randomUUID()}`; }
