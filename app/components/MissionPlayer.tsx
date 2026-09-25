"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MissionChoice,
  MissionRecord,
  MissionResult,
  PlayerState,
  SourceRecord,
} from "../lib/model";
import {
  countUnlockedChoices,
  evidenceTitles,
  missingEvidenceIds,
} from "../lib/mission-progress";
import { Modal } from "./Modal";

type MissionStep = "enter" | "investigate" | "decide" | "result" | "history" | "reflect";

const steps: { id: MissionStep; label: string; loop: string }[] = [
  { id: "enter", label: "01 入场", loop: "学习" },
  { id: "investigate", label: "02 调查", loop: "练习" },
  { id: "decide", label: "03 决策", loop: "实操" },
  { id: "result", label: "04 世界线", loop: "反馈" },
  { id: "history", label: "05 对照", loop: "反思" },
  { id: "reflect", label: "06 带回现实", loop: "再实践" },
];

interface MissionPlayerProps {
  mission: MissionRecord;
  state: PlayerState;
  sources: Map<string, SourceRecord>;
  existingResult?: MissionResult;
  onChoose: (choice: MissionChoice, evidenceIds: string[]) => void;
  onNotes: (reflection: string, commitment: string) => void;
  onClose: () => void;
}

export function MissionPlayer({
  mission,
  state,
  sources,
  existingResult,
  onChoose,
  onNotes,
  onClose,
}: MissionPlayerProps) {
  const [step, setStep] = useState<MissionStep>("enter");
  const [evidenceIds, setEvidenceIds] = useState<string[]>(existingResult?.evidenceIds ?? []);
  const [choiceId, setChoiceId] = useState(existingResult?.choiceId ?? "");
  const [reflection, setReflection] = useState(existingResult?.reflection ?? "");
  const [commitment, setCommitment] = useState(existingResult?.realityCommitment ?? "");
  const [requestedEvidenceIds, setRequestedEvidenceIds] = useState<string[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);
  const choice = mission.choices.find((item) => item.id === choiceId);
  const selectedIndex = steps.findIndex(({ id }) => id === step);
  const resources = state.resources;
  const accessibleIndex = choiceId ? steps.length - 1 : step === "decide" ? 2 : selectedIndex;

  const evidenceSourceIds = useMemo(
    () => [...new Set(mission.evidence.flatMap((item) => item.sourceIds))],
    [mission.evidence],
  );
  const unlockedChoiceCount = useMemo(
    () => countUnlockedChoices(mission.choices, evidenceIds),
    [evidenceIds, mission.choices],
  );
  const selectedEvidenceTitles = useMemo(
    () => evidenceTitles(mission.evidence, evidenceIds),
    [evidenceIds, mission.evidence],
  );
  const requestedEvidence = useMemo(
    () => mission.evidence.filter((item) => requestedEvidenceIds.includes(item.id) && !evidenceIds.includes(item.id)),
    [evidenceIds, mission.evidence, requestedEvidenceIds],
  );

  useEffect(() => {
    const modalBody = shellRef.current?.closest(".modal-body");
    if (modalBody instanceof HTMLElement) modalBody.scrollTop = 0;
  }, [step]);

  function toggleEvidence(id: string) {
    setEvidenceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function makeChoice(selected: MissionChoice) {
    if (missingEvidenceIds(selected, evidenceIds).length) return;
    setChoiceId(selected.id);
    onChoose(selected, evidenceIds);
    setStep("result");
  }

  function returnToEvidence(ids: string[] = []) {
    setRequestedEvidenceIds([...new Set(ids)]);
    setStep("investigate");
  }

  function saveNotes() {
    onNotes(reflection.trim(), commitment.trim());
  }

  return (
    <Modal
      title={`${mission.order.toString().padStart(2, "0")} · ${mission.title}`}
      eyebrow={`${mission.year} · ${mission.subtitle} · ${mission.durationMinutes} 分钟`}
      onClose={onClose}
      wide
      className="mission-modal"
    >
      <div ref={shellRef} className="mission-shell">
        <nav className="mission-steps" aria-label="关卡进度">
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={step === item.id ? "is-active" : index < selectedIndex ? "is-done" : ""}
              disabled={index > accessibleIndex && !choiceId}
              onClick={() => setStep(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.loop}</small>
            </button>
          ))}
        </nav>

        <div className="mission-resource-strip" aria-label="团队资源">
          {Object.entries(resources).map(([key, value]) => (
            <div key={key}>
              <span>{resourceLabel(key)}</span>
              <b>{value}/9</b>
            </div>
          ))}
          <div className="mission-status-chip">
            {existingResult ? "已有世界线 · 重玩将覆盖" : "世界线未冻结"}
          </div>
        </div>

        {step === "enter" ? (
          <section className="mission-scene" aria-labelledby="mission-scene-title">
            <p className="section-kicker">ORIGINAL TIMELINE · 历史信息边界</p>
            <h3 id="mission-scene-title">{mission.briefing}</h3>
            <p className="scene-lead">{mission.situation}</p>
            <div className="mission-two-column">
              <article className="paper-card">
                <p className="card-label">你的身份</p>
                <h4>{mission.role.name}</h4>
                <p>{mission.role.goal}</p>
                <div className="private-brief">
                  <b>仅你的团队可见</b>
                  <p>{mission.role.privateBrief}</p>
                </div>
              </article>
              <article className="paper-card">
                <p className="card-label">此刻已知 / 未知</p>
                <ul className="boundary-list">
                  {mission.historicalBoundary.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            </div>
            <div className="role-roster" aria-label="建议团队角色">
              {mission.role.teamRoles.map((role) => <span key={role}>{role}</span>)}
            </div>
            <footer className="mission-actions">
              <p>判断标准：证据质量、对情境的理解与可解释性，不是“猜中历史”。</p>
              <button className="pixel-button pixel-button--primary" type="button" onClick={() => setStep("investigate")}>
                进入调查 →
              </button>
            </footer>
          </section>
        ) : null}

        {step === "investigate" ? (
          <section className="mission-scene">
            <p className="section-kicker">EVIDENCE DESK · 证据不会自动得出结论</p>
            <h3>选择你们真正用于判断的证据</h3>
            <p className="scene-lead">读完后点击卡片上的「收入证据夹」。只有收入的卡片才会成为本轮判断依据；证据卡是依史料制作的教学压缩，来源会在历史对照阶段解锁。</p>
            {requestedEvidenceIds.length ? (
              <aside className={`evidence-coach ${requestedEvidence.length ? "" : "is-ready"}`} aria-live="polite">
                <div>
                  <span>现在做什么</span>
                  <h4>{requestedEvidence.length ? `补齐这 ${requestedEvidence.length} 条证据` : "补证完成，可以返回决策"}</h4>
                  <p>{requestedEvidence.length ? "阅读下方黄色高亮卡片，并点击「收入证据夹」。" : "你刚才选择的行动已经满足证据条件。"}</p>
                </div>
                {requestedEvidence.length ? (
                  <ul>{requestedEvidence.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
                ) : <strong>✓ 证据条件已满足</strong>}
              </aside>
            ) : null}
            <div className="evidence-grid">
              {mission.evidence.map((evidence) => {
                const active = evidenceIds.includes(evidence.id);
                const requested = requestedEvidenceIds.includes(evidence.id) && !active;
                return (
                  <article key={evidence.id} className={`evidence-card ${active ? "is-selected" : ""} ${requested ? "is-recommended" : ""}`}>
                    <button type="button" aria-pressed={active} onClick={() => toggleEvidence(evidence.id)}>
                      <div className="evidence-label-row">
                        <span className="evidence-label">{evidence.label}</span>
                        {requested ? <span className="evidence-needed">本次补证目标</span> : null}
                      </div>
                      <h4>{evidence.title}</h4>
                      <p>{evidence.body}</p>
                      <div className="evidence-tension"><b>张力：</b>{evidence.tension}</div>
                      <span className="evidence-action">{active ? "已收入证据夹 ✓" : "收入证据夹 +"}</span>
                    </button>
                    <div className="source-mini-list">
                      <span>史料来源已封存 · 历史对照阶段解锁</span>
                    </div>
                  </article>
                );
              })}
            </div>
            <footer className="mission-actions">
              <p>已收入 <b>{evidenceIds.length}</b> / {mission.evidence.length} 条；当前组合解锁 <b>{unlockedChoiceCount}</b> / {mission.choices.length} 个行动。不必全选，可以先看方案，再为想走的方向补证。</p>
              <button className="pixel-button pixel-button--primary" type="button" disabled={evidenceIds.length < 2} onClick={() => setStep("decide")}>
                {evidenceIds.length < 2
                  ? "至少收入 2 条证据"
                  : unlockedChoiceCount
                    ? `进入决策（${unlockedChoiceCount} 个行动可用）→`
                    : "查看方案，选择补证方向 →"}
              </button>
            </footer>
          </section>
        ) : null}

        {step === "decide" ? (
          <section className="mission-scene">
            <p className="section-kicker">PLAYER TIMELINE · 你们现在要写下自己的历史</p>
            <h3>{mission.decisionPrompt}</h3>
            <aside className={`decision-guide ${unlockedChoiceCount ? "" : "is-blocked"}`}>
              <div aria-live="polite">
                <span>现在做什么</span>
                <h4>{unlockedChoiceCount ? `${unlockedChoiceCount} 个行动已经可以采用` : "先选一个方向，再补齐它需要的证据"}</h4>
                <p>{unlockedChoiceCount
                  ? "点击可用方案右侧的「采用此行动」。你也可以继续补证，比较更多路线。"
                  : "灰色方案不是故障。查看每条路线缺少什么，再点击「去补读」；返回调查后，目标证据会用黄色高亮。"}</p>
              </div>
              <button className="pixel-button" type="button" onClick={() => returnToEvidence()}>
                返回调查查看全部证据
              </button>
              <div className="decision-evidence-summary">
                <b>本轮已收入</b>
                {selectedEvidenceTitles.map((title) => <span key={title}>{title}</span>)}
              </div>
            </aside>
            <div className="choice-list">
              {mission.choices.map((item, index) => {
                const missing = missingEvidenceIds(item, evidenceIds);
                const missingTitles = evidenceTitles(mission.evidence, missing);
                return (
                  <article key={item.id} className={`choice-card ${missing.length ? "is-locked" : "is-ready"}`}>
                    <div className="choice-number">{String.fromCharCode(65 + index)}</div>
                    <div>
                      <h4>{item.label}</h4>
                      <p>{item.action}</p>
                      <small>{item.rationale}</small>
                      <div className="delta-list">
                        {Object.entries(item.delta).map(([key, value]) => (
                          <span key={key} className={(value ?? 0) >= 0 ? "is-positive" : "is-negative"}>
                            {resourceLabel(key)} {(value ?? 0) > 0 ? "+" : ""}{value}
                          </span>
                        ))}
                      </div>
                      {missing.length ? (
                        <div className="choice-lock">
                          <b>尚未解锁 · 缺 {missing.length} 条证据</b>
                          <span>{missingTitles.join("；")}</span>
                        </div>
                      ) : <p className="choice-ready">✓ 证据条件已满足，可以行动</p>}
                    </div>
                    <button
                      className={`pixel-button ${missing.length ? "choice-research-button" : "pixel-button--primary"}`}
                      type="button"
                      onClick={() => missing.length ? returnToEvidence(missing) : makeChoice(item)}
                    >
                      {missing.length ? `去补读 ${missing.length} 条证据 →` : "采用此行动 →"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === "result" && choice ? (
          <section className="mission-scene outcome-scene">
            <p className="section-kicker">PARALLEL WORLD · 规则化模拟，不是史实</p>
            <div className="worldline-stamp">世界线 {mission.order}-{choice.id.toUpperCase()}</div>
            <h3>{choice.outcomeTitle}</h3>
            <p className="outcome-copy">{choice.outcome}</p>
            <div className="consequence-box">
              <p className="card-label">约束推演</p>
              <p>{choice.consequence}</p>
            </div>
            <div className="capability-unlock">
              <span>解锁能力</span>
              <strong>{choice.capability}</strong>
            </div>
            <footer className="mission-actions">
              <p>这个结果由你的选择、证据和资源变化生成；它不会被写回真实历史。</p>
              <button className="pixel-button pixel-button--primary" type="button" onClick={() => setStep("history")}>
                打开真实历史对照 →
              </button>
            </footer>
          </section>
        ) : null}

        {step === "history" ? (
          <section className="mission-scene">
            <p className="section-kicker">HISTORICAL COMPARISON · 不判对错，找差异</p>
            <h3>{mission.history.title}</h3>
            <div className="history-comparison">
              <article>
                <p className="card-label">玩家世界线</p>
                <h4>{choice?.outcomeTitle ?? "尚未冻结"}</h4>
                <p>{choice?.outcome ?? "返回决策环节创建你的世界线。"}</p>
              </article>
              <article>
                <p className="card-label">原始历史线</p>
                <h4>可核验的史实摘要</h4>
                <p>{mission.history.happened}</p>
                <div className="source-links">
                  {[...new Set([...mission.history.sourceIds, ...evidenceSourceIds])].map((id) => {
                    const source = sources.get(id);
                    return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.organization} · {source.title} ↗</a> : null;
                  })}
                </div>
              </article>
            </div>
            <div className="comparison-prompts">
              {mission.history.comparisonPrompts.map((prompt, index) => (
                <p key={prompt}><b>0{index + 1}</b>{prompt}</p>
              ))}
            </div>
            <footer className="mission-actions">
              <p>你们要提炼的是可迁移的判断模式，不是把历史答案背下来。</p>
              <button className="pixel-button pixel-button--primary" type="button" onClick={() => setStep("reflect")}>
                把能力带回现实 →
              </button>
            </footer>
          </section>
        ) : null}

        {step === "reflect" ? (
          <section className="mission-scene">
            <p className="section-kicker">CURRENT MISSION · 再实践</p>
            <h3>{mission.realityMission.title}</h3>
            <p className="scene-lead">{mission.realityMission.deliverable}</p>
            <div className="reality-grid">
              <article className="paper-card">
                <p className="card-label">{mission.realityMission.timeboxMinutes} 分钟验收</p>
                <ul className="boundary-list">
                  {mission.realityMission.acceptance.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
              <article className="paper-card">
                <p className="card-label">团队复盘</p>
                <ol className="reflection-list">
                  {mission.reflection.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </article>
            </div>
            <label className="field-label">
              我们现在更懂什么？
              <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={900} placeholder="用证据和选择解释，不要只写“学到了很多”。" />
            </label>
            <label className="field-label">
              下一次现实行动
              <textarea value={commitment} onChange={(event) => setCommitment(event.target.value)} maxLength={600} placeholder="写下谁在什么时间前交付什么可观察证据。" />
            </label>
            <footer className="mission-actions">
              <p>记录会进入学习档案，供导师复盘与 Demo Day 使用。</p>
              <button className="pixel-button pixel-button--primary" type="button" disabled={!reflection.trim() || !commitment.trim()} onClick={() => { saveNotes(); onClose(); }}>
                冻结本关世界线
              </button>
            </footer>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function resourceLabel(key: string) {
  return ({ evidence: "证据", trust: "信任", runway: "窗口", craft: "建造" } as Record<string, string>)[key] ?? key;
}
