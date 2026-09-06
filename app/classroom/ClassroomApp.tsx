"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ApiEnvelope,
  ClassroomAction,
  ClassroomDashboardDto,
  ClassroomLearnerSearchResult,
  ClassroomRoomDto,
} from "../lib/classroom-api";
import type { IssuedPasswordResetLink } from "../lib/auth-model";
import type { ClassroomPhase } from "../lib/classroom-model";
import {
  EVIDENCE_BOUNDARY_LABELS,
  evidenceBoundaryForCard,
  evidenceBoundaryLabel,
  learnerCardTitle,
} from "../lib/evidence-boundary";
import { publicPath } from "../lib/public-path";
import { normalizeTeamPublicId, TEAM_PUBLIC_ID_PATTERN } from "../lib/team-access";
import styles from "./classroom.module.css";
import { BrandHomeLink } from "../components/BrandHomeLink";

type TabId = "mission" | "identity" | "intel" | "team" | "challenge" | "growth" | "personal" | "history" | "debrief" | "dm";
type ActionRunner = (action: ClassroomAction, successMessage?: string) => Promise<boolean>;

type PhaseMeta = {
  label: string;
  short: string;
  tab: TabId;
  dmTab?: TabId;
  learner: string;
  dm: string;
  proof: string;
};

const PHASES: ClassroomPhase[] = [
  "lobby", "identity", "private-read", "intel-brief", "intel-network", "dm-gate", "pdmo",
  "challenge-one", "challenge-two", "growth", "history", "debrief", "completed",
];

const PHASE_META: Record<ClassroomPhase, PhaseMeta> = {
  lobby: { label: "四人到齐", short: "集结", tab: "mission", dmTab: "dm", learner: "看看队伍里是否已经出现4个名字；没有到齐就把队伍ID发给同学，已经申请就等老师批准。", dm: "分享各队队伍ID、审批申请并确认每队4人；随后分别随机分配身份与手牌。", proof: "每队正好4名学员" },
  identity: { label: "拿到角色任务", short: "角色", tab: "identity", learner: "只看自己的角色：他想完成什么、担心什么、能用哪一次能力。用一句话复述给老师。", dm: "逐一确认每人能用自己的话说出角色目标；把身份作为情境入口，不讲方法论答案。", proof: "每个人能说清自己的角色任务" },
  "private-read": { label: "打开三张线索", short: "开卡", tab: "identity", learner: "独自打开3张线索卡。每张先分成“我看到了什么”和“我还不确定什么”。", dm: "用具体追问帮助学员区分已发生的事、观察、个人想法与未经确认的消息。", proof: "每人打开并读完3张线索" },
  "intel-brief": { label: "讲给队友听", short: "讲线索", tab: "identity", learner: "选一张线索，用30秒自己的话讲给队友；说完再点击发布，不要直接照着屏幕念。", dm: "用“卡上哪句话支持你？”追问，确保每人完成一次复述和一次队友追问。", proof: "每人讲出并发布至少1张线索" },
  "intel-network": { label: "把线索连起来", short: "连线", tab: "intel", learner: "把人物、困难和证据做成便签，再用“因为……”连接两张便签。", dm: "在导师视角检查用户/人物、场景损失、2条来源证据、约束与矛盾/缺口等认知门槛。", proof: "线索墙里有人物、有困难、有证据和解释线" },
  "dm-gate": { label: "用五句话说清问题", short: "五句话", tab: "intel", learner: "按顺序说：谁遇到问题、哪里卡住、证据是什么、还缺什么、下一步要试什么。", dm: "把五句话命名为用户、场景损失、证据、未知与可验证决策；追问但不宣布历史答案。", proof: "团队留下完整的五句话问题卡" },
  // `pdmo` is a legacy persisted phase id. Its current product meaning is a
  // plain team plan; learners never see or claim P/D/M/O roles.
  pdmo: { label: "商量团队计划", short: "协作", tab: "team", learner: "四个人面对同一个问题：说清第一步谁来做、谁来帮、做完看什么结果。每个人都完整参与五步。", dm: "让学员用具体动作完成分工。P/D/M/O 只用于四类导师之间的专业支援，不是学员身份。", proof: "团队能说清第一步、负责人、支援者和检查结果" },
  "challenge-one": { label: "第一次试做", short: "试做", tab: "challenge", learner: "读清任务和突发情况，和队友商量后写下要做什么、怎么做、用什么、怎样才算有效。", dm: "投放情境压力；带领团队把讨论翻译为目标、方法、证据、资源和判断边界。", proof: "每人提交一次对团队方案的具体贡献" },
  "challenge-two": { label: "根据反馈改一次", short: "再改", tab: "challenge", learner: "对照第一次结果，至少换一条证据、一个办法、一种资源或一个判断标准，再提交第二版。", dm: "引导学员先指出变化，再用证据、逻辑、执行、协作四项公开规则结算。", proof: "每人交出一份看得见变化的第二版" },
  growth: { label: "算账和选工具", short: "算账", tab: "growth", learner: "先看团队赚了多少、花了多少；再一起投票选工具，并感谢一名真正帮助过团队的人。", dm: "在导师端解释RP、收入、成本、利润、资金分配与账本守恒；学员只执行看账、表决和举证感谢。", proof: "钱箱、工具投票和贡献记录都已更新" },
  history: { label: "我们的选择 vs 历史", short: "对照", tab: "history", learner: "先写下团队会怎么做和为什么，确认后锁定；老师翻开历史后，找出一处相同和一处不同。", dm: "所有团队先冻结玩家判断，再揭晓来源可追溯的史实；用对照提炼而非灌输抽象原则。", proof: "我们的选择先锁定，历史答案后打开" },
  debrief: { label: "说清学到和下一步", short: "下一步", tab: "debrief", learner: "回答6个短问题，再写下未来2天由你完成的一件具体小事：什么时候交、交什么、怎样检查。", dm: "在具体经历之后命名证据意识、角色协作、迭代和迁移；确认每人有可检查交付。", proof: "每人提交6个回答和一件两天内的行动" },
  completed: { label: "完成六分钟发布", short: "发布", tab: "debrief", learner: "从作品中挑出问题、线索、做法、结果和下一步，和队友排练后完成六分钟现场发布。", dm: "主持Demo Day、反馈方法层认知、导出课堂档案并归档。", proof: "团队完成六分钟发布并留下作品" },
};

const STUDENT_PHASE_STEPS: Record<ClassroomPhase, readonly [string, string, string]> = {
  lobby: ["核对页面上的队伍ID", "确认队伍里出现4个学员名字", "到齐后等待老师随机发角色和线索"],
  identity: ["读角色的公开目标", "只看自己的担心和一次能力", "用一句话说：我现在要帮团队做什么"],
  "private-read": ["独自打开3张线索", "每张圈出一件确定的事", "选一张准备讲给队友"],
  "intel-brief": ["用30秒复述一张线索", "请一名队友问一个问题", "讲完后点击发布到团队"],
  "intel-network": ["放一个人物或用户便签", "放至少两个有卡片来源的证据便签", "用“因为……”连出限制或矛盾"],
  "dm-gate": ["说清谁遇到问题、在哪里卡住", "指出支持它的线索", "说出还缺什么和下一步要试什么"],
  pdmo: ["全队先说出准备解决的同一个问题", "商量第一步谁做、谁支援", "写清做完后一起检查什么结果"],
  "challenge-one": ["读任务和骰子带来的突发情况", "填写6个行动小格", "提交第一次做法并等队友"],
  "challenge-two": ["指出第一次哪里不够好", "至少改动一个地方", "提交第二版并准备说明为什么改"],
  growth: ["看团队收支清单", "对一个工具投赞成或反对", "写下队友的一项真实帮助"],
  history: ["写下团队会怎么做", "写下卡片或作品依据并锁定", "历史打开后找一处相同和一处不同"],
  debrief: ["回答6个短问题", "写一件未来2天能完成的小事", "填清完成时间和检查办法后提交"],
  completed: ["挑出最能说明过程的作品", "按问题—线索—做法—结果—下一步排练", "和队友完成六分钟发布"],
};

const TABS: Array<{ id: TabId; icon: string; label: string; learnerOnly?: boolean; dmOnly?: boolean }> = [
  { id: "mission", icon: "⌂", label: "现在做什么" },
  { id: "identity", icon: "◈", label: "我的角色和线索" },
  { id: "intel", icon: "⌘", label: "团队线索墙" },
  { id: "team", icon: "◎", label: "团队协作" },
  { id: "challenge", icon: "⚡", label: "动手解决" },
  { id: "growth", icon: "◇", label: "团队钱箱与工具" },
  { id: "personal", icon: "✦", label: "我的成长记录" },
  { id: "history", icon: "◫", label: "我们 vs 历史" },
  { id: "debrief", icon: "↗", label: "总结与发布" },
  { id: "dm", icon: "DM", label: "导师控制台", dmOnly: true },
];

const STAGE_LABELS = {
  find: "找真问题",
  decide: "定真方案",
  build: "做真产品",
  market: "进真市场",
  operate: "跑真运营",
  "find-problem": "旧版·找问题",
  "validate-problem": "旧版·识别问题",
  "design-solution": "旧版·想方案",
  "build-mvp": "旧版·MVP",
  "operate-brand": "旧版·市场运营",
} as const;
const RELATION_LABELS = { causes: "导致", supports: "支持", limits: "限制", contradicts: "矛盾", hypothesis: "假设" } as const;
const NODE_LABELS = { person: "人物", user: "用户", need: "需求/损失", event: "事件", technology: "技术", constraint: "约束", evidence: "证据" } as const;
const STUDENT_RELATION_LABELS = { causes: "会导致", supports: "能证明", limits: "会卡住", contradicts: "说法冲突", hypothesis: "我们猜的" } as const;
const STUDENT_NODE_LABELS = { person: "关键人物", user: "遇到麻烦的人", need: "他卡住的事", event: "发生的事", technology: "用到的办法/工具", constraint: "不能随便做的条件", evidence: "有来源的线索" } as const;
const RP_LABELS = { evidence: "证据", modeling: "建模", delivery: "交付", support: "支撑", iteration: "迭代", responsibility: "责任" } as const;
const API_BASE = publicPath("/api/classroom");

function phaseWorkspaceTab(phase: ClassroomPhase, role: ClassroomRoomDto["viewer"]["role"]): TabId {
  const meta = PHASE_META[phase];
  return role === "dm" ? (meta.dmTab ?? meta.tab) : meta.tab;
}

export default function ClassroomApp({ displayName, signOutPath, appSession = false, initialTeamPublicId = "" }: {
  displayName: string;
  signOutPath: string;
  appSession?: boolean;
  initialTeamPublicId?: string;
}) {
  const [dashboard, setDashboard] = useState<ClassroomDashboardDto | null>(null);
  const [room, setRoom] = useState<ClassroomRoomDto | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [focusTeamId, setFocusTeamId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("mission");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const roomVersion = useRef<number | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api<ClassroomDashboardDto>(`${API_BASE}/bootstrap`);
      setDashboard(data);
      setError(null);
      setLastSyncAt(new Date());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadRoom = useCallback(async (id: string, teamId: string | null, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = teamId ? `?team=${encodeURIComponent(teamId)}` : "";
      const data = await api<ClassroomRoomDto>(`${API_BASE}/rooms/${encodeURIComponent(id)}${query}`);
      const previousVersion = roomVersion.current;
      roomVersion.current = data.version;
      setRoom(data);
      setError(null);
      setOnline(true);
      setLastSyncAt(new Date());
      if (!silent || previousVersion !== data.version) setNotice(silent ? "已同步队友的最新进展" : null);
    } catch (cause) {
      setOnline(false);
      if (!silent) setError(messageOf(cause));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!roomId) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadRoom(roomId, focusTeamId, true);
    };
    const interval = window.setInterval(refresh, 3000);
    window.addEventListener("online", refresh);
    const offline = () => setOnline(false);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
    };
  }, [focusTeamId, loadRoom, roomId]);

  const openRoom = useCallback(async (id: string) => {
    setRoomId(id);
    setFocusTeamId(null);
    setTab("mission");
    await loadRoom(id, null);
  }, [loadRoom]);

  const leaveRoomView = useCallback(() => {
    setRoomId(null);
    setRoom(null);
    roomVersion.current = null;
    setTab("mission");
    void loadDashboard();
  }, [loadDashboard]);

  const navigateToTab = useCallback((nextTab: TabId) => {
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const workspace = document.getElementById("classroom-main");
      workspace?.focus({ preventScroll: true });
      workspace?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }, []);

  const runAction = useCallback<ActionRunner>(async (action, successMessage = "操作已保存，所有成员会自动同步") => {
    if (!roomId || working) return false;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await api(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      await loadRoom(roomId, focusTeamId, true);
      setNotice(successMessage);
      return true;
    } catch (cause) {
      setError(messageOf(cause));
      return false;
    } finally {
      setWorking(false);
    }
  }, [focusTeamId, loadRoom, roomId, working]);

  if (loading && !dashboard && !room) return <LoadingScreen />;

  if (!room || !roomId) {
    return (
      <Dashboard
        dashboard={dashboard}
        displayName={displayName}
        signOutPath={signOutPath}
        appSession={appSession}
        initialTeamPublicId={initialTeamPublicId}
        loading={loading}
        working={working}
        error={error}
        notice={notice}
        onCreate={async (title, campaignId) => {
          setWorking(true); setError(null);
          try {
            const created = await api<{ roomId: string; teamPublicId: string }>(`${API_BASE}/rooms`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, campaignId }),
            });
            await loadDashboard(true);
            await openRoom(created.roomId);
          } catch (cause) { setError(messageOf(cause)); } finally { setWorking(false); }
        }}
        onJoin={async (teamPublicId) => {
          setWorking(true); setError(null);
          try {
            const joined = await api<{ status: "pending"; alreadyPending: boolean; teamName: string; roomTitle: string }>(`${API_BASE}/join`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamPublicId }),
            });
            await loadDashboard(true);
            setNotice(joined.alreadyPending
              ? `你对“${joined.teamName}”的申请仍在等待DM审批。`
              : `已申请加入“${joined.roomTitle} / ${joined.teamName}”。DM审批后会自动出现在课堂列表。`);
          } catch (cause) { setError(messageOf(cause)); } finally { setWorking(false); }
        }}
        onOpen={openRoom}
      />
    );
  }

  const phaseMeta = PHASE_META[room.room.phase];
  const currentWorkTab = phaseWorkspaceTab(room.room.phase, room.viewer.role);
  const currentWorkLabel = TABS.find((item) => item.id === currentWorkTab)?.label ?? phaseMeta.label;
  const currentTeam = room.room.teams.find((team) => team.id === (room.viewer.teamId ?? room.room.focusTeamId)) ?? room.room.teams[0];
  const visibleTabs = TABS.filter((item) => !item.dmOnly || room.viewer.role === "dm");

  return (
    <div className={styles.classroomShell}>
      <a className={styles.skipLink} href="#classroom-main">跳到课堂内容</a>
      <header className={styles.roomTopbar}>
        <button className={styles.backButton} onClick={leaveRoomView} aria-label="返回课堂列表">←</button>
        <BrandHomeLink className={styles.roomBrand} title={room.room.title} subtitle={`${room.campaign.organization.toUpperCase()} WORLDLINE · ${room.chapter.timeRange}${room.campaign.courseRef ? ` · r${room.campaign.courseRef.revision} · ${room.campaign.courseRef.digest.slice(0, 12)}` : " · LEGACY"}`} />
        <div className={styles.roomTopActions}>
          {currentTeam && <button className={styles.codeChip} onClick={() => copyText(currentTeam.publicId, setNotice)} title="复制队伍ID"><small>{currentTeam.name} · 队伍ID</small><b>{currentTeam.publicId}</b></button>}
          <RoomTimer deadline={room.room.phaseDeadlineAt} paused={room.room.paused} />
          <span className={`${styles.syncBadge} ${online ? styles.synced : styles.offline}`} role="status">
            <i />{online ? `已同步 ${relativeTime(lastSyncAt)}` : "离线·保留当前画面"}
          </span>
          {appSession && <a href={publicPath("/account")} className={styles.iconLink} aria-label="账户中心">账户</a>}
          <SignOutControl path={signOutPath} appSession={appSession} className={styles.iconLink} />
        </div>
      </header>

      <div className={styles.phaseRail} aria-label="课堂阶段">
        <div className={styles.phaseProgress} style={{ width: `${(PHASES.indexOf(room.room.phase) / (PHASES.length - 1)) * 100}%` }} />
        {PHASES.map((phase, index) => (
          <button key={phase} className={phase === room.room.phase ? styles.phaseActive : index < PHASES.indexOf(room.room.phase) ? styles.phaseDone : ""} onClick={() => navigateToTab(phaseWorkspaceTab(phase, room.viewer.role))} title={PHASE_META[phase].label}>
            <span>{index + 1}</span><small>{PHASE_META[phase].short}</small>
          </button>
        ))}
      </div>

      {(error || notice) && (
        <div className={error ? styles.errorBanner : styles.noticeBanner} role={error ? "alert" : "status"}>
          <b>{error ? "这一步没有发生" : "已完成"}</b><span>{error ?? notice}</span>
          <button onClick={() => { setError(null); setNotice(null); }} aria-label="关闭提示">×</button>
        </div>
      )}

      <section className={styles.nowPanel} aria-labelledby="now-title">
        <div className={styles.nowIndex}>{String(PHASES.indexOf(room.room.phase) + 1).padStart(2, "0")}</div>
        <div><span className={styles.eyebrow}>NOW · 现在只做这一件事</span><h1 id="now-title">{phaseMeta.label}</h1></div>
        <div className={styles.nowInstruction}><b>{room.viewer.role === "dm" ? "DM动作" : "你的动作"}</b><p>{room.viewer.role === "dm" ? phaseMeta.dm : phaseMeta.learner}</p></div>
        <div className={styles.nowProof}><b>完成证据</b><p>{phaseMeta.proof}</p></div>
        <button className={styles.goButton} onClick={() => navigateToTab(currentWorkTab)}>进入{currentWorkLabel} →</button>
      </section>

      {room.viewer.role === "learner" && (
        <section className={styles.learnerActionCard} aria-labelledby="learner-action-title">
          <div>
            <span>YOUNG BUILDER · 先做，再由老师解释</span>
            <h2 id="learner-action-title">照着三步做</h2>
            <p>不用先记术语。完成具体动作后，老师会带大家说出背后的方法。</p>
          </div>
          <ol>{STUDENT_PHASE_STEPS[room.room.phase].map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
          <aside><b>做到这里就停</b><p>{phaseMeta.proof}</p><small>完成后等队友或老师推进，不用到其他页面猜下一步。</small></aside>
        </section>
      )}

      <div className={styles.roomLayout}>
        <aside className={styles.sideNav} aria-label="课堂工作区">
          <div className={styles.avatarBlock}><span>{initials(room.viewer.nickname)}</span><div><b>{room.viewer.nickname}</b><small>{room.viewer.role === "dm" ? "DM · 导师主持人" : `Young Builder · ${room.myIdentity?.name ?? "等待身份"}`}</small></div></div>
          <div className={styles.walletRow}><span><small>{room.viewer.role === "learner" ? "成长点" : "个人声望"}</small><b>{room.viewer.reputation} RP</b></span><span><small>{room.viewer.role === "learner" ? "我的C币" : "个人钱包"}</small><b>{money(room.viewer.walletTenths)}</b></span></div>
          <nav>
            {visibleTabs.map((item) => <button key={item.id} className={tab === item.id ? styles.navActive : ""} onClick={() => navigateToTab(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.id === currentWorkTab && <em>NOW</em>}</button>)}
          </nav>
          <div className={styles.timelineLegend}>{room.viewer.role === "learner" ? <><span><i className={styles.playerDot} />我们的选择</span><span><i className={styles.historyDot} />有来源的真实历史（后打开）</span></> : <><span><i className={styles.playerDot} />玩家世界线</span><span><i className={styles.historyDot} />真实历史（冻结后）</span></>}</div>
        </aside>

        <main className={styles.workspace} id="classroom-main" tabIndex={-1}>
          <Workspace
            tab={tab}
            room={room}
            working={working}
            onAction={runAction}
            onTab={navigateToTab}
            onFocusTeam={(teamId) => { setFocusTeamId(teamId); void loadRoom(roomId, teamId); }}
            onRefresh={() => loadRoom(roomId, focusTeamId)}
            onNotice={setNotice}
          />
        </main>
      </div>
      <div className={styles.liveRegion} aria-live="polite">{notice ?? error ?? ""}</div>
    </div>
  );
}

function Dashboard({ dashboard, displayName, signOutPath, appSession, initialTeamPublicId, loading, working, error, notice, onCreate, onJoin, onOpen }: {
  dashboard: ClassroomDashboardDto | null; displayName: string; signOutPath: string; appSession: boolean; loading: boolean; working: boolean;
  initialTeamPublicId: string;
  error: string | null; notice: string | null; onCreate: (title: string, campaignId: string) => Promise<void>; onJoin: (code: string) => Promise<void>; onOpen: (id: string) => Promise<void>;
}) {
  const defaultCampaign = dashboard?.campaigns[0];
  const [campaignId, setCampaignId] = useState(defaultCampaign?.id ?? "google-1995-2004");
  const [title, setTitle] = useState(defaultCampaign ? `${defaultCampaign.organization} · Young Builder战役` : "Young Builder战役");
  const [teamPublicId, setTeamPublicId] = useState(initialTeamPublicId);
  const nickname = dashboard?.profile.nickname ?? displayName;
  const canRequestTeamSeat = dashboard?.profile.canRequestTeamSeat ?? false;
  const canHostRoom = dashboard?.profile.canCreateRoom ?? false;
  const accountLabel = dashboard?.profile.platformRole === "admin"
    ? "系统管理员"
    : dashboard?.profile.platformRole === "mentor"
      ? "DM导师"
      : "Young Builder";
  return (
    <main className={styles.dashboardPage}>
      <nav className={styles.publicNav} aria-label="Mini Silicon Valley">
        <BrandHomeLink />
        <div><a href={publicPath("/")}>历史世界</a><a href="/framework/">课程框架</a>{appSession && <a href={publicPath("/account")}>账户中心</a>}<SignOutControl path={signOutPath} appSession={appSession} /></div>
      </nav>
      <header className={styles.dashboardHero}>
        <div><span className={styles.eyebrow}>YOUNG BUILDER CONTROL ROOM</span><h1>欢迎回来，{nickname}</h1><p>账号：@{dashboard?.profile.username ?? "—"} · {accountLabel}。{canRequestTeamSeat ? "输入公开队伍ID提交申请（学员席位）；DM审批后，课堂会自动出现在下方。" : canHostRoom ? "导师不加入P/D/M/O队伍；课堂创建者在“授课导师”区域指派你后，课堂会自动出现在下方。" : "观察员不申请学员席位，也不主持课堂。"}</p></div>
        <div className={styles.profileBadge}><span>{initials(nickname)}</span><div><small>{canRequestTeamSeat ? "成长点（完成作品后增加）" : "长期成长账户"}</small><b>{dashboard?.profile.reputation ?? 0} RP</b><em>{money(dashboard?.profile.walletTenths ?? 0)} {canRequestTeamSeat ? "我的C币" : "个人钱包"}</em></div></div>
      </header>
      {(error || notice) && <div className={error ? styles.errorBanner : styles.noticeBanner} role={error ? "alert" : "status"}><b>{error ? "没有完成" : "已完成"}</b><span>{error ?? notice}</span></div>}
      <section className={styles.launchGrid}>
        {dashboard?.profile.canCreateRoom ? (
          <form className={`${styles.launchCard} ${styles.dmLaunch}`} onSubmit={(event) => { event.preventDefault(); void onCreate(title, campaignId); }}>
            <span className={styles.cardNumber}>01 / DM</span><h2>创建一场新战役</h2><p>先选课件。Google 与饿了么都是五章连续战役，完整经历找真问题、定真方案、做真产品、进真市场、跑真运营与六分钟 Demo Day。两者都使用随机身份、随机手牌与双轨线。</p>
            <fieldset className={styles.campaignPicker}><legend>选择已发布课件</legend>{dashboard?.campaigns.map((campaign) => <label key={campaign.id} className={campaign.id === campaignId ? styles.campaignSelected : ""}><input aria-label={`选择课件：${campaign.title}`} type="radio" name="campaign" value={campaign.id} checked={campaign.id === campaignId} onChange={() => { setCampaignId(campaign.id); setTitle(`${campaign.organization} · Young Builder战役`); }} /><span><b>{campaign.title}</b><small>{campaign.period} · {campaign.chapterCount} 个完整步骤{campaign.courseRef ? ` · Released r${campaign.courseRef.revision} · ${campaign.courseRef.digest.slice(0, 12)}` : " · Legacy"}</small><em>{campaign.summary}</em></span></label>)}</fieldset>
            <label>课堂名称<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={60} required /></label>
            <button className={styles.primaryButton} disabled={working}>创建课堂与首支队伍 →</button>
          </form>
        ) : (
          <article className={`${styles.launchCard} ${styles.dmLaunch}`}>
            <span className={styles.cardNumber}>01 / YOUR IDENTITY</span><h2>你以Young Builder身份进入</h2><p>你的账号已可独立使用。创建课堂、发牌和裁决只属于导师；你通过队伍ID申请加入具体团队。</p>
            <a className={styles.secondaryLink} href={publicPath("/account")}>查看我的账号与安全设置 →</a>
          </article>
        )}
        {canRequestTeamSeat ? <form className={`${styles.launchCard} ${styles.learnerLaunch}`} onSubmit={(event) => { event.preventDefault(); void onJoin(teamPublicId); }}>
          <span className={styles.cardNumber}>02 / BUILDER</span><h2>申请加入具体队伍</h2><p>向DM索取类似 TEAM-ABCD2345 的队伍ID。提交后不会直接看到课堂私密信息，必须等DM审批。</p>
          {initialTeamPublicId && teamPublicId === initialTeamPublicId && <p className={styles.teamLinkHint} role="status"><b>✓ 入队链接已填入</b><span>{teamPublicId}</span>请与导师页面显示的ID核对一致，再提交申请。</p>}
          <label>队伍ID<input className={styles.codeInput} value={teamPublicId} onChange={(event) => setTeamPublicId(normalizeTeamPublicId(event.target.value))} placeholder="TEAM-ABCD2345" minLength={13} maxLength={13} autoComplete="off" required /></label>
          <button className={styles.darkButton} disabled={working || !TEAM_PUBLIC_ID_PATTERN.test(teamPublicId)}>提交入队申请 →</button>
        </form> : canHostRoom ? <article className={`${styles.launchCard} ${styles.learnerLaunch} ${styles.facilitatorLaunch}`}>
          <span className={styles.cardNumber}>02 / FACILITATOR</span><h2>受邀带领已有课堂</h2><p><b>导师不是队员，也不占4个学员席位。</b>请让课堂创建者进入“导师控制台 → 授课导师”，输入你的准确用户名 <code>@{dashboard?.profile.username}</code> 完成指派。</p><ol><li>创建者指派导师账号</li><li>课堂自动出现在“继续你的课堂”</li><li>以DM身份进入并主持全流程</li></ol>
        </article> : <article className={`${styles.launchCard} ${styles.learnerLaunch}`}><span className={styles.cardNumber}>02 / OBSERVER</span><h2>观察员不申请学员席位</h2><p>观察员账号目前不加入P／D／M／O队伍，也不获得DM主持权限；请联系系统管理员调整账号角色。</p></article>}
      </section>
      {dashboard?.joinRequests.length ? <section className={styles.requestStatusSection}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>APPLICATIONS</span><h2>入队申请</h2></div><span>{dashboard.joinRequests.filter((request) => request.status === "pending").length} 条待审批</span></div>
        <div className={styles.requestStatusGrid}>{dashboard.joinRequests.map((request) => <article key={request.id} data-status={request.status}><span>{request.status === "pending" ? "等待DM审批" : request.status === "approved" ? "已通过" : "未通过·可重新申请"}</span><h3>{request.roomTitle}</h3><p>{request.teamName} · {request.teamPublicId}</p><time>{new Date(request.updatedAt).toLocaleString("zh-CN")}</time></article>)}</div>
      </section> : null}
      <section className={styles.recentSection}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>RESUME</span><h2>继续你的课堂</h2></div><span>{dashboard?.rooms.length ?? 0} 个记录</span></div>
        {loading ? <p>正在读取持久档案…</p> : dashboard?.rooms.length ? (
          <div className={styles.roomCards}>{dashboard.rooms.map((item) => (
            <button key={item.id} className={styles.roomCard} onClick={() => void onOpen(item.id)}>
              <span className={item.role === "dm" ? styles.dmTag : styles.learnerTag}>{item.role === "dm" ? "DM" : "BUILDER"}</span>
              <h3>{item.title}</h3><p>{dashboard.campaigns.find((campaign) => campaign.id === item.campaignId)?.chapters.find((chapter) => chapter.id === item.chapterId)?.title ?? item.chapterId}{item.courseRef ? ` · r${item.courseRef.revision} · ${item.courseRef.digest.slice(0, 12)}` : " · 历史兼容课堂"}</p>
              <div><b>{item.teamPublicId ?? (item.role === "dm" ? "DM控制台" : "已加入")}</b><span>{PHASE_META[item.phase].label}</span><time>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</time></div>
            </button>
          ))}</div>
        ) : <div className={styles.emptyState}><span>◇</span><h3>还没有可进入的课堂</h3><p>{canRequestTeamSeat ? "输入队伍ID提交申请；DM审批后，你的课堂会出现在这里。" : canHostRoom ? "你可以创建新课堂；若要带领管理员创建的课堂，请让创建者在课堂内把你的导师用户名指派为授课导师。" : "观察员目前没有可访问课堂；请联系系统管理员确认账号角色。"}</p></div>}
      </section>
    </main>
  );
}

function SignOutControl({ path, appSession, className }: { path: string; appSession: boolean; className?: string }) {
  const [signingOut, setSigningOut] = useState(false);
  if (!appSession) return <a href={path} className={className}>退出</a>;
  return (
    <button
      type="button"
      className={className}
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        try {
          await fetch(publicPath("/api/auth/logout"), { method: "POST", headers: { Accept: "application/json" } });
        } finally {
          window.location.replace(`${publicPath("/auth/login")}?signedOut=1`);
        }
      }}
    >
      {signingOut ? "退出中…" : "退出"}
    </button>
  );
}

function Workspace(props: { tab: TabId; room: ClassroomRoomDto; working: boolean; onAction: ActionRunner; onTab: (tab: TabId) => void; onFocusTeam: (teamId: string) => void; onRefresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const { tab } = props;
  if (tab === "identity") return <IdentityPanel {...props} />;
  if (tab === "intel") return <IntelPanel {...props} />;
  if (tab === "team") return <TeamPanel {...props} />;
  if (tab === "challenge") return <ChallengePanel {...props} />;
  if (tab === "growth") return <GrowthPanel {...props} />;
  if (tab === "personal") return <PersonalPanel {...props} />;
  if (tab === "history") return <HistoryPanel {...props} />;
  if (tab === "debrief") return <DebriefPanel {...props} />;
  if (tab === "dm") return <DmPanel {...props} />;
  return <MissionPanel {...props} />;
}
function MissionPanel({ room, onTab }: { room: ClassroomRoomDto; onTab: (tab: TabId) => void }) {
  const teamMembers = room.members.filter((member) => member.teamId && (room.viewer.role === "dm" || member.teamId === room.viewer.teamId));
  const targetTab = phaseWorkspaceTab(room.room.phase, room.viewer.role);
  const targetLabel = TABS.find((item) => item.id === targetTab)?.label ?? PHASE_META[room.room.phase].label;
  return (
    <div className={styles.panelStack}>
      <PanelHeader eyebrow={`MISSION ${String(room.chapter.order).padStart(2, "0")} · ${room.chapter.timeRange}`} title={room.chapter.title} description={room.chapter.briefing} />
      <div className={styles.chapterTrack} style={{ gridTemplateColumns: `repeat(${room.campaign.chapterCount}, minmax(150px, 1fr))` }} aria-label={`${room.campaign.title}任务章节`}>
        {room.campaign.chapters.map((chapter) => <div key={chapter.id} className={chapter.order === room.chapter.order ? styles.chapterCurrent : chapter.order < room.chapter.order ? styles.chapterDone : ""}><span>M{String(chapter.order).padStart(2, "0")}</span><b>{STAGE_LABELS[chapter.stage]}</b><small>{chapter.order < room.chapter.order ? "已完成" : chapter.order === room.chapter.order ? "进行中" : "待解锁"}</small></div>)}
      </div>
      {room.viewer.role === "learner" && room.chapter.studentGuide && <section className={styles.chapterActionGuide}>
        <div><span>先进入这个具体场景</span><h2>{room.chapter.studentGuide.scene}</h2></div>
        <ol>{room.chapter.studentGuide.steps.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol>
        <p><b>这一章做到这里就完成：</b>{room.chapter.studentGuide.doneWhen}</p>
      </section>}
      <div className={styles.twoColumns}>
        <article className={styles.paperCard}>
          <span className={styles.cardKicker}>{room.viewer.role === "learner" ? "这次要练会的事" : "本章学习目标"}</span><h2>{room.chapter.learningGoal}</h2>
          <h3>{room.viewer.role === "learner" ? "我们现在能用的信息范围" : "历史情境边界"}</h3><ul>{room.chapter.historicalBoundary.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className={styles.locationLine}><span>⌖ {room.chapter.location}</span><span>◷ {room.chapter.timeRange}</span></div>
        </article>
        <article className={styles.darkCard}>
          <span className={styles.cardKicker}>{room.viewer.role === "learner" ? "回到自己的项目，马上做一次" : "REALITY MISSION · 带回现实"}</span><h2>{room.chapter.realityMission.title}</h2><p>{room.chapter.realityMission.deliverable}</p>
          <ul>{room.chapter.realityMission.acceptance.map((item) => <li key={item}>{item}</li>)}</ul>
          <b className={styles.timebox}>{room.viewer.role === "learner" ? `建议在 ${room.chapter.realityMission.timeboxMinutes} 分钟内完成` : `${room.chapter.realityMission.timeboxMinutes} MIN TIMEBOX`}</b>
        </article>
      </div>
      <section>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CREW</span><h2>{room.viewer.role === "learner" ? "本队四个人" : "本队角色网络"}</h2></div><span>{teamMembers.filter((member) => member.role === "learner").length} / 4 Builders</span></div>
        <div className={styles.memberGrid}>{teamMembers.map((member) => <MemberCard key={member.id} member={member} room={room} />)}</div>
      </section>
      <button className={styles.nextWorkButton} onClick={() => onTab(targetTab)}>去{targetLabel}完成当前阶段：{PHASE_META[room.room.phase].label} →</button>
    </div>
  );
}

function IdentityPanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const readCount = room.myCards.filter((card) => card.state !== "unread").length;
  const publishedCount = room.myCards.filter((card) => card.state === "published").length;
  return (
    <div className={styles.panelStack}>
      <PanelHeader
        eyebrow={room.viewer.role === "learner" ? "我的角色和三张线索" : "ROLEPLAY IDENTITY · 毛线式信息获取"}
        title={room.viewer.role === "learner" ? "先看角色，再打开随机抽到的线索" : "身份与私密手牌"}
        description={room.viewer.role === "learner" ? "角色告诉你从哪里开始看；三张线索从全班本章牌池随机抽取，不属于某个固定角色。先读懂，再用自己的话讲给队友。" : "案例身份与信息手牌分别随机。手牌不按身份绑定；请观察学员如何交换不同视角，再在具体经历后命名抽象方法。"}
      />
      {room.viewer.role === "learner" ? (
        <>
          {room.myIdentity ? <article className={styles.identityHero}>
            <div className={styles.identitySeal}>{room.myIdentity.name.slice(0, 1)}</div>
            <div><span>{room.myIdentity.nature === "composite" ? "课堂合成角色 · 不代表一位真实人物" : "历史情境角色"}</span><h2>{room.myIdentity.name}</h2><p><b>你要完成：</b>{room.myIdentity.publicGoal}</p></div>
            <aside><b>只有你能看：你担心什么</b><p>{room.myIdentity.privateConcern}</p><b>本章可用一次的帮忙</b><p>{room.myIdentity.ability}</p></aside>
          </article> : <WaitingCard title="角色和线索还没发下来" body="等队伍4人到齐后，老师会点击“随机分配身份与发牌”。角色和手牌分别随机；页面会自动出现，不用反复刷新。" />}
          <ProgressChecklist items={[{ done: readCount === 3, label: `打开并读完自己的3张卡（${readCount}/3）` }, { done: publishedCount > 0, label: `当面讲完后至少发布1张（${publishedCount}张已发布）` }, { done: room.intelligence.publishedCards.length >= 4, label: `听完队友讲出的线索（团队已发布${room.intelligence.publishedCards.length}张）` }]} />
          <EvidenceBoundaryLegend />
          <div className={styles.cardGrid}>{room.myCards.map((card, index) => (
            <article key={card.id} className={`${styles.infoCard} ${styles[`credibility_${card.credibility}`]}`}>
              <div className={styles.infoCardTop}><span>随机线索 {index + 1}/3</span><b>{card.state === "unread" ? "还没打开" : card.state === "read" ? "读完·还没讲" : "已讲给团队"}</b></div>
              {card.state === "unread" ? <div className={styles.sealedCard}><span>只给你看</span><h3>先自己打开，不要让队友直接抄屏幕</h3><p>你要先读懂，再用自己的话讲；队友获得的是你的讲解，不是偷看卡片。</p><button className={styles.primaryButton} disabled={working} onClick={() => void onAction({ type: "set-card-state", cardId: card.id, state: "read" }, "线索已打开；先圈出确定的事和还不确定的事")}>打开这张线索</button></div> : <>
                <span className={styles.kindTag}>{evidenceBoundaryLabel(card)} · {studentKind(card.kind)} · {studentCredibility(card.credibility)}</span><h3>{learnerCardTitle(card.title)}</h3><p>{card.body}</p>
                <blockquote>告诉队友：{card.sharePrompt}</blockquote>
                <div className={styles.sourceRow}><span>{studentBoundaryExplanation(card)}</span></div>
                {card.state === "read" ? <button className={styles.primaryButton} disabled={working} onClick={() => void onAction({ type: "set-card-state", cardId: card.id, state: "published" }, "卡片已进入团队共享池；请继续用自己的话向队友讲解")}>我已当面讲解，发布到团队</button> : <span className={styles.completedStamp}>✓ 团队可引用</span>}
              </>}
            </article>
          ))}</div>
        </>
      ) : room.chapter.dm ? (
        <article className={styles.dmBriefCard}><span className={styles.cardKicker}>DM全知视角 · 不得投屏私密内容</span><h2>发牌与讲解观察</h2><p>{room.chapter.dm.opening}</p><div className={styles.identityList}>{room.dmSecrets?.identities.map((identity) => <div key={identity.id}><b>{identity.name}</b><span>{identity.publicGoal}</span><small>顾虑：{identity.privateConcern}</small></div>)}</div></article>
      ) : null}
      <section>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SHARED AFTER TALKING</span><h2>团队已经讲出的信息</h2></div><span>{room.intelligence.publishedCards.length} / {room.chapter.infoCardCount}</span></div>
        {room.intelligence.publishedCards.length ? <div className={styles.sharedIntelList}>{room.intelligence.publishedCards.map((card) => <article key={`${card.id}:${card.publishedByMemberId}`}><span>{card.publishedByNickname} · {evidenceBoundaryLabel(card)} · {room.viewer.role === "learner" ? studentCredibility(card.credibility) : `${credibility(card.credibility)}可信度`}</span><h3>{learnerCardTitle(card.title)}</h3><p>{card.body}</p></article>)}</div> : <div className={styles.emptyState}><span>⋯</span><h3>队友还没讲出第一张线索</h3><p>每个人先自己打开一张卡，用30秒讲给队友；讲完的人再点击“发布到团队”。</p></div>}
      </section>
    </div>
  );
}

function IntelPanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const [kind, setKind] = useState<keyof typeof NODE_LABELS>("evidence");
  const [title, setTitle] = useState("");
  const [explanation, setExplanation] = useState("");
  const [sourceCardIds, setSourceCardIds] = useState<string[]>([]);
  const [fromNodeId, setFromNodeId] = useState("");
  const [toNodeId, setToNodeId] = useState("");
  const [relation, setRelation] = useState<keyof typeof RELATION_LABELS>("supports");
  const [relationWhy, setRelationWhy] = useState("");
  const [problemUser, setProblemUser] = useState("");
  const [sceneLoss, setSceneLoss] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [unknown, setUnknown] = useState("");
  const [decisionQuestion, setDecisionQuestion] = useState("");
  const activeTeamId = room.viewer.teamId ?? room.room.focusTeamId ?? room.room.teams[0]?.id ?? "";
  const problemStatement = room.worldline.find((entry) => entry.kind === "problem-statement" && entry.teamId === activeTeamId);
  const evidenceNodes = room.intelligence.nodes.filter((node) => node.sourceCardIds.length > 0).length;
  const hasPerson = room.intelligence.nodes.some((node) => node.kind === "person" || node.kind === "user");
  const hasConstraint = room.intelligence.nodes.some((node) => node.kind === "constraint");
  const hasTension = room.intelligence.edges.some((edge) => edge.kind === "contradicts" || edge.kind === "limits");
  return (
    <div className={styles.panelStack}>
      <PanelHeader
        eyebrow={room.viewer.role === "learner" ? "团队线索墙 · 贴便签、说因为" : "INTELLIGENCE NETWORK · 毛线式探索"}
        title={room.viewer.role === "learner" ? "把四个人听到的线索贴在一起" : "把信息变成可以推理的网络"}
        description={room.viewer.role === "learner" ? "一张便签只写一件事：谁、发生了什么或遇到什么困难。连接两张便签时要说完整一句“因为A，所以B”或“A限制了B”。" : "卡片是原料，关系才是认知。导师检查来源、因果、限制和矛盾，但让学员先用具体便签与完整句子操作。"}
      />
      {room.viewer.role === "learner" && <EvidenceBoundaryLegend />}
      <ProgressChecklist items={room.viewer.role === "learner"
        ? [{ done: evidenceNodes >= 2, label: `2张能指出来源卡的便签（${evidenceNodes}/2）` }, { done: hasPerson, label: "一个正在做事的具体人" }, { done: hasConstraint, label: "一个“我们不能随便做”的条件" }, { done: hasTension, label: "一条“这会卡住”或“两种说法冲突”的线" }, { done: room.intelligence.edges.length >= 1, label: "至少用一句完整的“因为…所以…”连起两张便签" }]
        : [{ done: evidenceNodes >= 2, label: `至少2个来源节点（${evidenceNodes}/2）` }, { done: hasPerson, label: "一个具体用户或人物" }, { done: hasConstraint, label: "一项明确约束" }, { done: hasTension, label: "一条限制或矛盾关系" }, { done: room.intelligence.edges.length >= 1, label: "节点不是孤岛，至少建立1条关系" }]} />
      <div className={styles.intelCanvas} aria-label="团队情报网">
        {room.intelligence.nodes.length ? <>
          <div className={styles.nodeGrid}>{room.intelligence.nodes.map((node) => <article key={node.id} className={styles.intelNode}><span>{room.viewer.role === "learner" ? STUDENT_NODE_LABELS[node.kind as keyof typeof STUDENT_NODE_LABELS] ?? node.kind : NODE_LABELS[node.kind as keyof typeof NODE_LABELS] ?? node.kind}</span><h3>{node.title}</h3><p>{node.explanation}</p><small>{node.sourceCardIds.length ? `${EVIDENCE_BOUNDARY_LABELS.F} · 来源卡 ${node.sourceCardIds.length} 张` : room.viewer.role === "learner" ? `${EVIDENCE_BOUNDARY_LABELS.G} · 还要找线索` : "团队假设·待验证"}</small></article>)}</div>
          <div className={styles.edgeList}>{room.intelligence.edges.map((edge) => <div key={edge.id}><b>{nodeTitle(room, edge.fromNodeId)}</b><span>{room.viewer.role === "learner" ? STUDENT_RELATION_LABELS[edge.kind] : RELATION_LABELS[edge.kind]} →</span><b>{nodeTitle(room, edge.toNodeId)}</b><p>{edge.explanation}</p></div>)}</div>
        </> : <div className={styles.emptyState}><span>⌘</span><h3>{room.viewer.role === "learner" ? "先贴下第一张便签" : "先放下第一枚节点"}</h3><p>{room.viewer.role === "learner" ? "可以先写一个正在做事的人，或一条能指出卡片来源的线索。队友只能看见你主动贴出来的内容。" : "选择“用户/人物”或“证据”，写清你从已发布信息中理解到了什么。"}</p></div>}
      </div>
      {room.viewer.role === "learner" && <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onAction({ type: "create-intelligence-node", kind, title, explanation, sourceCardIds }, "新便签已贴到团队线索墙");
          if (ok) { setTitle(""); setExplanation(""); setSourceCardIds([]); }
        }}>
          <span className={styles.cardKicker}>贴一张新便签</span>
          <label>这张便签写什么<select value={kind} onChange={(event) => setKind(event.target.value as keyof typeof NODE_LABELS)}>{Object.entries(STUDENT_NODE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>用一句短话命名<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={80} placeholder="例如：研究者来回翻页仍找不到论文" required /></label>
          <label>具体发生了什么<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} minLength={4} maxLength={500} placeholder="谁，在什么地方，做了什么，结果怎样？" required /></label>
          <fieldset><legend>这句话来自哪张已讲出的线索？（可以多选；没有就会标成“团队猜测”）</legend>{room.intelligence.publishedCards.map((card) => <label className={styles.checkLine} key={card.id}><input type="checkbox" checked={sourceCardIds.includes(card.id)} onChange={() => setSourceCardIds((ids) => ids.includes(card.id) ? ids.filter((id) => id !== card.id) : [...ids, card.id])} />{card.title}</label>)}</fieldset>
          <button className={styles.primaryButton} disabled={working}>贴到团队线索墙</button>
        </form>
        <form className={styles.formCard} onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onAction({ type: "create-intelligence-edge", fromNodeId, toNodeId, kind: relation, explanation: relationWhy }, "两张便签已用一句完整理由连起来");
          if (ok) setRelationWhy("");
        }}>
          <span className={styles.cardKicker}>给两张便签连线</span>
          <label>先选这张<select value={fromNodeId} onChange={(event) => setFromNodeId(event.target.value)} required><option value="">选择第一张便签</option>{room.intelligence.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
          <label>中间说<select value={relation} onChange={(event) => setRelation(event.target.value as keyof typeof RELATION_LABELS)}>{Object.entries(STUDENT_RELATION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>再选这张<select value={toNodeId} onChange={(event) => setToNodeId(event.target.value)} required><option value="">选择第二张便签</option>{room.intelligence.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
          <label>把“因为”说完整<textarea value={relationWhy} onChange={(event) => setRelationWhy(event.target.value)} minLength={4} maxLength={500} placeholder="例如：因为服务器空间小，所以一次只能测试少量页面" required /></label>
          <button className={styles.darkButton} disabled={working || room.intelligence.nodes.length < 2}>画出这条解释线</button>
        </form>
      </div>}
      <section className={styles.cognitionGate}>
        <div><span className={styles.cardKicker}>{room.viewer.role === "learner" ? "用五句话说清问题" : "DM COGNITION GATE · 从信息到认知"}</span><h2>{room.viewer.role === "learner" ? "按顺序填完，别一次写成大段理论" : "团队现在认为什么是真问题？"}</h2><p>{room.viewer.role === "learner" ? "1谁遇到问题 → 2哪里卡住 → 3哪张线索能证明 → 4还缺什么 → 5下一步试什么。" : "导师在学员完成五句具体陈述后，再命名用户、损失、证据、不确定性与可验证决策。"}</p></div>
        {problemStatement ? <article><span>✓ TEAM STATEMENT</span><h3>{String(problemStatement.content.user ?? "目标用户")}</h3><p><b>{room.viewer.role === "learner" ? "他在哪里卡住：" : "场景损失："}</b>{String(problemStatement.content.sceneLoss ?? "")}</p><p><b>{room.viewer.role === "learner" ? "哪些线索支持：" : "证据："}</b>{String(problemStatement.content.evidenceSummary ?? "")}</p><p><b>仍不知道：</b>{String(problemStatement.content.unknown ?? "")}</p><blockquote>{String(problemStatement.content.decisionQuestion ?? "")}</blockquote></article> : room.viewer.role === "learner" && room.room.phase === "dm-gate" ? <form onSubmit={(event) => { event.preventDefault(); void onAction({ type: "submit-problem-statement", user: problemUser, sceneLoss, evidenceSummary, unknown, decisionQuestion }, "5句话已保存；请面对老师用自己的话再说一遍"); }}>
          <label>1. 谁正在做这件事<input value={problemUser} onChange={(event) => setProblemUser(event.target.value)} minLength={2} maxLength={300} required /></label>
          <label>2. 他在哪里、哪一步卡住，造成什么麻烦<textarea value={sceneLoss} onChange={(event) => setSceneLoss(event.target.value)} minLength={4} maxLength={600} required /></label>
          <label>3. 哪两张线索或哪次观察支持这句话<textarea value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} minLength={4} maxLength={1000} required /></label>
          <label>4. 我们还不知道什么<textarea value={unknown} onChange={(event) => setUnknown(event.target.value)} minLength={4} maxLength={600} required /></label>
          <label>5. 下一步要做哪个小测试<textarea value={decisionQuestion} onChange={(event) => setDecisionQuestion(event.target.value)} minLength={4} maxLength={600} required /></label>
          <button className={styles.primaryButton} disabled={working}>保存这5句话</button>
        </form> : <WaitingCard title={room.viewer.role === "dm" ? "认知门尚未留下团队陈述" : "还没到填5句话的时候"} body={room.viewer.role === "dm" ? "请先让聚焦团队用一句话讲清用户、场景损失、证据、未知与下一决策问题；系统收到作品后才允许推进。" : "先在上方贴便签、连出一条“因为…所以…”。老师把课堂推进到“用5句话说清问题”后，表单会在这里出现。"} />}
      </section>
    </div>
  );
}
function TeamPanel({ room }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const teamMembers = room.members.filter((member) => member.role === "learner" && (room.viewer.role === "dm" || member.teamId === room.viewer.teamId));
  return (
    <div className={styles.panelStack}>
      <PanelHeader
        eyebrow={room.viewer.role === "learner" ? "YOUNG BUILDERS · 一起完成五步" : "TEAM PLAN · 学员只分具体动作"}
        title="把下一次行动分清楚"
        description={room.viewer.role === "learner" ? "你不是某一个字母角色。每个人都要找证据、提办法、动手做、找用户和看运营结果；这一轮只分清谁先做哪件具体事。" : "不要给学员分 P／D／M／O。请让团队说清负责人、支援者、完成时间和可检查结果；四类专业线属于导师席。"}
      />
      <section>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TEAM</span><h2>四个人面对同一个问题</h2></div><span>每人完整参与五步</span></div>
        <div className={styles.memberGrid}>{teamMembers.map((member) => <MemberCard key={member.id} member={member} room={room} />)}</div>
      </section>
      <section className={styles.cardControl} aria-labelledby="team-plan-checklist">
        <div id="team-plan-checklist"><span className={styles.cardKicker}>这一轮只要说清四件事</span><h2>谁先做、谁帮忙、何时交、看什么结果</h2></div>
        <ol><li>指定一个现在就能开始的小动作。</li><li>说出一名负责人和至少一名支援者。</li><li>约定完成时间和要留下的作品。</li><li>写清看到什么结果就继续，看到什么就换办法。</li></ol>
      </section>
      {room.viewer.role === "dm" && <aside className={styles.cardControl}>
        <span className={styles.cardKicker}>四类导师支援 · 不是学员角色</span>
        <p><b>P 产品导师</b>守住用户、问题与价值；<b>D 开发导师</b>守住实现、验证与迭代；<b>M 市场导师</b>守住触达、表达与交换；<b>O 运营导师</b>守住交付、账本、质量与节奏。每一步只有一位主导师，其他导师按需支援。</p>
      </aside>}
    </div>
  );
}

function ChallengePanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const teamId = room.viewer.teamId ?? room.room.focusTeamId ?? room.challenge?.teamId ?? room.room.teams[0]?.id ?? "";
  const [goal, setGoal] = useState("");
  const [method, setMethod] = useState("");
  const [evidence, setEvidence] = useState("");
  const [resource, setResource] = useState("");
  const [successSignal, setSuccessSignal] = useState("");
  const [stopCondition, setStopCondition] = useState("");
  const [rubric, setRubric] = useState({ evidence: 0 as 0 | 1, logic: 0 as 0 | 1, execution: 0 as 0 | 1, collaboration: 0 as 0 | 1 });
  const [consequence, setConsequence] = useState("");
  const selected = room.chapter.challenges.find((challenge) => challenge.id === room.challenge?.challengeId) ?? null;
  const pressure = room.chapter.pressureEvents.find((event) => event.die === room.challenge?.pressureDie) ?? null;
  const myAction = room.challenge?.actions.find((action) => Number(action.round) === room.challenge?.round && action.member_id === room.viewer.memberId);
  return (
    <div className={styles.panelStack}>
      <PanelHeader
        eyebrow={room.viewer.role === "learner" ? "接任务 → 做一次 → 看反馈 → 改一次" : "TRPG CHALLENGE · 情境攻坚"}
        title={room.viewer.role === "learner" ? "先写清怎么做，再开始动手" : "骰子制造压力，证据决定行动"}
        description={room.viewer.role === "learner" ? "骰子只会加一个突发情况，不会给你打能力分。先和队友一起想，再各自补上一项具体贡献；第一次没成功也不会出局。" : "用压力事件建立情境，用公开量规结算证据、逻辑、执行与协作；专业判断由本步主导师负责，学员保持全队身份。"}
      />
        <div className={styles.challengeLevels}>{room.chapter.challenges.map((challenge) => <article key={challenge.id} className={selected?.id === challenge.id ? styles.challengeSelected : ""}><span>L{challenge.level}</span><div><h3>{challenge.title}</h3><p>{challenge.prompt}</p><small>{room.viewer.role === "learner" ? "最后要拿出：" : "交付："}{challenge.requiredArtifact}</small></div><aside><b>{money(challenge.baseIncomeTenths)}</b><small>{room.viewer.role === "learner" ? "完成后团队钱箱可增加" : "基础项目收入"}</small><em>{room.viewer.role === "learner" ? "全队商量谁先带头" : `导师建议：${challenge.recommendedLead ?? "本步主导师"}主导`}</em></aside>{room.viewer.role === "dm" && !room.challenge && <button disabled={working || !teamId} onClick={() => void onAction({ type: "select-challenge", teamId, challengeId: challenge.id }, `已锁定L${challenge.level}挑战`)}>选择此难度</button>}</article>)}</div>
      {room.challenge ? <>
        <section className={styles.challengeStatus}>
          <div><span className={styles.cardKicker}>ACTIVE CHALLENGE · ROUND {room.challenge.round}</span><h2>{selected?.title}</h2><p>{selected?.requiredArtifact}</p></div>
          <div className={styles.dieBox}><span>{room.challenge.pressureDie ?? "?"}</span><b>{pressure?.title ?? "等待老师投出突发情况"}</b><small>{pressure?.effect ?? "骰子只决定这次遇到什么麻烦，不评价你的能力"}</small></div>
          {room.viewer.role === "dm" && room.challenge.pressureDie == null && <button className={styles.primaryButton} disabled={working} onClick={() => void onAction({ type: "roll-pressure", teamId }, "压力事件已公开，团队进入情境")}>投掷压力骰</button>}
        </section>
        {pressure && <article className={styles.pressureCard}><span>{room.viewer.role === "learner" ? "突发情况" : "压力事件"} · 骰面 {pressure.die}</span><h3>{pressure.title}</h3><p>{pressure.effect}</p><b>{room.viewer.role === "learner" ? "现在可以先做：" : "可以如何应对："}{pressure.mitigation}</b></article>}
        {room.economy.assets.some((asset) => asset.active) && <section className={styles.activeTools}><b>本轮由团队资产解锁的行动</b>{room.economy.assets.filter((asset) => asset.active).map((asset) => <span key={asset.id}><strong>{asset.name}</strong>{asset.ability}</span>)}</section>}
        {room.viewer.role === "learner" && !room.challenge.resolution && (
          myAction ? <WaitingCard title={`第${room.challenge.round}版做法已交出`} body="不要重复点击。等队友完成后，老师会按证据、说理、动手和协作4项公开规则给出结果；页面会自动同步。" /> :
          <form className={styles.actionCanvas} onSubmit={async (event) => {
            event.preventDefault();
            const ok = await onAction({ type: "submit-challenge-action", goal, method, evidence, resource, successSignal, stopCondition }, `第${room.challenge?.round ?? 1}轮行动已提交`);
            if (ok) { setGoal(""); setMethod(""); setEvidence(""); setResource(""); setSuccessSignal(""); setStopCondition(""); }
          }}>
            <div><span className={styles.cardKicker}>YOUNG BUILDER · 本轮具体贡献</span><h2>给团队方案补上一项具体贡献</h2></div>
            <label>1. 这轮要做出什么<input value={goal} onChange={(event) => setGoal(event.target.value)} minLength={4} maxLength={300} placeholder="例如：做出3条能让同学比较的搜索结果" required /></label>
            <label>2. 第一步怎么做<textarea value={method} onChange={(event) => setMethod(event.target.value)} minLength={4} maxLength={500} placeholder="写具体动作，不写‘努力研究’" required /></label>
            <label>3. 哪张线索支持这样做<input value={evidence} onChange={(event) => setEvidence(event.target.value)} minLength={2} maxLength={500} placeholder="写线索标题或线索墙便签" required /></label>
            <label>4. 要用什么人、时间或工具<input value={resource} onChange={(event) => setResource(event.target.value)} minLength={1} maxLength={240} placeholder="例如：D同学＋10分钟＋纸卡" required /></label>
            <label>5. 看到什么就算有效<input value={successSignal} onChange={(event) => setSuccessSignal(event.target.value)} minLength={2} maxLength={300} placeholder="例如：2名同学都能在1分钟内选出可用结果" required /></label>
            <label>6. 出现什么就停下来换办法<input value={stopCondition} onChange={(event) => setStopCondition(event.target.value)} minLength={2} maxLength={300} placeholder="例如：连续2人看不懂排序理由" required /></label>
            <button className={styles.primaryButton} disabled={working}>交出第{room.challenge.round}版做法</button>
          </form>
        )}
        <section><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TEAM ACTIONS</span><h2>公开行动板</h2></div><span>{room.challenge.actions.length}条行动</span></div><div className={styles.actionList}>{room.challenge.actions.map((action, index) => <article key={`${action.member_id}:${action.round}:${index}`}><span>ROUND {action.round} · 团队贡献</span><h3>{room.members.find((member) => member.id === action.member_id)?.nickname ?? "队员"}</h3><p><b>目标</b>{String(action.goal)}</p><p><b>方法</b>{String(action.method)}</p><p><b>证据</b>{String(action.evidence)}</p><small>成功：{String(action.success_signal)} · 停止：{String(action.stop_condition)}</small></article>)}</div></section>
        {room.viewer.role === "dm" && room.room.phase === "challenge-two" && !room.challenge.resolution && <form className={styles.rubricCard} onSubmit={(event) => { event.preventDefault(); void onAction({ type: "score-challenge", teamId, rubric, consequence, idempotencyKey: requestKey("score") }, "公开量规已结算，收入与后果写入档案"); }}>
          <div><span className={styles.cardKicker}>PUBLIC RUBRIC · 0/1</span><h2>公开结算，不凭导师印象</h2></div>
          <div className={styles.rubricGrid}>{(Object.keys(rubric) as Array<keyof typeof rubric>).map((key) => <label key={key}><input type="checkbox" checked={rubric[key] === 1} onChange={(event) => setRubric((value) => ({ ...value, [key]: event.target.checked ? 1 : 0 }))} /><span>{({ evidence: "证据", logic: "逻辑", execution: "执行", collaboration: "协作" } as const)[key]}</span><b>{rubric[key]}</b></label>)}</div>
          <label>世界线后果（2分以下必填）<textarea value={consequence} onChange={(event) => setConsequence(event.target.value)} maxLength={500} placeholder="团队因此承担了什么、学到了什么？" /></label>
          <button className={styles.primaryButton} disabled={working}>按四项量规公开结算</button>
        </form>}
        {room.challenge.resolution && <article className={styles.resultCard}><span>RESOLVED · 公开结果</span><h2>{outcomeLabel(String(room.challenge.resolution.outcome))}</h2><b>{String(room.challenge.resolution.score)} / 4 · {room.viewer.role === "learner" ? "团队钱箱增加" : "项目收入"} {money(Number(room.challenge.resolution.incomeTenths))}</b><p>{room.challenge.consequence || (room.viewer.role === "learner" ? "这次没有额外的后续麻烦" : "没有额外世界线后果")}</p></article>}
      </> : <WaitingCard title="老师还没有发下本轮任务" body={room.viewer.role === "dm" ? "先确认毛线讨论已经形成问题判断和团队行动计划，再从 L1/L2/L3 选择适配团队状态的挑战。" : "先回到“团队线索墙”和“团队协作”完成讨论。任务发下后，这里只显示你们真正要做的那一张。"} />}
    </div>
  );
}
function GrowthPanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const [distribution, setDistribution] = useState<0 | 20 | 40>(20);
  const [financingAmount, setFinancingAmount] = useState("5");
  const [financingReason, setFinancingReason] = useState("");
  const [paperFlow, setPaperFlow] = useState<"inflow" | "outflow">("inflow");
  const [paperCategory, setPaperCategory] = useState<"user-validation" | "asset-revenue" | "research" | "product" | "market" | "operations" | "maintenance">("user-validation");
  const [paperAmount, setPaperAmount] = useState("1");
  const [paperReason, setPaperReason] = useState("");
  const owned = new Set(room.economy.assets.map((asset) => asset.id));
  return (
    <div className={styles.panelStack}>
      <PanelHeader
        eyebrow={room.viewer.role === "learner" ? "团队钱箱和工具柜" : "EURO ENGINE · 资源决策"}
        title={room.viewer.role === "learner" ? "先看钱从哪里来、花到哪里，再一起选工具" : "分数不是钱，钱也买不到学习"}
        description={room.viewer.role === "learner" ? "RP只记录你做过的学习贡献，不能拿去花；C是项目的钱。团队C由大家表决，个人C由你自己决定，两种都不能买答案。" : "导师端负责收入、成本、利润、维护、分配与冲正的完整解释；学员端只呈现可检查的收支、投票与贡献动作。"}
      />
      <div className={styles.metricGrid}>
        <Metric label={room.viewer.role === "learner" ? "团队钱箱" : "团队金库"} value={money(room.economy.teamTreasuryTenths)} note="团队共同决策" tone="coral" />
        <Metric label={room.viewer.role === "learner" ? "这次任务赚到" : "本章项目收入"} value={money(room.economy.chapterRevenueTenths)} note={room.viewer.role === "learner" ? "完成任务进入团队钱箱" : "不含融资"} tone="teal" />
        <Metric label={room.viewer.role === "learner" ? "这次已经花掉" : "本章直接成本"} value={money(room.economy.chapterCostTenths)} note={room.viewer.role === "learner" ? "做调查、作品、找人和维护的花费" : "研究/产品/市场/运营/维护"} tone="mustard" />
        <Metric label="已分给个人" value={money(room.economy.chapterDistributedTenths)} note={room.viewer.role === "dm" ? "50/30/20公式" : "老师按公开贡献记录计算"} tone="violet" />
      </div>
      {room.viewer.role === "dm" && <form className={styles.distributionBar} onSubmit={(event) => { event.preventDefault(); const teamId = room.room.focusTeamId ?? room.challenge?.teamId ?? room.room.teams[0]?.id; if (teamId) void onAction({ type: "distribute-profit", teamId, percent: distribution, idempotencyKey: requestKey("distribution") }, `已按${distribution}%分配比例结算个人收益`); }}>
        <div><span className={styles.cardKicker}>PROFIT DISTRIBUTION</span><h2>保留还是分配，由公开规则决定</h2><p>先扣成本与维护，再留2 C储备；分配池按50%平等劳动＋30%角色交付＋20%有理由的协作贡献拆分。</p></div>
        <label>本章可分配比例<select value={distribution} onChange={(event) => setDistribution(Number(event.target.value) as 0 | 20 | 40)}><option value={0}>0% 全部留存</option><option value={20}>20% 稳健分配</option><option value={40}>40% 积极分配</option></select></label>
        <button className={styles.primaryButton} disabled={working}>执行一次性分配</button>
      </form>}
      {room.viewer.role === "dm" && <form className={styles.financingBar} onSubmit={(event) => { event.preventDefault(); const teamId = room.room.focusTeamId ?? room.challenge?.teamId ?? room.room.teams[0]?.id; if (teamId) void onAction({ type: "record-financing", teamId, amountTenths: Math.round(Number(financingAmount) * 10), reason: financingReason, idempotencyKey: requestKey("financing") }, "条件融资已进入团队金库；不会计入可分配利润"); }}>
        <div><span className={styles.cardKicker}>CONDITIONAL FINANCING · 非收入</span><h2>记录带条件的外部资源</h2><p>必须把方向、增长、控制权或品牌承诺写进理由；融资不会被当作项目利润分给个人。</p></div>
        <label>金额（C）<input type="number" min="0.1" max="10000" step="0.1" value={financingAmount} onChange={(event) => setFinancingAmount(event.target.value)} required /></label>
        <label>附带条件<textarea value={financingReason} onChange={(event) => setFinancingReason(event.target.value)} minLength={8} maxLength={500} placeholder="例如：获得5 C服务器额度，但必须在下一章提交稳定性报告" required /></label>
        <button className={styles.darkButton} disabled={working}>记录融资</button>
      </form>}
      {room.viewer.role === "dm" && <details className={styles.paperRecovery}>
        <summary>断网恢复 · 补录DM签字的实体账本</summary>
        <form onSubmit={(event) => {
          event.preventDefault();
          const teamId = room.room.focusTeamId ?? room.challenge?.teamId ?? room.room.teams[0]?.id;
          if (teamId) void onAction({ type: "record-paper-ledger", teamId, flow: paperFlow, category: paperCategory, amountTenths: Math.round(Number(paperAmount) * 10), reason: paperReason, idempotencyKey: requestKey("paper") }, "实体账本记录已原子补录；纸单号与原因保留在审计中");
        }}>
          <div><span className={styles.cardKicker}>PAPER RECOVERY · 只补录已发生事项</span><h2>恢复后不让学员重复操作</h2><p>对照DM签字纸单逐笔补录。融资使用上方专用入口；错账使用账本“冲正”，不要覆盖原记录。</p></div>
          <label>方向<select value={paperFlow} onChange={(event) => {
            const flow = event.target.value as "inflow" | "outflow";
            setPaperFlow(flow);
            setPaperCategory(flow === "inflow" ? "user-validation" : "research");
          }}><option value="inflow">团队收入</option><option value="outflow">团队支出</option></select></label>
          <label>类别<select value={paperCategory} onChange={(event) => setPaperCategory(event.target.value as typeof paperCategory)}>{paperFlow === "inflow" ? <><option value="user-validation">用户验证收入</option><option value="asset-revenue">资产持续收入</option></> : <><option value="research">调研成本</option><option value="product">产品成本</option><option value="market">市场成本</option><option value="operations">运营成本</option><option value="maintenance">维护成本</option></>}</select></label>
          <label>金额（C）<input type="number" min="0.1" max="10000" step="0.1" value={paperAmount} onChange={(event) => setPaperAmount(event.target.value)} required /></label>
          <label>纸单号＋原因<textarea value={paperReason} onChange={(event) => setPaperReason(event.target.value)} minLength={8} maxLength={500} placeholder="例如：纸单 P-03，断网期间完成3名用户验证" required /></label>
          <button className={styles.darkButton} disabled={working}>带原因补录</button>
        </form>
      </details>}
      <section><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TEAM ASSETS</span><h2>购买能改变后续行动的工具</h2></div><span>{room.economy.assets.length}项已拥有</span></div>
        <div className={styles.assetGrid}>{room.catalog.assets.map((asset) => {
          const current = room.economy.assets.find((candidate) => candidate.id === asset.id);
          const proposal = room.economy.proposals.find((candidate) => candidate.assetId === asset.id && candidate.status === "pending");
          return <article key={asset.id} className={`${styles.assetCard} ${current ? styles.assetOwned : ""}`}><div><span>{asset.type.toUpperCase()}</span><b>{asset.priceTenths / 10} C</b></div><h3>{asset.name}</h3><p>{asset.ability}</p><small>维护 {asset.maintenanceTenths / 10} C/章 · 门槛 {asset.prerequisiteRp} RP</small><em>{asset.risk}</em>
            {current ? <strong className={current.active ? styles.activeAsset : styles.inactiveAsset}>{current.active ? "✓ 已装备" : "暂停·维护不足"}</strong> : proposal ? <div className={styles.voteBlock}><b>表决中 {proposal.approvals}赞成 / {proposal.rejections}反对</b>{room.viewer.role === "learner" && <span><button disabled={working} onClick={() => void onAction({ type: "vote-purchase", proposalId: proposal.id, approve: true, idempotencyKey: requestKey("vote") }, "赞成票已记录")}>赞成</button><button disabled={working} onClick={() => void onAction({ type: "vote-purchase", proposalId: proposal.id, approve: false, idempotencyKey: requestKey("vote") }, "反对票已记录")}>反对</button></span>}</div> : room.viewer.role === "learner" && <button disabled={working || owned.has(asset.id) || room.viewer.reputation < asset.prerequisiteRp || room.room.phase !== "growth"} onClick={() => void onAction({ type: "propose-purchase", assetId: asset.id, idempotencyKey: requestKey("proposal") }, "购买提案已创建；超过半数赞成才会原子扣款")}>{room.viewer.reputation < asset.prerequisiteRp ? `需要${asset.prerequisiteRp} RP` : "发起团队购买表决"}</button>}
          </article>;
        })}</div>
      </section>
      <section><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TEAM MONEY</span><h2>团队收支清单</h2></div><span>{room.viewer.role === "dm" ? "金额单位 C · 错账只能留痕冲正" : "每一笔钱为什么进、为什么出，都能在这里找到"}</span></div>{room.economy.ledger.length ? <div className={styles.ledgerList}>{room.economy.ledger.map((entry) => <div key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time><span>{entry.fromLabel} → {entry.toLabel}</span><b>{money(entry.amountTenths)}</b><small>{entry.reason}</small>{room.viewer.role === "dm" && entry.category !== "correction" && <button disabled={working} onClick={() => { const reason = window.prompt("请输入至少8个字的冲正原因。原交易和冲正都会永久保留："); if (reason && reason.trim().length >= 8) void onAction({ type: "reverse-transaction", transactionId: entry.id, reason, idempotencyKey: requestKey("reversal") }, "冲正已完成；原交易仍保留在账本中"); }}>冲正</button>}</div>)}</div> : <div className={styles.emptyState}><span>0 C</span><h3>这一步还没有收支</h3><p>完成任务赚到的钱、买工具花掉的钱都会自动出现在这里。</p></div>}</section>
    </div>
  );
}

function PersonalPanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const [gratitudeMember, setGratitudeMember] = useState("");
  const [gratitudeReason, setGratitudeReason] = useState("");
  const [reinvestAmount, setReinvestAmount] = useState("1");
  const teamMembers = room.members.filter((member) => member.role === "learner" && member.teamId === room.viewer.teamId && member.id !== room.viewer.memberId);
  return (
    <div className={styles.panelStack}>
      <PanelHeader eyebrow="我的成长记录" title={`${room.viewer.nickname}做出了哪些真实贡献`} description={room.viewer.role === "learner" ? "老师只有指向一份具体作品，才能给你记RP。RP不能花钱；个人钱包C来自团队公开分配，可以买行动工具，也可以自愿放回团队钱箱。" : "学员只看具体贡献、已解锁行动和个人选择；导师端保留声望证据、钱包权属与经济边界解释。"} />
      <div className={styles.personalHero}><div><small>成长记录</small><b>{room.viewer.reputation}<em> RP</em></b><p>做过的作品越扎实，能用的行动越多</p></div><div><small>我的钱包</small><b>{money(room.viewer.walletTenths)}</b><p>由你自己决定怎样使用</p></div><div><small>已得到的新行动</small><b>{room.viewer.unlockIds.length}<em> / {room.catalog.reputationUnlocks.length}</em></b><p>达到条件后自动打开</p></div></div>
      <section><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>达到条件，得到新行动</span><h2>这不是装饰徽章，下次课堂真的能用</h2></div></div><div className={styles.unlockTrack}>{room.catalog.reputationUnlocks.map((unlock) => { const copy = room.viewer.role === "learner" ? studentUnlockCopy(unlock.id, unlock.name, unlock.ability) : unlock; return <article key={unlock.id} className={room.viewer.reputation >= unlock.threshold ? styles.unlocked : ""}><span>{unlock.threshold} RP</span><h3>{copy.name}</h3><p>{copy.ability}</p><b>{room.viewer.reputation >= unlock.threshold ? "✓ 已得到，不会扣掉RP" : `还差${unlock.threshold - room.viewer.reputation} RP`}</b></article>; })}</div></section>
      <section><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>作品，不是签到</span><h2>老师根据哪件作品记下了成长</h2></div><span>本章最多12 RP</span></div>{room.reputationEvidence.length ? <div className={styles.evidenceLedger}>{room.reputationEvidence.filter((entry) => room.viewer.role === "dm" || entry.memberId === room.viewer.memberId).map((entry) => <article key={entry.id}><span>+{entry.points} RP · {RP_LABELS[entry.dimension as keyof typeof RP_LABELS] ?? entry.dimension}</span><h3>{entry.reason}</h3><small>对应作品：{entry.evidenceObjectId}</small></article>)}</div> : <WaitingCard title="还没有作品被记录" body="完成一次线索讲解、交出一版做法、根据反馈改一次或完成总结后，老师会指出具体作品再记录RP。" />}</section>
      {room.viewer.role === "learner" && <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); void onAction({ type: "gratitude-vote", toMemberId: gratitudeMember, reason: gratitudeReason }, "已记录这次帮助；老师结算时会看到这条具体记录"); }}><span className={styles.cardKicker}>GRATITUDE WITH EVIDENCE</span><h2>感谢一个真实贡献</h2><label>队友<select value={gratitudeMember} onChange={(event) => setGratitudeMember(event.target.value)} required><option value="">选择队友</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.nickname}</option>)}</select></label><label>他/她具体帮了什么<textarea value={gratitudeReason} onChange={(event) => setGratitudeReason(event.target.value)} minLength={4} maxLength={240} placeholder="他/她做了什么，怎样改变了团队结果？" required /></label><button className={styles.darkButton} disabled={working || !teamMembers.length}>保存这次感谢</button></form>
        <form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); if (room.viewer.teamId) void onAction({ type: "reinvest", teamId: room.viewer.teamId, amountTenths: Math.round(Number(reinvestAmount) * 10), idempotencyKey: requestKey("reinvest") }, "这笔钱已从你的钱包放回团队钱箱"); }}><span className={styles.cardKicker}>自愿放回团队钱箱</span><h2>这是你自己的决定，不会换来成长分或更多发言权</h2><label>放回多少（C）<input type="number" value={reinvestAmount} onChange={(event) => setReinvestAmount(event.target.value)} min="0.1" max={room.viewer.walletTenths / 10} step="0.1" required /></label><p>钱不够时这次不会扣款；队友不能要求你转账。</p><button className={styles.primaryButton} disabled={working || room.viewer.walletTenths < Math.round(Number(reinvestAmount) * 10)}>自愿放回团队钱箱</button></form>
      </div>}
      <section><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>个人行动工具</span><h2>能买多一次行动，不能买答案或成绩</h2></div></div><div className={styles.shopGrid}>{room.catalog.personalItems.map((item) => <article key={item.id}><span>{money(item.priceTenths)}</span><h3>{item.name}</h3><p>{room.viewer.role === "learner" ? studentPersonalItemDescription(item.id, item.description) : item.description}</p><small>需要先有 {item.prerequisiteRp} RP</small>{room.viewer.role === "learner" && <button disabled={working || room.room.phase !== "growth" || room.viewer.reputation < item.prerequisiteRp || room.viewer.walletTenths < item.priceTenths} onClick={() => void onAction({ type: "personal-purchase", itemId: item.id, idempotencyKey: requestKey("personal") }, `${item.name}已进入个人档案`)}>购买这个行动工具</button>}</article>)}</div></section>
    </div>
  );
}

function HistoryPanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const teamId = room.viewer.teamId ?? room.room.focusTeamId ?? room.challenge?.teamId ?? room.room.teams[0]?.id ?? "";
  const frozen = room.worldline.find((entry) => entry.kind === "team-decision" && entry.teamId === teamId && entry.frozenAt);
  return (
    <div className={styles.panelStack}>
      <PanelHeader
        eyebrow={room.viewer.role === "learner" ? "先写我们的选择，再翻开历史" : "DOUBLE TRACK · 双轨线"}
        title={room.viewer.role === "learner" ? "不用猜中历史，只要说清当时为什么这样选" : "先冻结我们的判断，再打开真实历史"}
        description={room.viewer.role === "learner" ? `你们可以走出一条和${room.campaign.organization}不同的路。重要的是先用手里的线索做选择，再看历史上发生了什么，找出一处相同和一处不同。` : "导师用双轨线区分当时可知的玩家判断与来源可追溯的史实；在具体对照后再提炼可迁移原则。"}
      />
      <div className={styles.worldlineSplit}>
        <section className={styles.playerWorldline}><span>{room.viewer.role === "learner" ? "我们在当时的选择" : "PLAYER TIMELINE · 可创造"}</span><h2>我们的团队决定</h2>{frozen ? <><blockquote>{String(frozen.content.decision ?? "已锁定")}</blockquote><p>{String(frozen.content.rationale ?? "")}</p><b>✓ {new Date(frozen.frozenAt!).toLocaleString("zh-CN")} {room.viewer.role === "learner" ? "已锁定，打开历史后也不会被改掉" : "已冻结，不可覆盖"}</b></> : <><p>{room.viewer.role === "learner" ? "老师打开历史之前，先写下“我们会怎么做”和“哪些线索让我们这样选”。确认后不能偷偷改答案。" : "在史实揭晓前，团队必须公开写下“我们会怎么做”和“为什么”。冻结后不能编辑。"}</p>{room.viewer.role === "learner" && <form onSubmit={(event) => { event.preventDefault(); void onAction({ type: "freeze-worldline", teamId, decision, rationale }, "团队选择已锁定；等所有队完成后，老师会打开有来源的真实历史"); }}><label>我们会怎么做<textarea value={decision} onChange={(event) => setDecision(event.target.value)} minLength={8} maxLength={2000} required /></label><label>哪些线索让我们这样选<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} minLength={8} maxLength={2000} required /></label><button className={styles.primaryButton} disabled={working || !["growth", "history"].includes(room.room.phase)}>四人确认，锁定我们的选择</button></form>}</>}</section>
        <section className={`${styles.historyWorldline} ${room.chapter.historyReveal ? styles.historyOpen : ""}`}><span>{room.viewer.role === "learner" ? "有来源的真实历史 · 只能打开，不能改" : "ORIGINAL TIMELINE · 只读史实"}</span>{room.chapter.historyReveal ? <><h2>历史上发生了什么</h2><p>{room.chapter.historyReveal.happened}</p><h3>对照，而不是判分</h3><ul>{room.chapter.historyReveal.comparisonPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul><div className={styles.sourceLinks}>{room.chapter.historyReveal.sourceIds.map((id) => { const source = room.catalog.sources.find((candidate) => candidate.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer"><b>{source.organization}</b>{source.title} ↗</a> : <span key={id}>{id}</span>; })}</div></> : <div className={styles.lockedHistory}><b>LOCKED</b><h2>{room.viewer.role === "learner" ? "历史还没打开" : "史实尚未揭晓"}</h2><p>{room.viewer.role === "learner" ? "先和队友写下“我们会怎么做”和手里的线索，四人确认并锁定。各队都完成后，老师会在导师控制台打开历史；这里没有隐藏倒计时。" : "明确动作：各团队先冻结玩家决定；DM在“导师控制台”点击揭晓。不是继续阅读，也不是等待隐藏倒计时。"}</p></div>}</section>
      </div>
      {room.viewer.role === "dm" && !room.chapter.historyReveal && <button className={styles.primaryButton} disabled={working || room.room.phase !== "history"} onClick={() => void onAction({ type: "reveal-history" }, "真实历史已揭晓；玩家世界线保持冻结")}>所有团队已冻结，揭晓真实历史</button>}
    </div>
  );
}
const STUDENT_REFLECTION_QUESTIONS = [
  "我们拿到哪些确定的线索？哪些还只是猜测？",
  "哪张线索或哪次测试让你改变了想法？",
  "你这轮具体做了什么？哪位队友怎样帮了你？",
  "第二次做法比第一次改了哪一个地方？",
  "我们的选择和真实历史哪里一样、哪里不一样？",
  "未来两天，你要把哪一种做法用到自己的项目？",
];

const DM_REFLECTION_QUESTIONS = [
  "事实、观察、观点、推断和传闻的边界在哪里？",
  "哪项证据真正改变了团队判断？",
  "P／D／M／O如何主导与支撑，协作断点在哪里？",
  "第一轮到第二轮的可观察迭代是什么？",
  "玩家世界线与史实差异由哪些信息和约束造成？",
  "哪项认知可以迁移到现实项目，如何验证？",
];

function DebriefPanel({ room, working, onAction }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner }) {
  const existing = room.worldline.find((entry) => entry.kind === "reflection" && entry.memberId === room.viewer.memberId);
  const [answers, setAnswers] = useState<string[]>(Array(6).fill(""));
  const [realityAction, setRealityAction] = useState("");
  const [demoTitle, setDemoTitle] = useState("");
  const [demoNotes, setDemoNotes] = useState<string[]>(Array(7).fill(""));
  const isFinalChapter = room.chapter.order === room.campaign.chapterCount;
  const showDemo = isFinalChapter || room.room.phase === "completed";
  const activeTeamId = room.viewer.teamId ?? room.room.focusTeamId ?? room.room.teams[0]?.id ?? "";
  const demoSubmission = room.worldline.find((entry) => entry.kind === "demo-day" && entry.teamId === activeTeamId);
  const reflectionQuestions = room.viewer.role === "learner" ? STUDENT_REFLECTION_QUESTIONS : DM_REFLECTION_QUESTIONS;
  return (
    <div className={styles.panelStack}>
      <PanelHeader eyebrow={room.viewer.role === "learner" ? "说清发生了什么，再决定下一步" : "DEBRIEF → REALITY · 反馈闭环"} title={room.viewer.role === "learner" ? "用6个短问题整理这次经历" : "把历史认知带回真实行动"} description={room.viewer.role === "learner" ? "不要写“我学到了很多”。写出哪张线索、哪次行动、改了什么；最后决定未来2天由你完成的一件小事。" : "导师在具体回答后命名证据边界、角色协作、迭代与现实迁移；每项结论都指向作品。"} />
      {room.viewer.role === "learner" && (existing ? <article className={styles.submittedReflection}><span>✓ SAVED</span><h2>你的6个回答和下一步已保存</h2><p>{String(existing.content.realityAction ?? "未来2天的小任务已保存")}</p><small>可以继续听队友说；进入下一章后这份记录不会消失。</small></article> : <form className={styles.reflectionForm} onSubmit={(event) => { event.preventDefault(); void onAction({ type: "submit-reflection", answers, realityAction }, "6个回答和未来2天的小任务已保存"); }}>
        {reflectionQuestions.map((question, index) => <label key={question}><span>{String(index + 1).padStart(2, "0")}</span><b>{question}</b><textarea value={answers[index]} onChange={(event) => setAnswers((values) => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} minLength={1} maxLength={1000} required /></label>)}
        <label className={styles.realityAction}><span>↗</span><b>未来2天，我要完成这件小事</b><p>写清什么时候完成、交出什么、找谁检查；负责人就是你。</p><textarea value={realityAction} onChange={(event) => setRealityAction(event.target.value)} minLength={8} maxLength={1000} placeholder="例如：周三18:00前访谈2名同学，交一张问题记录表，请一名队友检查" required /></label>
        <button className={styles.primaryButton} disabled={working || !room.chapter.historyReveal}>提交并写入成长档案</button>
      </form>)}
      {room.viewer.role === "dm" && room.chapter.dm && <article className={styles.dmBriefCard}><span className={styles.cardKicker}>DM DEBRIEF PROMPTS</span><h2>不要问“学到了什么”就结束</h2><ul>{room.chapter.dm.debrief.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul><p>完成情况：{room.worldline.filter((entry) => entry.kind === "reflection").length} / {room.members.filter((member) => member.role === "learner").length} 人已提交。</p></article>}
      {showDemo && <section className={styles.demoDay}><div className={styles.demoHeader}><span>06:00</span><div><b>DEMO DAY · 最终结局，不是考试</b><h2>{room.viewer.role === "learner" ? "按问题—线索—做法—结果—下一步，讲清团队真的做过什么" : `六分钟把${room.campaign.chapterCount === 1 ? "本次调查" : `${room.campaign.chapterCount}次学习闭环`}讲成一条可信世界线`}</h2></div></div><div className={styles.demoSegments}>{room.catalog.demoDay.segments.map((segment) => <article key={segment.id}><span>{clock(segment.startSecond)}—{clock(segment.endSecond)}</span><h3>{segment.title}</h3><p>{segment.requirement}</p></article>)}</div><div className={styles.demoRubric}><b>{room.viewer.role === "learner" ? "现场能看见这些就完成" : "公开观察"}</b>{room.catalog.demoDay.rubric.map((item) => <span key={item}>✓ {item}</span>)}</div>
        {demoSubmission ? <article className={styles.demoSubmission}><span>✓ TEAM DEMO ARCHIVED</span><h3>{String(demoSubmission.content.title ?? "团队Demo Day")}</h3>{Array.isArray(demoSubmission.content.segmentNotes) && demoSubmission.content.segmentNotes.map((note, index) => <p key={`${index}:${String(note)}`}><b>{room.catalog.demoDay.segments[index]?.title}</b>{String(note)}</p>)}</article> : room.viewer.role === "learner" && room.room.phase === "debrief" ? <form className={styles.demoForm} onSubmit={(event) => { event.preventDefault(); void onAction({ type: "submit-demo-day", title: demoTitle, segmentNotes: demoNotes }, "七段式Demo Day作品已进入团队战役档案"); }}><div><span className={styles.cardKicker}>TEAM PITCH RECORD</span><h3>先排练，再提交团队共同版本</h3><p>系统保存内容证据；DM使用共享6分钟计时器主持现场发布。</p></div><label>发布标题<input value={demoTitle} onChange={(event) => setDemoTitle(event.target.value)} minLength={2} maxLength={120} required /></label>{room.catalog.demoDay.segments.map((segment, index) => <label key={segment.id}><span>{clock(segment.startSecond)}—{clock(segment.endSecond)} · {segment.title}</span><textarea value={demoNotes[index]} onChange={(event) => setDemoNotes((values) => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} minLength={1} maxLength={1000} placeholder={segment.requirement} required /></label>)}<button className={styles.primaryButton} disabled={working}>提交团队六分钟发布作品</button></form> : <WaitingCard title="Demo Day作品尚未提交" body={room.viewer.role === "dm" ? "请让聚焦团队在最终复盘阶段填写七段式内容，并用DM共享计时器完成现场六分钟发布。" : "完成当前战役最后一章的史实对照与六问复盘后，团队将在这里提交七段式发布作品。"} />}
      </section>}
    </div>
  );
}

function MembershipAdminPanel({ room, working, onAction, onNotice }: {
  room: ClassroomRoomDto;
  working: boolean;
  onAction: ActionRunner;
  onNotice: (message: string) => void;
}) {
  const [newTeamName, setNewTeamName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClassroomLearnerSearchResult[]>([]);
  const [targetTeamId, setTargetTeamId] = useState(room.room.focusTeamId ?? room.room.teams[0]?.id ?? "");
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [issuedReset, setIssuedReset] = useState<IssuedPasswordResetLink | null>(null);
  const [facilitatorUsername, setFacilitatorUsername] = useState("");
  const pending = room.dmSecrets?.joinRequests.filter((request) => request.status === "pending") ?? [];
  const formationOpen = room.room.phase === "lobby";
  const facilitators = room.members.filter((candidate) => candidate.role === "dm");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalBusy(true); setLocalMessage(null); setResults([]);
    try {
      const data = await api<ClassroomLearnerSearchResult[]>(`${API_BASE}/rooms/${encodeURIComponent(room.room.id)}/learners?q=${encodeURIComponent(query.trim())}`);
      setResults(data);
      if (!data.length) setLocalMessage("这里仅查找学员账号，没有匹配结果。导师账号请在上方“授课导师”区域按准确用户名指派。");
    } catch (cause) {
      setLocalMessage(messageOf(cause));
    } finally {
      setLocalBusy(false);
    }
  }

  async function issueReset(username: string) {
    setLocalBusy(true); setLocalMessage(null); setIssuedReset(null);
    try {
      const data = await api<IssuedPasswordResetLink>(publicPath("/api/auth/admin/reset-links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      setIssuedReset(data);
    } catch (cause) {
      setLocalMessage(messageOf(cause));
    } finally {
      setLocalBusy(false);
    }
  }

  async function copyTeamValue(value: string, label: string) {
    const copied = await copyText(value, onNotice);
    setLocalMessage(copied
      ? `${label}已复制：${value}`
      : `自动复制没有成功，请手动复制：${value}`);
  }

  function shareTeam(teamPublicId: string) {
    const url = new URL(publicPath("/classroom"), window.location.origin);
    url.searchParams.set("team", teamPublicId);
    void copyTeamValue(url.toString(), "入队链接");
  }

  return (
    <section className={styles.membershipAdmin} aria-labelledby="membership-admin-title">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TEAM ACCESS · 明确审批</span><h2 id="membership-admin-title">队伍与成员</h2></div><span>{pending.length} 条待审批</span></div>
      <p className={styles.sectionLead}>队伍ID是公开定位符，不是登录密码。学员提交后只形成申请；只有你批准或直接添加，成员才获得课堂访问权。</p>
      {issuedReset && <div className={styles.resetLinkBox} role="status"><span>一次性密码重置链接 · 仅展示一次</span><strong>{issuedReset.resetUrl}</strong><p>{issuedReset.displayName} · @{issuedReset.username} · {new Date(issuedReset.expiresAt).toLocaleString("zh-CN")}失效</p><div><button onClick={() => copyText(issuedReset.resetUrl, onNotice)}>复制链接</button><button onClick={() => setIssuedReset(null)}>我已发送</button></div></div>}
      {localMessage && <div className={styles.inlineMessage} role="status">{localMessage}</div>}
      <section className={styles.facilitatorAdmin} aria-labelledby="facilitator-admin-title">
        <header><div><span className={styles.eyebrow}>COURSE FACILITATORS · 不占队伍席位</span><h3 id="facilitator-admin-title">授课导师</h3></div><b>{facilitators.length} 位DM</b></header>
        <p>课堂创建者是最终负责人；被指派导师获得同一课堂的 DM 主持权限。导师不会加入 Alpha Team，也不会占用 4 个 Young Builder 学员席位。</p>
        <ul>{facilitators.map((candidate) => <li key={candidate.id}><div><b>{candidate.nickname}</b><span>@{candidate.username ?? "未绑定用户名"}</span></div><em>{candidate.isRoomOwner ? "课堂创建者" : "授课导师 · DM"}</em>{room.viewer.canManageFacilitators && !candidate.isRoomOwner && candidate.id !== room.viewer.memberId ? <button disabled={working || localBusy} onClick={() => { if (window.confirm(`确定取消 ${candidate.nickname} 的本课堂主持权限？`)) void onAction({ type: "remove-facilitator", memberId: candidate.id }, `${candidate.nickname}已不再主持这场课堂`); }}>取消指派</button> : null}</li>)}</ul>
        {room.viewer.canManageFacilitators ? <form onSubmit={(event) => { event.preventDefault(); void onAction({ type: "assign-facilitator", username: facilitatorUsername }, `@${facilitatorUsername} 已成为本课堂授课导师`).then((saved) => { if (saved) setFacilitatorUsername(""); }); }}><label>导师用户名<input value={facilitatorUsername} onChange={(event) => setFacilitatorUsername(event.target.value.trim().toLowerCase().slice(0, 32))} pattern="[a-z][a-z0-9_-]{2,31}" placeholder="例如 msv-mentor-01" autoComplete="off" required /></label><button className={styles.primaryButton} disabled={working || localBusy || !/^[a-z][a-z0-9_-]{2,31}$/.test(facilitatorUsername)}>指派为授课导师 →</button></form> : <small>只有课堂创建者或系统管理员可以增删授课导师；你已拥有本课堂DM主持权限。</small>}
      </section>
      <div className={styles.teamAccessGrid}>{room.room.teams.map((team) => {
        const members = room.members.filter((candidate) => candidate.role === "learner" && candidate.teamId === team.id);
        return <article key={team.id} className={styles.teamAccessCard}>
          <header>
            <div><span>{team.memberCount}/{team.seatLimit} BUILDERS</span><h3>{team.name}</h3></div>
            <div className={styles.teamCopyActions}>
              <button type="button" onClick={() => void copyTeamValue(team.publicId, "队伍ID")}>复制队伍ID</button>
              <button type="button" className={styles.shareTeamButton} onClick={() => shareTeam(team.publicId)}>复制入队链接</button>
            </div>
          </header>
          <code>{team.publicId}</code>
          <p className={styles.teamShareHelp}>推荐把“入队链接”发给学员：登录后系统会自动填入准确队伍ID，避免复制错或粘贴旧内容。</p>
          <ul>{members.map((candidate) => <li key={candidate.id}><div><b>{candidate.nickname}</b><small>@{candidate.username ?? "未绑定用户名"} · 席位{candidate.seat}</small></div><div><button disabled={working || localBusy || !candidate.username} onClick={() => candidate.username && void issueReset(candidate.username)}>重置密码</button><button disabled={working || localBusy} onClick={() => { if (window.confirm(`确定将 ${candidate.nickname} 移出这场课堂？其历史审计仍会保留。`)) void onAction({ type: "remove-member", memberId: candidate.id }, `${candidate.nickname}已移出课堂并失去访问权`); }}>移出</button></div></li>)}</ul>
          {!members.length && <p>尚无学员。发送入队链接让学员申请，或在下方直接添加。</p>}
        </article>;
      })}</div>
      <div className={styles.membershipTools}>
        <section>
          <h3>待审批申请</h3>
          {pending.length ? <ul className={styles.joinRequestList}>{pending.map((request) => <li key={request.id}><div><b>{request.displayName}</b><span>@{request.username} → {request.teamName}</span><small>{request.teamPublicId}</small></div><div><button disabled={working || localBusy || !formationOpen} onClick={() => void onAction({ type: "decide-join-request", requestId: request.id, decision: "reject" }, `已拒绝 ${request.displayName} 的申请`)}>拒绝</button><button className={styles.primaryButton} disabled={working || localBusy || !formationOpen || (room.room.teams.find((team) => team.id === request.teamId)?.memberCount ?? 0) >= (room.room.teams.find((team) => team.id === request.teamId)?.seatLimit ?? 0)} onClick={() => void onAction({ type: "decide-join-request", requestId: request.id, decision: "approve" }, `${request.displayName}已加入${request.teamName}`)}>批准加入</button></div></li>)}</ul> : <div className={styles.emptyState}><span>✓</span><h3>没有待审批申请</h3><p>学员提交队伍ID后会自动出现在这里。</p></div>}
        </section>
        <section>
          <h3>按学员ID或昵称直接添加</h3><p className={styles.toolScopeNote}>这里只管理Young Builder学员席位；导师请使用上方独立的“授课导师”流程。</p>
          <form className={styles.memberSearchForm} onSubmit={search}><label>查找学员<input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))} minLength={2} maxLength={80} placeholder="用户名或显示名称，至少2个字符" required /></label><label>加入队伍<select value={targetTeamId} onChange={(event) => setTargetTeamId(event.target.value)}>{room.room.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.memberCount}/{team.seatLimit}</option>)}</select></label><button disabled={working || localBusy || query.trim().length < 2}>{localBusy ? "查找中…" : "查找"}</button></form>
          {results.length > 0 && <ul className={styles.searchResultList}>{results.map((result) => <li key={result.profileId}><div><b>{result.displayName}</b><span>@{result.username}</span></div>{result.membershipStatus === "active" ? <em>已在本课堂</em> : <button disabled={working || localBusy || !formationOpen || !targetTeamId} onClick={() => void onAction({ type: "add-learner", teamId: targetTeamId, profileId: result.profileId }, `${result.displayName}已加入队伍`).then((saved) => { if (saved) setResults([]); })}>直接添加</button>}</li>)}</ul>}
        </section>
      </div>
      <form className={styles.createTeamForm} onSubmit={(event) => { event.preventDefault(); void onAction({ type: "create-team", name: newTeamName }, `新队伍“${newTeamName}”已创建`).then((saved) => { if (saved) setNewTeamName(""); }); }}><label>需要另一支队伍？<input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value.slice(0, 40))} minLength={2} maxLength={40} placeholder="例如 Beta Team" required /></label><button disabled={working || !formationOpen || newTeamName.trim().length < 2}>创建队伍与独立队伍ID</button></form>
      {!formationOpen && <p className={styles.lockNotice}>课堂已经开始：新队伍、审批和直接添加已锁定；移出成员与密码协助仍可使用。</p>}
    </section>
  );
}

function DmPanel({ room, working, onAction, onFocusTeam, onRefresh, onNotice }: { room: ClassroomRoomDto; working: boolean; onAction: ActionRunner; onFocusTeam: (teamId: string) => void; onRefresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const [selectedMemberId, setSelectedMemberId] = useState(room.members.find((member) => member.role === "learner")?.id ?? "");
  const [scores, setScores] = useState({ evidence: 0, modeling: 0, delivery: 0, support: 0, iteration: 0, responsibility: 0 });
  const [reason, setReason] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(10);
  const selectedTeamId = room.room.focusTeamId ?? room.challenge?.teamId ?? room.room.teams[0]?.id ?? "";
  const learnerCount = room.members.filter((member) => member.role === "learner").length;
  const focusedLearners = room.members.filter((member) => member.role === "learner" && member.teamId === selectedTeamId);
  const focusedLearnerIds = new Set(focusedLearners.map((learner) => learner.id));
  const focusedCardGrants = room.dmSecrets?.cardGrants.filter((grant) => focusedLearnerIds.has(grant.memberId)) ?? [];
  const focusedGrantedCardIds = new Set(focusedCardGrants.map((grant) => grant.id));
  const unassignedCards = room.dmSecrets?.allCards.filter((card) => !focusedGrantedCardIds.has(card.id)) ?? [];
  const readyTeams = room.room.teams.filter((team) => team.memberCount === team.seatLimit).length;
  const allTeamsReady = readyTeams === room.room.teams.length && room.room.teams.length > 0;
  const dealt = (room.dmSecrets?.cardGrants.length ?? 0) > 0;
  async function downloadArchive() {
    try {
      const archive = await api<Record<string, unknown>>(`${API_BASE}/rooms/${encodeURIComponent(room.room.id)}/export`);
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `msv-${room.room.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
      onNotice("课堂档案已导出；文件不包含邮箱、真实姓名或平台用户ID");
    } catch (cause) { onNotice(`导出失败：${messageOf(cause)}`); }
  }
  return (
    <div className={styles.panelStack}>
      <PanelHeader eyebrow="DM CONSOLE · 主持，不替学员作答" title="导师控制台" description="你的职责是控制信息边界、时间、压力与公开规则。所有阶段、记分、账本和揭晓操作都会进入审计日志。" />
      <div className={styles.dmCommandGrid}>
        <section><span className={styles.cardKicker}>ROOM</span><h2>{room.room.title}</h2><p>{learnerCount}名学员 · {room.room.teams.length}个团队 · 数据版本{room.version}</p><button onClick={() => void onRefresh()}>立即同步</button></section>
        <section><span className={styles.cardKicker}>FOCUS TEAM</span><label>正在查看<select value={selectedTeamId} onChange={(event) => onFocusTeam(event.target.value)}>{room.room.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.memberCount}/{team.seatLimit}</option>)}</select></label><p>{room.room.teams.find((team) => team.id === selectedTeamId)?.publicId}。切换后，挑战、经济与私密发牌状态只聚焦该团队。</p></section>
        <section><span className={styles.cardKicker}>PHASE CONTROL</span><h2>{PHASE_META[room.room.phase].label}</h2><p>{PHASE_META[room.room.phase].dm}</p><div><button disabled={working || room.room.phase === "lobby"} onClick={() => void onAction({ type: "move-phase", direction: "previous" }, "阶段已回退，操作记录保留")}>← 回退</button><button className={styles.primaryButton} disabled={working || ["debrief", "completed"].includes(room.room.phase)} onClick={() => void onAction({ type: "move-phase", direction: "next" }, `已推进到下一阶段`)}>{room.room.phase === "debrief" ? "请在下方完成章节" : "通过门槛并推进 →"}</button></div><div className={styles.timerControls}><label>阶段计时<select value={timerMinutes} onChange={(event) => setTimerMinutes(Number(event.target.value))}>{[3,5,6,8,10,15,20,30,45].map((minutes) => <option key={minutes} value={minutes}>{minutes}分钟</option>)}</select></label><button onClick={() => void onAction({ type: "set-timer", minutes: timerMinutes }, `已启动${timerMinutes}分钟共享计时`)}>启动/重置</button><button onClick={() => void onAction({ type: "toggle-pause", paused: !room.room.paused }, room.room.paused ? "课堂已恢复，计时顺延" : "课堂已暂停，学员提交暂时锁定")}>{room.room.paused ? "▶ 恢复" : "Ⅱ 暂停"}</button></div></section>
      </div>
      <MembershipAdminPanel room={room} working={working} onAction={onAction} onNotice={onNotice} />
      <section className={styles.dmRunbook}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>LIVE RUNBOOK</span><h2>当前明确操作</h2></div><span>不要让学员猜下一步</span></div>
        <ol>
          <li className={allTeamsReady ? styles.doneLine : ""}><b>1</b><div><strong>集结并审批队伍成员</strong><span>{allTeamsReady ? `全部${room.room.teams.length}支队伍已满员` : `${readyTeams}/${room.room.teams.length}支队伍已满员；把队伍ID发给学员并逐条审批`}</span></div></li>
          <li className={dealt ? styles.doneLine : ""}><b>2</b><div><strong>身份与手牌分别随机</strong><span>{dealt ? "本章已经发放，不能重复发牌" : "每队4人到齐后点击；每人从完整12张牌池随机抽3张，不按身份绑定"}</span></div>{!dealt && <button disabled={working || !allTeamsReady} onClick={() => void onAction({ type: "assign-and-deal" }, "身份与手牌已分别随机；每人从完整牌池抽到3张")}>随机分配身份与发牌</button>}</li>
          <li className={room.intelligence.nodes.length >= 4 ? styles.doneLine : ""}><b>3</b><div><strong>主持讲解与情报建网</strong><span>{room.intelligence.publishedCards.length}张已发布 · {room.intelligence.nodes.length}节点 · {room.intelligence.edges.length}关系</span></div></li>
          <li className={room.challenge?.resolution ? styles.doneLine : ""}><b>4</b><div><strong>投挑战并公开结算</strong><span>{room.challenge ? room.challenge.resolution ? "已结算" : `L${room.challenge.level} · 第${room.challenge.round}轮` : "等待团队计划完成后选择挑战"}</span></div></li>
          <li className={room.room.historyRevealed ? styles.doneLine : ""}><b>5</b><div><strong>冻结玩家世界线，再揭晓史实</strong><span>{room.room.historyRevealed ? "史实已按边界揭晓" : "不得提前投屏历史答案"}</span></div>{room.room.phase === "history" && !room.room.historyRevealed && <button disabled={working} onClick={() => void onAction({ type: "reveal-history" }, "史实已揭晓")}>揭晓史实</button>}</li>
        </ol>
      </section>
      {dealt && room.dmSecrets && <details className={styles.cardControl}><summary>随机发牌纠错 · 仅讲解开始前可撤回或从完整牌池补发</summary><div>{focusedLearners.flatMap((learner) => {
        const identity = room.dmSecrets?.identities.find((candidate) => candidate.id === learner.caseIdentityId);
        return focusedCardGrants.filter((grant) => grant.memberId === learner.id).map((grant) => {
          const card = room.dmSecrets?.allCards.find((candidate) => candidate.id === grant.id);
          if (!card) return null;
          return <article key={`${learner.id}:${card.id}`}><div><b>{learner.nickname}</b><span>{identity?.name} · 随机手牌</span></div><div><strong>{evidenceBoundaryLabel(card)} · {learnerCardTitle(card.title)}</strong><small>{grant.state}</small></div><button disabled={working || grant.state === "published"} onClick={() => void onAction({ type: "withdraw-card", cardId: card.id, memberId: learner.id }, "手牌已撤回并回到本队未分配牌池；审计记录保留")}>撤回</button></article>;
        });
      })}{unassignedCards.flatMap((card) => focusedLearners.map((learner) => <article key={`unassigned:${card.id}:${learner.id}`}><div><b>未分配手牌</b><span>完整牌池 · 不按身份</span></div><div><strong>{evidenceBoundaryLabel(card)} · {learnerCardTitle(card.title)}</strong><small>可补发给 {learner.nickname}</small></div><button disabled={working} onClick={() => void onAction({ type: "grant-card", cardId: card.id, memberId: learner.id }, `手牌已从完整牌池补发给${learner.nickname}`)}>补发给{learner.nickname}</button></article>))}</div></details>}
      <form className={styles.rpAwardCard} onSubmit={(event) => { event.preventDefault(); void onAction({ type: "award-reputation", memberId: selectedMemberId, scores, evidenceObjectId: `work:${room.chapter.id}:${Date.now()}`, reason }, "RP已绑定具体作品证据并进入个人长期账户"); }}>
        <div><span className={styles.cardKicker}>EVIDENCE-BASED RP</span><h2>为具体作品结算个人声望</h2><p>每章总上限12；证据2、建模2、交付3、支撑2、迭代2、责任1。不是印象分。</p></div>
        <label>学员<select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} required>{room.members.filter((member) => member.role === "learner").map((member) => <option key={member.id} value={member.id}>{member.nickname} · 当前{member.reputation} RP</option>)}</select></label>
        <div className={styles.scoreInputs}>{Object.entries({ evidence: 2, modeling: 2, delivery: 3, support: 2, iteration: 2, responsibility: 1 }).map(([dimension, max]) => <label key={dimension}>{RP_LABELS[dimension as keyof typeof RP_LABELS]}<select value={scores[dimension as keyof typeof scores]} onChange={(event) => setScores((value) => ({ ...value, [dimension]: Number(event.target.value) }))}>{Array.from({ length: max + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div>
        <label>作品证据与理由<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={300} placeholder="例如：用2条来源证据重写问题陈述，并在第二轮改变停止条件" required /></label>
        <button className={styles.primaryButton} disabled={working || Object.values(scores).every((value) => value === 0)}>结算这份作品的RP</button>
      </form>
      <section className={styles.dmFooterActions}><button onClick={() => void downloadArchive()}>↓ 导出完整课堂档案</button>{(room.room.phase === "debrief" || room.room.phase === "completed") && <button className={styles.primaryButton} disabled={working} onClick={() => void onAction({ type: "next-chapter" }, room.chapter.order === room.campaign.chapterCount ? "战役已完成，六分钟发布已归档" : "维护已结算，下一章已开启")}>{room.chapter.order === room.campaign.chapterCount ? `完成${room.campaign.chapterCount === 1 ? "本次课件" : `${room.campaign.chapterCount}章战役`}` : "全部复盘完成，进入下一章"}</button>}<button className={styles.dangerButton} disabled={working || room.room.status === "archived"} onClick={() => { if (window.confirm("归档后不能继续写入，但可以保留和导出全部记录。确定归档？")) void onAction({ type: "archive-room" }, "课堂已只读归档"); }}>归档课堂</button></section>
      <details className={styles.auditLog}><summary>查看最近100条审计事件</summary>{room.audit.map((event) => <div key={event.id}><time>{new Date(event.createdAt).toLocaleString("zh-CN")}</time><b>{event.action}</b><span>{event.targetType} · {event.targetId}</span></div>)}</details>
    </div>
  );
}

function PanelHeader({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return <header className={styles.panelHeader}><div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{aside}</header>;
}

function ProgressChecklist({ items }: { items: Array<{ done: boolean; label: string }> }) {
  return <div className={styles.progressChecklist} aria-label="本阶段完成条件">{items.map((item) => <span key={item.label} className={item.done ? styles.checkDone : ""}><b>{item.done ? "✓" : "○"}</b>{item.label}</span>)}</div>;
}

function WaitingCard({ title, body }: { title: string; body: string }) {
  return <article className={styles.waitingCard}><span>明确等待点</span><div><h2>{title}</h2><p>{body}</p></div></article>;
}

function MemberCard({ member, room }: { member: ClassroomRoomDto["members"][number]; room: ClassroomRoomDto }) {
  const identity = room.chapter.identities.find((item) => item.id === member.caseIdentityId);
  const lastSeenSeconds = Math.max(0, Math.floor((new Date(room.serverTime).getTime() - new Date(member.lastSeenAt).getTime()) / 1000));
  const presence = lastSeenSeconds < 15 ? "在线" : lastSeenSeconds < 60 ? `${lastSeenSeconds}秒前同步` : `${Math.floor(lastSeenSeconds / 60)}分钟前同步`;
  return <article className={styles.memberCard}><span>{initials(member.nickname)}</span><div><h3>{member.nickname}{member.id === room.viewer.memberId && <em>你</em>}</h3><p>{member.role === "dm" ? "DM · 主持人" : identity?.name ?? (room.viewer.role === "learner" ? "还没拿到角色" : "等待案例身份")}</p><small>{member.role === "dm" ? "导师席" : "Young Builder · 完整参与五步"} · {presence}</small></div><b>{member.reputation} RP</b></article>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: "coral" | "teal" | "mustard" | "violet" }) {
  return <article className={`${styles.metric} ${styles[`metric_${tone}`]}`}><span>{label}</span><b>{value}</b><small>{note}</small></article>;
}

function RoomTimer({ deadline, paused }: { deadline: string | null; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  if (!deadline) return <span className={styles.roomTimer}><small>阶段计时</small><b>--:--</b></span>;
  const remaining = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
  return <span className={`${styles.roomTimer} ${paused ? styles.timerPaused : remaining === 0 ? styles.timerOver : ""}`} role="timer"><small>{paused ? "课堂暂停" : remaining === 0 ? "时间到·可继续学习" : "阶段剩余"}</small><b>{paused ? "PAUSE" : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}</b></span>;
}

function LoadingScreen() { return <main className={styles.loadingScreen}><BrandHomeLink markOnly className={styles.loadingMark} /><h1>正在恢复你的课堂进度</h1><p>正在核对账号、课堂和已保存作品…</p><span /></main>; }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { Accept: "application/json", ...init?.headers } });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !body.ok || body.data === undefined) throw new Error(body.error?.message ?? `请求失败（${response.status}）`);
  return body.data;
}

function messageOf(error: unknown): string { return error instanceof Error ? error.message : "发生了未知错误，请重试。"; }
function money(tenths: number): string { return `${(tenths / 10).toFixed(tenths % 10 === 0 ? 0 : 1)} C`; }
function credibility(value: string): string { return value === "high" ? "高" : value === "medium" ? "中" : "低"; }
function studentCredibility(value: string): string { return value === "high" ? "有公开来源" : value === "medium" ? "需要再核对" : "只是未经确认的说法"; }
function studentKind(value: string): string { return ({ fact: "已记录的事实", observation: "可以观察的现象", viewpoint: "一种看法", inference: "一种猜测", rumor: "未经确认的消息" } as Record<string, string>)[value] ?? "一条线索"; }
function studentBoundaryExplanation(card: { title?: string; body?: string; kind?: string; sourceIds?: readonly string[] }): string {
  const code = evidenceBoundaryForCard(card);
  if (code === "F") return `${EVIDENCE_BOUNDARY_LABELS.F}：可以查来源，但只能证明卡上写到的部分。`;
  if (code === "R") return `${EVIDENCE_BOUNDARY_LABELS.R}：用来进入情境，不是历史采访或真实经营数据。`;
  if (code === "G") return `${EVIDENCE_BOUNDARY_LABELS.G}：先保留判断，再用第二条线索或真人行动核对。`;
  return `${EVIDENCE_BOUNDARY_LABELS.U}：现在不补写答案，先记下下一步要问谁、看什么。`;
}

function EvidenceBoundaryLegend() {
  return <aside className={styles.evidenceBoundaryLegend} aria-label="证据边界标签说明">
    <strong>每次说线索，先说它是哪一种</strong>
    {(Object.entries(EVIDENCE_BOUNDARY_LABELS) as Array<[keyof typeof EVIDENCE_BOUNDARY_LABELS, string]>).map(([code, label]) => <span key={code} data-boundary={code}><b>{label}</b><small>{({ F: "有资料支持", R: "只用于角色演练", G: "需要验证", U: "继续调查" } as const)[code]}</small></span>)}
  </aside>;
}
function studentUnlockCopy(id: string, name: string, ability: string): { name: string; ability: string } {
  return ({
    "source-inquiry": { name: "请老师讲清一张卡的来源", ability: "每章一次，选一张卡，请老师告诉你它从哪里来、能证明到哪一步。" },
    "cross-team-exchange": { name: "和另一队公开换一条线索", ability: "每章一次，把一条已经公开的证据和另一队交换。" },
    "role-specialist": { name: "请一位专业导师加一次支援", ability: "下一轮可请产品、开发、市场或运营导师中的一位多给一次追问或工具提示。" },
    "peer-coach": { name: "帮助队友重做一次", ability: "每章一次，拿出具体依据，陪队友把失败动作再试一次。" },
    "worldline-curator": { name: "主持一次历史对照", ability: "打开一条进阶史料，或在老师看护下主持一次“我们 vs 历史”。" },
  } as Record<string, { name: string; ability: string }>)[id] ?? { name, ability };
}
function studentPersonalItemDescription(id: string, fallback: string): string {
  return ({
    "support-ticket": "送给队友一次额外准备机会；不会直接变成钱。",
    "mentor-inquiry": "向老师问一个“应该往哪边查”的问题；老师不会说答案。",
    "research-pass": "多打开一条可选资料，看看有没有新的证据或反例。",
    "role-tool-license": "本章可向一位专业导师多申请一次工具提示。",
    "personal-training": "课后完成一个小训练，下一章多得到一个可选动作。",
  } as Record<string, string>)[id] ?? fallback;
}
function requestKey(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function initials(name: string): string { return Array.from(name.trim()).slice(0, 2).join("").toUpperCase() || "YB"; }
function relativeTime(date: Date | null): string { if (!date) return "刚刚"; const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000)); return seconds < 5 ? "刚刚" : seconds < 60 ? `${seconds}秒前` : `${Math.floor(seconds / 60)}分钟前`; }
function nodeTitle(room: ClassroomRoomDto, id: string): string { return room.intelligence.nodes.find((node) => node.id === id)?.title ?? "未知节点"; }
function outcomeLabel(value: string): string { return ({ "full-success": "完整成功", success: "成功", "costly-success": "有代价的成功", "learning-failure": "学习性失败·剧情继续" } as Record<string, string>)[value] ?? value; }
function clock(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
async function copyText(value: string, notify: (message: string) => void): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      notify(`已复制：${value}`);
      return true;
    }
  } catch {
    // Some browsers expose Clipboard API but reject it outside a user-approved context.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (document.execCommand("copy")) {
      notify(`已复制：${value}`);
      return true;
    }
  } catch {
    // The explicit prompt below still exposes the exact value for manual copying.
  } finally {
    textarea.remove();
  }

  window.prompt("自动复制失败，请手动复制下面内容：", value);
  notify(`自动复制失败，请手动复制：${value}`);
  return false;
}
