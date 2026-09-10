"use client";

import Link from "../components/NavigationLink";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { BrandHomeLink } from "../components/BrandHomeLink";
import { AccountMenu, type AccountMenuUser } from "../components/AccountMenu";
import type {
  AcceptanceClassroomSummary,
  StudioUiAcceptanceSummary,
  StudioViewAcceptanceSummary,
  ViewAcceptanceReceipt,
} from "../lib/course-acceptance";
import type { CourseContentReviewDisposition, CourseContentReviewState } from "../lib/course-content-review";
import type { ParentQaReviewSnapshot } from "../lib/parent-qa-review-client";
import { courseDataIdForRef, type CoursePackage, type CoursePackageRef } from "../lib/course-package";
import { buildStudioProjection, resolveLearnerPolicy, validateCourseInstantiation } from "../lib/course-platform";
import type { CoursewareSummary } from "../lib/courseware-store";
import styles from "./studio.module.css";

export type StudioSection = "home" | "editor" | "preview" | "reviews" | "courseware" | "releases";

type Version = {
  ref: CoursePackageRef;
  candidate: boolean;
  released: boolean;
  course: CoursePackage;
  learnerPolicy: ReturnType<typeof resolveLearnerPolicy>;
};

type Bootstrap = {
  user: { userId: string; displayName: string; role: string };
  versions: Version[];
  courseware: CoursewareSummary[];
  viewReceipts: StudioViewAcceptanceSummary[];
  uiReceipts: StudioUiAcceptanceSummary[];
  acceptanceClassrooms: AcceptanceClassroomSummary[];
  contentReviews: CourseContentReviewState[];
  acceptanceRuntime: {
    projectorVersion: string;
    projectorContractVersion: string;
    runtimeContractVersion: string;
    sourceCommit: string;
    appBuildId: string;
  };
};

type InitialCourseRef = { courseId: string; revision: number; digest?: string } | null;
type PreparedBundleFile = { file: File; path: string; digest: string };
const COURSEWARE_UPLOAD_CHUNK_BYTES = 180 * 1024;

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ id?: StudioSection; href: string; code: string; label: string }>;
}> = [
  {
    label: "课程生产",
    items: [
      { id: "home", href: "/studio/", code: "00", label: "课程工作台" },
      { id: "editor", href: "/studio/editor/", code: "01", label: "课程编辑器" },
      { id: "preview", href: "/studio/preview/", code: "02", label: "多角色视图验收" },
      { id: "reviews", href: "/studio/reviews/", code: "03", label: "人工审核工作台" },
      { id: "releases", href: "/studio/releases/", code: "04", label: "验收与发布" },
    ],
  },
  {
    label: "资源管理",
    items: [
      { id: "courseware", href: "/studio/courseware/", code: "05", label: "导师课件库" },
      { href: "/course/", code: "06", label: "导师课件播放" },
    ],
  },
  {
    label: "课堂交付",
    items: [{ href: "/classroom/", code: "07", label: "课堂中心" }],
  },
];

const SECTION_TITLES: Record<StudioSection, string> = {
  home: "课程生产工作台",
  editor: "课程编排工作台",
  preview: "多角色视图验收",
  reviews: "人工审核工作台",
  courseware: "导师课件库",
  releases: "验收与发布",
};

export default function StudioApp({
  section,
  user,
  initialCourseRef = null,
}: {
  section: StudioSection;
  user: AccountMenuUser;
  initialCourseRef?: InitialCourseRef;
}) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Bootstrap>("/api/studio/bootstrap?scope=current"));
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changed = async (message: string) => {
    setNotice(message);
    await load();
  };

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <BrandHomeLink className={styles.brand} title="Course Studio" />
      <div className={styles.user}>
        <Link href="/classroom/">课堂中心</Link>
        <AccountMenu user={user} returnTo={`/studio/${section === "home" ? "" : `${section}/`}`} />
      </div>
    </header>
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Course Studio">
        <p className={styles.navLabel}>COURSE FACTORY</p>
        {NAV_GROUPS.map((group) => <div className={styles.navGroup} key={group.label}>
          <b>{group.label}</b>
          {group.items.map((item) => <Link
            key={item.href}
            href={item.href}
            data-active={item.id === section}
            aria-current={item.id === section ? "page" : undefined}
          ><span>{item.code}</span>{item.label}</Link>)}
        </div>)}
      </nav>
      <section className={styles.content}>
        {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div>}
        {notice && <div className={styles.notice} role="status">{notice}</div>}
        {loading && !data ? <div className={styles.loading} role="status"><small>COURSE STUDIO · 正在打开</small><h1>{SECTION_TITLES[section]}</h1><p>正在读取课程版本与两级验收门禁…</p></div> : data ? <>
          {section === "home" && <StudioHome data={data} />}
          {section === "preview" && <ViewAcceptance key={initialCourseRef ? `${initialCourseRef.courseId}:${initialCourseRef.revision}:${initialCourseRef.digest ?? ""}` : "current"} data={data} initialCourseRef={initialCourseRef} onAccepted={changed} onError={setError} />}
          {section === "reviews" && <HumanReviewWorkbench data={data} onChanged={changed} onError={setError} />}
          {section === "courseware" && <CoursewareLibrary data={data} onChanged={changed} onError={setError} />}
          {section === "releases" && <Releases data={data} onChanged={changed} onError={setError} />}
        </> : null}
      </section>
    </div>
  </main>;
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className={styles.heading}>
    <div><small>{eyebrow}</small><h1>{title}</h1><p>{children}</p></div>
    <span className={styles.status}>两次验收 · 一次发布</span>
  </div>;
}

function StudioHome({ data }: { data: Bootstrap }) {
  const versions = preferredVersions(data.versions);
  const candidateCount = versions.filter((version) => version.candidate).length;
  const validViewCount = data.viewReceipts.filter((receipt) => receipt.valid).length;
  const validUiCount = data.uiReceipts.filter((receipt) => receipt.valid).length;
  return <>
    <Heading eyebrow="COURSE STUDIO · DELIVERY PIPELINE" title="课程生产工作台">
      一份 CourseDefinition 先验收多角色数据视图，再用真实 Test Classroom 验收 UI；两张 exact 回执齐全后才允许发布和创建正式课堂。
    </Heading>
    <div className={styles.overviewGrid}>
      <article className={styles.overviewCard}><b>01 · EDIT · {candidateCount} CANDIDATES</b><h2>编辑并保存 Candidate</h2><p>课程编辑器是唯一正文写入口。每次保存生成不可变 revision 与 digest，不热更新任何课堂。</p><Link href="/studio/editor/">打开课程编辑器 →</Link></article>
      <article className={styles.overviewCard}><b>02 · VIEW · {validViewCount} PASSED</b><h2>验收 4 + N + 1</h2><p>逐 Block、逐支持人数检查四导师、N 学员、私密卡与中控投影，并签发 ViewAcceptanceReceipt。</p><Link href="/studio/preview/">开始多角色视图验收 →</Link></article>
      <article className={styles.overviewCard}><b>03—05 · UI · {validUiCount} PASSED</b><h2>真实课堂后再发布</h2><p>创建 Test Classroom、跑完真实 UI、签发 UiAcceptanceReceipt，再推进 Released 与 Production。</p><Link href="/studio/releases/">打开验收与发布 →</Link></article>
    </div>
    <section className={styles.panel}>
      <h2>不可跳过的生产线</h2>
      <div className={styles.flow} aria-label="课程生产流程">
        <span>① 编辑课程</span><i>→</i><span>② 验收多角色视图</span><i>→</i><span>③ 验收真实课堂 UI</span><i>→</i><span>④ 发布正式版本</span><i>→</i><span>⑤ 创建正式课堂</span>
      </div>
      <p className={styles.panelIntro}>导师课件库是并行资源线：四套 P／D／M／O exact 课件必须在创建 Test Classroom 前汇合。</p>
    </section>
    <PipelineList data={data} versions={versions} />
  </>;
}

function PipelineList({ data, versions }: { data: Bootstrap; versions: Version[] }) {
  return <section className={styles.panel}>
    <h2>当前版本门禁</h2>
    <div className={styles.pipelineList}>{versions.map((version) => {
      const status = pipelineStatus(data, version);
      return <article className={styles.pipelineRow} key={versionKey(version)}>
        <div><b>{version.course.course.name}</b><small>{refLabel(version.ref)}</small></div>
        <Gate passed={Boolean(status.view)} label="视图验收" />
        <Gate passed={Boolean(status.ui)} label="UI 验收" />
        <Gate passed={version.released} label="Released" />
        <strong>{status.nextLabel}</strong>
      </article>;
    })}</div>
  </section>;
}

function ViewAcceptance({ data, initialCourseRef, onAccepted, onError }: {
  data: Bootstrap;
  initialCourseRef: InitialCourseRef;
  onAccepted: (message: string) => Promise<void>;
  onError: (value: string) => void;
}) {
  const options = useMemo(() => {
    const preferred = preferredVersions(data.versions);
    // A current Released snapshot may also be opened explicitly while a newer
    // Candidate exists. Do not silently substitute that Candidate's content.
    const requested = data.versions.find((version) => matchesInitial(version, initialCourseRef) && (version.candidate || version.released));
    return requested && !preferred.some((version) => versionKey(version) === versionKey(requested)) ? [requested, ...preferred] : preferred;
  }, [data.versions, initialCourseRef]);
  const initial = initialCourseRef ? options.find((version) => matchesInitial(version, initialCourseRef)) : options[0];
  const [courseKey, setCourseKey] = useState(initial ? versionKey(initial) : "");
  const source = options.find((version) => versionKey(version) === courseKey);
  const [blockId, setBlockId] = useState(source?.course.blocks[0]?.id ?? "B01");
  const [learnerCount, setLearnerCount] = useState(source?.learnerPolicy.defaultCount ?? 4);
  const [seed, setSeed] = useState(source ? `view-acceptance-${source.learnerPolicy.defaultCount}` : "view-acceptance-4");
  const [reviewedBlocks, setReviewedBlocks] = useState<string[]>(source?.course.blocks[0]?.id ? [source.course.blocks[0].id] : []);
  const [reviewedCounts, setReviewedCounts] = useState<number[]>(source ? [source.learnerPolicy.defaultCount] : []);
  const [accepting, setAccepting] = useState(false);
  const chooseBlock = useCallback((nextBlockId: string) => {
    setBlockId(nextBlockId);
    setReviewedBlocks((current) => current.includes(nextBlockId) ? current : [...current, nextBlockId]);
  }, []);
  useEffect(() => {
    if (!source) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.matches("input, select, textarea, [contenteditable='true'], [role='textbox']") || target.closest("input, select, textarea, [contenteditable='true'], [role='textbox']"))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const index = source.course.blocks.findIndex((block) => block.id === blockId);
      const next = event.key === "Home" ? 0 : event.key === "End" ? source.course.blocks.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1);
      if (next < 0 || next >= source.course.blocks.length || next === index) return;
      event.preventDefault();
      chooseBlock(source.course.blocks[next].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [blockId, chooseBlock, source]);
  if (!source) return <div className={styles.empty} role="alert"><p>{initialCourseRef
    ? `请求的课程 ${initialCourseRef.courseId} r${initialCourseRef.revision} 不存在、digest 不匹配或已不是可验收版本；没有自动切换到其他课程。`
    : "没有可验收的 Candidate 或 Released 课程版本。"}</p><Link href="/studio/releases/">返回验收与发布，选择当前版本 →</Link></div>;

  const course = source.course;
  const requiredCounts = Array.from({ length: source.learnerPolicy.maxCount - source.learnerPolicy.minCount + 1 }, (_, index) => source.learnerPolicy.minCount + index);
  const existing = findViewReceipt(data, source.ref);
  const validation = validateCourseInstantiation(course, learnerCount);
  const projection = buildStudioProjection(course, { learnerCount, blockId, seed });
  const courseDataId = courseDataIdForRef(source.ref);
  const exactTestClassrooms = data.acceptanceClassrooms.filter((room) => room.environment === "test" && !room.archivedAt && sameRef(room.courseRef, source.ref));
  const archivedExactTests = data.acceptanceClassrooms.filter((room) => room.environment === "test" && room.archivedAt && sameRef(room.courseRef, source.ref));
  const exactContentReviews = data.contentReviews.filter((state) => sameRef(state.courseRef, source.ref));
  const blocksComplete = course.blocks.every((block) => reviewedBlocks.includes(block.id));
  const countsComplete = requiredCounts.every((count) => reviewedCounts.includes(count));

  const chooseVersion = (nextKey: string) => {
    const next = options.find((version) => versionKey(version) === nextKey);
    setCourseKey(nextKey);
    if (!next) return;
    const firstBlock = next.course.blocks[0]?.id ?? "B01";
    setBlockId(firstBlock);
    setLearnerCount(next.learnerPolicy.defaultCount);
    setSeed(`view-acceptance-${next.learnerPolicy.defaultCount}`);
    setReviewedBlocks(firstBlock ? [firstBlock] : []);
    setReviewedCounts([next.learnerPolicy.defaultCount]);
    onError("");
  };
  const chooseCount = (count: number) => {
    setLearnerCount(count);
    setSeed(`view-acceptance-${count}`);
    setReviewedCounts((current) => current.includes(count) ? current : [...current, count]);
  };
  const accept = async () => {
    setAccepting(true);
    onError("");
    try {
      const receipt = await api<ViewAcceptanceReceipt>("/api/studio/view-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseRef: source.ref, reviewedBlockIds: reviewedBlocks, reviewedLearnerCounts: reviewedCounts }),
      });
      await onAccepted(`多角色视图验收已通过：${receipt.receiptId}。下一步创建真实 UI 验收课堂。`);
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setAccepting(false);
    }
  };

  return <>
    <Heading eyebrow="VIEW ACCEPTANCE · SAVED CANDIDATE ONLY" title="多角色视图验收">
      这是内部内容验收；最终 UI 在 Test Classroom 验收。这里仅读取已保存的 exact 版本，不读取编辑器 Working Copy，也不写入课堂状态。亲自检查完全部 Block 与支持人数后，系统再重跑完整矩阵并签发不可变回执。
    </Heading>
    <section className={styles.panel}>
      <div className={styles.acceptanceHeader}>
        <label className={styles.field}>验收课程 exact 版本<select value={versionKey(source)} onChange={(event) => chooseVersion(event.target.value)}>{options.map((version) => <option key={versionKey(version)} value={versionKey(version)}>{version.course.course.name} · r{version.ref.revision} · {version.candidate ? "Candidate" : "Released"}</option>)}</select></label>
        <div className={styles.exactRef}><b>{source.candidate ? "CANDIDATE" : "RELEASED"} · r{source.ref.revision}</b><code>{courseDataId}</code><code>{source.ref.digest}</code><small>投影契约 {data.acceptanceRuntime.projectorContractVersion} · 运行契约 {data.acceptanceRuntime.runtimeContractVersion} · {exactTestClassrooms.length} 场活跃 exact Test Classroom{archivedExactTests.length ? ` · ${archivedExactTests.length} 场已归档` : ""}</small><small>源码 {data.acceptanceRuntime.sourceCommit} · 构建 {data.acceptanceRuntime.appBuildId}</small></div>
      </div>
      {exactTestClassrooms.length > 0 && <div className={styles.acceptedBanner}><b>同一数据快照的 Test Classroom</b><span>这里与课堂中控／席位使用相同 revision + digest；实际发牌 seed 只在课堂创建后产生。</span>{exactTestClassrooms.map((room) => <Link key={room.roomId} href={`/classroom/${room.roomId}/control`}>{room.roomId.slice(0, 8)} · {room.lifecycle} →</Link>)}</div>}
      {existing ? <div className={styles.acceptedBanner}><b>✓ 视图验收已通过</b><span>{existing.receiptId} · {new Date(existing.acceptedAt).toLocaleString("zh-CN")}</span><Link href={factoryHref("test", source.ref, existing.receiptId)}>创建 UI 验收课堂 →</Link></div> : <div className={styles.reviewProgress}>
        <div><b>{reviewedBlocks.length}/{course.blocks.length}</b><span>Block 已查看</span></div>
        <div><b>{reviewedCounts.filter((count) => requiredCounts.includes(count)).length}/{requiredCounts.length}</b><span>人数场景已查看</span></div>
        <div><b>{validation.ok ? "PASS" : "BLOCKED"}</b><span>当前投影</span></div>
      </div>}
      <div className={styles.toolbar}>
        <div className={styles.field}><span className={styles.label}>必须查看的学员人数</span><div className={styles.countButtons}>{requiredCounts.map((count) => <button key={count} type="button" data-active={learnerCount === count} data-reviewed={reviewedCounts.includes(count)} onClick={() => chooseCount(count)}>{count}{reviewedCounts.includes(count) ? " ✓" : ""}</button>)}</div></div>
        <div className={styles.field}><label htmlFor="view-seed">固定验收 seed</label><input id="view-seed" value={seed} readOnly /></div>
      </div>
      <div className={styles.timeline} aria-label={`${course.blocks.length} 个课程 Block`}>{course.blocks.map((block) => <button key={block.id} type="button" data-active={block.id === blockId} data-reviewed={reviewedBlocks.includes(block.id)} onClick={() => chooseBlock(block.id)}><b>{block.id} · STEP {block.macroStepOrder}</b><span>{block.title}</span>{reviewedBlocks.includes(block.id) && <em>已查看</em>}</button>)}</div>
      <div className={styles.validation} data-ok={validation.ok}><strong>{validation.ok ? `✓ ${learnerCount} 人投影通过容量校验` : `⚠ ${learnerCount} 人投影不能验收`}</strong>{!validation.ok && <ul>{validation.issues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}</ul>}</div>
      {exactContentReviews.length > 0 && <details className={styles.contentReviewQueue}>
        <summary>内容人工审核 · {exactContentReviews.filter((item) => item.releaseBlocking).length} 项明确阻断 · {exactContentReviews.filter((item) => item.state === "pending").length} 项待判断</summary>
        <p>这里仅用于看见风险；审核决定在独立工作台追加，绝不改写本次多角色投影。</p>
        {exactContentReviews.map((state) => <article key={state.item.id}><b>{state.item.title}</b><small>{state.item.category} · {state.item.location}</small><p>{state.item.reason}</p><p><strong>当前：</strong>{state.resolutionLabel}</p></article>)}
        <div className={styles.actions}><Link href="/studio/reviews/">进入人工审核工作台 →</Link></div>
      </details>}
      <Projection projection={projection} />
      <div className={styles.acceptanceAction}>
        <div><b>{existing ? "这张 exact 回执仍有效" : blocksComplete && countsComplete ? "人工遍历已完成，可以签发" : "还不能签发回执"}</b><p>{existing ? "Candidate digest 或投影器兼容版本变化后，系统会自动把旧回执标为失效。" : `还需查看 ${course.blocks.length - reviewedBlocks.length} 个 Block、${requiredCounts.filter((count) => !reviewedCounts.includes(count)).length} 个人数场景。`}</p></div>
        {!existing && <button className={styles.button} type="button" disabled={accepting || !blocksComplete || !countsComplete || !validation.ok} onClick={accept}>{accepting ? "正在重跑完整矩阵…" : "确认并签发 ViewAcceptanceReceipt"}</button>}
      </div>
    </section>
  </>;
}

function HumanReviewWorkbench({ data, onChanged, onError }: {
  data: Bootstrap;
  onChanged: (message: string) => Promise<void>;
  onError: (value: string) => void;
}) {
  const reviewVersions = preferredVersions(data.versions).filter((version) => data.contentReviews.some((state) => sameRef(state.courseRef, version.ref)));
  const [courseKey, setCourseKey] = useState(reviewVersions[0] ? versionKey(reviewVersions[0]) : "");
  const selected = reviewVersions.find((version) => versionKey(version) === courseKey) ?? reviewVersions[0];
  const states = selected ? data.contentReviews.filter((state) => sameRef(state.courseRef, selected.ref)) : [];
  const blockingCount = states.filter((state) => state.releaseBlocking).length;
  const pendingCount = states.filter((state) => state.state === "pending").length;
  const [parentQa, setParentQa] = useState<ParentQaReviewSnapshot | null>(null);
  const [parentError, setParentError] = useState("");
  const [parentLoading, setParentLoading] = useState(true);

  const loadParentQa = useCallback(async () => {
    setParentLoading(true);
    try {
      setParentQa(await api<ParentQaReviewSnapshot>("/api/studio/parent-qa-reviews"));
      setParentError("");
    } catch (cause) {
      setParentError(messageOf(cause));
    } finally {
      setParentLoading(false);
    }
  }, [setParentError]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadParentQa(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadParentQa]);

  return <>
    <Heading eyebrow="HUMAN REVIEW · TWO SEPARATE TRUTH OBJECTS" title="人工审核工作台">
      课程待核对与家长问答待补充在同一工作台操作，但始终是两类独立数据。模型只能提出缺口，不能替导师补写事实、改变审核状态或把待审内容放进检索库。
    </Heading>
    <section className={styles.panel}>
      <div className={styles.sectionTitle}>
        <div><h2>课程内容待核对</h2><p>决定绑定 exact revision＋digest；不会改写 CourseDefinition，也不会自动沿用到下一版。</p></div>
        <Link href="/studio/editor/">需要改正文？打开编辑器 →</Link>
      </div>
      {selected ? <>
        <div className={styles.reviewToolbar}>
          <label className={styles.field}>课程 exact 版本
            <select value={versionKey(selected)} onChange={(event) => setCourseKey(event.target.value)}>
              {reviewVersions.map((version) => <option value={versionKey(version)} key={versionKey(version)}>{version.course.course.name} · r{version.ref.revision} · {version.candidate ? "Candidate" : version.released ? "Released" : "Archived"}</option>)}
            </select>
          </label>
          <div className={styles.reviewCounters}>
            <span data-tone={blockingCount ? "danger" : "ok"}><b>{blockingCount}</b> 明确阻断</span>
            <span data-tone={pendingCount ? "warn" : "ok"}><b>{pendingCount}</b> 待判断（不自动阻断）</span>
            <span><b>{states.length}</b> 全部事项</span>
          </div>
        </div>
        <div className={styles.reviewExact}><b>{selected.ref.courseId} · r{selected.ref.revision}</b><code>{selected.ref.digest}</code><span>“本次明确排除”会保留审计痕迹，并明确显示“不代表已修复”。</span></div>
        <div className={styles.reviewList}>{states.map((state) => <CourseReviewCard key={`${state.item.id}:${state.nextSequence}`} state={state} courseRef={selected.ref} onChanged={onChanged} onError={onError} />)}</div>
      </> : <div className={styles.empty}>当前 Candidate／Released 没有声明课程内容待核对项。新事项请在课程编辑器的 <code>contentPackages.reviewQueue</code> 中归档。</div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.sectionTitle}>
        <div><h2>家长问答待补充</h2><p>来自脱敏后的 knowledge-gaps.ndjson；重复提问只累计次数，不会推翻人工结论。</p></div>
        {parentQa?.health.pendingRetryCount ? <button className={styles.buttonDanger} type="button" onClick={async () => {
          try { await api("/api/studio/parent-qa-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry-failed" }) }); await loadParentQa(); }
          catch (cause) { setParentError(messageOf(cause)); }
        }}>重试 {parentQa.health.pendingRetryCount} 条失败写入</button> : null}
      </div>
      {parentError && <div className={styles.dependencyError} role="alert"><b>家长 QA 清单暂时不可用</b><span>{parentError}</span><button type="button" onClick={() => void loadParentQa()}>重试独立服务</button></div>}
      {parentLoading && !parentQa ? <div className={styles.reviewLoading} role="status">正在读取独立审核日志…</div> : parentQa ? <>
        <div className={styles.recorderHealth} data-status={parentQa.health.status}>
          <b>{parentQa.health.status === "healthy" ? "✓ 写入健康" : "⚠ 写入降级"}</b>
          <span>累计写入失败 {parentQa.health.failedWriteCount} · 待重试 {parentQa.health.pendingRetryCount}</span>
          <small>最近成功 {formatAuditTime(parentQa.health.lastSuccessAt)} · 最近失败 {formatAuditTime(parentQa.health.lastFailureAt)}</small>
        </div>
        <div className={styles.reviewList}>{parentQa.gaps.length ? parentQa.gaps.map((gap) => <ParentQaReviewCard key={`${gap.id}:${gap.eventCount}`} gap={gap} onChanged={loadParentQa} onError={setParentError} />) : <div className={styles.empty}>暂无家长问答待补充事项。</div>}</div>
      </> : null}
    </section>
  </>;
}

function CourseReviewCard({ state, courseRef, onChanged, onError }: {
  state: CourseContentReviewState;
  courseRef: CoursePackageRef;
  onChanged: (message: string) => Promise<void>;
  onError: (value: string) => void;
}) {
  const terminal = state.state === "source-added" || state.state === "excluded-this-release" || state.state === "authored-resolved";
  const [disposition, setDisposition] = useState<CourseContentReviewDisposition>("revision-required");
  const [note, setNote] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [working, setWorking] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const submit = async (action: "decision" | "reopen") => {
    setWorking(true);
    onError("");
    try {
      await api("/api/studio/content-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseRef,
          itemId: state.item.id,
          expectedSequence: state.nextSequence - 1,
          idempotencyKey,
          action,
          note,
          ...(action === "decision" ? { disposition, ...(disposition === "source-added" ? { sourceRef } : {}) } : {}),
        }),
      });
      setIdempotencyKey(crypto.randomUUID());
      setNote("");
      setSourceRef("");
      await onChanged(`${state.item.title} 已记录人工${action === "reopen" ? "重开" : "处置"}；课程正文未被自动改写。`);
    } catch (cause) { onError(messageOf(cause)); }
    finally { setWorking(false); }
  };
  return <article className={styles.reviewCard} data-state={state.state}>
    <header><div><small>{state.item.category} · {state.item.location}</small><h3>{state.item.title}</h3></div><span data-blocking={state.releaseBlocking}>{state.resolutionLabel}</span></header>
    <p>{state.item.reason}</p>
    <div className={styles.recommended}><b>课程作者建议</b><span>{state.item.recommendedAction}</span></div>
    {state.history.length > 0 && <details className={styles.reviewHistory}><summary>人工处理记录 · {state.history.length}</summary>{[...state.history].reverse().map((event) => <div key={event.id}><b>#{event.sequence} · {event.action === "reopen" ? "显式重开" : reviewDispositionLabel(event.disposition)}</b><span>{event.note}</span>{event.sourceRef && <code>{event.sourceRef}</code>}<small>{event.reviewerDisplayName} · {formatAuditTime(event.createdAt)}</small></div>)}</details>}
    <div className={styles.reviewForm}>
      {!terminal && <label>处置方式<select value={disposition} onChange={(event) => setDisposition(event.target.value as CourseContentReviewDisposition)}><option value="revision-required">需要修订（阻断本版发布）</option><option value="source-added">已补可追溯来源</option><option value="excluded-this-release">本次明确排除（不等于修复）</option></select></label>}
      {!terminal && disposition === "source-added" && <label>来源引用<input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} placeholder="https://… 或 knowledge://…" /></label>}
      <label className={styles.wide}>人工说明<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={terminal ? "说明为什么现在需要重新核对" : "写清证据、判断和下一步，不能只写“已处理”"} /></label>
      <button className={terminal ? styles.buttonDanger : styles.button} type="button" disabled={working || !note.trim() || (!terminal && disposition === "source-added" && !sourceRef.trim())} onClick={() => void submit(terminal ? "reopen" : "decision")}>{working ? "正在写入审计记录…" : terminal ? "显式重开此项" : "保存人工处置"}</button>
    </div>
  </article>;
}

function ParentQaReviewCard({ gap, onChanged, onError }: {
  gap: ParentQaReviewSnapshot["gaps"][number];
  onChanged: () => Promise<void>;
  onError: (value: string) => void;
}) {
  const pending = gap.reviewStatus === "pending_dm_review";
  const [status, setStatus] = useState<"resolved_already_covered" | "resolved_added_to_knowledge" | "dismissed_out_of_scope">("resolved_already_covered");
  const [note, setNote] = useState("");
  const [knowledgeEntryId, setKnowledgeEntryId] = useState("");
  const [working, setWorking] = useState(false);
  const submit = async () => {
    setWorking(true);
    onError("");
    try {
      await api("/api/studio/parent-qa-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending
          ? { action: "review", id: gap.id, status, note, ...(status === "resolved_added_to_knowledge" ? { knowledgeEntryId } : {}) }
          : { action: "reopen", id: gap.id, note }),
      });
      setNote("");
      setKnowledgeEntryId("");
      await onChanged();
    } catch (cause) { onError(messageOf(cause)); }
    finally { setWorking(false); }
  };
  return <article className={styles.reviewCard} data-state={pending ? "pending" : "handled"}>
    <header><div><small>{gap.id} · 出现 {gap.observationCount} 次</small><h3>{gap.question}</h3></div><span data-blocking="false">{knowledgeGapStatusLabel(gap.reviewStatus)}</span></header>
    <div className={styles.reviewMeta}><span>首次 {formatAuditTime(gap.firstObservedAt)}</span><span>最近 {formatAuditTime(gap.lastObservedAt)}</span><span>来源 {gap.sourceIds.join("、") || "无匹配资料"}</span></div>
    {gap.reviewedAt && <div className={styles.recommended}><b>{gap.reviewedBy} · {formatAuditTime(gap.reviewedAt)}</b><span>{gap.reviewNote}</span>{gap.knowledgeEntryId && <code>{gap.knowledgeEntryId}</code>}</div>}
    <div className={styles.reviewForm}>
      {pending && <label>处置方式<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="resolved_already_covered">既有资料已覆盖</option><option value="resolved_added_to_knowledge">新增人工知识解决</option><option value="dismissed_out_of_scope">确认不在课程范围</option></select></label>}
      {pending && status === "resolved_added_to_knowledge" && <label>已发布知识条目 ID<input value={knowledgeEntryId} onChange={(event) => setKnowledgeEntryId(event.target.value)} placeholder="curated-knowledge-id-v1" /></label>}
      <label className={styles.wide}>人工说明<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={pending ? "说明核对依据；不要粘贴家长或孩子个人信息" : "只有范围或证据变化时才重开，并写明原因"} /></label>
      <button className={pending ? styles.button : styles.buttonDanger} type="button" disabled={working || !note.trim() || (pending && status === "resolved_added_to_knowledge" && !knowledgeEntryId.trim())} onClick={() => void submit()}>{working ? "正在写入独立日志…" : pending ? "保存人工处置" : "显式重新打开"}</button>
    </div>
  </article>;
}

function reviewDispositionLabel(value: CourseContentReviewDisposition | null): string {
  if (value === "revision-required") return "确认需要修订";
  if (value === "source-added") return "已补可追溯来源";
  if (value === "excluded-this-release") return "本次明确排除";
  return "人工决定";
}

function knowledgeGapStatusLabel(value: ParentQaReviewSnapshot["gaps"][number]["reviewStatus"]): string {
  if (value === "pending_dm_review") return "待导师审核";
  if (value === "resolved_already_covered") return "既有资料已覆盖";
  if (value === "resolved_added_to_knowledge") return "新增知识已解决";
  return "确认范围外";
}

function formatAuditTime(value: string | null | undefined): string {
  if (!value) return "无";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间无效" : date.toLocaleString("zh-CN");
}

function Projection({ projection }: { projection: ReturnType<typeof buildStudioProjection> }) {
  const [pinned, setPinned] = useState<string[]>([]);
  const togglePin = (id: string) => setPinned((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <div className={styles.viewGrid}>
    {projection.mentorViews.map((view) => <article className={styles.viewCard} data-active={view.activity === "active"} data-kind="mentor" data-pinned={pinned.includes(view.seatId)} key={view.seatId}>
      <header><small>{view.seatId.toUpperCase()} · {view.mentorRole} 导师</small><button type="button" aria-expanded={pinned.includes(view.seatId)} onClick={() => togglePin(view.seatId)}>{pinned.includes(view.seatId) ? "收起" : "固定展开"}</button></header>
      <h3>{view.label}</h3><span className={styles.badge}>{view.badge}</span><p>{view.task}</p>
      <div className={styles.viewDetails}>
        <b>{view.contentContext.mode === "owner" ? "案例内容所有者" : view.contentContext.mode === "handoff" ? "已验收成果接收者" : "本页案例路由"}</b>
        <p>{view.contentContext.note}</p>
        {view.contentContext.checkpoint && <p><b>{view.contentContext.checkpoint.title}</b><br/>{view.contentContext.checkpoint.purpose}<br/>课件第 {view.contentContext.coursewareCue?.slideStart}—{view.contentContext.coursewareCue?.slideEnd} 页：{view.contentContext.coursewareCue?.label}</p>}
        <b>{view.privateScript.length ? "当值导师私有讲稿" : "没有复制当值导师讲稿"}</b>
        {view.privateScript.length ? <ul>{view.privateScript.map((line) => <li key={line}>{line}</li>)}</ul> : <p>只保留这个席位自己的观察任务。</p>}
      </div>
    </article>)}
    {projection.learnerViews.map((view) => <article className={styles.viewCard} data-kind="learner" data-pinned={pinned.includes(view.seatId)} key={view.seatId}><header><small>{view.seatId.toUpperCase()} · 私人任务视角</small><button type="button" aria-expanded={pinned.includes(view.seatId)} onClick={() => togglePin(view.seatId)}>{pinned.includes(view.seatId) ? "收起" : "固定展开"}</button></header><h3>{view.label}</h3><span className={styles.badge}>{view.badge}</span><p>{view.task}</p><div className={styles.viewDetails}><p><b>学员私有提示：</b>{view.prompt}</p><div className={styles.cards}>{view.privateCards.map((card) => <span key={card.id}><b>{card.id} · {card.title}</b><br/>正文：{card.body}<br/>分享提示：{card.sharePrompt}<br/>证据边界：{card.boundary}<br/>来源：{card.sourceIds.join(", ") || "未标注"}</span>)}{!view.privateCards.length && <span>卡组容量不足：不会伪造手牌</span>}</div></div></article>)}
    <article className={styles.controller}><div><small>CONTROLLER · {projection.controllerView.blockId}</small><h3>{projection.controllerView.title}</h3><b>主导：{projection.controllerView.leadMentorId}</b></div><div><small>系统动作</small><ul>{projection.controllerView.systemActions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><small>本块验收</small><ul>{projection.controllerView.acceptance.map((item) => <li key={item}>{item}</li>)}</ul></div></article>
  </div>;
}

function CoursewareLibrary({ data, onChanged, onError }: { data: Bootstrap; onChanged: (message: string) => Promise<void>; onError: (value: string) => void }) {
  const [form, setForm] = useState({ packageId: "", title: "", slug: "", mentorRole: "P", html: "" });
  const [working, setWorking] = useState(false);
  const [bundleForm, setBundleForm] = useState({ packageId: "", title: "", slug: "", mentorRole: "P", entryFile: "" });
  const [bundleFiles, setBundleFiles] = useState<PreparedBundleFile[]>([]);
  const [bundleProgress, setBundleProgress] = useState("");
  const editable = data.courseware.filter((item) => item.contentKind === "inline-html" && item.availability === "playable" && (data.user.role === "admin" || item.ownerProfileId === data.user.userId));
  const bundleEditable = data.courseware.filter((item) => item.ownerProfileId !== "system-courseware" && item.versions.length > 0 && item.versions.every((version) => Boolean(version.treeDigest)) && (data.user.role === "admin" || item.ownerProfileId === data.user.userId));
  const choosePackage = (packageId: string) => {
    const item = editable.find((entry) => entry.packageId === packageId);
    setForm(item ? { packageId: item.packageId, title: item.title, slug: item.slug, mentorRole: item.mentorRole, html: "" } : { packageId: "", title: "", slug: "", mentorRole: "P", html: "" });
  };
  const chooseBundlePackage = (packageId: string) => {
    const item = bundleEditable.find((entry) => entry.packageId === packageId);
    setBundleForm(item ? { packageId: item.packageId, title: item.title, slug: item.slug, mentorRole: item.mentorRole, entryFile: "" } : { packageId: "", title: "", slug: "", mentorRole: "P", entryFile: "" });
    setBundleFiles([]);
    setBundleProgress("");
  };
  const save = async () => {
    setWorking(true);
    onError("");
    try {
      const body = { title: form.title, slug: form.slug, mentorRole: form.mentorRole, html: form.html, ...(form.packageId ? { packageId: form.packageId } : {}) };
      await api("/api/studio/courseware", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const verb = form.packageId ? "新版本已保存" : "课件已创建";
      setForm({ packageId: "", title: "", slug: "", mentorRole: "P", html: "" });
      await onChanged(`${verb}；创建 UI 验收课堂前请打开 exact 预览。`);
    } catch (cause) { onError(messageOf(cause)); }
    finally { setWorking(false); }
  };
  const selectBundle = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!selected.length) return;
    setWorking(true);
    onError("");
    try {
      setBundleProgress(`正在计算 ${selected.length} 个文件的 SHA-256…`);
      const prepared = await prepareBundleFiles(selected);
      const entryFile = prepared.find((item) => item.path.toLowerCase() === "index.html")?.path
        ?? prepared.find((item) => /\.html?$/i.test(item.path))?.path
        ?? "";
      setBundleFiles(prepared);
      setBundleForm((current) => ({ ...current, entryFile }));
      setBundleProgress(`已校验 ${prepared.length} 个普通文件，共 ${formatBytes(prepared.reduce((sum, item) => sum + item.file.size, 0))}。`);
    } catch (cause) { setBundleFiles([]); setBundleProgress(""); onError(messageOf(cause)); }
    finally { setWorking(false); }
  };
  const saveBundle = async () => {
    if (!bundleFiles.length || !bundleForm.entryFile) return;
    setWorking(true);
    onError("");
    try {
      const upload = await api<{ uploadId: string; totalBytes: number }>("/api/studio/courseware/bundles", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          ...bundleForm,
          ...(bundleForm.packageId ? { packageId: bundleForm.packageId } : {}),
          files: bundleFiles.map((item) => ({ path: item.path, byteLength: item.file.size, digest: item.digest, mediaType: item.file.type || undefined })),
        }),
      });
      let sent = 0;
      for (const item of bundleFiles) {
        for (let offset = 0, chunkIndex = 0; offset < item.file.size; offset += COURSEWARE_UPLOAD_CHUNK_BYTES, chunkIndex += 1) {
          const bytes = new Uint8Array(await item.file.slice(offset, Math.min(item.file.size, offset + COURSEWARE_UPLOAD_CHUNK_BYTES)).arrayBuffer());
          await api(`/api/studio/courseware/bundles/${encodeURIComponent(upload.uploadId)}/chunks`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
              path: item.path, chunkIndex, digest: await browserSha256(bytes), dataBase64: bytesToBase64(bytes),
            }),
          });
          sent += bytes.byteLength;
          setBundleProgress(`正在上传 ${item.path} · ${Math.round(sent / upload.totalBytes * 100)}%`);
        }
      }
      const result = await api<{ packageId: string; revision: number; digest: string; treeDigest: string }>(`/api/studio/courseware/bundles/${encodeURIComponent(upload.uploadId)}/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      setBundleFiles([]);
      setBundleForm({ packageId: "", title: "", slug: "", mentorRole: "P", entryFile: "" });
      setBundleProgress("");
      await onChanged(`多文件资源包已保存为 ${result.packageId} · r${result.revision}；tree ${result.treeDigest.slice(0, 16)}…。`);
    } catch (cause) { onError(messageOf(cause)); }
    finally { setWorking(false); }
  };
  return <>
    <Heading eyebrow="COURSEWARE LIBRARY · PARALLEL RESOURCE LINE" title="导师课件库">P／D／M／O 课件与 CourseDefinition 并行制作。Test Classroom 绑定 exact 版本；Production 必须复用经过 UI 验收且仍为 Released 的同一组版本。</Heading>
    <section className={styles.panel}>
      <div className={styles.sectionTitle}><div><h2>已安装课件</h2><p>点击 exact 预览，打开的就是课堂导师会使用的版本。</p></div><Link href="/course/">进入导师课件播放 →</Link></div>
      <div className={styles.coursewareGrid}>{data.courseware.map((item) => {
        const canManage = item.ownerProfileId !== "system-courseware" && (data.user.role === "admin" || item.ownerProfileId === data.user.userId);
        return <article className={styles.coursewareCard} data-role={item.mentorRole} key={item.packageId}>
          <header><div><small>{item.mentorRole} · MENTOR COURSEWARE</small><h3>{item.title}</h3></div><span className={styles.badge}>{item.availability === "placeholder" ? "内部占位" : item.releasedRevision === item.latestRevision ? "已发布" : "有新版本"}</span></header>
          <div className={styles.meta}>packageId · {item.packageId}<br />/{item.slug}/ · r{item.latestRevision}<br />{item.latestDigest} · {item.contentKind}</div>
          <div className={styles.actions}>
            {item.availability === "playable" ? <Link href={`/studio/courseware/${encodeURIComponent(item.packageId)}/?revision=${item.latestRevision}&digest=${item.latestDigest}`} target="_blank" rel="noopener noreferrer">打开内部 exact 预览 ↗</Link> : <span className={styles.placeholderAction}>尚无真实课件 · 不提供失效链接</span>}
            {canManage && item.contentKind === "inline-html" && <button className={styles.buttonSecondary} type="button" onClick={() => choosePackage(item.packageId)}>创建下一版本</button>}
            {canManage && item.releasedRevision !== item.latestRevision && <button className={styles.button} type="button" onClick={async () => { try { await api("/api/studio/courseware/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: item.packageId, revision: item.latestRevision, digest: item.latestDigest }) }); await onChanged(`${item.title} r${item.latestRevision} 已发布。`); } catch (cause) { onError(messageOf(cause)); } }}>发布此版本</button>}
          </div>
          <details className={styles.versionHistory}><summary>不可变版本历史 · {item.versions.length}</summary>{item.versions.map((version) => <div key={`${version.revision}:${version.digest}`}><span>r{version.revision} · {version.releaseStatus === "current" ? "当前发布" : version.releaseStatus === "historical" ? "历史已发布" : "Candidate"}</span><code>{version.digest}</code>{version.treeDigest && <code>tree · {version.treeDigest}</code>}{item.availability === "playable" && (version.releaseStatus || canManage) && <Link href={version.releaseStatus ? `/course/${item.slug}/?revision=${version.revision}&digest=${version.digest}` : `/studio/courseware/${encodeURIComponent(item.packageId)}/?revision=${version.revision}&digest=${version.digest}`} target="_blank" rel="noopener noreferrer">打开 r{version.revision} ↗</Link>}</div>)}</details>
        </article>;
      })}</div>
    </section>
    <section className={styles.panel}>
      <h2>{form.packageId ? "为既有课件创建不可变新版本" : "上传一份新的单文件 HTML 课件"}</h2>
      <p className={styles.panelIntro}>系统保存不可变版本并隔离播放；已绑定课堂不会跟随新版本变化。</p>
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
    <section className={styles.panel}>
      <h2>{bundleForm.packageId ? "为既有多文件课件创建不可变新版本" : "导入 HTML＋本地 assets 资源包"}</h2>
      <p className={styles.panelIntro}>选择已经解压的普通文件夹；浏览器逐文件上传，服务端重新校验每个分块、文件 SHA-256 和内容树摘要。系统不接收 ZIP／符号链接／私钥，因此不会在服务器解压压缩炸弹，也不会覆盖任何旧资源。</p>
      <div className={styles.coursewareForm}>
        <label className={styles.wide}>操作方式<select value={bundleForm.packageId} onChange={(event) => chooseBundlePackage(event.target.value)}><option value="">创建一套新的资源包课件</option>{bundleEditable.map((item) => <option value={item.packageId} key={item.packageId}>更新：{item.title} · 当前 r{item.latestRevision}</option>)}</select></label>
        <label>导师角色<select disabled={Boolean(bundleForm.packageId)} value={bundleForm.mentorRole} onChange={(event) => setBundleForm({ ...bundleForm, mentorRole: event.target.value })}><option value="P">P · 产品</option><option value="D">D · 开发</option><option value="M">M · 市场</option><option value="O">O · 运营</option></select></label>
        <label>课件标题<input disabled={Boolean(bundleForm.packageId)} value={bundleForm.title} onChange={(event) => setBundleForm({ ...bundleForm, title: event.target.value })} /></label>
        <label>URL slug<input disabled={Boolean(bundleForm.packageId)} placeholder="operations-playbook" value={bundleForm.slug} onChange={(event) => setBundleForm({ ...bundleForm, slug: event.target.value })} /></label>
        <label>课件目录<input type="file" multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(event) => void selectBundle(event)} /></label>
        <label className={styles.wide}>HTML 入口<select value={bundleForm.entryFile} onChange={(event) => setBundleForm({ ...bundleForm, entryFile: event.target.value })}><option value="">请先选择包含 HTML 的目录</option>{bundleFiles.filter((item) => /\.html?$/i.test(item.path)).map((item) => <option value={item.path} key={item.path}>{item.path}</option>)}</select></label>
        {bundleProgress && <div className={`${styles.bundleProgress} ${styles.wide}`} role="status">{bundleProgress}</div>}
        {bundleFiles.length > 0 && <details className={`${styles.bundleManifest} ${styles.wide}`}><summary>上传清单 · {bundleFiles.length} 个文件 · {formatBytes(bundleFiles.reduce((sum, item) => sum + item.file.size, 0))}</summary>{bundleFiles.map((item) => <code key={item.path}>{item.path} · {formatBytes(item.file.size)} · {item.digest}</code>)}</details>}
        <div className={`${styles.actions} ${styles.wide}`}><button className={styles.button} disabled={working || !bundleFiles.length || !bundleForm.entryFile || !bundleForm.title || !bundleForm.slug} type="button" onClick={() => void saveBundle()}>{working ? "正在校验与上传…" : bundleForm.packageId ? "保存资源包下一版本" : "创建不可变资源包"}</button>{bundleForm.packageId && <button className={styles.buttonSecondary} type="button" onClick={() => chooseBundlePackage("")}>取消更新</button>}</div>
      </div>
    </section>
  </>;
}

function Releases({ data, onChanged, onError }: { data: Bootstrap; onChanged: (message: string) => Promise<void>; onError: (value: string) => void }) {
  const versions = preferredVersions(data.versions);
  return <>
    <Heading eyebrow="RELEASE GATE · TWO RECEIPTS" title="验收与发布">
      这里是总闸门，不是另一个预览器。视图回执证明课程投影正确；UI 回执证明同一 Candidate 与四套 exact 课件已在真实 Test Classroom 中完整运行。
    </Heading>
    <section className={styles.panel}>
      <div className={styles.releaseGrid}>{versions.map((version) => {
        const status = pipelineStatus(data, version);
        return <article className={styles.releaseCard} key={versionKey(version)}>
          <header><div><small>{version.ref.courseId} · r{version.ref.revision}</small><h3>{version.course.course.name}</h3></div><span className={styles.badge}>{version.released ? "RELEASED" : "CANDIDATE"}</span></header>
          <p className={styles.meta}>{version.ref.digest}</p>
          <div className={styles.gateStack}>
            <GateDetail index="R" label="内容人工审核" passed={!status.reviewBlocking} detail={status.reviewStates.length ? `${status.reviewBlocking ? `${status.reviewStates.filter((item) => item.releaseBlocking).length} 项人工明确阻断` : "没有人工明确阻断"} · ${status.reviewStates.filter((item) => item.state === "pending").length} 项待判断不自动阻断` : "本版本没有声明待核对项"} />
            <GateDetail index="1" label="多角色视图验收" passed={Boolean(status.view)} detail={status.view ? `${status.view.receiptId} · ${status.view.projectorVersion} · ${status.view.sourceCommit} / ${status.view.appBuildId}` : "缺少当前 exact 版本的有效回执"} />
            <GateDetail index="2" label="UI 验收课堂" passed={status.tests.length > 0} detail={status.tests.length ? `${status.tests.length} 场 Test · ${status.tests[0].lifecycle}` : "尚未创建"} />
            <GateDetail index="3" label="真实 UI 验收回执" passed={Boolean(status.ui)} detail={status.ui ? `${status.ui.receiptId} · ${status.ui.runtimeContractVersion} · ${status.ui.sourceCommit} / ${status.ui.appBuildId} · ${status.ui.learnerCount} 学员 · 4 套课件` : "尚未完成／回执已失效"} />
            <GateDetail index="4" label="正式发布" passed={version.released} detail={version.released ? `Released r${version.ref.revision}` : "等待两级 exact 回执"} />
            <GateDetail index="5" label="正式课堂" passed={status.production.length > 0} detail={`${status.production.length} 场 Production`} />
          </div>
          {status.ui && <details className={styles.receiptDetail}><summary>查看 UI 回执锁定的四套课件</summary>{status.ui.coursewareRefs.map((ref) => <code key={ref.mentorRole}>{ref.mentorRole} · {ref.slug} · r{ref.revision}<br />{ref.digest}</code>)}</details>}
          <div className={styles.nextAction}><small>下一步主操作</small><b>{status.nextLabel}</b></div>
          <div className={styles.actions}>
            {status.reviewStates.length > 0 && <Link href="/studio/reviews/">查看内容人工审核 →</Link>}
            {!status.view && <Link href={previewHref(version.ref)}>前往多角色视图验收 →</Link>}
            {status.view && status.tests.length === 0 && <Link href={factoryHref("test", version.ref, status.view.receiptId)}>创建 UI 验收课堂 →</Link>}
            {status.view && status.tests.length > 0 && !status.ui && <Link href={`/classroom/${status.tests[0].roomId}/control`}>继续真实 UI 验收 →</Link>}
            {status.view && status.ui && !version.released && !status.reviewBlocking && <button className={styles.button} type="button" onClick={async () => { try { await api("/api/studio/releases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseRef: version.ref, viewReceiptId: status.view!.receiptId, uiReceiptId: status.ui!.receiptId }) }); await onChanged(`${version.course.course.name} r${version.ref.revision} 已通过两级门禁并发布。`); } catch (cause) { onError(messageOf(cause)); } }}>发布为 Released</button>}
            {status.view && status.ui && version.released && <Link href={factoryHref("production", version.ref, status.view.receiptId, status.ui.receiptId)}>创建 Production Classroom →</Link>}
          </div>
        </article>;
      })}</div>
    </section>
  </>;
}

function Gate({ passed, label }: { passed: boolean; label: string }) {
  return <span className={styles.gate} data-passed={passed}>{passed ? "✓" : "○"} {label}</span>;
}

function GateDetail({ index, label, passed, detail }: { index: string; label: string; passed: boolean; detail: string }) {
  return <div className={styles.gateDetail} data-passed={passed}><b>{passed ? "✓" : index}</b><span><strong>{label}</strong><small>{detail}</small></span></div>;
}

function preferredVersions(versions: Version[]): Version[] {
  return [...new Set(versions.map((version) => version.ref.courseId))].flatMap((courseId) => {
    const matching = versions.filter((version) => version.ref.courseId === courseId);
    const candidate = matching.find((version) => version.candidate);
    const released = matching.find((version) => version.released);
    return [...(candidate ? [candidate] : []), ...(released && released !== candidate ? [released] : []), ...(!candidate && !released && matching[0] ? [matching[0]] : [])];
  });
}

function pipelineStatus(data: Bootstrap, version: Version) {
  const view = findViewReceipt(data, version.ref);
  const tests = data.acceptanceClassrooms.filter((room) => room.environment === "test" && !room.archivedAt && sameRef(room.courseRef, version.ref) && (!view || room.viewReceiptId === view.receiptId));
  const ui = data.uiReceipts.find((receipt) => receipt.valid && sameRef(receipt.courseRef, version.ref) && (!view || receipt.viewReceiptId === view.receiptId));
  const production = data.acceptanceClassrooms.filter((room) => room.environment === "production" && sameRef(room.courseRef, version.ref));
  const reviewStates = data.contentReviews.filter((state) => sameRef(state.courseRef, version.ref));
  const reviewBlocking = reviewStates.some((state) => state.releaseBlocking);
  const nextLabel = reviewBlocking ? "先处理人工明确阻断项" : !view ? "验收多角色视图" : !tests.length ? "创建真实 UI 验收课堂" : !ui ? "跑完 Test 并签发 UI 回执" : !version.released ? "发布为 Released" : "创建正式课堂";
  return { view, tests, ui, production, reviewStates, reviewBlocking, nextLabel };
}

function findViewReceipt(data: Bootstrap, ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">) {
  return data.viewReceipts.find((receipt) => receipt.valid && sameRef(receipt.courseRef, ref));
}

function sameRef(left: { courseId: string; revision: number; digest: string }, right: { courseId: string; revision: number; digest: string }) {
  return left.courseId === right.courseId && left.revision === right.revision && left.digest === right.digest;
}

function matchesInitial(version: Version, initial: InitialCourseRef) {
  return Boolean(initial && version.ref.courseId === initial.courseId && version.ref.revision === initial.revision && (!initial.digest || version.ref.digest === initial.digest));
}

function versionKey(version: Version): string { return `${version.ref.courseId}:${version.ref.revision}:${version.ref.digest}`; }
function refLabel(ref: CoursePackageRef): string { return `r${ref.revision} · ${ref.digest.slice(0, 16)}…`; }
function previewHref(ref: CoursePackageRef): string { return `/studio/preview/?course=${encodeURIComponent(ref.courseId)}&revision=${ref.revision}&digest=${encodeURIComponent(ref.digest)}`; }
function factoryHref(environment: "test" | "production", ref: CoursePackageRef, viewReceiptId: string, uiReceiptId?: string): string {
  const query = new URLSearchParams({ environment, course: ref.courseId, revision: String(ref.revision), digest: ref.digest, viewReceipt: viewReceiptId });
  if (uiReceiptId) query.set("uiReceipt", uiReceiptId);
  return `/classroom/?${query.toString()}#factory`;
}

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json() as { ok: boolean; data?: T; error?: { message?: string; details?: unknown } };
  if (!response.ok || !body.ok) throw new Error([body.error?.message ?? "操作失败。", ...(Array.isArray(body.error?.details) ? body.error.details.map(String) : [])].join("\n"));
  return body.data as T;
}
function messageOf(value: unknown) { return value instanceof Error ? value.message : "操作失败，请重试。"; }
async function readHtml(event: ChangeEvent<HTMLInputElement>, onRead: (value: string) => void, onError: (value: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  try { onRead(await file.text()); }
  catch (cause) { onError(`读取失败：${messageOf(cause)}`); }
  finally { event.target.value = ""; }
}

async function prepareBundleFiles(files: File[]): Promise<PreparedBundleFile[]> {
  if (files.length > 256) throw new Error("资源包最多包含 256 个文件。");
  const rawPaths = files.map((file) => (file.webkitRelativePath || file.name).replaceAll("\\", "/"));
  const roots = rawPaths.map((path) => path.split("/", 1)[0]);
  const sharedRoot = roots.length > 0 && roots.every((root) => root === roots[0]) && rawPaths.every((path) => path.includes("/")) ? `${roots[0]}/` : "";
  const prepared: PreparedBundleFile[] = [];
  let totalBytes = 0;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const path = sharedRoot ? rawPaths[index].slice(sharedRoot.length) : rawPaths[index];
    if (file.size < 1 || file.size > 8 * 1024 * 1024) throw new Error(`文件 ${path} 必须为 1 B—8 MiB。`);
    totalBytes += file.size;
    if (totalBytes > 48 * 1024 * 1024) throw new Error("资源包总大小不能超过 48 MiB。");
    prepared.push({ file, path, digest: await browserSha256(new Uint8Array(await file.arrayBuffer())) });
  }
  if (new Set(prepared.map((item) => item.path)).size !== prepared.length) throw new Error("资源包包含重复路径。");
  if (!prepared.some((item) => /\.html?$/i.test(item.path))) throw new Error("资源包至少需要一个 HTML 入口文件。");
  return prepared.sort((left, right) => left.path.localeCompare(right.path));
}

async function browserSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.byteLength, offset + 0x8000)));
  }
  return btoa(binary);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
