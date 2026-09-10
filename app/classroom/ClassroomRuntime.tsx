"use client";
import Link from "../components/NavigationLink";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AccountMenu, type AccountMenuUser } from "../components/AccountMenu";
import type { ClassroomScriptAction } from "../lib/classroom-factory";
import type { ClassroomInstanceDetail, ClassroomSharedScreenDetail } from "../lib/classroom-platform-store";
import { UI_ACCEPTANCE_CHECKLIST, type UiAcceptanceChecks } from "../lib/course-acceptance-contract";
import { canCommitClassroomRuntimeResponse, classroomDeviceDraftKey, classroomRuntimeRequestKey, type ClassroomRuntimeRequestIdentity } from "../lib/classroom-runtime-sync";
import styles from "./platform.module.css";
import manageStyles from "./platform-manage.module.css";

type RuntimeView = "seat" | "control" | "members";
type RuntimeProps = { classroomId: string; view: RuntimeView; user: AccountMenuUser };
type NavigationState = { blockId: string | null; testSurface: string | null };
type RuntimeSyncState = "connecting" | "online" | "offline";
type TestReceiptChecks = UiAcceptanceChecks;
const BOUNDARY = {
  F: { short: "F 有来源", title: "有来源的事实" },
  R: { short: "R 课堂模拟", title: "课堂平行世界中的模拟" },
  G: { short: "G 我们猜的", title: "团队推测，需要验证" },
  U: { short: "U 还不知道", title: "当前未知，需要调查" },
} as const;

function initialNavigation(): NavigationState {
  if (typeof window === "undefined") return { blockId: null, testSurface: null };
  const params = new URLSearchParams(window.location.search);
  return { blockId: params.get("block"), testSurface: params.get("as") };
}

export function isClassroomKeyboardTargetEditable(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
}

export default function ClassroomRuntime({ classroomId, view, user }: RuntimeProps) {
  const [navigation, setNavigation] = useState<NavigationState>(initialNavigation);
  const [data, setData] = useState<ClassroomInstanceDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncState, setSyncState] = useState<RuntimeSyncState>("connecting");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; title: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const finishMutationKey = useRef(newMutationKey());
  const observedUnlockVersion = useRef<number | null>(null);
  const dataRef = useRef<ClassroomInstanceDetail | null>(null);
  const loadRequestGeneration = useRef(0);
  const activeLoad = useRef<AbortController | null>(null);
  const viewAsProfileId = navigation.testSurface && navigation.testSurface !== "control" && navigation.testSurface !== "screen"
    ? navigation.testSurface
    : undefined;
  const requestControlSurface = data?.environment === "test"
    && (navigation.testSurface === "control" || (!navigation.testSurface && view === "control"));
  const runtimeRequestIdentity = useMemo<ClassroomRuntimeRequestIdentity>(() => ({
    classroomId,
    blockId: navigation.blockId,
    viewProfileId: viewAsProfileId ?? null,
    surface: requestControlSurface ? "control" : "seat",
  }), [classroomId, navigation.blockId, requestControlSurface, viewAsProfileId]);
  const requestIdentity = classroomRuntimeRequestKey(runtimeRequestIdentity);
  const requestIdentityRef = useRef(requestIdentity);
  useEffect(() => { requestIdentityRef.current = requestIdentity; }, [requestIdentity]);
  const writeUrl = useCallback((next: NavigationState) => {
    const url = new URL(window.location.href);
    if (next.blockId) url.searchParams.set("block", next.blockId); else url.searchParams.delete("block");
    if (next.testSurface) url.searchParams.set("as", next.testSurface); else url.searchParams.delete("as");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const updateNavigation = useCallback((update: Partial<NavigationState>) => {
    setNavigation((current) => {
      const next = { ...current, ...update };
      writeUrl(next);
      return next;
    });
  }, [writeUrl]);
  const load = useCallback(async (quiet = false) => {
    const query = new URLSearchParams();
    if (navigation.blockId) query.set("block", navigation.blockId);
    if (viewAsProfileId) query.set("viewAs", viewAsProfileId);
    if (requestControlSurface) query.set("surface", "control");
    const identity = requestIdentity;
    const requestGeneration = ++loadRequestGeneration.current;
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    if (!quiet) setSyncState("connecting");
    try {
      const next = await api<ClassroomInstanceDetail>(`/api/platform/classrooms/${encodeURIComponent(classroomId)}${query.size ? `?${query}` : ""}`, { signal: controller.signal });
      const previous = dataRef.current;
      if (controller.signal.aborted || requestIdentityRef.current !== identity || !canCommitClassroomRuntimeResponse({
        requestGeneration,
        latestRequestGeneration: loadRequestGeneration.current,
        expected: runtimeRequestIdentity,
        actual: {
          classroomId: next.runtimeIdentity.classroomId,
          blockId: next.page.id,
          viewProfileId: next.viewer.viewProfileId,
          resetGeneration: next.runtimeIdentity.resetGeneration,
        },
        currentResetGeneration: previous?.runtimeIdentity.resetGeneration ?? null,
      })) return;
      if (previous && next.runtimeIdentity.resetGeneration > previous.runtimeIdentity.resetGeneration) {
        setNotice(`课堂已进入新的运行 ${next.runtimeIdentity.runId}；旧运行的写入已被关闭。`);
      } else if (observedUnlockVersion.current !== null && next.script.version > observedUnlockVersion.current) {
        setNotice(`${next.script.unlockedThroughBlockId} 已解锁；你仍停留在 ${next.page.id}，可自行翻页或一键回到最新。`);
      }
      observedUnlockVersion.current = next.script.version;
      dataRef.current = next;
      setData(next);
      setSyncState("online");
      setLastSyncedAt(Date.now());
      if (!navigation.blockId) updateNavigation({ blockId: next.page.id });
      if (!quiet) setError("");
    }
    catch (cause) {
      if (isAbortError(cause) || requestGeneration !== loadRequestGeneration.current) return;
      setSyncState("offline");
      if (!quiet) setError(messageOf(cause));
    }
  }, [classroomId, navigation.blockId, requestControlSurface, requestIdentity, runtimeRequestIdentity, updateNavigation, viewAsProfileId]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 4_000);
    const reconnect = () => { void load(); };
    const disconnect = () => setSyncState("offline");
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnect);
      activeLoad.current?.abort();
    };
  }, [load, view]);

  const navigateTo = useCallback((blockId: string) => { setNotice(""); updateNavigation({ blockId }); }, [updateNavigation]);
  const switchSurface = useCallback((testSurface: string) => { setNotice(""); updateNavigation({ testSurface }); }, [updateNavigation]);
  const selectedSurface = data?.environment === "test"
    ? navigation.testSurface ?? (view === "control" || data.myView?.kind === "controller" ? "control" : data.viewer.viewProfileId)
    : view;
  const requestForward = useCallback(() => {
    if (!data) return;
    if (data.scriptNavigation.viewedIndex < data.script.unlockedThroughIndex) {
      navigateTo(data.scriptNavigation.unlockedBlocks[data.scriptNavigation.viewedIndex + 1].id);
    } else if (data.scriptNavigation.nextLocked && data.scriptNavigation.canUnlockNext) {
      setUnlockTarget(data.scriptNavigation.nextLocked);
    } else {
      setNotice(data.script.unlockedThroughIndex >= data.course.blockCount - 1 ? "已经到达整组剧本的最后一页。" : "下一页尚未解锁，请等待导师确认。");
    }
  }, [data, navigateTo]);
  const requestBack = useCallback(() => {
    if (data && data.scriptNavigation.viewedIndex > 0) navigateTo(data.scriptNavigation.unlockedBlocks[data.scriptNavigation.viewedIndex - 1].id);
  }, [data, navigateTo]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!data || view === "members" || isClassroomKeyboardTargetEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); requestBack(); }
      if (event.key === "ArrowRight") { event.preventDefault(); requestForward(); }
      if (event.key === "Home") { event.preventDefault(); navigateTo(data.scriptNavigation.unlockedBlocks[0].id); }
      if (event.key === "End") { event.preventDefault(); navigateTo(data.scriptNavigation.latestUnlocked.id); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data, navigateTo, requestBack, requestForward, view]);

  const mutate = async <T,>(path: string, body: unknown, success: string, reload = true): Promise<T | null> => {
    if (dataRef.current?.archive) {
      setError("这场 Test Classroom 已归档并永久只读；请回到课堂中心，从同一 exact 版本新建课堂继续测试。");
      return null;
    }
    setBusy(true); setError("");
    try { const result = await api<T>(path, { method: "POST", body: JSON.stringify(body) }); setNotice(success); if (reload) await load(); return result; }
    catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) await load(true);
      setError(`${messageOf(cause)}${cause instanceof ApiRequestError && cause.status === 409 ? " 已同步服务器最新状态，你的本地草稿仍保留。" : ""}`);
      return null;
    }
    finally { setBusy(false); }
  };

  const unlock = async () => {
    if (!data || !unlockTarget) return;
    const target = unlockTarget;
    setUnlockTarget(null);
    const result = await mutate<ClassroomInstanceDetail["script"]>(`/api/platform/classrooms/${encodeURIComponent(classroomId)}/control`, {
      expectedVersion: data.script.version,
      expectedRunId: data.runtimeIdentity.runId,
      expectedResetGeneration: data.runtimeIdentity.resetGeneration,
      action: { type: "unlock-next", nextBlockId: target.id } satisfies ClassroomScriptAction,
      ...(viewAsProfileId ? { viewAsProfileId } : {}),
    }, `${target.id} 已解锁；其他人会收到通知，但不会被强制跳页。`);
    if (result) navigateTo(target.id);
  };

  const finish = async () => {
    if (!data) return;
    const result = await mutate<{ completed: true }>(`/api/platform/classrooms/${encodeURIComponent(classroomId)}/finish`, {
      expectedScriptVersion: data.script.version,
      expectedRunId: data.runtimeIdentity.runId,
      expectedResetGeneration: data.runtimeIdentity.resetGeneration,
      idempotencyKey: finishMutationKey.current,
      ...(viewAsProfileId ? { viewAsProfileId } : {}),
    }, "本次课堂已经明确结束；剧本、作品、RP 与资金记录均保持原样。");
    if (result) {
      finishMutationKey.current = newMutationKey();
      setFinishOpen(false);
    }
  };

  if (error && !data) return <RuntimeError error={error} />;
  if (!data) return <main className={styles.runtime}><div className={styles.runtimeMain}>正在连接这一个 Classroom 实例…</div></main>;
  const screenMode = data.environment === "test" && selectedSurface === "screen";
  const readOnly = Boolean(data.archive);
  const roleProjectionReady = data.environment !== "test" || selectedSurface === "control" || selectedSurface === "screen"
    || data.viewer.viewProfileId === selectedSurface;
  return <main className={styles.runtime}>
    <RuntimeTop data={data} classroomId={classroomId} user={user} selectedSurface={String(selectedSurface)} onSwitch={switchSurface} />
    <div className={screenMode ? styles.screenShell : styles.runtimeMain}>
      <RuntimeSync state={syncState} lastSyncedAt={lastSyncedAt} onRetry={() => void load()} />
      {data.archive && <div className={styles.archiveRuntimeBanner} role="status"><div><b>只读归档 · {new Date(data.archive.archivedAt).toLocaleString("zh-CN")}</b><span>保留 {data.archive.previousLifecycle} 运行、作品、资金与审计证据；不能重置、提交、改成员或签发新回执。</span></div><Link href={factoryHrefForArchived(data)}>以此 exact 版本新建 Test →</Link></div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {view !== "members" && <PageNavigator data={data} busy={busy} onBack={requestBack} onForward={requestForward} onNavigate={navigateTo} />}
      {view !== "members" && data.environment === "test" && <RuntimeDiagnostics data={data} />}
      {view === "members" ? <MembersView data={data} /> : !roleProjectionReady ? <section className={styles.card} aria-live="polite">正在切换真实角色视图…</section> : screenMode ? <SharedScreen data={toSharedScreen(data)} />
        : selectedSurface === "control" ? <ControlView data={data} busy={busy || readOnly}
          requestUnlock={() => data.scriptNavigation.nextLocked && setUnlockTarget(data.scriptNavigation.nextLocked)}
          requestFinish={() => setFinishOpen(true)}
          reset={async () => {
            const result = await mutate(`/api/platform/classrooms/${classroomId}/reset`, {
              expectedRunId: data.runtimeIdentity.runId,
              expectedResetGeneration: data.runtimeIdentity.resetGeneration,
            }, "Test Classroom 已回到 B01；其他课堂不受影响。", false);
            if (result) updateNavigation({ blockId: null });
            return result;
          }}
          receipt={(checks) => mutate(`/api/platform/classrooms/${classroomId}/receipt`, { checks, clientMatrix: currentClientMatrix() }, "UiAcceptanceReceipt 已生成；返回 Course Studio 即可发布。")}
        /> : <SeatView key={`${data.runtimeIdentity.runId}:${data.viewer.viewProfileId}:${data.page.id}`}
          data={data}
          busy={busy || readOnly}
          submit={(input) => mutate(`/api/platform/classrooms/${classroomId}/submissions`, {
            blockId: data.page.id,
            ...input,
            expectedRunId: data.runtimeIdentity.runId,
            expectedResetGeneration: data.runtimeIdentity.resetGeneration,
            ...(viewAsProfileId ? { viewAsProfileId } : {}),
          }, input.schemaId && data.activitySchema
            ? `${data.activitySchema.name}已提交给 ${data.activitySchema.ownerMentorRole} 导师；退回修改或通过都会保留。`
            : `已保存到 ${data.page.id}；翻页不会改变这份记录。`)}
          review={(submissionId, status, feedback, expectedVersion, idempotencyKey) => mutate(`/api/platform/classrooms/${classroomId}/submissions/${submissionId}/review`, {
            status,
            feedback,
            expectedVersion,
            idempotencyKey,
            expectedRunId: data.runtimeIdentity.runId,
            expectedResetGeneration: data.runtimeIdentity.resetGeneration,
            ...(viewAsProfileId ? { viewAsProfileId } : {}),
          }, status === "accepted" ? "结构化成果已通过；到声明的交接页后，下游导师可以读取。" : "结构化成果已退回，学员会看到具体修改建议。")}
        />}
    </div>
    {unlockTarget && <UnlockDialog target={unlockTarget} busy={busy} onCancel={() => setUnlockTarget(null)} onConfirm={() => void unlock()} />}
    {finishOpen && <FinishDialog data={data} busy={busy} onCancel={() => setFinishOpen(false)} onConfirm={() => void finish()} />}
  </main>;
}

function RuntimeDiagnostics({ data }: { data: ClassroomInstanceDetail }) {
  const [copied, setCopied] = useState(false);
  const diagnostic = data.runtimeIdentity;
  const candidate = diagnostic.candidateComparison.currentCandidate;
  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify({
      courseRef: data.courseRef,
      runtimeIdentity: diagnostic,
      page: data.page,
      myView: data.myView,
    }, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };
  return <details className={styles.runtimeDiagnostics}>
    <summary><b>TEST 数据身份</b><span>{diagnostic.seatId} · {data.page.id} · {diagnostic.candidateComparison.exactMatch ? "与当前 Candidate 相同" : "课堂锁定旧版本"}</span></summary>
    <div className={styles.diagnosticGrid}>
      <span><small>courseDataId</small><code>{diagnostic.courseDataId}</code></span>
      <span><small>classroom / run</small><code>{diagnostic.classroomId} / {diagnostic.runId}</code></span>
      <span><small>seat / membership</small><code>{diagnostic.seatId} / {diagnostic.membershipId ?? "—"}</code></span>
      <span><small>block / deck</small><code>{diagnostic.blockId} / {diagnostic.deckId} r{diagnostic.deckRevision}</code></span>
      <span><small>deal seed</small><code>{diagnostic.dealSeed}</code></span>
      <span><small>state / reset / cache</small><code>{diagnostic.scriptStateVersion} / {diagnostic.resetGeneration} / {diagnostic.cacheEpoch}</code></span>
      <span><small>source / app build</small><code>{diagnostic.sourceCommit} / {diagnostic.appBuildId}</code></span>
      <span><small>projector / runtime contract</small><code>{diagnostic.projectorContractVersion} / {diagnostic.runtimeContractVersion}</code></span>
      <span><small>exact courseware refs</small><code>{data.courseware.map((item) => `${item.mentorRole}:${item.slug}@r${item.revision}:${item.digest.slice(0, 12)}`).join(" · ")}</code></span>
      <span><small>当前 Candidate</small><code>{candidate ? `${candidate.courseId}@r${candidate.revision}:${candidate.digest}` : "没有 Candidate 指针"}</code></span>
      <span><small>本视角 cardAssignment</small><code>{diagnostic.cardAssignments.length ? diagnostic.cardAssignments.map((item) => `${item.cardAssignmentId}:${item.cardId}`).join(" · ") : "当前视角无私密发牌"}</code></span>
    </div>
    <button type="button" className={styles.diagnosticCopy} onClick={() => void copy()}>{copied ? "已复制完整 payload" : "复制本视角诊断与 payload"}</button>
  </details>;
}

/** Live shared display backed by a dedicated allow-list API projection. */
export function ClassroomScreenRuntime({ classroomId }: { classroomId: string }) {
  const [blockId, setBlockId] = useState<string | null>(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("block"));
  const [data, setData] = useState<ClassroomSharedScreenDetail | null>(null);
  const [error, setError] = useState("");
  const [syncState, setSyncState] = useState<RuntimeSyncState>("connecting");
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const expectedBlockRef = useRef(blockId);
  useEffect(() => { expectedBlockRef.current = blockId; }, [blockId]);
  const load = useCallback(async (quiet = false) => {
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const next = await api<ClassroomSharedScreenDetail>(`/api/platform/classrooms/${encodeURIComponent(classroomId)}/screen${blockId ? `?block=${encodeURIComponent(blockId)}` : ""}`, { signal: controller.signal });
      if (controller.signal.aborted || generation !== requestGeneration.current || expectedBlockRef.current !== blockId) return;
      if (blockId && next.page.id !== blockId) return;
      setData(next);
      setSyncState("online");
      if (!blockId) setBlockId(next.page.id);
      if (!quiet) setError("");
    } catch (cause) {
      if (isAbortError(cause) || generation !== requestGeneration.current) return;
      setSyncState("offline");
      if (!quiet) setError(messageOf(cause));
    }
  }, [blockId, classroomId]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 2_000);
    const reconnect = () => { void load(); };
    const disconnect = () => setSyncState("offline");
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    return () => {
      window.clearTimeout(initial); window.clearInterval(timer);
      window.removeEventListener("online", reconnect); window.removeEventListener("offline", disconnect);
      activeRequest.current?.abort();
    };
  }, [load]);
  const navigate = useCallback((nextBlockId: string) => {
    setBlockId(nextBlockId);
    const url = new URL(window.location.href);
    url.searchParams.set("block", nextBlockId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!data || isClassroomKeyboardTargetEditable(event.target)) return;
      const index = data.scriptNavigation.viewedIndex;
      if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); navigate(data.scriptNavigation.unlockedBlocks[index - 1].id); }
      if (event.key === "ArrowRight" && index < data.script.unlockedThroughIndex) { event.preventDefault(); navigate(data.scriptNavigation.unlockedBlocks[index + 1].id); }
      if (event.key === "Home") { event.preventDefault(); navigate(data.scriptNavigation.unlockedBlocks[0].id); }
      if (event.key === "End") { event.preventDefault(); navigate(data.scriptNavigation.latestUnlocked.id); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data, navigate]);
  if (error && !data) return <RuntimeError error={error} />;
  if (!data) return <main className={styles.runtime}><div className={styles.runtimeMain}>正在连接课堂共享画面…</div></main>;
  return <><SharedScreen data={data} />{syncState === "offline" && <div className={styles.screenSync} role="status">投屏连接中断 · 正在等待网络恢复</div>}<div className={styles.screenControls}><button disabled={data.scriptNavigation.viewedIndex <= 0} onClick={() => navigate(data.scriptNavigation.unlockedBlocks[data.scriptNavigation.viewedIndex - 1]?.id)}>← 上一页</button>{data.scriptNavigation.viewedIndex < data.script.unlockedThroughIndex && <button onClick={() => navigate(data.scriptNavigation.latestUnlocked.id)}>回到最新 · {data.scriptNavigation.latestUnlocked.id}</button>}<button disabled={data.scriptNavigation.viewedIndex >= data.script.unlockedThroughIndex} onClick={() => navigate(data.scriptNavigation.unlockedBlocks[data.scriptNavigation.viewedIndex + 1]?.id)}>下一页 →</button></div></>;
}

function RuntimeTop({ data, classroomId, user, selectedSurface, onSwitch }: { data: ClassroomInstanceDetail; classroomId: string; user: AccountMenuUser; selectedSurface: string; onSwitch: (surface: string) => void }) {
  const seatLabel = data.viewer.viewMentorRole
    ? `${data.viewer.viewMentorRole} 导师`
    : data.viewer.viewLearnerSeat
      ? `Young Builder ${data.viewer.viewLearnerSeat}`
      : data.isAdminDm
        ? `${data.adminDmMode === "primary" ? "Primary" : "Delegated"} Admin DM`
        : "课堂成员";
  return <><header className={styles.runtimeTop}>
    <Link href="/classroom/"><b>MSV · {data.title}</b></Link>
    <nav aria-label="课堂内导航"><Link href={`/classroom/${classroomId}/`}>我的席位</Link>{data.controlView && <Link href={`/classroom/${classroomId}/control`}>主持提示</Link>}<a href={`/classroom/${classroomId}/screen?block=${encodeURIComponent(data.page.id)}`} target="_blank" rel="noreferrer">投屏</a>{data.isAdminDm && <Link href={`/classroom/${classroomId}/members`}>成员</Link>}<AccountMenu user={user} returnTo={`/classroom/${classroomId}/`} context={{
      classroomId,
      classroomTitle: data.title,
      seatLabel,
      testIdentityManagementHref: data.environment === "test" && data.isAdminDm && user.role === "admin" && !user.impersonation
        ? `/classroom/${classroomId}/members#test-identities`
        : null,
    }} /></nav>
  </header>{data.environment === "test" && <TestRoleTabs data={data} selected={selectedSurface} onSwitch={onSwitch} />}</>;
}

function TestRoleTabs({ data, selected, onSwitch }: { data: ClassroomInstanceDetail; selected: string; onSwitch: (surface: string) => void }) {
  return <nav className={styles.testRoleTabs} aria-label="Test Classroom 角色视角">
    <span>TEST · 真实角色视图</span>
    <button data-active={selected === "control"} onClick={() => onSwitch("control")}>中控</button>
    {data.mentors.map((mentor) => <button key={mentor.profileId} data-active={selected === mentor.profileId} onClick={() => onSwitch(mentor.profileId)}>{mentor.mentorRole} · {mentor.displayName}</button>)}
    {data.learners.map((learner) => <button key={learner.profileId} data-active={selected === learner.profileId} onClick={() => onSwitch(learner.profileId)}>学员 {learner.seat}</button>)}
    <button data-active={selected === "screen"} onClick={() => onSwitch("screen")}>投屏</button>
  </nav>;
}

function PageNavigator({ data, busy, onBack, onForward, onNavigate }: { data: ClassroomInstanceDetail; busy: boolean; onBack: () => void; onForward: () => void; onNavigate: (blockId: string) => void }) {
  const historical = data.scriptNavigation.viewedIndex < data.script.unlockedThroughIndex;
  return <section className={styles.pageNavigator} aria-label="已解锁剧本导航">
    <button disabled={busy || data.scriptNavigation.viewedIndex <= 0} onClick={onBack}>← 上一页</button>
    <label><span>我的浏览位置</span><select value={data.page.id} onChange={(event) => onNavigate(event.target.value)}>{data.scriptNavigation.unlockedBlocks.map((block) => <option key={block.id} value={block.id}>{block.id} · {block.title}</option>)}</select></label>
    {historical && <button className={styles.latestButton} onClick={() => onNavigate(data.scriptNavigation.latestUnlocked.id)}>回到最新解锁 · {data.scriptNavigation.latestUnlocked.id}</button>}
    <button disabled={busy || (data.script.unlockedThroughIndex >= data.course.blockCount - 1 && !historical)} onClick={onForward}>{historical ? "下一页 →" : data.scriptNavigation.canUnlockNext ? "确认解锁下一页 →" : "下一页尚未解锁"}</button>
    <small>←/→ 翻页 · Home 回 B01 · End 回最新；每个人独立浏览</small>
  </section>;
}

function UnlockDialog({ target, busy, onCancel, onConfirm }: { target: { id: string; title: string }; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="unlock-title">
    <small className={styles.eyebrow}>导师确认 · 只增加可见页</small><h2 id="unlock-title">解锁 {target.id}？</h2><p><b>{target.title}</b></p><ul><li>全员会收到“新页已解锁”的通知。</li><li>其他人的屏幕不会被强制跳转。</li><li>提交、手牌、RP、钱包与团队资金都不会变化。</li><li>解锁后不能重新锁回去。</li></ul><div className={styles.dialogActions}><button className={styles.secondary} disabled={busy} onClick={onCancel}>取消</button><button className={styles.button} disabled={busy} onClick={onConfirm}>{busy ? "处理中…" : "确认解锁并进入"}</button></div>
  </section></div>;
}

function FinishDialog({ data, busy, onCancel, onConfirm }: {
  data: ClassroomInstanceDetail;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="finish-title">
    <small className={styles.eyebrow}>导师确认 · 结束本次运行</small><h2 id="finish-title">确认本次课堂已经结束？</h2>
    <p><b>{data.title}</b> · {data.runtimeIdentity.runId}</p>
    <ul>
      <li>这一步只把当前课堂运行标记为“已结束”，不会解锁或修改任何剧本页。</li>
      <li>学员作品、导师反馈、手牌、RP、个人钱包与团队资金全部原样保留。</li>
      <li>课程如明确声明必需成果，服务端会在此刻检查“已通过”，但作品从不阻塞翻页。</li>
      <li>{data.environment === "test" ? "Test Classroom 仍可由 Admin DM 单独重置后重新验收。" : "Production Classroom 结束后不能重置，请确认现场流程已完成。"}</li>
    </ul>
    <div className={styles.dialogActions}><button className={styles.secondary} disabled={busy} onClick={onCancel}>继续上课</button><button className={styles.button} disabled={busy} onClick={onConfirm}>{busy ? "正在确认…" : "确认结束本次课堂"}</button></div>
  </section></div>;
}

function classroomDraftKey(data: ClassroomInstanceDetail, discriminator: string): string {
  return classroomDeviceDraftKey({
    actorProfileId: data.viewer.actorProfileId,
    viewProfileId: data.viewer.viewProfileId,
    classroomId: data.runtimeIdentity.classroomId,
    runId: data.runtimeIdentity.runId,
    seatId: data.runtimeIdentity.seatId,
    blockId: data.page.id,
    discriminator,
  });
}

function useDeviceDraft<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>, (nextValue: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) setValue(JSON.parse(stored) as T);
      } catch { /* Storage can be unavailable in a hardened browser; memory state still works. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Do not turn a storage quota/privacy mode into lost in-memory input. */ }
  }, [hydrated, key, value]);
  const clear = useCallback((nextValue: T) => {
    setValue(nextValue);
  }, []);
  return [value, setValue, clear];
}

function newMutationKey(): string {
  return `ui-${crypto.randomUUID()}`;
}

function RuntimeSync({ state, lastSyncedAt, onRetry }: {
  state: RuntimeSyncState;
  lastSyncedAt: number | null;
  onRetry: () => void;
}) {
  return <div className={styles.syncStatus} data-state={state} role="status" aria-live="polite">
    <span>{state === "offline" ? "连接中断 · 草稿保留在此设备" : state === "connecting" ? "正在同步课堂…" : "课堂已同步"}</span>
    {lastSyncedAt && <small>最近同步 {new Date(lastSyncedAt).toLocaleTimeString("zh-CN")}</small>}
    {state === "offline" && <button type="button" onClick={onRetry}>立即重连</button>}
  </div>;
}

function SeatView({ data, busy, submit, review }: {
  data: ClassroomInstanceDetail;
  busy: boolean;
  submit: (input: { kind?: string; text?: string; schemaId?: string; values?: Record<string, string>; expectedVersion: number; idempotencyKey: string }) => Promise<unknown>;
  review: (submissionId: string, status: "accepted" | "rejected", feedback: string, expectedVersion: number, idempotencyKey: string) => Promise<unknown>;
}) {
  const view = data.myView;
  const role = view?.kind === "mentor" ? `${view.mentorRole} 导师` : view?.kind === "learner" ? `Young Builder ${view.learnerNumber}` : "Admin DM";
  const courseware = view?.kind === "mentor" ? data.mentors.find((mentor) => mentor.mentorRole === view.mentorRole)?.courseware : null;
  const genericKind = view?.kind === "mentor" ? "mentor-note" : "learner-work";
  const savedGeneric = data.submissions.find((item) => item.profileId === data.viewer.viewProfileId && item.kind === genericKind);
  const genericDraftKey = classroomDraftKey(data, `generic:${genericKind}`);
  const [text, setText, clearTextDraft] = useDeviceDraft(genericDraftKey, savedGeneric?.text ?? "");
  const genericMutationKey = useRef(newMutationKey());
  return <>
    <RuntimeHeading data={data} eyebrow={`${data.environment.toUpperCase()} CLASSROOM · ${role}`} />
    <Progress data={data} />
    <div className={styles.taskGrid}>
      <section className={styles.card}>
        <small className={styles.eyebrow}>这一页只做一件事</small>
        <h2>{view && view.kind !== "controller" ? view.task : data.page.studentPrompt}</h2>
        <div className={styles.instruction}>已解锁剧本页 · 可以回看，不会改动课堂数据</div>
        {view?.kind === "learner" && <LearnerView data={data} view={view} />}
        {view?.kind === "mentor" && <MentorView data={data} view={view} courseware={courseware} />}
        {view?.kind === "controller" && <p>你在本课堂拥有 Admin DM 权限，但没有占用 P／D／M／O 导师席。请从顶部进入主控。</p>}
      </section>
      {view?.kind === "learner" && data.activitySchema
        ? <StructuredActivityForm key={`${data.runtimeIdentity.runId}:${data.viewer.viewProfileId}:${data.page.id}:${data.activitySchema.id}`} data={data} busy={busy} submit={submit} />
        : view?.kind === "mentor" && data.activitySchema?.mentorRubric
          ? <MentorStructuredReview data={data} busy={busy} review={review} />
          : view?.kind !== "controller" && <aside className={styles.card}>
        <small className={styles.eyebrow}>本页活动记录</small><h2>把结果留在 {data.page.id}</h2>
        <form className={styles.submission} onSubmit={async (event) => {
          event.preventDefault();
          const result = await submit({ kind: genericKind, text, expectedVersion: savedGeneric?.version ?? 0, idempotencyKey: genericMutationKey.current });
          if (result) { clearTextDraft(""); genericMutationKey.current = newMutationKey(); }
        }}>
          <label htmlFor="block-work">记录真实完成的内容。翻页和回看不会删除或重新提交它。</label>
          <textarea id="block-work" value={text} onChange={(event) => setText(event.target.value)} placeholder={data.page.learnerLens.done} minLength={2} maxLength={4000} required />
          <button className={styles.button} disabled={busy || text.trim().length < 2}>保存 {data.page.id} 活动记录</button>
        </form>
        {data.submissions.length > 0 && <div className={styles.submissions}><h3>已保存</h3>{data.submissions.map((item) => <article className={styles.submissionItem} key={`${item.profileId}:${item.kind}`}><b>{item.displayName}</b><small>{item.kind} · {item.status}</small><p>{item.text}</p></article>)}</div>}
      </aside>}
    </div>
  </>;
}

function StructuredActivityForm({ data, busy, submit }: {
  data: ClassroomInstanceDetail;
  busy: boolean;
  submit: (input: { schemaId?: string; values?: Record<string, string>; expectedVersion: number; idempotencyKey: string }) => Promise<unknown>;
}) {
  const schema = data.activitySchema!;
  const mine = data.submissions.find((item) => item.schemaId === schema.id && item.profileId === data.viewer.viewProfileId);
  const initialValues = Object.fromEntries(schema.fields.map((field) => [field.id, mine?.values?.[field.id] ?? ""]));
  const [values, setValues, clearValuesDraft] = useDeviceDraft(classroomDraftKey(data, `schema:${schema.id}`), initialValues);
  const mutationKey = useRef(newMutationKey());
  const valid = schema.fields.every((field) => {
    const value = (values[field.id] ?? "").trim();
    const itemCount = field.input === "list" ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).length : 0;
    return (!field.required || value.length > 0)
      && value.length >= field.minLength
      && value.length <= field.maxLength
      && (field.minItems === undefined || itemCount >= field.minItems)
      && (field.maxItems === undefined || itemCount <= field.maxItems);
  });
  return <aside className={`${styles.card} ${styles.structuredActivity}`}>
    <small className={styles.eyebrow}>团队交付物 · {schema.ownerMentorRole} 导师验收</small>
    <h2>{schema.name}</h2>
    <p>{schema.learnerIntro}</p>
    {mine && <div className={styles.submissionStatus} data-status={mine.status}>
      <b>{mine.status === "accepted" ? `✓ ${schema.ownerMentorRole} 导师已通过` : mine.status === "rejected" ? `↺ ${schema.ownerMentorRole} 导师已退回` : `已提交 · 等待 ${schema.ownerMentorRole} 导师`}</b>
      {mine.reviewFeedback && <span>导师建议：{mine.reviewFeedback}</span>}
    </div>}
    <form className={styles.structuredForm} onSubmit={async (event) => {
      event.preventDefault();
      const result = await submit({ schemaId: schema.id, values, expectedVersion: mine?.version ?? 0, idempotencyKey: mutationKey.current });
      if (result) { clearValuesDraft(values); mutationKey.current = newMutationKey(); }
    }}>
      {schema.fields.map((field, index) => <label key={field.id}>
        <span><b>{String(index + 1).padStart(2, "0")} · {field.label}</b><small>{field.learnerPrompt}</small></span>
        {field.input === "short-text"
          ? <input value={values[field.id] ?? ""} minLength={field.minLength} maxLength={field.maxLength} required={field.required} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))} />
          : <textarea value={values[field.id] ?? ""} minLength={field.minLength} maxLength={field.maxLength} required={field.required} placeholder={field.input === "list" ? "每行写一条" : "用具体的人、场景和动作写"} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))} />}
        {field.input === "list" && (field.minItems !== undefined || field.maxItems !== undefined) && <small>{field.minItems ?? 0}—{field.maxItems ?? "不限"} 条 · 每行一条</small>}
      </label>)}
      <button className={styles.button} disabled={busy || !valid}>{mine ? `重新提交给 ${schema.ownerMentorRole} 导师` : `提交给 ${schema.ownerMentorRole} 导师`}</button>
      <small>重新提交会回到“等待验收”；已解锁剧本、手牌、RP 和资金不会改变。</small>
    </form>
  </aside>;
}

function MentorStructuredReview({ data, busy, review }: {
  data: ClassroomInstanceDetail;
  busy: boolean;
  review: (submissionId: string, status: "accepted" | "rejected", feedback: string, expectedVersion: number, idempotencyKey: string) => Promise<unknown>;
}) {
  const schema = data.activitySchema!;
  const submissions = data.submissions.filter((item) => item.schemaId === schema.id);
  return <aside className={`${styles.card} ${styles.mentorReview}`}>
    <small className={styles.eyebrow}>{schema.ownerMentorRole} 导师工作台 · 结构化验收</small>
    <h2>{schema.name}</h2>
    <div className={styles.rubric}><b>只看这 {schema.mentorRubric?.length ?? 0} 件事</b><ol>{schema.mentorRubric?.map((item) => <li key={item}>{item}</li>)}</ol></div>
    {submissions.length
      ? <div className={styles.reviewList}>{submissions.map((submission) => <StructuredReviewCard key={submission.id} data={data} submission={submission} busy={busy} review={review} />)}</div>
      : <p>还没有学员汇总提交。先让团队把交付物各项内容说清，再由一位同学提交。</p>}
  </aside>;
}

function StructuredReviewCard({ data, submission, busy, review }: {
  data: ClassroomInstanceDetail;
  submission: ClassroomInstanceDetail["submissions"][number];
  busy: boolean;
  review: (submissionId: string, status: "accepted" | "rejected", feedback: string, expectedVersion: number, idempotencyKey: string) => Promise<unknown>;
}) {
  const schema = data.activitySchema!;
  const [feedback, setFeedback, clearFeedbackDraft] = useDeviceDraft(classroomDraftKey(data, `review:${submission.id}`), submission.reviewFeedback ?? "");
  const mutationKey = useRef(newMutationKey());
  const decide = async (status: "accepted" | "rejected") => {
    const result = await review(submission.id, status, feedback, submission.version, mutationKey.current);
    if (result) { clearFeedbackDraft(feedback); mutationKey.current = newMutationKey(); }
  };
  return <article className={styles.reviewCard} data-status={submission.status}>
    <header><div><b>{submission.displayName}</b><small>{submission.status === "accepted" ? "已通过" : submission.status === "rejected" ? "已退回" : "等待验收"}</small></div><time>{new Date(submission.updatedAt).toLocaleString("zh-CN")}</time></header>
    <dl>{schema.fields.map((field) => <div key={field.id}><dt>{field.label}<small>{"mentorPrompt" in field ? field.mentorPrompt : ""}</small></dt><dd>{submission.values?.[field.id] ?? "—"}</dd></div>)}</dl>
    <label><b>给学生的具体反馈</b><textarea value={feedback} maxLength={1000} onChange={(event) => setFeedback(event.target.value)} placeholder="退回时写清：哪一项不够具体、下一步去问谁或改什么。" /></label>
    <div className={styles.reviewActions}><button className={styles.secondary} disabled={busy} onClick={() => void decide("accepted")}>通过并进入下游交接</button><button className={styles.danger} disabled={busy || feedback.trim().length < 2} onClick={() => void decide("rejected")}>退回修改</button></div>
  </article>;
}

function LearnerView({ data, view }: { data: ClassroomInstanceDetail; view: Extract<NonNullable<ClassroomInstanceDetail["myView"]>, { kind: "learner" }> }) {
  return <>
    <div className={styles.lens}><div><b>你看到的世界</b>{data.page.learnerLens.world}</div><div><b>先讲给队友</b>{data.page.learnerLens.say}</div><div><b>再一起追问</b>{data.page.learnerLens.ask}</div><div><b>完成的样子</b>{data.page.learnerLens.done}</div></div>
    <h3>只有你先看到的情报卡</h3>
    <div className={styles.privateCards}>{view.privateCards.map((card) => { const boundary = BOUNDARY[card.boundary]; return <article className={styles.privateCard} data-boundary={card.boundary} key={card.id}><b>{boundary.short} · {card.title}</b><span>{boundary.title}</span><p>{card.body}</p><span><strong>讲给队友：</strong>{card.sharePrompt}</span></article>; })}</div>
    <p><strong>规则：</strong>先用自己的话讲卡片，再听队友讲；不要把推测说成史实。老师负责更复杂的历史边界。</p>
  </>;
}

function MentorView({ data, view, courseware }: {
  data: ClassroomInstanceDetail;
  view: Extract<NonNullable<ClassroomInstanceDetail["myView"]>, { kind: "mentor" }>;
  courseware: ClassroomInstanceDetail["courseware"][number] | null | undefined;
}) {
  const context = view.contentContext;
  return <>
    <p>本页分工：<b>{view.activity === "active" ? "建议你主讲" : view.activity === "support" ? "观察并支援" : "按需支援"}</b>。这不是权限限制；任一导师都可确认解锁下一页。</p>
    {context.mode === "owner" && context.checkpoint && <section className={styles.contentOwnership}>
      <small>{context.ownerMentorRole} 专属{context.ownerMentorRole === "P" ? "历史" : "课堂模拟"}剧本 · {context.scriptPackageId}</small>
      <h3>{context.checkpoint.title}</h3><p>{context.checkpoint.purpose}</p>
      <div><b>课件章节提示</b><span>{context.coursewareCue?.label} · 第 {context.coursewareCue?.slideStart}—{context.coursewareCue?.slideEnd} 页</span></div>
      <div><b>本检查点公开动作</b><span>{context.checkpoint.publicEvents.join("；")}</span></div>
    </section>}
    {context.mode === "handoff" && <section className={styles.handoffNotice}><small>{context.ownerMentorRole} → {view.mentorRole} · 已验收成果交接</small><p>{context.note}</p></section>}
    {view.privateScript.length > 0
      ? <><h3>当值导师私有提示</h3><ul>{view.privateScript.map((line) => <li key={line}>{line}</li>)}</ul></>
      : <p className={styles.standbyNote}>你当前不是主讲席：只显示自己的观察任务，不复制当值导师的私有讲稿。</p>}
    {courseware && <a className={styles.coursewareLink} href={`/classroom/${encodeURIComponent(data.id)}/courseware/${view.mentorRole}/`} target="_blank" rel="noreferrer">打开 {view.mentorRole} 导师 exact 课件 →</a>}
    {data.handoffs.length > 0 && <section className={styles.handoffArtifacts}><h3>已通过的上游交付物</h3>{data.handoffs.map((handoff) => <article key={handoff.submission.id}><header><b>{handoff.artifactName} · {handoff.submission.displayName}</b><span>{handoff.fromBlockId} 由 {handoff.fromMentorRole} 导师通过</span></header><dl>{Object.entries(handoff.submission.values ?? {}).map(([key, value]) => <div key={key}><dt>{handoff.fieldLabels[key] ?? key}</dt><dd>{value}</dd></div>)}</dl></article>)}</section>}
    <p>学员这一页的任务：{data.page.studentPrompt}</p>
  </>;
}

function RuntimeHeading({ data, eyebrow }: { data: ClassroomInstanceDetail; eyebrow: string }) {
  return <section className={styles.runtimeHeading}><div><small>{eyebrow}</small><h1>{data.page.id} · {data.page.title}</h1><p>{data.course.title} · 第 {data.page.macroStepOrder}/5 步 · 我的页 {data.scriptNavigation.viewedIndex + 1}/{data.course.blockCount} · 已解锁至 {data.script.unlockedThroughBlockId}</p></div><div className={styles.balance}><span><b>{data.economy.personalRp} RP</b><small>我的声望</small></span><span><b>{(data.economy.personalWalletTenths / 10).toFixed(1)} C</b><small>我的钱包</small></span><span><b>{(data.economy.teamTreasuryTenths / 10).toFixed(1)} C</b><small>团队资金</small></span></div></section>;
}

function Progress({ data }: { data: ClassroomInstanceDetail }) {
  return <div className={styles.progress} aria-label={`已解锁 ${data.script.unlockedThroughIndex + 1}/${data.course.blockCount}，正在看第 ${data.scriptNavigation.viewedIndex + 1} 页`}>{Array.from({ length: data.course.blockCount }, (_, index) => <span key={index} data-done={index <= data.script.unlockedThroughIndex} data-current={index === data.scriptNavigation.viewedIndex} />)}</div>;
}

function ControlView({ data, busy, requestUnlock, requestFinish, reset, receipt }: {
  data: ClassroomInstanceDetail;
  busy: boolean;
  requestUnlock: () => void;
  requestFinish: () => void;
  reset: () => Promise<unknown>;
  receipt: (checks: TestReceiptChecks) => Promise<unknown>;
}) {
  const [receiptChecks, setReceiptChecks] = useState<TestReceiptChecks>(() => Object.fromEntries(UI_ACCEPTANCE_CHECKLIST.map((item) => [item.id, false])) as TestReceiptChecks);
  const control = data.controlView;
  if (!control) return <section className={styles.card}><h1>没有主持提示权限</h1></section>;
  const atFrontier = data.scriptNavigation.viewedIndex === data.script.unlockedThroughIndex;
  const allUnlocked = data.script.unlockedThroughIndex === data.course.blockCount - 1;
  return <>
    <RuntimeHeading data={data} eyebrow="LIVE RUN SCRIPT · HOST NOTES" /><Progress data={data} />
    <div className={styles.controlGrid}>
      <section className={styles.scriptBlock}>
        <small>主持提示 · {data.page.id} · 解锁边界 {data.script.unlockedThroughBlockId}</small><h2>{data.page.title}</h2>
        <span className={styles.state}>{atFrontier ? "最新已解锁页" : "正在回看历史页"}</span>
        <p><b>建议主导师：</b>{data.page.leadMentorId.replace("mentor01", "P 产品").replace("mentor02", "D 开发").replace("mentor03", "M 市场").replace("mentor04", "O 运营")}（建议，不是权限）</p>
        <h3>本页系统动作</h3><ol>{control.systemActions.map((item) => <li key={item}>{item}</li>)}</ol>
        <h3>主持观察提示</h3><ol>{control.acceptance.map((item) => <li key={item}>{item}</li>)}</ol>
        <div className={styles.controlActions}>
          {atFrontier && !allUnlocked && data.scriptNavigation.canUnlockNext && <button className={styles.button} disabled={busy} onClick={requestUnlock}>确认解锁 {data.scriptNavigation.nextLocked?.id}</button>}
          {!atFrontier && <p>你正在回看；使用上方“回到最新解锁”后才能继续解锁。</p>}
          {allUnlocked && data.lifecycle !== "completed" && <div className={styles.finishCallout}><b>全部剧本页已经解锁，但课堂还没有结束。</b><p>请先讲完结尾与 Demo／复盘，再单独确认结束。解锁末页不会自动代表作品或课堂完成。</p><button className={styles.button} disabled={busy || !atFrontier} onClick={requestFinish}>{atFrontier ? "确认结束本次课堂" : "先回到最新解锁页"}</button></div>}
          {allUnlocked && data.lifecycle === "completed" && <div className={styles.receiptSuccess}><b>✓ 本次课堂已明确结束</b><code>{data.runtimeIdentity.runId}</code></div>}
          {allUnlocked && data.lifecycle === "completed" && data.environment === "test" && data.acceptance.uiReceiptId && <div className={styles.receiptSuccess}><b>✓ UiAcceptanceReceipt 已签发</b><code>{data.acceptance.uiReceiptId}</code><br/><Link href="/studio/releases/">返回验收与发布 →</Link></div>}
          {allUnlocked && data.lifecycle === "completed" && data.environment === "test" && !data.acceptance.uiReceiptId && data.isAdminDm && <fieldset className={styles.receiptChecks}>
            <legend>签发回执前，逐项确认真实 Test Classroom</legend>
            {UI_ACCEPTANCE_CHECKLIST.map((item) => <label key={item.id}><input type="checkbox" checked={receiptChecks[item.id]} onChange={(event) => setReceiptChecks((current) => ({ ...current, [item.id]: event.target.checked }))} />{item.label}</label>)}
            <button className={styles.button} disabled={busy || Object.values(receiptChecks).some((value) => !value)} onClick={() => receipt(receiptChecks)}>签发 UiAcceptanceReceipt</button>
          </fieldset>}
          {allUnlocked && data.lifecycle === "completed" && data.environment === "test" && !data.acceptance.uiReceiptId && !data.isAdminDm && <p>所有角色都可以完成视图验收；不可变的 UiAcceptanceReceipt 由本课堂 Admin DM 签发。</p>}
          {data.environment === "test" && data.isAdminDm && <button className={styles.danger} disabled={busy} onClick={reset}>重置 Test 实例</button>}
        </div>
      </section>
      <aside className={styles.card}><small className={styles.eyebrow}>这一页的现场雷达</small><h2>{data.mentors.length} 导师 + {data.learners.length} 学员</h2><div className={styles.people}>{data.mentors.map((item) => <div className={styles.person} data-ready key={item.mentorRole}><b>{item.mentorRole} · {item.displayName}</b><small>导师 Membership</small></div>)}{data.learners.map((item) => <div className={styles.person} data-ready={data.submissions.some((submission) => submission.profileId === item.profileId)} key={item.profileId}><b>{item.seat} · {item.displayName}</b><small>{data.submissions.some((submission) => submission.profileId === item.profileId) ? "本页已保存记录" : "本页尚无记录"}</small></div>)}</div><h3>本页活动记录</h3><div className={styles.submissions}>{data.submissions.length ? data.submissions.map((item) => <article className={styles.submissionItem} key={`${item.profileId}:${item.kind}`}><b>{item.displayName}</b><small>{item.kind}</small><p>{item.text}</p></article>) : <p>还没有人保存记录；这不阻止剧本翻页或解锁。</p>}</div></aside>
    </div>
  </>;
}

function MembersView({ data }: { data: ClassroomInstanceDetail }) {
  if (!data.isAdminDm) return <section className={styles.card}><h1>需要 Admin DM 权限</h1></section>;
  return <><RuntimeHeading data={data} eyebrow="MEMBERSHIP · EXACT BINDINGS" /><div className={styles.membersGrid}>
    <section className={styles.membersList}><h2>P／D／M／O 导师席</h2><ul>{data.mentors.map((item) => <li key={item.mentorRole}><span><b>{item.mentorRole} · {item.displayName}</b><br /><code>{item.profileId}</code></span><a className={styles.coursewareLink} href={`/classroom/${encodeURIComponent(data.id)}/courseware/${item.mentorRole}/`} target="_blank" rel="noreferrer">课件 r{item.courseware.revision}</a></li>)}</ul></section>
    <section className={styles.membersList}><h2>{data.learners.length}/{data.team.seatLimit} 学员 Membership</h2><ul>{data.learners.map((item) => <li key={item.profileId}><span><b>席位 {item.seat} · {item.displayName}</b><br /><code>{item.profileId}</code></span></li>)}</ul></section>
    <section className={styles.membersList}><h2>Admin DM 权限</h2><p>Primary 可以委派；Delegated 可以管理课堂，但不能继续授权。</p><ul>{data.admins.map((item) => <li key={item.profileId}><span><b>{item.displayName}</b><br /><code>{item.profileId}</code></span><span className={styles.state}>{item.mode === "primary" ? "PRIMARY · 可委派" : "DELEGATED · 不可转授"}</span></li>)}</ul></section>
    <section className={styles.membersList}><h2>锁定的版本</h2><ul><li><span><b>CourseRelease r{data.courseRef.revision}</b><br /><code>{data.courseRef.digest}</code></span></li>{data.courseware.map((item) => <li key={item.mentorRole}><span><b>{item.mentorRole} · {item.slug} · r{item.revision}</b><br /><code>{item.digest}</code></span></li>)}</ul></section>
  </div>{data.archive ? <section className={styles.archiveRuntimeBanner}><div><b>成员与账号管理已冻结</b><span>归档课堂只用于审计回看；要更换席位或账号，请创建新的 Test Classroom。</span></div></section> : <><MemberActions data={data} />{data.environment === "test" && data.viewer.platformRole === "admin" && !data.viewer.impersonationId && <TestIdentityManager data={data} />}</>}</>;
}

type Assignable = {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "mentor" | "learner";
  hasMembership: boolean;
  hasAdminDm: boolean;
  inClassroom: boolean;
};
function MemberActions({ data }: { data: ClassroomInstanceDetail }) {
  const [accounts, setAccounts] = useState<Assignable[]>([]);
  const [actionType, setActionType] = useState<"replace-learner" | "replace-mentor" | "grant-admin-dm" | "revoke-admin-dm">("replace-learner");
  const [seat, setSeat] = useState(1);
  const [mentorRole, setMentorRole] = useState<"P" | "D" | "M" | "O">("P");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [newRole, setNewRole] = useState<"mentor" | "learner">("learner");
  const [newCount, setNewCount] = useState(1);
  const [prefix, setPrefix] = useState("test-builder");
  const [issued, setIssued] = useState<Array<{ username: string; displayName: string; role: string; initialPassword: string }>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setAccounts(await api<Assignable[]>(`/api/platform/classrooms/${data.id}/members`)); }
    catch (cause) { setMessage(messageOf(cause)); }
  }, [data.id]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  const choices = useMemo(() => actionType === "replace-learner" ? accounts.filter((item) => item.role === "learner" && !item.hasMembership)
    : actionType === "replace-mentor" ? accounts.filter((item) => (item.role === "mentor" || item.role === "admin") && !item.hasMembership)
      : actionType === "revoke-admin-dm" ? data.admins.filter((item) => item.mode === "delegated").map((item) => ({ userId: item.profileId, username: item.profileId, displayName: item.displayName, role: "mentor" as const, hasMembership: false, hasAdminDm: true, inClassroom: true }))
        : accounts.filter((item) => item.role === "mentor" && !item.hasAdminDm), [accounts, actionType, data.admins]);
  const profileId = choices.some((item) => item.userId === selectedProfileId) ? selectedProfileId : choices[0]?.userId ?? "";
  const change = async () => {
    if (!profileId) return setMessage("请先选择目标账号。");
    setBusy(true); setMessage("");
    try {
      await api(`/api/platform/classrooms/${data.id}/members`, { method: "POST", body: JSON.stringify({ type: actionType, profileId, seat, mentorRole }) });
      setMessage("成员与权限已经更新；课堂列表会自动同步。"); await refresh();
    } catch (cause) { setMessage(messageOf(cause)); }
    finally { setBusy(false); }
  };
  const create = async () => {
    const stamp = Date.now().toString().slice(-6);
    setBusy(true); setMessage("");
    try {
      const result = await api<Array<{ username: string; displayName: string; role: string; initialPassword: string }>>(`/api/platform/classrooms/${data.id}/accounts`, {
        method: "POST",
        body: JSON.stringify({ accounts: Array.from({ length: newCount }, (_, index) => ({ username: `${prefix}-${stamp}-${index + 1}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"), displayName: `${newRole === "mentor" ? "新导师" : "Young Builder"} ${index + 1}`, role: newRole })) }),
      });
      setIssued(result); setMessage(`已创建 ${result.length} 个账号；初始密码只显示这一次。`); await refresh();
    } catch (cause) { setMessage(messageOf(cause)); }
    finally { setBusy(false); }
  };
  const relinquish = async () => {
    setBusy(true); setMessage("");
    try {
      await api(`/api/platform/classrooms/${data.id}/members`, { method: "POST", body: JSON.stringify({ type: "relinquish-admin-dm" }) });
      window.location.replace(`/classroom/${data.id}/`);
    } catch (cause) { setMessage(messageOf(cause)); setBusy(false); }
  };
  return <section className={manageStyles.manage}>
    <div><small className={styles.eyebrow}>ADMIN DM · MEMBERSHIP</small><h2>成员与权限操作</h2><p>导师／学员席只可在开课前替换；{data.canDelegateAdminDm ? "你是 Primary Admin DM，可以委派导师。" : "你是 Delegated Admin DM，不能授予或撤销他人权限。"} 所有操作均写审计事件。</p>
      <label>操作<select value={actionType} onChange={(event) => { setActionType(event.target.value as typeof actionType); setSelectedProfileId(""); }}><option value="replace-learner">替换学员席</option><option value="replace-mentor">替换导师席</option>{data.canDelegateAdminDm && <option value="grant-admin-dm">授予 Delegated Admin DM</option>}{data.canDelegateAdminDm && <option value="revoke-admin-dm">撤销 Delegated Admin DM</option>}</select></label>
      {actionType === "replace-learner" && <label>学员席<select value={seat} onChange={(event) => setSeat(Number(event.target.value))}>{data.learners.map((item) => <option key={item.seat} value={item.seat}>{item.seat} · {item.displayName}</option>)}</select></label>}
      {actionType === "replace-mentor" && <label>导师席<select value={mentorRole} onChange={(event) => setMentorRole(event.target.value as typeof mentorRole)}>{(["P", "D", "M", "O"] as const).map((role) => <option value={role} key={role}>{role} 导师</option>)}</select></label>}
      <label>目标账号<select value={profileId} onChange={(event) => setSelectedProfileId(event.target.value)}><option value="">请选择</option>{choices.map((item) => <option value={item.userId} key={item.userId}>{item.displayName} · @{item.username}</option>)}</select></label>
      <button className={styles.button} disabled={busy || !profileId} onClick={change}>确认操作</button>
      {data.adminDmMode === "delegated" && !data.viewer.impersonationId && <button className={styles.danger} disabled={busy} onClick={() => void relinquish()}>退出本课堂 Admin DM</button>}
    </div>
    {!data.viewer.impersonationId && <div><small className={styles.eyebrow}>ONE-TIME CREDENTIALS</small><h2>为本课堂创建账号</h2><p>账号属于平台，可继续加入其他课堂；创建不会自动占席，请再使用左侧操作绑定。</p>
      <label>角色<select value={newRole} onChange={(event) => setNewRole(event.target.value as typeof newRole)}><option value="learner">学员</option><option value="mentor">导师</option></select></label><label>数量<input type="number" min="1" max="12" value={newCount} onChange={(event) => setNewCount(Math.min(12, Math.max(1, Number(event.target.value))))} /></label><label>用户名开头<input value={prefix} onChange={(event) => setPrefix(event.target.value)} /></label><button className={styles.secondary} disabled={busy} onClick={create}>生成账号与一次性密码</button>
      {issued.length > 0 && <div className={styles.credentialGrid}>{issued.map((item) => <code key={item.username}>@{item.username}<br />{item.initialPassword}</code>)}</div>}
    </div>}
    {message && <p className={manageStyles.message}>{message}</p>}
  </section>;
}

type TestIdentity = {
  userId: string;
  username: string;
  displayName: string;
  role: "mentor" | "learner" | "observer";
  status: "active" | "disabled";
  mentorRole: "P" | "D" | "M" | "O" | null;
  learnerSeat: number | null;
  adminDmMode: "primary" | "delegated" | null;
  mustChangePassword: boolean;
  lastSeenAt: string | null;
};

function TestIdentityManager({ data }: { data: ClassroomInstanceDetail }) {
  const [identities, setIdentities] = useState<TestIdentity[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [credential, setCredential] = useState<{ username: string; initialPassword: string } | null>(null);
  const loadIdentities = useCallback(async () => {
    setIdentities(await api<TestIdentity[]>(`/api/platform/classrooms/${data.id}/test-identities`));
  }, [data.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadIdentities().catch((cause) => setError(messageOf(cause)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadIdentities]);
  const assume = async (identity: TestIdentity) => {
    setBusyId(identity.userId); setError("");
    try {
      await api("/api/auth/impersonation", {
        method: "POST",
        body: JSON.stringify({ classroomId: data.id, effectiveProfileId: identity.userId }),
      });
      window.location.replace(`/classroom/${data.id}/`);
    } catch (cause) { setError(messageOf(cause)); setBusyId(""); }
  };
  const manage = async (identity: TestIdentity, action: "disable" | "activate" | "reset-credential") => {
    setBusyId(identity.userId); setError(""); setCredential(null);
    try {
      const result = await api<{ credential?: { username: string; initialPassword: string } }>(`/api/platform/classrooms/${data.id}/test-identities`, {
        method: "POST",
        body: JSON.stringify({ action, targetProfileId: identity.userId }),
      });
      if (result.credential) setCredential(result.credential);
      await loadIdentities();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusyId(""); }
  };
  return <section className={manageStyles.manage} id="test-identities">
    <div className={manageStyles.identityManager}>
      <small className={styles.eyebrow}>TEST ONLY · ACCOUNT ISOLATION</small><h2>切换测试身份</h2>
      <p>保持真实管理员会话，仅在这一个 Test Classroom 内临时查看导师或学员视角。不会知道目标密码，也不能进入 Studio、账户中心、其他课堂或 Production。</p>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {credential && <div className={manageStyles.oneTimeCredential} role="status"><b>一次性初始密码 · 仅显示这一次</b><code>@{credential.username}<br />{credential.initialPassword}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(`${credential.username}\t${credential.initialPassword}`); }}>复制账号与密码</button><button type="button" onClick={() => setCredential(null)}>我已保存</button></div>}
      <div className={manageStyles.identityGrid}>{identities.map((identity) => <article key={identity.userId}>
        <div><b>{identity.displayName}</b><small>@{identity.username} · {identity.mentorRole ? `${identity.mentorRole} 导师` : identity.learnerSeat ? `Young Builder ${identity.learnerSeat}` : identity.role}{identity.adminDmMode ? ` · ${identity.adminDmMode === "primary" ? "Primary" : "Delegated"} Admin DM` : ""}</small><small>{identity.status === "active" ? "可登录" : "已停用"} · {identity.mustChangePassword ? "首次改密待完成" : "密码已启用"}{identity.lastSeenAt ? ` · 最近 ${new Date(identity.lastSeenAt).toLocaleString("zh-CN")}` : ""}</small></div>
        <span className={manageStyles.identityActions}><button type="button" disabled={Boolean(busyId) || identity.status !== "active"} onClick={() => void assume(identity)}>{busyId === identity.userId ? "处理中…" : "以此身份进入"}</button><button type="button" disabled={Boolean(busyId) || identity.status !== "active"} onClick={() => void manage(identity, "reset-credential")}>重发一次性密码</button><button type="button" disabled={Boolean(busyId) || identity.adminDmMode === "primary"} onClick={() => void manage(identity, identity.status === "active" ? "disable" : "activate")}>{identity.status === "active" ? "停用" : "启用"}</button></span>
      </article>)}</div>
    </div>
  </section>;
}

function SharedScreen({ data }: { data: ClassroomSharedScreenDetail }) {
  return <main className={styles.screen}><small>{data.environment.toUpperCase()} · 第 {data.page.macroStepOrder}/5 步 · {data.page.id}</small><h1>{data.page.title}</h1><p>{data.page.studentPrompt}</p><div className={styles.instruction}>已解锁课堂页 · 投屏独立翻阅</div><footer><span>{data.course.title}</span><span>{data.scriptNavigation.viewedIndex + 1}/{data.course.blockCount} · 已解锁至 {data.script.unlockedThroughBlockId} · {data.learnerCount} 位 Young Builder</span></footer></main>;
}

function toSharedScreen(data: ClassroomInstanceDetail): ClassroomSharedScreenDetail {
  return {
    id: data.id,
    title: data.title,
    environment: data.environment,
    lifecycle: data.lifecycle,
    learnerCount: data.learnerCount,
    course: { title: data.course.title, blockCount: data.course.blockCount },
    page: { id: data.page.id, title: data.page.title, macroStepOrder: data.page.macroStepOrder, studentPrompt: data.page.studentPrompt },
    script: data.script,
    scriptNavigation: { ...data.scriptNavigation, nextLocked: null, canUnlockNext: false },
  };
}

function factoryHrefForArchived(data: ClassroomInstanceDetail): string {
  const query = new URLSearchParams({
    course: data.courseRef.courseId,
    revision: String(data.courseRef.revision),
    digest: data.courseRef.digest,
    environment: "test",
    ...(data.acceptance.viewReceiptId ? { viewReceipt: data.acceptance.viewReceiptId } : {}),
  });
  return `/classroom/?${query.toString()}#factory`;
}

function RuntimeError({ error }: { error: string }) { return <main className={styles.runtime}><div className={styles.runtimeMain}><div className={styles.error} role="alert"><b>无法进入课堂</b><p>{error}</p></div><Link className={styles.coursewareLink} href="/classroom/">返回我的课堂</Link></div></main>; }

function currentClientMatrix() {
  const navigatorWithClientHints = navigator as Navigator & { userAgentData?: { platform?: string } };
  return [{
    browser: navigator.userAgent.slice(0, 240),
    platform: (navigatorWithClientHints.userAgentData?.platform || navigator.platform || "unknown").slice(0, 120),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  }];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers, cache: "no-store", ...init });
  const body = await response.json() as { ok?: boolean; data?: T; error?: { code?: string; message?: string } };
  if (!response.ok || body.ok === false) throw new ApiRequestError(body.error?.message || `请求失败（${response.status}）`, response.status, body.error?.code ?? "REQUEST_FAILED");
  return body.data as T;
}
class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = "ApiRequestError"; }
}
function isAbortError(value: unknown): boolean { return value instanceof DOMException && value.name === "AbortError"; }
function messageOf(value: unknown): string { return value instanceof Error ? value.message : "操作没有完成，请重试。"; }
