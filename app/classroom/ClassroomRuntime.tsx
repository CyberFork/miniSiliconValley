"use client";
import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClassroomControllerAction } from "../lib/classroom-factory";
import type { ClassroomInstanceDetail, ClassroomSharedScreenDetail } from "../lib/classroom-platform-store";
import styles from "./platform.module.css";
import manageStyles from "./platform-manage.module.css";

type RuntimeView = "seat" | "control" | "members";
type RuntimeProps = { classroomId: string; view: RuntimeView; signOutPath?: string };
const UI_ACCEPTANCE_CHECKLIST = [
  ["sameRuntimeUi", "Test 与 Production 使用同一套页面、API 与状态机"],
  ["membershipsAndRbac", "四导师、N 学员、Admin DM 的 Membership 与 RBAC 均正确"],
  ["mentorTasksAndCourseware", "四位导师各自看到正确任务与 exact 课件入口"],
  ["learnerTasks", "每名学员都能看懂并完成当前私人任务"],
  ["learnerPrivacy", "学员只看到自己的私密卡、RP 与个人钱包"],
  ["sharedScreenRedaction", "公共投屏未泄漏手牌、讲稿、账号、钱包或未公开提交"],
  ["blockLifecycle", "执行、提交、退回、重试、接受和推进均已实测"],
  ["fiveStepCompletion", "五大步及全部 Block 已在真实 UI 中完整走完"],
  ["refreshAndRelogin", "刷新和重新登录后，席位、手牌与课堂进度保持正确"],
  ["concurrencyConflict", "旧版本并发操作被拒绝，没有覆盖较新的中控状态"],
  ["testReset", "Test reset 已实测且只重置本课堂，不影响其他实例"],
  ["responsiveLayouts", "手机、电脑与公共投屏尺寸均已人工检查"],
  ["immutableRuntime", "Studio 后续保存没有热更新正在运行的课堂"],
  ["exactVersions", "课程与 P／D／M／O 课件 revision／digest 与锁定值一致"],
] as const;
type TestReceiptCheckKey = (typeof UI_ACCEPTANCE_CHECKLIST)[number][0];
type TestReceiptChecks = Record<TestReceiptCheckKey, boolean>;
const STATE_LABEL: Record<string, string> = {
  ready: "等待主控开始", executing: "本块执行中", "awaiting-acceptance": "等待主控验收",
  accepted: "本块已通过", completed: "课程已完成", error: "需要主控处理",
};
const BOUNDARY = {
  F: { short: "F 有来源", title: "有来源的事实" },
  R: { short: "R 课堂模拟", title: "课堂平行世界中的模拟" },
  G: { short: "G 我们猜的", title: "团队推测，需要验证" },
  U: { short: "U 还不知道", title: "当前未知，需要调查" },
} as const;

export default function ClassroomRuntime({ classroomId, view, signOutPath = "/auth/logout" }: RuntimeProps) {
  const [data, setData] = useState<ClassroomInstanceDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (quiet = false) => {
    try { setData(await api<ClassroomInstanceDetail>(`/api/platform/classrooms/${encodeURIComponent(classroomId)}`)); if (!quiet) setError(""); }
    catch (cause) { if (!quiet) setError(messageOf(cause)); }
  }, [classroomId]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 4_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load, view]);

  const mutate = async <T,>(path: string, body: unknown, success: string): Promise<T | null> => {
    setBusy(true); setError("");
    try { const result = await api<T>(path, { method: "POST", body: JSON.stringify(body) }); setNotice(success); await load(); return result; }
    catch (cause) { setError(messageOf(cause)); return null; }
    finally { setBusy(false); }
  };

  if (error && !data) return <RuntimeError error={error} />;
  if (!data) return <main className={styles.runtime}><div className={styles.runtimeMain}>正在连接这一个 Classroom 实例…</div></main>;
  return <main className={styles.runtime}>
    <RuntimeTop data={data} classroomId={classroomId} signOutPath={signOutPath} />
    <div className={styles.runtimeMain}>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {view === "seat" && <SeatView data={data} busy={busy} submit={(kind, text) => mutate(`/api/platform/classrooms/${classroomId}/submissions`, { kind, text }, "已保存到本课堂当前 Block。")} />}
      {view === "control" && <ControlView data={data} busy={busy} act={(action) => mutate(`/api/platform/classrooms/${classroomId}/control`, { expectedVersion: data.controller.version, action }, "主控已推进，所有成员会在下一次同步时看到变化。")}
        reset={() => mutate(`/api/platform/classrooms/${classroomId}/reset`, {}, "Test Classroom 已回到初始状态。")}
        receipt={(checks) => mutate(`/api/platform/classrooms/${classroomId}/receipt`, { checks, clientMatrix: currentClientMatrix() }, "UiAcceptanceReceipt 已生成；返回 Course Studio 即可通过两级门禁发布该 Candidate。")}
      />}
      {view === "members" && <MembersView data={data} />}
    </div>
  </main>;
}

/** Live shared display backed by a dedicated allow-list API projection. */
export function ClassroomScreenRuntime({ classroomId }: { classroomId: string }) {
  const [data, setData] = useState<ClassroomSharedScreenDetail | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async (quiet = false) => {
    try {
      setData(await api<ClassroomSharedScreenDetail>(`/api/platform/classrooms/${encodeURIComponent(classroomId)}/screen`));
      if (!quiet) setError("");
    } catch (cause) {
      if (!quiet) setError(messageOf(cause));
    }
  }, [classroomId]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 2_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);
  if (error && !data) return <RuntimeError error={error} />;
  if (!data) return <main className={styles.runtime}><div className={styles.runtimeMain}>正在连接课堂共享画面…</div></main>;
  return <SharedScreen data={data} />;
}

function RuntimeTop({ data, classroomId, signOutPath }: { data: ClassroomInstanceDetail; classroomId: string; signOutPath: string }) {
  return <header className={styles.runtimeTop}>
    <Link href="/classroom/"><b>MSV · {data.title}</b></Link>
    <nav aria-label="课堂内导航"><Link href={`/classroom/${classroomId}/`}>我的席位</Link>{data.isAdminDm && <Link href={`/classroom/${classroomId}/control`}>主控</Link>}<a href={`/classroom/${classroomId}/screen`} target="_blank" rel="noreferrer">投屏</a>{data.isAdminDm && <Link href={`/classroom/${classroomId}/members`}>成员</Link>}<a href={signOutPath}>退出</a></nav>
  </header>;
}

function SeatView({ data, busy, submit }: { data: ClassroomInstanceDetail; busy: boolean; submit: (kind: string, text: string) => Promise<unknown> }) {
  const [text, setText] = useState("");
  const view = data.myView;
  const role = view?.kind === "mentor" ? `${view.mentorRole} 导师` : view?.kind === "learner" ? `Young Builder ${view.learnerNumber}` : "Admin DM";
  const courseware = view?.kind === "mentor" ? data.mentors.find((mentor) => mentor.mentorRole === view.mentorRole)?.courseware : null;
  return <>
    <RuntimeHeading data={data} eyebrow={`${data.environment.toUpperCase()} CLASSROOM · ${role}`} />
    <Progress data={data} />
    <div className={styles.taskGrid}>
      <section className={styles.card}>
        <small className={styles.eyebrow}>现在只做这一件事</small>
        <h2>{view && view.kind !== "controller" ? view.task : data.currentBlock.studentPrompt}</h2>
        <div className={styles.instruction}>{STATE_LABEL[data.controller.state] ?? data.controller.state}</div>
        {view?.kind === "learner" && <LearnerView data={data} view={view} />}
        {view?.kind === "mentor" && <MentorView data={data} view={view} courseware={courseware} />}
        {view?.kind === "controller" && <p>你在本课堂拥有 Admin DM 权限，但没有占用 P／D／M／O 导师席。请从顶部进入主控。</p>}
      </section>
      <aside className={styles.card}>
        <small className={styles.eyebrow}>交付本块证据</small><h2>把结果留在课堂</h2>
        <form className={styles.submission} onSubmit={async (event) => { event.preventDefault(); await submit(view?.kind === "mentor" ? "mentor-note" : "learner-work", text); setText(""); }}>
          <label htmlFor="block-work">写下你真实完成的内容；不需要猜老师心里的标准。</label>
          <textarea id="block-work" value={text} onChange={(event) => setText(event.target.value)} placeholder={data.currentBlock.learnerLens.done} minLength={2} maxLength={4000} required />
          <button className={styles.button} disabled={busy || text.trim().length < 2}>提交当前 Block 证据</button>
        </form>
        {data.submissions.length > 0 && <div className={styles.submissions}><h3>已保存</h3>{data.submissions.map((item) => <article className={styles.submissionItem} key={`${item.profileId}:${item.kind}`}><b>{item.displayName}</b><small>{item.kind} · {item.status}</small><p>{item.text}</p></article>)}</div>}
      </aside>
    </div>
  </>;
}

function LearnerView({ data, view }: { data: ClassroomInstanceDetail; view: Extract<NonNullable<ClassroomInstanceDetail["myView"]>, { kind: "learner" }> }) {
  return <>
    <div className={styles.lens}><div><b>你看到的世界</b>{data.currentBlock.learnerLens.world}</div><div><b>先讲给队友</b>{data.currentBlock.learnerLens.say}</div><div><b>再一起追问</b>{data.currentBlock.learnerLens.ask}</div><div><b>完成的样子</b>{data.currentBlock.learnerLens.done}</div></div>
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
  return <>
    <p>本块状态：<b>{view.activity === "active" ? "你主导" : view.activity === "support" ? "你观察支援" : "本块待命"}</b>。学生先经历，再由你命名方法。</p>
    <h3>导师私有提示</h3><ul>{view.privateScript.map((line) => <li key={line}>{line}</li>)}</ul>
    {courseware && <a className={styles.coursewareLink} href={`/course/${courseware.slug}/?revision=${courseware.revision}`} target="_blank" rel="noreferrer">打开 {view.mentorRole} 导师 exact 课件 →</a>}
    <p>学员当前任务：{data.currentBlock.studentPrompt}</p>
  </>;
}

function RuntimeHeading({ data, eyebrow }: { data: ClassroomInstanceDetail; eyebrow: string }) {
  return <section className={styles.runtimeHeading}><div><small>{eyebrow}</small><h1>{data.currentBlock.id} · {data.currentBlock.title}</h1><p>{data.course.title} · 第 {data.currentBlock.macroStepOrder}/5 步 · Block {data.controller.blockIndex + 1}/{data.course.blockCount}</p></div><div className={styles.balance}><span><b>{data.economy.personalRp} RP</b><small>我的声望</small></span><span><b>{(data.economy.personalWalletTenths / 10).toFixed(1)} C</b><small>我的钱包</small></span><span><b>{(data.economy.teamTreasuryTenths / 10).toFixed(1)} C</b><small>团队资金</small></span></div></section>;
}

function Progress({ data }: { data: ClassroomInstanceDetail }) {
  return <div className={styles.progress} aria-label={`课程进度 ${data.controller.blockIndex + 1}/${data.course.blockCount}`}>{Array.from({ length: data.course.blockCount }, (_, index) => <span key={index} data-done={index < data.controller.blockIndex} data-current={index === data.controller.blockIndex} />)}</div>;
}

function ControlView({ data, busy, act, reset, receipt }: {
  data: ClassroomInstanceDetail;
  busy: boolean;
  act: (action: ClassroomControllerAction) => Promise<unknown>;
  reset: () => Promise<unknown>;
  receipt: (checks: TestReceiptChecks) => Promise<unknown>;
}) {
  const [receiptChecks, setReceiptChecks] = useState<TestReceiptChecks>(() => Object.fromEntries(UI_ACCEPTANCE_CHECKLIST.map(([key]) => [key, false])) as TestReceiptChecks);
  const control = data.controlView;
  if (!data.isAdminDm || !control) return <section className={styles.card}><h1>需要 Admin DM 权限</h1><p>导师席与 Admin DM 权限相互独立。请让本课堂管理员授予权限。</p></section>;
  const state = data.controller.state;
  const last = data.controller.blockIndex === data.course.blockCount - 1;
  return <>
    <RuntimeHeading data={data} eyebrow="LIVE RUN SCRIPT · INSTANCE CONTROL" /><Progress data={data} />
    <div className={styles.controlGrid}>
      <section className={styles.scriptBlock}>
        <small>当前块 · {data.currentBlock.id} · 尝试 {data.controller.attempt}</small><h2>{data.currentBlock.title}</h2>
        <span className={styles.state}>{STATE_LABEL[state] ?? state}</span>
        <p><b>主导师：</b>{data.currentBlock.leadMentorId.replace("mentor01", "P 产品").replace("mentor02", "D 开发").replace("mentor03", "M 市场").replace("mentor04", "O 运营")}</p>
        <h3>系统动作</h3><ol>{control.systemActions.map((item) => <li key={item}>{item}</li>)}</ol>
        <h3>人工验收门</h3><ol>{control.acceptance.map((item) => <li key={item}>{item}</li>)}</ol>
        {data.controller.errorMessage && <div className={styles.error}>{data.controller.errorMessage}</div>}
        <div className={styles.controlActions}>
          {state === "ready" && <button className={styles.button} disabled={busy} onClick={() => act({ type: "execute" })}>执行当前块</button>}
          {state === "executing" && <button className={styles.button} disabled={busy} onClick={() => act({ type: "submit-for-acceptance" })}>收齐现场结果，进入验收</button>}
          {state === "awaiting-acceptance" && <><button className={styles.button} disabled={busy} onClick={() => act({ type: "accept" })}>验收通过</button><button className={styles.danger} disabled={busy} onClick={() => act({ type: "reject", message: "证据还不够具体，请补充后重试。" })}>退回补证据</button></>}
          {state === "accepted" && (last ? <button className={styles.button} disabled={busy} onClick={() => act({ type: "complete" })}>完成整门课程</button> : <button className={styles.button} disabled={busy} onClick={() => act({ type: "advance" })}>进入下一 Block</button>)}
          {state === "completed" && data.environment === "test" && data.acceptance.uiReceiptId && <div className={styles.receiptSuccess}><b>✓ UiAcceptanceReceipt 已签发</b><code>{data.acceptance.uiReceiptId}</code><br/><Link href="/studio/releases/">返回验收与发布 →</Link></div>}
          {state === "completed" && data.environment === "test" && !data.acceptance.uiReceiptId && <fieldset className={styles.receiptChecks}>
            <legend>签发回执前，逐项确认真实课堂验收</legend>
            {UI_ACCEPTANCE_CHECKLIST.map(([key, label]) => <label key={key}><input type="checkbox" checked={receiptChecks[key]} onChange={(event) => setReceiptChecks((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
            <button className={styles.button} disabled={busy || Object.values(receiptChecks).some((value) => !value)} onClick={() => receipt(receiptChecks)}>签发 UiAcceptanceReceipt</button>
          </fieldset>}
          {data.environment === "test" && <button className={styles.danger} disabled={busy} onClick={reset}>重置 Test 实例</button>}
        </div>
      </section>
      <aside className={styles.card}><small className={styles.eyebrow}>现场雷达</small><h2>{data.mentors.length} 导师 + {data.learners.length} 学员</h2><div className={styles.people}>{data.mentors.map((item) => <div className={styles.person} data-ready key={item.mentorRole}><b>{item.mentorRole} · {item.displayName}</b><small>导师 Membership</small></div>)}{data.learners.map((item) => <div className={styles.person} data-ready={data.submissions.some((submission) => submission.profileId === item.profileId)} key={item.profileId}><b>{item.seat} · {item.displayName}</b><small>{data.submissions.some((submission) => submission.profileId === item.profileId) ? "本块已提交" : "等待本块证据"}</small></div>)}</div><h3>本块提交</h3><div className={styles.submissions}>{data.submissions.length ? data.submissions.map((item) => <article className={styles.submissionItem} key={`${item.profileId}:${item.kind}`}><b>{item.displayName}</b><small>{item.kind}</small><p>{item.text}</p></article>) : <p>还没有人提交。主控不会假装完成现场活动。</p>}</div></aside>
    </div>
  </>;
}

function MembersView({ data }: { data: ClassroomInstanceDetail }) {
  if (!data.isAdminDm) return <section className={styles.card}><h1>需要 Admin DM 权限</h1></section>;
  return <><RuntimeHeading data={data} eyebrow="MEMBERSHIP · EXACT BINDINGS" /><div className={styles.membersGrid}>
    <section className={styles.membersList}><h2>P／D／M／O 导师席</h2><ul>{data.mentors.map((item) => <li key={item.mentorRole}><span><b>{item.mentorRole} · {item.displayName}</b><br /><code>{item.profileId}</code></span><a className={styles.coursewareLink} href={`/course/${item.courseware.slug}/?revision=${item.courseware.revision}`} target="_blank" rel="noreferrer">课件 r{item.courseware.revision}</a></li>)}</ul></section>
    <section className={styles.membersList}><h2>{data.learners.length}/{data.team.seatLimit} 学员 Membership</h2><ul>{data.learners.map((item) => <li key={item.profileId}><span><b>席位 {item.seat} · {item.displayName}</b><br /><code>{item.profileId}</code></span></li>)}</ul></section>
    <section className={styles.membersList}><h2>Admin DM 权限</h2><p>权限与四导师席分离，不会产生第五位导师。</p><ul>{data.admins.map((item) => <li key={item.profileId}><span><b>{item.displayName}</b><br /><code>{item.profileId}</code></span></li>)}</ul></section>
    <section className={styles.membersList}><h2>锁定的版本</h2><ul><li><span><b>CourseRelease r{data.courseRef.revision}</b><br /><code>{data.courseRef.digest}</code></span></li>{data.courseware.map((item) => <li key={item.mentorRole}><span><b>{item.mentorRole} · {item.slug} · r{item.revision}</b><br /><code>{item.digest}</code></span></li>)}</ul></section>
  </div><MemberActions data={data} /></>;
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
      : actionType === "revoke-admin-dm" ? data.admins.map((item) => ({ userId: item.profileId, username: item.profileId, displayName: item.displayName, role: "mentor" as const, hasMembership: false, hasAdminDm: true, inClassroom: true }))
        : accounts.filter((item) => (item.role === "mentor" || item.role === "admin") && !item.hasAdminDm), [accounts, actionType, data.admins]);
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
  return <section className={manageStyles.manage}>
    <div><small className={styles.eyebrow}>ADMIN DM · MEMBERSHIP</small><h2>成员与权限操作</h2><p>导师／学员席只可在开课前替换；Admin DM 是独立权限。所有操作均写审计事件。</p>
      <label>操作<select value={actionType} onChange={(event) => { setActionType(event.target.value as typeof actionType); setSelectedProfileId(""); }}><option value="replace-learner">替换学员席</option><option value="replace-mentor">替换导师席</option><option value="grant-admin-dm">授予 Admin DM</option><option value="revoke-admin-dm">撤销 Admin DM</option></select></label>
      {actionType === "replace-learner" && <label>学员席<select value={seat} onChange={(event) => setSeat(Number(event.target.value))}>{data.learners.map((item) => <option key={item.seat} value={item.seat}>{item.seat} · {item.displayName}</option>)}</select></label>}
      {actionType === "replace-mentor" && <label>导师席<select value={mentorRole} onChange={(event) => setMentorRole(event.target.value as typeof mentorRole)}>{(["P", "D", "M", "O"] as const).map((role) => <option value={role} key={role}>{role} 导师</option>)}</select></label>}
      <label>目标账号<select value={profileId} onChange={(event) => setSelectedProfileId(event.target.value)}><option value="">请选择</option>{choices.map((item) => <option value={item.userId} key={item.userId}>{item.displayName} · @{item.username}</option>)}</select></label>
      <button className={styles.button} disabled={busy || !profileId} onClick={change}>确认操作</button>
    </div>
    <div><small className={styles.eyebrow}>ONE-TIME CREDENTIALS</small><h2>为本课堂创建账号</h2><p>账号属于平台，可继续加入其他课堂；创建不会自动占席，请再使用左侧操作绑定。</p>
      <label>角色<select value={newRole} onChange={(event) => setNewRole(event.target.value as typeof newRole)}><option value="learner">学员</option><option value="mentor">导师</option></select></label><label>数量<input type="number" min="1" max="12" value={newCount} onChange={(event) => setNewCount(Math.min(12, Math.max(1, Number(event.target.value))))} /></label><label>用户名开头<input value={prefix} onChange={(event) => setPrefix(event.target.value)} /></label><button className={styles.secondary} disabled={busy} onClick={create}>生成账号与一次性密码</button>
      {issued.length > 0 && <div className={styles.credentialGrid}>{issued.map((item) => <code key={item.username}>@{item.username}<br />{item.initialPassword}</code>)}</div>}
    </div>
    {message && <p className={manageStyles.message}>{message}</p>}
  </section>;
}

function SharedScreen({ data }: { data: ClassroomSharedScreenDetail }) {
  return <main className={styles.screen}><small>{data.environment.toUpperCase()} · 第 {data.currentBlock.macroStepOrder}/5 步 · {data.currentBlock.id}</small><h1>{data.currentBlock.title}</h1><p>{data.currentBlock.studentPrompt}</p><div className={styles.instruction}>{STATE_LABEL[data.controller.state] ?? data.controller.state}</div><footer><span>{data.course.title}</span><span>{data.controller.blockIndex + 1}/{data.course.blockCount} · {data.learnerCount} 位 Young Builder</span></footer></main>;
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
  const body = await response.json() as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || body.ok === false) throw new Error(body.error?.message || `请求失败（${response.status}）`);
  return body.data as T;
}
function messageOf(value: unknown): string { return value instanceof Error ? value.message : "操作没有完成，请重试。"; }
