(() => {
  "use strict";

  let token;
  let courses = [];
  let script;
  let state;
  let loadedDigest = "";
  const APP_BASE = new URL(".", window.location.href);
  const $ = (selector) => document.querySelector(selector);
  const Preview = window.MsvCoursePreview;
  if (!Preview) throw new Error("共享课程渲染器未加载");
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
    if (!script || state.scriptId !== script.id || loadedDigest !== state.courseDigest) {
      script = await get("api/script"); loadedDigest = state.courseDigest;
    }
    render();
  }

  function instruction(status, block, isPreview = false) {
    if (isPreview) {
      return {
        title: `调试回看：${block.id} 只重现内容，不撤销真实动作`,
        body: "八个席位已同步到这一块供检查。抽卡、提交、RP、资金和账本全部保留；回到真实当前块后才能执行或验收。",
      };
    }
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
    const index = Number.isInteger(state.previewBlockIndex) ? state.previewBlockIndex : state.currentBlockIndex;
    const isPreview = index !== state.currentBlockIndex;
    const block = script.blocks[index];
    const guide = instruction(state.status, block, isPreview);
    $("#runStatus").textContent = STATUS[state.status] || state.status;
    $("#runStatus").dataset.status = state.status;
    const update = state.courseUpdate || {};
    $("#versionPanel").dataset.pending = String(Boolean(update.updateAvailable));
    $("#versionPanel").innerHTML = `<div><b>当前 Run · r${esc(update.activeRevision ?? state.courseRevision ?? 0)}</b><span>${esc(update.activeDigest || String(state.courseDigest || "").slice(0,16))} · ${esc(update.activeVariant || state.courseVariant || "published")}</span></div><div><b>编辑器最新 · ${update.latestRevision == null ? "读取失败" : `r${esc(update.latestRevision)}`}</b><span>${esc(update.latestDigest || "—")} ${update.updateAvailable ? "· 有更新待加载" : "· 已一致"}</span></div><div><b>真实位置 ${esc(script.blocks[state.currentBlockIndex]?.id)}</b><span>${isPreview ? `正在回看 ${esc(block.id)} · 未回滚数据` : "当前显示与真实位置一致"} · 刷新信号 ${esc(state.refreshEpoch || 0)}</span></div>`;
    renderCoursePicker();
    renderNavigation(block, index);
    $("#block").innerHTML = Preview.renderControllerSurface(
      Preview.runtimeControllerView(script, state, index, guide),
      {editable: false},
    );

    $("#previewBack").disabled = state.status === "executing" || index <= 0;
    $("#previewForward").disabled = state.status === "executing" || index >= state.currentBlockIndex;
    $("#refreshCourse").disabled = state.status === "executing";
    $("#refreshCourse").classList.toggle("pending", Boolean(update.updateAvailable));
    $("#execute").disabled = isPreview || state.status !== "ready";
    $("#accept").disabled = isPreview || state.status !== "awaiting-acceptance";
    $("#retry").disabled = isPreview || state.status !== "error";
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
      loadedDigest = state.courseDigest;
      render();
      setInterval(async () => {
        try {
          const nextState = await get("api/state");
          if (!script || nextState.scriptId !== script.id || loadedDigest !== nextState.courseDigest) {
            script = await get("api/script"); loadedDigest = nextState.courseDigest;
          }
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
  [["previewBack", "preview-back"], ["previewForward", "preview-forward"], ["refreshCourse", "refresh-course"]].forEach(([id, action]) => {
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
