"use client";

import { useState } from "react";
import { curriculumCatalog } from "../data/curriculum";
import { historyCatalog } from "../data/history";
import { missions } from "../data/missions";
import type {
  CompanyJourneyStep,
  CurriculumExample,
  CurriculumStage,
  ProjectStageId,
} from "../lib/model";

type CurriculumAxis = "stages" | "journeys";

const eventById = new Map(historyCatalog.events.map((event) => [event.id, event]));
const sourceById = new Map(historyCatalog.sources.map((source) => [source.id, source]));
const missionById = new Map(missions.map((mission) => [mission.id, mission]));

interface CurriculumOutlineProps {
  onOpenEvent: (eventId: string) => void;
  onLaunchMission: (missionId: string) => void;
}

export function CurriculumOutline({ onOpenEvent, onLaunchMission }: CurriculumOutlineProps) {
  const [axis, setAxis] = useState<CurriculumAxis>("stages");
  const [activeStageId, setActiveStageId] = useState<ProjectStageId>(curriculumCatalog.stages[0].id);
  const activeStage = curriculumCatalog.stages.find(({ id }) => id === activeStageId) ?? curriculumCatalog.stages[0];

  return (
    <main className="curriculum-page">
      <header className="curriculum-hero">
        <div>
          <p className="eyebrow">PROJECT 0→1 · CURRICULUM ATLAS</p>
          <h1>历史让我们温故，<br />项目让我们从零建起。</h1>
          <p>历史世界回答“科技如何从 1 走向更多可能”；这份课程大纲回答“一个真实项目怎样从 0 走到发布”。两条轴共用同一套可核验史实，但承担不同教学任务。</p>
        </div>
        <aside className="curriculum-coordinate" aria-label="课程双轴定位">
          <div><span>1 → ∞</span><b>历史世界</b><small>按时代、企业与事件温故</small></div>
          <i aria-hidden="true">×</i>
          <div><span>0 → 1</span><b>项目主线</b><small>五步闭环＋六分钟终局</small></div>
        </aside>
      </header>

      <section className="curriculum-axis-console" aria-labelledby="curriculum-axis-title">
        <div className="axis-console-copy">
          <p className="section-kicker">TWO-WAY INDEX · 同一内容，两种组织方式</p>
          <h2 id="curriculum-axis-title">既能纵切能力，也能横看公司。</h2>
        </div>
        <div className="curriculum-axis-tabs" role="tablist" aria-label="选择课程目录组织方式">
          <button
            type="button"
            role="tab"
            id="curriculum-axis-stages-tab"
            aria-selected={axis === "stages"}
            aria-controls="curriculum-stages-panel"
            className={axis === "stages" ? "is-active" : ""}
            onClick={() => setAxis("stages")}
          >
            <span>纵向五步</span>
            <small>按阶段纵切 · 跨企业归集</small>
          </button>
          <button
            type="button"
            role="tab"
            id="curriculum-axis-journeys-tab"
            aria-selected={axis === "journeys"}
            aria-controls="curriculum-journeys-panel"
            className={axis === "journeys" ? "is-active" : ""}
            onClick={() => setAxis("journeys")}
          >
            <span>企业全流程</span>
            <small>按项目横看 · 五步完整闭环</small>
          </button>
        </div>
      </section>

      <section id="curriculum-stages-panel" role="tabpanel" className="curriculum-axis-panel" aria-labelledby="curriculum-axis-stages-tab" hidden={axis !== "stages"}>
          <header className="curriculum-panel-heading">
            <div><p className="section-kicker">VERTICAL SLICES · 按阶段纵切</p><h2>五步项目主线</h2></div>
            <p>选择一个阶段，集中查看这一能力的目标、行动、交付物、完成门槛，以及跨企业历史案例。</p>
          </header>

          <div className="curriculum-stage-layout">
            <div className="curriculum-stage-rail" role="tablist" aria-orientation="vertical" aria-label="五步项目阶段">
              {curriculumCatalog.stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  id={`stage-tab-${stage.id}`}
                  aria-selected={activeStage.id === stage.id}
                  aria-controls="curriculum-stage-detail"
                  className={activeStage.id === stage.id ? "is-active" : ""}
                  onClick={() => setActiveStageId(stage.id)}
                >
                  <span>{stage.order.toString().padStart(2, "0")}</span>
                  <span><b>{stage.title}</b><small>{stage.englishTitle}</small></span>
                  <i aria-hidden="true">→</i>
                </button>
              ))}
            </div>

            <StagePanel stage={activeStage} onOpenEvent={onOpenEvent} onLaunchMission={onLaunchMission} />
          </div>
          <FinalePanel />
        </section>
      <section id="curriculum-journeys-panel" role="tabpanel" className="curriculum-axis-panel" aria-labelledby="curriculum-axis-journeys-tab" hidden={axis !== "journeys"}>
          <header className="curriculum-panel-heading">
            <div><p className="section-kicker">HORIZONTAL JOURNEYS · 按项目横看</p><h2>企业五步全流程</h2></div>
            <p>一条横线追踪同一产品如何穿过五个学习步骤；六分钟 Demo Day 单列为终局。首条完整样例使用 Google 搜索。</p>
          </header>
          {curriculumCatalog.companyJourneys.map((journey) => (
            <article key={journey.id} className="company-journey">
              <header className="company-journey-header">
                <div className="journey-monogram" aria-hidden="true">G</div>
                <div><p>{journey.organization} · {journey.product} · {journey.period}</p><h3>{journey.title}</h3><span>{journey.summary}</span></div>
                {journey.missionId ? <button type="button" className="pixel-button pixel-button--primary" onClick={() => onLaunchMission(journey.missionId!)}>进入历史战役 →</button> : null}
              </header>
              <div className="company-journey-track" aria-label={`${journey.organization} 五步全流程`}>
                {journey.steps.map((step, index) => (
                  <JourneyStepCard key={step.stageId} step={step} index={index} onOpenEvent={onOpenEvent} />
                ))}
              </div>
              <section className="journey-finale"><span>FINALE · 06:00</span><h4>{journey.finale.title}</h4><p>{journey.finale.teachingUse}</p></section>
              <footer className="journey-boundary"><b>史实边界</b><span>卡片中的事件事实来自 Original Timeline；“课程映射”只说明如何用于教学，不宣称企业当年使用了这套五步术语或举行了课程式 Demo Day。</span></footer>
            </article>
          ))}
        </section>

      <ContributionProtocol />
    </main>
  );
}

function StagePanel({ stage, onOpenEvent, onLaunchMission }: { stage: CurriculumStage; onOpenEvent: (eventId: string) => void; onLaunchMission: (missionId: string) => void }) {
  return (
    <article id="curriculum-stage-detail" role="tabpanel" aria-labelledby={`stage-tab-${stage.id}`} className={`curriculum-stage-panel stage-tone-${stage.order}`}>
      <header className="stage-panel-header">
        <div className="stage-number"><span>STEP</span><b>{stage.order.toString().padStart(2, "0")}</b></div>
        <div><p>{stage.englishTitle}</p><h3>{stage.title}</h3><span>{stage.promise}</span><small>主导师 {stage.leadMentor} · 协作 {stage.supportMentors.join("＋") || "全体"}</small></div>
      </header>

      <blockquote className="stage-core-question"><span>本步唯一核心问题</span><p>{stage.coreQuestion}</p></blockquote>

      <div className="stage-contract-grid">
        <StageList label="学会什么" eyebrow="LEARNING GOALS" items={stage.learningGoals} />
        <StageList label="学生做什么" eyebrow="PLAYER ACTIONS" items={stage.actions} />
        <StageList label="留下什么" eyebrow="ARTIFACTS" items={stage.artifacts} />
        <StageList label="何时算完成" eyebrow="COMPLETION GATE" items={stage.completionGate} emphasized />
      </div>

      <section className="curriculum-example-section">
        <header><div><p className="section-kicker">HISTORY AS MATERIAL · 跨企业归集</p><h4>用历史案例练这一刀</h4></div><span>{stage.examples.length} 个已归集案例</span></header>
        <div className="curriculum-example-grid">
          {stage.examples.map((example) => (
            <ExampleCard key={example.id} example={example} onOpenEvent={onOpenEvent} onLaunchMission={onLaunchMission} />
          ))}
        </div>
      </section>
    </article>
  );
}

function FinalePanel() {
  const finale = curriculumCatalog.finale;
  return <aside className="curriculum-finale" aria-labelledby="curriculum-finale-title">
    <div><span>FINALE · 06:00</span><h3 id="curriculum-finale-title">{finale.title}</h3><p>{finale.promise}</p></div>
    <ol>{finale.requirements.map((requirement, index) => <li key={requirement}><b>{String(index + 1).padStart(2, "0")}</b>{requirement}</li>)}</ol>
  </aside>;
}

function StageList({ label, eyebrow, items, emphasized = false }: { label: string; eyebrow: string; items: string[]; emphasized?: boolean }) {
  return (
    <section className={`stage-contract-card ${emphasized ? "is-gate" : ""}`}>
      <p>{eyebrow}</p>
      <h4>{label}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function ExampleCard({ example, onOpenEvent, onLaunchMission }: { example: CurriculumExample; onOpenEvent: (eventId: string) => void; onLaunchMission: (missionId: string) => void }) {
  const events = example.eventIds.map((id) => eventById.get(id)).filter((event) => event !== undefined);
  const sourceCount = new Set(events.flatMap((event) => event.sourceIds)).size;
  const mission = example.missionId ? missionById.get(example.missionId) : undefined;

  return (
    <article className="curriculum-example-card">
      <header>
        <div><span>{example.organization}</span><small>{example.yearLabel}</small></div>
        <em className={example.mappingKind === "direct" ? "is-direct" : "is-analogy"}>{example.mappingKind === "direct" ? "直接案例" : "课程映射"}</em>
      </header>
      <h5>{example.label}</h5>
      <p>{example.teachingUse}</p>
      <div className="example-fact-stack">
        {events.map((event) => (
          <div key={event.id}><b>{event.year} · {event.title}</b><span>{event.summary}</span></div>
        ))}
      </div>
      <div className="example-source-count">{events.length} 个史实节点 · {sourceCount} 条可核验来源</div>
      <footer>
        {events.map((event) => <button key={event.id} type="button" onClick={() => onOpenEvent(event.id)}>查看原始史实 · {event.year}</button>)}
        {mission ? <button type="button" className="is-mission" onClick={() => onLaunchMission(mission.id)}>进入历史战役 · {mission.order.toString().padStart(2, "0")}</button> : null}
      </footer>
    </article>
  );
}

function JourneyStepCard({ step, index, onOpenEvent }: { step: CompanyJourneyStep; index: number; onOpenEvent: (eventId: string) => void }) {
  const stage = curriculumCatalog.stages.find(({ id }) => id === step.stageId)!;
  const events = step.eventIds.map((id) => eventById.get(id)).filter((event) => event !== undefined);
  const sources = new Set(events.flatMap((event) => event.sourceIds.map((id) => sourceById.get(id)?.organization).filter(Boolean)));

  return (
    <section className={`journey-step-card stage-tone-${index + 1}`}>
      <header><span>{stage.order.toString().padStart(2, "0")}</span><div><small>{stage.englishTitle}</small><b>{stage.title}</b></div></header>
      <p className="journey-period">{step.period}</p>
      <h4>{step.title}</h4>
      <div className="journey-facts">
        {events.map((event) => <button key={event.id} type="button" onClick={() => onOpenEvent(event.id)}><b>{event.year} · {event.title}</b><span>{event.summary}</span><em>打开史实 →</em></button>)}
      </div>
      <div className="journey-teaching"><span>{step.mappingKind === "direct" ? "直接案例" : "课程映射"}</span><p>{step.teachingUse}</p></div>
      <footer>{events.length} 节点 · {sources.size} 来源机构</footer>
    </section>
  );
}

function ContributionProtocol() {
  return (
    <section className="curriculum-contribution" aria-labelledby="contribution-title">
      <header>
        <div><p className="section-kicker">EDITORIAL CONTRACT · 给内容同事</p><h2 id="contribution-title">内容归集协议</h2></div>
        <p>新增案例不是“丢一篇文章进来”。请把每条内容加工成可定位、可教学、可验收的课程单元。</p>
      </header>
      <div className="contribution-fields">
        {curriculumCatalog.contributionProtocol.map((field, index) => (
          <article key={field.key}><span>{(index + 1).toString().padStart(2, "0")}</span><div><p>{field.key}</p><h3>{field.label}</h3><small>{field.requirement}</small></div></article>
        ))}
      </div>
      <aside className="curriculum-nonnegotiables">
        <p>NON-NEGOTIABLES · 不可妥协</p>
        <ol>{curriculumCatalog.nonNegotiables.map((rule) => <li key={rule}>{rule}</li>)}</ol>
      </aside>
    </section>
  );
}
