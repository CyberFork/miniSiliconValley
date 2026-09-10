"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IssuedManagedCredential } from "../lib/auth-model";
import type { ClassroomInstanceSummary } from "../lib/classroom-platform-store";
import type { UiAcceptanceReceipt, ViewAcceptanceReceipt } from "../lib/course-acceptance";
import type { CoursePackage, CoursePackageRef } from "../lib/course-package";
import { isCoursewareLibraryVisible, type CoursewareSummary } from "../lib/courseware-store";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { AccountMenu, type AccountMenuUser } from "../components/AccountMenu";
import factoryStyles from "./classroom-factory.module.css";
import styles from "./platform.module.css";

type Account = { userId: string; username: string; displayName: string; role: "admin" | "mentor" | "learner"; status: string };
type StudioVersion = {
  ref: CoursePackageRef;
  candidate: boolean;
  released: boolean;
  course: CoursePackage;
  learnerPolicy: { defaultCount: number; minCount: number; maxCount: number; cardsPerLearner: number; dealPolicy: string };
};
type Bootstrap = {
  versions: StudioVersion[];
  courseware: CoursewareSummary[];
  viewReceipts: ViewAcceptanceReceipt[];
  uiReceipts: UiAcceptanceReceipt[];
};
type InitialCourse = {
  courseId: string;
  revision: number;
  digest?: string;
  environment?: "test" | "production";
  viewReceiptId?: string;
  uiReceiptId?: string;
} | null;
type HubProps = {
  user: AccountMenuUser;
  initialCourse: InitialCourse;
};

const MENTOR_ROLES = ["P", "D", "M", "O"] as const;
const ROLE_NAME = { P: "产品", D: "开发", M: "市场", O: "运营" } as const;

export default function ClassroomHub({ user, initialCourse }: HubProps) {
  const [rooms, setRooms] = useState<ClassroomInstanceSummary[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const canUseStudio = !user.impersonation && (user.role === "admin" || user.role === "mentor");

  const load = useCallback(async () => {
    try {
      const currentRooms = await api<ClassroomInstanceSummary[]>("/api/platform/classrooms");
      setRooms(currentRooms);
      if (canUseStudio) {
        const [studio, users] = await Promise.all([
          api<Bootstrap>("/api/studio/bootstrap"),
          api<Account[]>("/api/studio/accounts"),
        ]);
        setBootstrap(studio);
        setAccounts(users);
      }
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [canUseStudio]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const testRooms = rooms.filter((room) => room.environment === "test");
  const productionRooms = rooms.filter((room) => room.environment === "production");
  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="MSV CLASSROOM" subtitle="课堂中心 · 单一真实运行时" />
      <nav aria-label="课堂导航">
        {canUseStudio && <Link href="/studio/">课程生产工作台</Link>}
        {canUseStudio && <Link href="/course/">导师课件播放</Link>}
        <AccountMenu user={user} returnTo="/classroom/" />
      </nav>
    </header>
    <div className={styles.main}>
      <section className={styles.hero}>
        <div><small>CLASSROOM CENTER · TEST + PRODUCTION</small><h1>课堂中心</h1><p>UI 验收课堂和正式课堂使用同一套页面、API、权限与状态机；永久环境标识防止把测试数据误当成正式学习记录。</p></div>
        <div className={styles.identity}><b>{user.displayName}</b><span>{user.role === "admin" ? "平台管理员" : user.role === "mentor" ? "导师账号" : "Young Builder"}</span></div>
      </section>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {loading ? <div className={styles.empty}>正在读取彼此隔离的课堂实例…</div> : <>
        <RoomGroup
          title="UI 验收课堂"
          environment="test"
          rooms={testRooms}
          description="TEST · 绑定已通过视图验收的 Candidate／Released；可重置，不进入正式学习档案。"
        />
        <RoomGroup
          title="正式课堂"
          environment="production"
          rooms={productionRooms}
          description="PRODUCTION · 只绑定 Released 与 UI 验收过的同一组 exact 课件；不可重置。"
        />
      </>}
      {canUseStudio && bootstrap && <FactoryPanel
        bootstrap={bootstrap}
        accounts={accounts}
        currentUserId={user.userId}
        currentUserRole={user.role}
        initialCourse={initialCourse}
        onCreated={async (message) => { setNotice(message); await load(); }}
        onAccounts={async (created) => {
          setNotice(`已生成 ${created.length} 个账号。明文初始密码只在下方显示这一次。`);
          await load();
        }}
        onError={setError}
      />}
    </div>
  </main>;
}

function RoomGroup({ title, environment, rooms, description }: {
  title: string;
  environment: "test" | "production";
  rooms: ClassroomInstanceSummary[];
  description: string;
}) {
  return <section className={styles.section} data-room-group={environment}>
    <header className={styles.sectionHeader}><div><span className={styles.environmentBadge} data-env={environment}>{environment.toUpperCase()}</span><h2>{title}</h2><p>{description}</p></div><b>{rooms.length} 场</b></header>
    {rooms.length ? <div className={styles.grid}>{rooms.map((room) => <RoomCard key={room.id} room={room} />)}</div> : <div className={styles.empty}>{environment === "test" ? "还没有分配给你的 UI 验收课堂。课程先通过多角色视图验收，才能在下方工厂创建。" : "还没有分配给你的正式课堂。Candidate 必须拿到两张有效回执并发布后才能创建。"}</div>}
  </section>;
}

function RoomCard({ room }: { room: ClassroomInstanceSummary }) {
  const adminLabel = room.adminDmMode === "primary" ? "Primary Admin DM" : room.adminDmMode === "delegated" ? "Delegated Admin DM" : "Admin DM";
  const role = room.mentorRole ? `${room.mentorRole} 导师` : room.learnerSeat ? `学员 ${room.learnerSeat}` : room.isAdminDm ? adminLabel : "成员";
  return <article className={styles.room} data-env={room.environment}>
    <div><span className={styles.environmentBadge} data-env={room.environment}>{room.environment.toUpperCase()}</span><small>{room.lifecycle.toUpperCase()}</small><h3>{room.title}</h3><p>{role}{room.isAdminDm && room.mentorRole ? ` · ${adminLabel}` : ""}<br />课程：{room.courseRef.courseId} · r{room.courseRef.revision}</p></div>
    <div><div className={styles.roomMeta}><span>{room.script.unlockedThroughBlockId}</span><span>已解锁</span><span>{room.learnerCount} 学员</span></div><a href={`/classroom/${encodeURIComponent(room.id)}/`}>进入我的课堂 →</a></div>
  </article>;
}

function FactoryPanel({ bootstrap, accounts, currentUserId, currentUserRole, initialCourse, onCreated, onAccounts, onError }: {
  bootstrap: Bootstrap;
  accounts: Account[];
  currentUserId: string;
  currentUserRole: string;
  initialCourse: InitialCourse;
  onCreated: (message: string) => Promise<void>;
  onAccounts: (accounts: IssuedManagedCredential[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const preferred = useMemo(() => preferredVersions(bootstrap.versions), [bootstrap.versions]);
  const initialEnvironment = initialCourse?.environment ?? "test";
  const [environment, setEnvironment] = useState<"test" | "production">(initialEnvironment);
  const eligible = useMemo(() => preferred.filter((version) => {
    const view = exactViewReceipt(bootstrap, version.ref);
    if (!view) return false;
    if (environment === "test") return version.candidate || version.released;
    return version.released && exactUiReceipts(bootstrap, version.ref, view.receiptId).length > 0;
  }), [bootstrap, environment, preferred]);
  const linkedCourse = eligible.find((item) => matchesInitialCourse(item, initialCourse));
  const [courseKey, setCourseKey] = useState(linkedCourse ? versionKey(linkedCourse) : eligible[0] ? versionKey(eligible[0]) : "");
  const course = eligible.find((item) => versionKey(item) === courseKey) ?? eligible[0];
  const viewReceipt = course ? exactViewReceipt(bootstrap, course.ref) : undefined;
  const uiReceiptOptions = course && viewReceipt ? exactUiReceipts(bootstrap, course.ref, viewReceipt.receiptId) : [];
  const preferredUiReceipt = uiReceiptOptions.find((receipt) => receipt.receiptId === initialCourse?.uiReceiptId) ?? uiReceiptOptions[0];
  const [uiReceiptId, setUiReceiptId] = useState(preferredUiReceipt?.receiptId ?? "");
  const uiReceipt = uiReceiptOptions.find((receipt) => receipt.receiptId === uiReceiptId) ?? preferredUiReceipt;
  const [title, setTitle] = useState(initialEnvironment === "test" ? "Mini Silicon Valley UI 验收课堂" : "Mini Silicon Valley 正式课堂");
  const [learnerCount, setLearnerCount] = useState(course?.learnerPolicy.defaultCount ?? 4);
  const mentors = accounts.filter((account) => account.role === "mentor" || account.role === "admin");
  const learners = accounts.filter((account) => account.role === "learner");
  const [mentorIds, setMentorIds] = useState<string[]>(() => MENTOR_ROLES.map((_, index) => mentors[index]?.userId ?? ""));
  const [learnerIds, setLearnerIds] = useState<string[]>(() => Array.from({ length: learnerCount }, (_, index) => learners[index]?.userId ?? ""));
  const [adminId, setAdminId] = useState(currentUserId);
  const [coursewareKeys, setCoursewareKeys] = useState<Record<string, string>>(() => initialCoursewareKeys(bootstrap.courseware, initialEnvironment, preferredUiReceipt));
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<IssuedManagedCredential[]>([]);

  const coursewareOptions = useMemo(() => Object.fromEntries(MENTOR_ROLES.map((role) => [role, bootstrap.courseware.filter((entry) => entry.mentorRole === role && (environment === "test" ? entry.latestRevision >= 0 : isCoursewareLibraryVisible(entry)))])), [bootstrap.courseware, environment]);
  const coursewareRefs = MENTOR_ROLES.map((role) => {
    const item = (coursewareOptions[role] ?? []).find((entry) => coursewareKey(entry, environment) === coursewareKeys[role]);
    if (!item) return null;
    const useReleased = environment === "production";
    const revision = useReleased ? item.releasedRevision : item.latestRevision;
    const digest = useReleased ? item.releasedDigest : item.latestDigest;
    return revision === null || !digest ? null : { mentorRole: role, packageId: item.packageId, slug: item.slug, revision, digest };
  });
  const coursewareMatchesReceipt = environment === "test" || Boolean(uiReceipt && coursewareRefs.every((ref) => ref && uiReceipt.coursewareRefs.some((accepted) => sameCoursewareRef(ref, accepted))));

  const createAccounts = async () => {
    setBusy(true); onError("");
    const stamp = Date.now().toString(36).slice(-8);
    try {
      const issued = await api<IssuedManagedCredential[]>("/api/studio/accounts", {
        method: "POST",
        body: JSON.stringify({ accounts: [
          ...MENTOR_ROLES.map((role) => ({ username: `mentor-${role.toLowerCase()}-${stamp}`.toLowerCase(), displayName: `${ROLE_NAME[role]}导师 ${stamp.slice(-4)}`, role: "mentor" })),
          ...Array.from({ length: learnerCount }, (_, index) => ({ username: `builder-${stamp}-${index + 1}`.toLowerCase(), displayName: `Young Builder ${index + 1}`, role: "learner" })),
        ] }),
      });
      setCredentials(issued);
      setMentorIds(issued.filter((item) => item.role === "mentor").map((item) => item.userId));
      setLearnerIds(issued.filter((item) => item.role === "learner").map((item) => item.userId));
      await onAccounts(issued);
    } catch (cause) { onError(messageOf(cause)); }
    finally { setBusy(false); }
  };

  const createClassroom = async () => {
    if (!course || !viewReceipt) return onError("当前环境没有通过多角色视图验收的课程版本。");
    if (environment === "production" && !uiReceipt) return onError("正式课堂必须选择一张当前有效的真实 UI 验收回执。");
    if (mentorIds.some((id) => !id) || new Set(mentorIds).size !== 4) return onError("请为 P／D／M／O 选择四个不同导师账号。");
    if (learnerIds.some((id) => !id) || new Set(learnerIds).size !== learnerCount) return onError(`请为 ${learnerCount} 个学员席选择不同账号。`);
    if (coursewareRefs.some((item) => !item)) return onError("四位导师都必须有可用的 exact 课件版本。");
    if (!coursewareMatchesReceipt) return onError("Production 必须绑定 UI 验收回执中同一组 exact P／D／M／O 课件；请先发布对应课件版本。");
    setBusy(true); onError("");
    try {
      const result = await api<{ classroomId: string; teamPublicId: string }>("/api/platform/classrooms", {
        method: "POST",
        body: JSON.stringify({
          environment,
          title,
          learnerCount,
          courseRef: course.ref,
          viewAcceptanceReceiptId: viewReceipt.receiptId,
          ...(environment === "production" && uiReceipt ? { uiAcceptanceReceiptId: uiReceipt.receiptId } : {}),
          mentorSeats: MENTOR_ROLES.map((mentorRole, index) => ({ mentorRole, profileId: mentorIds[index] })),
          learnerProfileIds: learnerIds,
          adminDmProfileIds: [adminId],
          coursewareRefs,
        }),
      });
      await onCreated(`${environment === "test" ? "UI 验收" : "正式"}课堂已创建。队伍 ID：${result.teamPublicId}；课程、回执与四套课件 exact 版本已锁定。`);
      router.push(`/classroom/${result.classroomId}/control`);
    } catch (cause) { onError(messageOf(cause)); }
    finally { setBusy(false); }
  };

  const chooseEnvironment = (nextEnvironment: "test" | "production") => {
    const nextEligible = preferred.filter((version) => {
      const view = exactViewReceipt(bootstrap, version.ref);
      return Boolean(view && (nextEnvironment === "test" ? version.candidate || version.released : version.released && exactUiReceipts(bootstrap, version.ref, view.receiptId).length));
    });
    const nextCourse = nextEligible[0];
    const nextView = nextCourse ? exactViewReceipt(bootstrap, nextCourse.ref) : undefined;
    const nextUi = nextCourse && nextView ? exactUiReceipts(bootstrap, nextCourse.ref, nextView.receiptId)[0] : undefined;
    const nextCount = nextCourse ? Math.min(nextCourse.learnerPolicy.maxCount, Math.max(nextCourse.learnerPolicy.minCount, learnerCount)) : learnerCount;
    setEnvironment(nextEnvironment);
    setTitle(nextEnvironment === "test" ? "Mini Silicon Valley UI 验收课堂" : "Mini Silicon Valley 正式课堂");
    setCourseKey(nextCourse ? versionKey(nextCourse) : "");
    setUiReceiptId(nextUi?.receiptId ?? "");
    setLearnerCount(nextCount);
    setLearnerIds((current) => resizeLearnerIds(current, nextCount, learners));
    setCoursewareKeys(initialCoursewareKeys(bootstrap.courseware, nextEnvironment, nextUi));
    onError("");
  };

  const chooseCourse = (nextKey: string) => {
    const nextCourse = eligible.find((item) => versionKey(item) === nextKey);
    setCourseKey(nextKey);
    if (!nextCourse) return;
    const nextView = exactViewReceipt(bootstrap, nextCourse.ref);
    const nextUi = nextView ? exactUiReceipts(bootstrap, nextCourse.ref, nextView.receiptId)[0] : undefined;
    setUiReceiptId(nextUi?.receiptId ?? "");
    setCoursewareKeys(initialCoursewareKeys(bootstrap.courseware, environment, nextUi));
    const nextCount = Math.min(nextCourse.learnerPolicy.maxCount, Math.max(nextCourse.learnerPolicy.minCount, learnerCount));
    setLearnerCount(nextCount);
    setLearnerIds((current) => resizeLearnerIds(current, nextCount, learners));
  };

  const chooseUiReceipt = (receiptId: string) => {
    const next = uiReceiptOptions.find((receipt) => receipt.receiptId === receiptId);
    setUiReceiptId(receiptId);
    setCoursewareKeys(initialCoursewareKeys(bootstrap.courseware, "production", next));
  };

  const chooseLearnerCount = (nextCount: number) => {
    setLearnerCount(nextCount);
    setLearnerIds((current) => resizeLearnerIds(current, nextCount, learners));
  };

  return <section className={styles.section} id="factory">
    <header className={styles.sectionHeader}><div><span className={styles.environmentBadge} data-env={environment}>{environment.toUpperCase()}</span><h2>Classroom Factory</h2><p>同一个工厂创建两种环境；服务器在事务开始前验证 exact 课程、两级回执和四套课件。</p></div></header>
    <div className={styles.factory}>
      <aside className={styles.factoryAside}><small>ONE FACTORY · EXACT GATES</small><h3>{environment === "test" ? "创建真实 UI 验收课堂" : "创建正式课堂"}</h3><ol>{environment === "test" ? <><li>仅列出具有有效 ViewAcceptanceReceipt 的版本</li><li>设置真实 N 与 4 + N 个成员</li><li>绑定计划投产的四套 exact 课件</li><li>完整运行后签发 UiAcceptanceReceipt</li></> : <><li>仅列出 Released + 有效 UiAcceptanceReceipt</li><li>课程 exact 版本与验收结果一致</li><li>四套课件必须已发布且与验收一致</li><li>Production 不提供重置</li></>}</ol><button type="button" onClick={createAccounts} disabled={busy}>一键生成 4＋{learnerCount} 个测试账号</button></aside>
      <div className={styles.factoryForm}>
        <label>课堂环境<select value={environment} onChange={(event) => chooseEnvironment(event.target.value as "test" | "production")}><option value="test">TEST · UI 验收课堂 · 可重置</option><option value="production">PRODUCTION · 正式课堂 · 不可重置</option></select></label>
        <label>课堂名称<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={128} /></label>
        <label className={styles.wide}>课程 exact 版本<select value={course ? versionKey(course) : ""} onChange={(event) => chooseCourse(event.target.value)}>{eligible.map((item) => <option key={versionKey(item)} value={versionKey(item)}>{item.course.course.name} · r{item.ref.revision} · {item.candidate ? "Candidate" : "Released"}</option>)}</select><small>{eligible.length ? `只显示已通过当前 ${environment === "test" ? "ViewAcceptanceReceipt" : "View + UiAcceptanceReceipt"} 门禁的版本。` : environment === "test" ? "没有可创建的版本：请先到多角色视图验收。" : "没有可创建的版本：请先完成 UI 验收并发布 Released。"}</small></label>
        {course && viewReceipt && <div className={`${styles.acceptanceLock} ${styles.wide}`}><b>ViewAcceptanceReceipt</b><code>{viewReceipt.receiptId}</code><span>r{course.ref.revision} · {course.ref.digest}</span></div>}
        {environment === "production" && <label className={styles.wide}>真实 UI 验收回执<select value={uiReceipt?.receiptId ?? ""} onChange={(event) => chooseUiReceipt(event.target.value)}>{uiReceiptOptions.map((receipt) => <option value={receipt.receiptId} key={receipt.receiptId}>{receipt.receiptId.slice(0, 12)}… · {receipt.learnerCount} 人 · {new Date(receipt.acceptedAt).toLocaleString("zh-CN")}</option>)}</select><small>选择回执后，下面四套课件会精确回填为当时测试的 revision／digest。</small></label>}
        <label>学员人数<select value={learnerCount} onChange={(event) => chooseLearnerCount(Number(event.target.value))}>{course ? Array.from({ length: course.learnerPolicy.maxCount - course.learnerPolicy.minCount + 1 }, (_, index) => course.learnerPolicy.minCount + index).map((count) => <option value={count} key={count}>{count} 名学员</option>) : null}</select></label>
        <label>Admin DM（权限，不占导师席）<select value={currentUserRole === "mentor" ? currentUserId : adminId} disabled={currentUserRole === "mentor"} onChange={(event) => setAdminId(event.target.value)}>{accounts.filter((item) => item.role === "admin" || item.role === "mentor").map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select><small>{currentUserRole === "mentor" ? "创建者将成为本课堂初始 Admin DM；开课前可再授权其他导师。" : "平台管理员可把初始 Admin DM 授予任一导师或管理员。"}</small></label>
        <div className={`${styles.mentorRows} ${styles.wide}`}><b>四个导师 Membership</b>{MENTOR_ROLES.map((role, index) => <div className={styles.mentorRow} key={role}><b>{role}</b><span>{ROLE_NAME[role]}导师</span><select aria-label={`${role} 导师账号`} value={mentorIds[index] ?? ""} onChange={(event) => setMentorIds((value) => value.map((id, at) => at === index ? event.target.value : id))}><option value="">请选择账号</option>{mentors.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select></div>)}</div>
        <div className={`${factoryStyles.coursewareRows} ${styles.wide}`}><b>四套 exact 导师课件</b>{MENTOR_ROLES.map((role) => <label key={role}><span>{role} · {ROLE_NAME[role]}</span><select aria-label={`${role} 导师课件`} value={coursewareKeys[role] ?? ""} onChange={(event) => setCoursewareKeys((value) => ({ ...value, [role]: event.target.value }))} disabled={environment === "production"}><option value="">请选择课件</option>{(coursewareOptions[role] ?? []).map((item) => <option key={coursewareKey(item, environment)} value={coursewareKey(item, environment)}>{item.title} · r{environment === "production" ? item.releasedRevision : item.latestRevision}{item.availability === "placeholder" ? " · 内部占位（无真实课件）" : ""}</option>)}</select></label>)}</div>
        {environment === "production" && !coursewareMatchesReceipt && <div className={`${styles.factoryGateError} ${styles.wide}`}>UI 验收所用课件尚未全部发布为相同 exact revision／digest。请先在导师课件库发布对应版本。</div>}
        <div className={`${styles.learnerRows} ${styles.wide}`}>{learnerIds.map((id, index) => <label key={index}>学员 {index + 1}<select aria-label={`学员 ${index + 1} 账号`} value={id} onChange={(event) => setLearnerIds((value) => value.map((item, at) => at === index ? event.target.value : item))}><option value="">请选择账号</option>{learners.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select></label>)}</div>
        <button className={`${styles.factoryButton} ${styles.wide}`} type="button" onClick={createClassroom} disabled={busy || !course || !viewReceipt || (environment === "production" && (!uiReceipt || !coursewareMatchesReceipt))}>{busy ? "正在执行不可变工厂事务…" : environment === "test" ? "创建真实 UI 验收课堂 →" : "创建 Production 正式课堂 →"}</button>
      </div>
    </div>
    {credentials.length > 0 && <CredentialReceipt credentials={credentials} />}
  </section>;
}

function CredentialReceipt({ credentials }: { credentials: IssuedManagedCredential[] }) {
  const csv = ["username,displayName,role,initialPassword,mustChangePassword", ...credentials.map((item) => [item.username, item.displayName, item.role, item.initialPassword, "true"].map(csvCell).join(","))].join("\n");
  const download = () => { const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `minisv-accounts-${Date.now()}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  return <section className={styles.credentials}><header><div><b>一次性账号分发回执</b><p>离开页面后不能再次读取明文密码。首次登录必须修改密码。</p></div><button type="button" onClick={download}>下载 CSV</button></header><div className={styles.credentialGrid}>{credentials.map((item) => <code key={item.userId}>{item.displayName}<br />@{item.username}<br />{item.initialPassword}</code>)}</div></section>;
}

function preferredVersions(versions: StudioVersion[]): StudioVersion[] {
  return [...new Set(versions.map((version) => version.ref.courseId))].flatMap((courseId) => {
    const matching = versions.filter((version) => version.ref.courseId === courseId);
    const candidate = matching.find((version) => version.candidate);
    const released = matching.find((version) => version.released);
    return [...(candidate ? [candidate] : []), ...(released && released !== candidate ? [released] : [])];
  });
}

function exactViewReceipt(bootstrap: Bootstrap, ref: CoursePackageRef) {
  return bootstrap.viewReceipts.find((receipt) => receipt.valid && sameCourseRef(receipt.courseRef, ref));
}

function exactUiReceipts(bootstrap: Bootstrap, ref: CoursePackageRef, viewReceiptId: string) {
  return bootstrap.uiReceipts.filter((receipt) => receipt.valid && receipt.viewReceiptId === viewReceiptId && sameCourseRef(receipt.courseRef, ref));
}

function matchesInitialCourse(version: StudioVersion, initial: InitialCourse) {
  return Boolean(initial && version.ref.courseId === initial.courseId && version.ref.revision === initial.revision && (!initial.digest || version.ref.digest === initial.digest));
}

function sameCourseRef(left: Pick<CoursePackageRef, "courseId" | "revision" | "digest">, right: Pick<CoursePackageRef, "courseId" | "revision" | "digest">) {
  return left.courseId === right.courseId && left.revision === right.revision && left.digest === right.digest;
}

function sameCoursewareRef(left: { mentorRole: string; packageId: string; revision: number; digest: string }, right: { mentorRole: string; packageId: string; revision: number; digest: string }) {
  return left.mentorRole === right.mentorRole && left.packageId === right.packageId && left.revision === right.revision && left.digest === right.digest;
}

function versionKey(version: StudioVersion): string { return `${version.ref.courseId}:${version.ref.revision}:${version.ref.digest}`; }
function coursewareKey(item: CoursewareSummary, environment: "test" | "production"): string {
  return `${item.packageId}:${environment === "production" ? item.releasedRevision : item.latestRevision}:${environment === "production" ? item.releasedDigest : item.latestDigest}`;
}

function initialCoursewareKeys(items: CoursewareSummary[], environment: "test" | "production", receipt?: UiAcceptanceReceipt): Record<string, string> {
  if (environment === "production" && receipt) {
    return Object.fromEntries(MENTOR_ROLES.map((role) => {
      const accepted = receipt.coursewareRefs.find((ref) => ref.mentorRole === role);
      const item = accepted ? items.find((entry) => entry.packageId === accepted.packageId && entry.releasedRevision === accepted.revision && entry.releasedDigest === accepted.digest) : undefined;
      return [role, item ? coursewareKey(item, "production") : `missing:${accepted?.packageId ?? role}:${accepted?.revision ?? "?"}:${accepted?.digest ?? "?"}`];
    }));
  }
  return defaultCoursewareKeys(items, environment);
}

function defaultCoursewareKeys(items: CoursewareSummary[], environment: "test" | "production"): Record<string, string> {
  return Object.fromEntries(MENTOR_ROLES.map((role) => {
    const item = items.find((entry) => entry.mentorRole === role && (environment === "test" || isCoursewareLibraryVisible(entry)));
    return [role, item ? coursewareKey(item, environment) : ""];
  }));
}

function resizeLearnerIds(current: string[], count: number, learners: Account[]): string[] {
  return Array.from({ length: count }, (_, index) => current[index] ?? learners[index]?.userId ?? "");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers, cache: "no-store", ...init });
  const body = await response.json() as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || body.ok === false) throw new Error(body.error?.message || `请求失败（${response.status}）`);
  return body.data as T;
}
function messageOf(value: unknown): string { return value instanceof Error ? value.message : "操作没有完成，请重试。"; }
function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
