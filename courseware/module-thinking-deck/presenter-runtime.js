(function () {
  "use strict";
  const model = window.MSV_MODULE_DECK;
  const notes = window.MSV_MODULE_PRESENTER_NOTES;
  if (!model || !notes) throw new Error("教师视图数据未完整加载");

  const params = new URLSearchParams(location.search);
  let session = sanitizeSession(params.get("session")) || createSession();
  const storageKey = () => `msv:module-thinking:${model.version}:${session}`;
  const eventKey = () => `${storageKey()}:event`;
  const channelName = () => `msv:module-thinking:${model.version}:${session}`;
  let state = readState();
  let channel = null;
  let audienceWindow = null;
  let lastAudienceSignal = 0;

  function sanitizeSession(value) { return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : ""; }
  function createSession() { return `run-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,8)}`; }
  function maxReveal(index) { return ((model.slides[index]?.content || "").match(/data-reveal/g) || []).length; }
  function normalize(next) {
    const slide = Math.max(0, Math.min(model.slides.length - 1, Number(next?.slide) || 0));
    const reveal = Math.max(0, Math.min(maxReveal(slide), Number(next?.reveal) || 0));
    const transformCase = ["car", "plane", "robot"].includes(next?.activity?.transformCase) ? next.activity.transformCase : "car";
    const buildStep = ["parts", "components", "works"].includes(next?.activity?.buildStep) ? next.activity.buildStep : "parts";
    const voxelCase = ["car", "scope"].includes(next?.activity?.voxelCase) ? next.activity.voxelCase : "car";
    const voxelStep = ["blocks", "components", "object"].includes(next?.activity?.voxelStep) ? next.activity.voxelStep : "blocks";
    return { slide, reveal, activity: { transformCase, buildStep, voxelCase, voxelStep }, updatedAt: Date.now() };
  }
  function readState() { try { return normalize(JSON.parse(localStorage.getItem(storageKey()) || "null")); } catch { return normalize(null); } }
  function persist() { try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch { /* private mode can deny storage */ } }
  function setUrl() {
    const url = new URL(location.href); url.searchParams.set("session", session); history.replaceState(null, "", url);
    document.getElementById("session-label").textContent = session;
  }
  function connectChannel() {
    channel?.close?.(); channel = null;
    try { channel = new BroadcastChannel(channelName()); channel.onmessage = event => acceptMessage(event.data); } catch { /* storage-event fallback remains available */ }
  }
  function send(type, payload) {
    const message = { type, session, source: "presenter", ...payload };
    if (channel) channel.postMessage(message);
    else try { localStorage.setItem(eventKey(), JSON.stringify({ ...message, nonce: Math.random(), at: Date.now() })); } catch { /* no cross-window transport is available */ }
  }
  function acceptMessage(message) {
    if (!message || message.session !== session || message.source === "presenter") return;
    if (["ready","heartbeat","pong","state"].includes(message.type)) {
      lastAudienceSignal = Date.now();
      if (message.type === "ready") send("state", { state });
      updateConnection();
    }
    if (message.type === "state" && message.state) {
      state = normalize(message.state); persist(); render();
    }
  }
  function updateConnection() {
    const online = Date.now() - lastAudienceSignal < 5500;
    const node = document.getElementById("connection");
    node.className = `connection ${online ? "online" : "offline"}`;
    node.textContent = online ? "投屏已连接" : "投屏未连接";
  }
  function setState(next) { state = normalize(next); persist(); render(); send("state", { state }); }
  function advance() {
    const limit = maxReveal(state.slide);
    if (state.reveal < limit) setState({ ...state, reveal: state.reveal + 1 });
    else if (state.slide < model.slides.length - 1) setState({ slide: state.slide + 1, reveal: 0 });
  }
  function back() {
    if (state.reveal > 0) setState({ ...state, reveal: state.reveal - 1 });
    else if (state.slide > 0) setState({ slide: state.slide - 1, reveal: maxReveal(state.slide - 1) });
  }
  function directSlide(delta) { setState({ slide: Math.max(0, Math.min(model.slides.length - 1, state.slide + delta)), reveal: 0 }); }

  function slideMarkup(slide, index) {
    return `<section class="deck-slide" data-slide-id="${slide.id}" data-source="${slide.source}" data-theme="${slide.theme || "paper"}">
      <header class="slide-topline"><span class="slide-code">${slide.source} · ${slide.section}</span><img class="slide-brand" src="assets/mini-silicon-valley-logo-transparent.png" alt="MINI硅谷"></header>
      <div class="slide-heading"><h1>${slide.title}</h1><p>${slide.subtitle}</p></div>
      <div class="slide-body">${slide.content}</div>
      <div class="slide-footer">模块思维 · 先体验，再命名</div>
      <div class="slide-page">${String(index + 1).padStart(2,"0")} / ${String(model.slides.length).padStart(2,"0")}</div>
      <div class="slide-progress"><i style="width:${((index + 1)/model.slides.length)*100}%"></i></div>
    </section>`;
  }
  function wirePreviewInteractions(stage, interactive) {
    const transformButtons = [...stage.querySelectorAll("[data-transform-case]")];
    const transformStage = stage.querySelector("[data-transform-stage]");
    if (transformButtons.length && transformStage) {
      const selectTransform = (value, notify) => {
        const button = transformButtons.find((item) => item.dataset.transformCase === value) || transformButtons[0];
        const selected = button.dataset.transformCase;
        transformButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        transformStage.dataset.transformStage = selected;
        const scene = stage.querySelector('[data-module-3d="transform"]');
        if (scene) scene.setAttribute("data-module-3d-mode", selected);
        for (const role of ["wheel", "glass", "joint"]) {
          const target = stage.querySelector(`[data-transform-role="${role}"]`);
          if (target) target.textContent = button.dataset[role] || "待确认";
        }
        const feedback = stage.querySelector("[data-transform-feedback]");
        if (feedback) feedback.textContent = button.dataset.feedback || "已切换课堂示意";
        if (notify) setState({ ...state, activity: { ...state.activity, transformCase: selected } });
      };
      selectTransform(state.activity.transformCase, false);
      if (interactive) transformButtons.forEach((button) => button.addEventListener("click", () => selectTransform(button.dataset.transformCase, true)));
    }

    const buildButtons = [...stage.querySelectorAll("[data-build-step]")];
    const buildStage = stage.querySelector("[data-build-stage]");
    if (buildButtons.length && buildStage) {
      const selectBuildStep = (value, notify) => {
        const button = buildButtons.find((item) => item.dataset.buildStep === value) || buildButtons[0];
        const selected = button.dataset.buildStep;
        buildButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        buildStage.dataset.buildStage = selected;
        const scene = stage.querySelector('[data-module-3d="automation"]');
        if (scene) scene.setAttribute("data-module-3d-mode", selected);
        stage.querySelectorAll("[data-build-layer]").forEach((item) => item.toggleAttribute("data-active", item.dataset.buildLayer === selected));
        const feedback = stage.querySelector("[data-build-feedback]");
        if (feedback) feedback.textContent = button.dataset.feedback || "已切换观察层级";
        if (notify) setState({ ...state, activity: { ...state.activity, buildStep: selected } });
      };
      selectBuildStep(state.activity.buildStep, false);
      if (interactive) buildButtons.forEach((button) => button.addEventListener("click", () => selectBuildStep(button.dataset.buildStep, true)));
    }

    const voxelCaseButtons = [...stage.querySelectorAll("[data-voxel-case]")];
    const voxelStepButtons = [...stage.querySelectorAll("[data-voxel-step]")];
    const voxelStage = stage.querySelector("[data-voxel-stage]");
    if (voxelCaseButtons.length && voxelStepButtons.length && voxelStage) {
      const applyVoxel = (caseValue, stepValue, notify) => {
        const caseButton = voxelCaseButtons.find((item) => item.dataset.voxelCase === caseValue) || voxelCaseButtons[0];
        const stepButton = voxelStepButtons.find((item) => item.dataset.voxelStep === stepValue) || voxelStepButtons[0];
        const selectedCase = caseButton.dataset.voxelCase;
        const selectedStep = stepButton.dataset.voxelStep;
        voxelCaseButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === caseButton)));
        voxelStepButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === stepButton)));
        voxelStage.dataset.voxelCase = selectedCase;
        voxelStage.dataset.voxelStep = selectedStep;
        const scene = stage.querySelector('[data-module-3d="voxel"]');
        if (scene) scene.setAttribute("data-module-3d-mode", `${selectedCase}:${selectedStep}`);
        stage.querySelectorAll("[data-voxel-layer]").forEach((item) => item.toggleAttribute("data-active", item.dataset.voxelLayer === selectedStep));
        const objectName = stage.querySelector("[data-voxel-object-name]");
        if (objectName) objectName.textContent = caseButton.dataset.objectName || "功能对象";
        for (const key of ["one", "two", "three"]) {
          const target = stage.querySelector(`[data-voxel-material="${key}"]`);
          if (target) target.textContent = caseButton.dataset[`material${key[0].toUpperCase()}${key.slice(1)}`] || "待确认";
        }
        const feedback = stage.querySelector("[data-voxel-feedback]");
        const feedbackKey = `${selectedStep}Feedback`;
        if (feedback) feedback.textContent = caseButton.dataset[feedbackKey] || "已切换方块组合层级";
        if (notify) setState({ ...state, activity: { ...state.activity, voxelCase: selectedCase, voxelStep: selectedStep } });
      };
      applyVoxel(state.activity.voxelCase, state.activity.voxelStep, false);
      if (interactive) {
        voxelCaseButtons.forEach((button) => button.addEventListener("click", () => applyVoxel(button.dataset.voxelCase, state.activity.voxelStep, true)));
        voxelStepButtons.forEach((button) => button.addEventListener("click", () => applyVoxel(state.activity.voxelCase, button.dataset.voxelStep, true)));
      }
    }
  }
  function renderPreview(container, index, reveal, interactive = false) {
    if (index < 0 || index >= model.slides.length) { container.innerHTML = '<div class="preview-empty">课程结束</div>'; return; }
    const stage = document.createElement("div"); stage.className = "mini-slide-stage";
    stage.innerHTML = slideMarkup(model.slides[index], index);
    stage.querySelectorAll("[data-reveal]").forEach((node, i) => node.classList.toggle("revealed", i < reveal));
    wirePreviewInteractions(stage, interactive);
    container.replaceChildren(stage);
    import("./module-3d.js")
      .then((module) => { if (stage.isConnected) module.mountModuleScenes(stage); })
      .catch((error) => console.warn("3D 课堂示意加载失败，已保留 HTML 降级图。", error));
    requestAnimationFrame(() => {
      const scale = Math.min(container.clientWidth / 1600, container.clientHeight / 900);
      stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    });
  }
  function fillList(id, values, ordered) {
    const node = document.getElementById(id); node.innerHTML = "";
    values.forEach(value => { const item = document.createElement("li"); item.textContent = value; node.append(item); });
    if (!values.length) node.innerHTML = ordered ? "<li>无</li>" : "<li>暂无</li>";
  }
  function renderNotes(slide) {
    const note = notes[slide.id];
    document.getElementById("note-source").textContent = slide.source;
    document.getElementById("note-time").textContent = note.minutes;
    document.getElementById("note-goal").textContent = note.goal;
    fillList("note-script", note.script, true);
    fillList("note-acceptable", note.acceptable, false);
    document.getElementById("note-reward").textContent = note.reward;
    document.getElementById("note-acceptance").textContent = note.acceptance;
    document.getElementById("note-misconception").textContent = note.misconception;
    document.getElementById("note-materials").textContent = note.materials;
  }
  function renderList() {
    const nav = document.getElementById("slide-list");
    if (!nav.childElementCount) {
      model.slides.forEach((slide, index) => {
        const button = document.createElement("button");
        button.type = "button"; button.className = "slide-list-button"; button.dataset.index = index;
        button.innerHTML = `<span class="code">${slide.source}</span><span class="name">${slide.title}</span>`;
        button.addEventListener("click", () => setState({ slide: index, reveal: 0 }));
        nav.append(button);
      });
    }
    nav.querySelectorAll("button").forEach((button, index) => {
      button.classList.toggle("active", index === state.slide);
      if (index === state.slide) button.scrollIntoView({ block: "nearest" });
    });
  }
  function render() {
    const slide = model.slides[state.slide];
    renderPreview(document.getElementById("current-preview"), state.slide, state.reveal, true);
    renderPreview(document.getElementById("next-preview"), state.slide + 1, 0);
    document.getElementById("current-title").textContent = `${slide.source} · ${slide.title} · 揭示 ${state.reveal}/${maxReveal(state.slide)}`;
    document.getElementById("next-title").textContent = model.slides[state.slide + 1]?.title || "课程结束";
    document.getElementById("rail-progress").textContent = `${String(state.slide + 1).padStart(2,"0")} / ${model.slides.length}`;
    renderList(); renderNotes(slide);
  }
  function audienceUrl() {
    const raw = document.documentElement.dataset.audienceUrl || "./index.html";
    const url = new URL(raw, location.href); url.searchParams.set("session", session); url.searchParams.set("controlled", "1"); return url.href;
  }
  function openAudience() {
    audienceWindow = window.open(audienceUrl(), `msv-module-audience-${session}`, "popup=yes,width=1280,height=720,resizable=yes");
    if (!audienceWindow) {
      const button = document.getElementById("open-audience");
      button.textContent = "弹窗被拦截，请再次点击"; button.classList.remove("primary");
      return;
    }
    document.getElementById("open-audience").textContent = "重新聚焦投屏";
    setTimeout(() => send("ping", {}), 350);
  }
  function newSession() {
    session = createSession(); state = normalize(null); lastAudienceSignal = 0;
    setUrl(); connectChannel(); persist(); render(); updateConnection();
    document.getElementById("open-audience").textContent = "打开投屏窗口";
  }

  setUrl(); connectChannel(); render(); updateConnection();
  addEventListener("resize", render);
  addEventListener("storage", event => { if (event.key === eventKey() && event.newValue) try { acceptMessage(JSON.parse(event.newValue)); } catch { /* ignore malformed external storage events */ } });
  addEventListener("keydown", event => {
    if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (event.key.toLowerCase() === "o") { event.preventDefault(); openAudience(); }
    else if (event.key === "ArrowRight" && event.shiftKey) { event.preventDefault(); directSlide(1); }
    else if (event.key === "ArrowLeft" && event.shiftKey) { event.preventDefault(); directSlide(-1); }
    else if (["ArrowRight","PageDown"," "].includes(event.key)) { event.preventDefault(); advance(); }
    else if (["ArrowLeft","PageUp","Backspace"].includes(event.key)) { event.preventDefault(); back(); }
  });
  document.getElementById("open-audience").addEventListener("click", openAudience);
  document.getElementById("new-session").addEventListener("click", newSession);
  document.getElementById("prev-step").addEventListener("click", back);
  document.getElementById("reveal").addEventListener("click", advance);
  document.getElementById("next-slide").addEventListener("click", () => directSlide(1));
  document.getElementById("reset-reveal").addEventListener("click", () => setState({ ...state, reveal: 0 }));
  setInterval(() => { send("ping", {}); updateConnection(); }, 2500);
  window.MSVModulePresenterController = Object.freeze({ getState: () => ({...state}), setState, openAudience, getSession: () => session });
})();
