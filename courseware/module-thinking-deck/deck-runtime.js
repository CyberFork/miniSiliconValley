(function () {
  "use strict";

  const model = window.MSV_MODULE_DECK;
  if (!model) throw new Error("MSV_MODULE_DECK 未加载");

  const params = new URLSearchParams(location.search);
  const session = sanitizeSession(params.get("session")) || "direct";
  const controlled = params.get("controlled") === "1";
  const storageKey = `msv:module-thinking:${model.version}:${session}`;
  const channelName = `msv:module-thinking:${model.version}:${session}`;
  const deck = document.getElementById("deck");
  const status = document.getElementById("audience-status");
  let channel = null;
  let state = readState();
  let renderVersion = 0;

  function sanitizeSession(value) {
    return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : "";
  }

  function maxReveal(index) {
    const html = model.slides[index]?.content || "";
    return (html.match(/data-reveal/g) || []).length;
  }

  function normalize(next) {
    const slide = Math.max(0, Math.min(model.slides.length - 1, Number(next?.slide) || 0));
    const reveal = Math.max(0, Math.min(maxReveal(slide), Number(next?.reveal) || 0));
    const transformCase = ["car", "plane", "robot"].includes(next?.activity?.transformCase) ? next.activity.transformCase : "car";
    const buildStep = ["parts", "components", "works"].includes(next?.activity?.buildStep) ? next.activity.buildStep : "parts";
    return { slide, reveal, activity: { transformCase, buildStep }, updatedAt: Date.now() };
  }

  function readState() {
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
          <span class="slide-code">${slide.source} · ${slide.section}</span>
          <img class="slide-brand" src="assets/mini-silicon-valley-logo-transparent.png" alt="MINI硅谷">
        </header>
        <div class="slide-heading"><h1>${slide.title}</h1><p>${slide.subtitle}</p></div>
        <div class="slide-body">${slide.content}</div>
        <div class="slide-footer">模块思维 · 先体验，再命名</div>
        <div class="slide-page">${String(state.slide + 1).padStart(2, "0")} / ${String(model.slides.length).padStart(2, "0")}</div>
        <div class="slide-progress" aria-hidden="true"><i style="width:${((state.slide + 1) / model.slides.length) * 100}%"></i></div>
      </section>`;
    deck.querySelectorAll("[data-reveal]").forEach((node, index) => node.classList.toggle("revealed", index < state.reveal));
    wireSlideInteractions();
    document.title = `${slide.source} ${slide.title}｜模块思维`;
    status.textContent = `AUDIENCE · ${controlled ? "PRESENTER" : "LOCAL"} · ${session}`;
    fit();
    mountThreeScenes(version);
  }

  function wireSlideInteractions() {
    const transformButtons = [...deck.querySelectorAll("[data-transform-case]")];
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

    const buildButtons = [...deck.querySelectorAll("[data-build-step]")];
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
    if (event.target instanceof Element && event.target.closest("button,a,input,textarea,select")) return;
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
