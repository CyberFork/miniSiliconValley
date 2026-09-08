"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandHomeLink } from "../components/BrandHomeLink";
import type { CoursePackage, CoursePackageRef } from "../lib/course-package";
import type { CoursewareSummary } from "../lib/courseware-store";
import type { ClassroomInstanceSummary } from "../lib/classroom-platform-store";
import type { IssuedManagedCredential } from "../lib/auth-model";
import styles from "./platform.module.css";
import factoryStyles from "./classroom-factory.module.css";

type Account = { userId: string; username: string; displayName: string; role: "admin" | "mentor" | "learner"; status: string };
type StudioVersion = {
  ref: CoursePackageRef;
  candidate: boolean;
  released: boolean;
  course: CoursePackage;
  learnerPolicy: { defaultCount: number; minCount: number; maxCount: number; cardsPerLearner: number; dealPolicy: string };
};
type Bootstrap = { versions: StudioVersion[]; courseware: CoursewareSummary[] };
type HubProps = {
  user: { userId: string; displayName: string; role: string };
  signOutPath: string;
  initialCourse: { courseId: string; revision: number } | null;
};

const MENTOR_ROLES = ["P", "D", "M", "O"] as const;
const ROLE_NAME = { P: "产品", D: "开发", M: "市场", O: "运营" } as const;

export default function ClassroomHub({ user, signOutPath, initialCourse }: HubProps) {
  const [rooms, setRooms] = useState<ClassroomInstanceSummary[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const currentRooms = await api<ClassroomInstanceSummary[]>("/api/platform/classrooms");
      setRooms(currentRooms);
      if (user.role === "admin" || user.role === "mentor") {
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
  }, [user.role]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="MSV CLASSROOM" subtitle="统一课堂运行平台" />
      <nav aria-label="课堂导航">
        {(user.role === "admin" || user.role === "mentor") && <Link href="/studio/">Course Studio</Link>}
        {(user.role === "admin" || user.role === "mentor") && <Link href="/course/">导师课件</Link>}
        <a href={signOutPath}>退出</a>
      </nav>
    </header>
    <div className={styles.main}>
      <section className={styles.hero}>
        <div><small>CLASSROOM FACTORY · TODAY</small><h1>今天的课堂</h1><p>每个课堂都有独立课程版本、成员、手牌、账本与中控。Test 和 Production 使用同一套真实界面与状态机。</p></div>
        <div className={styles.identity}><b>{user.displayName}</b><span>{user.role === "admin" ? "平台管理员" : user.role === "mentor" ? "导师账号" : "Young Builder"}</span></div>
      </section>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      <section className={styles.section}>
        <header className={styles.sectionHeader}><div><h2>我的 Classroom</h2><p>同一导师账号可以进入多个课堂；列表只显示你的 Membership 或 Admin DM 权限。</p></div><b>{rooms.length} 场</b></header>
        {loading ? <div className={styles.empty}>正在读取独立课堂实例…</div> : rooms.length ? <div className={styles.grid}>{rooms.map((room) => <RoomCard key={room.id} room={room} />)}</div> : <div className={styles.empty}>还没有分配给你的课堂。导师可在下方预创建账号并用课程工厂创建第一场。</div>}
      </section>
      {(user.role === "admin" || user.role === "mentor") && bootstrap && <FactoryPanel
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

function RoomCard({ room }: { room: ClassroomInstanceSummary }) {
  const role = room.mentorRole ? `${room.mentorRole} 导师` : room.learnerSeat ? `学员 ${room.learnerSeat}` : room.isAdminDm ? "Admin DM" : "成员";
  return <article className={styles.room} data-env={room.environment}>
    <div><small>{room.environment.toUpperCase()} · {room.lifecycle.toUpperCase()}</small><h3>{room.title}</h3><p>{role}{room.isAdminDm && room.mentorRole ? " · Admin DM" : ""}<br />课程：{room.courseRef.courseId} · r{room.courseRef.revision}</p></div>
    <div><div className={styles.roomMeta}><span>{room.controller.blockId}</span><span>{room.controller.state}</span><span>{room.learnerCount} 学员</span></div><Link href={`/classroom/${room.id}/`}>进入我的课堂 →</Link></div>
  </article>;
}

function FactoryPanel({ bootstrap, accounts, currentUserId, currentUserRole, initialCourse, onCreated, onAccounts, onError }: {
  bootstrap: Bootstrap;
  accounts: Account[];
  currentUserId: string;
  currentUserRole: string;
  initialCourse: { courseId: string; revision: number } | null;
  onCreated: (message: string) => Promise<void>;
  onAccounts: (accounts: IssuedManagedCredential[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const preferred = useMemo(() => preferredVersions(bootstrap.versions), [bootstrap.versions]);
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const eligible = preferred.filter((item) => environment === "test" ? item.candidate || item.released : item.released);
  const linkedCourse = eligible.find((item) => item.ref.courseId === initialCourse?.courseId && item.ref.revision === initialCourse.revision);
  const [courseKey, setCourseKey] = useState(linkedCourse ? versionKey(linkedCourse) : eligible[0] ? versionKey(eligible[0]) : "");
  const course = eligible.find((item) => versionKey(item) === courseKey) ?? eligible[0];
  const [title, setTitle] = useState("Mini Silicon Valley 测试课堂");
  const [learnerCount, setLearnerCount] = useState(course?.learnerPolicy.defaultCount ?? 4);
  const mentors = accounts.filter((account) => account.role === "mentor" || account.role === "admin");
  const learners = accounts.filter((account) => account.role === "learner");
  const [mentorIds, setMentorIds] = useState<string[]>(() => MENTOR_ROLES.map((_, index) => mentors[index]?.userId ?? ""));
  const [learnerIds, setLearnerIds] = useState<string[]>(() => Array.from({ length: learnerCount }, (_, index) => learners[index]?.userId ?? ""));
  const [adminId, setAdminId] = useState(currentUserId);
  const [coursewareKeys, setCoursewareKeys] = useState<Record<string, string>>(() => defaultCoursewareKeys(bootstrap.courseware, "test"));
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<IssuedManagedCredential[]>([]);

  const coursewareOptions = useMemo(() => Object.fromEntries(MENTOR_ROLES.map((role) => [role, bootstrap.courseware.filter((entry) => entry.mentorRole === role && (environment === "test" ? entry.latestRevision >= 0 : entry.releasedRevision !== null))])), [bootstrap.courseware, environment]);
  const coursewareRefs = MENTOR_ROLES.map((role) => {
    const item = (coursewareOptions[role] ?? []).find((entry) => coursewareKey(entry, environment) === coursewareKeys[role]);
    if (!item) return null;
    const useReleased = environment === "production";
    const revision = useReleased ? item.releasedRevision : item.latestRevision;
    const digest = useReleased ? item.releasedDigest : item.latestDigest;
    return revision === null || !digest ? null : { mentorRole: role, packageId: item.packageId, slug: item.slug, revision, digest };
  });

  const createAccounts = async () => {
    setBusy(true); onError("");
    // Millisecond precision prevents a second test roster in the same minute
    // from colliding with the first one.
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
    if (!course) return onError("当前环境没有可用的课程版本。");
    if (mentorIds.some((id) => !id) || new Set(mentorIds).size !== 4) return onError("请为 P／D／M／O 选择四个不同导师账号。");
    if (learnerIds.some((id) => !id) || new Set(learnerIds).size !== learnerCount) return onError(`请为 ${learnerCount} 个学员席选择不同账号。`);
    if (coursewareRefs.some((item) => !item)) return onError("四位导师都必须有可用的 exact 课件版本。");
    setBusy(true); onError("");
    try {
      const result = await api<{ classroomId: string; teamPublicId: string }>("/api/platform/classrooms", {
        method: "POST",
        body: JSON.stringify({
          environment, title, learnerCount, courseRef: course.ref,
          mentorSeats: MENTOR_ROLES.map((mentorRole, index) => ({ mentorRole, profileId: mentorIds[index] })),
          learnerProfileIds: learnerIds,
          adminDmProfileIds: [adminId],
          coursewareRefs,
        }),
      });
      await onCreated(`课堂已创建。队伍 ID：${result.teamPublicId}；课程与四套课件版本已锁定。`);
      router.push(`/classroom/${result.classroomId}/control`);
    } catch (cause) { onError(messageOf(cause)); }
    finally { setBusy(false); }
  };

  const chooseEnvironment = (nextEnvironment: "test" | "production") => {
    const nextEligible = preferred.filter((item) => nextEnvironment === "test" ? item.candidate || item.released : item.released);
    const nextCourse = nextEligible[0];
    const nextCount = nextCourse
      ? Math.min(nextCourse.learnerPolicy.maxCount, Math.max(nextCourse.learnerPolicy.minCount, learnerCount))
      : learnerCount;
    setEnvironment(nextEnvironment);
    setCourseKey(nextCourse ? versionKey(nextCourse) : "");
    setLearnerCount(nextCount);
    setLearnerIds((current) => resizeLearnerIds(current, nextCount, learners));
    setCoursewareKeys(defaultCoursewareKeys(bootstrap.courseware, nextEnvironment));
  };

  const chooseCourse = (nextKey: string) => {
    const nextCourse = eligible.find((item) => versionKey(item) === nextKey);
    setCourseKey(nextKey);
    if (!nextCourse) return;
    const nextCount = Math.min(nextCourse.learnerPolicy.maxCount, Math.max(nextCourse.learnerPolicy.minCount, learnerCount));
    setLearnerCount(nextCount);
    setLearnerIds((current) => resizeLearnerIds(current, nextCount, learners));
  };

  const chooseLearnerCount = (nextCount: number) => {
    setLearnerCount(nextCount);
    setLearnerIds((current) => resizeLearnerIds(current, nextCount, learners));
  };

  return <section className={styles.section} id="factory">
    <header className={styles.sectionHeader}><div><h2>Classroom Factory</h2><p>账号先创建、实例再生成；Test／Production 只改变准入与数据策略，不改变课堂代码。</p></div></header>
    <div className={styles.factory}>
      <aside className={styles.factoryAside}><small>ONE FACTORY · EXACT VERSIONS</small><h3>一次生成完整课堂</h3><ol><li>选择 Candidate 或 Released</li><li>设置真实学员数 N</li><li>绑定四位导师与四套课件</li><li>授予独立 Admin DM 权限</li><li>创建 4 + N Membership 与中控</li></ol><button type="button" onClick={createAccounts} disabled={busy}>一键生成 4＋{learnerCount} 个测试账号</button></aside>
      <div className={styles.factoryForm}>
        <label>课堂环境<select value={environment} onChange={(event) => chooseEnvironment(event.target.value as "test" | "production")}><option value="test">Test · 可用 Candidate、可重置</option><option value="production">Production · 仅 Released、不可重置</option></select></label>
        <label>课堂名称<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={128} /></label>
        <label className={styles.wide}>课程 exact 版本<select value={course ? versionKey(course) : ""} onChange={(event) => chooseCourse(event.target.value)}>{eligible.map((item) => <option key={versionKey(item)} value={versionKey(item)}>{item.course.course.name} · r{item.ref.revision} · {item.candidate ? "Candidate" : "Released"}</option>)}</select></label>
        <label>学员人数<select value={learnerCount} onChange={(event) => chooseLearnerCount(Number(event.target.value))}>{course ? Array.from({ length: course.learnerPolicy.maxCount - course.learnerPolicy.minCount + 1 }, (_, index) => course.learnerPolicy.minCount + index).map((count) => <option value={count} key={count}>{count} 名学员</option>) : null}</select></label>
        <label>Admin DM（权限，不占导师席）<select value={currentUserRole === "mentor" ? currentUserId : adminId} disabled={currentUserRole === "mentor"} onChange={(event) => setAdminId(event.target.value)}>{accounts.filter((item) => item.role === "admin" || item.role === "mentor").map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select><small>{currentUserRole === "mentor" ? "创建者将成为本课堂初始 Admin DM；开课前可再授权其他导师。" : "平台管理员可把初始 Admin DM 授予任一导师或管理员。"}</small></label>
        <div className={`${styles.mentorRows} ${styles.wide}`}><b>四个导师 Membership</b>{MENTOR_ROLES.map((role, index) => <div className={styles.mentorRow} key={role}><b>{role}</b><span>{ROLE_NAME[role]}导师</span><select aria-label={`${role} 导师账号`} value={mentorIds[index] ?? ""} onChange={(event) => setMentorIds((value) => value.map((id, at) => at === index ? event.target.value : id))}><option value="">请选择账号</option>{mentors.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select></div>)}</div>
        <div className={`${factoryStyles.coursewareRows} ${styles.wide}`}><b>四套 exact 导师课件</b>{MENTOR_ROLES.map((role) => <label key={role}><span>{role} · {ROLE_NAME[role]}</span><select aria-label={`${role} 导师课件`} value={coursewareKeys[role] ?? ""} onChange={(event) => setCoursewareKeys((value) => ({ ...value, [role]: event.target.value }))}><option value="">请选择课件</option>{(coursewareOptions[role] ?? []).map((item) => <option key={coursewareKey(item, environment)} value={coursewareKey(item, environment)}>{item.title} · r{environment === "production" ? item.releasedRevision : item.latestRevision}</option>)}</select></label>)}</div>
        <div className={`${styles.learnerRows} ${styles.wide}`}>{learnerIds.map((id, index) => <label key={index}>学员 {index + 1}<select aria-label={`学员 ${index + 1} 账号`} value={id} onChange={(event) => setLearnerIds((value) => value.map((item, at) => at === index ? event.target.value : item))}><option value="">请选择账号</option>{learners.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select></label>)}</div>
        <button className={`${styles.factoryButton} ${styles.wide}`} type="button" onClick={createClassroom} disabled={busy || !course}>{busy ? "正在执行不可变工厂事务…" : `创建 ${environment === "test" ? "Test" : "Production"} Classroom →`}</button>
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

function versionKey(version: StudioVersion): string { return `${version.ref.courseId}:${version.ref.revision}:${version.ref.digest}`; }
function coursewareKey(item: CoursewareSummary, environment: "test" | "production"): string {
  return `${item.packageId}:${environment === "production" ? item.releasedRevision : item.latestRevision}:${environment === "production" ? item.releasedDigest : item.latestDigest}`;
}

function defaultCoursewareKeys(items: CoursewareSummary[], environment: "test" | "production"): Record<string, string> {
  return Object.fromEntries(MENTOR_ROLES.map((role) => {
    const item = items.find((entry) => entry.mentorRole === role && (environment === "test" || entry.releasedRevision !== null));
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
