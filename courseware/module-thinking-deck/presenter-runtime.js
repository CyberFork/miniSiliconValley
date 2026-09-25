(function () {
  "use strict";
  const model = window.MSV_MODULE_DECK;
  const notes = window.MSV_MODULE_PRESENTER_NOTES;
  if (!model || !notes) throw new Error("教师视图数据未完整加载");

  // Compatible resource entry for published teacher HTML as well as new builds.
  const teachingResources = document.querySelector('.teaching-resources');
  if (teachingResources) {
    let workbookLink = teachingResources.querySelector('[data-prompt-workbook-link]');
    if (!workbookLink) {
      workbookLink = document.createElement('a');
      workbookLink.dataset.promptWorkbookLink = '';
      teachingResources.insertBefore(workbookLink, teachingResources.querySelector('a'));
    }
    const audienceEntry = new URL(document.documentElement.dataset.audienceUrl || '../audience/index.html', location.href);
    workbookLink.href = new URL('ai-materials/workbook/index.html', audienceEntry).href;
    workbookLink.target = '_blank';
    workbookLink.rel = 'noopener';
    workbookLink.textContent = '提示词模板与三合一示例 ↗';
  }

  const params = new URLSearchParams(location.search);
  let session = sanitizeSession(params.get("session")) || createSession();
  const storageKey = () => `msv:${model.id}:${model.version}:${session}`;
  const eventKey = () => `${storageKey()}:event`;
  const channelName = () => `msv:${model.id}:${model.version}:${session}`;
  let state = params.has("slideId") ? normalize({slideId:params.get("slideId"),reveal:params.get("step")}) : readState();
  let channel = null;
  let audienceWindow = null;
  let lastAudienceSignal = 0;
  const textEdits = window.MSVTextEditions?.create({model,teacher:true,getSession:()=>session,rerender:render});

  function sanitizeSession(value) { return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : ""; }
  function createSession() { return `run-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,8)}`; }
  function maxReveal(index) { return ((model.slides[index]?.content || "").match(/data-reveal/g) || []).length; }
  function isRecap(index) { return (model.slides[index]?.content || "").includes("data-recap-fold"); }
  function recapMask(value, reveal) { return Number.isInteger(value) && value >= 0 && value <= 7 ? value : (1 << Math.floor(reveal)) - 1; }
  function recapStep(mask, direction) {
    const order = direction > 0 ? [0,1,2] : [2,1,0];
    const bit = order.find(index => direction > 0 ? !(mask & (1 << index)) : mask & (1 << index));
    return bit === undefined ? mask : mask ^ (1 << bit);
  }
  function revealState(direction) {
    return isRecap(state.slide)
      ? { ...state, activity: { ...state.activity, recapOpen: recapStep(state.activity.recapOpen, direction) } }
      : { ...state, reveal: state.reveal + direction };
  }
  function normalize(next) {
    const requestedId = model.slideAliases?.[next?.slideId] || next?.slideId;
    const idIndex = next?.slide === undefined ? model.slides.findIndex(item => item.id === requestedId) : -1;
    const rawIndex = Number(next?.slide);
    const slide = idIndex >= 0 ? idIndex : Math.max(0, Math.min(model.slides.length - 1, Number.isFinite(rawIndex) ? Math.floor(rawIndex) : 0));
    let reveal = Math.max(0, Math.min(maxReveal(slide), Number(next?.reveal) || 0));
    const recapOpen = isRecap(slide) ? recapMask(next?.activity?.recapOpen, reveal) : 0;
    if (isRecap(slide)) reveal = [0,1,2].filter(index => recapOpen & (1 << index)).length;
    const tradeoffTab = [0,1,2,3].includes(next?.activity?.tradeoffTab) ? next.activity.tradeoffTab : 0;
    const tradeoffPlay = next?.activity?.tradeoffPlay === true;
    const tradeoffStarted = model.slides[slide].id === "module-tradeoff" && Number.isFinite(next?.activity?.tradeoffStarted) ? Math.max(0,next.activity.tradeoffStarted) : 0;
    const relationView = model.slides[slide].id === "module-s05" && ["product","modules","functions"].includes(next?.activity?.relationView) ? next.activity.relationView : "product";
    const carAction = model.slides[slide].id === "module-s05" && ["drive","jump","turn","river"].includes(next?.activity?.carAction) ? next.activity.carAction : "drive";
    const bagDemo = model.slides[slide].id==='module-my-check'?{open:next?.activity?.bagDemo?.open===true,mode:next?.activity?.bagDemo?.mode==='wrong'?'wrong':'correct',startedAt:Number.isFinite(next?.activity?.bagDemo?.startedAt)?Math.max(0,next.activity.bagDemo.startedAt):0}:{open:false,mode:'wrong',startedAt:0};
    const mapFocus = ["module-minecraft-map","module-s12"].includes(model.slides[slide].id) && /^(all|(?:module|path):[a-z]+)$/.test(next?.activity?.mapFocus) ? next.activity.mapFocus : "all";
    const workedCase = model.slides[slide].id === "module-s12" && ["route","move","pickup","bag","finish","check"].includes(next?.activity?.workedCase) ? next.activity.workedCase : "route";
    const assemblyMode = model.slides[slide].id === "module-s14" && next?.activity?.assemblyMode === "joined" ? "joined" : "split";
    const interfaceCase = model.slides[slide].id === "module-s13" && ["move","pickup","bag","finish","template"].includes(next?.activity?.interfaceCase) ? next.activity.interfaceCase : "move";
    const blackboxCase = model.slides[slide].id === "module-s10" && [0,1,2].includes(next?.activity?.blackboxCase) ? next.activity.blackboxCase : -1;
    const transformCase = ["car", "plane", "robot"].includes(next?.activity?.transformCase) ? next.activity.transformCase : "car";
    const buildStep = ["parts", "components", "works"].includes(next?.activity?.buildStep) ? next.activity.buildStep : "parts";
    const conveyorFocus = ["duty","input","rule","output","interface","exception"].includes(next?.activity?.conveyorFocus) ? next.activity.conveyorFocus : "duty";
    const voxelCase = ["car", "scope"].includes(next?.activity?.voxelCase) ? next.activity.voxelCase : "car";
    const voxelStep = ["blocks", "components", "object"].includes(next?.activity?.voxelStep) ? next.activity.voxelStep : "blocks";
    return { slide, slideId: model.slides[slide].id, reveal, activity: { ai: globalThis.window?.MSVAiLessons?.normalize(next?.activity?.ai), transformCase, buildStep, voxelCase, voxelStep, conveyorFocus, recapOpen, tradeoffTab, tradeoffPlay, blackboxCase, interfaceCase, assemblyMode, workedCase, mapFocus, bagDemo, tradeoffStarted, relationView, carAction }, updatedAt: Date.now() };
  }
  function readState() { try { const saved=JSON.parse(localStorage.getItem(storageKey()) || "null"); return normalize(saved?.slideId ? {...saved,slide:undefined} : saved); } catch { return normalize(null); } }
  function selectBagDemo(action){
    const prior=state.activity.bagDemo;
    const value=action==='close'?{...prior,open:false}:{open:true,mode:action==='open'?'wrong':['wrong','correct'].includes(action)?action:prior.mode,startedAt:Date.now()};
    setState({...state,activity:{...state.activity,bagDemo:value}});
    const selector=action==='close'?'[data-bag-demo-action="open"]':`[data-bag-demo-action="${action==='open'?'wrong':action}"]`;
    document.querySelector('#current-preview')?.querySelector(selector)?.focus({preventScroll:true});
  }
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
      if (message.type === "ready") { send("state", { state }); textEdits?.send(); }
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
    if (state.reveal < limit) setState(revealState(1));
    else if (state.slide < model.slides.length - 1) setState({ slide: state.slide + 1, reveal: 0 });
  }
  function back() {
    if (state.reveal > 0) setState(revealState(-1));
    else if (state.slide > 0) setState({ slide: state.slide - 1, reveal: maxReveal(state.slide - 1) });
  }
  function directSlide(delta) { setState({ slide: Math.max(0, Math.min(model.slides.length - 1, state.slide + delta)), reveal: 0 }); }

  function slideMarkup(slide, index) {
    return `<section class="deck-slide" data-slide-id="${slide.id}" data-source="${slide.source}" data-theme="${slide.theme || "paper"}">
      <header class="slide-topline"><span class="slide-code">${slide.source} · ${slide.phase || slide.section}</span><img class="slide-brand" src="assets/mini-silicon-valley-logo-transparent.png" alt="MINI硅谷"></header>
      <div class="slide-heading"><h1>${slide.title}</h1><p>${slide.subtitle}</p></div>
      <div class="slide-body">${slide.content}</div>
      <div class="slide-footer">${model.footer || model.title}</div>
      <div class="slide-page">${String(index + 1).padStart(2,"0")} / ${String(model.slides.length).padStart(2,"0")}</div>
      <div class="slide-progress"><i style="width:${((index + 1)/model.slides.length)*100}%"></i></div>
    </section>`;
  }
  function wirePreviewInteractions(stage, interactive) {
    window.MSVLessonTools?.wireBagDemo(stage,interactive?state.activity.bagDemo:{},interactive?selectBagDemo:null);
    window.MSVAiLessons?.wire(stage,interactive?state.activity.ai:{},interactive?(ai,key,value)=>{
      setState({...state,activity:{...state.activity,ai}});
      document.querySelector(`#current-preview [data-ai-key="${key}"][data-ai-value="${value}"]`)?.focus({preventScroll:true});
    }:null);
    window.MSVLessonTools?.wireRelation(stage,interactive?state.activity:{},interactive?(key,value)=>{setState({...state,activity:{...state.activity,[key]:value}});document.querySelector(`#current-preview [${key==='relationView'?'data-relation-view':'data-car-action'}="${value}"]`)?.focus({preventScroll:true});}:null);
    window.MSVLessonTools?.wireGameMap(stage,interactive?state.activity.mapFocus:"all",interactive?value=>setState({...state,activity:{...state.activity,mapFocus:value}}):null);
    window.MSVLessonTools?.wireWorkedExample(stage,interactive?state.activity.workedCase:'route',interactive?selected=>{
      setState({...state,activity:{...state.activity,workedCase:selected}});
      document.querySelector(`#current-preview [data-worked-case="${selected}"]`)?.focus({preventScroll:true});
    }:null);
    window.MSVLessonTools?.wireAssembly(stage,interactive?state.activity.assemblyMode:'split',interactive?mode=>setState({...state,activity:{...state.activity,assemblyMode:mode}}):null);
    window.MSVLessonTools?.wireInterfaceCases(stage,interactive?state.activity.interfaceCase:'move',interactive?selected=>{
      const parent=stage.parentElement;setState({...state,activity:{...state.activity,interfaceCase:selected}});
      parent?.querySelector(`[data-interface-case="${selected}"]`)?.focus({preventScroll:true});
    }:null);
    const inputs=[...stage.querySelectorAll('[data-blackbox-case]')],outputs=[...stage.querySelectorAll('[data-blackbox-output]')],statusNode=stage.querySelector('[data-blackbox-status]');
    if(inputs.length&&statusNode){
      const selected=interactive?state.activity.blackboxCase:-1;
      inputs.forEach((button,index)=>{
        button.setAttribute('aria-pressed',String(index===selected));
        if(interactive)button.addEventListener('click',()=>{const parent=stage.parentElement;setState({...state,activity:{...state.activity,blackboxCase:index}});parent?.querySelector(`[data-blackbox-case="${index}"]`)?.focus({preventScroll:true});});
      });
      outputs.forEach((node,index)=>{node.setAttribute('data-active',String(index===selected));if(index===selected&&node.dataset.result)node.querySelector('b').textContent=node.dataset.result;});
      if(selected>=0)statusNode.textContent=inputs[selected].dataset.feedback;
    }
    const gameFrame=stage.querySelector('[data-car-game]');
    if(gameFrame){
      if(interactive){const url=new URL('./route-game/index.html',location.href);url.searchParams.set('session',session);url.searchParams.set('role','teacher');gameFrame.src=url.href;}
      else gameFrame.parentElement.dataset.preview='true';
    }
    const tabs=[...stage.querySelectorAll('[data-tradeoff-tab]')];
    if(tabs.length){
      const selected=interactive ? state.activity.tradeoffTab : 0, play=interactive && state.activity.tradeoffPlay;
      const types=['transform','automation','voxel','game'], modes=[play?'plane':'car',play?'works':'components',play?'car:object':'car:blocks',play?'play':'split'];
      const descriptions=['已经合适的轮组可以复用，先检查接口，不必从材料重新造。','齿轮、动力和带子组成传送带；为了新任务重新组合，需要再测试。','同一辆小车：材料更多，并不等于功能更多；还要花时间塑形与检查。','蓝色移动、黄色拾取、绿色背包各有责任。一次捡道具需要合作，不必把每个按钮拆成模块。'];
      const labels=[play?'回到汽车，复用同一轮组':'换成飞机，看看轮组',play?'拆开看合作组件':'启动传送带，看组件合作',play?'拆回方块，看材料数量':'组合成车，看整体功能',play?'拆开看三项职责':'启动拾取，看模块合作'];
      const scene=stage.querySelector('[data-module-3d]');scene.setAttribute('data-module-3d',types[selected]);scene.setAttribute('data-module-3d-mode',modes[selected]);if(selected===1)scene.setAttribute('data-automation-start',String((interactive?state.activity.tradeoffStarted:0)||0));
      stage.querySelector('[data-tradeoff-description]').textContent=descriptions[selected];
      stage.querySelector('.module-3d-fallback').textContent=descriptions[selected];
      const change=(tab,active,selector)=>{const root=stage.parentElement;setState({...state,activity:{...state.activity,tradeoffTab:tab,tradeoffPlay:active,tradeoffStarted:tab<=1?Date.now():0}});root?.querySelector(selector)?.focus({preventScroll:true});};
      tabs.forEach((button,index)=>{button.setAttribute('aria-selected',String(index===selected));button.tabIndex=index===selected?0:-1;button.disabled=!interactive;
        button.addEventListener('click',()=>change(index,false,`[data-tradeoff-tab="${index}"]`));
        button.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?3:(index+(['ArrowUp','ArrowLeft'].includes(event.key)?3:1))%4;change(next,false,`[data-tradeoff-tab="${next}"]`);});
      });
      const action=stage.querySelector('[data-tradeoff-action]');action.textContent=labels[selected];action.disabled=!interactive;action.addEventListener('click',()=>change(state.activity.tradeoffTab,!state.activity.tradeoffPlay,'[data-tradeoff-action]'));
      if(selected===0)window.MSVLessonTools?.paintTradeoffTransform(stage,interactive?state.activity:{tradeoffPlay:false,tradeoffStarted:0});
    }
    const recap = stage.querySelector('[data-recap-fold]');
    if (recap) {
      const mask = interactive ? state.activity.recapOpen : 0;
      const change = (value, selector) => {
        const container = stage.parentElement;
        setState({ ...state, activity: { ...state.activity, recapOpen: value } });
        container?.querySelector(selector)?.focus({ preventScroll: true });
      };
      recap.querySelectorAll('[data-recap-toggle]').forEach(button => {
        const index = Number(button.dataset.recapToggle), open = Boolean(mask & (1 << index));
        const panel = recap.querySelector(`[data-recap-panel="${index}"]`);
        button.setAttribute('aria-expanded', String(open));
        button.querySelector('.recap-toggle-label').textContent = open ? '收起要点 ▴' : '展开要点 ▾';
        panel.hidden = !open; panel.classList.toggle('revealed', open);
        button.disabled = !interactive;
        button.addEventListener('click', () => change(mask ^ (1 << index), `[data-recap-toggle="${index}"]`));
      });
      const all = recap.querySelector('[data-recap-all]');
      all.textContent = mask === 7 ? '全部收起' : '全部展开';
      all.disabled = !interactive;
      all.addEventListener('click', () => change(mask === 7 ? 0 : 7, '[data-recap-all]'));
    }
    const transformButtons = [...stage.querySelectorAll("button[data-transform-case]")];
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

    const buildButtons = [...stage.querySelectorAll("button[data-build-step]")];
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

    const conveyorButtons = [...stage.querySelectorAll('[data-conveyor-select]')];
    if (conveyorButtons.length) {
      const selectConveyor = (value, notify) => {
        const button = conveyorButtons.find(b => b.dataset.conveyorSelect === value) || conveyorButtons[0];
        conveyorButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        stage.querySelector('[data-conveyor-focus]')?.setAttribute('data-conveyor-focus', button.dataset.conveyorSelect);
        const caption = stage.querySelector('[data-conveyor-caption]');if(caption)caption.textContent=button.dataset.caption;
        if(notify)setState({...state,activity:{...state.activity,conveyorFocus:button.dataset.conveyorSelect}});
      };
      selectConveyor(state.activity.conveyorFocus, false);
      if(interactive) conveyorButtons.forEach(b=>b.addEventListener('click',()=>selectConveyor(b.dataset.conveyorSelect,true)));
    }

    const voxelCaseButtons = [...stage.querySelectorAll("button[data-voxel-case]")];
    const voxelStepButtons = [...stage.querySelectorAll("button[data-voxel-step]")];
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
  const gamePreload = window.MSVRoutePreload?.create({container:document.getElementById('current-preview'),getSession:()=>session,role:'teacher',onStatus:text=>{
    let label=document.getElementById('route-preload-status');if(!label&&teachingResources){label=document.createElement('small');label.id='route-preload-status';label.setAttribute('role','status');teachingResources.append(label);}if(label)label.textContent=text;
  },makeStage:()=>{const index=model.slides.findIndex(s=>s.id==='module-s06'),stage=document.createElement('div');stage.className='mini-slide-stage';stage.innerHTML=slideMarkup(model.slides[index],index);return stage;}});
  function renderPreview(container, index, reveal, interactive = false) {
    if (index < 0 || index >= model.slides.length) { container.innerHTML = '<div class="preview-empty">课程结束</div>'; return; }
    const cached=interactive?gamePreload?.select(model.slides[index].id):null;
    const existing=container.querySelector('.mini-slide-stage:not([data-route-resident])');
    if(cached){if(existing){window.MSVAiLessons?.stopMedia(existing);existing.remove();}window.MSVRoutePreload.paint(cached,slideMarkup(model.slides[index],index));textEdits?.decorate(cached,index,true);const scale=Math.min(container.clientWidth/1600,container.clientHeight/900);cached.style.transform=`translate(-50%, -50%) scale(${scale})`;return;}
    if(interactive&&model.slides[index]?.id==='module-my-check'&&existing?.querySelector('[data-slide-id="module-my-check"] [data-webgl-ready="true"]')&&existing.dataset.gameSession===session){window.MSVLessonTools?.paintBagDemo(existing,state.activity.bagDemo);existing.querySelectorAll('[data-reveal]').forEach((node,i)=>node.classList.toggle('revealed',i<reveal));textEdits?.decorate(existing,index,interactive);return;}
    if(interactive&&model.slides[index]?.id==='module-minecraft-map'&&existing?.querySelector('[data-slide-id="module-minecraft-map"]')&&existing.dataset.gameSession===session){
      window.MSVLessonTools?.paintGameMap(existing,state.activity.mapFocus);textEdits?.decorate(existing,index,interactive);return;
    }
    if(interactive&&['module-s06','ai-12'].includes(model.slides[index]?.id)&&existing?.querySelector(`[data-slide-id="${model.slides[index].id}"] [data-car-game]`)&&existing.dataset.gameSession===session){
      const scale=Math.min(container.clientWidth/1600,container.clientHeight/900);existing.style.transform=`translate(-50%, -50%) scale(${scale})`;return;
    }
    if(interactive&&['module-s14','module-s12'].includes(model.slides[index]?.id)&&existing?.querySelector(`[data-slide-id="${model.slides[index].id}"]`)&&existing?.querySelector('[data-module-3d="car-modules"][data-webgl-ready="true"]')&&existing.dataset.gameSession===session){
      if(model.slides[index].id==='module-s12')(window.MSVLessonTools?.paintWorkedExample(existing,state.activity.workedCase),window.MSVLessonTools?.paintGameMap(existing,state.activity.mapFocus));else window.MSVLessonTools?.paintAssembly(existing,state.activity.assemblyMode);
      existing.querySelectorAll('[data-reveal]').forEach((node,i)=>node.classList.toggle('revealed',i<reveal));textEdits?.decorate(existing,index,interactive);
      const scale=Math.min(container.clientWidth/1600,container.clientHeight/900);existing.style.transform=`translate(-50%, -50%) scale(${scale})`;return;
    }
    if(interactive&&model.slides[index]?.id==='module-tradeoff'&&state.activity.tradeoffTab===0&&existing?.querySelector('[data-slide-id="module-tradeoff"] [data-module-3d="transform"][data-webgl-ready="true"]:not([data-scene-leaving])')&&existing.dataset.gameSession===session){
      window.MSVLessonTools?.paintTradeoffTransform(existing,state.activity);
      existing.querySelectorAll('[data-reveal]').forEach((node,i)=>node.classList.toggle('revealed',i<reveal));textEdits?.decorate(existing,index,interactive);
      const scale=Math.min(container.clientWidth/1600,container.clientHeight/900);existing.style.transform=`translate(-50%, -50%) scale(${scale})`;return;
    }
    const retainedScenes=window.MSVLessonTools?.takeScenes(container,model.slides[index].id)||[];
    const stage = document.createElement("div"); stage.className = "mini-slide-stage";stage.dataset.gameSession=session;
    if(existing)window.MSVAiLessons?.stopMedia(existing);
    stage.innerHTML = slideMarkup(model.slides[index], index);
    stage.querySelectorAll("[data-reveal]").forEach((node, i) => node.classList.toggle("revealed", i < reveal));
    wirePreviewInteractions(stage, interactive);
    textEdits?.decorate(stage,index,interactive);
    window.MSVLessonTools?.restoreScenes(stage,retainedScenes);
    if(interactive){existing?.remove();container.append(stage);}else container.replaceChildren(stage);
    window.MSVLessonTools?.wireResources(stage);
    if (stage.querySelector("[data-module-3d]")) import("./module-3d.js")
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
      button.querySelector(".name").textContent = textEdits?.title(index) ?? model.slides[index].title;
      button.classList.toggle("active", index === state.slide);
      if (index === state.slide) button.scrollIntoView({ block: "nearest" });
    });
  }
  function render() {
    const slide = model.slides[state.slide];
    renderPreview(document.getElementById("current-preview"), state.slide, state.reveal, true);
    renderPreview(document.getElementById("next-preview"), state.slide + 1, 0);
    document.getElementById("current-title").textContent = `${slide.source} · ${textEdits?.title(state.slide) ?? slide.title} · 揭示 ${state.reveal}/${maxReveal(state.slide)}`;
    document.getElementById("next-title").textContent = textEdits?.title(state.slide + 1) ?? model.slides[state.slide + 1]?.title ?? "课程结束";
    document.getElementById("rail-progress").textContent = `${String(state.slide + 1).padStart(2,"0")} / ${model.slides.length}`;
    renderList(); renderNotes(slide);
    window.MSVLessonTools?.update(state.slide);
  }
  function audienceUrl() {
    const raw = document.documentElement.dataset.audienceUrl || "./index.html";
    const url = new URL(raw, location.href); url.searchParams.set("session", session); url.searchParams.set("controlled", "1"); return url.href;
  }
  function openAudience() {
    audienceWindow = window.open(audienceUrl(), `msv-${model.id}-audience-${session}`, "popup=yes,width=1280,height=720,resizable=yes");
    if (!audienceWindow) {
      const button = document.getElementById("open-audience");
      button.textContent = "弹窗被拦截，请再次点击"; button.classList.remove("primary");
      return;
    }
    document.getElementById("open-audience").textContent = "重新聚焦投屏";
    setTimeout(() => send("ping", {}), 350);
  }
  function newSession() {
    session = createSession(); state = normalize(null); lastAudienceSignal = 0; textEdits?.startSession();
    setUrl(); connectChannel(); persist(); render(); updateConnection();
    document.getElementById("open-audience").textContent = "打开投屏窗口";
  }

  setUrl(); connectChannel(); render(); updateConnection(); gamePreload?.schedule();
  addEventListener("resize", render);
  addEventListener("storage", event => { if (event.key === eventKey() && event.newValue) try { acceptMessage(JSON.parse(event.newValue)); } catch { /* ignore malformed external storage events */ } });
  addEventListener("keydown", event => {
    if (event.target instanceof Element) {
      if (event.target.closest("input,textarea,select,[contenteditable=true]")) return;
      if ([" ","Enter"].includes(event.key) && event.target.closest("button,a,summary")) return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
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
  document.getElementById("reset-reveal").addEventListener("click", () => setState({ ...state, reveal: 0, activity: { ...state.activity, recapOpen: 0 } }));
  setInterval(() => { send("ping", {}); updateConnection(); }, 2500);
  window.MSVModulePresenterController = Object.freeze({ getState: () => ({...state}), setState, openAudience, getSession: () => session });
})();
