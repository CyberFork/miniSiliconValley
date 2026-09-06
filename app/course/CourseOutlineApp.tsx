"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CourseOutlineCourse } from "../lib/course-outline";
import { COURSE_OUTLINE_CHJ_SHA } from "../lib/course-outline";
import { publicPath } from "../lib/public-path";
import styles from "./course-outline.module.css";

type Selection = { courseId: string; stepId: string; blockId: string };

const stepVisuals = [
  { x: 21.5, y: 25.5, icon: "0% 0%", tone: "yellow" },
  { x: 36.5, y: 25.5, icon: "100% 0%", tone: "yellow" },
  { x: 65.5, y: 25.5, icon: "50% 50%", tone: "blue" },
  { x: 31.5, y: 64, icon: "50% 100%", tone: "violet" },
  { x: 69, y: 64, icon: "0% 100%", tone: "green" },
] as const;

const modeLabels: Record<string, string> = {
  yarn: "毛线 · 交换信息",
  american: "美式 · 情境攻坚",
  euro: "德式 · 经营取舍",
};

function selectionFromLocation(courses: CourseOutlineCourse[], fallback: Selection): Selection {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const course = courses.find((item) => item.id === params.get("course"))
    ?? courses.find((item) => item.id === fallback.courseId)
    ?? courses[0];
  const step = course.steps.find((item) => item.id === params.get("step"))
    ?? course.steps.find((item) => item.id === fallback.stepId)
    ?? course.steps[0];
  const block = step.blocks.find((item) => item.id === params.get("block"))
    ?? step.blocks.find((item) => item.id === fallback.blockId)
    ?? step.blocks[0];
  return { courseId: course.id, stepId: step.id, blockId: block.id };
}

function selectionUrl(selection: Selection) {
  const params = new URLSearchParams({
    course: selection.courseId,
    step: selection.stepId,
    block: selection.blockId,
  });
  return params.toString();
}

export function CourseOutlineApp({ courses }: { courses: CourseOutlineCourse[] }) {
  const firstCourse = courses[0];
  const firstStep = firstCourse.steps[0];
  const [selection, setSelection] = useState<Selection>({
    courseId: firstCourse.id,
    stepId: firstStep.id,
    blockId: firstStep.blocks[0].id,
  });

  useEffect(() => {
    const sync = () => setSelection((current) => selectionFromLocation(courses, current));
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [courses]);

  const course = courses.find((item) => item.id === selection.courseId) ?? firstCourse;
  const step = course.steps.find((item) => item.id === selection.stepId) ?? course.steps[0];
  const block = step.blocks.find((item) => item.id === selection.blockId) ?? step.blocks[0];
  const demoSegments = useMemo(
    () => course.formula.sixMinuteDemo.split("，")[0].split(" → ").filter(Boolean),
    [course.formula.sixMinuteDemo],
  );

  function navigate(next: Selection) {
    setSelection(next);
    window.location.assign(`#${selectionUrl(next)}`);
  }

  function chooseCourse(courseId: string) {
    const nextCourse = courses.find((item) => item.id === courseId) ?? firstCourse;
    const nextStep = nextCourse.steps[0];
    navigate({ courseId: nextCourse.id, stepId: nextStep.id, blockId: nextStep.blocks[0].id });
  }

  function chooseStep(stepId: string) {
    const nextStep = course.steps.find((item) => item.id === stepId) ?? course.steps[0];
    navigate({ courseId: course.id, stepId: nextStep.id, blockId: nextStep.blocks[0].id });
    document.getElementById("step-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseBlock(blockId: string) {
    navigate({ courseId: course.id, stepId: step.id, blockId });
    document.getElementById("block-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className={styles.page} data-course-outline-schema="1" data-course-id={course.id} data-course-digest={course.digest} data-course-steps={course.steps.length} data-course-blocks={course.steps.reduce((sum, item) => sum + item.blocks.length, 0)} data-course-decks={course.deckCount}>
      <a className={styles.skipLink} href="#course-main">跳到课程地图</a>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link className={styles.brand} href="/" aria-label="Mini Silicon Valley 总首页">
            <span aria-hidden="true">MSV</span>
            <strong>MINI SILICON VALLEY<small>真实科技史创业 RPG</small></strong>
          </Link>
          <nav className={styles.primaryNav} aria-label="Mini Silicon Valley 主导航">
            <Link href="/">首页</Link>
            <Link href="/world/">历史世界</Link>
            <Link href="/course/" aria-current="page">课程大纲</Link>
            <Link href="/classroom/">课堂</Link>
            <Link href="/parents/">家长</Link>
          </nav>
          <div className={styles.topActions}>
            <div data-msv-theme-slot />
            <Link href="/control/">导师主控</Link>
          </div>
        </div>
      </header>

      <main id="course-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="course-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>COURSE WORLD · RELEASED PACKAGE</p>
            <h1 id="course-title">不是看目录，<br /><em>是选择下一段冒险。</em></h1>
            <p>进入真实科技史现场，和队友收集线索、解决问题、经营资源，再把学到的方法带回自己的项目。</p>
            <div className={styles.formulaLine} aria-label="课程完整结构">
              <span>一世界</span><i>·</i><span>两轨线</span><i>·</i><span>三玩法</span><i>·</i><span>四导师</span><i>·</i><span>五步骤</span><i>·</i><b>六分钟</b>
            </div>
          </div>
          <aside className={styles.releaseCard} aria-label="当前课程版本">
            <span>当前读取</span>
            <strong>{course.lifecycle} · r{course.revision}</strong>
            <code title={course.digest}>{course.digest.slice(0, 12)}</code>
            <p>数据直接来自 Course Package<br />不是页面里的第三份课程文案</p>
          </aside>
        </section>

        <section className={styles.coursePicker} aria-labelledby="course-picker-title">
          <header>
            <div><p className={styles.eyebrow}>CHOOSE A HISTORICAL CAMPAIGN</p><h2 id="course-picker-title">选择今天进入的历史现场</h2></div>
            <span>{courses.length} 套完整课件 · 每套 5 步 / 13 Block</span>
          </header>
          <div className={styles.courseCards}>
            {courses.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={item.id === course.id ? styles.courseCardActive : styles.courseCard}
                aria-pressed={item.id === course.id}
                onClick={() => chooseCourse(item.id)}
              >
                <span>{String(index + 1).padStart(2, "0")} · {item.period}</span>
                <strong>{item.name.replace("｜五步创业闭环", "")}</strong>
                <p>{item.description}</p>
                <small>{item.sourceCount} 份来源 · {item.deckCount} 套卡组 · {item.cardCount} 张卡</small>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.mapSection} aria-labelledby="map-title">
          <header className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>PIXEL COURSE MAP · 05 STEPS</p><h2 id="map-title">{course.name}</h2></div>
            <p>{course.learnerName}<br /><b>{course.period}</b></p>
          </header>

          <div className={styles.mapStage} data-testid="course-map-stage">
            <Image
              className={styles.mapImage}
              src={publicPath("/assets/course-outline-world-map.webp")}
              alt="像素风创业课程地图，五个步骤沿道路连接，终点为 Demo Day。"
              fill
              priority
              unoptimized
              sizes="(max-width: 760px) 100vw, 1220px"
            />
            <div className={styles.mapShade} aria-hidden="true" />
            <div className={styles.mapHeading}><span>MISSION MAP</span><b>{course.period}</b></div>
            {course.steps.map((item, index) => {
              const visual = stepVisuals[index];
              const selected = item.id === step.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.mapNode} ${styles[`tone${visual.tone[0].toUpperCase()}${visual.tone.slice(1)}`]} ${selected ? styles.mapNodeActive : ""}`}
                  style={{ "--node-x": `${visual.x}%`, "--node-y": `${visual.y}%` } as CSSProperties}
                  aria-current={selected ? "step" : undefined}
                  aria-label={`第 ${item.order} 步 ${item.name}，${item.blocks.length} 个任务块`}
                  onClick={() => chooseStep(item.id)}
                  data-step-id={item.id}
                >
                  <span className={styles.nodeIcon} style={{ backgroundImage: `url(${publicPath("/assets/course-outline-chapter-icons.webp")})`, backgroundPosition: visual.icon }} aria-hidden="true" />
                  <b>0{item.order}</b><strong>{item.name}</strong><small>{item.blocks.length} BLOCKS</small>
                </button>
              );
            })}
            <button className={styles.demoMarker} type="button" onClick={() => document.getElementById("demo-day")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>6′</span><b>DEMO DAY</b><small>五步之后的终局</small></button>
            <div className={styles.mapLegend}><span>点击步骤查看任务</span><b>历史认知 ↔ 现实项目</b></div>
          </div>

          <nav className={styles.mobileStepNav} aria-label="五步课程导航">
            {course.steps.map((item) => <button key={item.id} type="button" aria-current={item.id === step.id ? "step" : undefined} onClick={() => chooseStep(item.id)}><span>0{item.order}</span>{item.name}</button>)}
          </nav>
        </section>

        <section id="step-detail" className={styles.stepDetail} aria-labelledby="step-title">
          <div className={styles.stepBrief}>
            <p className={styles.eyebrow}>STEP {String(step.order).padStart(2, "0")} · {step.blocks.length} BLOCKS</p>
            <h2 id="step-title">{step.name}</h2>
            <blockquote>{step.question}</blockquote>
            <dl>
              <div><dt>这一步要带走什么</dt><dd>{step.output}</dd></div>
              <div><dt>怎样才算真的完成</dt><dd>{step.exitGate}</dd></div>
            </dl>
            <div className={styles.mentorRail} aria-label="本步导师顺序">
              <span>导师接力</span>
              {step.mentorSequence.map((mentor, index) => <b key={mentor.id}>{index ? "→ " : ""}{mentor.code} · {mentor.name}</b>)}
            </div>
          </div>

          <div className={styles.blockNavigator}>
            <header><span>本步任务块</span><small>点开一块，看看学员真正要做什么</small></header>
            <div>
              {step.blocks.map((item) => (
                <button key={item.id} type="button" className={item.id === block.id ? styles.blockTabActive : styles.blockTab} aria-pressed={item.id === block.id} onClick={() => chooseBlock(item.id)}>
                  <span>{item.id}</span><b>{item.title}</b><small>{item.suggestedMinutes} 分钟 · {item.leadMentorName}</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <article id="block-detail" className={styles.blockDetail} aria-labelledby="block-title" data-block-id={block.id}>
          <header>
            <div><p>{block.id} · BLOCK {String(block.order).padStart(2, "0")}</p><h2 id="block-title">{block.title}</h2></div>
            <div><span>{block.suggestedMinutes} 分钟</span><b>{block.leadMentorName}主导</b></div>
          </header>
          <section className={styles.studentMission}>
            <p>YOUNG BUILDER · 你现在只做这一件事</p>
            <strong>{block.studentPrompt}</strong>
            <div><span><b>你在哪里</b>{block.learnerLens.world}</span><span><b>你要说什么</b>{block.learnerLens.say}</span><span><b>可以问什么</b>{block.learnerLens.ask}</span><span><b>做到什么算过关</b>{block.learnerLens.done}</span></div>
          </section>
          <div className={styles.blockTracks}>
            <section><span>历史认知轨</span><p>{block.historyTrack}</p></section>
            <section><span>现实项目轨</span><p>{block.realityTrack}</p></section>
          </div>
          <footer>
            <div>{block.gameModes.map((mode) => <span key={mode.id} title={mode.purpose}>{modeLabels[mode.id] ?? mode.name}</span>)}</div>
            <small>导师负责复杂方法；学员界面只给当前情境、当前动作和可见过关条件。</small>
          </footer>
        </article>

        <section className={styles.systemSection} aria-labelledby="system-title">
          <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>HOW THE WORLD RUNS</p><h2 id="system-title">五步背后，是同一套课程系统</h2></div><p>学员先经历<br /><b>导师再命名方法</b></p></header>
          <div className={styles.systemGrid}>
            <article><span>01</span><h3>两轨线</h3>{course.formula.twoDualTracks.map((item) => <p key={item}>{item}</p>)}</article>
            <article><span>02</span><h3>三玩法</h3>{course.formula.threeGameModes.map((mode) => <p key={mode.id}><b>{mode.name}</b>{mode.purpose}</p>)}</article>
            <article><span>03</span><h3>四导师</h3>{course.formula.fourMentors.map((mentor) => <p key={mentor.id}><b>{mentor.code} · {mentor.name}</b>{mentor.promise}</p>)}</article>
          </div>
        </section>

        <section id="demo-day" className={styles.demoDay} aria-labelledby="demo-title">
          <div className={styles.demoLead}><p className={styles.eyebrow}>FINAL QUEST · AFTER STEP 05</p><h2 id="demo-title">六分钟 Demo Day</h2><p>Demo Day 不是第六步，也不是背答案。它把五步证据压缩成一次真实发布。</p><Link href="/classroom/">带团队进入课堂 →</Link></div>
          <ol>{demoSegments.map((segment, index) => <li key={segment}><span>{index + 1}:00</span><b>{segment}</b><small>只证明一件事</small></li>)}</ol>
        </section>

        <section className={styles.packageProof} aria-label="课程包一致性信息">
          <div><span>COURSE ID</span><code>{course.id}</code></div>
          <div><span>RELEASED</span><code>r{course.revision} · {course.digest}</code></div>
          <div><span>STRUCTURE</span><code>{course.steps.length} steps · {course.steps.reduce((sum, item) => sum + item.blocks.length, 0)} blocks · {course.deckCount} decks</code></div>
          <div><span>CHJ VISUAL SOURCE</span><code>{COURSE_OUTLINE_CHJ_SHA}</code></div>
        </section>
      </main>

      <footer className={styles.footer}><span>Mini Silicon Valley · 课程大纲</span><nav aria-label="课程后续入口"><Link href="/world/">历史世界</Link><Link href="/alpha/">Alpha 实验室</Link><Link href="/control/editor/">课程编辑器</Link></nav></footer>
    </div>
  );
}
