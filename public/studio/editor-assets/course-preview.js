(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const CardView = root.MsvCardView || {};
  const esc = CardView.escapeHtml || ((value) => String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]),
  ));
  const expandBoundaryText = CardView.expandBoundaryText || ((value) => String(value ?? ""));
  const renderLearnerCard = CardView.renderLearnerCard || (() => "");

  const LEGACY_LEARNER_POLICY = {
    defaultCount: 4, minCount: 2, maxCount: 4, cardsPerLearner: 3, dealPolicy: "unique-within-step",
  };
  function learnerPolicy(course) {
    const value = course?.learnerPolicy || LEGACY_LEARNER_POLICY;
    return {
      defaultCount: Number(value.defaultCount || 4),
      minCount: Number(value.minCount || 2),
      maxCount: Number(value.maxCount || 4),
      cardsPerLearner: Number(value.cardsPerLearner || 3),
      dealPolicy: value.dealPolicy === "repeat-when-needed" ? "repeat-when-needed" : "unique-within-step",
    };
  }
  function learnersForCourse(course, requestedCount) {
    const policy = learnerPolicy(course);
    const raw = Number.isInteger(Number(requestedCount)) ? Number(requestedCount) : policy.defaultCount;
    const count = Math.max(policy.minCount, Math.min(policy.maxCount, raw));
    return Array.from({length: count}, (_, index) => {
      const number = index + 1;
      return {
        id: `learner${String(number).padStart(2, "0")}`,
        window: `W${String(number + 3).padStart(2, "0")}`,
        title: `Young Builder ${String(number).padStart(2, "0")}`,
      };
    });
  }
  const MENTOR_WINDOWS = ["W00", "W01", "W02", "W03"];
  const STATUS_LABELS = {
    ready: "待执行",
    executing: "同步中",
    "awaiting-acceptance": "待人工验收",
    error: "已停住",
    completed: "全程完成",
  };
  const FIELD_LABELS = {
    historyTrack: "历史学习轨｜当时能知道什么",
    realityTrack: "现实实践轨｜今天要带走什么",
    mentorScript: "当值导师逐句口播",
    studentActions: "学员现场动作",
    systemActions: "执行本块后系统会同步",
    props: "本块道具",
    evidenceGate: "人工验收门｜必须亲眼看见",
    fallback: "卡住时怎么兜底",
    manualInteraction: "线下与多角色视窗怎样配合",
  };
  const MODE_LABELS = {yarn: "毛线信息", american: "美式攻坚", euro: "德式经营"};

  function hash32(value) {
    let hash = 2166136261;
    const text = String(value ?? "");
    // Keep this byte-for-byte equivalent to app/lib/course-platform.ts.
    // charCodeAt is intentional: codePointAt/for..of diverges for astral
    // Unicode characters and would make Editor Preview deal different cards
    // from the Test Classroom for the same courseDataId + seed.
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomFromSeed(seed) {
    let value = hash32(seed) || 0x6d2b79f5;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function privateDeckForBlock(course, block) {
    const declaredDeckId = (course?.contentPackages?.scriptPackages || [])
      .flatMap((scriptPackage) => scriptPackage.checkpoints || [])
      .find((checkpoint) => (checkpoint.blockIds || []).includes(block?.id))
      ?.privateDeckIds?.[0];
    const deck = declaredDeckId
      ? (course?.decks || []).find((item) => item.id === declaredDeckId)
      : (course?.decks || []).find((item) => item.macroStepId === block?.macroStepId);
    if (!deck) throw new Error(`${block?.id || "当前 Block"} 找不到可用的学员私密卡组。`);
    return deck;
  }

  function deterministicDeal(course, stepIndex, seed, learnerCount, blockId) {
    const step = course?.macroSteps?.[stepIndex];
    const block = blockId ? (course?.blocks || []).find((item) => item.id === blockId) : null;
    const deck = block
      ? privateDeckForBlock(course, block)
      : (course?.decks || []).find((item) => item.macroStepId === step?.id);
    if (!deck) throw new Error(`${blockId || step?.id || "当前步骤"} 找不到可用的学员私密卡组。`);
    const deckIndex = (course?.decks || []).findIndex((item) => item.id === deck.id);
    const cards = Array.isArray(deck?.cards) ? deck.cards.map((card, cardIndex) => ({card, cardIndex})) : [];
    const random = randomFromSeed(`${course?.course?.id}:${deck?.id}:${seed}`);
    for (let index = cards.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [cards[index], cards[target]] = [cards[target], cards[index]];
    }
    const policy = learnerPolicy(course);
    const learners = learnersForCourse(course, learnerCount);
    const handSize = Math.max(0, Number(policy.cardsPerLearner || deck?.cardsPerLearner || 3));
    const hands = {};
    learners.forEach((learner, learnerIndex) => {
      const start = learnerIndex * handSize;
      let selected = cards.slice(start, start + handSize);
      if (selected.length < handSize && policy.dealPolicy === "repeat-when-needed" && cards.length) {
        selected = Array.from({length: handSize}, (_, cardIndex) => cards[(start + cardIndex) % cards.length]);
      }
      hands[learner.id] = selected.map(({card, cardIndex}) => ({
        ...card,
        sourcePath: `decks.${deckIndex}.cards.${cardIndex}`,
        stableId: card.id,
        state: "held",
      }));
    });
    return {
      deck, deckIndex, hands, learners, handSize,
      dealtCount: Object.values(hands).flat().length,
      uniqueCount: new Set(Object.values(hands).flat().map((card) => card.id)).size,
    };
  }

  function flattenCards(course) {
    const sourceMap = new Map((course?.sources || []).map((source) => [source.id, source]));
    return (course?.decks || []).flatMap((deck, deckIndex) => {
      const stepIndex = (course?.macroSteps || []).findIndex((step) => step.id === deck.macroStepId);
      const step = course?.macroSteps?.[stepIndex] || {id: deck.macroStepId, order: stepIndex + 1, name: deck.macroStepId};
      return (deck.cards || []).map((card, cardIndex) => ({
        card, deck, deckIndex, cardIndex, step, stepIndex,
        sourcePath: `decks.${deckIndex}.cards.${cardIndex}`,
        searchText: [card.id, card.title, card.body, card.sharePrompt, ...(card.sourceIds || []), ...(card.sourceIds || []).flatMap((id) => {
          const source = sourceMap.get(id);
          return source ? [source.title, source.organization, source.url] : [];
        })].join(" ").toLocaleLowerCase("zh-CN"),
      }));
    });
  }

  function blockWarnings(course, blockIndex, learnerCount) {
    const block = course?.blocks?.[blockIndex];
    if (!block) return ["缺少 Block"];
    const warnings = [];
    const strings = ["title", "historyTrack", "realityTrack", "studentPrompt", "manualInteraction"];
    strings.forEach((key) => { if (!String(block[key] || "").trim()) warnings.push(`${key} 为空`); });
    const arrays = ["gameModes", "mentorScript", "studentActions", "systemActions", "props", "evidenceGate", "fallback"];
    arrays.forEach((key) => { if (!Array.isArray(block[key]) || !block[key].length) warnings.push(`${key} 为空`); });
    const activeLearnerSeats = course?.fieldModel?.studentSeats
      ?.filter((seat) => seat.status === "available")
      .slice(0, learnerCount)
      .map((seat) => seat.seatId)
      || Array.from({length: Math.min(4, learnerCount)}, (_, index) => `learner${String(index + 1).padStart(2, "0")}`);
    const seats = ["mentor01", "mentor02", "mentor03", "mentor04", ...activeLearnerSeats];
    seats.forEach((seatId) => {
      const task = block.seatTasks?.[seatId];
      if (!task?.task || !task?.badge || !task?.state) warnings.push(`${seatId} 任务不完整`);
    });
    if (!course?.formula?.fourMentors?.some((mentor) => mentor.id === block.leadMentorId)) warnings.push("当值导师不存在");
    const activeMentors = seats.slice(0, 4).filter((seatId) => block.seatTasks?.[seatId]?.state === "active");
    if (activeMentors.length !== 1 || activeMentors[0] !== block.leadMentorId) warnings.push("必须且只能由当值导师处于 active");
    const requested = Number(learnerCount ?? learnerPolicy(course).defaultCount);
    if (course?.fieldModel) {
      for (const learner of learnersForCourse(course, requested)) {
        const task = block.seatTasks?.[learner.id];
        if (!task?.task || !task?.badge || !task?.state) warnings.push(`${learner.id} 独立任务不完整`);
      }
    } else if (requested > 4 && (!block.learnerTaskTemplate?.task || !block.learnerTaskTemplate?.badge)) {
      warnings.push("动态学员任务模板不完整");
    }
    return warnings;
  }

  function previewGuide(status, block) {
    if (status === "ready") return {title: `先读 ${block.id}，再模拟执行`, body: "确认当值导师、现场道具和所有角色提示都对齐。本页只排练，不会调用真实课堂 API。"};
    if (status === "executing") return {title: "模拟：系统正在同步所有视窗", body: "这是预览状态；不会发牌、记账或推进任何真实课堂。"};
    if (status === "awaiting-acceptance") return {title: "模拟：等待导师看见真实行动", body: "逐项核对人工验收门；预览不会替导师自动判定学员是否完成。"};
    if (status === "error") return {title: "模拟：本块在错误处停住", body: "检查兜底脚本和错误提示是否足以让导师恢复课堂。"};
    return {title: "模拟：全程完成", body: "检查六分钟 Demo、个人成长和团队账本是否都有明确收束。"};
  }

  function projectCourse(course, options = {}) {
    if (!course || !Array.isArray(course.blocks) || !course.blocks.length) throw new Error("课程缺少可预览的 Block。");
    const blockIndex = Math.max(0, Math.min(Number(options.blockIndex || 0), course.blocks.length - 1));
    const block = course.blocks[blockIndex];
    const stepIndex = Math.max(0, course.macroSteps.findIndex((step) => step.id === block.macroStepId));
    const step = course.macroSteps[stepIndex];
    const status = STATUS_LABELS[options.status] ? options.status : "ready";
    const seed = String(options.seed || "MSV-PREVIEW-01");
    const policy = learnerPolicy(course);
    const learnerCount = Number.isInteger(Number(options.learnerCount)) ? Number(options.learnerCount) : policy.defaultCount;
    const learnersForPreview = learnersForCourse(course, learnerCount);
    const deal = deterministicDeal(course, stepIndex, seed, learnerCount, block.id);
    const blockPath = `blocks.${blockIndex}`;
    const stepPath = `macroSteps.${stepIndex}`;
    const mentorDefinitions = course.formula?.fourMentors || [];
    const progress = {current: blockIndex + 1, total: course.blocks.length};
    const digest = options.digest || "保存 Candidate 后生成";
    const revision = Number(options.revision || 0);
    const guide = previewGuide(status, block);
    const base = {
      status, statusLabel: STATUS_LABELS[status], preview: true, seed, revision, digest,
      blockId: block.id, blockTitle: block.title, blockOrder: blockIndex + 1,
      macroStepId: step.id, macroStepName: step.name, macroStepOrder: step.order,
      progress, courseName: course.course.name, caseName: course.case.name,
    };
    const mentors = mentorDefinitions.map((mentor, mentorIndex) => {
      const task = block.seatTasks?.[mentor.id] || {};
      return {
        ...base,
        id: mentor.id,
        kind: "mentor",
        window: MENTOR_WINDOWS[mentorIndex] || `W0${mentorIndex}`,
        code: mentor.code,
        title: `${mentor.id === "mentor01" ? "主 DM · " : ""}${mentor.name}`,
        titlePath: `formula.fourMentors.${mentorIndex}.name`,
        kicker: mentor.id === "mentor01" ? "主 DM · 总控主持" : `协作导师 · ${mentor.code} 专业线`,
        subidentity: task.state === "active" ? "本块由你主导" : task.state === "support" ? "本块协作支援" : "本块观察待命，不抢讲",
        subidentityPath: `${blockPath}.seatTasks.${mentor.id}.state`,
        taskTitle: "现在做什么",
        task: task.task,
        taskPath: `${blockPath}.seatTasks.${mentor.id}.task`,
        action: `${block.id}「${block.title}」`,
        actionPath: `${blockPath}.title`,
        result: task.badge,
        resultPath: `${blockPath}.seatTasks.${mentor.id}.badge`,
        resultState: status === "error" ? "error" : status === "ready" ? "wait" : "",
        metrics: [
          {value: `4 / ${learnerCount}`, label: "导师 / 学员", derived: "由当前预览学员人数生成"},
          {value: `${step.order}/5`, label: "课程大步", derived: "由所选 Block 推导"},
          {value: `${(blockIndex * 2.5).toFixed(1)} C`, label: "模拟团队资金", derived: "预览值，不写入课程或账本"},
        ],
        factsTitle: "主持 / 验收信息",
        facts: [
          {value: mentor.promise, path: `formula.fourMentors.${mentorIndex}.promise`, label: "角色承诺"},
          {value: block.evidenceGate, path: `${blockPath}.evidenceGate`, label: "人工验收门"},
        ],
        teamworkTitle: "观察重点",
        teamwork: [
          {value: block.historyTrack, path: `${blockPath}.historyTrack`, label: "历史轨"},
          {value: block.realityTrack, path: `${blockPath}.realityTrack`, label: "实践轨"},
        ],
        chipsTitle: "导师工具",
        chips: [task.badge, `${mentor.code} 专业线`, "一次只突出一名导师"],
        footerLeft: `${course.course.id} · 编辑预览`, footerRight: `r${revision} · ${String(digest).slice(0, 16)}`,
      };
    });
    const learners = learnersForPreview.map((learner, learnerIndex) => {
      const fixedTask = block.seatTasks?.[learner.id];
      const task = fixedTask || block.learnerTaskTemplate || {badge: "Young Builder", task: block.studentPrompt};
      const taskPath = fixedTask ? `${blockPath}.seatTasks.${learner.id}.task` : block.learnerTaskTemplate ? `${blockPath}.learnerTaskTemplate.task` : `${blockPath}.studentPrompt`;
      const random = randomFromSeed(`${seed}|metrics|${learner.id}|${block.id}`);
      return {
        ...base,
        ...learner,
        kind: "learner",
        kicker: "YOUNG BUILDER · 私人任务视角",
        subidentity: "预览身份 · 不读取真实学员资料",
        taskTitle: "我现在只做这一件事",
        task: task.task,
        taskPath,
        action: block.learnerLens?.world || block.studentPrompt,
        actionPath: block.learnerLens?.world ? `${blockPath}.learnerLens.world` : `${blockPath}.studentPrompt`,
        result: `做成的样子：${block.learnerLens?.done || task.badge}`,
        resultPath: block.learnerLens?.done
          ? `${blockPath}.learnerLens.done`
          : fixedTask
            ? `${blockPath}.seatTasks.${learner.id}.badge`
            : block.learnerTaskTemplate
              ? `${blockPath}.learnerTaskTemplate.badge`
              : `${blockPath}.studentPrompt`,
        resultState: status === "error" ? "error" : status === "ready" ? "wait" : "",
        metrics: [
          {value: `${Math.floor(blockIndex * 2 + random() * 3)} RP`, label: "模拟声望", derived: "按 seed 生成，不写入个人账户"},
          {value: `${(2 + (learnerIndex % 6) + random()).toFixed(1)} C`, label: "模拟钱包", derived: "按 seed 生成，不写入个人账户"},
          {value: `${(blockIndex * 2.5).toFixed(1)} C`, label: "模拟团队资金", derived: "预览值，不写入团队账本"},
        ],
        factsTitle: "只有我看到的信息",
        facts: [{value: "预览不会载入真实身份、昵称、提交、RP 或钱包。", derived: "隐私隔离契约"}],
        cards: deal.hands[learner.id] || [],
        teamworkTitle: "和队友怎么配合",
        teamwork: [
          {value: block.learnerLens?.say || "用自己的话讲出你掌握的信息。", path: `${blockPath}.learnerLens.say`, label: "我要说"},
          {value: block.learnerLens?.ask || "听队友说完，再追问一件不清楚的事。", path: `${blockPath}.learnerLens.ask`, label: "我要问"},
          {value: block.learnerLens?.done || task.badge, path: `${blockPath}.learnerLens.done`, label: "完成后"},
        ],
        chipsTitle: "我已经拥有",
        chips: [`${deal.hands[learner.id]?.length || 0}/${policy.cardsPerLearner} 预览私密卡`, "0 项模拟解锁", "一票团队发言权"],
        footerLeft: `${course.case.learnerName} · 编辑预览`, footerRight: `seed ${seed}`,
      };
    });
    return {
      kind: "preview-course-state",
      blockIndex, stepIndex, block, step, blockPath, stepPath, status, seed, deal,
      revision, digest, seats: [...mentors, ...learners], mentors, learners,
      controller: {
        ...base, block, step, lead: mentorDefinitions.find((mentor) => mentor.id === block.leadMentorId),
        guide, blockPath, stepPath, editable: true, editorPreview: true,
      },
    };
  }

  function valueHtml(value) {
    if (Array.isArray(value)) return `<ol>${value.map((item) => `<li>${esc(expandBoundaryText(item))}</li>`).join("")}</ol>`;
    return `<p>${esc(expandBoundaryText(value))}</p>`;
  }

  function editable(value, path, options = {}) {
    const label = options.label || "编辑课程字段";
    const body = options.rawHtml || valueHtml(value);
    if (!path) return `<div class="surface-value">${body}</div>`;
    return `<button type="button" class="surface-editable" data-course-path="${esc(path)}" data-edit-label="${esc(label)}"${options.cardId ? ` data-card-id="${esc(options.cardId)}"` : ""}>${body}<span class="surface-edit-hint">编辑</span></button>`;
  }

  function derived(value, explanation, options = {}) {
    const body = options.rawHtml || valueHtml(value);
    return `<button type="button" class="surface-derived" data-derived-explain="${esc(explanation)}" data-derived-label="${esc(options.label || "模拟 / 派生状态")}">${body}<span class="surface-derived-hint">只读 · 模拟</span></button>`;
  }

  function renderFacts(entries, editableMode) {
    return entries.map((entry) => {
      const body = `${entry.label ? `<span class="surface-list-label">${esc(entry.label)}</span>` : ""}${valueHtml(entry.value)}`;
      if (!editableMode) return `<li><div class="surface-value">${body}</div></li>`;
      if (entry.path) return `<li>${editable(entry.value, entry.path, {label: entry.label, rawHtml: body})}</li>`;
      return `<li>${derived(entry.value, entry.derived || "由运行状态生成，不属于 Course Package。", {label: entry.label, rawHtml: body})}</li>`;
    }).join("");
  }

  function renderSeatSurface(view, options = {}) {
    const isEditable = options.editable === true;
    const total = Math.max(1, Number(view.progress?.total || 1));
    const current = Math.max(1, Number(view.progress?.current || 1));
    const progress = Array.from({length: total}, (_, index) => `<i class="${index + 1 < current ? "done" : index + 1 === current ? "now" : ""}"></i>`).join("");
    const maybe = (value, path, label) => isEditable && path ? editable(value, path, {label}) : `<div class="surface-value">${valueHtml(value)}</div>`;
    const metricHtml = (view.metrics || []).map((metric) => `<div class="surface-metric">${isEditable && metric.derived ? derived(metric.value, metric.derived, {label: metric.label, rawHtml: `<b>${esc(metric.value)}</b><span>${esc(metric.label)}</span>`}) : `<b>${esc(metric.value)}</b><span>${esc(metric.label)}</span>`}</div>`).join("");
    const facts = renderFacts(view.facts || [], isEditable);
    const teamwork = renderFacts(view.teamwork || [], isEditable);
    const cards = (view.cards || []).map((card, index) => {
      const paths = isEditable && card.sourcePath ? {
        title: `${card.sourcePath}.title`, body: `${card.sourcePath}.body`, sharePrompt: `${card.sourcePath}.sharePrompt`, boundary: `${card.sourcePath}.boundary`,
      } : null;
      return renderLearnerCard(card, index, {state: card.state || "held", paths, cardId: card.stableId || card.id});
    }).join("");
    return `<article class="msv-seat-surface" data-seat-id="${esc(view.id)}" data-seat-kind="${esc(view.kind)}" data-block-id="${esc(view.blockId)}" data-preview="${view.preview ? "true" : "false"}">
      <header class="surface-header"><div><span class="surface-kicker">${esc(view.kicker)}</span>${maybe(view.title, view.titlePath, "席位名称")}${view.subidentityPath && isEditable ? editable(view.subidentity, view.subidentityPath, {label: "本块席位状态"}) : `<p class="surface-subidentity">${esc(expandBoundaryText(view.subidentity || ""))}</p>`}</div><b class="surface-window">${esc(view.window)}</b></header>
      <div class="surface-phase"><b>${esc(`第 ${view.macroStepOrder} 步 · ${view.macroStepName}`)}</b><span>${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>
      <div class="surface-progress" style="--block-count:${total}">${progress}</div>
      <section class="surface-card surface-mission"><h2>${esc(view.taskTitle)}</h2>${maybe(view.task, view.taskPath, "此刻唯一任务")}${maybe(view.action, view.actionPath, "当前情境 / 行动提示")}<div class="surface-result ${esc(view.resultState || "")}">${maybe(view.result, view.resultPath, "完成标准 / 徽标")}</div></section>
      <div class="surface-metrics">${metricHtml}</div>
      <section class="surface-card"><h2>${esc(view.factsTitle)}</h2>${view.boundaryGuide ? `<p class="surface-boundary-guide">线索标签：${esc(view.boundaryGuide)}</p>` : ""}<ul>${facts}${cards}</ul></section>
      <section class="surface-card"><h2>${esc(view.teamworkTitle)}</h2><ul>${teamwork}</ul></section>
      <section class="surface-card"><h2>${esc(view.chipsTitle)}</h2><div class="surface-chips">${(view.chips || []).map((chip, index) => `<span class="surface-chip ${index === 0 ? "hot" : ""}">${esc(chip)}</span>`).join("")}</div></section>
      <footer class="surface-footer"><span>${esc(view.footerLeft)}</span><span>${esc(view.footerRight)}</span></footer>
      ${view.preview ? `<span class="surface-preview-watermark">编辑预览 · 非真实课堂</span>` : ""}
    </article>`;
  }

  function controllerSection(key, value, path, isEditable) {
    return `<section class="script-section"><div class="label">${esc(FIELD_LABELS[key])}</div>${isEditable ? editable(value, path, {label: FIELD_LABELS[key]}) : valueHtml(value)}</section>`;
  }

  function renderControllerSurface(model, options = {}) {
    const editableMode = options.editable === true;
    const {block, step, lead, guide, blockPath, stepPath} = model;
    const maybe = (value, path, label) => editableMode ? editable(value, path, {label}) : `<div class="surface-value">${valueHtml(value)}</div>`;
    const guideHtml = editableMode ? derived([guide.title, guide.body], "由预览状态与当前 Block 自动生成；请通过上方预览状态控件切换。", {label: "中控状态提示", rawHtml: `<strong>${esc(guide.title)}</strong><p>${esc(guide.body)}</p>`}) : `<strong>${esc(guide.title)}</strong><p>${esc(guide.body)}</p>`;
    return `<div class="shared-controller" data-block-id="${esc(block.id)}" data-preview="${model.preview ? "true" : "false"}">
      <div class="block-head"><div><div class="label">${esc(model.caseName)} · 第 ${step.order} 步 / ${esc(block.id)}</div>${maybe(block.title, `${blockPath}.title`, "小步骤标题")}</div><div class="block-meta">${maybe(`${block.suggestedMinutes} 分钟`, `${blockPath}.suggestedMinutes`, "建议分钟")} ${maybe(`当值导师 ${lead ? `${lead.code} · ${lead.name}` : block.leadMentorId}`, `${blockPath}.leadMentorId`, "当值导师")}</div></div>
      <aside class="next-action" data-status="${esc(model.status)}">${guideHtml}</aside>
      <section class="learner-brief"><div class="label">给学员的一句话</div>${maybe(block.studentPrompt, `${blockPath}.studentPrompt`, "给学员的一句话")}<div class="mode-row">${editableMode ? editable(block.gameModes, `${blockPath}.gameModes`, {label: "本块玩法", rawHtml: block.gameModes.map((mode) => `<span>${esc(MODE_LABELS[mode] || mode)}</span>`).join("")}) : block.gameModes.map((mode) => `<span>${esc(MODE_LABELS[mode] || mode)}</span>`).join("")}</div></section>
      <div class="grid">${Object.keys(FIELD_LABELS).map((key) => controllerSection(key, block[key], `${blockPath}.${key}`, editableMode)).join("")}</div>
      <div class="controller-contract"><div>${editableMode ? editable(step.question, `${stepPath}.question`, {label: "本步核心问题"}) : valueHtml(step.question)}</div><div>${editableMode ? editable(step.exitGate, `${stepPath}.exitGate`, {label: "本步完成门槛"}) : valueHtml(step.exitGate)}</div></div>
      <footer class="controller-version"><b>${model.editorPreview ? "编辑预览 · 零运行副作用" : model.preview ? "真实课堂 · 只读回看" : "真实课堂"}</b><span>r${esc(model.revision)} · ${esc(String(model.digest).slice(0, 16))}</span></footer>
    </div>`;
  }

  function readyTask(view, learnerView, data) {
    if (data.status !== "ready") return view.task;
    if (view.blockOrder === 1 && !learnerView) return "先把纸和笔放在手边。不要猜公司结局，等老师发出身份和私密卡。";
    return `先看看上一步留下的结果。老师说“开始”后，再做：${view.task}`;
  }

  function runtimeSeatView(data, seatId) {
    const view = data.seats?.find((item) => item.id === seatId);
    if (!view) throw new Error("席位不存在");
    const classroom = data.classroom || {};
    const total = view.blockCount || data.blocks?.length || 1;
    const common = {
      id: view.id, kind: view.kind, window: view.window, code: view.code, preview: false,
      status: data.status, statusLabel: STATUS_LABELS[data.status] || data.status,
      title: view.title, blockId: view.blockId, blockTitle: view.blockTitle, blockOrder: view.blockOrder,
      macroStepOrder: view.macroStepOrder, macroStepName: view.macroStepName,
      progress: {current: view.blockOrder, total}, revision: view.courseRevision ?? data.courseRevision ?? 0,
      digest: view.courseDigest ?? data.courseDigest ?? "", caseName: view.caseName,
    };
    if (view.kind === "learner") {
      const learnerView = classroom.learnerViews?.[view.id] || null;
      const identity = learnerView?.identity;
      const lens = view.learnerLens || {};
      const facts = [];
      if (identity) {
        facts.push({label: "我的能力", value: identity.ability, derived: "真实课堂身份状态"});
        facts.push({label: "我心里的担心", value: identity.privateConcern, derived: "真实课堂身份状态"});
      }
      if (learnerView?.recentReputation) facts.push({label: "最近一次成长", value: `+${learnerView.recentReputation.points} RP · ${learnerView.recentReputation.reason}`, derived: "真实课堂账本"});
      else if (learnerView) facts.push({label: "我的成长记录", value: `当前 ${learnerView.reputation} RP；新 RP 只会在导师指出具体作品后记录。`, derived: "真实课堂账本"});
      if (learnerView?.recentWallet) facts.push({label: "最近一笔个人资金", value: `${learnerView.recentWallet.direction === "in" ? "+" : "-"}${(learnerView.recentWallet.amountTenths / 10).toFixed(1)} C · ${learnerView.recentWallet.reason}`, derived: "真实课堂账本"});
      return {
        ...common, kicker: "YOUNG BUILDER · 私人任务视角", title: identity?.name || view.title,
        subidentity: identity?.publicGoal || STATUS_LABELS[data.status] || "",
        taskTitle: "我现在只做这一件事", task: readyTask(view, learnerView, data), action: lens.world || view.studentPrompt || "",
        result: `做成的样子：${lens.done || view.headline}`, resultState: data.status === "error" ? "error" : data.status === "ready" ? "wait" : "",
        metrics: [
          {value: learnerView ? `${learnerView.reputation} RP` : "—", label: "我的声望"},
          {value: learnerView ? `${(learnerView.walletTenths / 10).toFixed(1)} C` : "—", label: "我的钱包"},
          {value: classroom.roomId ? `${((classroom.teamTreasuryTenths || 0) / 10).toFixed(1)} C` : "—", label: "团队资金"},
        ],
        factsTitle: "只有我看到的信息", facts, cards: learnerView?.cards || [], teamworkTitle: "和队友怎么配合",
        teamwork: [
          {label: "我要说", value: lens.say || "用自己的话讲出你掌握的信息。", derived: "当前课程内容"},
          {label: "我要问", value: lens.ask || "听队友说完，再追问一件不清楚的事。", derived: "当前课程内容"},
          {label: "完成后", value: lens.done || "让导师看见一个具体结果。", derived: "当前课程内容"},
        ],
        chipsTitle: "我已经拥有", chips: [`${learnerView?.cards?.length || 0} 张私密卡`, `${learnerView?.unlockIds?.length || 0} 项解锁`, "一票团队发言权"],
        footerLeft: `${view.learnerCaseName} · 第 ${classroom.chapterOrder || 1}/${classroom.chapterCount || view.macroStepCount || 1} 章`,
        footerRight: `r${common.revision} · #${view.refreshEpoch ?? data.refreshEpoch ?? 0}${view.isPreview ? " · 回看" : ""}`,
      };
    }
    return {
      ...common, kicker: view.id === "mentor01" ? "主 DM · 总控主持" : `协作导师 · ${view.code} 专业线`,
      subidentity: view.spotlight === "active" ? "本块由你主导" : "本块观察支援，不抢讲",
      taskTitle: "现在做什么", task: view.task, action: `${view.blockId}「${view.blockTitle}」`, result: view.headline,
      resultState: data.status === "ready" ? "wait" : data.status === "error" ? "error" : "",
      metrics: [
        {value: `${classroom.mentorCount || 0}/${classroom.learnerCount || 0}`, label: "导师 / 学员"},
        {value: `${classroom.chapterOrder || 1}/${classroom.chapterCount || view.macroStepCount || 1}`, label: "历史章节"},
        {value: `${((classroom.teamTreasuryTenths || 0) / 10).toFixed(1)} C`, label: "团队资金"},
      ],
      factsTitle: "主持 / 验收信息", facts: [
        {value: view.spotlight === "active" ? "本块由你主导；其他导师只观察支援。" : "只记录本专业线索，不提前讲出后续答案。", derived: "当前席位状态"},
        {value: "只有课程中控人工验收后才会进入下一块。", derived: "课堂状态机"},
        {value: `真实课堂：${classroom.phase || "lobby"} · 随机手牌 ${classroom.uniqueDealtCards || 0}/12`, derived: "真实课堂状态"},
      ],
      teamworkTitle: "观察重点", teamwork: [
        {label: "当前任务", value: view.task, derived: "当前课程内容"},
        {label: "团队可见", value: `${classroom.publishedCards || 0} 张卡已讲出，${classroom.challengeActions || 0} 项行动已提交。`, derived: "真实课堂状态"},
      ],
      chipsTitle: "导师工具", chips: [view.badge, `${view.code} 专业线`, "一次只突出一名导师"],
      footerLeft: classroom.teamPublicId ? `${classroom.teamPublicId} · ${view.caseName}` : `${view.caseName} · 尚未建房`,
      footerRight: `r${common.revision} · #${view.refreshEpoch ?? data.refreshEpoch ?? 0} · v${data.version}`,
    };
  }

  function runtimeControllerView(script, state, index, guide) {
    const block = script.blocks[index];
    const step = script.macroSteps.find((item) => item.id === block.macroStepId);
    const lead = script.formula.fourMentors.find((item) => item.id === block.leadMentorId);
    return {
      preview: index !== state.currentBlockIndex, editorPreview: false, status: state.status, block, step, lead, guide,
      blockPath: null, stepPath: null, caseName: script.case.name,
      revision: state.courseRevision ?? 0, digest: state.courseDigest || "",
    };
  }

  root.MsvCoursePreview = Object.freeze({
    LEGACY_LEARNER_POLICY, learnerPolicy, learnersForCourse, STATUS_LABELS, FIELD_LABELS, MODE_LABELS, hash32, randomFromSeed,
    privateDeckForBlock, deterministicDeal, flattenCards, blockWarnings, projectCourse,
    renderSeatSurface, renderControllerSurface, runtimeSeatView, runtimeControllerView,
  });
})();
