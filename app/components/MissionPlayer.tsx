"use client";

import { useMemo, useState } from "react";
import type {
  MissionChoice,
  MissionRecord,
  MissionResult,
  PlayerState,
  SourceRecord,
} from "../lib/model";
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
  const choice = mission.choices.find((item) => item.id === choiceId);
  const selectedIndex = steps.findIndex(({ id }) => id === step);
  const resources = state.resources;
  const accessibleIndex = choiceId ? steps.length - 1 : step === "decide" ? 2 : selectedIndex;

  const missingEvidence = useMemo(() => {
    if (!choice?.requiresEvidenceIds) return [];
    return choice.requiresEvidenceIds.filter((id) => !evidenceIds.includes(id));
  }, [choice, evidenceIds]);
  const evidenceSourceIds = useMemo(
    () => [...new Set(mission.evidence.flatMap((item) => item.sourceIds))],
    [mission.evidence],
  );

  function toggleEvidence(id: string) {
    setEvidenceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function makeChoice(selected: MissionChoice) {
    const required = selected.requiresEvidenceIds ?? [];
    if (required.some((id) => !evidenceIds.includes(id))) return;
    setChoiceId(selected.id);
    onChoose(selected, evidenceIds);
    setStep("result");
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
      <div className="mission-shell">
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
            <p className="scene-lead">点击卡片收入团队证据夹。证据卡是依史料制作的教学压缩，不是历史人物原话；来源在决策后解锁，避免用后见之明作答。</p>
            <div className="evidence-grid">
              {mission.evidence.map((evidence) => {
                const active = evidenceIds.includes(evidence.id);
                return (
                  <article key={evidence.id} className={`evidence-card ${active ? "is-selected" : ""}`}>
                    <button type="button" aria-pressed={active} onClick={() => toggleEvidence(evidence.id)}>
                      <span className="evidence-label">{evidence.label}</span>
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
              <p>已选 <b>{evidenceIds.length}</b> / {mission.evidence.length} 条。不需要收集全部，但你必须能说明为什么依赖它们。</p>
              <button className="pixel-button pixel-button--primary" type="button" disabled={evidenceIds.length < 2} onClick={() => setStep("decide")}>
                {evidenceIds.length < 2 ? "至少选择 2 条证据" : "进入决策 →"}
              </button>
            </footer>
          </section>
        ) : null}

        {step === "decide" ? (
          <section className="mission-scene">
            <p className="section-kicker">PLAYER TIMELINE · 你们现在要写下自己的历史</p>
            <h3>{mission.decisionPrompt}</h3>
            <div className="choice-list">
              {mission.choices.map((item, index) => {
                const missing = (item.requiresEvidenceIds ?? []).filter((id) => !evidenceIds.includes(id));
                return (
                  <article key={item.id} className="choice-card">
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
                      {missing.length ? <p className="choice-lock">还需阅读：{missing.join(" / ")}</p> : null}
                    </div>
                    <button className="pixel-button" type="button" disabled={missing.length > 0} onClick={() => makeChoice(item)}>
                      采用此行动
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

        {step === "decide" && choice && missingEvidence.length ? (
          <p className="sr-only" aria-live="polite">所选路径还需 {missingEvidence.length} 条证据。</p>
        ) : null}
      </div>
    </Modal>
  );
}

function resourceLabel(key: string) {
  return ({ evidence: "证据", trust: "信任", runway: "窗口", craft: "建造" } as Record<string, string>)[key] ?? key;
}
