(() => {
  "use strict";
  const BASE = new URL("../", window.location.href);
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const SEATS = [
    ["mentor01", "导师 1 · 产品 / 主 DM"], ["mentor02", "导师 2 · 开发"],
    ["mentor03", "导师 3 · 市场"], ["mentor04", "导师 4 · 运营"],
    ["learner01", "学员 1"], ["learner02", "学员 2"], ["learner03", "学员 3"], ["learner04", "学员 4"],
  ];
  const MODE_NAMES = {yarn:"毛线式 · 获取交换信息", american:"美式 · 情境攻坚", euro:"德式 · 资源经营"};
  const MENTOR_NAMES = {mentor01:"P · 产品导师", mentor02:"D · 开发导师", mentor03:"M · 市场导师", mentor04:"O · 运营导师"};
  let token = "", catalog = [], diagnostics = [], course = null, revision = 0, activeStep = 0, activeBlock = 0, dirty = false, rawMode = false;
  let toastTimer;

  function endpoint(path) { return new URL(String(path).replace(/^\/+/, ""), BASE); }
  async function request(path, options = {}) {
    const response = await fetch(endpoint(path), {cache:"no-store", credentials:"same-origin", ...options});
    if (response.status === 401) {
      window.location.assign(new URL(`../auth/login?returnTo=${encodeURIComponent("/control/editor/")}`, BASE));
      throw new Error("登录已失效，正在返回登录页。");
    }
    const envelope = await response.json();
    if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message || "请求失败");
    return envelope.data;
  }
  function post(path, body) {
    return request(path, {method:"POST", headers:{"Content-Type":"application/json", "X-Live-Run-Token":token}, body:JSON.stringify(body)});
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer); const node = $("#toast"); node.textContent = message; node.className = `toast show${error ? " error" : ""}`;
    toastTimer = setTimeout(() => { node.className = "toast"; }, 4200);
  }
  function setSaveState(value, state) { const node = $("#saveState"); node.textContent = value; node.dataset.state = state; }
  function markDirty() { dirty = true; setSaveState("有未保存修改", "dirty"); syncRaw(); }
  function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[Number.isInteger(+key) ? +key : key], object); }
  function setPath(object, path, value) {
    const keys = path.split("."); let target = object;
    keys.slice(0, -1).forEach((key) => { target = target[Number.isInteger(+key) ? +key : key]; });
    const last = keys.at(-1); target[Number.isInteger(+last) ? +last : last] = value;
  }
  function syncRaw() { if (course) $("#rawJson").value = JSON.stringify(course, null, 2); }

  async function loadCatalog() {
    const data = await request("api/courses"); catalog = data.courses; diagnostics = data.diagnostics || []; renderLibrary();
  }
  function renderLibrary() {
    $("#courseList").innerHTML = catalog.map((item) => `<button class="course-item" data-course="${esc(item.id)}" aria-current="${course?.course?.id === item.id}">
      <b>${esc(item.name)}</b><small>${esc(item.period)} · ${esc(item.id)}</small>
      <span>${item.hasDraft ? `草稿 r${item.draftRevision} · 已发布 r${item.publishedRevision}` : `${item.source === "bundled" ? "内置" : "已发布"} · r${item.publishedRevision}`}</span>
    </button>`).join("");
    document.querySelectorAll("[data-course]").forEach((button) => button.onclick = () => {
      if (dirty) { toast("当前有未保存修改：请先保存草稿或发布，再切换课程。", true); return; }
      openCourse(button.dataset.course);
    });
    const area = $("#diagnostics");
    area.hidden = diagnostics.length === 0;
    area.innerHTML = diagnostics.length ? `<b>发现 ${diagnostics.length} 个无效课程文件</b>${diagnostics.map((item) => `<p>${esc(item.file)}<br>${esc(item.message)}</p>`).join("")}` : "";
    $("#cloneSource").innerHTML = catalog.filter((item) => item.publishedRevision >= 0).map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
  }
  async function openCourse(courseId) {
    try {
      setSaveState("正在载入", "loading");
      const data = await request(`api/courses/${encodeURIComponent(courseId)}?variant=draft`);
      course = data.course; revision = data.revision; activeStep = 0; activeBlock = 0; dirty = false; rawMode = false;
      $("#emptyState").hidden = true; $("#editor").hidden = false; $("#download").disabled = false;
      renderAll(); setSaveState(data.variant === "draft" ? `草稿 r${revision} 已保存` : `已发布 r${revision}`, "saved");
    } catch (error) { toast(error.message, true); setSaveState("载入失败", "error"); }
  }
  function field(label, path, options = {}) {
    const value = getPath(course, path);
    const wide = options.wide ? " wide" : "";
    if (options.select) return `<label class="${wide}">${esc(label)}${options.help ? `<small>${esc(options.help)}</small>` : ""}<select data-path="${esc(path)}">${options.select.map(([key,name]) => `<option value="${esc(key)}" ${value === key ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
    if (options.textarea) return `<label class="${wide}">${esc(label)}${options.help ? `<small>${esc(options.help)}</small>` : ""}<textarea data-path="${esc(path)}" ${options.array ? "data-array=\"true\"" : ""}>${esc(options.array ? value.join("\n") : value)}</textarea></label>`;
    return `<label class="${wide}">${esc(label)}${options.help ? `<small>${esc(options.help)}</small>` : ""}<input data-path="${esc(path)}" value="${esc(value)}" ${options.locked ? "readonly class=\"locked-field\"" : ""} ${options.type ? `type="${options.type}"` : ""}></label>`;
  }
  function renderMetadata() {
    $("#metadataForm").innerHTML = `
      ${field("课程 ID", "course.id", {locked:true, help:"稳定文件名与加载键；克隆时确定。"})}
      ${field("课程名称", "course.name")}
      ${field("时代 / 时间范围", "course.period")}
      ${field("课堂素材底座", "case.campaignId", {select:[["google-1995-2004","Google 课堂素材包"],["eleme-2008-find-problem","饿了么课堂素材包"]], help:"决定真实发牌与课堂 API 数据。"})}
      ${field("课程简介", "course.description", {textarea:true, wide:true})}
      ${field("学员安全队名", "case.learnerName", {help:"揭晓前学员看到的名称。"})}
      ${field("案例时间", "case.period")}
      ${field("导师案例名", "case.name", {wide:true})}
      ${field("为什么值得学", "case.why", {textarea:true, wide:true})}`;
    bindInputs($("#metadataForm"));
  }
  function renderSteps() {
    $("#stepTabs").innerHTML = course.macroSteps.map((step, index) => `<button data-step="${index}" aria-current="${index === activeStep ? "step" : "false"}">${step.order}. ${esc(step.name)}</button>`).join("");
    document.querySelectorAll("[data-step]").forEach((button) => button.onclick = () => { activeStep = +button.dataset.step; activeBlock = course.blocks.findIndex((block) => block.macroStepId === course.macroSteps[activeStep].id); renderSteps(); renderBlocks(); });
  }
  function renderBlocks() {
    const step = course.macroSteps[activeStep];
    const indexes = course.blocks.map((block,index) => [block,index]).filter(([block]) => block.macroStepId === step.id);
    $("#blockList").innerHTML = indexes.map(([block,index]) => `<button type="button" data-block="${index}" aria-current="${index === activeBlock}"><b>${esc(block.id)}</b><span>${esc(block.title)}</span></button>`).join("");
    document.querySelectorAll("[data-block]").forEach((button) => button.onclick = () => { activeBlock = +button.dataset.block; renderBlocks(); });
    renderBlockForm();
  }
  function renderBlockForm() {
    const block = course.blocks[activeBlock], step = course.macroSteps[activeStep], bp = `blocks.${activeBlock}`, sp = `macroSteps.${activeStep}`;
    const checks = Object.entries(MODE_NAMES).map(([id,name]) => `<label><input type="checkbox" data-mode="${id}" ${block.gameModes.includes(id) ? "checked" : ""}>${esc(name)}</label>`).join("");
    const seats = SEATS.map(([id,name]) => `<div class="seat-card"><h4>${esc(name)}</h4>
      ${field("状态", `${bp}.seatTasks.${id}.state`, {select:[["active","当值 / active"],["support","支撑 / support"],["standby","待命 / standby"]]})}
      ${field("徽标", `${bp}.seatTasks.${id}.badge`)}
      ${field("此刻唯一任务", `${bp}.seatTasks.${id}.task`, {textarea:true})}</div>`).join("");
    $("#blockForm").innerHTML = `
      <section class="form-section"><h3>第 ${step.order} 大步 · 定义</h3><div class="field-grid">
        ${field("大步名称", `${sp}.name`)}
        ${field("主导师顺序", `${sp}.mentorSequence`, {textarea:true, array:true, help:"mentor01—mentor04，每行一个。"})}
        ${field("本步核心问题", `${sp}.question`, {textarea:true, wide:true})}
        ${field("本步完成门槛", `${sp}.exitGate`, {textarea:true, wide:true})}
      </div></section>
      <section class="form-section"><h3>${esc(block.id)} · 小步骤基本信息</h3><div class="field-grid">
        ${field("小步骤标题", `${bp}.title`, {wide:true})}
        ${field("当值导师", `${bp}.leadMentorId`, {select:Object.entries(MENTOR_NAMES)})}
        ${field("建议分钟", `${bp}.suggestedMinutes`, {type:"number"})}
        ${field("系统动作（锁定）", `${bp}.apiAction`, {locked:true, help:"13 块执行安全契约，不在表单中改。"})}
        <label class="wide">本块玩法<div class="checks">${checks}</div></label>
      </div></section>
      <section class="form-section"><h3>双轨内容与学员视角</h3><div class="field-grid">
        ${field("历史学习轨", `${bp}.historyTrack`, {textarea:true, wide:true})}
        ${field("现实实践轨", `${bp}.realityTrack`, {textarea:true, wide:true})}
        ${field("给学员的一句话", `${bp}.studentPrompt`, {textarea:true, wide:true, help:"初中生看得懂，只说眼前动作。"})}
        ${field("我身处什么世界", `${bp}.learnerLens.world`, {textarea:true})}
        ${field("我要说什么", `${bp}.learnerLens.say`, {textarea:true})}
        ${field("我要问什么", `${bp}.learnerLens.ask`, {textarea:true})}
        ${field("怎样算完成", `${bp}.learnerLens.done`, {textarea:true})}
      </div></section>
      <section class="form-section"><h3>导师执行 SOP</h3><div class="field-grid">
        ${field("当值导师逐句口播", `${bp}.mentorScript`, {textarea:true, array:true, wide:true, help:"每行一句。"})}
        ${field("学员现场动作", `${bp}.studentActions`, {textarea:true, array:true})}
        ${field("执行后系统变化", `${bp}.systemActions`, {textarea:true, array:true})}
        ${field("本块道具", `${bp}.props`, {textarea:true, array:true})}
        ${field("人工验收门", `${bp}.evidenceGate`, {textarea:true, array:true})}
        ${field("卡住时兜底", `${bp}.fallback`, {textarea:true, array:true})}
        ${field("线下与八窗配合", `${bp}.manualInteraction`, {textarea:true, wide:true})}
      </div></section>
      <section class="form-section"><h3>8 个席位此刻分别做什么</h3><div class="seat-grid">${seats}</div></section>`;
    bindInputs($("#blockForm"));
    document.querySelectorAll("[data-mode]").forEach((input) => input.onchange = () => {
      block.gameModes = Object.keys(MODE_NAMES).filter((id) => document.querySelector(`[data-mode="${id}"]`).checked); markDirty();
    });
  }
  function bindInputs(root) {
    root.querySelectorAll("[data-path]").forEach((input) => input.oninput = () => {
      let value = input.value;
      if (input.dataset.array === "true") value = value.split("\n").map((item) => item.trim()).filter(Boolean);
      else if (input.type === "number") value = Number(value);
      setPath(course, input.dataset.path, value);
      if (/^macroSteps\.\d+\.name$/.test(input.dataset.path)) course.formula.fiveSteps[activeStep].name = value;
      if (input.dataset.path === "course.period") course.case.period = value;
      if (input.dataset.path === "course.name") course.title = `Mini Silicon Valley｜${value}｜LIVE RUN SCRIPT`;
      markDirty();
      $("#courseTitle").textContent = course.course.name;
    });
  }
  function renderAll() {
    $("#courseKicker").textContent = `${course.course.id} · ${course.case.campaignId}`;
    $("#courseTitle").textContent = course.course.name;
    $("#revisionLine").textContent = `当前基线 r${revision} · ${course.authoring?.status === "draft" ? "草稿优先载入" : "已发布版本"} · 发布只影响新 Run`;
    renderMetadata(); renderSteps(); renderBlocks(); syncRaw(); renderLibrary(); setMode(false);
  }
  function setMode(raw) {
    rawMode = raw; $("#structuredPane").hidden = raw; $("#jsonPane").hidden = !raw;
    $("#structuredTab").setAttribute("aria-selected", String(!raw)); $("#jsonTab").setAttribute("aria-selected", String(raw));
    if (raw) syncRaw();
  }
  async function validate() {
    try { const data = await post("api/courses/validate", {course}); toast(`结构正确：${data.macroSteps} 个大步骤 / ${data.blocks} 个小步骤。`); return true; }
    catch (error) { toast(`结构未通过：${error.message}`, true); return false; }
  }
  async function save(status) {
    try {
      setSaveState(status === "published" ? "正在发布" : "正在保存", "loading");
      const data = await post("api/courses/save", {course, status, expectedRevision:revision});
      course = data.course; revision = data.revision; catalog = data.catalog.courses; diagnostics = data.catalog.diagnostics || []; dirty = false;
      renderAll(); setSaveState(status === "published" ? `已发布 r${revision}` : `草稿 r${revision} 已保存`, "saved");
      toast(status === "published" ? "已发布。LIVE RUN 主控创建新 Run 时会加载这一版。" : "草稿已安全保存，不会影响正在上课的版本。");
    } catch (error) { setSaveState("保存失败", "error"); toast(error.message, true); }
  }
  async function applyRaw() {
    try {
      const value = JSON.parse($("#rawJson").value); await post("api/courses/validate", {course:value});
      course = value; activeStep = 0; activeBlock = 0; markDirty(); renderMetadata(); renderSteps(); renderBlocks();
      toast("JSON 已格式化并同步到结构化表单。");
    } catch (error) { toast(`JSON 未应用：${error.message}`, true); }
  }
  function download() {
    if (!course) return;
    const blob = new Blob([JSON.stringify(course, null, 2) + "\n"], {type:"application/json"});
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${course.course.id}.json`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function importFile(file) {
    try {
      const value = JSON.parse(await file.text()); await post("api/courses/validate", {course:value});
      const item = catalog.find((entry) => entry.id === value.course.id);
      course = value; revision = item?.latestRevision || 0; activeStep = 0; activeBlock = 0; dirty = true;
      $("#emptyState").hidden = true; $("#editor").hidden = false; $("#download").disabled = false; renderAll(); markDirty();
      toast("JSON 已导入并通过结构检查；请保存草稿或发布。")
    } catch (error) { toast(`导入失败：${error.message}`, true); }
  }
  async function init() {
    try {
      const bootstrap = await request("api/bootstrap"); token = bootstrap.token; await loadCatalog();
      const preferred = bootstrap.state?.courseId || catalog[0]?.id; if (preferred) await openCourse(preferred);
    } catch (error) { setSaveState("无法使用", "error"); toast(error.message, true); }
  }

  $("#structuredTab").onclick = () => setMode(false); $("#jsonTab").onclick = () => setMode(true);
  $("#validate").onclick = validate; $("#saveDraft").onclick = () => save("draft"); $("#publish").onclick = () => save("published");
  $("#applyJson").onclick = applyRaw; $("#download").onclick = download;
  $("#importFile").onchange = (event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; };
  $("#newCourse").onclick = () => { if (dirty) return toast("请先保存当前修改，再创建新课程。", true); $("#cloneDialog").showModal(); };
  $("#cloneCancel").onclick = () => $("#cloneDialog").close();
  $("#cloneForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await post("api/courses/clone", {sourceCourseId:$("#cloneSource").value, newCourseId:$("#cloneId").value.trim(), newName:$("#cloneName").value.trim()});
      $("#cloneDialog").close(); course = data.course; revision = data.revision; catalog = data.catalog.courses; diagnostics = data.catalog.diagnostics || []; activeStep = 0; activeBlock = 0; dirty = false;
      $("#emptyState").hidden = true; $("#editor").hidden = false; $("#download").disabled = false; renderAll(); setSaveState(`草稿 r${revision} 已保存`, "saved"); toast("新课程草稿已创建。先逐块改内容，再发布。");
    } catch (error) { toast(error.message, true); }
  };
  init();
})();
