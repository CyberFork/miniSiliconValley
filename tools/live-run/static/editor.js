(() => {
  "use strict";

  const BUILD_ID = "t083-nine-pane-studio-r1";
  const BASE = new URL("../", window.location.href);
  const $ = (selector) => document.querySelector(selector);
  const CardView = window.MsvCardView;
  if (!CardView) throw new Error("共享卡片渲染器未加载，无法安全预览学员卡片。");
  const Preview = window.MsvCoursePreview;
  if (!Preview) throw new Error("九视窗课程投影器未加载，无法安全预览课程。");
  const {
    escapeHtml: esc,
    boundaryLabels: BOUNDARY_NAMES,
    boundaryNotes: BOUNDARY_NOTES,
    cleanCardTitle,
    renderLearnerCard,
  } = CardView;
  const SEATS = [
    ["mentor01", "导师 1 · 产品 / 主 DM"], ["mentor02", "导师 2 · 开发"],
    ["mentor03", "导师 3 · 市场"], ["mentor04", "导师 4 · 运营"],
    ["learner01", "学员 1"], ["learner02", "学员 2"], ["learner03", "学员 3"], ["learner04", "学员 4"],
  ];
  const LEARNERS = [["learner01", "Young Builder 01"], ["learner02", "Young Builder 02"], ["learner03", "Young Builder 03"], ["learner04", "Young Builder 04"]];
  const MODE_NAMES = {yarn: "毛线式 · 获取交换信息", american: "美式 · 情境攻坚", euro: "德式 · 资源经营"};
  const MENTOR_NAMES = {mentor01: "P · 产品导师", mentor02: "D · 开发导师", mentor03: "M · 市场导师", mentor04: "O · 运营导师"};
  const SOURCE_NAMES = {bundled: "内置基线", authored: "团队课件"};
  const LIBRARY_STORAGE_KEY = "minisv.course-editor.library-collapsed";
  const compactLibraryMedia = window.matchMedia("(max-width: 1450px)");
  const drawerLibraryMedia = window.matchMedia("(max-width: 1040px)");

  let token = "";
  let catalog = [];
  let diagnostics = [];
  let course = null;
  let courseMeta = null;
  let lastCandidateMeta = null;
  let revision = 0;
  let activeStep = 0;
  let activeBlock = 0;
  let activeCard = 0;
  let dirty = false;
  let mode = "studio";
  let alphaState = null;
  let releaseInfo = null;
  let serverSchemaVersion = null;
  let serverEditorBuild = null;
  let toastTimer;
  let previewStatus = "ready";
  let previewSeed = "MSV-PREVIEW-01";
  let studioLayout = "overview";
  let focusSeatA = "mentor01";
  let focusSeatB = "learner01";
  let controllerCollapsed = false;
  let undoStack = [];
  let redoStack = [];
  let changedPaths = new Set();
  let savedSnapshot = "";
  let fieldSession = null;
  let savePromise = null;
  let saveError = "";
  let libraryPreference = null;
  let libraryCollapsed = compactLibraryMedia.matches;
  let libraryReturnFocus = null;

  try {
    const stored = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      libraryPreference = stored === "true";
      libraryCollapsed = libraryPreference;
    }
  } catch { /* A blocked localStorage must never block authoring. */ }

  function endpoint(path) { return new URL(String(path).replace(/^\/+/, ""), BASE); }
  async function request(path, options = {}) {
    const response = await fetch(endpoint(path), {cache: "no-store", credentials: "same-origin", ...options});
    if (response.status === 401) {
      window.location.assign(new URL(`../auth/login?returnTo=${encodeURIComponent("/control/editor/")}`, BASE));
      throw new Error("登录已失效，正在返回登录页。");
    }
    const envelope = await response.json();
    if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message || "请求失败");
    return envelope.data;
  }
  function post(path, body) {
    return request(path, {method: "POST", headers: {"Content-Type": "application/json", "X-Live-Run-Token": token}, body: JSON.stringify(body)});
  }
  async function loadReleaseInfo() {
    try {
      const response = await fetch(new URL("/release.json", window.location.origin), {cache: "no-store", credentials: "same-origin"});
      const value = await response.json();
      if (!response.ok || !value?.release) throw new Error("release unavailable");
      releaseInfo = value;
    } catch {
      releaseInfo = {release: "local-dev", origin: "local"};
    }
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer);
    const node = $("#toast");
    node.textContent = message;
    node.className = `toast show${error ? " error" : ""}`;
    toastTimer = setTimeout(() => { node.className = "toast"; }, 4800);
  }
  function setSaveState(value, state) { const node = $("#saveState"); node.textContent = value; node.dataset.state = state; }
  function markDirty(path = "") {
    dirty = true;
    saveError = "";
    if (path) changedPaths.add(path);
    courseMeta = null;
    setSaveState("有未保存修改", "dirty");
    syncRaw();
    renderPackageHealth();
    renderAlphaSync();
    renderVersionMatrix();
    syncSaveControls();
  }
  function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[Number.isInteger(+key) ? +key : key], object); }
  function setPath(object, path, value) {
    const keys = path.split("."); let target = object;
    keys.slice(0, -1).forEach((key) => { target = target[Number.isInteger(+key) ? +key : key]; });
    const last = keys.at(-1); target[Number.isInteger(+last) ? +last : last] = value;
  }
  function syncRaw() { if (course) $("#rawJson").value = JSON.stringify(course, null, 2); }
  function catalogItem() { return catalog.find((item) => item.id === course?.course?.id) || null; }

  function renderLibraryDisclosure() {
    document.body.classList.toggle("library-collapsed", libraryCollapsed);
    const content = $("#libraryContent");
    content.hidden = libraryCollapsed;
    const toggle = $("#closeLibrary");
    toggle.setAttribute("aria-expanded", String(!libraryCollapsed));
    toggle.setAttribute("aria-label", libraryCollapsed ? "展开课程库" : "收起课程库");
    toggle.title = libraryCollapsed ? "展开课程库" : "收起课程库";
    toggle.textContent = libraryCollapsed ? "→" : "←";
    for (const selector of ["#openLibrary", "#topbarLibrary"]) {
      const trigger = $(selector);
      trigger.setAttribute("aria-expanded", String(!libraryCollapsed));
      trigger.textContent = libraryCollapsed ? "展开课程库" : "收起课程库";
    }
    const drawerOpen = drawerLibraryMedia.matches && !libraryCollapsed;
    document.body.classList.toggle("library-drawer-open", drawerOpen);
    $("#libraryBackdrop").hidden = !drawerOpen;
  }

  function setLibraryCollapsed(collapsed, {persist = true, restoreFocus = false, trigger = null} = {}) {
    libraryCollapsed = Boolean(collapsed);
    if (!libraryCollapsed && trigger) libraryReturnFocus = trigger;
    if (persist) {
      libraryPreference = libraryCollapsed;
      try { window.localStorage.setItem(LIBRARY_STORAGE_KEY, String(libraryCollapsed)); } catch { /* UI still works. */ }
    }
    renderLibraryDisclosure();
    if (!libraryCollapsed && drawerLibraryMedia.matches) {
      window.requestAnimationFrame(() => $("#closeLibrary").focus());
    } else if (restoreFocus && libraryReturnFocus?.isConnected) {
      window.requestAnimationFrame(() => libraryReturnFocus.focus());
    }
  }

  function openLibrary(trigger) { setLibraryCollapsed(false, {trigger}); }
  function closeLibrary({restoreFocus = false, persist = true} = {}) { setLibraryCollapsed(true, {persist, restoreFocus}); }

  async function loadCatalog() {
    const data = await request("api/courses");
    catalog = data.courses;
    diagnostics = data.diagnostics || [];
    renderLibrary();
  }
  function renderLibrary() {
    $("#courseList").innerHTML = catalog.map((item) => `<button class="course-item" data-course="${esc(item.id)}" aria-current="${course?.course?.id === item.id}">
      <b>${esc(item.name)}</b><small>${esc(item.period)} · ${esc(item.id)}</small>
      <span>${item.deckCount || 0} 卡组 / ${item.cardCount || 0} 张卡 · Candidate r${item.candidateRevision ?? item.draftRevision ?? 0} · Released r${item.releasedRevision ?? item.publishedRevision ?? 0}</span>
    </button>`).join("");
    document.querySelectorAll("[data-course]").forEach((button) => { button.onclick = () => {
      if (dirty) return toast("当前有未保存修改：请先保存 Candidate，再切换课程。", true);
      openCourse(button.dataset.course);
    }; });
    const area = $("#diagnostics");
    area.hidden = diagnostics.length === 0;
    area.innerHTML = diagnostics.length ? `<b>发现 ${diagnostics.length} 个无效课程文件</b>${diagnostics.map((item) => `<p>${esc(item.file)}<br>${esc(item.message)}</p>`).join("")}` : "";
    $("#cloneSource").innerHTML = catalog.filter((item) => item.publishedRevision >= 0).map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
  }
  async function openCourse(courseId) {
    try {
      setSaveState("正在载入", "loading");
      const data = await request(`api/courses/${encodeURIComponent(courseId)}?channel=candidate`);
      course = data.course;
      courseMeta = data.metadata || null;
      lastCandidateMeta = data.metadata || null;
      revision = data.revision;
      activeStep = 0;
      activeBlock = 0;
      activeCard = 0;
      dirty = false;
      mode = "studio";
      previewStatus = "ready";
      previewSeed = `MSV-${course.course.id.toUpperCase().slice(0, 18)}-01`;
      studioLayout = "overview";
      focusSeatA = "mentor01";
      focusSeatB = "learner01";
      undoStack = [];
      redoStack = [];
      changedPaths = new Set();
      savedSnapshot = JSON.stringify(course);
      if (drawerLibraryMedia.matches) closeLibrary({restoreFocus: true, persist: false});
      $("#emptyState").hidden = true;
      $("#editor").hidden = false;
      $("#download").disabled = false;
      resetCardFilters();
      renderAll();
      setSaveState(`Candidate r${revision} 已载入`, "saved");
    } catch (error) {
      toast(error.message, true);
      setSaveState("载入失败", "error");
    }
  }

  function field(label, path, options = {}) {
    const value = getPath(course, path);
    const wide = options.wide ? " wide" : "";
    const help = options.help ? `<small>${esc(options.help)}</small>` : "";
    if (options.select) return `<label class="${wide}">${esc(label)}${help}<select data-path="${esc(path)}">${options.select.map(([key, name]) => `<option value="${esc(key)}" ${value === key ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
    if (options.textarea) return `<label class="${wide}">${esc(label)}${help}<textarea data-path="${esc(path)}" ${options.array ? "data-array=\"true\"" : ""}>${esc(options.array ? (Array.isArray(value) ? value.join("\n") : "") : value)}</textarea></label>`;
    return `<label class="${wide}">${esc(label)}${help}<input data-path="${esc(path)}" value="${esc(value)}" ${options.locked ? "readonly class=\"locked-field\"" : ""} ${options.type ? `type="${options.type}"` : ""}></label>`;
  }
  function renderMetadata() {
    $("#metadataForm").innerHTML = `
      ${field("课程 ID", "course.id", {locked: true, help: "稳定文件名与加载键；克隆时确定。"})}
      ${field("课程名称", "course.name")}
      ${field("时代 / 时间范围", "course.period")}
      ${field("课堂运行流程底座", "case.campaignId", {select: [["google-1995-2004", "Google 运行流程"], ["eleme-2008-find-problem", "饿了么运行流程"]], help: "承载身份、挑战、账本和阶段机；私密卡以抽卡内容为真值。"})}
      ${field("课程简介", "course.description", {textarea: true, wide: true})}
      ${field("学员安全队名", "case.learnerName", {help: "揭晓前学员看到的名称。"})}
      ${field("案例时间", "case.period")}
      ${field("导师案例名", "case.name", {wide: true})}
      ${field("为什么值得学", "case.why", {textarea: true, wide: true})}`;
    bindInputs($("#metadataForm"));
  }
  function renderSteps() {
    $("#stepTabs").innerHTML = course.macroSteps.map((step, index) => `<button data-step="${index}" aria-current="${index === activeStep ? "step" : "false"}">${step.order}. ${esc(step.name)}</button>`).join("");
    document.querySelectorAll("[data-step]").forEach((button) => { button.onclick = () => {
      activeStep = +button.dataset.step;
      activeBlock = course.blocks.findIndex((block) => block.macroStepId === course.macroSteps[activeStep].id);
      activeCard = 0;
      renderSteps();
      renderBlocks();
    }; });
  }
  function currentDeck() { return course?.decks?.find((deck) => deck.macroStepId === course.macroSteps?.[activeStep]?.id); }
  function nextCardId(deck) {
    const stem = `${course.course.id}-${deck.macroStepId}-card-`; let number = 1;
    while (deck.cards.some((card) => card.id === `${stem}${String(number).padStart(3, "0")}`)) number += 1;
    return `${stem}${String(number).padStart(3, "0")}`;
  }
  function flattenCards() {
    return course ? Preview.flattenCards(course) : [];
  }
  function allDealtIds() {
    if (!alphaState || alphaState.courseId !== course?.course?.id) return new Set();
    const ids = [];
    Object.values(alphaState.courseDeals || {}).forEach((hands) => {
      Object.values(hands || {}).forEach((hand) => { if (Array.isArray(hand)) ids.push(...hand); });
    });
    return new Set(ids);
  }
  function selectedCardEntry() {
    const deck = currentDeck();
    const card = deck?.cards?.[activeCard];
    if (!deck || !card) return null;
    return {deck, card, deckIndex: course.decks.indexOf(deck), cardIndex: activeCard, step: course.macroSteps[activeStep], stepIndex: activeStep};
  }
  function filteredCards() {
    const query = $("#cardSearch").value.trim().toLocaleLowerCase("zh-CN");
    const step = $("#cardStepFilter").value;
    const boundary = $("#cardBoundaryFilter").value;
    const source = $("#cardSourceFilter").value;
    const alpha = $("#cardAlphaFilter").value;
    const dealt = allDealtIds();
    return flattenCards().filter((entry) => {
      if (query && !entry.searchText.includes(query)) return false;
      if (step && entry.step.id !== step) return false;
      if (boundary && entry.card.boundary !== boundary) return false;
      if (source === "with" && !(entry.card.sourceIds || []).length) return false;
      if (source === "without" && (entry.card.sourceIds || []).length) return false;
      if (alpha === "dealt" && !dealt.has(entry.card.id)) return false;
      if (alpha === "undealt" && dealt.has(entry.card.id)) return false;
      return true;
    });
  }
  function renderCardFilterSteps() {
    const select = $("#cardStepFilter");
    const previous = select.value;
    select.innerHTML = `<option value="">全部五步</option>${course.macroSteps.map((step) => `<option value="${esc(step.id)}">第 ${step.order} 步 · ${esc(step.name)}</option>`).join("")}`;
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  function renderCardResults() {
    const results = filteredCards();
    const current = selectedCardEntry()?.card?.id;
    $("#cardResultCount").textContent = `${results.length} / ${flattenCards().length} 张卡`;
    const filters = [$("#cardSearch").value.trim() && `“${$("#cardSearch").value.trim()}”`, $("#cardStepFilter").selectedOptions[0]?.textContent, $("#cardBoundaryFilter").selectedOptions[0]?.textContent, $("#cardSourceFilter").value && $("#cardSourceFilter").selectedOptions[0]?.textContent, $("#cardAlphaFilter").value && $("#cardAlphaFilter").selectedOptions[0]?.textContent].filter((item, index) => item && (index === 0 || !item.startsWith("全部")));
    $("#cardSearchStatus").textContent = filters.length ? filters.join(" · ") : "显示全部";
    $("#deckCardList").innerHTML = results.length ? results.map((entry) => `<button type="button" data-card-id="${esc(entry.card.id)}" aria-current="${entry.card.id === current}">
      <span>${esc(BOUNDARY_NAMES[entry.card.boundary] || entry.card.boundary)} · 第 ${entry.step.order} 步 · ${esc(entry.deck.drawAtBlockId)}</span>
      <b>${esc(cleanCardTitle(entry.card.title))}</b>
      <small>${esc(entry.card.id)} · ${entry.card.sourceIds?.length || 0} 个来源${allDealtIds().has(entry.card.id) ? " · Alpha 已发" : ""}</small>
    </button>`).join("") : `<div class="no-card-results"><b>没有匹配卡牌</b><p>试试清空筛选，或搜索标题中的更短词语。</p></div>`;
    $("#deckCardList").querySelectorAll("[data-card-id]").forEach((button) => { button.onclick = () => jumpToCard(button.dataset.cardId); });
  }
  function renderCardEditor() {
    const entry = selectedCardEntry();
    if (!entry) {
      $("#deckTitle").textContent = "本步骤缺少卡组";
      $("#deckSummary").textContent = "请通过 JSON 源码修复完整课程包。";
      $("#deckCardForm").innerHTML = "";
      renderLearnerPreview();
      return;
    }
    const {deck, card, deckIndex, cardIndex, step} = entry;
    activeCard = Math.max(0, Math.min(activeCard, deck.cards.length - 1));
    $("#deckTitle").textContent = `第 ${step.order} 步 · ${step.name}卡组`;
    $("#deckSummary").textContent = `${deck.drawAtBlockId} 发牌 · ${deck.cards.length} 张 · 4 人每人 ${deck.cardsPerLearner} 张 · 同轮不重复 · 与身份无关`;
    const dp = `decks.${deckIndex}.cards.${cardIndex}`;
    const sourceChecks = course.sources.map((source) => `<label class="source-check"><input type="checkbox" data-card-source="${esc(source.id)}" ${card.sourceIds.includes(source.id) ? "checked" : ""}><span><b>${esc(source.title)}</b><small>${esc(source.organization)} · ${esc(source.id)}</small></span></label>`).join("");
    $("#deckCardForm").innerHTML = `
      <div class="card-form-head"><div><span class="eyebrow">AUTHOR CARD · ${esc(card.id)}</span><h4>${esc(cleanCardTitle(card.title))}</h4></div><div class="card-tools"><button type="button" data-card-action="up" ${activeCard === 0 ? "disabled" : ""}>↑</button><button type="button" data-card-action="down" ${activeCard === deck.cards.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-card-action="copy">复制</button><button type="button" data-card-action="delete" ${deck.cards.length <= 12 ? "disabled" : ""}>删除</button></div></div>
      <div class="stable-id"><span>稳定卡牌 ID</span><code>${esc(card.id)}</code><small>已发手牌按此 ID 绑定；结构化编辑器不允许误改。高级迁移请在 JSON 源码完成并重新验收。</small></div>
      <div class="field-grid">
        ${field("证据边界", `${dp}.boundary`, {select: Object.entries(BOUNDARY_NAMES)})}
        ${field("作者标题", `${dp}.title`, {help: "允许保留 F-02 · / C-05 · 等旧内部前缀；学员端会自动清理。"})}
        ${field("学员看到的具体线索", `${dp}.body`, {textarea: true, wide: true, help: "一名初中生可以直接读懂；不要把抽象方法论压给学员。"})}
        ${field("交给队友时要说什么", `${dp}.sharePrompt`, {textarea: true, wide: true})}
      </div>
      <fieldset class="source-field"><legend>来源引用 ${card.boundary === "F" ? "· F 卡至少选 1 项" : "· 可留空"}</legend>${sourceChecks}</fieldset>
      <div class="card-context-save" data-state="${saveError ? "error" : dirty ? "dirty" : "saved"}"><div><strong>保存整门 Course Package</strong><span id="cardSaveMeta">${saveError ? `上次保存失败：${esc(saveError)}；当前输入仍保留。` : dirty ? `Working Copy · ${changedPaths.size || 1} 处未保存 · 基线 Candidate r${revision}` : `Candidate r${revision} · digest ${esc(shortDigest(lastCandidateMeta?.digest || lastCandidateMeta?.digestShort || ""))}`}</span><small>一次保存包含五步、13 Block 和全部卡牌；不会自动刷新 Alpha。</small></div><button type="button" id="saveCardContext" class="button secondary" data-save-course data-save-context>保存整门课程</button></div>`;
    bindInputs($("#deckCardForm"), {card: true});
    $("#deckCardForm").querySelectorAll("[data-card-source]").forEach((input) => { input.onchange = () => {
      card.sourceIds = [...$("#deckCardForm").querySelectorAll("[data-card-source]:checked")].map((item) => item.dataset.cardSource);
      markDirty(`${dp}.sourceIds`);
      renderCardEditor();
      renderCardResults();
      renderPackageHealth();
    }; });
    $("#deckCardForm").querySelectorAll("[data-card-action]").forEach((button) => { button.onclick = () => {
      const action = button.dataset.cardAction;
      if (action === "copy") {
        const copy = structuredClone(card); copy.id = nextCardId(deck); copy.title = `${copy.title} · 副本`;
        deck.cards.splice(activeCard + 1, 0, copy); activeCard += 1;
      }
      if (action === "delete" && deck.cards.length > 12) { deck.cards.splice(activeCard, 1); activeCard = Math.min(activeCard, deck.cards.length - 1); }
      if (action === "up" && activeCard > 0) { [deck.cards[activeCard - 1], deck.cards[activeCard]] = [deck.cards[activeCard], deck.cards[activeCard - 1]]; activeCard -= 1; }
      if (action === "down" && activeCard < deck.cards.length - 1) { [deck.cards[activeCard + 1], deck.cards[activeCard]] = [deck.cards[activeCard], deck.cards[activeCard + 1]]; activeCard += 1; }
      markDirty(`decks.${deckIndex}.cards`); renderCardLibrary();
    }; });
    renderLearnerPreview();
  }
  function previewCardPosition(cardId) {
    const hands = alphaState?.courseDeals?.[course?.macroSteps?.[activeStep]?.id];
    for (const [seatId, hand] of Object.entries(hands || {})) {
      const index = Array.isArray(hand) ? hand.indexOf(cardId) : -1;
      if (index >= 0) return {index, seatId};
    }
    return {index: 0, seatId: null};
  }
  function renderLearnerPreview() {
    const entry = selectedCardEntry();
    if (!entry) {
      $("#learnerCardPreview").innerHTML = `<p class="preview-empty">先选择一张卡。</p>`;
      $("#learnerSourcePreview").innerHTML = "";
      return;
    }
    const {index, seatId} = previewCardPosition(entry.card.id);
    $("#learnerCardPreview").innerHTML = renderLearnerCard(entry.card, index, {state: $("#previewState").value});
    const references = (entry.card.sourceIds || []).map((id) => ({id, source: course.sources.find((item) => item.id === id)}));
    if (entry.card.boundary === "F") {
      $("#learnerSourcePreview").innerHTML = `<h4>导师核对来源${seatId ? ` · 当前发给 ${esc(seatId)}` : ""}</h4>${references.length ? references.map(({id, source}) => source ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(source.title)}</b><span>${esc(source.organization)} · ${esc(id)}</span></a>` : `<p class="source-error">来源 ${esc(id)} 不存在</p>`).join("") : `<p class="source-error">F 有来源卡缺少来源，不能发布。</p>`}`;
    } else if (entry.card.boundary === "R") {
      $("#learnerSourcePreview").innerHTML = `<div class="boundary-explain"><b>R 课堂模拟 · 不是史实</b><p>这是为了让学员进入情境而设计的模拟，不应被讲成真实历史。</p></div>`;
    } else {
      $("#learnerSourcePreview").innerHTML = `<div class="boundary-explain"><b>${esc(BOUNDARY_NAMES[entry.card.boundary])} · ${esc(BOUNDARY_NOTES[entry.card.boundary])}</b><p>把当前判断的边界直接告诉学员。</p></div>`;
    }
  }
  function renderAlphaHands() {
    const node = $("#alphaHands");
    const step = course.macroSteps[activeStep];
    if (!alphaState) {
      node.innerHTML = `<div><span class="eyebrow">CURRENT ALPHA HANDS</span><h3 id="alphaHandsTitle">当前 Alpha 手牌</h3><p>正在读取活动 Run…</p></div>`;
      return;
    }
    if (alphaState.courseId !== course.course.id) {
      node.dataset.state = "mismatch";
      node.innerHTML = `<div><span class="eyebrow">CURRENT ALPHA HANDS · 受控信息</span><h3 id="alphaHandsTitle">当前 Alpha 不是这门课</h3><p>Alpha 正在运行 <code>${esc(alphaState.courseId)}</code>；这里不会伪造或泄露其他课程的手牌。</p></div><a class="button ghost" href="../">打开 Alpha 主控</a>`;
      return;
    }
    node.dataset.state = "ready";
    const hands = alphaState.courseDeals?.[step.id];
    const total = hands ? Object.values(hands).flat().length : 0;
    node.innerHTML = `<div class="alpha-hands-head"><div><span class="eyebrow">CURRENT ALPHA HANDS · 仅导师后台</span><h3 id="alphaHandsTitle">第 ${step.order} 步当前 Alpha 手牌</h3><p>${esc(alphaState.runId)} · 稳定 ID ${total}/12 · 点击 ID 反查卡片</p></div><span class="privacy-badge">不会进入公开页面</span></div>
      <div class="hand-grid">${LEARNERS.map(([seatId, name]) => `<section><h4>${esc(name)}</h4>${hands?.[seatId]?.length ? hands[seatId].map((id, index) => `<button type="button" data-hand-card="${esc(id)}"><span>私密卡 ${index + 1}</span><code>${esc(id)}</code></button>`).join("") : `<p>尚未在本步骤发牌</p>`}</section>`).join("")}</div>`;
    node.querySelectorAll("[data-hand-card]").forEach((button) => { button.onclick = () => jumpToCard(button.dataset.handCard); });
  }
  function jumpToCard(cardId) {
    const entry = flattenCards().find((item) => item.card.id === cardId);
    if (!entry) return toast(`当前课件中找不到稳定卡牌 ${cardId}。`, true);
    activeStep = entry.stepIndex;
    activeCard = entry.cardIndex;
    setMode("cards");
    renderCardLibrary();
    requestAnimationFrame(() => $("#deckCardForm").scrollIntoView({behavior: "smooth", block: "start"}));
  }
  function renderCardLibrary() {
    renderCardFilterSteps();
    const total = flattenCards().length;
    $("#cardsTabCount").textContent = total ? String(total) : "—";
    $("#cardLibrarySummary").textContent = `${course.decks.length} 个阶段卡组 / ${total} 张卡；标题、正文、分享提示、稳定 ID 和来源均可搜索。`;
    renderCardResults();
    renderCardEditor();
    renderAlphaHands();
    syncSaveControls();
  }
  function resetCardFilters() {
    for (const selector of ["#cardSearch", "#cardStepFilter", "#cardBoundaryFilter", "#cardSourceFilter", "#cardAlphaFilter"]) {
      const node = $(selector); if (node) node.value = "";
    }
    if (course && mode === "cards") renderCardLibrary();
  }
  function addCard() {
    const deck = currentDeck();
    if (!deck) return toast("当前步骤缺少卡组，请先修复 JSON。", true);
    const id = nextCardId(deck);
    deck.cards.push({id, boundary: "U", title: "新线索", body: "用学员能直接读懂的语言写一个具体人、地点、动作或未知。", sharePrompt: "告诉队友这条信息能说明什么，还不能说明什么。", sourceIds: []});
    activeCard = deck.cards.length - 1;
    markDirty(`decks.${course.decks.indexOf(deck)}.cards`); renderCardLibrary();
  }
  function simulateDeal() {
    const deck = currentDeck(); const cards = [...deck.cards];
    for (let i = cards.length - 1; i > 0; i -= 1) { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); const j = bytes[0] % (i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    const picked = cards.slice(0, 12); const unique = new Set(picked.map((card) => card.id)).size;
    $("#dealPreview").hidden = false;
    $("#dealPreview").innerHTML = `<div class="deal-head"><b>第 ${activeStep + 1} 步模拟发牌</b><span>${unique === 12 ? "✓ 12 张全部不重复" : `✗ 只有 ${unique} 个唯一 ID`}</span><button type="button" id="closeDeal">关闭</button></div><div class="deal-hands">${[0, 1, 2, 3].map((seat) => `<section><h4>Young Builder ${seat + 1}</h4>${picked.slice(seat * 3, seat * 3 + 3).map((card, index) => renderLearnerCard(card, index, {state: "held"})).join("")}</section>`).join("")}</div>`;
    $("#closeDeal").onclick = () => { $("#dealPreview").hidden = true; };
  }

  function renderBlocks() {
    const step = course.macroSteps[activeStep];
    const indexes = course.blocks.map((block, index) => [block, index]).filter(([block]) => block.macroStepId === step.id);
    $("#blockList").innerHTML = indexes.map(([block, index]) => `<button type="button" data-block="${index}" aria-current="${index === activeBlock}"><b>${esc(block.id)}</b><span>${esc(block.title)}</span></button>`).join("");
    document.querySelectorAll("[data-block]").forEach((button) => { button.onclick = () => { activeBlock = +button.dataset.block; renderBlocks(); }; });
    renderBlockForm();
  }
  function renderBlockForm() {
    const block = course.blocks[activeBlock]; const step = course.macroSteps[activeStep];
    if (!block || block.macroStepId !== step.id) {
      activeBlock = course.blocks.findIndex((item) => item.macroStepId === step.id);
    }
    const current = course.blocks[activeBlock]; const bp = `blocks.${activeBlock}`; const sp = `macroSteps.${activeStep}`;
    const checks = Object.entries(MODE_NAMES).map(([id, name]) => `<label><input type="checkbox" data-mode="${id}" ${current.gameModes.includes(id) ? "checked" : ""}>${esc(name)}</label>`).join("");
    const seats = SEATS.map(([id, name]) => `<div class="seat-card"><h4>${esc(name)}</h4>
      ${field("状态", `${bp}.seatTasks.${id}.state`, {select: [["active", "当值 / active"], ["support", "支撑 / support"], ["standby", "待命 / standby"]]})}
      ${field("徽标", `${bp}.seatTasks.${id}.badge`)}
      ${field("此刻唯一任务", `${bp}.seatTasks.${id}.task`, {textarea: true})}</div>`).join("");
    $("#blockForm").innerHTML = `
      <section class="form-section"><h3>第 ${step.order} 大步 · 定义</h3><div class="field-grid">
        ${field("大步名称", `${sp}.name`)}
        ${field("主导师顺序", `${sp}.mentorSequence`, {textarea: true, array: true, help: "mentor01—mentor04，每行一个。"})}
        ${field("本步核心问题", `${sp}.question`, {textarea: true, wide: true})}
        ${field("本步完成门槛", `${sp}.exitGate`, {textarea: true, wide: true})}
      </div></section>
      <section class="form-section"><h3>${esc(current.id)} · 小步骤基本信息</h3><div class="field-grid">
        ${field("小步骤标题", `${bp}.title`, {wide: true})}
        ${field("当值导师", `${bp}.leadMentorId`, {select: Object.entries(MENTOR_NAMES)})}
        ${field("建议分钟", `${bp}.suggestedMinutes`, {type: "number"})}
        ${field("系统动作（锁定）", `${bp}.apiAction`, {locked: true, help: "13 块执行安全契约，不在表单中改。"})}
        <label class="wide">本块玩法<div class="checks">${checks}</div></label>
      </div></section>
      <section class="form-section"><h3>双轨内容与学员视角</h3><div class="field-grid">
        ${field("历史学习轨", `${bp}.historyTrack`, {textarea: true, wide: true})}
        ${field("现实实践轨", `${bp}.realityTrack`, {textarea: true, wide: true})}
        ${field("给学员的一句话", `${bp}.studentPrompt`, {textarea: true, wide: true, help: "初中生看得懂，只说眼前动作。"})}
        ${field("我身处什么世界", `${bp}.learnerLens.world`, {textarea: true})}
        ${field("我要说什么", `${bp}.learnerLens.say`, {textarea: true})}
        ${field("我要问什么", `${bp}.learnerLens.ask`, {textarea: true})}
        ${field("怎样算完成", `${bp}.learnerLens.done`, {textarea: true})}
      </div></section>
      <section class="form-section"><h3>导师执行 SOP</h3><div class="field-grid">
        ${field("当值导师逐句口播", `${bp}.mentorScript`, {textarea: true, array: true, wide: true, help: "每行一句。"})}
        ${field("学员现场动作", `${bp}.studentActions`, {textarea: true, array: true})}
        ${field("执行后系统变化", `${bp}.systemActions`, {textarea: true, array: true})}
        ${field("本块道具", `${bp}.props`, {textarea: true, array: true})}
        ${field("人工验收门", `${bp}.evidenceGate`, {textarea: true, array: true})}
        ${field("卡住时兜底", `${bp}.fallback`, {textarea: true, array: true})}
        ${field("线下与八窗配合", `${bp}.manualInteraction`, {textarea: true, wide: true})}
      </div></section>
      <section class="form-section"><h3>8 个席位此刻分别做什么</h3><div class="seat-grid">${seats}</div></section>`;
    bindInputs($("#blockForm"));
    document.querySelectorAll("[data-mode]").forEach((input) => { input.onchange = () => {
      current.gameModes = Object.keys(MODE_NAMES).filter((id) => document.querySelector(`[data-mode="${id}"]`).checked); markDirty(`${bp}.gameModes`);
    }; });
  }
  function bindInputs(root, options = {}) {
    root.querySelectorAll("[data-path]").forEach((input) => { input.oninput = () => {
      let value = input.value;
      if (input.dataset.array === "true") value = value.split("\n").map((item) => item.trim()).filter(Boolean);
      else if (input.type === "number") value = Number(value);
      setPath(course, input.dataset.path, value);
      updateCoupledField(input.dataset.path, value);
      markDirty(input.dataset.path);
      $("#courseTitle").textContent = course.course.name;
      if (options.card) {
        renderLearnerPreview();
        const title = $("#deckCardForm .card-form-head h4");
        if (title) title.textContent = cleanCardTitle(selectedCardEntry()?.card?.title || "");
      }
    }; });
  }

  function inspectPackage() {
    const issues = [];
    if (!course || typeof course !== "object") return {issues: ["没有载入课程 JSON"], deckCount: 0, cardCount: 0, counts: []};
    if (course.schemaVersion !== 1) issues.push(`课程 Schema 应为 v1，实际为 ${course.schemaVersion ?? "缺失"}`);
    if (serverSchemaVersion != null && course.schemaVersion !== serverSchemaVersion) issues.push(`浏览器与服务端 Schema 不一致：服务端 v${serverSchemaVersion}`);
    if (serverEditorBuild && serverEditorBuild !== BUILD_ID) issues.push(`编辑器资源版本不一致：浏览器 ${BUILD_ID} / 服务端 ${serverEditorBuild}，请强制刷新`);
    const decks = Array.isArray(course.decks) ? course.decks : [];
    if (decks.length !== 5) issues.push(`阶段卡组应为 5 组，实际 ${decks.length} 组`);
    const counts = decks.map((deck) => Array.isArray(deck?.cards) ? deck.cards.length : 0);
    counts.forEach((count, index) => { if (count < 12) issues.push(`第 ${index + 1} 组只有 ${count} 张，至少需要 12 张`); });
    const cards = decks.flatMap((deck) => Array.isArray(deck?.cards) ? deck.cards : []);
    const ids = cards.map((card) => card?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) issues.push("存在重复稳定卡牌 ID");
    const sourceIds = new Set((course.sources || []).map((source) => source.id));
    cards.forEach((card) => {
      const refs = Array.isArray(card?.sourceIds) ? card.sourceIds : [];
      if (card?.boundary === "F" && refs.length === 0) issues.push(`${card.id || "未命名卡"} 是 F 有来源卡，但未引用来源`);
      const missing = refs.filter((id) => !sourceIds.has(id));
      if (missing.length) issues.push(`${card.id || "未命名卡"} 引用了不存在的来源：${missing.join("、")}`);
    });
    if (!Array.isArray(course.macroSteps) || course.macroSteps.length !== 5) issues.push("课程必须保留完整五大步");
    if (!Array.isArray(course.blocks) || course.blocks.length !== 13) issues.push("课程必须保留完整十三小块");
    (course.blocks || []).forEach((block, index) => Preview.blockWarnings(course, index).forEach((warning) => issues.push(`${block?.id || `第 ${index + 1} 块`}：${warning}`)));
    if (courseMeta) {
      if (courseMeta.deckCount !== decks.length || courseMeta.cardCount !== cards.length) issues.push("API 课程摘要与浏览器 JSON 数量不一致，请重新载入");
      if (courseMeta.schemaVersion !== course.schemaVersion) issues.push("API 课程 Schema 与 JSON 不一致，请重新载入");
    }
    return {issues: [...new Set(issues)], deckCount: decks.length, cardCount: cards.length, counts};
  }
  function renderPackageHealth() {
    if (!course) return;
    const health = inspectPackage(); const item = catalogItem(); const blocking = health.issues.length > 0;
    const node = $("#packageHealth"); node.dataset.state = blocking ? "error" : dirty ? "dirty" : "ok";
    const digest = courseMeta?.digestShort || courseMeta?.digest?.slice(0, 16) || item?.digest || "保存后生成";
    const source = courseMeta?.source || item?.source || "imported";
    node.innerHTML = `<div class="health-title"><span class="health-icon">${blocking ? "!" : "✓"}</span><div><b>${blocking ? "课程包不完整，已阻止发布" : dirty ? "完整课程包 · 有未保存修改" : "完整课程包 · 可以进入 Alpha"}</b><span>${blocking ? esc(health.issues[0]) : "5 步 / 13 块 / 每组至少 12 张；保存后仍需人工刷新 Alpha。"}</span></div></div>
      <div class="health-stats">
        <div><b>${health.deckCount}/5</b><span>卡组</span></div><div><b>${health.cardCount}</b><span>卡牌（基线 60）</span></div><div><b>v${esc(course.schemaVersion)}</b><span>Schema</span></div><div><b>r${esc(revision)}</b><span>Candidate</span></div>
      </div>
      <details ${blocking ? "open" : ""}><summary>版本与数据诊断</summary><dl>
        <div><dt>编辑器资源</dt><dd>${esc(BUILD_ID)}</dd></div><div><dt>生产 release</dt><dd>${esc(releaseInfo?.release || "读取中")}</dd></div><div><dt>课程来源</dt><dd>${esc(SOURCE_NAMES[source] || source)}</dd></div><div><dt>课程 digest</dt><dd><code>${esc(digest)}</code></dd></div><div><dt>卡组分布</dt><dd>${esc(health.counts.join(" / ") || "—")}</dd></div><div><dt>Candidate / Released</dt><dd>r${esc(item?.draftRevision ?? 0)} / r${esc(item?.publishedRevision ?? 0)}</dd></div>
      </dl>${blocking ? `<ul>${health.issues.map((issue) => `<li>${esc(issue)}</li>`).join("")}</ul>` : ""}</details>`;
    $("#publish").disabled = blocking;
    $("#publish").title = blocking ? health.issues.join("；") : "发布完整课程到新 Run 选课区";
  }
  function renderAlphaSync() {
    const node = $("#alphaSync"); if (!node || !course) return;
    if (!alphaState) { node.dataset.state = "loading"; node.innerHTML = `<b>Alpha 连接中</b><span>正在读取活动 Run…</span>`; return; }
    const same = alphaState.courseId === course.course.id; const update = alphaState.courseUpdate || {};
    if (!same) {
      node.dataset.state = "mismatch";
      node.innerHTML = `<div><b>当前 Alpha 正在运行其他课程</b><span>Alpha：${esc(alphaState.courseId)} · 编辑器：${esc(course.course.id)}</span><small>本页修改不会出现在当前八席；请到主控明确新开对应课程。</small></div><a class="button ghost" href="../">打开 Alpha 主控</a>`;
      return;
    }
    const pending = Boolean(update.updateAvailable); node.dataset.state = pending ? "pending" : "same";
    const canRefresh = !dirty && !inspectPackage().issues.length;
    node.innerHTML = `<div><b>Alpha Run · ${esc(alphaState.runId)}</b><span>运行 r${esc(update.activeRevision ?? alphaState.courseRevision ?? 0)} / ${esc(update.activeDigest || String(alphaState.courseDigest || "").slice(0, 16))} → Candidate r${esc(update.latestRevision ?? revision)} / ${esc(update.latestDigest || "待检测")}</span><small>${dirty ? "先保存 Candidate；未保存内容不会进入 Alpha。" : pending ? "有新 Candidate 待主动加载；当前 Run 仍使用完整旧版。" : "Alpha 与编辑器最新 Candidate 一致。"} · refresh epoch ${esc(alphaState.refreshEpoch ?? 0)}</small></div><button type="button" id="refreshAlpha" class="button ${pending ? "primary" : "secondary"}" ${canRefresh ? "" : "disabled"}>全部刷新 Alpha</button>`;
    $("#refreshAlpha").onclick = async () => {
      try {
        $("#refreshAlpha").disabled = true;
        const before = {runId: alphaState.runId, block: alphaState.currentBlockIndex, deals: JSON.stringify(alphaState.courseDeals || {}), treasury: alphaState.classroom?.teamTreasuryTenths};
        alphaState = await post("api/control", {action: "refresh-course"});
        const preserved = before.runId === alphaState.runId && before.block === alphaState.currentBlockIndex && before.deals === JSON.stringify(alphaState.courseDeals || {}) && before.treasury === alphaState.classroom?.teamTreasuryTenths;
        renderAlphaSync(); renderAlphaHands(); renderCardResults(); renderPackageHealth();
        toast(preserved ? `Alpha 已在原 Run 加载 r${alphaState.courseRevision}；位置、资金与手牌稳定。` : "Alpha 已刷新，但检测到运行状态差异，请立即检查主控。", !preserved);
      } catch (error) { toast(`Alpha 刷新失败，旧版仍在运行：${error.message}`, true); renderAlphaSync(); }
    };
  }
  async function refreshAlphaState() {
    try { alphaState = await request("api/state"); renderAlphaSync(); renderVersionMatrix(); if (mode === "cards") { renderAlphaHands(); renderCardResults(); renderLearnerPreview(); } }
    catch { /* 保留当前编辑内容，下次轮询重试。 */ }
  }

  function shortDigest(value) { return String(value || "—").slice(0, 16); }
  function isBlockDirty(blockIndex, stepIndex) {
    if (changedPaths.has("*")) return true;
    return [...changedPaths].some((path) => path.startsWith(`blocks.${blockIndex}.`) || path.startsWith(`macroSteps.${stepIndex}.`));
  }
  function selectedBlock(index) {
    const next = Math.max(0, Math.min(index, course.blocks.length - 1));
    activeBlock = next;
    activeStep = Math.max(0, course.macroSteps.findIndex((step) => step.id === course.blocks[next].macroStepId));
    activeCard = 0;
    renderCourseStudio();
  }
  function renderTimeline() {
    const density = $("#timelineDensity").value;
    const warningsOnly = $("#onlyWarnings").checked;
    const groups = course.macroSteps.map((step, stepIndex) => {
      const blocks = course.blocks.map((block, blockIndex) => ({block, blockIndex})).filter(({block}) => block.macroStepId === step.id);
      const visible = warningsOnly ? blocks.filter(({blockIndex}) => Preview.blockWarnings(course, blockIndex).length) : blocks;
      const buttons = visible.map(({block, blockIndex}) => {
        const warnings = Preview.blockWarnings(course, blockIndex);
        const lead = course.formula.fourMentors.find((mentor) => mentor.id === block.leadMentorId);
        return `<button type="button" class="timeline-block" data-preview-block="${blockIndex}" aria-current="${blockIndex === activeBlock}" data-warning="${warnings.length > 0}" data-dirty="${isBlockDirty(blockIndex, stepIndex)}" title="${esc(warnings.length ? warnings.join("；") : `${block.title} · 结构完整`)}"><b>${esc(block.id)}</b><span>${esc(block.title)}</span><small>${esc(lead?.code || "?")} · ${esc(block.suggestedMinutes)}m · ${warnings.length ? `⚠${warnings.length}` : "✓"}</small></button>`;
      }).join("");
      return `<section class="timeline-step" data-current="${stepIndex === activeStep}"><button type="button" class="timeline-step-head" data-preview-step="${stepIndex}"><b>${step.order}. ${esc(step.name)}</b><span>${esc(step.question)}</span></button><div class="timeline-blocks">${buttons || `<span class="timeline-empty">本步无警告</span>`}</div></section>`;
    }).join("");
    const node = $("#courseTimeline");
    node.dataset.density = density;
    node.innerHTML = groups;
    $("#previousBlock").disabled = activeBlock <= 0;
    $("#nextBlock").disabled = activeBlock >= course.blocks.length - 1;
  }
  function renderFocusSelectors() {
    const options = SEATS.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    const first = $("#focusSeatA"); const second = $("#focusSeatB");
    if (!first.options.length) first.innerHTML = options;
    if (!second.options.length) second.innerHTML = options;
    first.value = focusSeatA; second.value = focusSeatB;
    $("#focusBLabel").hidden = studioLayout !== "compare";
  }
  function seatVisible(seat) {
    if (studioLayout === "mentors") return seat.kind === "mentor";
    if (studioLayout === "learners") return seat.kind === "learner";
    if (studioLayout === "focus") return seat.id === focusSeatA;
    if (studioLayout === "compare") return seat.id === focusSeatA || seat.id === focusSeatB;
    return true;
  }
  function renderStudioCourseIdentity(projection) {
    const stepIndex = projection.stepIndex;
    $("#studioCourseIdentity").innerHTML = `<div class="studio-identity-course"><span class="eyebrow">COURSE PACKAGE · 唯一真值</span>
      <button type="button" class="identity-edit identity-title" data-course-path="course.name" data-edit-label="课程名称"><b>${esc(course.course.name)}</b><span>点击修改课程名称</span></button>
      <button type="button" class="identity-edit identity-description" data-course-path="course.description" data-edit-label="课程简介"><p>${esc(course.course.description)}</p><span>点击修改课程简介</span></button>
      <button type="button" class="identity-edit identity-period" data-course-path="course.period" data-edit-label="课程时间范围"><b>${esc(course.course.period)}</b><span>编辑时间范围</span></button></div>
      <div class="studio-identity-step"><span class="eyebrow">CURRENT MACRO STEP · 第 ${esc(projection.step.order)} / 5 步</span>
      <button type="button" class="identity-edit identity-title" data-course-path="macroSteps.${stepIndex}.name" data-edit-label="大步名称"><b>${esc(projection.step.name)}</b><span>点击修改大步名称</span></button>
      <button type="button" class="identity-edit identity-description" data-course-path="macroSteps.${stepIndex}.question" data-edit-label="本步核心问题"><p>${esc(projection.step.question)}</p><span>点击修改本步核心问题</span></button>
      <button type="button" class="identity-edit identity-description" data-course-path="macroSteps.${stepIndex}.exitGate" data-edit-label="本步完成门槛"><p>${esc(projection.step.exitGate)}</p><span>点击修改本步完成门槛</span></button></div>`;
  }
  function renderCourseStudio() {
    if (!course || !$("#studioPane")) return;
    try {
      const digest = dirty ? "未保存 Working Copy" : lastCandidateMeta?.digest || lastCandidateMeta?.digestShort || "保存后生成";
      const projection = Preview.projectCourse(course, {blockIndex: activeBlock, status: previewStatus, seed: previewSeed, revision, digest});
      activeStep = projection.stepIndex;
      $("#previewRunStatus").value = previewStatus;
      $("#previewSeed").value = previewSeed;
      renderStudioCourseIdentity(projection);
      renderTimeline();
      renderFocusSelectors();
      document.querySelectorAll("[data-layout]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.layout === studioLayout)));
      const grid = $("#seatPreviewGrid");
      grid.dataset.layout = studioLayout;
      grid.innerHTML = projection.seats.map((seat) => `<div class="seat-preview-card" data-preview-seat="${esc(seat.id)}" data-hidden="${!seatVisible(seat)}">${Preview.renderSeatSurface(seat, {editable: true})}</div>`).join("");
      $("#previewController").innerHTML = Preview.renderControllerSurface(projection.controller, {editable: true});
      $("#projectionStamp").textContent = `${projection.block.id} · 9/9 同步 · seed ${previewSeed} · ${projection.deal.uniqueCount}/12 唯一卡`;
      $("#controllerShell").dataset.collapsed = String(controllerCollapsed);
      $("#toggleController").setAttribute("aria-expanded", String(!controllerCollapsed));
      $("#toggleController").textContent = controllerCollapsed ? "展开中控" : "收起中控";
      syncSaveControls();
    } catch (error) {
      $("#seatPreviewGrid").innerHTML = `<div class="timeline-empty"><b>九视窗无法投影</b><p>${esc(error.message)}</p></div>`;
      $("#previewController").innerHTML = "";
    }
  }
  function releaseEligibility() {
    const item = catalogItem();
    const candidateDigest = lastCandidateMeta?.digest || "";
    const activeDigest = alphaState?.courseDigest || "";
    if (dirty) return {ok: false, reason: "先保存当前 Working Copy，生成不可变 Candidate。"};
    if (!item?.candidateRef && !lastCandidateMeta?.candidateRef && revision <= 0) return {ok: false, reason: "当前没有待发布 Candidate；修改并保存后再验收。"};
    if (!alphaState || alphaState.courseId !== course?.course?.id) return {ok: false, reason: "Alpha 当前没有加载这门课程的 Candidate。"};
    if (!candidateDigest || shortDigest(candidateDigest) !== shortDigest(activeDigest)) return {ok: false, reason: "Alpha Active 与 Candidate digest 不一致；请明确刷新 Alpha。"};
    if (alphaState.status !== "completed") return {ok: false, reason: "exact Candidate 尚未完成 Alpha 全程验收。"};
    return {ok: true, reason: `已由 ${alphaState.runId} 完成 exact digest 验收。`};
  }
  function renderVersionMatrix() {
    const node = $("#versionMatrix");
    if (!node || !course) return;
    const item = catalogItem();
    const candidate = Boolean(item?.candidateRef || lastCandidateMeta?.candidateRef || revision > 0);
    const alphaSameCourse = alphaState?.courseId === course.course.id;
    const candidateDigest = lastCandidateMeta?.digest || lastCandidateMeta?.digestShort || "";
    const alphaExact = alphaSameCourse && candidateDigest && shortDigest(candidateDigest) === shortDigest(alphaState?.courseDigest);
    const eligibility = releaseEligibility();
    node.innerHTML = `
      <div class="version-cell" data-state="${dirty ? "warning" : "ok"}"><b>Working Copy</b><span>${dirty ? `${changedPaths.size || 1} 处未保存` : "与已存版本一致"}</span></div>
      <div class="version-cell" data-state="${candidate ? "active" : ""}"><b>Candidate ${candidate ? `r${revision}` : "—"}</b><span>${candidate ? shortDigest(candidateDigest) : "保存后生成"}</span></div>
      <div class="version-cell" data-state="${alphaExact ? "ok" : alphaSameCourse ? "warning" : ""}"><b>Alpha Active ${alphaSameCourse ? `r${alphaState.courseRevision || 0}` : "—"}</b><span>${alphaSameCourse ? `${shortDigest(alphaState.courseDigest)} · ${alphaState.status}` : "其他课程 / 未连接"}</span></div>
      <div class="version-cell" data-state="${eligibility.ok ? "ok" : ""}"><b>Released r${item?.publishedRevision ?? 0}</b><span>${eligibility.ok ? "exact digest 已验收，可发布" : "正式课堂保持不变"}</span></div>`;
    const publish = $("#publish");
    if (publish) { publish.disabled = !eligibility.ok || inspectPackage().issues.length > 0; publish.title = eligibility.reason; }
  }
  function syncSaveControls() {
    document.querySelectorAll("[data-save-course]").forEach((button) => {
      button.disabled = !dirty || Boolean(savePromise) || inspectPackage().issues.length > 0;
      if (savePromise) button.textContent = "正在保存…";
      else if (button.hasAttribute("data-save-context")) button.textContent = !dirty ? `Candidate r${revision} 已保存` : "保存整门课程";
      else if (!dirty) button.textContent = button.id === "saveCandidateDock" ? `Candidate r${revision} 已保存` : "保存 Candidate";
      else button.textContent = button.id === "saveCandidateDock" ? "保存整门课程" : "保存 Candidate";
    });
    const cardMeta = $("#cardSaveMeta");
    if (cardMeta) {
      const dock = cardMeta.closest(".card-context-save");
      dock.dataset.state = saveError ? "error" : savePromise ? "saving" : dirty ? "dirty" : "saved";
      cardMeta.textContent = saveError
        ? `上次保存失败：${saveError}；当前输入仍保留。`
        : savePromise
          ? `正在把完整 Working Copy 写成 Candidate r${revision + 1}…`
          : dirty
            ? `Working Copy · ${changedPaths.size || 1} 处未保存 · 基线 Candidate r${revision}`
            : `Candidate r${revision} · digest ${lastCandidateMeta?.digest || lastCandidateMeta?.digestShort || "已保存"}`;
    }
    $("#undoEdit").disabled = !undoStack.length || Boolean(savePromise);
    $("#redoEdit").disabled = !redoStack.length || Boolean(savePromise);
    renderVersionMatrix();
  }
  function pushUndo(snapshot) {
    if (!snapshot || undoStack.at(-1) === snapshot) return;
    undoStack.push(snapshot);
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }
  function applySnapshot(snapshot, message) {
    course = JSON.parse(snapshot);
    activeBlock = Math.min(activeBlock, course.blocks.length - 1);
    activeStep = Math.max(0, course.macroSteps.findIndex((step) => step.id === course.blocks[activeBlock].macroStepId));
    dirty = snapshot !== savedSnapshot;
    courseMeta = dirty ? null : lastCandidateMeta;
    changedPaths = dirty ? new Set(["*"]) : new Set();
    setSaveState(dirty ? "有未保存修改" : `Candidate r${revision} 已保存`, dirty ? "dirty" : "saved");
    syncRaw(); renderMetadata(); renderSteps(); renderBlocks(); renderCardLibrary(); renderPackageHealth(); renderAlphaSync(); renderCourseStudio();
    $("#fieldDialog").close();
    toast(message);
  }
  function undoEdit() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(course));
    applySnapshot(undoStack.pop(), "已撤销上一处可视化修改。");
  }
  function redoEdit() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(course));
    applySnapshot(redoStack.pop(), "已恢复上一处可视化修改。");
  }
  function fieldOptions(path) {
    if (path.endsWith(".leadMentorId")) return Object.entries(MENTOR_NAMES);
    if (path.endsWith(".state")) return [["active", "当值 / active"], ["support", "支撑 / support"], ["standby", "待命 / standby"]];
    if (path.endsWith(".boundary")) return Object.entries(BOUNDARY_NAMES);
    return null;
  }
  function updateCoupledField(path, value) {
    const match = path.match(/^macroSteps\.(\d+)\.name$/);
    if (match && course.formula?.fiveSteps?.[Number(match[1])]) course.formula.fiveSteps[Number(match[1])].name = value;
    if (path === "course.period") course.case.period = value;
    if (path === "course.name") course.title = `Mini Silicon Valley｜${value}｜LIVE RUN SCRIPT`;
    const leadMatch = path.match(/^blocks\.(\d+)\.leadMentorId$/);
    const activeMatch = path.match(/^blocks\.(\d+)\.seatTasks\.(mentor0[1-4])\.state$/);
    if (leadMatch) {
      const block = course.blocks[Number(leadMatch[1])];
      for (const mentorId of ["mentor01", "mentor02", "mentor03", "mentor04"]) {
        if (mentorId === value) block.seatTasks[mentorId].state = "active";
        else if (block.seatTasks[mentorId].state === "active") block.seatTasks[mentorId].state = "support";
      }
    }
    if (activeMatch && value === "active") {
      const block = course.blocks[Number(activeMatch[1])];
      const selected = activeMatch[2];
      block.leadMentorId = selected;
      for (const mentorId of ["mentor01", "mentor02", "mentor03", "mentor04"]) {
        if (mentorId !== selected && block.seatTasks[mentorId].state === "active") block.seatTasks[mentorId].state = "support";
      }
    }
  }
  function openFieldEditor(target) {
    const path = target.dataset.coursePath;
    if (!path) return;
    const value = getPath(course, path);
    if (value === undefined) return toast(`找不到课程字段：${path}`, true);
    fieldSession = {path, before: JSON.stringify(course), changed: false};
    const dialog = $("#fieldDialog");
    dialog.dataset.readonly = "false";
    $("#fieldDialogTitle").textContent = target.dataset.editLabel || "编辑课程字段";
    $("#fieldPath").textContent = path;
    const cardId = target.dataset.cardId || target.closest("[data-card-id]")?.dataset.cardId;
    $("#fieldCardId").textContent = cardId ? `稳定卡牌 ID：${cardId}` : "";
    $("#fieldHelp").textContent = Array.isArray(value) ? "每行一项；输入时九视窗立即同步，关闭弹窗不会丢失修改。" : "输入时直接修改浏览器 Working Copy；保存前对 Alpha 与正式课堂均为零副作用。";
    const options = fieldOptions(path);
    let control;
    if (options) {
      control = document.createElement("select");
      options.forEach(([key, label]) => control.add(new Option(label, key, false, value === key)));
    } else if (typeof value === "number") {
      control = document.createElement("input"); control.type = "number"; control.value = String(value);
    } else {
      control = document.createElement("textarea"); control.rows = Array.isArray(value) ? 10 : 8; control.value = Array.isArray(value) ? value.join("\n") : String(value ?? "");
    }
    control.id = "fieldValue";
    control.dataset.array = String(Array.isArray(value));
    $("#fieldControl").replaceChildren(control);
    $("#impactReport").textContent = `${document.querySelectorAll(`[data-course-path="${CSS.escape(path)}"]`).length} 个可见位置使用这个唯一源字段。`;
    const update = () => {
      let next = control.value;
      if (control.dataset.array === "true") next = next.split("\n").map((item) => item.trim()).filter(Boolean);
      else if (control.type === "number") next = Number(next);
      if (!fieldSession.changed) { pushUndo(fieldSession.before); fieldSession.changed = true; }
      setPath(course, path, next); updateCoupledField(path, next); markDirty(path); renderCourseStudio();
      $("#courseTitle").textContent = course.course.name;
      const affected = document.querySelectorAll(`[data-course-path="${CSS.escape(path)}"]`);
      affected.forEach((node) => node.classList.add("changed-flash"));
      $("#impactReport").textContent = `已同步 ${affected.length} 个可见位置；尚未保存到 Candidate。`;
    };
    control.addEventListener(options ? "change" : "input", update);
    dialog.showModal(); requestAnimationFrame(() => control.focus());
  }
  function openDerivedInfo(target) {
    const dialog = $("#fieldDialog");
    dialog.dataset.readonly = "true";
    $("#fieldDialogTitle").textContent = target.dataset.derivedLabel || "模拟 / 派生状态";
    $("#fieldPath").textContent = "无 Course Package 写入路径";
    $("#fieldCardId").textContent = "";
    $("#fieldControl").replaceChildren();
    $("#fieldHelp").textContent = target.dataset.derivedExplain || "这个值来自预览或真实运行状态。";
    $("#impactReport").textContent = "只读：不会写入课程 JSON，也不会进入 Candidate、Alpha 或正式课堂账本。";
    dialog.showModal();
  }

  function setMode(next) {
    mode = next;
    const definitions = {studio: ["#studioTab", "#studioPane"], structure: ["#structuredTab", "#structuredPane"], cards: ["#cardsTab", "#cardsPane"], json: ["#jsonTab", "#jsonPane"]};
    Object.entries(definitions).forEach(([name, [tab, pane]]) => {
      $(tab).setAttribute("aria-selected", String(name === next)); $(pane).hidden = name !== next;
    });
    if (next === "studio") renderCourseStudio();
    if (next === "cards") renderCardLibrary();
    if (next === "json") syncRaw();
  }
  function renderAll() {
    $("#courseKicker").textContent = `${course.course.id} · ${course.case.campaignId}`;
    $("#courseTitle").textContent = course.course.name;
    $("#revisionLine").textContent = `当前基线 r${revision} · Candidate 可供 Alpha 显式加载 · Working Copy 不会静默热更新任何 Run`;
    renderMetadata(); renderSteps(); renderBlocks(); renderCardFilterSteps(); renderCardLibrary(); renderPackageHealth(); renderAlphaSync(); syncRaw(); renderLibrary(); setMode(mode);
    syncSaveControls();
  }
  async function validate() {
    try {
      const data = await post("api/courses/validate", {course});
      toast(`结构正确：${data.macroSteps} 大步 / ${data.blocks} 小块 / ${data.decks} 卡组 / ${data.cards} 张卡 · ${data.metadata.digest.slice(0, 16)}。`);
      return true;
    } catch (error) { toast(`结构未通过：${error.message}`, true); return false; }
  }
  async function save(status) {
    if (savePromise) return savePromise;
    const isRelease = status === "released";
    if (isRelease && inspectPackage().issues.length) return toast("课程包不完整，已阻止发布。请先查看顶部诊断。", true);
    if (isRelease) {
      const eligibility = releaseEligibility();
      if (!eligibility.ok) return toast(`不能发布正式课堂：${eligibility.reason}`, true);
    }
    savePromise = (async () => {
      try {
        saveError = "";
        setSaveState(isRelease ? "正在移动 Released 指针" : "正在保存 Candidate", "loading");
        syncSaveControls();
        const data = isRelease
          ? await post("api/courses/release", {courseId: course.course.id, revision, digest: lastCandidateMeta?.digest || courseMeta?.digest})
          : await post("api/courses/save", {course, status: "candidate", expectedRevision: revision});
        course = data.course; courseMeta = data.metadata || null; lastCandidateMeta = data.metadata || null; revision = data.revision; catalog = data.catalog.courses; diagnostics = data.catalog.diagnostics || []; dirty = false; changedPaths = new Set(); savedSnapshot = JSON.stringify(course);
        await refreshAlphaState(); renderAll();
        setSaveState(isRelease ? `Released r${revision}` : `Candidate r${revision} 已保存`, "saved");
        toast(isRelease ? "Released 指针已原子指向已验收的 exact Candidate；课程正文没有复制或改写，既有课堂保持原版本。" : `Candidate r${revision} 已保存。Alpha 只提示待加载；正式课堂完全不受影响。`);
        return data;
      } catch (error) {
        saveError = error.message || "未知保存错误";
        setSaveState(isRelease ? "发布失败" : "Candidate 保存失败", "error");
        toast(error.message, true);
        return null;
      } finally {
        savePromise = null;
        syncSaveControls();
      }
    })();
    return savePromise;
  }
  async function applyRaw() {
    try {
      const value = JSON.parse($("#rawJson").value); const result = await post("api/courses/validate", {course: value});
      pushUndo(JSON.stringify(course)); course = value; courseMeta = null; activeStep = 0; activeBlock = 0; activeCard = 0; mode = "studio"; markDirty("*"); renderAll();
      toast(`JSON 已应用：${result.decks} 卡组 / ${result.cards} 张卡。`);
    } catch (error) { toast(`JSON 未应用：${error.message}`, true); }
  }
  function download() {
    if (!course) return;
    const blob = new Blob([JSON.stringify(course, null, 2) + "\n"], {type: "application/json"});
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${course.course.id}.json`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function importFile(file) {
    try {
      const value = JSON.parse(await file.text()); const validated = await post("api/courses/validate", {course: value});
      const item = catalog.find((entry) => entry.id === value.course.id);
      course = value; courseMeta = null; lastCandidateMeta = validated.metadata; revision = item?.latestRevision || 0; activeStep = 0; activeBlock = 0; activeCard = 0; dirty = true; mode = "studio"; changedPaths = new Set(["*"]);
      $("#emptyState").hidden = true; $("#editor").hidden = false; $("#download").disabled = false; renderAll(); markDirty("*");
      toast("JSON 已导入并通过完整检查；请保存为 Candidate。");
    } catch (error) { toast(`导入失败：${error.message}`, true); }
  }
  async function openHistory() {
    if (!course) return;
    if (dirty) return toast("先保存或放弃当前修改，再恢复历史版本。", true);
    try {
      const data = await request(`api/courses/${encodeURIComponent(course.course.id)}/history`);
      const list = $("#historyList");
      list.innerHTML = data.history.length ? data.history.map((item) => `<article class="history-item">
        <div><b>r${esc(item.revision)} · ${esc(item.status === "bundled" ? "内置基线" : item.status === "candidate" ? "当前 Candidate" : item.status === "released" ? "当前 Released" : "历史快照")}</b><span>${esc(item.updatedAt || "随 release 提供")} · ${esc(item.deckCount)} 卡组 / ${esc(item.cardCount)} 张卡${item.approved ? " · 已验收" : ""}</span><code>${esc(item.digest.slice(0, 16))}</code></div>
        ${item.revision === revision ? `<span class="current-revision">当前基线</span>` : `<button type="button" class="button ghost" data-restore-revision="${esc(item.revision)}">恢复为新 Candidate</button>`}
      </article>`).join("") : `<p>还没有历史修订。首次保存后会自动生成不可变快照。</p>`;
      list.querySelectorAll("[data-restore-revision]").forEach((button) => {
        let armed = false; let timer;
        button.onclick = async () => {
          if (!armed) {
            armed = true; button.textContent = `再次点击：恢复 r${button.dataset.restoreRevision}`; button.classList.add("primary");
            timer = setTimeout(() => { armed = false; button.textContent = "恢复为新 Candidate"; button.classList.remove("primary"); }, 5000);
            return;
          }
          clearTimeout(timer); button.disabled = true;
          try {
            const data = await post("api/courses/restore", {courseId: course.course.id, sourceRevision: Number(button.dataset.restoreRevision), expectedRevision: revision});
            course = data.course; courseMeta = data.metadata || null; lastCandidateMeta = data.metadata || null; revision = data.revision; catalog = data.catalog.courses; diagnostics = data.catalog.diagnostics || []; dirty = false; savedSnapshot = JSON.stringify(course); changedPaths = new Set();
            $("#historyDialog").close(); renderAll(); setSaveState(`Candidate r${revision} 已恢复`, "saved");
            toast(`历史 r${button.dataset.restoreRevision} 已复制为新 Candidate r${revision}。当前 Alpha 尚未改变，请核对后手动加载。`);
          } catch (error) { button.disabled = false; toast(`恢复失败：${error.message}`, true); }
        };
      });
      $("#historyDialog").showModal();
    } catch (error) { toast(`历史读取失败：${error.message}`, true); }
  }
  async function init() {
    try {
      await loadReleaseInfo();
      const bootstrap = await request("api/bootstrap");
      token = bootstrap.token; alphaState = bootstrap.state; serverSchemaVersion = bootstrap.courseSchemaVersion; serverEditorBuild = bootstrap.editorBuild;
      await loadCatalog();
      const requested = new URLSearchParams(window.location.search).get("course");
      const preferred = catalog.some((item) => item.id === requested) ? requested : bootstrap.state?.courseId || catalog[0]?.id;
      if (preferred) await openCourse(preferred);
      setInterval(refreshAlphaState, 2000);
    } catch (error) { setSaveState("无法使用", "error"); toast(error.message, true); }
  }

  $("#studioTab").onclick = () => setMode("studio");
  $("#structuredTab").onclick = () => setMode("structure");
  $("#cardsTab").onclick = () => setMode("cards");
  $("#jsonTab").onclick = () => setMode("json");
  $("#validate").onclick = validate;
  $("#historyButton").onclick = openHistory;
  $("#historyClose").onclick = () => $("#historyDialog").close();
  $("#publish").onclick = () => save("released");
  $("#undoEdit").onclick = undoEdit;
  $("#redoEdit").onclick = redoEdit;
  $("#openLibrary").onclick = (event) => libraryCollapsed ? openLibrary(event.currentTarget) : closeLibrary();
  $("#topbarLibrary").onclick = (event) => libraryCollapsed ? openLibrary(event.currentTarget) : closeLibrary();
  $("#closeLibrary").onclick = (event) => libraryCollapsed ? openLibrary(event.currentTarget) : closeLibrary({restoreFocus: drawerLibraryMedia.matches});
  $("#libraryBackdrop").onclick = () => closeLibrary({restoreFocus: true});
  $("#fieldClose").onclick = () => $("#fieldDialog").close();
  $("#previousBlock").onclick = () => selectedBlock(activeBlock - 1);
  $("#nextBlock").onclick = () => selectedBlock(activeBlock + 1);
  $("#timelineDensity").onchange = renderTimeline;
  $("#onlyWarnings").onchange = renderTimeline;
  $("#previewRunStatus").onchange = (event) => { previewStatus = event.target.value; renderCourseStudio(); };
  $("#previewSeed").oninput = (event) => { previewSeed = event.target.value || "MSV-PREVIEW-01"; renderCourseStudio(); };
  $("#nextSeed").onclick = () => { const match = previewSeed.match(/^(.*?)-(\d+)$/); previewSeed = match ? `${match[1]}-${String(Number(match[2]) + 1).padStart(match[2].length, "0")}` : `${previewSeed}-02`; $("#previewSeed").value = previewSeed; renderCourseStudio(); };
  $("#focusSeatA").onchange = (event) => { focusSeatA = event.target.value; renderCourseStudio(); };
  $("#focusSeatB").onchange = (event) => { focusSeatB = event.target.value; renderCourseStudio(); };
  $("#controllerHeight").oninput = (event) => $("#controllerShell").style.setProperty("--controller-height", `${event.target.value}px`);
  $("#toggleController").onclick = () => { controllerCollapsed = !controllerCollapsed; renderCourseStudio(); };
  $("#studioPane").addEventListener("click", (event) => {
    const editable = event.target.closest("[data-course-path]");
    if (editable) { event.preventDefault(); openFieldEditor(editable); return; }
    const derived = event.target.closest("[data-derived-explain]");
    if (derived) { event.preventDefault(); openDerivedInfo(derived); return; }
    const block = event.target.closest("[data-preview-block]");
    if (block) { selectedBlock(Number(block.dataset.previewBlock)); return; }
    const step = event.target.closest("[data-preview-step]");
    if (step) {
      const index = course.blocks.findIndex((item) => item.macroStepId === course.macroSteps[Number(step.dataset.previewStep)].id);
      if (index >= 0) selectedBlock(index);
      return;
    }
    const layout = event.target.closest("[data-layout]");
    if (layout) { studioLayout = layout.dataset.layout; renderCourseStudio(); }
  });
  document.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save-course]");
    if (saveButton) { event.preventDefault(); save("draft"); }
  });
  $("#applyJson").onclick = applyRaw;
  $("#download").onclick = download;
  $("#addCard").onclick = addCard;
  $("#simulateDeal").onclick = simulateDeal;
  $("#previewState").onchange = renderLearnerPreview;
  for (const selector of ["#cardSearch", "#cardStepFilter", "#cardBoundaryFilter", "#cardSourceFilter", "#cardAlphaFilter"]) {
    $(selector).addEventListener(selector === "#cardSearch" ? "input" : "change", () => { if (course) renderCardResults(); });
  }
  $("#resetCardFilters").onclick = resetCardFilters;
  $("#importFile").onchange = (event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; };
  $("#newCourse").onclick = () => { if (dirty) return toast("请先保存当前 Candidate，再创建新课程。", true); $("#cloneDialog").showModal(); };
  $("#cloneCancel").onclick = () => $("#cloneDialog").close();
  $("#cloneForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await post("api/courses/clone", {sourceCourseId: $("#cloneSource").value, newCourseId: $("#cloneId").value.trim(), newName: $("#cloneName").value.trim()});
      $("#cloneDialog").close(); course = data.course; courseMeta = data.metadata || null; lastCandidateMeta = data.metadata || null; revision = data.revision; catalog = data.catalog.courses; diagnostics = data.catalog.diagnostics || []; activeStep = 0; activeBlock = 0; activeCard = 0; dirty = false; mode = "studio"; savedSnapshot = JSON.stringify(course); changedPaths = new Set(); undoStack = []; redoStack = [];
      $("#emptyState").hidden = true; $("#editor").hidden = false; $("#download").disabled = false; resetCardFilters(); renderAll(); setSaveState(`Candidate r${revision} 已保存`, "saved"); toast("新课程 Candidate 已创建。现在可在九视窗中逐块精编。");
    } catch (error) { toast(error.message, true); }
  };
  window.addEventListener("keydown", (event) => {
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "s") { event.preventDefault(); if (dirty) save("draft"); }
    if (command && event.key.toLowerCase() === "z" && !event.shiftKey && !$("#fieldDialog").open) { event.preventDefault(); undoEdit(); }
    if (command && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) && !$("#fieldDialog").open) { event.preventDefault(); redoEdit(); }
    if (event.key === "Escape" && drawerLibraryMedia.matches && !libraryCollapsed) { event.preventDefault(); closeLibrary({restoreFocus: true}); }
  });
  compactLibraryMedia.addEventListener("change", (event) => {
    if (libraryPreference === null) setLibraryCollapsed(event.matches, {persist: false});
    else renderLibraryDisclosure();
  });
  drawerLibraryMedia.addEventListener("change", renderLibraryDisclosure);
  window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  renderLibraryDisclosure();
  init();
})();
