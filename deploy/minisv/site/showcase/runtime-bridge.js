/* Opaque-origin runtime adapter; only game-owned save values cross to the host. */
(() => {
  'use strict';
  let values = Object.create(null);
  // Wait for the host's explicit seed before ANY student script initializes storage.
  let resolveReady;
  window.MSV_SHOWCASE_READY = new Promise(resolve => { resolveReady = resolve; });
  let initialized = false;
  const token = Math.random().toString(36).slice(2) + Date.now();
  function initialize(seed) {
    if (initialized) return;
    initialized = true;
    for (const [key,value] of Object.entries(seed || {})) if (typeof value === 'string') values[key]=value;
    resolveReady();
  }
  window.addEventListener('message', event => {
    const data=event.data;
    if (event.source !== parent || !data || data.type !== 'minisv-showcase-seed' || data.token !== token) return;
    initialize(data.values);
  });
  if (parent !== window) {
    parent.postMessage({type:'minisv-showcase-ready',token}, '*');
    setTimeout(()=>initialize({}),5000);
  } else initialize({});
  document.addEventListener('DOMContentLoaded', async () => {
    await window.MSV_SHOWCASE_READY;
    try {
      for (const pending of document.querySelectorAll('script[type="application/x-minisv-student"]')) {
        const script=document.createElement('script');
        if (pending.dataset.src) {
          script.src=pending.dataset.src;
          await new Promise((resolve,reject)=> { script.onload=resolve;script.onerror=reject;document.body.append(script); });
        } else { script.textContent=pending.textContent;document.body.append(script); }
      }
      if(parent!==window) parent.postMessage({type:'minisv-showcase-running'},'*');
    } catch (_) {
      const error=document.createElement('p');error.textContent='游戏文件加载失败，请点击外层的重新加载。';error.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;background:#fff1c0;color:#183148;padding:20px';document.body.append(error);
    }
  });
  window.MSV_SHOWCASE_STORAGE = Object.freeze({
    getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    removeItem(key) {
      delete values[key];
      if (parent !== window) parent.postMessage({type:'minisv-showcase-remove',key}, '*');
    },
    setItem(key, value) {
      value = String(value); if (value.length > 200000) return;
      values[key] = value;
      if (parent !== window) parent.postMessage({type: 'minisv-showcase-save', key, value}, '*');
    }
  });
  window.MSV_SHOWCASE_RELOAD = () => {
    if (parent !== window) parent.postMessage({type: 'minisv-showcase-reload'}, '*');
    else location.reload();
  };
  // Native prompt/confirm are unavailable in an origin-isolated iframe.
  function ask(message, value, confirmOnly) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      Object.assign(dialog.style, {maxWidth:'min(90vw, 520px)',width:'90%',padding:'24px',background:'#fff9e9',color:'#172d40',border:'3px solid #172d40',borderRadius:'8px',zIndex:'999999'});
      const title = document.createElement('p'); title.textContent = message; title.id = 'showcase-dialog-label'; dialog.setAttribute('aria-labelledby', title.id);
      const input = document.createElement('textarea'); input.value = value || ''; input.style.cssText='width:100%;min-height:70px;margin:12px 0;color:#172d40;background:white;'; input.setAttribute('aria-label',message);
      const yes = document.createElement('button'), no = document.createElement('button');
      yes.textContent='确定'; no.textContent='取消';
      for (const b of [yes,no]) b.style.cssText='padding:10px 22px;margin:6px;color:#172d40;background:#efd16c;border:2px solid #172d40;font-size:16px;';
      const finish = v => { dialog.close(); dialog.remove(); resolve(v); };
      yes.onclick=()=>finish(confirmOnly ? true : input.value); no.onclick=()=>finish(confirmOnly ? false : null);
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish(confirmOnly ? false : null);});
      dialog.append(title); if (!confirmOnly) dialog.append(input); dialog.append(yes,no); document.body.append(dialog); dialog.showModal();
      (confirmOnly ? yes : input).focus();
    });
  }
  window.MSV_PROMPT = (message,value='') => ask(message,value,false);
  window.MSV_CONFIRM = message => ask(message,'',true);
})();
