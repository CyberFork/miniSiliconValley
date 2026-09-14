"use client";

import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../lib/auth-model";
import type { TerminalShopItem } from "../lib/terminal-catalog";
import type { TerminalPublicSpace, TerminalWalletSummary } from "../lib/terminal-store";
import { publicPath } from "../lib/public-path";
import { PixelAvatar } from "../components/PixelAvatar";
import { AccountMenu } from "../components/AccountMenu";
import styles from "./terminal.module.css";

export type TerminalAppId = "home" | "identity" | "courses" | "space" | "wallet" | "shop" | "homework" | "games" | "grants";

type TerminalBootstrap = {
  identity: { userId: string; username: string; displayName: string; role: string; avatarSeed: string; avatarVersion: number };
  wallets: { production: TerminalWalletSummary; test: TerminalWalletSummary };
  catalog: TerminalShopItem[];
  inventory: Array<{ itemId: string; acquiredAt: string }>;
  equipment: Partial<Record<"identity" | "terminal" | "space", string>>;
  space: TerminalPublicSpace;
  classrooms: Array<{ id: string; title: string; environment: "test" | "production"; lifecycle: string; progress: string; href: string }>;
  courseware: Array<{ packageId: string; title: string; mentorRole: string; href: string }>;
};

type GrantRoom = { id: string; title: string; environment: "test" | "production"; learners: Array<{ profileId: string; username: string; displayName: string }> };
type GrantRecord = { transactionId: string; targetProfileId: string; username: string; displayName: string; environment: "test" | "production"; amountCoins: number; reason: string; roomId: string; classroomTitle: string; createdAt: string; reversed: boolean };
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

const APPS: Array<{ id: TerminalAppId; label: string; caption: string; glyph: string; learner?: boolean; staff?: boolean }> = [
  { id: "space", label: "硅谷空间", caption: "公开创意基地", glyph: "▦", learner: true },
  { id: "identity", label: "我的身份", caption: "账号与像素名片", glyph: "ID" },
  { id: "courses", label: "我的课程", caption: "课堂与只读课件", glyph: "▶" },
  { id: "wallet", label: "我的钱包", caption: "余额与可追溯流水", glyph: "C", learner: true },
  { id: "shop", label: "在线商店", caption: "装饰预览与兑换", glyph: "◇", learner: true },
  { id: "homework", label: "课后作业", caption: "导师发给我的任务", glyph: "✎", learner: true },
  { id: "games", label: "游戏中心", caption: "内容后续开放", glyph: "＋", learner: true },
  { id: "grants", label: "导师发币", caption: "人工奖励与纠错", glyph: "+C", staff: true },
];

export default function TerminalClient({ initialApp, initialUser }: { initialApp: TerminalAppId; initialUser: AuthUser }) {
  const [app, setApp] = useState<TerminalAppId>(initialApp);
  const [data, setData] = useState<TerminalBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const isLearner = initialUser.role === "learner";
  const isStaff = initialUser.role === "admin" || initialUser.role === "mentor";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<TerminalBootstrap>("/api/terminal/bootstrap"));
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  useEffect(() => {
    const onPop = () => setApp(appFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function open(next: TerminalAppId) {
    setApp(next); setNotice(""); setError("");
    const href = next === "home" ? publicPath("/terminal/") : publicPath(`/terminal/${next}/`);
    window.history.pushState({}, "", href);
    document.getElementById("terminal-content")?.focus();
  }

  const equippedTheme = data?.equipment.terminal ?? "terminal-default";
  return <main className={styles.page} data-theme={equippedTheme}>
    <a className={styles.skip} href="#terminal-content">跳到终端内容</a>
    <section className={styles.device} data-active-app={app} aria-label="Mini Silicon Valley 学员时空终端">
      <header className={styles.statusbar}>
        <a href={publicPath("/")} className={styles.brand} aria-label="返回 MINI硅谷官网"><Image src={publicPath("/assets/mini-silicon-valley-logo-transparent.png")} alt="MINI硅谷" width={330} height={84} unoptimized priority /></a>
        <span className={styles.signal} aria-label="时空信号已连接">◼ ◼ ◻</span>
        <time aria-label="时间处于混乱状态">--:--</time>
        <AccountMenu user={initialUser} returnTo={app === "home" ? "/terminal/" : `/terminal/${app}/`} />
      </header>
      <div className={styles.screen}>
        <aside className={styles.rail} aria-label="终端快捷入口">
          <button type="button" data-active={app === "home"} onClick={() => open("home")}><span>▣</span><b>开始</b></button>
          {APPS.filter((item) => (item.learner ? isLearner : item.staff ? isStaff : true)).slice(0, 5).map((item) => <button type="button" key={item.id} data-active={app === item.id} onClick={() => open(item.id)}><span>{item.glyph}</span><b>{item.label}</b></button>)}
        </aside>
        <section className={styles.workspace} id="terminal-content" tabIndex={-1}>
          <header className={styles.appbar}>
            <div><small>TIME TERMINAL · {app.toUpperCase()}</small><h1>{app === "home" ? `欢迎回来，${initialUser.displayName}` : APPS.find((item) => item.id === app)?.label}</h1></div>
            {app !== "home" && <button type="button" onClick={() => open("home")}>← 返回桌面</button>}
          </header>
          {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void refresh()}>重新连接</button></div>}
          {notice && <div className={styles.notice} role="status">{notice}</div>}
          {loading && !data ? <TerminalLoading /> : data ? <>
            {app === "home" && <Desktop data={data} isLearner={isLearner} isStaff={isStaff} onOpen={open} />}
            {app === "identity" && <IdentityApp data={data} />}
            {app === "courses" && <CoursesApp data={data} />}
            {app === "space" && isLearner && <SpaceApp data={data} busy={busy} onBusy={setBusy} onNotice={setNotice} onRefresh={refresh} />}
            {app === "wallet" && isLearner && <WalletApp data={data} busy={busy} onBusy={setBusy} onNotice={setNotice} onRefresh={refresh} />}
            {app === "shop" && isLearner && <ShopApp data={data} busy={busy} onBusy={setBusy} onNotice={setNotice} onRefresh={refresh} />}
            {app === "homework" && isLearner && <HomeworkApp />}
            {app === "games" && isLearner && <PlaceholderApp />}
            {app === "grants" && isStaff && <GrantApp busy={busy} onBusy={setBusy} onNotice={setNotice} />}
          </> : null}
        </section>
      </div>
      <footer className={styles.deviceFooter}><span>MSV-TIME/01</span><span>不要把私密卡、作业草稿或密码放进公开空间</span></footer>
    </section>
  </main>;
}

function Desktop({ data, isLearner, isStaff, onOpen }: { data: TerminalBootstrap; isLearner: boolean; isStaff: boolean; onOpen: (id: TerminalAppId) => void }) {
  const apps = APPS.filter((item) => item.learner ? isLearner : item.staff ? isStaff : true);
  return <div className={styles.desktop}>
    <section className={styles.identityStrip}>
      <PixelAvatar seed={data.identity.avatarSeed} label={data.identity.displayName} size="large" />
      <div><small>YOUNG BUILDER ID</small><h2>{data.identity.displayName}</h2><p>@{data.identity.username} · {roleName(data.identity.role)}</p></div>
      {isLearner && <div className={styles.coinBalance}><span>正式资产</span><b>{data.wallets.production.initialized ? `${data.wallets.production.balanceCoins} C` : "未启用"}</b><small>TEST {data.wallets.test.initialized ? `${data.wallets.test.balanceCoins} C` : "未启用"}</small></div>}
    </section>
    <section className={styles.appGrid} aria-label="时空终端应用">
      {apps.map((item) => <button type="button" key={item.id} onClick={() => onOpen(item.id)}><span className={styles.appIcon}>{item.glyph}</span><b>{item.label}</b><small>{item.caption}</small></button>)}
    </section>
    <section className={styles.quickGrid}>
      <article><small>我的课堂</small><b>{data.classrooms.length}</b><span>{data.classrooms[0] ? `继续：${data.classrooms[0].title}` : "等待导师把你加入课堂"}</span></article>
      <article><small>已发布课件</small><b>{data.courseware.length}</b><span>直接打开，不经过重复中转</span></article>
      <article><small>公开空间</small><b>{data.space.projectTitle ? "已布置" : "待布置"}</b><a href={publicPath(`/u/${encodeURIComponent(data.identity.username)}/`)}>查看公开页面 →</a></article>
    </section>
  </div>;
}

function IdentityApp({ data }: { data: TerminalBootstrap }) {
  return <div className={styles.appPanel}><section className={styles.identityCard} data-frame={data.equipment.identity ?? "default"}><PixelAvatar seed={data.identity.avatarSeed} label={data.identity.displayName} size="large" /><div><small>STABLE ACCOUNT</small><h2>{data.identity.displayName}</h2><p>@{data.identity.username}</p><span>{roleName(data.identity.role)}</span></div></section><div className={styles.explain}><h3>这是你的长期身份</h3><p>昵称、像素头像、硅谷币与已拥有装饰都绑定稳定账号。课堂席位只是你参加某一场课程的身份，不会替代这个账号。</p><a href={publicPath("/account/")}>管理昵称、密码与登录设备 →</a></div></div>;
}

function CoursesApp({ data }: { data: TerminalBootstrap }) {
  return <div className={styles.columns}><section><header className={styles.sectionTitle}><small>LIVE CLASSROOM</small><h2>我的课堂</h2></header>{data.classrooms.length ? <div className={styles.list}>{data.classrooms.map((room) => <a className={styles.rowCard} href={publicPath(room.href)} key={room.id}><span data-env={room.environment}>{room.environment.toUpperCase()}</span><b>{room.title}</b><small>{room.lifecycle} · 已解锁至 {room.progress}</small><em>继续课堂 →</em></a>)}</div> : <Empty title="还没有课堂" text="把你的账号或昵称告诉导师，由导师把你加入具体课堂。" />}</section><section><header className={styles.sectionTitle}><small>READ-ONLY COURSEWARE</small><h2>可看的课件</h2></header>{data.courseware.length ? <div className={styles.list}>{data.courseware.map((item) => <a className={styles.rowCard} href={publicPath(item.href)} key={item.packageId}><span>{item.mentorRole} 导师</span><b>{item.title}</b><small>已发布 · 只读</small><em>直接播放 →</em></a>)}</div> : <Empty title="暂时没有课件" text="正式发布且你有权查看的课件会出现在这里。" />}</section></div>;
}

function WalletApp({ data, busy, onBusy, onNotice, onRefresh }: ActionProps) {
  const wallet = data.wallets.production;
  const testWallet = data.wallets.test;
  async function initialize() {
    onBusy("wallet-init");
    try { await api("/api/terminal/wallet", { method: "POST", body: { environment: "production" } }); onNotice("正式钱包已启用。0 C 是真实余额，不是加载失败。"); await onRefresh(); }
    catch (cause) { onNotice(messageOf(cause)); }
    finally { onBusy(""); }
  }
  return <div className={styles.walletLayout}><section className={styles.walletHero}><small>SILICON VALLEY COIN · PRODUCTION</small><h2>{wallet.initialized ? `${wallet.balanceCoins} C` : "尚未启用"}</h2><p>{wallet.initialized ? "这是跨课程保留的正式个人资产。" : "启用后余额从 0 C 开始；导师发币和兑换都会留下记录。"}</p>{!wallet.initialized && <button type="button" disabled={Boolean(busy)} onClick={() => void initialize()}>{busy === "wallet-init" ? "正在启用…" : "启用正式钱包"}</button>}<div className={styles.testBalance}><b>TEST 隔离钱包</b><span>{testWallet.initialized ? `${testWallet.balanceCoins} C` : "未初始化"}</span><small>测试币不能购买正式装饰。</small></div></section><section><header className={styles.sectionTitle}><small>APPEND-ONLY LEDGER</small><h2>最近收支</h2></header>{wallet.transactions.length ? <ul className={styles.ledger}>{wallet.transactions.map((entry) => <li key={entry.id}><span data-positive={entry.amountCoins > 0}>{entry.amountCoins > 0 ? "+" : ""}{entry.amountCoins} C</span><div><b>{entry.reason}</b><small>{entry.actorDisplayName} · {formatTime(entry.createdAt)}{entry.reversed ? " · 已纠正" : ""}</small></div></li>)}</ul> : <Empty title={wallet.initialized ? "还没有收支" : "钱包未启用"} text="导师手动发币、商店兑换和纠错都会记录在这里。" />}</section></div>;
}

function ShopApp({ data, busy, onBusy, onNotice, onRefresh }: ActionProps) {
  const [preview, setPreview] = useState<TerminalShopItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const owned = useMemo(() => new Set(data.inventory.map((item) => item.itemId)), [data.inventory]);
  async function buy(item: TerminalShopItem) {
    onBusy(`buy:${item.id}`);
    try { await api("/api/terminal/purchase", { method: "POST", body: { itemId: item.id, idempotencyKey: `shop.${crypto.randomUUID()}` } }); onNotice(`已获得“${item.name}”，余额和所有权已同时更新。`); setConfirming(false); await onRefresh(); }
    catch (cause) { onNotice(messageOf(cause)); }
    finally { onBusy(""); }
  }
  async function equip(item: TerminalShopItem) {
    onBusy(`equip:${item.id}`);
    try { await api("/api/terminal/equip", { method: "POST", body: { itemId: item.id } }); onNotice(`“${item.name}”已装备到${slotName(item.slot)}。`); await onRefresh(); }
    catch (cause) { onNotice(messageOf(cause)); }
    finally { onBusy(""); }
  }
  return <div className={styles.shopLayout}><section><header className={styles.sectionTitle}><small>DECORATION SHOP</small><h2>装饰商店</h2><p>只卖外观，不卖成就、分数、课程或学习机会。</p></header><div className={styles.shopGrid}>{data.catalog.map((item) => { const has = owned.has(item.id); const equipped = data.equipment[item.slot] === item.id; return <article key={item.id} style={{ "--item-accent": item.accent } as React.CSSProperties}><span>{item.glyph}</span><small>{slotName(item.slot)}</small><h3>{item.name}</h3><p>{item.description}</p><b>{item.priceCoins} C</b><div><button type="button" onClick={() => { setPreview(item); setConfirming(false); }}>{has ? "查看" : "预览并兑换"}</button>{has && <button type="button" disabled={equipped || Boolean(busy)} onClick={() => void equip(item)}>{equipped ? "已装备" : "装备"}</button>}</div></article>; })}</div></section><aside className={styles.preview}><small>LIVE PREVIEW</small>{preview ? <><div className={styles.previewGlyph} style={{ borderColor: preview.accent }}>{preview.glyph}</div><h2>{preview.name}</h2><p>{preview.description}</p><b>{owned.has(preview.id) ? "已拥有" : `${preview.priceCoins} C`}</b>{!owned.has(preview.id) && (confirming ? <div className={styles.purchaseConfirm} role="alertdialog" aria-label="确认兑换装饰"><strong>确认兑换？</strong><p>将从正式钱包扣除 {preview.priceCoins} C，并永久获得“{preview.name}”。不会购买成就或课程权限。</p><div><button type="button" onClick={() => setConfirming(false)} disabled={Boolean(busy)}>取消</button><button type="button" onClick={() => void buy(preview)} disabled={Boolean(busy) || !data.wallets.production.initialized}>{busy === `buy:${preview.id}` ? "兑换中…" : `确认扣除 ${preview.priceCoins} C`}</button></div></div> : <button className={styles.previewAction} type="button" onClick={() => setConfirming(true)} disabled={Boolean(busy) || !data.wallets.production.initialized}>{data.wallets.production.initialized ? "准备兑换" : "请先启用正式钱包"}</button>)}</> : <p>选择一件装饰预览。兑换前会再次显示价格与影响范围。</p>}<div className={styles.inventory}><h3>已拥有 · {data.inventory.length}</h3>{data.inventory.length ? data.inventory.map((entry) => <span key={entry.itemId}>{data.catalog.find((item) => item.id === entry.itemId)?.name ?? entry.itemId}</span>) : <small>还没有装饰。成就不会出现在商店。</small>}</div></aside></div>;
}

function SpaceApp({ data, busy, onBusy, onNotice, onRefresh }: ActionProps) {
  const [form, setForm] = useState({ intro: data.space.intro, projectTitle: data.space.projectTitle, projectSummary: data.space.projectSummary, projectUrl: data.space.projectUrl, teamName: data.space.teamName, contribution: data.space.contribution });
  async function save(event: FormEvent) {
    event.preventDefault(); onBusy("space-save");
    try { await api("/api/terminal/space", { method: "PATCH", body: form }); onNotice("公开空间已更新。只有表单里的公开副本会被访客看到。"); await onRefresh(); }
    catch (cause) { onNotice(messageOf(cause)); }
    finally { onBusy(""); }
  }
  return <div className={styles.spaceLayout}><PublicRoom space={{ ...data.space, ...form }} /><form className={styles.spaceForm} onSubmit={save}><header><small>PUBLIC COPY ONLY</small><h2>布置我的公开空间</h2><p>这里的内容可被任何人访问。不要填写密码、私密卡、作业草稿或未公开的队友信息。</p></header><label>一句介绍<textarea value={form.intro} maxLength={160} onChange={(event) => setForm({ ...form, intro: event.target.value })} /></label><label>公开作品名称<input value={form.projectTitle} maxLength={80} onChange={(event) => setForm({ ...form, projectTitle: event.target.value })} /></label><label>公开作品说明<textarea value={form.projectSummary} maxLength={500} onChange={(event) => setForm({ ...form, projectSummary: event.target.value })} /></label><label>作品链接（可选，仅 https）<input type="url" value={form.projectUrl} maxLength={512} placeholder="https://" onChange={(event) => setForm({ ...form, projectUrl: event.target.value })} /></label><div className={styles.formSplit}><label>团队名称<input value={form.teamName} maxLength={80} onChange={(event) => setForm({ ...form, teamName: event.target.value })} /></label><label>我的贡献<input value={form.contribution} maxLength={240} onChange={(event) => setForm({ ...form, contribution: event.target.value })} /></label></div><button type="submit" disabled={Boolean(busy)}>{busy === "space-save" ? "正在发布…" : "保存公开副本"}</button><a href={publicPath(`/u/${encodeURIComponent(data.identity.username)}/`)}>在新页面查看访客视角 →</a></form></div>;
}

function GrantApp({ busy, onBusy, onNotice }: { busy: string; onBusy: (value: string) => void; onNotice: (value: string) => void }) {
  const [rooms, setRooms] = useState<GrantRoom[]>([]);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [roomId, setRoomId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [amount, setAmount] = useState(2);
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState<GrantRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const key = useRef(`grant.${crypto.randomUUID()}`);
  const correctionKey = useRef(`reverse.${crypto.randomUUID()}`);
  const reload = useCallback(async () => {
    try {
      const result = await api<{ rooms: GrantRoom[]; grants: GrantRecord[] }>("/api/terminal/grants");
      setRooms(result.rooms); setGrants(result.grants); setRoomId((current) => current || result.rooms[0]?.id || "");
    } catch (cause) { onNotice(messageOf(cause)); }
  }, [onNotice]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  const room = rooms.find((item) => item.id === roomId);
  const effectiveLearnerId = room?.learners.some((item) => item.profileId === learnerId) ? learnerId : room?.learners[0]?.profileId ?? "";
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!room) return; onBusy("grant");
    try {
      const result = await api<{ displayName: string; balanceCoins: number }>("/api/terminal/grants", { method: "POST", body: { roomId, targetProfileId: effectiveLearnerId, environment: room.environment, amountCoins: amount, reason, idempotencyKey: key.current } });
      onNotice(`已给 ${result.displayName} 发放 ${amount} C；当前${room.environment === "test" ? "测试" : "正式"}余额 ${result.balanceCoins} C。`);
      key.current = `grant.${crypto.randomUUID()}`; setReason(""); await reload();
    } catch (cause) { onNotice(messageOf(cause)); }
    finally { onBusy(""); }
  }
  async function reverse(event: FormEvent) {
    event.preventDefault(); if (!correction) return; onBusy(`reverse:${correction.transactionId}`);
    try {
      await api(`/api/terminal/grants/${encodeURIComponent(correction.transactionId)}/reverse`, { method: "POST", body: { reason: correctionReason, idempotencyKey: correctionKey.current } });
      onNotice(`已用反向流水纠正给 ${correction.displayName} 的 ${correction.amountCoins} C；原记录没有删除。`);
      correctionKey.current = `reverse.${crypto.randomUUID()}`; setCorrection(null); setCorrectionReason(""); await reload();
    } catch (cause) { onNotice(messageOf(cause)); }
    finally { onBusy(""); }
  }
  return <div className={styles.grantLayout}><section><header className={styles.sectionTitle}><small>MANUAL REWARD CONSOLE</small><h2>导师手动发币</h2><p>互动问答只产生发币建议；真正入账必须由导师在这里确认。TEST 与正式资产物理隔离。</p></header><form className={styles.grantForm} onSubmit={submit}><label>课堂<select value={roomId} onChange={(event) => { setRoomId(event.target.value); setLearnerId(""); }}><option value="">选择你有权管理的课堂</option>{rooms.map((item) => <option value={item.id} key={item.id}>{item.environment.toUpperCase()} · {item.title}</option>)}</select></label><label>学员<select value={effectiveLearnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={!room}><option value="">选择本课堂学员</option>{room?.learners.map((item) => <option value={item.profileId} key={item.profileId}>{item.displayName} · @{item.username}</option>)}</select></label><label>硅谷币数量<input type="number" min={1} max={1000} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>发放原因<textarea value={reason} minLength={2} maxLength={200} placeholder="例如：说明理由清楚，并帮助队友补充证据" onChange={(event) => setReason(event.target.value)} required /></label><button type="submit" disabled={Boolean(busy) || !room || !effectiveLearnerId || reason.trim().length < 2}>{busy === "grant" ? "正在记入账本…" : `确认发放 ${amount} C`}</button></form></section><aside className={styles.rules}><h3>最近发放与纠错</h3>{grants.length ? <ul className={styles.ledger}>{grants.map((entry) => <li key={entry.transactionId}><span data-positive="true">+{entry.amountCoins} C</span><div><b>{entry.displayName} · {entry.classroomTitle}</b><small>{entry.environment.toUpperCase()} · {entry.reason} · {formatTime(entry.createdAt)}{entry.reversed ? " · 已纠正" : ""}</small>{!entry.reversed && <button type="button" disabled={Boolean(busy)} onClick={() => { setCorrection(entry); setCorrectionReason(""); }}>纠正这笔发放</button>}</div></li>)}</ul> : <p>还没有可查看的发放记录。</p>}{correction && <form className={styles.grantForm} onSubmit={reverse}><h3>确认用反向流水纠正</h3><p>{correction.displayName} · {correction.amountCoins} C · {correction.classroomTitle}</p><label>纠错原因<textarea value={correctionReason} minLength={2} maxLength={200} onChange={(event) => setCorrectionReason(event.target.value)} required /></label><div><button type="button" onClick={() => setCorrection(null)} disabled={Boolean(busy)}>取消</button><button type="submit" disabled={Boolean(busy) || correctionReason.trim().length < 2}>{busy.startsWith("reverse:") ? "正在纠正…" : "确认写入反向流水"}</button></div></form>}</aside></div>;
}

function PublicRoom({ space }: { space: TerminalPublicSpace }) {
  const item = space.equipment.space;
  return <section className={styles.pixelRoom} data-space-item={item ?? "none"}><div className={styles.roomWindow}><span /><span /><span /></div><div className={styles.roomAvatar}><PixelAvatar seed={space.avatarSeed} label={space.displayName} size="large" /><b>{space.displayName}</b><small>@{space.studentId}</small></div><div className={styles.roomDesk}><span>⌨</span><b>{space.projectTitle || "作品工作台"}</b><small>{space.projectSummary || "公开作品将在这里展示"}</small></div><div className={styles.roomWall}><b>创意墙</b><span>{space.intro || "我正在学习把问题变成可以行动的方案。"}</span></div><div className={styles.roomTeam}><b>{space.teamName || "团队展位"}</b><span>{space.contribution || "团队与个人贡献会明确标注"}</span></div><div className={styles.roomItem} aria-label={item ? "已装备空间装饰" : "空装饰位"}>{item === "space-moon-rocket" ? "🚀" : item === "space-pixel-plant" ? "🌱" : "＋"}</div></section>;
}

type HomeworkField = { id:string; label:string; kind:"short"|"long"|"single"|"multi"; required:boolean; options?:string[] };
type HomeworkAssignment = { id:string; title:string; roomTitle:string; instructions:string; status:"published"|"closed"; dueAt:string|null; publishedAt:string; templateRevision:number; fields:HomeworkField[]; response:null|{answers:Record<string,string|string[]>;status:string;submittedAt:string|null;feedback:string;feedbackAt:string|null} };

function HomeworkApp() {
  const [assignments,setAssignments]=useState<HomeworkAssignment[]>([]),[selected,setSelected]=useState(""),[answers,setAnswers]=useState<Record<string,string|string[]>>({}),[busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const selectedRef=useRef("");
  const load=useCallback(async()=>{setLoading(true);try{const list=await api<HomeworkAssignment[]>("/api/homework/assignments");const id=selectedRef.current&&list.some(item=>item.id===selectedRef.current)?selectedRef.current:list.find(item=>item.status==="published")?.id??list[0]?.id??"";selectedRef.current=id;setAssignments(list);setSelected(id);setAnswers(list.find(item=>item.id===id)?.response?.answers??{});setError("");}catch(cause){setError(messageOf(cause))}finally{setLoading(false)}},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void load()},0);return()=>window.clearTimeout(timer)},[load]);
  const assignment=assignments.find(item=>item.id===selected);
  function choose(id:string){selectedRef.current=id;setSelected(id);setAnswers(assignments.find(item=>item.id===id)?.response?.answers??{});setNotice("")}
  function setAnswer(field:HomeworkField,value:string|string[]){setAnswers(current=>({...current,[field.id]:value}))}
  async function save(status:"draft"|"submitted") { if(!assignment)return;setBusy(status);setNotice("");try{const next=await api<HomeworkAssignment>(`/api/homework/assignments/${assignment.id}/response`,{method:"PATCH",body:{status,answers}});setAssignments(list=>list.map(item=>item.id===next.id?next:item));setNotice(status==="draft"?"草稿已经保存在你的账号里。":"提交成功。导师现在可以在课堂作业中心看到你的答案。")}catch(cause){setError(messageOf(cause))}finally{setBusy("")}}
  if(loading)return <TerminalLoading/>;
  return <div className={styles.homeworkLayout}><section className={styles.homeworkList}><header className={styles.sectionTitle}><small>MY ASSIGNMENTS</small><h2>导师发给我的作业</h2><p>只显示发给你所在课堂、并且收件名单包含你的任务。</p></header>{assignments.length?assignments.map(item=><button type="button" key={item.id} data-active={item.id===selected} onClick={()=>choose(item.id)}><span data-state={item.response?.status??"not-started"}>{item.status==="closed"?"已截止":item.response?.status==="submitted"?"已提交":item.response?.status==="draft"?"草稿":"待完成"}</span><b>{item.title}</b><small>{item.roomTitle} · 模板 r{item.templateRevision}</small></button>):<Empty title="还没有定向作业" text="导师发放后，作业会自动出现在这里。你仍可从下方打开公开练习。"/>}<a className={styles.publicPractice} href={publicPath("/homework/first-game/")}>打开公开练习《我的第一款游戏》 →</a></section>
   <section className={styles.homeworkSheet}>{error&&<div className={styles.error} role="alert">{error}<button type="button" onClick={()=>{setError("");void load()}}>重试</button></div>}{notice&&<div className={styles.notice}>{notice}</div>}{assignment?<><header><small>{assignment.roomTitle} · r{assignment.templateRevision}</small><h2>{assignment.title}</h2>{assignment.instructions&&<p>{assignment.instructions}</p>}<div><span>{assignment.status==="closed"?"已截止":"正在收集"}</span>{assignment.dueAt&&<span>截止 {formatTime(assignment.dueAt)}</span>}</div></header><form onSubmit={event=>{event.preventDefault();void save("submitted")}}>{assignment.fields.map(field=><ManagedHomeworkFieldView key={field.id} field={field} value={answers[field.id]} onChange={value=>setAnswer(field,value)} disabled={assignment.status==="closed"}/>) }<footer><button type="button" onClick={()=>void save("draft")} disabled={Boolean(busy)||assignment.status==="closed"}>{busy==="draft"?"保存中…":"保存草稿"}</button><button type="submit" disabled={Boolean(busy)||assignment.status==="closed"}>{busy==="submitted"?"提交中…":"提交给导师"}</button></footer></form>{assignment.response?.feedback&&<aside className={styles.homeworkFeedback}><small>MENTOR FEEDBACK</small><h3>导师反馈</h3><p>{assignment.response.feedback}</p></aside>}</>:<Empty title="选择一份作业" text="你可以保存草稿，再正式提交；已截止的任务仍然可以查看。"/>}</section></div>;
}

function ManagedHomeworkFieldView({field,value,onChange,disabled}:{field:HomeworkField;value?:string|string[];onChange:(value:string|string[])=>void;disabled:boolean}) {
  if(field.kind==="short"||field.kind==="long")return <label className={styles.homeworkField}><b>{field.label}{field.required&&<em>必填</em>}</b>{field.kind==="long"?<textarea value={typeof value==="string"?value:""} maxLength={2000} disabled={disabled} onChange={event=>onChange(event.target.value)}/>:<input value={typeof value==="string"?value:""} maxLength={300} disabled={disabled} onChange={event=>onChange(event.target.value)}/>}</label>;
  const selected=Array.isArray(value)?value:[];
  return <fieldset className={styles.homeworkField}><legend>{field.label}{field.required&&<em>必填</em>}</legend><div>{field.options?.map(option=><label key={option}><input type={field.kind==="single"?"radio":"checkbox"} name={field.kind==="single"?field.id:undefined} checked={selected.includes(option)} disabled={disabled} onChange={event=>onChange(field.kind==="single"?[option]:event.target.checked?[...selected,option]:selected.filter(item=>item!==option))}/><span>{option}</span></label>)}</div></fieldset>;
}

function PlaceholderApp() {
  return <div className={styles.placeholder}><span>＋</span><small>GAME CENTER</small><h2>游戏内容后续开放</h2><p>这里现在只有稳定入口，不会擅自添加游戏、抽奖或自动奖励。</p><button type="button" disabled>尚未开放</button></div>;
}

function TerminalLoading() { return <div className={styles.loading} role="status"><span /><p>正在校验账号、课堂、课件与资产边界…</p></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className={styles.empty}><b>{title}</b><p>{text}</p></div>; }
type ActionProps = { data: TerminalBootstrap; busy: string; onBusy: (value: string) => void; onNotice: (value: string) => void; onRefresh: () => Promise<void> };

async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(publicPath(path), { method: options.method ?? "GET", headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined, credentials: "same-origin" });
  const envelope = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !envelope?.ok || envelope.data === undefined) throw new Error(envelope?.error?.message ?? "时空终端没有完成这次操作。");
  return envelope.data;
}

function appFromPath(pathname: string): TerminalAppId {
  const segment = pathname.split("/").filter(Boolean).at(-1) as TerminalAppId | undefined;
  return segment && APPS.some((item) => item.id === segment) ? segment : "home";
}
function messageOf(cause: unknown) { return cause instanceof Error ? cause.message : "时空终端暂时没有响应。"; }
function roleName(role: string) { return { admin: "平台管理员", mentor: "导师", learner: "Young Builder", observer: "观察员" }[role] ?? role; }
function slotName(slot: "identity" | "terminal" | "space") { return { identity: "身份装饰", terminal: "终端主题", space: "空间摆件" }[slot]; }
function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
