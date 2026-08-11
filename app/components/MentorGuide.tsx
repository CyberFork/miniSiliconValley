"use client";

import type { MissionRecord } from "../lib/model";

interface MentorGuideProps {
  missions: MissionRecord[];
  onLaunch: (mission: MissionRecord) => void;
}

export function MentorGuide({ missions, onLaunch }: MentorGuideProps) {
  return (
    <main className="guide-page" id="mentor-guide">
      <header className="guide-hero">
        <div>
          <p className="eyebrow">DM FIELD MANUAL · v1.0</p>
          <h1>导师不是答案机。<br />导师是世界线主持人。</h1>
          <p>你要维护信息边界、追问证据、执行规则并帮学员把历史经验带回现实；不需要替他们选“正确答案”。</p>
        </div>
        <div className="guide-hero-actions">
          <button className="pixel-button pixel-button--primary" type="button" onClick={() => window.print()}>
            打印 / 导出 PDF
          </button>
          <a className="pixel-button" href="#runbook">跳到逐分钟流程</a>
        </div>
      </header>

      <section className="guide-status-grid" aria-label="开本前检查">
        <article><span>01</span><b>设备</b><p>一台可投屏电脑，每队至少一台可交互设备。</p></article>
        <article><span>02</span><b>分队</b><p>4–6 人/队；让产品、证据、建造、体验与表达角色都有人承担。</p></article>
        <article><span>03</span><b>安全</b><p>不采集不必要的未成年人信息；公开发布需事先授权。</p></article>
        <article><span>04</span><b>备份</b><p>开始前在“学习档案”建立检查点，记住无网也能继续。</p></article>
      </section>

      <section className="guide-section" id="runbook">
        <div className="guide-section-heading">
          <p className="section-kicker">RUNBOOK</p>
          <h2>两套可直接执行的时间表</h2>
        </div>
        <div className="runbook-grid">
          <article className="runbook-card">
            <div className="runbook-title"><span>15′</span><h3>快速演示</h3></div>
            <ol>
              <li><b>0–2′</b><span>说明四层：原始历史、玩家世界线、史实对照、现实任务。</span></li>
              <li><b>2–5′</b><span>拖动年份，对照 1939 / 1968 / 1998 / 2026 地图建设变化。</span></li>
              <li><b>5–10′</b><span>打开“车库第一单”，选 2 条证据、做 1 次团队判断。</span></li>
              <li><b>10–13′</b><span>阅读平行结果与真实历史对照，追问“你们依赖了什么？”</span></li>
              <li><b>13–15′</b><span>展示档案导出，说明能力如何进入真实项目。</span></li>
            </ol>
            <button className="pixel-button pixel-button--primary" type="button" onClick={() => missions[0] && onLaunch(missions[0])}>
              启动快速演示关
            </button>
          </article>
          <article className="runbook-card">
            <div className="runbook-title"><span>90′</span><h3>完整课堂</h3></div>
            <ol>
              <li><b>0–10′</b><span>世界进入、角色分配、规则与史实/模拟边界。</span></li>
              <li><b>10–25′</b><span>地图探索与知识胶囊；每队用一句话描述当时约束。</span></li>
              <li><b>25–40′</b><span>分发角色、个人阅读证据、组内交换信息。</span></li>
              <li><b>40–55′</b><span>团队形成判断；导师只问证据和假设，不公布真实历史。</span></li>
              <li><b>55–65′</b><span>系统生成平行世界线，学员说明预期与意外。</span></li>
              <li><b>65–75′</b><span>公布可核验史实，做差异复盘；不用“答对/答错”语言。</span></li>
              <li><b>75–87′</b><span>完成现实时盒任务，交付可观察证据。</span></li>
              <li><b>87–90′</b><span>冻结档案、建检查点、宣布下一次现实行动。</span></li>
            </ol>
            <button className="pixel-button" type="button" onClick={() => missions[1] && onLaunch(missions[1])}>
              启动半导体完整关
            </button>
          </article>
        </div>
      </section>

      <section className="guide-section">
        <div className="guide-section-heading">
          <p className="section-kicker">DM PROTOCOL</p>
          <h2>一张卡就能记住的主持循环</h2>
        </div>
        <div className="protocol-strip">
          <article><span>1</span><b>定界</b><p>这一刻角色知道什么，不知道什么？</p></article>
          <article><span>2</span><b>放证</b><p>只投放当前需要的证据，保留信息差。</p></article>
          <article><span>3</span><b>追问</b><p>“哪条证据支撑你？什么情况会让你改变？”</p></article>
          <article><span>4</span><b>裁决</b><p>按选择 + 证据 + 约束生成结果，不按导师偏好。</p></article>
          <article><span>5</span><b>对照</b><p>先让学员解释世界线，再打开真实历史。</p></article>
          <article><span>6</span><b>迁移</b><p>把结论变成现实中有主体、时间和证据的行动。</p></article>
        </div>
      </section>

      <section className="guide-section guide-accordion">
        <details open>
          <summary>会前准备清单</summary>
          <div className="detail-content">
            <ol>
              <li>打开网站并滑到当节年份；确认地图、关卡、档案三个入口可用。</li>
              <li>试玩本节的三条路径，记住它们是可辩护的不同策略，不是一正两错。</li>
              <li>决定是否让各队使用同一关（利于对比）或不同关（利于拼图）。</li>
              <li>建立检查点，准备纸质备份：角色、证据编号、选择 A/B/C、两个复盘问题。</li>
              <li>确认拍照、作品公开和真人访谈的授权边界。</li>
            </ol>
          </div>
        </details>
        <details>
          <summary>如何投放事件与制造信息差</summary>
          <div className="detail-content">
            <p>每队先分配不同证据卡，90 秒静默阅读后才允许交换。若团队过快一致，问：“哪个角色的目标还没有被说出来？”若行动尚未解锁，让学员点击该路线的“去补读”，按黄色高亮卡补证；不要替他们选结论。</p>
            <p><b>禁止：</b>假冒历史人物私密信件、伪造引语、用“我当时就会……”的上帝视角投放现代知识。</p>
          </div>
        </details>
        <details>
          <summary>如何裁决平行世界，而不变成随口编故事</summary>
          <div className="detail-content">
            <p>裁决顺序：先读选择卡的资源变化，再检查团队实际收集的证据，最后把结果放回关卡的历史边界。只有这三者能影响结果；表演欲、口才和导师偏好不加成。</p>
            <p>一次可用的口头裁决：“因为你们选择了 ___，且有证据 ___，在当时 ___ 约束下，世界线暂时变成 ___。”</p>
          </div>
        </details>
        <details>
          <summary>如何复盘“没有成功”的世界线</summary>
          <div className="detail-content">
            <p>失败不会清零。让团队分别标出：一条判断仍然合理、一条证据当时不足、一个可更早设计的小实验。只要这三项能被说清，该关就产生了有效学习证据。</p>
          </div>
        </details>
        <details>
          <summary>未成年人、隐私、收费与公开发布边界</summary>
          <div className="detail-content">
            <ul>
              <li>不收集真实姓名、学校、联系方式等完成课程不需要的信息。</li>
              <li>访谈或录像使用经审核的知情同意；无同意就用匿名观察记录。</li>
              <li>涉及付费时，未成年人不签约、不持有收款账户、不承担法律义务；由课程主体与监护人管理。</li>
              <li>Demo Day 只公布已授权的作品、化名和汇总证据，不展示可识别的用户原始数据。</li>
              <li>AI 输出必须由团队验证；禁止上传未获授权的真人照片、隐私对话或商业秘密。</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>断网、误操作与交接恢复</summary>
          <div className="detail-content">
            <ol>
              <li><b>断网：</b>站点的地图、史料和关卡均随应用打包；继续运行，外部来源链接等网络恢复后再打开。</li>
              <li><b>误选：</b>重玩本关会覆盖该关结果；如需保留原结果，先导出 JSON 档案。</li>
              <li><b>浏览器清空：</b>在“学习档案”导入之前导出的 JSON，版本错误会被明确拒绝。</li>
              <li><b>设备交接：</b>导出档案、在新设备导入、核对关卡数和资源，再删除旧设备数据。</li>
            </ol>
          </div>
        </details>
      </section>

      <section className="guide-section mission-launcher">
        <div className="guide-section-heading">
          <p className="section-kicker">MISSION DECK</p>
          <h2>从手册直接开本</h2>
        </div>
        <div className="mission-mini-grid">
          {missions.map((mission) => (
            <button key={mission.id} type="button" onClick={() => onLaunch(mission)}>
              <span>{mission.year}</span>
              <b>{mission.title}</b>
              <small>{mission.durationMinutes} 分钟 · {mission.domain}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
