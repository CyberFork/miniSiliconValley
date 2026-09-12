"use client";

import Link from "../components/NavigationLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { IssuedManagedCredential } from "../lib/auth-model";
import type { ClassroomInstanceSummary, TestClassroomDeletionPreview } from "../lib/classroom-platform-store";
import type { StudioUiAcceptanceSummary, StudioViewAcceptanceSummary } from "../lib/course-acceptance";
import type { CoursePackage, CoursePackageRef } from "../lib/course-package";
import { isCoursewareLibraryVisible, type CoursewareSummary } from "../lib/courseware-store";
import { buildFactoryChecklist } from "../lib/classroom-factory-readiness";
import { BrandHomeLink } from "../components/BrandHomeLink";
import { AccountMenu, type AccountMenuUser } from "../components/AccountMenu";
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
  viewReceipts: StudioViewAcceptanceSummary[];
  uiReceipts: StudioUiAcceptanceSummary[];
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
  initialNotice?: string;
};

const MENTOR_ROLES = ["P", "D", "M", "O"] as const;
const ROLE_NAME = { P: "产品", D: "开发", M: "市场", O: "运营" } as const;

export default function ClassroomHub({ user, initialCourse, initialNotice = "" }: HubProps) {
  const [rooms, setRooms] = useState<ClassroomInstanceSummary[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [actionError, setActionError] = useState("");
  const [roomsError, setRoomsError] = useState("");
  const [bootstrapError, setBootstrapError] = useState("");
  const [accountsError, setAccountsError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [archiveTarget, setArchiveTarget] = useState<ClassroomInstanceSummary | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassroomInstanceSummary | null>(null);
  const [deletePreview, setDeletePreview] = useState<TestClassroomDeletionPreview | null>(null);
  const [deletePreviewError, setDeletePreviewError] = useState("");
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteMutationKey = useRef("");
  const canUseStudio = !user.impersonation && (user.role === "admin" || user.role === "mentor");

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const currentRooms = await api<ClassroomInstanceSummary[]>("/api/platform/classrooms");
      setRooms(currentRooms);
      setRoomsError("");
    } catch (cause) {
      setRoomsError(messageOf(cause));
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const loadBootstrap = useCallback(async () => {
    if (!canUseStudio) return;
    setBootstrapLoading(true);
    try {
      setBootstrap(await api<Bootstrap>("/api/studio/bootstrap"));
      setBootstrapError("");
    } catch (cause) {
      setBootstrapError(messageOf(cause));
    } finally {
      setBootstrapLoading(false);
    }
  }, [canUseStudio]);

  const loadAccounts = useCallback(async () => {
    if (!canUseStudio) return;
    setAccountsLoading(true);
    try {
      setAccounts(await api<Account[]>("/api/studio/accounts"));
      setAccountsError("");
    } catch (cause) {
      setAccountsError(messageOf(cause));
    } finally {
      setAccountsLoading(false);
    }
  }, [canUseStudio]);

  const lookupAccounts = useCallback(async (query: string) => {
    const matches = await api<Account[]>(`/api/studio/accounts?q=${encodeURIComponent(query)}`);
    setAccounts((current) => mergeAccounts(current, matches));
    return matches;
  }, []);

  const refreshAll = useCallback(async () => {
    setActionError("");
    await Promise.all([loadRooms(), loadBootstrap(), loadAccounts()]);
  }, [loadAccounts, loadBootstrap, loadRooms]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshAll(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAll]);

  const testRooms = rooms.filter((room) => room.environment === "test" && !room.archive);
  const archivedTestRooms = rooms.filter((room) => room.environment === "test" && room.archive);
  const productionRooms = rooms.filter((room) => room.environment === "production");
  const requestArchive = (room: ClassroomInstanceSummary) => {
    setActionError("");
    setArchiveReason("");
    setArchiveTarget(room);
  };
  const archiveClassroom = async () => {
    if (!archiveTarget || archiveBusy) return;
    setArchiveBusy(true);
    setActionError("");
    try {
      await api(`/api/platform/classrooms/${encodeURIComponent(archiveTarget.id)}/archive`, {
        method: "POST",
        body: JSON.stringify({
          expectedRunId: `${archiveTarget.id}:run:${archiveTarget.resetGeneration}`,
          expectedResetGeneration: archiveTarget.resetGeneration,
          expectedScriptVersion: archiveTarget.script.version,
          idempotencyKey: `archive.${crypto.randomUUID()}`,
          ...(archiveReason.trim() ? { reason: archiveReason.trim() } : {}),
        }),
      });
      setNotice(`${archiveTarget.title} 已进入只读历史；课程、成员、作品、资金和审计证据均未删除。`);
      setArchiveTarget(null);
      setArchiveReason("");
      await loadRooms();
    } catch (cause) {
      setActionError(messageOf(cause));
      await loadRooms();
    } finally {
      setArchiveBusy(false);
    }
  };
  const loadDeletionPreview = useCallback(async (room: ClassroomInstanceSummary) => {
    setDeletePreviewLoading(true);
    setDeletePreviewError("");
    try {
      setDeletePreview(await api<TestClassroomDeletionPreview>(`/api/platform/classrooms/${encodeURIComponent(room.id)}?deletePreview=1`));
    } catch (cause) {
      setDeletePreview(null);
      setDeletePreviewError(messageOf(cause));
    } finally {
      setDeletePreviewLoading(false);
    }
  }, []);
  const requestDelete = (room: ClassroomInstanceSummary) => {
    setActionError("");
    setDeleteTarget(room);
    setDeletePreview(null);
    setDeletePreviewError("");
    setDeleteReason("");
    setDeleteConfirmed(false);
    deleteMutationKey.current = `delete.${crypto.randomUUID()}`;
    void loadDeletionPreview(room);
  };
  const deleteClassroom = async () => {
    if (!deleteTarget || !deletePreview?.canDelete || !deleteConfirmed || deleteBusy) return;
    setDeleteBusy(true);
    setDeletePreviewError("");
    try {
      const result = await api<{ deleted: true; deletedAt: string; classroomId: string; tombstoneDigest: string }>(
        `/api/platform/classrooms/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            expectedRunId: `${deleteTarget.id}:run:${deletePreview.classroom.resetGeneration}`,
            expectedResetGeneration: deletePreview.classroom.resetGeneration,
            expectedScriptVersion: deletePreview.classroom.scriptVersion,
            expectedStateToken: deletePreview.stateToken,
            confirmClassroomId: deleteTarget.id,
            idempotencyKey: deleteMutationKey.current,
            ...(deleteReason.trim() ? { reason: deleteReason.trim() } : {}),
          }),
        },
      );
      setNotice(`${deleteTarget.title} 已删除；旧链接已失效。仅保留不含学员正文的审计墓碑 ${result.tombstoneDigest.slice(0, 12)}…。`);
      setDeleteTarget(null);
      setDeletePreview(null);
      setDeleteReason("");
      setDeleteConfirmed(false);
      await loadRooms();
    } catch (cause) {
      const failure = messageOf(cause);
      setDeleteConfirmed(false);
      await Promise.all([loadRooms(), loadDeletionPreview(deleteTarget)]);
      setDeletePreviewError(`删除没有执行：${failure}。已重新读取目标状态，请核对后再确认。`);
    } finally {
      setDeleteBusy(false);
    }
  };
  return <main className={styles.page}>
    <header className={styles.top}>
      <BrandHomeLink title="MSV CLASSROOM" subtitle="课堂中心 · 单一真实运行时" />
      <nav aria-label="课堂导航">
        {canUseStudio && <Link href="/studio/">课程生产工作台</Link>}
        <Link href="/course/">课件查看</Link>
        <AccountMenu user={user} returnTo="/classroom/" />
      </nav>
    </header>
    <div className={styles.main}>
      <section className={styles.hero}>
        <div><small>{canUseStudio ? "CLASSROOM CENTER · TEST + PRODUCTION" : "MY CLASSROOMS · YOUNG BUILDER"}</small><h1>{canUseStudio ? "课堂中心" : "我的课堂"}</h1><p>{canUseStudio ? "UI 验收课堂和正式课堂使用同一套页面、API、权限与状态机；永久环境标识防止把测试数据误当成正式学习记录。" : "这里列出导师已经分配给你的课堂。进入后只会看到自己的席位、已解锁剧本和可访问课件；创建与验收工具不会向学员开放。"}</p></div>
        <div className={styles.identity}><b>{user.displayName}</b><span>{user.role === "admin" ? "平台管理员" : user.role === "mentor" ? "导师账号" : "Young Builder"}</span></div>
      </section>
      {actionError && <div className={styles.error} role="alert">{actionError}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {roomsError && <DependencyNotice label="课堂列表" message={roomsError} retained={rooms.length > 0} onRetry={loadRooms} />}
      {roomsLoading && !rooms.length ? <div className={styles.empty}>正在读取彼此隔离的课堂实例…</div> : <>
        <RoomGroup
          title={canUseStudio ? "UI 验收课堂" : "我的练习课堂"}
          environment="test"
          rooms={testRooms}
          description={canUseStudio ? "TEST · 绑定已通过视图验收的 Candidate／Released；可重置，不进入正式学习档案。" : "导师安排的练习或界面测试课堂；内容与正式学习档案隔离。"}
          createHref={canUseStudio ? "#factory" : undefined}
          onArchive={requestArchive}
          onDelete={requestDelete}
        />
        <RoomGroup
          title={canUseStudio ? "正式课堂" : "我的正式课堂"}
          environment="production"
          rooms={productionRooms}
          description="PRODUCTION · 只绑定已通过 View／UI 验收的 Released 课程剧本；导师课件始终打开各自最新发布版；不可重置。"
        />
        {archivedTestRooms.length > 0 && <RoomGroup
          title="已归档测试课堂"
          environment="test"
          rooms={archivedTestRooms}
          description="READ ONLY · 可继续审计回看；无验收／发布依赖时可单独删除，存在证据依赖时保持归档。"
          archived
          onDelete={requestDelete}
        />}
      </>}
      {canUseStudio && <FactoryPanel
        bootstrap={bootstrap}
        accounts={accounts}
        bootstrapError={bootstrapError}
        accountsError={accountsError}
        bootstrapLoading={bootstrapLoading}
        accountsLoading={accountsLoading}
        currentUserId={user.userId}
        currentUserRole={user.role}
        initialCourse={initialCourse}
        onRefresh={refreshAll}
        onRetryBootstrap={loadBootstrap}
        onRetryAccounts={loadAccounts}
        onLookupAccounts={lookupAccounts}
        onCreated={async (message) => { setNotice(message); await loadRooms(); }}
        onAccounts={async (created) => {
          setNotice(`已生成 ${created.length} 个账号。明文初始密码只在下方显示这一次。`);
          await loadAccounts();
        }}
        onError={setActionError}
      />}
      {archiveTarget && <ArchiveDialog
        room={archiveTarget}
        reason={archiveReason}
        busy={archiveBusy}
        onReason={setArchiveReason}
        onCancel={() => { if (!archiveBusy) setArchiveTarget(null); }}
        onConfirm={() => { void archiveClassroom(); }}
      />}
      {deleteTarget && <DeleteDialog
        room={deleteTarget}
        preview={deletePreview}
        previewError={deletePreviewError}
        loading={deletePreviewLoading}
        busy={deleteBusy}
        reason={deleteReason}
        confirmed={deleteConfirmed}
        onReason={setDeleteReason}
        onConfirmed={setDeleteConfirmed}
        onRetry={() => { void loadDeletionPreview(deleteTarget); }}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
          setDeletePreview(null);
          setDeletePreviewError("");
          setDeleteConfirmed(false);
        }}
        onConfirm={() => { void deleteClassroom(); }}
      />}
    </div>
  </main>;
}

function DependencyNotice({ label, message, retained, onRetry }: { label: string; message: string; retained: boolean; onRetry: () => Promise<void> }) {
  return <div className={styles.dependencyError} role="alert">
    <div><b>{label}读取失败</b><span>{message}{retained ? "；页面保留了上一次成功读取的数据。" : "。"}</span></div>
    <button type="button" onClick={() => { void onRetry(); }}>重试{label}</button>
  </div>;
}

function RoomGroup({ title, environment, rooms, description, createHref, archived = false, onArchive, onDelete }: {
  title: string;
  environment: "test" | "production";
  rooms: ClassroomInstanceSummary[];
  description: string;
  createHref?: string;
  archived?: boolean;
  onArchive?: (room: ClassroomInstanceSummary) => void;
  onDelete?: (room: ClassroomInstanceSummary) => void;
}) {
  const sectionId = archived ? "archived-test-classrooms" : environment === "production" ? "production-classrooms" : "test-classrooms";
  return <section className={styles.section} id={sectionId} data-room-group={environment}>
    <header className={styles.sectionHeader}><div><span className={styles.environmentBadge} data-env={environment}>{archived ? "ARCHIVE" : environment.toUpperCase()}</span><h2>{title}</h2><p>{description}</p></div><div className={styles.sectionHeaderActions}><b>{rooms.length} 场</b>{createHref && <a className={styles.sectionAction} href={createHref}>＋ 新建测试课堂</a>}</div></header>
    {rooms.length ? <div className={styles.grid}>{rooms.map((room) => <RoomCard key={room.id} room={room} archived={archived} onArchive={onArchive} onDelete={onDelete} />)}</div> : <div className={styles.empty}>{environment === "test" ? <>还没有分配给你的 UI 验收课堂。课程通过多角色视图验收后，使用上方<strong>新建测试课堂</strong>进入创建区。</> : "还没有分配给你的正式课堂。Candidate 必须拿到两张有效回执并发布后才能创建。"}</div>}
  </section>;
}

function RoomCard({ room, archived = false, onArchive, onDelete }: { room: ClassroomInstanceSummary; archived?: boolean; onArchive?: (room: ClassroomInstanceSummary) => void; onDelete?: (room: ClassroomInstanceSummary) => void }) {
  const adminLabel = room.adminDmMode === "primary" ? "Primary Admin DM" : room.adminDmMode === "delegated" ? "Delegated Admin DM" : "Admin DM";
  const role = room.mentorRole ? `${room.mentorRole} 导师` : room.learnerSeat ? `学员 ${room.learnerSeat}` : room.isAdminDm ? adminLabel : "成员";
  return <article className={styles.room} data-env={room.environment}>
    <div><span className={styles.environmentBadge} data-env={room.environment}>{archived ? "ARCHIVED" : room.environment.toUpperCase()}</span><small>{archived ? `READ ONLY · ${room.lifecycle.toUpperCase()}` : room.lifecycle.toUpperCase()}</small><h3>{room.title}</h3><p>{role}{room.isAdminDm && room.mentorRole ? ` · ${adminLabel}` : ""}</p><dl className={styles.roomIdentity}><div><dt>classroomId</dt><dd><code>{room.id}</code></dd></div><div><dt>course</dt><dd><code>{room.courseRef.courseId}@r{room.courseRef.revision}</code></dd></div><div><dt>digest</dt><dd><code>{room.courseRef.digest}</code></dd></div><div><dt>updatedAt</dt><dd><time dateTime={room.updatedAt}>{new Date(room.updatedAt).toLocaleString("zh-CN")}</time></dd></div></dl>{room.archive && <p className={styles.archiveNote}>归档：{new Date(room.archive.archivedAt).toLocaleString("zh-CN")} · {room.archive.reason || "未填写备注"}</p>}</div>
    <div><div className={styles.roomMeta}><span>{room.script.unlockedThroughBlockId}</span><span>run {room.resetGeneration}</span><span>{room.learnerCount} 学员</span></div><div className={styles.roomActions}><a href={`/classroom/${encodeURIComponent(room.id)}/`}>{archived ? "打开只读档案 →" : "进入我的课堂 →"}</a>{!archived && room.environment === "test" && room.isAdminDm && onArchive && <button type="button" onClick={() => onArchive(room)}>归档测试课堂</button>}{room.environment === "test" && room.isAdminDm && onDelete && <button className={styles.deleteRoomAction} type="button" onClick={() => onDelete(room)}>删除测试课堂</button>}{archived && <a className={styles.secondaryRoomAction} href={factoryHrefForRoom(room)}>以此 exact 版本新建 →</a>}</div></div>
  </article>;
}

function ArchiveDialog({ room, reason, busy, onReason, onCancel, onConfirm }: {
  room: ClassroomInstanceSummary;
  reason: string;
  busy: boolean;
  onReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title">
      <small className={styles.eyebrow}>TEST RETENTION · 操作确认</small>
      <h2 id="archive-dialog-title">归档这一个测试课堂？</h2>
      <p><b>{room.title}</b><br /><code>{room.id}</code></p>
      <ul><li><b>重置</b>：仍在同一课堂内开始新 run，会清空本 run 的可变测试数据。</li><li><b>归档</b>：本次操作；保留全部内容并永久只读，从活跃列表移到历史区。</li><li><b>永久删除</b>：系统不提供，避免课程回执、作品与审计证据悬空。</li></ul>
      {room.acceptance.uiReceiptId && <p className={styles.archiveWarning}>这场课堂已签发 UI 回执。归档后回执保留为历史证据，但不能再用于新的发布或 Production 创建。</p>}
      <label className={styles.archiveReason}>归档备注（可选）<textarea value={reason} maxLength={500} onChange={(event) => onReason(event.target.value)} placeholder="例如：r12 已替代本轮测试" /></label>
      <div className={styles.dialogActions}><button className={styles.secondary} type="button" disabled={busy} onClick={onCancel}>取消，继续保留</button><button className={styles.danger} type="button" disabled={busy} onClick={onConfirm}>{busy ? "正在原子归档…" : "确认归档为只读"}</button></div>
    </section>
  </div>;
}

function DeleteDialog({ room, preview, previewError, loading, busy, reason, confirmed, onReason, onConfirmed, onRetry, onCancel, onConfirm }: {
  room: ClassroomInstanceSummary;
  preview: TestClassroomDeletionPreview | null;
  previewError: string;
  loading: boolean;
  busy: boolean;
  reason: string;
  confirmed: boolean;
  onReason: (value: string) => void;
  onConfirmed: (value: boolean) => void;
  onRetry: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const impact = preview?.impact;
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className={`${styles.dialog} ${styles.deleteDialog}`} role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" data-blocked={preview ? !preview.canDelete : undefined}>
      <small className={styles.eyebrow}>TEST DELETE · 不可撤销</small>
      <h2 id="delete-dialog-title">删除这一个测试课堂？</h2>
      <div className={styles.deleteTarget}>
        <b>{room.title}</b>
        <code>{room.id}</code>
        <span>TEST · {room.archive ? "ARCHIVED · READ ONLY" : room.lifecycle.toUpperCase()} · {room.courseRef.courseId}@r{room.courseRef.revision}</span>
        <code>{room.courseRef.digest}</code>
      </div>
      {loading && <p className={styles.deletePreviewState} role="status">正在检查实例范围、验收回执与正式发布依赖…</p>}
      {previewError && <div className={styles.archiveWarning} role="alert"><b>{preview ? "删除没有执行" : "依赖检查未完成"}</b><p>{previewError}</p><button type="button" onClick={onRetry} disabled={loading || busy}>重新检查</button></div>}
      {preview && <>
        <div className={styles.deleteColumns}>
          <section><h3>将永久删除</h3><ul>
            <li>{impact?.memberships ?? 0} 条课堂 Membership</li>
            <li>{impact?.submissions ?? 0} 份课堂提交／作品</li>
            <li>{impact?.privateCards ?? 0} 张私有发牌记录</li>
            <li>{impact?.economyRecords ?? 0} 条本课堂 RP／资金／道具记录</li>
            <li>{impact?.runAndAuditRecords ?? 0} 条运行与课堂审计记录</li>
          </ul></section>
          <section><h3>明确保留</h3><ul>{preview.preserved.map((item) => <li key={item}>{item}</li>)}</ul></section>
        </div>
        {preview.blockers.length > 0 && <section className={styles.deleteBlockers} role="alert"><h3>当前不能删除 · {preview.blockers.length} 组证据依赖</h3>{preview.blockers.map((blocker) => <article key={blocker.code}><b>{blocker.label}</b><p>{blocker.detail}</p>{blocker.referenceIds.map((id) => <code key={id}>{id}</code>)}</article>)}<p>建议保留为只读归档；系统不会为了删除而改写或拆断验收证据。</p></section>}
        {preview.canDelete && <>
          <p className={styles.deleteTombstone}>删除后，普通列表与历史列表都不再显示，旧链接返回“课堂已删除”。系统只保留一条不含学员正文的不可变审计墓碑。</p>
          <label className={styles.archiveReason}>删除备注（可选）<textarea value={reason} maxLength={500} onChange={(event) => onReason(event.target.value)} placeholder="例如：隔离测试数据已完成验证" /></label>
          <label className={styles.deleteConfirmation}><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} /><span>我已核对 classroomId，并确认永久删除上方这一个 TEST 实例；此操作不能撤销。</span></label>
        </>}
      </>}
      <div className={styles.dialogActions}>
        <button className={styles.secondary} type="button" disabled={busy} onClick={onCancel}>取消，不做任何修改</button>
        {preview?.canDelete && <button className={styles.danger} type="button" disabled={busy || loading || !confirmed} onClick={onConfirm}>{busy ? "正在原子删除…" : "确认永久删除 TEST"}</button>}
      </div>
    </section>
  </div>;
}

function FactoryPanel({ bootstrap, accounts, bootstrapError, accountsError, bootstrapLoading, accountsLoading, currentUserId, currentUserRole, initialCourse, onRefresh, onRetryBootstrap, onRetryAccounts, onLookupAccounts, onCreated, onAccounts, onError }: {
  bootstrap: Bootstrap | null;
  accounts: Account[];
  bootstrapError: string;
  accountsError: string;
  bootstrapLoading: boolean;
  accountsLoading: boolean;
  currentUserId: string;
  currentUserRole: string;
  initialCourse: InitialCourse;
  onRefresh: () => Promise<void>;
  onRetryBootstrap: () => Promise<void>;
  onRetryAccounts: () => Promise<void>;
  onLookupAccounts: (query: string) => Promise<Account[]>;
  onCreated: (message: string) => Promise<void>;
  onAccounts: (accounts: IssuedManagedCredential[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  if (!bootstrap) {
    return <section className={styles.section} id="factory" tabIndex={-1}>
      <header className={styles.sectionHeader}>
        <div><span className={styles.environmentBadge} data-env={initialCourse?.environment ?? "test"}>TEST</span><h2>Classroom Factory</h2><p>创建区不会因为某个初始化请求失败而消失。</p></div>
      </header>
      <div className={styles.factoryUnavailable} aria-busy={bootstrapLoading || undefined}>
        <small>COURSE DATA · REQUIRED</small>
        <h3>{bootstrapLoading ? "正在读取课程与验收状态…" : "课程数据暂时不可用"}</h3>
        <p>{bootstrapError || "还没有收到课程数据。课堂列表与账号服务仍可独立使用。"}</p>
        <div className={styles.recoveryActions}>
          <button type="button" onClick={() => { void onRetryBootstrap(); }} disabled={bootstrapLoading}>{bootstrapLoading ? "读取中…" : "重试课程数据"}</button>
          <Link href="/studio/editor/">去课程编辑器</Link>
        </div>
      </div>
    </section>;
  }

  return <FactoryForm
    key="classroom-factory-form"
    bootstrap={bootstrap}
    accounts={accounts}
    bootstrapError={bootstrapError}
    accountsError={accountsError}
    bootstrapLoading={bootstrapLoading}
    accountsLoading={accountsLoading}
    currentUserId={currentUserId}
    currentUserRole={currentUserRole}
    initialCourse={initialCourse}
    onRefresh={onRefresh}
    onRetryBootstrap={onRetryBootstrap}
    onRetryAccounts={onRetryAccounts}
    onLookupAccounts={onLookupAccounts}
    onCreated={onCreated}
    onAccounts={onAccounts}
    onError={onError}
  />;
}

function FactoryForm({ bootstrap, accounts, bootstrapError, accountsError, bootstrapLoading, accountsLoading, currentUserId, currentUserRole, initialCourse, onRefresh, onRetryBootstrap, onRetryAccounts, onLookupAccounts, onCreated, onAccounts, onError }: {
  bootstrap: Bootstrap;
  accounts: Account[];
  bootstrapError: string;
  accountsError: string;
  bootstrapLoading: boolean;
  accountsLoading: boolean;
  currentUserId: string;
  currentUserRole: string;
  initialCourse: InitialCourse;
  onRefresh: () => Promise<void>;
  onRetryBootstrap: () => Promise<void>;
  onRetryAccounts: () => Promise<void>;
  onLookupAccounts: (query: string) => Promise<Account[]>;
  onCreated: (message: string) => Promise<void>;
  onAccounts: (accounts: IssuedManagedCredential[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const preferred = useMemo(() => preferredVersions(bootstrap.versions), [bootstrap.versions]);
  const initialEnvironment = initialCourse?.environment ?? "test";
  const requestedKey = initialCourse ? courseRefKey(initialCourse) : "";
  const requestedCourse = preferred.find((item) => matchesInitialCourse(item, initialCourse));
  const [environment, setEnvironment] = useState<"test" | "production">(initialEnvironment);
  const [courseKey, setCourseKey] = useState(requestedCourse ? versionKey(requestedCourse) : requestedKey || (preferred[0] ? versionKey(preferred[0]) : ""));
  const selectedCourseKey = courseKey || (!requestedKey && preferred[0] ? versionKey(preferred[0]) : "");
  const course = preferred.find((item) => versionKey(item) === selectedCourseKey) ?? null;
  const requestedRef = !course && initialCourse && selectedCourseKey === requestedKey ? initialCourse : null;
  const [title, setTitle] = useState(() => defaultClassroomTitle(initialEnvironment, requestedCourse ?? null));
  const [titleCustomized, setTitleCustomized] = useState(false);
  const [learnerCount, setLearnerCount] = useState(course?.learnerPolicy.defaultCount ?? 0);
  const mentors = useMemo(() => accounts.filter((account) => account.role === "mentor" || account.role === "admin"), [accounts]);
  const learners = useMemo(() => accounts.filter((account) => account.role === "learner"), [accounts]);
  const [mentorIds, setMentorIds] = useState<string[]>(() => fillEmptyUnique(Array.from({ length: MENTOR_ROLES.length }, () => ""), mentors));
  const [learnerIds, setLearnerIds] = useState<string[]>(() => fillEmptyUnique(Array.from({ length: course?.learnerPolicy.defaultCount ?? 0 }, () => ""), learners));
  const [adminId, setAdminId] = useState(currentUserId);
  const initialViewReceipt = course ? exactViewReceipt(bootstrap, course.ref, initialCourse?.viewReceiptId) : null;
  const initialUiReceipts = course && initialViewReceipt ? exactUiReceipts(bootstrap, course.ref, initialViewReceipt.receiptId) : [];
  const initialUiReceipt = initialUiReceipts.find((receipt) => receipt.receiptId === initialCourse?.uiReceiptId) ?? initialUiReceipts.find((receipt) => receipt.valid) ?? initialUiReceipts[0];
  const [uiReceiptId, setUiReceiptId] = useState(initialUiReceipt?.receiptId ?? "");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<IssuedManagedCredential[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [accountActionError, setAccountActionError] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountLookupBusy, setAccountLookupBusy] = useState(false);
  const [accountLookupNotice, setAccountLookupNotice] = useState("");
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const operationLockRef = useRef(false);
  const effectiveLearnerCount = course ? clampCount(learnerCount || course.learnerPolicy.defaultCount, course.learnerPolicy) : 0;
  const resolvedMentorIds = fillEmptyUnique(mentorIds, mentors);
  const resolvedLearnerIds = fillEmptyUnique(resizeIdsOnly(learnerIds, effectiveLearnerCount), learners);

  const viewReceipt = course ? exactViewReceipt(bootstrap, course.ref, initialCourse?.viewReceiptId) : null;
  const uiReceiptOptions = course && viewReceipt ? exactUiReceipts(bootstrap, course.ref, viewReceipt.receiptId) : [];
  const uiReceipt = uiReceiptOptions.find((receipt) => receipt.receiptId === uiReceiptId)
    ?? (uiReceiptId ? null : uiReceiptOptions.find((receipt) => receipt.valid) ?? uiReceiptOptions[0] ?? null);
  const uiReceiptUnavailable = Boolean(uiReceiptId && !uiReceipt);
  // CourseDefinition and mentor decks are deliberately decoupled. Creating a
  // classroom selects exactly one script version; the server resolves the
  // current released deck for every mentor role and playback re-resolves it
  // on every open. These client refs are only a compatibility snapshot for
  // the existing factory request shape, never a user-selectable binding.
  const coursewareRefs = currentReleasedCoursewareRefs(bootstrap.courseware);
  const checklist = buildFactoryChecklist({
    environment,
    title,
    course: course ? { name: course.course.course.name, ref: course.ref, candidate: course.candidate, released: course.released } : null,
    requestedRef,
    viewReceipt,
    uiReceipt,
    coursewareRefs,
    mentorIds: resolvedMentorIds,
    learnerIds: resolvedLearnerIds,
    learnerCount: effectiveLearnerCount,
    adminId: currentUserRole === "mentor" ? currentUserId : adminId,
    adminLockedToCreator: currentUserRole === "mentor",
  });
  const dependencyBlocked = Boolean(bootstrapError || accountsError || bootstrapLoading || accountsLoading);
  const canCreate = checklist.ready && !dependencyBlocked && !busy;

  const showSubmitError = (message: string) => {
    setSubmitError(message);
    onError("");
    window.setTimeout(() => submitErrorRef.current?.focus(), 0);
  };

  const createAccounts = async () => {
    if (operationLockRef.current) return;
    if (!course || effectiveLearnerCount < 1) {
      setAccountActionError("请先选择一门课程和该课程允许的学员人数，再生成对应数量的测试账号。");
      return;
    }
    operationLockRef.current = true;
    setBusy(true);
    setAccountActionError("");
    onError("");
    const stamp = accountBatchStamp();
    try {
      const issued = await api<IssuedManagedCredential[]>("/api/studio/accounts", {
        method: "POST",
        body: JSON.stringify({ accounts: [
          ...MENTOR_ROLES.map((role) => ({ username: `mentor-${role.toLowerCase()}-${stamp}`.toLowerCase(), displayName: `${ROLE_NAME[role]}导师 ${stamp.slice(-4)}`, role: "mentor" })),
          ...Array.from({ length: effectiveLearnerCount }, (_, index) => ({ username: `builder-${stamp}-${index + 1}`.toLowerCase(), displayName: `Young Builder ${index + 1}`, role: "learner" })),
        ] }),
      });
      setCredentials(issued);
      setMentorIds(issued.filter((item) => item.role === "mentor").map((item) => item.userId));
      setLearnerIds(issued.filter((item) => item.role === "learner").map((item) => item.userId));
      await onAccounts(issued);
    } catch (cause) {
      setAccountActionError(messageOf(cause));
    } finally {
      operationLockRef.current = false;
      setBusy(false);
    }
  };

  const lookupAccount = async () => {
    const query = accountQuery.trim();
    setAccountLookupNotice("");
    setAccountActionError("");
    if (query.length < 2) {
      setAccountActionError("请输入完整用户名或昵称，至少 2 个字符；系统不会显示可浏览的全站账号目录。");
      return;
    }
    setAccountLookupBusy(true);
    try {
      const matches = await onLookupAccounts(query);
      setAccountLookupNotice(matches.length
        ? `已把 ${matches.map((item) => `${item.displayName} · @${item.username}`).join("、")} 加入下方账号选择列表。`
        : "没有找到完全匹配的有效账号。请让对方确认用户名或显示名称后重试。");
    } catch (cause) {
      setAccountActionError(messageOf(cause));
    } finally {
      setAccountLookupBusy(false);
    }
  };

  const createClassroom = async () => {
    if (operationLockRef.current) return;
    if (!canCreate || !course || !viewReceipt?.valid) {
      const first = checklist.items.find((item) => !item.ready);
      showSubmitError(first ? `${first.label}尚未就绪：${first.message}` : "依赖数据仍在读取或刷新失败，请先刷新状态。");
      return;
    }
    if (environment === "production" && !uiReceipt?.valid) {
      showSubmitError("正式课堂必须选择一张当前有效的真实 UI 验收回执。");
      return;
    }
    const currentCoursewareRefs = coursewareRefs.filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (currentCoursewareRefs.length !== MENTOR_ROLES.length) {
      showSubmitError("P／D／M／O 导师还没有完整的当前已发布课件，请先补齐课件库。");
      return;
    }
    operationLockRef.current = true;
    setBusy(true);
    setSubmitError("");
    onError("");
    try {
      const result = await api<{ classroomId: string; teamPublicId: string }>("/api/platform/classrooms", {
        method: "POST",
        body: JSON.stringify({
          environment,
          title: title.trim(),
          learnerCount: effectiveLearnerCount,
          courseRef: course.ref,
          viewAcceptanceReceiptId: viewReceipt.receiptId,
          ...(environment === "production" && uiReceipt ? { uiAcceptanceReceiptId: uiReceipt.receiptId } : {}),
          mentorSeats: MENTOR_ROLES.map((mentorRole, index) => ({ mentorRole, profileId: resolvedMentorIds[index] })),
          learnerProfileIds: resolvedLearnerIds,
          adminDmProfileIds: [currentUserRole === "mentor" ? currentUserId : adminId],
        }),
      });
      await onCreated(`${environment === "test" ? "UI 验收" : "正式"}课堂已创建。队伍 ID：${result.teamPublicId}；课程剧本版本已锁定，导师打开课件时始终使用各自最新发布版。`);
      window.location.assign(`/classroom/${encodeURIComponent(result.classroomId)}/control`);
    } catch (cause) {
      showSubmitError(messageOf(cause));
    } finally {
      operationLockRef.current = false;
      setBusy(false);
    }
  };

  const chooseEnvironment = (nextEnvironment: "test" | "production") => {
    const nextView = course ? exactViewReceipt(bootstrap, course.ref, initialCourse?.viewReceiptId) : null;
    const nextUiOptions = course && nextView ? exactUiReceipts(bootstrap, course.ref, nextView.receiptId) : [];
    const nextUi = nextUiOptions.find((receipt) => receipt.valid) ?? nextUiOptions[0];
    setEnvironment(nextEnvironment);
    if (!titleCustomized) setTitle(defaultClassroomTitle(nextEnvironment, course));
    setSubmitError("");
    setUiReceiptId(nextEnvironment === "production" ? nextUi?.receiptId ?? "" : "");
  };

  const chooseCourse = (nextKey: string) => {
    const nextCourse = preferred.find((item) => versionKey(item) === nextKey) ?? null;
    setCourseKey(nextKey);
    setSubmitError("");
    if (!nextCourse) {
      setLearnerCount(0);
      setLearnerIds([]);
      return;
    }
    if (!titleCustomized) setTitle(defaultClassroomTitle(environment, nextCourse));
    const nextView = exactViewReceipt(bootstrap, nextCourse.ref, initialCourse?.viewReceiptId);
    const nextUiOptions = nextView ? exactUiReceipts(bootstrap, nextCourse.ref, nextView.receiptId) : [];
    const nextUi = nextUiOptions.find((receipt) => receipt.valid) ?? nextUiOptions[0];
    setUiReceiptId(nextUi?.receiptId ?? "");
    const nextCount = clampCount(learnerCount || nextCourse.learnerPolicy.defaultCount, nextCourse.learnerPolicy);
    setLearnerCount(nextCount);
    setLearnerIds((current) => fillEmptyUnique(resizeIdsOnly(current, nextCount), learners));
  };

  const chooseUiReceipt = (receiptId: string) => {
    setUiReceiptId(receiptId);
    setSubmitError("");
  };

  const chooseLearnerCount = (nextCount: number) => {
    setLearnerCount(nextCount);
    setLearnerIds((current) => fillEmptyUnique(resizeIdsOnly(current, nextCount), learners));
    setSubmitError("");
  };

  return <section className={styles.section} id="factory" tabIndex={-1}>
    <header className={`${styles.sectionHeader} ${styles.factoryHeader}`}>
      <div><span className={styles.environmentBadge} data-env={environment}>{environment.toUpperCase()}</span><h2>Classroom Factory</h2><p>只选择一个课程剧本版本；导师课件与剧本解耦，打开时自动使用最新发布版。</p></div>
      <button className={styles.refreshButton} type="button" onClick={() => { void onRefresh(); }} disabled={bootstrapLoading || accountsLoading}>{bootstrapLoading || accountsLoading ? "正在刷新…" : "刷新创建条件"}</button>
    </header>
    {(bootstrapError || accountsError) && <div className={styles.dependencyStack}>
      {bootstrapError && <DependencyNotice label="课程与验收状态" message={bootstrapError} retained onRetry={onRetryBootstrap} />}
      {accountsError && <DependencyNotice label="成员账号" message={accountsError} retained={accounts.length > 0} onRetry={onRetryAccounts} />}
    </div>}
    <div className={styles.factory}>
      <aside className={styles.factoryAside}>
        <small>ONE FACTORY · EXACT GATES</small>
        <h3>{environment === "test" ? "创建真实 UI 验收课堂" : "创建正式课堂"}</h3>
        <ol>{environment === "test" ? <><li>选择唯一的 Candidate 或 Released 剧本版本</li><li>完成该剧本的多角色视图检查</li><li>配置真实 N 与 4 + N 个成员</li><li>导师课件打开时自动取最新发布版</li></> : <><li>选择唯一的 Released 剧本版本</li><li>绑定同版本有效 View + UI 检查记录</li><li>导师课件独立更新，不阻塞建课</li><li>Production 不提供测试重置</li></>}</ol>
        <button type="button" onClick={createAccounts} disabled={busy || !course || effectiveLearnerCount < 1}>{busy ? "正在处理…" : course ? `一键生成 4＋${effectiveLearnerCount} 个测试账号` : "先选择课程再生成账号"}</button>
        <form className={styles.accountLookup} onSubmit={(event) => { event.preventDefault(); void lookupAccount(); }}>
          <label htmlFor="factory-account-lookup">查找自行注册的账号</label>
          <input id="factory-account-lookup" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value.slice(0, 64))} placeholder="完整用户名或昵称" autoComplete="off" />
          <button type="submit" disabled={accountLookupBusy || accountQuery.trim().length < 2}>{accountLookupBusy ? "正在查找…" : "精确查找并加入列表"}</button>
          <small>只做完全匹配，不开放全站模糊搜索。找到后仍需在下方明确分配 Membership。</small>
        </form>
        {accountLookupNotice && <p className={styles.asideNotice} role="status">{accountLookupNotice}</p>}
        {accountActionError && <p className={styles.asideError} role="alert">{accountActionError}</p>}
      </aside>
      <div className={styles.factoryForm}>
        <label>课堂环境<select value={environment} onChange={(event) => chooseEnvironment(event.target.value as "test" | "production")}><option value="test">TEST · UI 验收课堂 · 可重置</option><option value="production">PRODUCTION · 正式课堂 · 不可重置</option></select></label>
        <label id="classroom-title">课堂名称<input value={title} onChange={(event) => { setTitle(event.target.value); setTitleCustomized(true); setSubmitError(""); }} maxLength={128} /></label>
        <label className={styles.wide} id="course-version">选择课程剧本版本
          <select value={selectedCourseKey} onChange={(event) => chooseCourse(event.target.value)} disabled={!preferred.length && !selectedCourseKey}>
            {!selectedCourseKey && <option value="">当前没有 Candidate 或 Released 课程</option>}
            {!course && selectedCourseKey && <option value={selectedCourseKey}>{requestedRef ? `${requestedRef.courseId} · r${requestedRef.revision}` : "刚才选择的版本"} · 当前不可用（未自动换课）</option>}
            {preferred.map((item) => <option key={versionKey(item)} value={versionKey(item)}>{courseOptionLabel(bootstrap, item, environment)}</option>)}
          </select>
          <small>{preferred.length ? `当前只会使用上面选中的一个剧本版本。列表中的其他项仅供切换，不会同时生效。` : "尚无课程。先在编辑器保存 Candidate，再回来刷新状态。"}</small>
        </label>
        {course && viewReceipt && <div className={`${styles.acceptanceLock} ${styles.wide}`} data-valid={viewReceipt.valid}><b>课程视图检查 · {viewReceipt.valid ? "有效" : "已失效"}</b><code>{viewReceipt.receiptId}</code><span>r{course.ref.revision} · {course.ref.digest}{viewReceipt.valid ? "" : ` · ${viewReceipt.invalidReasons.join("；") || "兼容条件已变化"}`}</span></div>}
        {environment === "production" && <label className={styles.wide}>真实 UI 验收回执
          <select value={uiReceiptId} onChange={(event) => chooseUiReceipt(event.target.value)} disabled={!uiReceiptOptions.length}>
            {!uiReceiptOptions.length && <option value="">这个版本还没有对应的 UI 验收回执</option>}
            {uiReceiptUnavailable && <option value={uiReceiptId}>刚才选择的 UI 回执已不可用（未自动替换）</option>}
            {uiReceiptOptions.map((receipt) => <option value={receipt.receiptId} key={receipt.receiptId}>{receipt.receiptId.slice(0, 12)}… · {receipt.learnerCount} 人 · {receipt.valid ? "有效" : "已失效"} · {new Date(receipt.acceptedAt).toLocaleString("zh-CN")}</option>)}
          </select>
          <small>回执只验收这一个课程剧本与课堂 UI；导师课件保持独立更新。</small>
        </label>}
        <label>学员人数
          <select value={course ? effectiveLearnerCount : 0} onChange={(event) => chooseLearnerCount(Number(event.target.value))} disabled={!course}>
            {!course && <option value={0}>请先选择课程</option>}
            {course ? learnerCountOptions(course).map((count) => <option value={count} key={count}>{count} 名学员</option>) : null}
          </select>
          <small>{course ? `课程允许 ${course.learnerPolicy.minCount}—${course.learnerPolicy.maxCount} 人。` : "人数取自所选课程，不使用猜测的默认值。"}</small>
        </label>
        <label id="admin-dm">Admin DM（权限，不占导师席）<select value={currentUserRole === "mentor" ? currentUserId : adminId} disabled={currentUserRole === "mentor" || accountsLoading} onChange={(event) => { setAdminId(event.target.value); setSubmitError(""); }}><option value="">请选择账号</option>{mentors.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select><small>{currentUserRole === "mentor" ? "创建者将成为本课堂初始 Admin DM；开课后可在成员管理中授权协作者。" : "平台管理员可把初始 Admin DM 授予任一导师或管理员。"}</small></label>
        <div className={`${styles.mentorRows} ${styles.wide}`} id="mentor-members"><b>四个导师 Membership</b>{MENTOR_ROLES.map((role, index) => <div className={styles.mentorRow} key={role}><b>{role}</b><span>{ROLE_NAME[role]}导师</span><select aria-label={`${role} 导师账号`} value={resolvedMentorIds[index] ?? ""} onChange={(event) => { setMentorIds(resolvedMentorIds.map((id, at) => at === index ? event.target.value : id)); setSubmitError(""); }} disabled={accountsLoading}><option value="">请选择账号</option>{mentors.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select></div>)}</div>
        <div className={`${styles.acceptanceLock} ${styles.wide}`} data-valid={coursewareRefs.every(Boolean)}><b>导师课件 · 自动使用最新发布版</b><span>无需选择或核对课件版本；更新产品、开发、市场或运营课件，不会改变本课堂选择的课程剧本。</span></div>
        <div className={`${styles.learnerRows} ${styles.wide}`} id="learner-members">{resolvedLearnerIds.map((id, index) => <label key={index}>学员 {index + 1}<select aria-label={`学员 ${index + 1} 账号`} value={id} onChange={(event) => { setLearnerIds(resolvedLearnerIds.map((item, at) => at === index ? event.target.value : item)); setSubmitError(""); }} disabled={accountsLoading}><option value="">请选择账号</option>{learners.map((item) => <option key={item.userId} value={item.userId}>{item.displayName} · @{item.username}</option>)}</select></label>)}</div>
        <section className={`${styles.readiness} ${styles.wide}`} aria-labelledby="factory-readiness-title">
          <header><div><small>CREATE READINESS</small><h3 id="factory-readiness-title">创建前还差 {checklist.items.filter((item) => !item.ready).length} 项</h3></div><span data-ready={checklist.ready}>{checklist.ready ? "可以创建" : "尚未就绪"}</span></header>
          <ul>{checklist.items.map((item) => <li key={item.id} data-ready={item.ready}><span aria-hidden="true">{item.ready ? "✓" : "!"}</span><div><b>{item.label}</b><p>{item.message}</p></div>{!item.ready && item.actionHref ? item.actionHref.startsWith("#") ? <a href={item.actionHref}>{item.actionLabel}</a> : <Link href={item.actionHref}>{item.actionLabel}</Link> : null}</li>)}</ul>
          {(bootstrapLoading || accountsLoading) && <p className={styles.refreshState} role="status">正在刷新课程、回执和成员状态；已填写内容不会被清空。</p>}
          {dependencyBlocked && !bootstrapLoading && !accountsLoading && <p className={styles.refreshState} role="alert">依赖状态刷新失败。请使用上方对应重试按钮，确认最新状态后再创建。</p>}
          {submitError && <div className={styles.localError} role="alert" tabIndex={-1} ref={submitErrorRef}>{submitError}</div>}
          <button className={styles.factoryButton} type="button" onClick={createClassroom} disabled={!canCreate} aria-describedby="factory-readiness-title">{busy ? "正在执行不可变工厂事务…" : environment === "test" ? "创建真实 UI 验收课堂 →" : "创建 Production 正式课堂 →"}</button>
        </section>
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

function mergeAccounts(current: Account[], incoming: Account[]): Account[] {
  const merged = new Map(current.map((account) => [account.userId, account]));
  for (const account of incoming) merged.set(account.userId, account);
  return [...merged.values()].sort((left, right) => {
    const order = { admin: 0, mentor: 1, learner: 2 } as const;
    return order[left.role] - order[right.role] || left.username.localeCompare(right.username);
  });
}

function preferredVersions(versions: StudioVersion[]): StudioVersion[] {
  return [...new Set(versions.map((version) => version.ref.courseId))].flatMap((courseId) => {
    const matching = versions.filter((version) => version.ref.courseId === courseId);
    const candidate = matching.find((version) => version.candidate);
    const released = matching.find((version) => version.released);
    return [...(candidate ? [candidate] : []), ...(released && released !== candidate ? [released] : [])];
  });
}

function exactViewReceipt(bootstrap: Bootstrap, ref: CoursePackageRef, preferredReceiptId?: string) {
  const receipts = bootstrap.viewReceipts.filter((receipt) => sameCourseRef(receipt.courseRef, ref));
  return receipts.find((receipt) => receipt.receiptId === preferredReceiptId)
    ?? receipts.find((receipt) => receipt.valid)
    ?? receipts[0]
    ?? null;
}

function exactUiReceipts(bootstrap: Bootstrap, ref: CoursePackageRef, viewReceiptId: string) {
  return bootstrap.uiReceipts.filter((receipt) => receipt.viewReceiptId === viewReceiptId && sameCourseRef(receipt.courseRef, ref));
}

function matchesInitialCourse(version: StudioVersion, initial: InitialCourse) {
  return Boolean(initial && version.ref.courseId === initial.courseId && version.ref.revision === initial.revision && (!initial.digest || version.ref.digest === initial.digest));
}

function sameCourseRef(left: Pick<CoursePackageRef, "courseId" | "revision" | "digest">, right: Pick<CoursePackageRef, "courseId" | "revision" | "digest">) {
  return left.courseId === right.courseId && left.revision === right.revision && left.digest === right.digest;
}

function versionKey(version: StudioVersion): string { return `${version.ref.courseId}:${version.ref.revision}:${version.ref.digest}`; }
function courseRefKey(ref: Pick<CoursePackageRef, "courseId" | "revision"> & { digest?: string }): string { return `${ref.courseId}:${ref.revision}:${ref.digest ?? ""}`; }

function courseOptionLabel(bootstrap: Bootstrap, version: StudioVersion, environment: "test" | "production"): string {
  const view = exactViewReceipt(bootstrap, version.ref);
  const ui = view ? exactUiReceipts(bootstrap, version.ref, view.receiptId).find((receipt) => receipt.valid) : null;
  const lifecycle = version.candidate && version.released ? "Candidate + Released" : version.candidate ? "Candidate" : "Released";
  if (!view) return `${version.course.course.name} · r${version.ref.revision} · ${lifecycle} · 待视图检查`;
  if (!view.valid) return `${version.course.course.name} · r${version.ref.revision} · ${lifecycle} · 视图检查已失效`;
  if (environment === "production" && !version.released) return `${version.course.course.name} · r${version.ref.revision} · Candidate · 待发布`;
  if (environment === "production" && !ui) return `${version.course.course.name} · r${version.ref.revision} · Released · 待 UI 验收`;
  return `${version.course.course.name} · r${version.ref.revision} · ${lifecycle} · ${environment === "test" ? "视图检查通过" : "发布门禁通过"}`;
}

function defaultClassroomTitle(environment: "test" | "production", version: StudioVersion | null): string {
  const course = version ? `${version.course.course.name} · r${version.ref.revision}` : "Mini Silicon Valley";
  return `${course} · ${environment === "test" ? "测试课堂" : "正式课堂"}`;
}

function factoryHrefForRoom(room: ClassroomInstanceSummary): string {
  const query = new URLSearchParams({
    course: room.courseRef.courseId,
    revision: String(room.courseRef.revision),
    digest: room.courseRef.digest,
    environment: "test",
    ...(room.acceptance.viewReceiptId ? { viewReceipt: room.acceptance.viewReceiptId } : {}),
  });
  return `/classroom/?${query.toString()}#factory`;
}

function learnerCountOptions(course: StudioVersion): number[] {
  const { minCount, maxCount } = course.learnerPolicy;
  if (!Number.isInteger(minCount) || !Number.isInteger(maxCount) || minCount < 1 || maxCount < minCount) return [];
  return Array.from({ length: maxCount - minCount + 1 }, (_, index) => minCount + index);
}

function clampCount(count: number, policy: StudioVersion["learnerPolicy"]): number {
  return Math.min(policy.maxCount, Math.max(policy.minCount, count));
}

function currentReleasedCoursewareRefs(items: CoursewareSummary[]) {
  return MENTOR_ROLES.map((role) => {
    const released = items.filter((item) => item.mentorRole === role && item.releasedRevision !== null && item.releasedDigest);
    const item = released.find(isCoursewareLibraryVisible) ?? released[0];
    return item ? {
      mentorRole: role,
      packageId: item.packageId,
      slug: item.slug,
      revision: item.releasedRevision!,
      digest: item.releasedDigest!,
    } : null;
  });
}

function resizeIdsOnly(current: string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => current[index] ?? "");
}

function fillEmptyUnique(current: string[], candidates: Account[]): string[] {
  const availableIds = new Set(candidates.map((item) => item.userId));
  const normalized = current.map((id) => id && availableIds.has(id) ? id : "");
  const used = new Set(normalized.filter(Boolean));
  return normalized.map((id) => {
    if (id) return id;
    const next = candidates.find((candidate) => !used.has(candidate.userId));
    if (!next) return "";
    used.add(next.userId);
    return next.userId;
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers, cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || body.ok === false) {
    const fallback = response.status === 401
      ? "登录状态已失效，请重新登录后再刷新。"
      : response.status === 403
        ? "当前账号没有读取或执行这项操作的权限。"
        : response.status === 409
          ? "数据在操作期间发生变化，请刷新状态后重试。"
          : response.status >= 500
            ? "服务暂时不可用，已保留页面中的配置，请稍后重试。"
            : `请求失败（${response.status}）。`;
    throw new Error(body.error?.message || fallback);
  }
  return body.data as T;
}
function messageOf(value: unknown): string {
  if (value instanceof TypeError && /fetch|network|load failed/i.test(value.message)) return "网络连接失败，已保留页面中的配置；请检查连接后重试。";
  return value instanceof Error ? value.message : "操作没有完成，请重试。";
}
function accountBatchStamp(): string { return Date.now().toString(36).slice(-8); }
function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
