"use client";
import Link from "next/link";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { validateCoursePackage, type CoursePackage, type CoursePackageBlock, type CoursePackageRef } from "../lib/course-package";
import { buildStudioProjection, resolveLearnerPolicy, validateCourseInstantiation } from "../lib/course-platform";
import type { CoursewareSummary } from "../lib/courseware-store";
import { BrandHomeLink } from "../components/BrandHomeLink";
import styles from "./studio.module.css";

export type StudioSection = "home" | "editor" | "preview" | "courseware" | "releases";
type Version = { ref: CoursePackageRef; candidate: boolean; released: boolean; course: CoursePackage; learnerPolicy: ReturnType<typeof resolveLearnerPolicy> };
type Bootstrap = { user: { userId: string; displayName: string; role: string }; versions: Version[]; courseware: CoursewareSummary[]; receipts: Array<Record<string, unknown>> };

const NAV: Array<{ id: StudioSection; href: string; code: string; label: string }> = [
  { id: "home", href: "/studio/", code: "00", label: "工作台" },
  { id: "editor", href: "/studio/editor/", code: "01", label: "课程编辑器" },
  { id: "preview", href: "/studio/preview/", code: "02", label: "多角色预览" },
  { id: "courseware", href: "/studio/courseware/", code: "03", label: "导师课件库" },
  { id: "releases", href: "/studio/releases/", code: "04", label: "测试与发布" },
];

export default function StudioApp({ section, user }: { section: StudioSection; user: { userId: string; displayName: string; role: string } }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api<Bootstrap>("/api/studio/bootstrap")); setError(""); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  return <main className={styles.page}>
    <header className={styles.topbar}><BrandHomeLink className={styles.brand} title="Course Studio" /><div className={styles.user}><span><b>{user.displayName}</b><small>{user.role === "admin" ? "平台管理员" : "课程导师"}</small></span><Link href="/classroom/">进入课堂</Link></div></header>
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Course Studio"><p className={styles.navLabel}>COURSE FACTORY</p>{NAV.map((item) => item.id === "editor" ? <a key={item.id} href={item.href} data-active={section === item.id}><span>{item.code}</span>{item.label}</a> : <Link key={item.id} href={item.href} data-active={section === item.id}><span>{item.code}</span>{item.label}</Link>)}</nav>
      <section className={styles.content}>
        {error && <div className={styles.error} role="alert">{error}</div>}{notice && <div className={styles.notice} role="status">{notice}</div>}
        {loading && !data ? <div className={styles.loading}>正在读取唯一课程真值…</div> : data ? <>
          {section === "home" && <StudioHome data={data} />}
          {section === "editor" && <CourseEditor data={data} mode="edit" onSaved={async () => { setNotice("Candidate 已保存为不可变版本。正在刷新版本列表…"); await load(); }} onError={setError} />}
          {section === "preview" && <CourseEditor data={data} mode="preview" onSaved={load} onError={setError} />}
          {section === "courseware" && <CoursewareLibrary data={data} onChanged={async (message) => { setNotice(message); await load(); }} onError={setError} />}
          {section === "releases" && <Releases data={data} onChanged={async (message) => { setNotice(message); await load(); }} onError={setError} />}
        </> : null}
      </section>
    </div>
  </main>;
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className={styles.heading}><div><small>{eyebrow}</small><h1>{title}</h1><p>{children}</p></div><span className={styles.status}>唯一课程真值 · ONLINE</span></div>;
}

function StudioHome({ data }: { data: Bootstrap }) {
  const courseCount = new Set(data.versions.map((version) => version.ref.courseId)).size;
  const candidateCount = data.versions.filter((version) => version.candidate).length;
  const blockCounts = [...new Set(preferredVersions(data.versions).map((version) => version.course.blocks.length))].sort((left, right) => left - right);
  const blockSummary = blockCounts.length === 1 ? `${blockCounts[0]} 个 Block` : `${blockCounts.join("／")} 个 Block`;
  return <><Heading eyebrow="COURSE STUDIO · FACTORY CONTROL" title="课程工厂">从一份 CourseDefinition 保存 Candidate，用真实 Test Classroom 验收，再发布为不会影响既有课堂的 Released 版本。</Heading>
    <div className={styles.overviewGrid}>
      <article className={styles.overviewCard}><b>DEFINE · {courseCount} COURSES</b><h2>编辑唯一课程真值</h2><p>五步骤、{blockSummary}、导师任务、学员视角、卡组和人数策略都从同一个 JSON 产生。</p><a href="/studio/editor/">打开编辑器 →</a></article>
      <article className={styles.overviewCard}><b>TEST · {candidateCount} CANDIDATES</b><h2>直接看 4 + N + 1</h2><p>在当前页切换课程允许的人数、Block 和固定 seed；容量不足会指出具体卡组缺口。</p><Link href="/studio/preview/">打开只读预览 →</Link></article>
      <article className={styles.overviewCard}><b>SHIP · {data.courseware.length} COURSEWARE</b><h2>真实课堂后再发布</h2><p>Test 与 Production 共用工厂、API、界面和状态机。只有 exact 验收回执能解锁正式发布。</p><Link href="/studio/releases/">查看发布门 →</Link></article>
    </div>
    <section className={styles.panel}><h2>一条不可绕过的交付线</h2><div className={styles.flow}><span>CourseDefinition</span><i>→</i><span>Candidate</span><i>→</i><span>Test Classroom</span><i>→</i><span>验收回执</span><i>→</i><span>Released</span><i>→</i><span>Production Classroom</span></div></section>
  </>;
}

function preferredVersions(versions: Version[]): Version[] {
  const ids = [...new Set(versions.map((version) => version.ref.courseId))];
  return ids.map((id) => versions.find((version) => version.ref.courseId === id && version.candidate) ?? versions.find((version) => version.ref.courseId === id && version.released) ?? versions.find((version) => version.ref.courseId === id)!).filter(Boolean);
}

function CourseEditor({ data, mode, onSaved, onError }: { data: Bootstrap; mode: "edit" | "preview"; onSaved: () => Promise<void>; onError: (value: string) => void }) {
  const options = useMemo(() => preferredVersions(data.versions), [data.versions]);
  const [courseId, setCourseId] = useState(options[0]?.ref.courseId ?? "");
  const source = options.find((version) => version.ref.courseId === courseId) ?? options[0];
  const [course, setCourse] = useState<CoursePackage | null>(() => source ? structuredClone(source.course) : null);
  const [blockId, setBlockId] = useState("B01");
  const [learnerCount, setLearnerCount] = useState(source?.learnerPolicy.defaultCount ?? 4);
  const [seed, setSeed] = useState("review-seed-2026");
  const [raw, setRaw] = useState(course ? JSON.stringify(course, null, 2) : "");
  const [rawError, setRawError] = useState("");
  const [saving, setSaving] = useState(false);
  const chooseCourse = (nextCourseId: string) => {
    const nextSource = options.find((version) => version.ref.courseId === nextCourseId);
    setCourseId(nextCourseId);
    if (!nextSource) return;
    const next = structuredClone(nextSource.course);
    setCourse(next);
    setRaw(JSON.stringify(next, null, 2));
    setRawError("");
    setBlockId("B01");
    setLearnerCount(nextSource.learnerPolicy.defaultCount);
  };
  const blocks: CoursePackageBlock[] = course && Array.isArray(course.blocks)
    ? course.blocks.filter((item): item is CoursePackageBlock => Boolean(item) && typeof item === "object")
    : [];
  const block = blocks.find((item) => item?.id === blockId);
  const fallbackPolicy = source?.learnerPolicy ?? { defaultCount: 4, minCount: 2, maxCount: 4, cardsPerLearner: 3, dealPolicy: "unique-within-step" as const };
  const policy = course?.learnerPolicy
    && Number.isInteger(course.learnerPolicy.minCount)
    && Number.isInteger(course.learnerPolicy.maxCount)
    ? course.learnerPolicy
    : fallbackPolicy;
  const quickCounts = policy ? [2, 4, 6].filter((count) => count >= policy.minCount && count <= policy.maxCount) : [];
  const derived = useMemo(() => {
    if (!course) return { course: null, projection: null, validation: null, error: "没有可预览的 CourseDefinition。" };
    try {
      const validated = validateCoursePackage(course);
      return {
        course: validated,
        projection: buildStudioProjection(validated, { learnerCount, blockId, seed }),
        validation: validateCourseInstantiation(validated, learnerCount),
        error: "",
      };
    } catch (cause) {
      return { course: null, projection: null, validation: null, error: messageOf(cause) };
    }
  }, [course, learnerCount, blockId, seed]);
  const projection = derived.projection;
  const validation = derived.validation;
  const updateBlock = (field: "title" | "studentPrompt" | "world" | "say" | "ask" | "done" | "task", value: string) => {
    if (!course) return;
    const next = structuredClone(course); const target = next.blocks.find((item) => item.id === blockId)!;
    if (field === "title" || field === "studentPrompt") target[field] = value;
    else if (field === "task") target.learnerTaskTemplate = { badge: target.learnerTaskTemplate?.badge ?? "Young Builder", task: value };
    else target.learnerLens[field] = value;
    setCourse(next); setRaw(JSON.stringify(next, null, 2));
  };
  const enableDynamic = () => {
    if (!course) return; const next = structuredClone(course);
    next.learnerPolicy = { defaultCount: 4, minCount: 2, maxCount: 6, cardsPerLearner: 3, dealPolicy: "unique-within-step" };
    for (const item of next.blocks) item.learnerTaskTemplate ??= { badge: "Young Builder", task: item.studentPrompt };
    setCourse(next); setRaw(JSON.stringify(next, null, 2)); setLearnerCount(6);
  };
  if (!course) return <div className={styles.empty}>没有可编辑课程。</div>;
  return <><Heading eyebrow={mode === "edit" ? "EDITOR · SINGLE WRITE PATH" : "READ ONLY PREVIEW · 4 + N + 1"} title={mode === "edit" ? "课程编辑器" : "多角色预览"}>{mode === "edit" ? "编辑可见文案时，学员视图和中控会立即从同一对象重算；保存只会生成新 Candidate，不会修改正在运行的课堂。" : "这里不写入数据。用与 Classroom 相同的投影器检查每个角色此刻究竟看见什么。"}</Heading>
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.field}><label htmlFor="course-select">课程</label><select id="course-select" value={courseId} onChange={(event) => chooseCourse(event.target.value)}>{courseId && !options.some((item) => item.ref.courseId === courseId) && <option value={courseId}>导入待保存 · {courseId}</option>}{options.map((item) => <option key={item.ref.courseId} value={item.ref.courseId}>{item.course.title} · r{item.ref.revision}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="learner-count">预览学员人数</label><div className={styles.countButtons}>{quickCounts.map((count) => <button key={count} type="button" data-active={learnerCount === count} onClick={() => setLearnerCount(count)}>{count}</button>)}<input id="learner-count" aria-label="课程范围内的任意学员人数" type="number" min={policy?.minCount} max={policy?.maxCount} step="1" value={learnerCount} onChange={(event) => setLearnerCount(Number(event.target.value))} /></div><small>{policy?.minCount}—{policy?.maxCount} 人均可验证</small></div>
        <div className={styles.field}><label htmlFor="preview-seed">发牌 seed</label><input id="preview-seed" value={seed} onChange={(event) => setSeed(event.target.value)} /></div>
        {mode === "edit" && !course.learnerPolicy && blocks.length > 0 && <button className={styles.buttonSecondary} type="button" onClick={enableDynamic}>升级为 2—6 人课程</button>}
        {mode === "edit" && <><button className={styles.button} type="button" disabled={saving || Boolean(derived.error) || Boolean(rawError)} onClick={async () => { setSaving(true); try { await api("/api/studio/candidates", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({course}) }); await onSaved(); } catch(cause){ onError(messageOf(cause)); } finally{ setSaving(false); } }}>{saving ? "保存中…" : "保存 Candidate"}</button><button className={styles.buttonSecondary} type="button" disabled={Boolean(rawError)} onClick={() => downloadJson(course)} >导出 JSON</button><label className={styles.buttonSecondary}>导入 JSON<input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importJson(event, (next) => { setCourse(next); setRaw(JSON.stringify(next, null, 2)); setRawError(""); setCourseId(next.course?.id ?? ""); setBlockId(next.blocks?.[0]?.id ?? "B01"); setLearnerCount(resolveLearnerPolicy(next).defaultCount); }, onError)} /></label></>}
      </div>
      <div className={styles.timeline} aria-label={`${blocks.length} 个课程 Block`}>{blocks.map((item) => <button key={item.id} type="button" data-active={item.id === blockId} onClick={() => setBlockId(item.id)}><b>{item.id} · STEP {item.macroStepOrder}</b><span>{item.title}</span></button>)}</div>
      <div className={styles.workspace}>
        {mode === "edit" && block?.learnerLens && <aside className={styles.editorForm}><h2>{block.id} · 当前块字段</h2><label>Block 名称<input value={block.title ?? ""} onChange={(event) => updateBlock("title", event.target.value)} /></label><label>给学员的任务<textarea value={block.studentPrompt ?? ""} onChange={(event) => updateBlock("studentPrompt", event.target.value)} /></label><label>所有动态学员的任务模板<textarea value={block.learnerTaskTemplate?.task ?? block.studentPrompt ?? ""} onChange={(event) => updateBlock("task", event.target.value)} /></label><label>进入什么世界<textarea value={block.learnerLens.world ?? ""} onChange={(event) => updateBlock("world", event.target.value)} /></label><label>要说什么<textarea value={block.learnerLens.say ?? ""} onChange={(event) => updateBlock("say", event.target.value)} /></label><label>要问什么<textarea value={block.learnerLens.ask ?? ""} onChange={(event) => updateBlock("ask", event.target.value)} /></label><label>做到什么算完成<textarea value={block.learnerLens.done ?? ""} onChange={(event) => updateBlock("done", event.target.value)} /></label></aside>}
        <div className={styles.viewArea}>
          {derived.error || rawError ? <div className={styles.validation} data-ok={false} role="alert"><strong>⚠ CourseDefinition 还不能预览或保存</strong><p>{rawError || derived.error}</p><p>继续在左侧字段或下方完整 JSON 中修正；系统会保留文本，不会用上一次有效数据假装成功。</p></div> : validation && <div className={styles.validation} data-ok={validation.ok}><strong>{validation.ok ? `✓ ${learnerCount} 人实例可创建` : `⚠ ${learnerCount} 人实例暂不可创建`}</strong>{!validation.ok && <ul>{validation.issues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}</ul>}</div>}
          {projection ? <Projection projection={projection} /> : <div className={styles.empty}>修正上方错误后，4 + N + 1 视图会从当前 JSON 重新生成。</div>}
        </div>
      </div>
      {mode === "edit" && <details className={styles.raw} open={Boolean(rawError || derived.error)}><summary>高级：直接编辑完整 JSON</summary>{rawError && <p className={styles.rawError} role="alert">{rawError}</p>}<textarea aria-label="完整课程 JSON" value={raw} onChange={(event) => { const value=event.target.value; setRaw(value); try { const parsed=JSON.parse(value) as unknown;if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("顶层必须是 JSON 对象。");setCourse(parsed as CoursePackage); setRawError(""); onError(""); } catch (cause) { setRawError(`JSON 语法错误：${messageOf(cause)}`); } }} /></details>}
    </section>
  </>;
}

function Projection({ projection }: { projection: ReturnType<typeof buildStudioProjection> }) {
  return <div className={styles.viewGrid}>{projection.mentorViews.map((view) => <article className={styles.viewCard} data-active={view.activity === "active"} data-kind="mentor" key={view.seatId}><small>{view.seatId.toUpperCase()} · {view.mentorRole} 导师</small><h3>{view.label}</h3><span className={styles.badge}>{view.activity === "active" ? "本块主导" : view.activity === "support" ? "观察支援" : "待命"}</span><p>{view.task}</p></article>)}{projection.learnerViews.map((view) => <article className={styles.viewCard} data-kind="learner" key={view.seatId}><small>{view.seatId.toUpperCase()} · 私人任务视角</small><h3>{view.label}</h3><p>{view.task}</p><div className={styles.cards}>{view.privateCards.map((card) => <span key={card.id}>{card.boundary} · {card.title}</span>)}{!view.privateCards.length && <span>卡组容量不足：不会伪造手牌</span>}</div></article>)}<article className={styles.controller}><div><small>CONTROLLER · {projection.controllerView.blockId}</small><h3>{projection.controllerView.title}</h3><b>主导：{projection.controllerView.leadMentorId}</b></div><div><small>系统动作</small><ul>{projection.controllerView.systemActions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><small>本块验收</small><ul>{projection.controllerView.acceptance.map((item) => <li key={item}>{item}</li>)}</ul></div></article></div>;
}

function CoursewareLibrary({ data, onChanged, onError }: { data: Bootstrap; onChanged: (message: string) => Promise<void>; onError: (value: string) => void }) {
  const [form, setForm] = useState({ packageId: "", title: "", slug: "", mentorRole: "P", html: "" });
  const [working, setWorking] = useState(false);
  const editable = data.courseware.filter((item) => item.contentKind === "inline-html" && (data.user.role === "admin" || item.ownerProfileId === data.user.userId));
  const choosePackage = (packageId: string) => {
    const item = editable.find((entry) => entry.packageId === packageId);
    setForm(item
      ? { packageId: item.packageId, title: item.title, slug: item.slug, mentorRole: item.mentorRole, html: "" }
      : { packageId: "", title: "", slug: "", mentorRole: "P", html: "" });
  };
  const save = async () => {
    setWorking(true);
    onError("");
    try {
      const body = { title: form.title, slug: form.slug, mentorRole: form.mentorRole, html: form.html, ...(form.packageId ? { packageId: form.packageId } : {}) };
      await api("/api/studio/courseware", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const verb = form.packageId ? "新版本已保存" : "课件已创建";
      setForm({ packageId: "", title: "", slug: "", mentorRole: "P", html: "" });
      await onChanged(`${verb}；发布前请先打开 exact 预览。`);
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setWorking(false);
    }
  };
  return <>
    <Heading eyebrow="COURSEWARE LIBRARY · EXACT VERSION" title="导师课件库">课件不是课程真值。它由 P／D／M／O 导师独立制作，在开课前绑定 exact 版本，课堂中可随时从角色卡打开。</Heading>
    <section className={styles.panel}>
      <h2>已安装课件</h2>
      <div className={styles.coursewareGrid}>{data.courseware.map((item) => {
        const canManage = data.user.role === "admin" || item.ownerProfileId === data.user.userId;
        return <article className={styles.coursewareCard} data-role={item.mentorRole} key={item.packageId}>
          <header><div><small>{item.mentorRole} · MENTOR COURSEWARE</small><h3>{item.title}</h3></div><span className={styles.badge}>{item.releasedRevision === item.latestRevision ? "已发布" : "有新版本"}</span></header>
          <div className={styles.meta}>/{item.slug}/ · r{item.latestRevision}<br />{item.latestDigest.slice(0, 16)}… · {item.contentKind}</div>
          <div className={styles.actions}>
            <Link href={`/course/${item.slug}/?revision=${item.latestRevision}`} target="_blank" rel="noopener noreferrer">打开 exact 预览 ↗</Link>
            {canManage && item.contentKind === "inline-html" && <button className={styles.buttonSecondary} type="button" onClick={() => choosePackage(item.packageId)}>创建下一版本</button>}
            {canManage && item.releasedRevision !== item.latestRevision && <button className={styles.button} type="button" onClick={async () => {
              try {
                await api("/api/studio/courseware/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: item.packageId, revision: item.latestRevision, digest: item.latestDigest }) });
                await onChanged(`${item.title} r${item.latestRevision} 已发布。`);
              } catch (cause) { onError(messageOf(cause)); }
            }}>发布此版本</button>}
          </div>
        </article>;
      })}</div>
    </section>
    <section className={styles.panel}>
      <h2>{form.packageId ? "为既有课件创建不可变新版本" : "上传一份新的单文件 HTML 课件"}</h2>
      <p className={styles.panelIntro}>系统保存不可变版本并用隔离策略播放。支持 CSS 和页面内交互脚本；课件不能读取 MiniSV 账号或课堂数据。已绑定课堂不会跟随新版本变化。</p>
      <div className={styles.coursewareForm}>
        <label className={styles.wide}>操作方式<select value={form.packageId} onChange={(event) => choosePackage(event.target.value)}><option value="">创建一套新课件</option>{editable.map((item) => <option value={item.packageId} key={item.packageId}>更新：{item.title} · 当前 r{item.latestRevision}</option>)}</select></label>
        <label>导师角色<select disabled={Boolean(form.packageId)} value={form.mentorRole} onChange={(event) => setForm({ ...form, mentorRole: event.target.value })}><option value="P">P · 产品</option><option value="D">D · 开发</option><option value="M">M · 市场</option><option value="O">O · 运营</option></select></label>
        <label>课件标题<input disabled={Boolean(form.packageId)} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>URL slug<input disabled={Boolean(form.packageId)} placeholder="mvp-prototyping" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
        <label>选择新版 .html 文件<input type="file" accept="text/html,.html" onChange={(event) => void readHtml(event, (html) => setForm((current) => ({ ...current, html })), onError)} /></label>
        <label className={styles.wide}>HTML 内容<textarea value={form.html} onChange={(event) => setForm({ ...form, html: event.target.value })} /></label>
        <div className={`${styles.actions} ${styles.wide}`}><button className={styles.button} disabled={working || !form.html} type="button" onClick={save}>{working ? "保存中…" : form.packageId ? "保存为下一不可变版本" : "创建课件版本"}</button>{form.packageId && <button className={styles.buttonSecondary} type="button" onClick={() => choosePackage("")}>取消更新</button>}</div>
      </div>
    </section>
  </>;
}
function Releases({ data, onChanged, onError }: { data: Bootstrap; onChanged: (message: string) => Promise<void>; onError: (value: string) => void }) {
  return <><Heading eyebrow="RELEASE GATE · REAL CLASSROOM FIRST" title="测试与发布">Preview 只检查投影。Candidate 必须在真实 Test Classroom 中走完同一套 UI 和状态机，回执 exact 匹配后才能发布。</Heading><section className={styles.panel}><div className={styles.releaseGrid}>{data.versions.map((version) => { const receipt=data.receipts.find((item)=>item.course_id===version.ref.courseId&&item.revision===version.ref.revision&&item.digest===version.ref.digest&&item.status==="accepted"); return <article className={styles.releaseCard} key={`${version.ref.courseId}:${version.ref.revision}`}><header><div><small>{version.ref.courseId} · r{version.ref.revision}</small><h3>{version.course.title}</h3></div><span className={styles.badge}>{version.released?"RELEASED":version.candidate?"CANDIDATE":"HISTORY"}</span></header><p className={styles.meta}>{version.ref.digest}</p>{receipt?<div className={styles.receipt}>✓ Test Classroom 已验收<br /><small>{String(receipt.room_id)}</small></div>:version.candidate?<div className={styles.receipt}>等待真实 Test Classroom 完成并签发回执。</div>:null}<div className={styles.actions}>{version.candidate&&<Link href={`/classroom/?course=${encodeURIComponent(version.ref.courseId)}&revision=${version.ref.revision}`}>创建 Test Classroom →</Link>}{version.candidate&&receipt&&<button className={styles.button} type="button" onClick={async()=>{try{await api("/api/studio/releases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseRef:version.ref,receiptId:receipt.id})});await onChanged(`${version.course.title} r${version.ref.revision} 已发布。`);}catch(cause){onError(messageOf(cause));}}}>发布到 Production</button>}</div></article>; })}</div></section></>;
}

async function api<T=unknown>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{...init,credentials:"same-origin",headers:{Accept:"application/json",...(init?.headers??{})}});const body=await response.json() as {ok:boolean;data?:T;error?:{message?:string}};if(!response.ok||!body.ok)throw new Error(body.error?.message??"操作失败。");return body.data as T;}
function messageOf(value:unknown){return value instanceof Error?value.message:"操作失败，请重试。";}
function downloadJson(course:CoursePackage){const blob=new Blob([`${JSON.stringify(course,null,2)}\n`],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`${course.course?.id||"course-definition"}.json`;link.click();URL.revokeObjectURL(url);}
async function importJson(event:ChangeEvent<HTMLInputElement>,onRead:(value:CoursePackage)=>void,onError:(value:string)=>void){const file=event.target.files?.[0];if(!file)return;try{const text=await file.text();const course=JSON.parse(text) as CoursePackage;if(!course||typeof course!=="object"||Array.isArray(course))throw new Error("顶层必须是 JSON 对象。");onRead(course);}catch(cause){onError(`导入失败：${messageOf(cause)}`);}finally{event.target.value="";}}
async function readHtml(event:ChangeEvent<HTMLInputElement>,onRead:(value:string)=>void,onError:(value:string)=>void){const file=event.target.files?.[0];if(!file)return;try{onRead(await file.text());}catch(cause){onError(`读取失败：${messageOf(cause)}`);}finally{event.target.value="";}}
