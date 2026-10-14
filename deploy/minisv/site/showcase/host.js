/* Trusted host. Student frames have opaque origins and no access to site accounts. */
(() => {
  'use strict';
  const frame = document.getElementById('student-frame');
  if (!frame) return;
  const student = frame.dataset.student, kind = frame.dataset.kind;
  const keysByStudent = {cwe:['kirby_cp_profiles_v1','kirby_cp_current_user_v1'],tzx:['phantom-game-progress'],zrq:['doomsday_endless_v1'],dky:['echofault.save.v1']};
  const allowedKeys = Object.hasOwn(keysByStudent, student) ? keysByStudent[student] : [];
  const expected = `/showcase/2026-09/${student}/runtime/${kind === 'game' ? 'game' : 'slides'}/index.html`;
  if (!allowedKeys.length || !['game', 'slides'].includes(kind) || frame.dataset.src !== expected) return;
  let fullscreenTarget = frame;
  if (kind === 'slides') {
    // Keep the student's desktop slide layout intact rather than squeezing it into phone columns.
    const stage=document.createElement('div'); stage.className='slides-stage';
    frame.before(stage);stage.append(frame);fullscreenTarget=stage;
    function fitSlide() {
      const scale=Math.min(stage.clientWidth/1280,stage.clientHeight/720);
      Object.assign(frame.style,{width:'1280px',height:'720px',minHeight:'0',position:'absolute',left:((stage.clientWidth-1280*scale)/2)+'px',top:((stage.clientHeight-720*scale)/2)+'px',transform:`scale(${scale})`,transformOrigin:'top left'});
    }
    new ResizeObserver(fitSlide).observe(stage);
    document.addEventListener('fullscreenchange',fitSlide);
  }
  const namespace = `minisv.showcase.2026-09.${student}.`;
  const status = document.getElementById('load-status');
  const maxBytes = 200000;
  let memory = Object.create(null), timeout, running = false;
  function setStatus(text) { if (status) status.textContent = text; }
  function readSaved() {
    for (const key of allowedKeys) {
      try { const v = localStorage.getItem(namespace + key); if (v !== null && v.length <= maxBytes) memory[key] = v; } catch (_) {}
    }
    return memory;
  }
  function load() {
    clearTimeout(timeout);
    running = false;
    setStatus('正在加载作品，请稍候…');
    readSaved();
    frame.src = expected;
    timeout = setTimeout(() => setStatus('加载较久？可点击“重新加载”；如果画面已显示，可直接操作。'), 20000);
  }
  frame.addEventListener('load', () => {
    clearTimeout(timeout);
    setStatus(kind === 'game' ? (running ? '游戏已初始化，点击游戏画面开始操作。存档仅保存在此浏览器。' : '游戏页面已载入，正在初始化…') : '路演已载入，可使用画面内的翻页按钮。');
  });
  // Strict source + opaque-origin + per-game key allowlist. No generic commands or site data.
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== 'null' || kind !== 'game') return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'minisv-showcase-ready' && typeof data.token === 'string' && data.token.length < 100) {
      event.source.postMessage({type:'minisv-showcase-seed',token:data.token,values:readSaved()}, '*');
    }
    if (data.type === 'minisv-showcase-running') { running = true; clearTimeout(timeout); setStatus('游戏已初始化，点击游戏画面开始操作。存档仅保存在此浏览器。'); }
    if (data.type === 'minisv-showcase-save' && allowedKeys.includes(data.key) && typeof data.value === 'string' && data.value.length <= maxBytes) {
      memory[data.key] = data.value;
      try { localStorage.setItem(namespace + data.key, data.value); } catch (_) { setStatus('浏览器未允许保存存档，本次会话仍可试玩。'); }
    }
    if (data.type === 'minisv-showcase-remove' && allowedKeys.includes(data.key)) {
      delete memory[data.key];
      try { localStorage.removeItem(namespace + data.key); } catch (_) {}
    }
    if (data.type === 'minisv-showcase-reload') load();
  });
  document.getElementById('reload-frame')?.addEventListener('click', load);
  document.getElementById('fullscreen-frame')?.addEventListener('click', async () => {
    try { await fullscreenTarget.requestFullscreen(); } catch (_) { setStatus('当前浏览器不支持全屏，可横屏或放大浏览器窗口。'); }
  });
  document.getElementById('copy-link')?.addEventListener('click', async () => {
    const link = location.origin + location.pathname;
    try { await navigator.clipboard.writeText(link); setStatus('作品链接已复制，可以发给朋友。'); }
    catch (_) {
      const field = document.createElement('input'); field.value = link; field.readOnly = true; field.setAttribute('aria-label', '分享链接');
      status.replaceChildren(document.createTextNode('请复制：'), field); field.select();
    }
  });
  load();
})();
