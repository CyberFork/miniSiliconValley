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
    return { slide, reveal, updatedAt: Date.now() };
  }

  function readState() {
    try { return normalize(JSON.parse(localStorage.getItem(storageKey) || "null")); }
    catch { return normalize(null); }
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }

  function send(type, payload) {
    const message = { type, session, source: "audience", ...payload };
    channel?.postMessage(message);
    try { localStorage.setItem(`${storageKey}:event`, JSON.stringify({ ...message, nonce: Math.random(), at: Date.now() })); } catch {}
  }

  function render() {
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
    document.title = `${slide.source} ${slide.title}｜模块思维`;
    status.textContent = `AUDIENCE · ${controlled ? "PRESENTER" : "LOCAL"} · ${session}`;
    fit();
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
  } catch {}
  addEventListener("storage", (event) => {
    if (event.key !== `${storageKey}:event` || !event.newValue) return;
    try { acceptMessage(JSON.parse(event.newValue)); } catch {}
  });
  addEventListener("resize", fit);
  addEventListener("keydown", (event) => {
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
