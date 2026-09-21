(function () {
  "use strict";

  const model = window.MSV_MODULE_DECK;
  if (!model) throw new Error("MSV_MODULE_DECK 未加载");

  const params = new URLSearchParams(location.search);
  const session = sanitizeSession(params.get("session")) || "direct";
  const controlled = params.get("controlled") === "1";
  const storageKey = `msv:${model.id}:${model.version}:${session}`;
  const channelName = `msv:${model.id}:${model.version}:${session}`;
  const deck = document.getElementById("deck");
  const status = document.getElementById("audience-status");
  let channel = null;
  let state = initialState();
  let renderVersion = 0;
  const textEdits = window.MSVTextEditions?.create({model,teacher:false,getSession:()=>session,rerender:render});

  function sanitizeSession(value) {
    return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : "";
  }

  function maxReveal(index) {
    const html = model.slides[index]?.content || "";
    return (html.match(/data-reveal/g) || []).length;
  }

  function normalize(next) {
    const idIndex = next?.slide === undefined ? model.slides.findIndex(item => item.id === next?.slideId) : -1;
    const rawIndex = Number(next?.slide);
    const slide = idIndex >= 0 ? idIndex : Math.max(0, Math.min(model.slides.length - 1, Number.isFinite(rawIndex) ? Math.floor(rawIndex) : 0));
    const reveal = Math.max(0, Math.min(maxReveal(slide), Number(next?.reveal) || 0));
    const transformCase = ["car", "plane", "robot"].includes(next?.activity?.transformCase) ? next.activity.transformCase : "car";
    const buildStep = ["parts", "components", "works"].includes(next?.activity?.buildStep) ? next.activity.buildStep : "parts";
    const voxelCase = ["car", "scope"].includes(next?.activity?.voxelCase) ? next.activity.voxelCase : "car";
    const voxelStep = ["blocks", "components", "object"].includes(next?.activity?.voxelStep) ? next.activity.voxelStep : "blocks";
    return { slide, slideId: model.slides[slide].id, reveal, activity: { transformCase, buildStep, voxelCase, voxelStep }, updatedAt: Date.now() };
  }

  function initialState() {
    const id = params.get("slideId");
    if (id && model.slides.some(slide => slide.id === id)) return normalize({slideId:id, reveal:params.get("step")});
    if (params.has("slide")) {
      const index = Number(params.get("slide"));
      const oldId = model.legacySlideIds?.[index];
      return normalize(oldId ? {slideId:oldId,reveal:params.get("step")} : {slide:index,reveal:params.get("step")});
    }
    try { return normalize(JSON.parse(localStorage.getItem(storageKey) || "null")); }
    catch { return normalize(null); }
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* private mode can deny storage */ }
  }

  function send(type, payload) {
    const message = { type, session, source: "audience", ...payload };
    if (channel) channel.postMessage(message);
    else try { localStorage.setItem(`${storageKey}:event`, JSON.stringify({ ...message, nonce: Math.random(), at: Date.now() })); } catch { /* no cross-window transport is available */ }
  }

  function render() {
    const version = ++renderVersion;
    const slide = model.slides[state.slide];
    deck.innerHTML = `
      <section class="deck-slide" data-slide-id="${slide.id}" data-source="${slide.source}" data-theme="${slide.theme || "paper"}">
        <header class="slide-topline">
          <span class="slide-code">${slide.source} · ${slide.phase || slide.section}</span>
          <img class="slide-brand" src="assets/mini-silicon-valley-logo-transparent.png" alt="MINI硅谷">
        </header>
        <div class="slide-heading"><h1>${slide.title}</h1><p>${slide.subtitle}</p></div>
        <div class="slide-body">${slide.content}</div>
        <div class="slide-footer">${model.footer || model.title}</div>
        <div class="slide-page">${String(state.slide + 1).padStart(2, "0")} / ${String(model.slides.length).padStart(2, "0")}</div>
        <div class="slide-progress" aria-hidden="true"><i style="width:${((state.slide + 1) / model.slides.length) * 100}%"></i></div>
      </section>`;
    deck.querySelectorAll("[data-reveal]").forEach((node, index) => node.classList.toggle("revealed", index < state.reveal));
    wireSlideInteractions();
    textEdits?.decorate(deck,state.slide);
    window.MSVLessonTools?.wireResources(deck);
    window.MSVLessonTools?.update(state.slide);
    document.title = `${slide.source} ${slide.title}｜${model.title}`;
    status.textContent = `AUDIENCE · ${controlled ? "PRESENTER" : "LOCAL"} · ${session}`;
    fit();
    mountThreeScenes(version);
  }

  function wireSlideInteractions() {
    const transformButtons = [...deck.querySelectorAll("button[data-transform-case]")];
    const transformStage = deck.querySelector("[data-transform-stage]");
    if (transformButtons.length && transformStage) {
      const selectTransform = (value, notify) => {
        const button = transformButtons.find((item) => item.dataset.transformCase === value) || transformButtons[0];
        const selected = button.dataset.transformCase;
        transformButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        transformStage.dataset.transformStage = selected;
        const scene = deck.querySelector('[data-module-3d="transform"]');
        if (scene) scene.setAttribute("data-module-3d-mode", selected);
        for (const role of ["wheel", "glass", "joint"]) {
          const target = deck.querySelector(`[data-transform-role="${role}"]`);
          if (target) target.textContent = button.dataset[role] || "待确认";
        }
        const feedback = deck.querySelector("[data-transform-feedback]");
        if (feedback) feedback.textContent = button.dataset.feedback || "已切换课堂示意";
        if (notify) setState({ ...state, activity: { ...state.activity, transformCase: selected } }, true);
      };
      selectTransform(state.activity.transformCase, false);
      transformButtons.forEach((button) => button.addEventListener("click", () => selectTransform(button.dataset.transformCase, true)));
    }

    const buildButtons = [...deck.querySelectorAll("button[data-build-step]")];
    const buildStage = deck.querySelector("[data-build-stage]");
    if (buildButtons.length && buildStage) {
      const selectBuildStep = (value, notify) => {
        const button = buildButtons.find((item) => item.dataset.buildStep === value) || buildButtons[0];
        const selected = button.dataset.buildStep;
        buildButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        buildStage.dataset.buildStage = selected;
        const scene = deck.querySelector('[data-module-3d="automation"]');
        if (scene) scene.setAttribute("data-module-3d-mode", selected);
        deck.querySelectorAll("[data-build-layer]").forEach((item) => item.toggleAttribute("data-active", item.dataset.buildLayer === selected));
        const feedback = deck.querySelector("[data-build-feedback]");
        if (feedback) feedback.textContent = button.dataset.feedback || "已切换观察层级";
        if (notify) setState({ ...state, activity: { ...state.activity, buildStep: selected } }, true);
      };
      selectBuildStep(state.activity.buildStep, false);
      buildButtons.forEach((button) => button.addEventListener("click", () => selectBuildStep(button.dataset.buildStep, true)));
    }

    const voxelCaseButtons = [...deck.querySelectorAll("button[data-voxel-case]")];
    const voxelStepButtons = [...deck.querySelectorAll("button[data-voxel-step]")];
    const voxelStage = deck.querySelector("[data-voxel-stage]");
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
        const scene = deck.querySelector('[data-module-3d="voxel"]');
        if (scene) scene.setAttribute("data-module-3d-mode", `${selectedCase}:${selectedStep}`);
        deck.querySelectorAll("[data-voxel-layer]").forEach((item) => item.toggleAttribute("data-active", item.dataset.voxelLayer === selectedStep));
        const objectName = deck.querySelector("[data-voxel-object-name]");
        if (objectName) objectName.textContent = caseButton.dataset.objectName || "功能对象";
        for (const key of ["one", "two", "three"]) {
          const target = deck.querySelector(`[data-voxel-material="${key}"]`);
          if (target) target.textContent = caseButton.dataset[`material${key[0].toUpperCase()}${key.slice(1)}`] || "待确认";
        }
        const feedback = deck.querySelector("[data-voxel-feedback]");
        const feedbackKey = `${selectedStep}Feedback`;
        if (feedback) feedback.textContent = caseButton.dataset[feedbackKey] || "已切换方块组合层级";
        if (notify) setState({ ...state, activity: { ...state.activity, voxelCase: selectedCase, voxelStep: selectedStep } }, true);
      };
      applyVoxel(state.activity.voxelCase, state.activity.voxelStep, false);
      voxelCaseButtons.forEach((button) => button.addEventListener("click", () => applyVoxel(button.dataset.voxelCase, state.activity.voxelStep, true)));
      voxelStepButtons.forEach((button) => button.addEventListener("click", () => applyVoxel(state.activity.voxelCase, button.dataset.voxelStep, true)));
    }

    const inputs = [...deck.querySelectorAll("[data-blackbox-case]")];
    const outputs = [...deck.querySelectorAll("[data-blackbox-output]")];
    const statusNode = deck.querySelector("[data-blackbox-status]");
    if (!inputs.length || !outputs.length || !statusNode) return;
    inputs.forEach((input) => input.addEventListener("click", () => {
      const index = Number(input.dataset.blackboxCase);
      inputs.forEach((item) => item.setAttribute("aria-pressed", String(item === input)));
      outputs.forEach((item, outputIndex) => item.toggleAttribute("data-active", outputIndex === index));
      const output = outputs[index];
      const result = output?.dataset.result;
      const value = output?.querySelector("b");
      if (result && value) value.textContent = result;
      statusNode.textContent = input.dataset.feedback || "已完成一次黑箱测试";
    }));
  }

  function mountThreeScenes(version) {
    if (!deck.querySelector("[data-module-3d]")) return;
    import("./module-3d.js")
      .then((module) => { if (version === renderVersion) module.mountModuleScenes(deck); })
      .catch((error) => console.warn("3D 课堂示意加载失败，已保留 HTML 降级图。", error));
  }

  function setState(next, notify) {
    state = normalize(next);
    persist();
    render();
    if (notify) send("state", { state });
  }

  function advance() {
    const limit = maxReveal(state.slide);
    if (state.reveal < limit) setState({ ...state, reveal: state.reveal + 1 }, true);
    else if (state.slide < model.slides.length - 1) setState({ slide: state.slide + 1, reveal: 0 }, true);
  }

  function back() {
    if (state.reveal > 0) setState({ ...state, reveal: state.reveal - 1 }, true);
    else if (state.slide > 0) setState({ slide: state.slide - 1, reveal: maxReveal(state.slide - 1) }, true);
  }

  function fit() {
    const scale = Math.min(innerWidth / 1600, innerHeight / 900);
    deck.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function acceptMessage(message) {
    if (!message || message.session !== session || message.source === "audience") return;
    if (message.type === "state" && message.state) setState(message.state, false);
    if (message.type === "ping") send("pong", { state });
  }

  try {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (event) => acceptMessage(event.data);
  } catch { /* storage-event fallback remains available */ }
  addEventListener("storage", (event) => {
    if (event.key !== `${storageKey}:event` || !event.newValue) return;
    try { acceptMessage(JSON.parse(event.newValue)); } catch { /* ignore malformed external storage events */ }
  });
  addEventListener("resize", fit);
  addEventListener("keydown", (event) => {
    if (event.target instanceof Element) {
      if (event.target.closest("input,textarea,select,[contenteditable=true]")) return;
      if ([" ","Enter"].includes(event.key) && event.target.closest("button,a,summary")) return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); advance(); }
    if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); back(); }
    if (event.key === "Home") setState({ slide: 0, reveal: 0 }, true);
    if (event.key === "End") setState({ slide: model.slides.length - 1, reveal: maxReveal(model.slides.length - 1) }, true);
  });
  document.getElementById("prev").addEventListener("click", back);
  document.getElementById("advance").addEventListener("click", advance);
  document.getElementById("next").addEventListener("click", () => setState({ slide: Math.min(model.slides.length - 1, state.slide + 1), reveal: 0 }, true));
  document.getElementById("fullscreen").addEventListener("click", () => document.documentElement.requestFullscreen?.());

  render();
  send("ready", { state });
  setInterval(() => send("heartbeat", { state }), 2000);
  window.MSVModuleDeckController = Object.freeze({
    session,
    getState: () => ({ ...state }),
    setState: (next) => setState(next, true),
    advance,
    back,
  });
})();
