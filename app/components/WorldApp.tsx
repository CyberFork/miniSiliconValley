"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import Image from "next/image";
import { historyCatalog } from "../data/history";
import { missions } from "../data/missions";
import type {
  HistoryCategory,
  HistoryEvent,
  MissionRecord,
  PlayerState,
  ResourceKey,
} from "../lib/model";
import {
  applyChoice,
  createInitialState,
  parseState,
  serializeState,
  STORAGE_KEY,
  updateMissionNotes,
} from "../lib/state";
import { MentorGuide } from "./MentorGuide";
import { MissionPlayer } from "./MissionPlayer";
import { Modal } from "./Modal";

type ViewId = "world" | "missions" | "dossier" | "mentor";

const CHECKPOINT_KEY = "msv-world-checkpoint-v1";
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const yearMin = historyCatalog.eras[0].start;
const yearMax = historyCatalog.eras.at(-1)!.end;

const categoryMeta: Record<HistoryCategory, { label: string; glyph: string }> = {
  education: { label: "教育", glyph: "EDU" },
  defense: { label: "国防研究", glyph: "R&D" },
  semiconductor: { label: "半导体", glyph: "IC" },
  computing: { label: "计算", glyph: "PC" },
  network: { label: "网络", glyph: "NET" },
  software: { label: "软件", glyph: "APP" },
  venture: { label: "商业/资本", glyph: "VC" },
  mobile: { label: "移动", glyph: "MOB" },
  cloud: { label: "云", glyph: "CLD" },
  ai: { label: "AI", glyph: "AI" },
  robotics: { label: "机器人", glyph: "BOT" },
  global: { label: "全球节点", glyph: "GLO" },
};

const mapLayers = [
  { year: 1939, src: "/assets/map-1939.webp", label: "1939 · 果园与车库" },
  { year: 1968, src: "/assets/map-1968.webp", label: "1968 · 芯片山谷" },
  { year: 1998, src: "/assets/map-1998.webp", label: "1998 · 互联网起飞" },
  { year: 2026, src: "/assets/silicon-valley-base-map.webp", label: "2026 · AI 与机器人" },
];

const sourceById = new Map(historyCatalog.sources.map((item) => [item.id, item]));
const placeById = new Map(historyCatalog.places.map((item) => [item.id, item]));
const orgById = new Map(historyCatalog.organizations.map((item) => [item.id, item]));
const personById = new Map(historyCatalog.people.map((item) => [item.id, item]));
const techById = new Map(historyCatalog.technologies.map((item) => [item.id, item]));
const eventById = new Map(historyCatalog.events.map((item) => [item.id, item]));
const missionById = new Map(missions.map((item) => [item.id, item]));

export function WorldApp() {
  const [view, setView] = useState<ViewId>("world");
  const [state, setState] = useState<PlayerState>(() => createInitialState());
  const [hydrated, setHydrated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [activeMissionId, setActiveMissionId] = useState<string>();
  const [showBriefing, setShowBriefing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [mapView, setMapView] = useState({ scale: 1, x: 0, y: 0 });
  const importRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | undefined>(undefined);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; scale: number; centerX: number; centerY: number; originX: number; originY: number } | undefined>(undefined);
  const missionReturnRef = useRef<{ year: number; mapView: typeof mapView } | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          setState(parseState(raw));
        } catch {
          setNotice("检测到损坏存档，已使用安全初始状态。");
        }
      } else {
        setShowBriefing(true);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, serializeState(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        const next = Math.min(yearMax, current.currentYear + speed);
        if (next >= yearMax) window.setTimeout(() => setPlaying(false), 0);
        return { ...current, currentYear: next, savedAt: new Date().toISOString() };
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== "world" || selectedEventId || activeMissionId) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, a")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        changeYear(state.currentYear + (event.key === "ArrowLeft" ? -1 : 1));
      } else if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        changeYear(state.currentYear + (event.key === "PageUp" ? -10 : 10));
      } else if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeMissionId, selectedEventId, state.currentYear, view]);

  const era = useMemo(
    () => historyCatalog.eras.find((item) => state.currentYear >= item.start && state.currentYear <= item.end) ?? historyCatalog.eras[0],
    [state.currentYear],
  );

  const matchingEvents = useMemo(() => {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    return historyCatalog.events.filter((event) => {
      if (state.selectedCategory !== "all" && event.category !== state.selectedCategory) return false;
      if (!query) return true;
      const related = [
        event.title,
        event.summary,
        event.significance,
        placeById.get(event.placeId)?.name,
        ...event.organizationIds.map((id) => orgById.get(id)?.name),
        ...event.personIds.map((id) => personById.get(id)?.name),
        ...event.technologyIds.map((id) => techById.get(id)?.name),
        ...event.tags,
      ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
      return related.includes(query);
    });
  }, [state.query, state.selectedCategory]);

  const nearbyEvents = useMemo(() => {
    const sorted = matchingEvents
      .map((event) => ({ event, distance: Math.abs(event.year - state.currentYear) }))
      .sort((a, b) => a.distance - b.distance || b.event.year - a.event.year);
    return sorted.slice(0, 14).map(({ event }) => event).sort((a, b) => b.year - a.year);
  }, [matchingEvents, state.currentYear]);

  const mapEvents = useMemo(() => {
    const eligible = matchingEvents.filter((event) => event.year <= state.currentYear);
    const latestByPlace = new Map<string, HistoryEvent>();
    eligible.forEach((event) => {
      const existing = latestByPlace.get(event.placeId);
      if (!existing || existing.year <= event.year) latestByPlace.set(event.placeId, event);
    });
    const currentEraMissionEvents = eligible.filter((event) => event.missionId && event.year >= era.start);
    return [...new Map(
      [...currentEraMissionEvents, ...[...latestByPlace.values()].sort((a, b) => b.year - a.year)]
        .slice(0, 18)
        .map((event) => [event.id, event]),
    ).values()];
  }, [era.start, matchingEvents, state.currentYear]);

  const selectedEvent = selectedEventId ? eventById.get(selectedEventId) : undefined;
  const activeMission = activeMissionId ? missionById.get(activeMissionId) : undefined;
  const completedCount = state.results.length;

  function changeYear(year: number) {
    setPlaying(false);
    setState((current) => ({
      ...current,
      currentYear: Math.max(yearMin, Math.min(yearMax, Math.round(year))),
      savedAt: new Date().toISOString(),
    }));
  }

  function openEvent(event: HistoryEvent) {
    setSelectedEventId(event.id);
    setState((current) => ({
      ...current,
      currentYear: event.year,
      visitedEventIds: current.visitedEventIds.includes(event.id)
        ? current.visitedEventIds
        : [...current.visitedEventIds, event.id],
      savedAt: new Date().toISOString(),
    }));
  }

  function launchMission(mission: MissionRecord) {
    missionReturnRef.current = { year: state.currentYear, mapView };
    setSelectedEventId(undefined);
    setActiveMissionId(mission.id);
    setState((current) => ({
      ...current,
      activeMissionId: mission.id,
      currentYear: mission.year,
      visitedEventIds: current.visitedEventIds.includes(mission.eventId)
        ? current.visitedEventIds
        : [...current.visitedEventIds, mission.eventId],
      savedAt: new Date().toISOString(),
    }));
  }

  function closeMission() {
    setActiveMissionId(undefined);
    const returnPoint = missionReturnRef.current;
    missionReturnRef.current = undefined;
    if (returnPoint) setMapView(returnPoint.mapView);
    setState((current) => ({
      ...current,
      activeMissionId: undefined,
      currentYear: returnPoint?.year ?? current.currentYear,
      savedAt: new Date().toISOString(),
    }));
  }

  function setCategory(category: HistoryCategory | "all") {
    setState((current) => ({ ...current, selectedCategory: category, savedAt: new Date().toISOString() }));
  }

  function createCheckpoint() {
    window.localStorage.setItem(CHECKPOINT_KEY, serializeState(state));
    setNotice("检查点已建立：当前年份、筛选、世界线与复盘均已保存。");
  }

  function restoreCheckpoint() {
    const raw = window.localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return setNotice("尚未建立检查点。");
    try {
      setState(parseState(raw));
      setNotice("已恢复到最近检查点。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "检查点无法恢复。");
    }
  }

  function exportState() {
    const blob = new Blob([serializeState(state)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mini-silicon-valley-worldline-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("世界线档案已导出。");
  }

  async function importState(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) return setNotice("导入失败：档案超过 2 MiB 安全上限。");
    try {
      const next = parseState(await file.text());
      setState(next);
      setNotice("档案校验通过，已恢复世界线。");
    } catch (error) {
      setNotice(error instanceof Error ? `导入失败：${error.message}` : "导入失败。");
    }
  }

  function resetState() {
    if (!window.confirm("确定重置当前世界线？请先导出需要保留的档案。")) return;
    setState(createInitialState());
    setNotice("已重置为新的 Young Builder 世界线。");
  }

  function onMapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      const [first, second] = points;
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        scale: mapView.scale,
        centerX: (first.x + second.x) / 2,
        centerY: (first.y + second.y) / 2,
        originX: mapView.x,
        originY: mapView.y,
      };
      dragRef.current = undefined;
    } else {
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: mapView.x, originY: mapView.y };
    }
  }

  function onMapPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const pinch = pinchRef.current;
    if (points.length >= 2 && pinch) {
      const [first, second] = points;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      setMapView({
        scale: Math.max(1, Math.min(2.4, Number((pinch.scale * distance / pinch.distance).toFixed(2)))),
        x: pinch.originX + centerX - pinch.centerX,
        y: pinch.originY + centerY - pinch.centerY,
      });
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setMapView((current) => ({ ...current, x: drag.originX + event.clientX - drag.x, y: drag.originY + event.clientY - drag.y }));
  }

  function onMapPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = undefined;
    const remaining = [...pointersRef.current.entries()][0];
    dragRef.current = remaining
      ? { pointerId: remaining[0], x: remaining[1].x, y: remaining[1].y, originX: mapView.x, originY: mapView.y }
      : undefined;
  }

  function zoomMap(delta: number) {
    setMapView((current) => ({ ...current, scale: Math.max(1, Math.min(2.4, Number((current.scale + delta).toFixed(1)))) }));
  }

  function onMapWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomMap(event.deltaY > 0 ? -0.1 : 0.1);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主内容</a>
      <header className="topbar">
        <button className="brand-lockup" type="button" onClick={() => setView("world")} aria-label="返回迷你硅谷历史世界">
          <span className="brand-pixel" aria-hidden="true">MSV</span>
          <span><b>MINI SILICON VALLEY</b><small>有限开放世界创业 RPG · v1.0</small></span>
        </button>
        <nav className="primary-nav" aria-label="主导航">
          {([
            ["world", "历史世界"],
            ["missions", `互动战役 ${completedCount}/8`],
            ["dossier", "学习档案"],
            ["mentor", "DM 手册"],
          ] as [ViewId, string][]).map(([id, label]) => (
            <button key={id} type="button" className={view === id ? "is-active" : ""} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="help-button" type="button" onClick={() => setShowBriefing(true)}>操作导引</button>
          <div className="resource-mini" title="团队当前资源">
            <span>证 {state.resources.evidence}</span><span>信 {state.resources.trust}</span><span>窗 {state.resources.runway}</span><span>造 {state.resources.craft}</span>
          </div>
        </div>
      </header>

      <div id="main-content" tabIndex={-1}>
        {view === "world" ? (
          <main className="world-layout">
            <aside className="intel-dock" aria-label="历史情报台">
              <div className="era-brief">
                <p className="eyebrow">NOW ENTERING · {era.shortTitle}</p>
                <div className="era-year"><span>{state.currentYear}</span><small>{era.start}—{era.end}</small></div>
                <h1>{era.title}</h1>
                <p>{era.description}</p>
                <blockquote>{era.question}</blockquote>
              </div>

              <div className="search-panel">
                <label htmlFor="world-search">搜索企业、人物、技术、地点</label>
                <div className="search-input-wrap"><span aria-hidden="true">⌕</span><input id="world-search" value={state.query} onChange={(event) => setState((current) => ({ ...current, query: event.target.value, savedAt: new Date().toISOString() }))} placeholder="例：仙童 / 浏览器 / 张量" /></div>
                <div className="filter-chips" aria-label="领域筛选">
                  <button type="button" className={state.selectedCategory === "all" ? "is-active" : ""} onClick={() => setCategory("all")}>全部</button>
                  {(Object.entries(categoryMeta) as [HistoryCategory, { label: string; glyph: string }][]).map(([id, meta]) => (
                    <button key={id} type="button" className={state.selectedCategory === id ? "is-active" : ""} onClick={() => setCategory(id)}>{meta.label}</button>
                  ))}
                </div>
              </div>

              <section className="event-ledger">
                <header><div><p className="section-kicker">SIGNAL LEDGER</p><h2>当前年份附近</h2></div><span>{matchingEvents.length} 条匹配</span></header>
                <div className="event-ledger-list">
                  {nearbyEvents.map((event) => (
                    <button key={event.id} type="button" onClick={() => openEvent(event)} className={event.missionId ? "has-mission" : ""}>
                      <span className="ledger-year">{event.year}</span>
                      <span><b>{event.title}</b><small>{placeById.get(event.placeId)?.name} · {categoryMeta[event.category].label}</small></span>
                      {event.missionId ? <em>PLAY</em> : null}
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <section className="map-workbench" aria-label="可拖动缩放的硅谷历史地图">
              <header className="map-toolbar">
                <div><p className="section-kicker">LIVE WORLD MAP</p><h2>{mapLayerLabel(state.currentYear)}</h2></div>
                <div className="map-controls" aria-label="地图控制">
                  <button type="button" onClick={() => zoomMap(-0.2)} aria-label="缩小地图">−</button>
                  <output aria-label="地图缩放比例">{Math.round(mapView.scale * 100)}%</output>
                  <button type="button" onClick={() => zoomMap(0.2)} aria-label="放大地图">+</button>
                  <button type="button" onClick={() => setMapView({ scale: 1, x: 0, y: 0 })}>归位</button>
                </div>
              </header>
              <div className="map-viewport" onPointerDown={onMapPointerDown} onPointerMove={onMapPointerMove} onPointerUp={onMapPointerUp} onPointerCancel={onMapPointerUp} onWheel={onMapWheel}>
                <div className="map-canvas" style={{ transform: `translate3d(${mapView.x}px, ${mapView.y}px, 0) scale(${mapView.scale})` }}>
                  {mapLayers.map((layer, index) => (
                    <Image key={layer.year} src={layer.src} alt="" fill unoptimized priority sizes="(max-width: 900px) 100vw, 76vw" className="era-map-layer" style={{ opacity: mapLayerOpacity(index, state.currentYear) }} draggable={false} />
                  ))}
                  <div className="map-atmosphere" aria-hidden="true"><span>{era.shortTitle}</span><i>{state.currentYear}</i></div>
                  <div className="hotspot-layer">
                    {mapEvents.map((event, index) => {
                      const place = placeById.get(event.placeId);
                      const offsetX = ((index % 3) - 1) * 1.6;
                      const offsetY = ((Math.floor(index / 3) % 3) - 1) * 1.6;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`map-hotspot category-${event.category} ${event.missionId ? "is-mission" : ""} ${place?.portal ? "is-portal" : ""}`}
                          style={{ left: `${event.map.x + offsetX}%`, top: `${event.map.y + offsetY}%` }}
                          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                          onClick={() => openEvent(event)}
                          aria-label={`${event.year} ${event.title}，打开详情`}
                        >
                          <span className="hotspot-core">{event.missionId ? "!" : categoryMeta[event.category].glyph}</span>
                          <span className="hotspot-label"><b>{event.title}</b><small>{event.year} · {place?.name}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="map-legend">
                  <span><i className="legend-dot mission-dot" />可进入战役</span>
                  <span><i className="legend-dot history-dot" />历史节点</span>
                  <span><i className="legend-dot portal-dot" />全球门户</span>
                </div>
                <p className="map-hint">拖动移动 · 滚轮/双指缩放 · 节点随年份建设</p>
              </div>
            </section>

            <section className="timeline-console" aria-label="历史时间轴控制">
              <div className="play-controls">
                <button className="play-button" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "暂停时间轴" : "播放时间轴"}>{playing ? "Ⅱ" : "▶"}</button>
                <div><b>{state.currentYear}</b><small>{playing ? `正在以 ${speed}× 推进` : "时间线已暂停"}</small></div>
              </div>
              <div className="timeline-track">
                <input type="range" min={yearMin} max={yearMax} value={state.currentYear} onChange={(event) => changeYear(Number(event.target.value))} aria-label="选择历史年份" style={{ "--timeline-progress": `${((state.currentYear - yearMin) / (yearMax - yearMin)) * 100}%` } as CSSProperties} />
                <div className="era-ticks">
                  {historyCatalog.eras.map((item) => (
                    <button key={item.id} type="button" className={era.id === item.id ? "is-active" : ""} style={{ left: `${((item.start - yearMin) / (yearMax - yearMin)) * 100}%` }} onClick={() => changeYear(item.start)}>
                      <span>{item.start}</span><small>{item.shortTitle}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="speed-controls"><span>速度</span>{[1, 2, 5].map((value) => <button key={value} type="button" className={speed === value ? "is-active" : ""} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
              <div className="keyboard-hint"><kbd>←</kbd><kbd>→</kbd> 逐年 <kbd>Pg</kbd> 跨 10 年 <kbd>Space</kbd> 播放</div>
            </section>
          </main>
        ) : null}

        {view === "missions" ? <MissionLibrary state={state} onLaunch={launchMission} onJump={(year) => { changeYear(year); setView("world"); }} /> : null}
        {view === "dossier" ? <Dossier state={state} onExport={exportState} onImport={() => importRef.current?.click()} onCheckpoint={createCheckpoint} onRestore={restoreCheckpoint} onReset={resetState} onReplay={(id) => { const mission = missionById.get(id); if (mission) launchMission(mission); }} /> : null}
        {view === "mentor" ? <MentorGuide missions={missions} onLaunch={launchMission} /> : null}
      </div>

      <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importState} aria-label="导入世界线 JSON 档案" />
      {notice ? <div className="toast" role="status">{notice}</div> : null}

      {selectedEvent ? <EventDetail event={selectedEvent} onClose={() => setSelectedEventId(undefined)} onOpenRelated={(id) => { const next = eventById.get(id); if (next) openEvent(next); }} onLaunch={(missionId) => { const mission = missionById.get(missionId); if (mission) launchMission(mission); }} /> : null}
      {activeMission ? <MissionPlayer mission={activeMission} state={state} sources={sourceById} existingResult={state.results.find((item) => item.missionId === activeMission.id)} onChoose={(choice, evidenceIds) => setState((current) => applyChoice(current, activeMission, choice, evidenceIds))} onNotes={(reflection, commitment) => setState((current) => updateMissionNotes(current, activeMission.id, reflection, commitment))} onClose={closeMission} /> : null}
      {showBriefing ? <WorldBriefing onClose={() => setShowBriefing(false)} /> : null}
    </div>
  );
}

function mapLayerLabel(year: number) {
  if (year < 1954) return mapLayers[0].label;
  if (year < 1989) return mapLayers[1].label;
  if (year < 2006) return mapLayers[2].label;
  return mapLayers[3].label;
}

function mapLayerOpacity(index: number, year: number) {
  const anchors = mapLayers.map((item) => item.year);
  if (year <= anchors[0]) return index === 0 ? 1 : 0;
  if (year >= anchors.at(-1)!) return index === anchors.length - 1 ? 1 : 0;
  let lower = 0;
  while (lower < anchors.length - 1 && year > anchors[lower + 1]) lower += 1;
  const upper = Math.min(lower + 1, anchors.length - 1);
  const progress = (year - anchors[lower]) / (anchors[upper] - anchors[lower]);
  if (index === lower) return 1 - progress;
  if (index === upper) return progress;
  return 0;
}

function EventDetail({ event, onClose, onOpenRelated, onLaunch }: { event: HistoryEvent; onClose: () => void; onOpenRelated: (id: string) => void; onLaunch: (id: string) => void }) {
  const place = placeById.get(event.placeId);
  return (
    <Modal title={event.title} eyebrow={`ORIGINAL TIMELINE · ${event.date ?? event.year} · ${place?.name ?? ""}`} onClose={onClose} wide>
      <article className="event-detail">
        <div className="event-detail-hero">
          <span className={`event-glyph category-${event.category}`}>{categoryMeta[event.category].glyph}</span>
          <div><p className="event-summary">{event.summary}</p><div className="event-meta"><span>{categoryMeta[event.category].label}</span><span>{place?.region} · {place?.country}</span><span>{event.certainty === "contested" ? "存在口径争议" : "史料已引用"}</span></div></div>
        </div>
        <section className="why-it-matters"><p className="card-label">WHY IT MATTERS · 历史意义</p><p>{event.significance}</p></section>
        {event.caveat ? <aside className="caveat"><b>史料边界</b><p>{event.caveat}</p></aside> : null}
        <div className="entity-columns">
          <EntityList label="企业 / 机构" values={event.organizationIds.map((id) => orgById.get(id)?.name).filter(Boolean) as string[]} />
          <EntityList label="人物" values={event.personIds.map((id) => personById.get(id)?.name).filter(Boolean) as string[]} />
          <EntityList label="产品 / 技术" values={event.technologyIds.map((id) => techById.get(id)?.name).filter(Boolean) as string[]} />
        </div>
        <section className="source-vault"><header><p className="section-kicker">SOURCE VAULT</p><h3>可核验来源</h3></header>{event.sourceIds.map((id) => { const source = sourceById.get(id); return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer"><span><b>{source.title}</b><small>{source.organization} · {source.kind} · 访问 {source.accessed}</small></span><em>打开 ↗</em></a> : null; })}</section>
        {event.relatedEventIds.length ? <section className="related-events"><p className="card-label">关系线</p>{event.relatedEventIds.map((id) => { const item = eventById.get(id); return item ? <button key={id} type="button" onClick={() => onOpenRelated(id)}><span>{item.year}</span>{item.title}</button> : null; })}</section> : null}
        {event.missionId ? <section className="mission-entry-callout"><div><p className="section-kicker">HISTORICAL RPG AVAILABLE</p><h3>不要只看后见之明。进入当时，做你的判断。</h3><p>平行结果不会改写这张史实卡；它会进入你的学习档案。</p></div><button className="pixel-button pixel-button--primary" type="button" onClick={() => onLaunch(event.missionId!)}>进入关卡 →</button></section> : null}
      </article>
    </Modal>
  );
}

function EntityList({ label, values }: { label: string; values: string[] }) {
  return <section><p className="card-label">{label}</p>{values.length ? <div>{values.map((value) => <span key={value}>{value}</span>)}</div> : <p className="muted">本节点未单列</p>}</section>;
}

function MissionLibrary({ state, onLaunch, onJump }: { state: PlayerState; onLaunch: (mission: MissionRecord) => void; onJump: (year: number) => void }) {
  return (
    <main className="missions-page">
      <header className="page-hero"><div><p className="eyebrow">CAMPAIGN DECK · 8 COMPLETE MISSIONS</p><h1>开放世界是地图，RPG 是身份，<br />历史情境是关卡。</h1><p>每一关都经过“入场 → 调查 → 决策 → 平行反馈 → 史实对照 → 现实任务”，不用猜中历史来判对错。</p></div><div className="completion-seal"><b>{state.results.length}</b><span>/ 8 世界线已冻结</span></div></header>
      <section className="mission-card-grid">
        {missions.map((mission) => {
          const result = state.results.find((item) => item.missionId === mission.id);
          const event = eventById.get(mission.eventId);
          return <article key={mission.id} className={`mission-library-card ${result ? "is-complete" : ""}`}><header><span>{mission.order.toString().padStart(2, "0")}</span><div><p>{mission.year} · {categoryMeta[mission.domain].label}</p><h2>{mission.title}</h2></div>{result ? <em>COMPLETE</em> : <em>OPEN</em>}</header><p>{mission.briefing}</p><div className="mission-card-facts"><span>{mission.durationMinutes} 分钟</span><span>{mission.evidence.length} 条证据</span><span>{mission.choices.length} 条路径</span><span>{mission.realityMission.timeboxMinutes} 分钟现实任务</span></div><div className="mission-card-history"><b>史实键</b><span>{event?.title}</span></div>{result ? <p className="worldline-result"><b>你的世界线：</b>{mission.choices.find((choice) => choice.id === result.choiceId)?.outcomeTitle}</p> : null}<footer><button type="button" className="pixel-button" onClick={() => onJump(mission.year)}>地图定位</button><button type="button" className="pixel-button pixel-button--primary" onClick={() => onLaunch(mission)}>{result ? "重玩并改写" : "进入关卡"} →</button></footer></article>;
        })}
      </section>
    </main>
  );
}

function Dossier({ state, onExport, onImport, onCheckpoint, onRestore, onReset, onReplay }: { state: PlayerState; onExport: () => void; onImport: () => void; onCheckpoint: () => void; onRestore: () => void; onReset: () => void; onReplay: (id: string) => void }) {
  return (
    <main className="dossier-page">
      <header className="page-hero dossier-hero"><div><p className="eyebrow">YOUNG BUILDER DOSSIER · ORIGINAL ≠ PLAYER</p><h1>你没有改写史实。<br />你改写的是自己的能力。</h1><p>这里仅记录玩家世界线、证据与现实行动；史实始终在独立的 Original Timeline 中保持不变。</p></div><div className="dossier-actions"><button className="pixel-button pixel-button--primary" type="button" onClick={onExport}>导出 JSON 档案</button><button className="pixel-button" type="button" onClick={() => window.print()}>打印世界线报告</button></div></header>
      <section className="dossier-summary"><article className="dossier-score"><span>战役完成</span><b>{state.results.length}<small>/8</small></b><p>{state.results.length === 8 ? "全部历史能力已解锁，准备进入 Demo Day。" : `还有 ${8 - state.results.length} 条历史世界线等待参与。`}</p></article><article className="resource-board">{(Object.entries(state.resources) as [ResourceKey, number][]).map(([key, value]) => <div key={key}><header><span>{resourceName(key)}</span><b>{value}/9</b></header><div><i style={{ width: `${(value / 9) * 100}%` }} /></div><small>{resourceDescription(key)}</small></div>)}</article></section>
      <section className="worldline-report"><header><div><p className="section-kicker">PLAYER TIMELINE</p><h2>世界线决策记录</h2></div><span>{state.visitedEventIds.length} 个史实节点已读</span></header>{state.results.length ? <div className="result-stack">{state.results.map((result) => { const mission = missionById.get(result.missionId); const choice = mission?.choices.find((item) => item.id === result.choiceId); return mission && choice ? <article key={result.missionId}><div className="result-index">{mission.order.toString().padStart(2, "0")}</div><div><p>{mission.year} · {mission.title}</p><h3>{choice.outcomeTitle}</h3><p>{choice.outcome}</p><div className="evidence-used">证据：{result.evidenceIds.join(" · ")}</div>{result.reflection ? <blockquote><b>复盘</b>{result.reflection}</blockquote> : <blockquote className="is-empty">尚未写入复盘</blockquote>}{result.realityCommitment ? <blockquote><b>现实行动</b>{result.realityCommitment}</blockquote> : null}</div><button className="pixel-button" type="button" onClick={() => onReplay(result.missionId)}>重玩</button></article> : null; })}</div> : <div className="empty-dossier"><span>000</span><h3>世界线还是空白</h3><p>从任意一个高亮历史节点进入关卡，做出第一个有证据的判断。</p></div>}</section>
      <section className="archive-console"><header><p className="section-kicker">SAVE / RESTORE / HANDOFF</p><h2>档案操作台</h2></header><div className="archive-actions"><button type="button" onClick={onCheckpoint}><b>建立检查点</b><span>手动冻结当前安全状态</span></button><button type="button" onClick={onRestore}><b>恢复检查点</b><span>返回最近一次手动备份</span></button><button type="button" onClick={onImport}><b>导入 JSON</b><span>最大 2 MiB，校验版本与字段</span></button><button type="button" onClick={onExport}><b>导出 JSON</b><span>设备交接或课后留档</span></button><button className="danger-action" type="button" onClick={onReset}><b>重置新世界线</b><span>清空玩家进度，不影响史实库</span></button></div><p className="archive-status">自动保存：{new Date(state.savedAt).toLocaleString("zh-CN")} · Schema v{state.schemaVersion} · 本地浏览器存储</p></section>
    </main>
  );
}

function WorldBriefing({ onClose }: { onClose: () => void }) {
  return <Modal title="世界线已断裂。你们要重新学会如何建造。" eyebrow="YOUNG BUILDER · FIELD BRIEFING" onClose={onClose} wide><div className="briefing-grid"><article><span>01</span><h3>滑动时间</h3><p>拖动 1891—2026 时间轴。地图会从果园、车库、芯片厂、互联网园区建设到 AI 时代。</p></article><article><span>02</span><h3>调查史实</h3><p>点击地图节点，阅读事件、企业、人物、技术、历史意义和可打开来源。</p></article><article><span>03</span><h3>进入关卡</h3><p>在 8 个高亮节点里作为历史团队成员调查、判断；系统按约束生成平行反馈。</p></article><article><span>04</span><h3>带回现实</h3><p>对照真实历史，把能力变成现实交付物，记入学习档案并最终走向 Demo Day。</p></article></div><div className="timeline-layers-explainer"><div><b>ORIGINAL TIMELINE</b><span>不可改写的史实底座</span></div><i>≠</i><div><b>PLAYER TIMELINE</b><span>你的选择与平行反馈</span></div><i>→</i><div><b>CURRENT MISSION</b><span>回到现实完成真实任务</span></div></div><footer className="briefing-footer"><p>导师是 DM：主持信息边界、追问证据与复盘，不替玩家做判断。</p><button className="pixel-button pixel-button--primary" type="button" onClick={onClose}>进入迷你硅谷 →</button></footer></Modal>;
}

function resourceName(key: ResourceKey) { return ({ evidence: "证据密度", trust: "团队信任", runway: "行动窗口", craft: "建造能力" } as Record<ResourceKey, string>)[key]; }
function resourceDescription(key: ResourceKey) { return ({ evidence: "判断中真正使用的可核验信息", trust: "角色之间交换信息与承诺的能力", runway: "在时间、现金和机会窗口内行动", craft: "把想法变成可测试、可交付事物" } as Record<ResourceKey, string>)[key]; }
