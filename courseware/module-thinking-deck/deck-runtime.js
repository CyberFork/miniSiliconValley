(function () {
  "use strict";

  const model = window.MSV_MODULE_DECK;
  if (!model) throw new Error("MSV_MODULE_DECK 未加载");

  const params = new URLSearchParams(location.search);
  const session = sanitizeSession(params.get("session")) || "direct";
  const controlled = params.get("controlled") === "1";
  const storageKey = `msv:${model.id}:${model.version}:${session}`;
  const channelName = `msv:${model.id}:${model.version}:${session}`;
  const normalDeck = document.getElementById("deck");
  let deck = normalDeck;
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

  function initialState() {
    const rawId = params.get("slideId");
    const id = model.slideAliases?.[rawId] || rawId;
    if (id && model.slides.some(slide => slide.id === id)) return normalize({slideId:id, reveal:params.get("step")});
    if (params.has("slide")) {
      const index = Number(params.get("slide"));
      const oldId = model.legacySlideIds?.[index];
      return normalize(oldId ? {slideId:oldId,reveal:params.get("step")} : {slide:index,reveal:params.get("step")});
    }
    try { const saved=JSON.parse(localStorage.getItem(storageKey) || "null"); return normalize(saved?.slideId ? {...saved,slide:undefined} : saved); }
    catch { return normalize(null); }
  }

  function selectBagDemo(action){
    const prior=state.activity.bagDemo;
    const value=action==='close'?{...prior,open:false}:{open:true,mode:action==='open'?'wrong':['wrong','correct'].includes(action)?action:prior.mode,startedAt:Date.now()};
    setState({...state,activity:{...state.activity,bagDemo:value}},true);
    const selector=action==='close'?'[data-bag-demo-action="open"]':`[data-bag-demo-action="${action==='open'?'wrong':action}"]`;
    deck?.querySelector(selector)?.focus({preventScroll:true});
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* private mode can deny storage */ }
  }

  function send(type, payload) {
    const message = { type, session, source: "audience", ...payload };
    if (channel) channel.postMessage(message);
    else try { localStorage.setItem(`${storageKey}:event`, JSON.stringify({ ...message, nonce: Math.random(), at: Date.now() })); } catch { /* no cross-window transport is available */ }
  }

  function slideMarkup(slide,index) {
    return `
      <section class="deck-slide" data-slide-id="${slide.id}" data-source="${slide.source}" data-theme="${slide.theme || "paper"}">
        <header class="slide-topline">
          <span class="slide-code">${slide.source} · ${slide.phase || slide.section}</span>
          <img class="slide-brand" src="assets/mini-silicon-valley-logo-transparent.png" alt="MINI硅谷">
        </header>
        <div class="slide-heading"><h1>${slide.title}</h1><p>${slide.subtitle}</p></div>
        <div class="slide-body">${slide.content}</div>
        <div class="slide-footer">${model.footer || model.title}</div>
        <div class="slide-page">${String(index + 1).padStart(2, "0")} / ${String(model.slides.length).padStart(2, "0")}</div>
        <div class="slide-progress" aria-hidden="true"><i style="width:${((index + 1) / model.slides.length) * 100}%"></i></div>
      </section>`;
  }
  const gamePreload = window.MSVRoutePreload?.create({container:normalDeck.parentElement,getSession:()=>session,role:controlled?'audience':'teacher',makeStage:()=>{
    const index=model.slides.findIndex(s=>s.id==='module-s06'),stage=document.createElement('div');stage.className='deck-stage';stage.innerHTML=slideMarkup(model.slides[index],index);return stage;
  }});
  function render() {
    const version = ++renderVersion;
    const slide = model.slides[state.slide];
    const cached=gamePreload?.select(slide.id);
    if(cached){window.MSVAiLessons?.stopMedia(normalDeck);normalDeck.replaceChildren();normalDeck.hidden=true;deck=cached;window.MSVRoutePreload.paint(cached,slideMarkup(slide,state.slide));textEdits?.decorate(deck,state.slide);fit();window.MSVLessonTools?.update(state.slide);document.title=`${slide.source} ${slide.title}｜${model.title}`;status.textContent=`AUDIENCE · ${controlled?'PRESENTER':'LOCAL'} · ${session}`;return;}
    normalDeck.hidden=false;deck=normalDeck;
    if(slide.id==='module-my-check'&&deck.querySelector('[data-slide-id="module-my-check"] [data-webgl-ready="true"]')){window.MSVLessonTools?.paintBagDemo(deck,state.activity.bagDemo);deck.querySelectorAll('[data-reveal]').forEach((node,i)=>node.classList.toggle('revealed',i<state.reveal));textEdits?.decorate(deck,state.slide);fit();return;}
    if(slide.id==='module-minecraft-map'&&deck.querySelector('[data-slide-id="module-minecraft-map"]')){
      window.MSVLessonTools?.paintGameMap(deck,state.activity.mapFocus);textEdits?.decorate(deck,state.slide);fit();return;
    }
    if(['module-s06','ai-12'].includes(slide.id)&&deck.querySelector(`[data-slide-id="${slide.id}"] [data-car-game]`)){fit();return;}
    if(['module-s14','module-s12'].includes(slide.id)&&deck.querySelector(`[data-slide-id="${slide.id}"]`)&&deck.querySelector('[data-module-3d="car-modules"][data-webgl-ready="true"]')){
      if(slide.id==='module-s12'){window.MSVLessonTools?.paintWorkedExample(deck,state.activity.workedCase);window.MSVLessonTools?.paintGameMap(deck,state.activity.mapFocus);}else window.MSVLessonTools?.paintAssembly(deck,state.activity.assemblyMode);deck.querySelectorAll('[data-reveal]').forEach((node,i)=>node.classList.toggle('revealed',i<state.reveal));textEdits?.decorate(deck,state.slide);fit();return;
    }
    if(slide.id==='module-tradeoff'&&state.activity.tradeoffTab===0&&deck.querySelector('[data-slide-id="module-tradeoff"] [data-module-3d="transform"][data-webgl-ready="true"]:not([data-scene-leaving])')){
      window.MSVLessonTools?.paintTradeoffTransform(deck,state.activity);deck.querySelectorAll('[data-reveal]').forEach((node,i)=>node.classList.toggle('revealed',i<state.reveal));textEdits?.decorate(deck,state.slide);fit();return;
    }
    const retainedScenes=window.MSVLessonTools?.takeScenes(deck,slide.id)||[];
    window.MSVAiLessons?.stopMedia(deck);
    deck.innerHTML = slideMarkup(slide,state.slide);
    deck.querySelectorAll("[data-reveal]").forEach((node, index) => node.classList.toggle("revealed", index < state.reveal));
    wireSlideInteractions();
    window.MSVLessonTools?.restoreScenes(deck,retainedScenes);
    textEdits?.decorate(deck,state.slide);
    window.MSVLessonTools?.wireResources(deck);
    window.MSVLessonTools?.update(state.slide);
    document.title = `${slide.source} ${slide.title}｜${model.title}`;
    status.textContent = `AUDIENCE · ${controlled ? "PRESENTER" : "LOCAL"} · ${session}`;
    fit();
    mountThreeScenes(version);
  }

  function wireSlideInteractions() {
    window.MSVLessonTools?.wireBagDemo(deck,state.activity.bagDemo,selectBagDemo);
    // controlled means synchronized with the presenter, not read-only.
    window.MSVAiLessons?.wire(deck,state.activity.ai,(ai,key,value)=>{
      setState({...state,activity:{...state.activity,ai}},true);
      deck.querySelector(`[data-ai-key="${key}"][data-ai-value="${value}"]`)?.focus({preventScroll:true});
    });
    window.MSVLessonTools?.wireRelation(deck,state.activity,(key,value)=>{setState({...state,activity:{...state.activity,[key]:value}},true);deck.querySelector(`[${key==='relationView'?'data-relation-view':'data-car-action'}="${value}"]`)?.focus({preventScroll:true});});
    window.MSVLessonTools?.wireGameMap(deck,state.activity.mapFocus,value=>{setState({...state,activity:{...state.activity,mapFocus:value}},true);});
    window.MSVLessonTools?.wireWorkedExample(deck,state.activity.workedCase,selected=>{
      setState({...state,activity:{...state.activity,workedCase:selected}},true);
      deck.querySelector(`[data-worked-case="${selected}"]`)?.focus({preventScroll:true});
    });
    window.MSVLessonTools?.wireAssembly(deck,state.activity.assemblyMode,mode=>setState({...state,activity:{...state.activity,assemblyMode:mode}},true));
    window.MSVLessonTools?.wireInterfaceCases(deck,state.activity.interfaceCase,selected=>{
      setState({...state,activity:{...state.activity,interfaceCase:selected}},true);
      deck.querySelector(`[data-interface-case="${selected}"]`)?.focus({preventScroll:true});
    });
    const gameFrame=deck.querySelector('[data-car-game]');
    if(gameFrame){const url=new URL('./route-game/index.html',location.href);url.searchParams.set('session',session);url.searchParams.set('role',controlled?'audience':'teacher');gameFrame.src=url.href;}
    const tabs=[...deck.querySelectorAll('[data-tradeoff-tab]')];
    if(tabs.length){
      const selected=state.activity.tradeoffTab, play=state.activity.tradeoffPlay;
      const types=['transform','automation','voxel','game'], modes=[play?'plane':'car',play?'works':'components',play?'car:object':'car:blocks',play?'play':'split'];
      const descriptions=['已经合适的轮组可以复用，先检查接口，不必从材料重新造。','齿轮、动力和带子组成传送带；为了新任务重新组合，需要再测试。','同一辆小车：材料更多，并不等于功能更多；还要花时间塑形与检查。','蓝色移动、黄色拾取、绿色背包各有责任。一次捡道具需要合作，不必把每个按钮拆成模块。'];
      const labels=[play?'回到汽车，复用同一轮组':'换成飞机，看看轮组',play?'拆开看合作组件':'启动传送带，看组件合作',play?'拆回方块，看材料数量':'组合成车，看整体功能',play?'拆开看三项职责':'启动拾取，看模块合作'];
      const scene=deck.querySelector('[data-module-3d]');scene.setAttribute('data-module-3d',types[selected]);scene.setAttribute('data-module-3d-mode',modes[selected]);if(selected===1)scene.setAttribute('data-automation-start',String(state.activity.tradeoffStarted||0));
      deck.querySelector('[data-tradeoff-description]').textContent=descriptions[selected];
      deck.querySelector('.module-3d-fallback').textContent=descriptions[selected];
      const change=(tab,active,selector)=>{const root=deck;setState({...state,activity:{...state.activity,tradeoffTab:tab,tradeoffPlay:active,tradeoffStarted:tab<=1?Date.now():0}}, true);root?.querySelector(selector)?.focus({preventScroll:true});};
      tabs.forEach((button,index)=>{button.setAttribute('aria-selected',String(index===selected));button.tabIndex=index===selected?0:-1;
        button.addEventListener('click',()=>change(index,false,`[data-tradeoff-tab="${index}"]`));
        button.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?3:(index+(['ArrowUp','ArrowLeft'].includes(event.key)?3:1))%4;change(next,false,`[data-tradeoff-tab="${next}"]`);});
      });
      const action=deck.querySelector('[data-tradeoff-action]');action.textContent=labels[selected];action.addEventListener('click',()=>change(state.activity.tradeoffTab,!state.activity.tradeoffPlay,'[data-tradeoff-action]'));
      if(selected===0)window.MSVLessonTools?.paintTradeoffTransform(deck,state.activity);
    }
    const recap = deck.querySelector('[data-recap-fold]');
    if (recap) {
      const mask = state.activity.recapOpen;
      const change = (value, selector) => {
        setState({ ...state, activity: { ...state.activity, recapOpen: value } }, true);
        deck.querySelector(selector)?.focus({ preventScroll: true });
      };
      recap.querySelectorAll('[data-recap-toggle]').forEach(button => {
        const index = Number(button.dataset.recapToggle), open = Boolean(mask & (1 << index));
        const panel = recap.querySelector(`[data-recap-panel="${index}"]`);
        button.setAttribute('aria-expanded', String(open));
        button.querySelector('.recap-toggle-label').textContent = open ? '收起要点 ▴' : '展开要点 ▾';
        panel.hidden = !open; panel.classList.toggle('revealed', open);

        button.addEventListener('click', () => change(mask ^ (1 << index), `[data-recap-toggle="${index}"]`));
      });
      const all = recap.querySelector('[data-recap-all]');
      all.textContent = mask === 7 ? '全部收起' : '全部展开';

      all.addEventListener('click', () => change(mask === 7 ? 0 : 7, '[data-recap-all]'));
    }
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

    const conveyorButtons = [...deck.querySelectorAll('[data-conveyor-select]')];
    if (conveyorButtons.length) {
      const selectConveyor = (value, notify) => {
        const button = conveyorButtons.find(b => b.dataset.conveyorSelect === value) || conveyorButtons[0];
        conveyorButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        deck.querySelector('[data-conveyor-focus]')?.setAttribute('data-conveyor-focus', button.dataset.conveyorSelect);
        const caption = deck.querySelector('[data-conveyor-caption]');if(caption)caption.textContent=button.dataset.caption;
        if(notify)setState({...state,activity:{...state.activity,conveyorFocus:button.dataset.conveyorSelect}}, true);
      };
      selectConveyor(state.activity.conveyorFocus, false);
      conveyorButtons.forEach(b=>b.addEventListener('click',()=>selectConveyor(b.dataset.conveyorSelect,true)));
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
    const selected=state.activity.blackboxCase;
    inputs.forEach((input,index)=>{
      input.setAttribute('aria-pressed',String(index===selected));
      input.addEventListener('click',()=>{setState({...state,activity:{...state.activity,blackboxCase:index}},true);deck.querySelector(`[data-blackbox-case="${index}"]`)?.focus({preventScroll:true});});
    });
    outputs.forEach((node,index)=>{node.setAttribute('data-active',String(index===selected));if(index===selected&&node.dataset.result)node.querySelector('b').textContent=node.dataset.result;});
    if(selected>=0)statusNode.textContent=inputs[selected].dataset.feedback;

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
    if (state.reveal < limit) setState(revealState(1), true);
    else if (state.slide < model.slides.length - 1) setState({ slide: state.slide + 1, reveal: 0 }, true);
  }

  function back() {
    if (state.reveal > 0) setState(revealState(-1), true);
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
  gamePreload?.schedule();
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
