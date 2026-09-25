/* Runs before the module graph: even a failed engine download has visible UI. */
(function () {
  'use strict';
  const panel=document.getElementById('route-loading'),label=document.getElementById('loading-label'),progress=document.getElementById('loading-progress'),retry=document.getElementById('loading-retry');
  let timer;
  function notify(status){if(parent!==window)parent.postMessage({type:'msv-route-loading',status},location.origin);}
  function fail(message){clearTimeout(timer);panel.hidden=false;panel.setAttribute('role','alert');label.textContent=message||'加载未完成，请重试。';retry.hidden=false;notify('error');}
  function set(step,text){clearTimeout(timer);panel.hidden=false;panel.setAttribute('role','status');progress.value=step;label.textContent=`${step} / 3 · ${text}`;retry.hidden=true;notify('loading');timer=setTimeout(()=>fail('加载超过 60 秒，请检查网络后重试。'),60000);}
  function done(){clearTimeout(timer);progress.value=3;panel.hidden=true;document.getElementById('fallback').hidden=true;notify('ready');}
  retry.onclick=()=>location.reload(); // Keep session, saved bag and game snapshot.
  window.MSVRouteLoading={set,done,fail};
  set(0,'加载小车、地图和物理引擎');
  import('./app.mjs').catch(error=>{console.warn('小车模块加载失败',error);fail('小车资源加载失败，请检查网络后重试。');});
})();
