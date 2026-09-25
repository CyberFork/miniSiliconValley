(function () {
  "use strict";
  const ELIGIBLE = "h2,h3,h4,p,li,td,th,dt,dd,b,strong,em,span,small,div,figcaption,label";
  // Dynamic demo labels and controls remain owned by the existing interactions.
  const EXCLUDED = "button,a,input,textarea,select,svg,canvas,[data-module-3d],[data-transform-role],[data-transform-feedback],[data-build-feedback],[data-voxel-feedback],[data-voxel-material],[data-voxel-object-name],[data-conveyor-caption],[data-assembly-feedback],[data-relation-caption],[data-tradeoff-description],[data-blackbox-status],[data-blackbox-output]";
  window.MSVTextEditions = { create({ model, teacher, getSession, rerender }) {
    let edition = {revision: 0, patches: {}}, latest = 0, loaded = false, editing = false, channel = null, generation = 0, loading = false;
    let preview = null, toolbar, status, toggle, reload, history, conflictPanel;
    let conflicts = [];
    let editPreference = teacher, storage = "server";
    const fields = new WeakMap();
    const endpoint = `/api/courseware/text-editions/${encodeURIComponent(model.id)}`;
    const storageKey = () => `msv:text:${model.id}:${model.textSchema || model.version}:${getSession()}`;
    const channelKey = () => `${storageKey()}:channel`;
    const eventKey = () => `${storageKey()}:event`;
    const text = (tag, value) => { const el=document.createElement(tag); el.textContent=value; return el; };
    function send() {
      const message={revision:edition.revision, session:getSession(), base:model.version};
      if(channel)channel.postMessage(message);
      else try {localStorage.setItem(eventKey(),JSON.stringify({...message,nonce:Math.random()}));}catch{/* optional transport */}
    }
    async function request(query, body) {
      let response;try{response=await fetch(endpoint+query,{credentials:"same-origin",cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{} )});}catch{throw new Error("连接文字编辑服务失败。请确认预览服务仍在运行，然后点击加载最新文字版重试；当前课件仍可查看。");}
      let result;try{result=await response.json();}catch{throw new Error(response.status===404?"当前服务器未提供文字编辑接口。请启动支持编辑的本地预览服务后重试。":"文字编辑接口返回异常，当前课件仍可查看，请稍后重试。");}
      if(!response.ok || !result.ok)throw new Error(result.error?.message || "保存未成功，请保留文字后重试。");
      return result.data;
    }
    function drawStatus(message) {
      if(status)status.textContent=message || `${storage==='local-preview'?'本地预览 · ':''}文字版 v${edition.revision}${edition.revision===0?'（原文）':''} · ${edition.revision<latest?'历史版本只读，请加载最新文字版':storage==='local-preview'?'保存到本机，未发布到线上':'已保存到服务器'}${teacher&&editing?' · 直接点击标题或正文编辑':''}${teacher&&conflicts.length?' · '+conflicts.length+' 处跨版本修改待确认':''}`;
      if(toggle){toggle.disabled=!loaded || loading || edition.revision!==latest;toggle.textContent=editing?'暂停文字编辑':'编辑课件文字';toggle.setAttribute('aria-pressed',String(editing));}

    }
    function drawConflicts() {
      if(!conflictPanel)return;
      conflictPanel.replaceChildren();conflictPanel.hidden=!conflicts.length;
      if(!conflicts.length)return;
      conflictPanel.append(text('summary',`${conflicts.length} 处修改需要确认（内容没有丢失）`));
      for(const conflict of conflicts){
        const item=text('div','');item.className='msv-text-conflict';
        item.append(text('p',`${conflict.key} · ${conflict.reason}`),text('p',`你的修改：${conflict.value}`));
        const copy=text('button','复制这处修改');copy.type='button';
        copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(conflict.value);copy.textContent='已复制';}catch{drawStatus('复制失败，请选中上方文字手动复制。');}});item.append(copy);
        if(conflict.current!==null){
          item.append(text('p',`新版原文：${conflict.current}`));
          const keep=text('button','核对并沿用修改');keep.type='button';keep.disabled=edition.revision!==latest;
          keep.addEventListener('click',()=>window.MSVTextEditorDialog.open({label:'跨版本文字核对',value:conflict.value,originalValue:conflict.current,onPreview(){},onClose(){},async onSave(value){apply(await request('',{base:model.version,expectedRevision:edition.revision,key:conflict.key,value:value===conflict.current?null:value}),true);}}));item.append(keep);
        }
        const discard=text('button',conflict.current===null?'不再沿用（历史仍保留）':'采用新版原文');discard.type='button';discard.disabled=edition.revision!==latest;
        discard.addEventListener('click',async()=>{if(!confirm('确认不再沿用这处修改？历史文字版仍可查看。'))return;try{apply(await request('',{base:model.version,expectedRevision:edition.revision,key:conflict.key,value:null}),true);}catch(error){drawStatus(error.message);}});item.append(discard);conflictPanel.append(item);
      }
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
      conflicts=data.conflicts||[];
      edition=data.edition;latest=data.latestRevision;loaded=true;preview=null;storage=data.storage||'server';editing=teacher&&editPreference&&edition.revision===latest;
      try{localStorage.setItem(storageKey(),String(edition.revision));}catch{/* server remains source of truth */}
      historyOptions(data);drawConflicts();drawStatus();rerender();if(notify)send();
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
      load(teacher ? undefined : pin,teacher);
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
      let entry=fields.get(node);
      if(!entry){
        entry={key,original:node.textContent,role:node.getAttribute('role'),tabindex:node.getAttribute('tabindex'),interactive};fields.set(node,entry);
        // One listener per node. Retained 3D scenes decorate again on each state update.
        const activate=event=>{if(!teacher||!editing||!loaded||loading||!entry.interactive)return;event.preventDefault();event.stopPropagation();openField(entry.key,node);};
        node.addEventListener('click',activate);
        node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')activate(event);});
      }
      // A dynamic output node can survive a state transition. Keep its listener,
      // but switch both field identity and original; never leak an approved edit into another state.
      if(entry.key!==key){entry.key=key;entry.original=node.textContent;}
      entry.interactive=interactive;
      node.dataset.msvTextKey=key;node.dataset.msvOriginal=entry.original;
      node.textContent=Object.hasOwn(edition.patches,key)?edition.patches[key]:entry.original;
      if(teacher && preview?.key===key)node.textContent=preview.value;
      if(Object.hasOwn(edition.patches,key)||preview?.key===key)node.style.whiteSpace='pre-wrap';
      if(teacher && editing && interactive && loaded){
        node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',`编辑：${node.textContent.slice(0,60) || '空文字'}`);
      }else{
        for(const [attr,value] of [['role',entry.role],['tabindex',entry.tabindex]]){if(value===null)node.removeAttribute(attr);else node.setAttribute(attr,value);}
        node.removeAttribute('aria-label');
      }
    }

    function decorate(root,index,interactive=false) {
      const slide=model.slides[index];if(!slide)return;
      root.classList.toggle("msv-text-edit-mode",teacher&&editing&&interactive);
      const heading=root.querySelector(".slide-heading h1"), subtitle=root.querySelector(".slide-heading p"), body=root.querySelector(".slide-body");
      if(heading)field(heading,`${slide.id}:title`,interactive);
      if(subtitle)field(subtitle,`${slide.id}:subtitle`,interactive);
      if(!body)return;
      for(const node of body.querySelectorAll('[data-msv-runtime-field]')){
        if(!node.childElementCount && !node.closest(EXCLUDED) && /^runtime\.change\.(original|proposed|synced|approved|warning)$/.test(node.dataset.msvRuntimeField))
          field(node,`${slide.id}:${node.dataset.msvRuntimeField}`,interactive);
      }
      for(const node of body.querySelectorAll(ELIGIBLE)){
        if(node.childElementCount || (!node.textContent.trim() && !node.dataset.msvTextKey) || node.closest(EXCLUDED))continue;
        const path=[];let current=node;
        while(current!==body){path.unshift([...current.parentElement.children].indexOf(current));current=current.parentElement;}
        const stable=node.dataset.msvField;
        if(model.textSchema && !stable)continue;
        field(node,stable?`${slide.id}:text.${stable}`:`${slide.id}:body.${path.join(".")}`,interactive);
      }
    }
    function title(index){const slide=model.slides[index];return slide?(edition.patches[`${slide.id}:title`]??slide.title):"课程结束";}
    if(teacher){
      toolbar=document.createElement("div");toolbar.className="msv-text-edit-toolbar";
      toggle=text("button","编辑课件文字");toggle.type="button";toggle.disabled=true;
      reload=text("button","加载最新文字版");reload.type="button";
      history=document.createElement("select");history.setAttribute("aria-label","文字版本历史");
      status=text("span","正在加载文字版本…");status.className="msv-text-edit-status";status.setAttribute("role","status");
      toolbar.append(toggle,reload,history,status);conflictPanel=document.createElement("details");conflictPanel.className="msv-text-conflicts";conflictPanel.hidden=true;toolbar.append(conflictPanel);document.querySelector(".preview-label").before(toolbar);
      toggle.addEventListener("click",()=>{editPreference=!editing;editing=editPreference;drawStatus();rerender();});
      reload.addEventListener("click",()=>load(undefined,true));history.addEventListener("change",()=>load(Number(history.value),true));
    }else{
      status=text("span","");status.className="msv-text-edition-audience-status";document.body.append(status);
    }
    addEventListener("storage",event=>{if(event.key===eventKey()&&event.newValue)try{accept(JSON.parse(event.newValue));}catch{/* malformed message */}});
    setTimeout(startSession,0);
    return {decorate,title,startSession,send,getRevision:()=>edition.revision};
  }};
})();
