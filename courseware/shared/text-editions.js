(function () {
  "use strict";
  const ELIGIBLE = "h2,h3,h4,p,li,td,th,dt,dd,b,strong,em,span,small,div,figcaption,label";
  // Dynamic demo labels and controls remain owned by the existing interactions.
  const EXCLUDED = "button,a,input,textarea,select,svg,canvas,[data-module-3d],[data-transform-role],[data-transform-feedback],[data-build-feedback],[data-voxel-feedback],[data-voxel-material]";
  window.MSVTextEditions = { create({ model, teacher, getSession, rerender }) {
    let edition = {revision: 0, patches: {}}, latest = 0, loaded = false, editing = false, channel = null, generation = 0, loading = false;
    let preview = null, toolbar, status, toggle, reload, history;
    const endpoint = `/api/courseware/text-editions/${encodeURIComponent(model.id)}`;
    const storageKey = () => `msv:text:${model.id}:${model.version}:${getSession()}`;
    const channelKey = () => `${storageKey()}:channel`;
    const eventKey = () => `${storageKey()}:event`;
    const text = (tag, value) => { const el=document.createElement(tag); el.textContent=value; return el; };
    function send() {
      const message={revision:edition.revision, session:getSession(), base:model.version};
      if(channel)channel.postMessage(message);
      else try {localStorage.setItem(eventKey(),JSON.stringify({...message,nonce:Math.random()}));}catch{/* optional transport */}
    }
    async function request(query, body) {
      const response=await fetch(endpoint+query,{credentials:"same-origin",cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
      let result;try{result=await response.json();}catch{throw new Error("暂时无法连接服务器。原课件仍可查看，请联网后重试。");}
      if(!response.ok || !result.ok)throw new Error(result.error?.message || "保存未成功，请保留文字后重试。");
      return result.data;
    }
    function drawStatus(message) {
      if(status)status.textContent=message || `文字版 v${edition.revision}${edition.revision===0?"（原文）":""}${edition.revision<latest?` · 当前为历史版，最新 v${latest}`:" · 已保存到服务器"}`;
      if(toggle){toggle.disabled=!loaded || loading || edition.revision!==latest;toggle.textContent=editing?"结束文字编辑":"编辑课件文字";toggle.setAttribute("aria-pressed",String(editing));}
    }
    function historyOptions(data) {
      if(!history)return;
      history.replaceChildren();
      for(const item of [...data.history,{revision:0}]){
        const option=text("option",`文字版 v${item.revision}${item.revision===data.latestRevision?" · 最新":""}${item.revision===0?" · 原文":""}`);
        option.value=String(item.revision);history.append(option);
      }
      // A requested old version can be older than the 100-item history window.
      if(![...history.options].some(o=>Number(o.value)===data.edition.revision)){const option=text("option",`文字版 v${data.edition.revision}`);option.value=String(data.edition.revision);history.append(option);}
      history.value=String(data.edition.revision);
    }
    function apply(data, notify) {
      edition=data.edition;latest=data.latestRevision;loaded=true;preview=null;editing=false;
      try{localStorage.setItem(storageKey(),String(edition.revision));}catch{/* server remains source of truth */}
      historyOptions(data);drawStatus();rerender();if(notify)send();
    }
    async function load(revision, notify=false) {
      const token=++generation;loading=true;drawStatus("正在读取服务器文字版本…");
      try{
        const data=await request(`?base=${encodeURIComponent(model.version)}${revision===undefined?"":`&revision=${revision}`}`);
        if(token!==generation)return;
        loading=false;apply(data,notify);
      }catch(error){if(token!==generation)return;loading=false;drawStatus(error.message);}
    }
    function accept(message) {
      if(teacher || !message || message.session!==getSession() || message.base!==model.version || !Number.isSafeInteger(message.revision) || message.revision<0)return;
      if(!loaded || edition.revision!==message.revision)load(message.revision);
    }
    function startSession() {
      generation++;channel?.close();channel=null;loaded=false;editing=false;preview=null;
      try{channel=new BroadcastChannel(channelKey());channel.onmessage=e=>accept(e.data);}catch{/* storage fallback */}
      let pin;try{const value=localStorage.getItem(storageKey());if(value!==null && /^\d+$/.test(value))pin=Number(value);}catch{/* fresh session */}
      load(pin,teacher);
    }
    function openField(key, element) {
      if(!editing || !loaded || loading)return;
      const original=element.dataset.msvOriginal;
      const saved=Object.hasOwn(edition.patches,key)?edition.patches[key]:original;
      window.MSVTextEditorDialog.open({label:`${model.slides.find(s=>key.startsWith(s.id+":"))?.source || "本页"} · ${key.endsWith(":title")?"标题":key.endsWith(":subtitle")?"副标题":"正文"}`,value:saved,originalValue:original,
        onPreview(value){preview={key,value};rerender();drawStatus("本地预览，尚未保存；投屏和其他人不会看到预览修改。");},
        onClose(){preview=null;rerender();drawStatus();},
        async onSave(value){
          const data=await request("",{base:model.version,expectedRevision:edition.revision,key,value:value===original?null:value});
          apply(data,true);
        }
      });
    }
    function field(node,key,interactive) {
      node.dataset.msvTextKey=key;node.dataset.msvOriginal=node.textContent;
      if(Object.hasOwn(edition.patches,key)){node.textContent=edition.patches[key];node.style.whiteSpace="pre-wrap";}
      if(teacher && preview?.key===key)node.textContent=preview.value;
      if(teacher && editing && interactive){
        node.tabIndex=0;node.setAttribute("role","button");node.setAttribute("aria-label",`编辑：${node.textContent.slice(0,60) || "空文字"}`);
        node.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openField(key,node);});
        node.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();openField(key,node);}});
      }
    }
    function decorate(root,index,interactive=false) {
      const slide=model.slides[index];if(!slide)return;
      root.classList.toggle("msv-text-edit-mode",teacher&&editing&&interactive);
      const heading=root.querySelector(".slide-heading h1"), subtitle=root.querySelector(".slide-heading p"), body=root.querySelector(".slide-body");
      if(heading)field(heading,`${slide.id}:title`,interactive);
      if(subtitle)field(subtitle,`${slide.id}:subtitle`,interactive);
      if(!body)return;
      for(const node of body.querySelectorAll(ELIGIBLE)){
        if(node.childElementCount || !node.textContent.trim() || node.closest(EXCLUDED))continue;
        const path=[];let current=node;
        while(current!==body){path.unshift([...current.parentElement.children].indexOf(current));current=current.parentElement;}
        field(node,`${slide.id}:body.${path.join(".")}`,interactive);
      }
    }
    function title(index){const slide=model.slides[index];return slide?(edition.patches[`${slide.id}:title`]??slide.title):"课程结束";}
    if(teacher){
      toolbar=document.createElement("div");toolbar.className="msv-text-edit-toolbar";
      toggle=text("button","编辑课件文字");toggle.type="button";toggle.disabled=true;
      reload=text("button","加载最新文字版");reload.type="button";
      history=document.createElement("select");history.setAttribute("aria-label","文字版本历史");
      status=text("span","正在加载文字版本…");status.className="msv-text-edit-status";status.setAttribute("role","status");
      toolbar.append(toggle,reload,history,status);document.querySelector(".preview-label").before(toolbar);
      toggle.addEventListener("click",()=>{editing=!editing;drawStatus();rerender();});
      reload.addEventListener("click",()=>load(undefined,true));history.addEventListener("change",()=>load(Number(history.value),true));
    }else{
      status=text("span","");status.className="msv-text-edition-audience-status";document.body.append(status);
    }
    addEventListener("storage",event=>{if(event.key===eventKey()&&event.newValue)try{accept(JSON.parse(event.newValue));}catch{/* malformed message */}});
    setTimeout(startSession,0);
    return {decorate,title,startSession,send,getRevision:()=>edition.revision};
  }};
})();
