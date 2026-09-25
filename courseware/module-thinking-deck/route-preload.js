/* Keep one paused S06 / AI-12 browsing context connected. Reparenting an iframe reloads
 * it, and authenticated no-store assets cannot be warmed by fetch/prefetch. */
(function () {
  'use strict';
  const gameSlides = new Set(['module-s06','ai-12']);
  // Repaint only the lesson shell. Never move or replace the iframe or any of
  // its ancestors: even a detach/reattach reloads its entire browsing context.
  function paint(stage, markup) {
    const draft=document.createElement('template'); draft.innerHTML=markup;
    const incoming=draft.content.querySelector('.deck-slide');
    const current=stage.querySelector('.deck-slide');
    if(!incoming||!current||incoming.dataset.slideId===current.dataset.slideId)return;
    const frame=stage.querySelector('[data-car-game]');
    const nextFrame=incoming.querySelector('[data-car-game]');
    if(!frame||!nextFrame)throw new Error('Shared game slide requires a game frame');
    const game=frame.parentElement,nextGame=nextFrame.parentElement;
    const shell=game.parentElement,nextShell=nextGame.parentElement;
    for(const key of ['slideId','source','theme'])current.dataset[key]=incoming.dataset[key];
    for(const selector of ['.slide-code','.slide-heading','.slide-footer','.slide-page','.slide-progress']){
      current.querySelector(selector).innerHTML=incoming.querySelector(selector).innerHTML;
    }
    shell.className=nextShell.classList.contains('slide-body')?'':nextShell.className;
    game.className=nextGame.className; frame.title=nextFrame.title;
    // All remaining nodes are text/lesson furniture, never the running game.
    for(const child of [...game.childNodes])if(child!==frame)child.remove();
    for(const child of [...nextGame.childNodes])if(child!==nextFrame)game.append(child);
    for(const child of [...shell.childNodes])if(child!==game)child.remove();
    let after=false;
    for(const child of [...nextShell.childNodes]){
      if(child===nextGame){after=true;continue;}
      if(after)shell.append(child);else shell.insertBefore(child,game);
    }
  }
  window.MSVRoutePreload = {paint,create({container, makeStage, getSession, role, onStatus = () => {}}) {
    let stage, frame, session, active = false, scheduled = false, status = 'waiting';
    const origin = location.origin;
    function signal() {
      frame?.contentWindow?.postMessage({type:'msv-route-active', active}, origin);
    }
    function ensure() {
      if (stage && session !== getSession()) {
        active = false; signal(); stage.remove(); stage = frame = null;
      }
      if (stage) return stage;
      session = getSession(); stage = makeStage();
      // Normalize the two slightly different slide layouts while disconnected.
      const body=stage.querySelector('.slide-body');
      if(body){const shell=document.createElement('div');shell.dataset.routeShell='true';while(body.firstChild)shell.append(body.firstChild);body.append(shell);}
      stage.dataset.routeResident = 'true'; stage.dataset.gameSession = session;
      stage.style.visibility = 'hidden'; stage.inert = true; stage.setAttribute('aria-hidden','true');
      frame = stage.querySelector('[data-car-game]');
      const url = new URL('./route-game/index.html', location.href);
      url.searchParams.set('session',session); url.searchParams.set('role',role); url.searchParams.set('warm','1');
      frame.loading = 'eager'; frame.src = url.href;
      frame.addEventListener('load', signal);
      container.append(stage);
      status = 'loading'; onStatus('小车演示：提前准备中…');
      return stage;
    }
    function select(slideId) {
      if (gameSlides.has(slideId)) ensure();
      active = gameSlides.has(slideId);
      if (stage) {
        stage.style.visibility = active ? '' : 'hidden'; stage.inert = !active;
        stage.setAttribute('aria-hidden',String(!active)); signal();
      }
      return active ? stage : null;
    }
    addEventListener('message', event => {
      if (event.origin !== origin || event.source !== frame?.contentWindow) return;
      const data = event.data;
      if (data?.type !== 'msv-route-loading' || !['loading','ready','error'].includes(data.status)) return;
      status = data.status;
      onStatus(status === 'ready' ? '小车演示：已提前就绪' : status === 'error' ? '小车演示：准备失败，请到小车页点重试' : '小车演示：提前准备中…');
      if (status === 'ready') signal();
    });
    function schedule() {
      if (scheduled) return; scheduled = true;
      const start = () => setTimeout(() => { if (!stage) ensure(); }, 800);
      if (document.readyState === 'complete') start(); else addEventListener('load',start,{once:true});
    }
    return {select, schedule, inspect:() => ({status,active,session,connected:!!stage?.isConnected})};
  }};
})();
