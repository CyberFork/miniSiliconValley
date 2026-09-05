(() => {
  "use strict";

  let token;
  let courses = [];
  let script;
  let state;
  const APP_BASE = new URL(".", window.location.href);
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]),
  );
  const STATUS = {
    ready: "待执行",
    executing: "同步中",
    "awaiting-acceptance": "待人工验收",
    error: "已停住",
    completed: "全程完成",
  };
  const FIELD = {
    historyTrack: "历史学习轨｜当时能知道什么",
    realityTrack: "现实实践轨｜今天要带走什么",
    mentorScript: "当值导师逐句口播",
    studentActions: "四名学员现场动作",
    systemActions: "执行本块后系统会同步",
    props: "本块道具",
    evidenceGate: "人工验收门｜必须亲眼看见",
    fallback: "卡住时怎么兜底",
    manualInteraction: "线下与八窗怎样配合",
  };

  let confirmationPromise = null;

  function askConfirmation({ title, body, confirmLabel, tone = "default" }) {
    const dialog = $("#confirmDialog");
    const form = $("#confirmForm");
    const cancelButton = $("#confirmCancel");
    const confirmButton = $("#confirmSubmit");
    if (confirmationPromise) return confirmationPromise;

    dialog.returnValue = "";
    dialog.dataset.tone = tone;
    $("#confirmTitle").textContent = title;
    $("#confirmBody").textContent = body;
    confirmButton.textContent = confirmLabel;
    dialog.showModal();
    window.requestAnimationFrame(() => cancelButton.focus());

    confirmationPromise = new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        form.removeEventListener("submit", handleSubmit);
        dialog.removeEventListener("close", handleClose);
        confirmationPromise = null;
        resolve(value);
      };
      const handleClose = () => settle(false);
      const handleSubmit = (event) => {
        event.preventDefault();
        dialog.close("confirm");
        settle(true);
      };
      form.addEventListener("submit", handleSubmit);
      dialog.addEventListener("close", handleClose);
    });
    return confirmationPromise;
  }

  function endpoint(path) {
    return new URL(String(path).replace(/^\/+/, ""), APP_BASE);
  }

  function handleExpiredSession(response) {
    if (response.status === 401) {
      window.location.assign(new URL("../auth/login?returnTo=/control/", APP_BASE));
      return true;
    }
    return false;
  }

  async function get(url) {
    const response = await fetch(endpoint(url), { cache: "no-store", credentials: "same-origin" });
    if (handleExpiredSession(response)) throw new Error("登录已失效，正在返回登录页。 ");
    const envelope = await response.json();
    if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message || "请求失败");
    return envelope.data;
  }

  async function control(action, details = {}) {
    const response = await fetch(endpoint("api/control"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Live-Run-Token": token },
      credentials: "same-origin",
      body: JSON.stringify({ action, ...details }),
    });
    if (handleExpiredSession(response)) throw new Error("登录已失效，正在返回登录页。 ");
    const envelope = await response.json();
    if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message || "操作失败");
    state = envelope.data;
    if (!script || state.scriptId !== script.id) script = await get("api/script");
    render();
  }

  function content(value) {
    if (Array.isArray(value)) return `<ol>${value.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`;
    return `<p>${esc(value)}</p>`;
  }

  function section(key, value) {
    return `<section class="script-section"><div class="label">${esc(FIELD[key])}</div>${content(value)}</section>`;
  }

  function instruction(status, block) {
    if (status === "ready") {
      return {
        title: `现在：先读 ${block.id}，再点击“执行当前块”`,
        body: "确认当值导师、现场道具和 8 个席位都已就绪。执行只同步本块，不会自动进入下一块。",
      };
    }
    if (status === "executing") {
      return { title: "现在：系统正在同步 8 个席位", body: "不要重复点击。完成后本页会自动进入“待人工验收”。" };
    }
    if (status === "awaiting-acceptance") {
      return {
        title: "现在：离开主控，观察学员行动与现场证据",
        body: "逐项核对下方“人工验收门”。只有真实动作和证据都出现后，才点击“人工验收通过”。",
      };
    }
    if (status === "error") {
      return { title: "现在：保留现场，先看清错误", body: "已有身份、手牌、RP 和资金不会清空。处理原因后先点“错误重试”，再重新执行当前块。" };
    }
    return { title: "本次课程已经完成", body: `${script.blocks.length} 个块均由人手动执行并验收；请查看 Demo、个人成长与团队账本。` };
  }

  function renderCoursePicker() {
    const selected = script.course;
    $("#courseCoverage").textContent = selected.coverage;
    $("#courseDescription").textContent = `${selected.description}｜${script.case.why}`;
    $("#courseOptions").innerHTML = courses.map((course) => {
      const active = course.id === selected.id;
      return `<button type="button" class="course-option" data-course-id="${esc(course.id)}" aria-pressed="${active}" ${state.status === "executing" ? "disabled" : ""}>
        <b>${esc(course.name)}</b><span>${esc(course.coverage)}</span><small>${esc(course.period)} · r${esc(course.publishedRevision ?? 0)} · ${active ? "当前课程" : "点击开始新 Run"}</small>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-course-id]").forEach((button) => {
      button.onclick = async () => {
        const courseId = button.dataset.courseId;
        if (!courseId || courseId === state.courseId) return;
        const started = Boolean(state.currentBlockIndex || state.classroom?.roomId || state.blocks?.some((item) => item.attempts));
        const confirmReset = !started || await askConfirmation({
          title: "切换到新课程？",
          body: "这会创建一场全新的 Run。当前 API 课堂会保留作审计，但不会继续显示。",
          confirmLabel: "确认切换",
          tone: "danger",
        });
        if (!confirmReset) return;
        try {
          await control("select-course", { courseId, confirmReset: started });
        } catch (error) {
          $("#message").textContent = error.message;
          $("#message").className = "error";
        }
      };
    });
  }

  function renderNavigation(block, index) {
    $("#macroNav").style.setProperty("--macro-count", script.macroSteps.length);
    $("#macroNav").innerHTML = script.macroSteps.map((macro) => {
      const last = script.blocks.map((item) => item.macroStepId).lastIndexOf(macro.id);
      const className = macro.id === block.macroStepId ? "active" : last < index ? "passed" : "locked";
      return `<button class="${className}" disabled>${macro.order}. ${esc(macro.name)}<small>${esc(macro.question)}</small></button>`;
    }).join("");
    $("#blockNav").innerHTML = script.blocks.map((item, itemIndex) => {
      const blockState = state.blocks[itemIndex]?.status || "locked";
      return `<button class="${itemIndex === index ? "active" : ""} ${esc(blockState)}" disabled title="${esc(item.title)}">${String(item.order).padStart(2, "0")}<small>${esc(item.title)}</small></button>`;
    }).join("");
  }

  function render() {
    const index = state.currentBlockIndex;
    const block = script.blocks[index];
    const macro = script.macroSteps.find((item) => item.id === block.macroStepId);
    const lead = script.formula.fourMentors.find((item) => item.id === block.leadMentorId);
    const guide = instruction(state.status, block);
    $("#runStatus").textContent = STATUS[state.status] || state.status;
    $("#runStatus").dataset.status = state.status;
    renderCoursePicker();
    renderNavigation(block, index);
    $("#block").innerHTML = `
      <div class="block-head">
        <div><div class="label">${esc(script.case.name)} · 第 ${macro.order} 步 · ${esc(macro.name)} / ${block.id}</div><h2>${esc(block.title)}</h2></div>
        <div class="block-meta"><b>${esc(block.suggestedMinutes)} 分钟</b><span>当值导师 ${esc(lead ? `${lead.code} · ${lead.name}` : block.leadMentorId)}</span></div>
      </div>
      <aside class="next-action" data-status="${esc(state.status)}"><strong>${esc(guide.title)}</strong><p>${esc(guide.body)}</p></aside>
      <section class="learner-brief"><div class="label">给学员的一句话</div><p>${esc(block.studentPrompt)}</p><div class="mode-row">${block.gameModes.map((mode) => `<span>${esc({ yarn: "毛线信息", american: "美式攻坚", euro: "德式经营" }[mode] || mode)}</span>`).join("")}</div></section>
      <div class="grid">${[
        "historyTrack", "realityTrack", "mentorScript", "studentActions", "systemActions",
        "props", "evidenceGate", "fallback", "manualInteraction",
      ].map((key) => section(key, block[key])).join("")}</div>
    `;

    $("#execute").disabled = state.status !== "ready";
    $("#accept").disabled = state.status !== "awaiting-acceptance";
    $("#retry").disabled = state.status !== "error";
    const error = typeof state.error === "string" ? state.error : state.error?.message;
    $("#message").textContent = error || (state.status === "awaiting-acceptance" ? "系统同步完成，但课程还没有前进：请先完成现场验收。" : "");
    $("#message").className = error ? "error" : "";
  }

  async function init() {
    try {
      const data = await get("api/bootstrap");
      token = data.token;
      courses = data.courseCatalog;
      script = data.script;
      state = data.state;
      render();
      setInterval(async () => {
        try {
          const nextState = await get("api/state");
          if (!script || nextState.scriptId !== script.id) script = await get("api/script");
          state = nextState;
          render();
        } catch {
          // A later successful heartbeat restores the view; do not destroy the
          // current script while a single request is in flight.
        }
      }, 1000);
    } catch (error) {
      $("#message").textContent = error.message;
      $("#message").className = "error";
    }
  }

  [["execute", "execute"], ["accept", "accept"], ["retry", "retry"]].forEach(([id, action]) => {
    $("#" + id).onclick = () => control(action).catch((error) => {
      $("#message").textContent = error.message;
      $("#message").className = "error";
    });
  });
  $("#confirmCancel").onclick = () => $("#confirmDialog").close("cancel");
  $("#reset").onclick = async () => {
    const confirmed = await askConfirmation({
      title: `重置《${script.course.name}》？`,
      body: "当前 LIVE RUN SCRIPT 进度会清空并加载该课程最新已发布 JSON，但不会删除已创建的隔离课堂。",
      confirmLabel: "确认重置",
      tone: "danger",
    });
    if (!confirmed) return;
    control("reset").catch((error) => {
      $("#message").textContent = error.message;
      $("#message").className = "error";
    });
  };
  init();
})();
