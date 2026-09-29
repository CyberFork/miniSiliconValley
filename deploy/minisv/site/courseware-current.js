/* Release-owned navigation chrome. It never changes saved text or package bytes. */
(function () {
  'use strict';
  const path = location.pathname;
  const match = path.match(/^\/courseware\/(development-mentor-module-thinking|development-mentor-ligun)\/(?:r\d+\/)?teacher\/(?:workshop\/(?:teacher\/presenter|audience\/index)|presenter)\.html$/);
  const permanent = path.match(/^\/courseware\/latest\/(p1|p2)\/(workshop\/|workbook\/)?$/);
  if (!match && !permanent) return;
  const deck = permanent ? permanent[1] : match[1] === 'development-mentor-module-thinking' ? 'p1' : 'p2';
  const workshop = path.includes('/workshop/');
  const workbook = path.includes('/workbook/');
  if (permanent && workbook) { location.replace('/prompts/' + location.search); return; }
  const audience = /\/audience\//.test(path);
  const params = new URLSearchParams(location.search);
  function targetPath(record) {
    if(workbook)return record.teacher.replace('/teacher/presenter.html','/audience/ai-materials/workbook/index.html');
    return workshop ? record.workshop + (audience ? 'audience/index.html' : 'teacher/presenter.html') : record.teacher;
  }
  function query(record) {
    const q = new URLSearchParams();
    for (const key of (workbook ? ['template'] : ['session', 'slideId', 'slide', 'step'])) {
      const value = params.get(key);
      if (value && value.length < 160) q.set(key, value);
    }
    if(record?.merged&&!workbook){q.delete('slide');q.delete('slideId');q.delete('step');q.set('slideId',record.startSlide || 'ai-01');}
    return q.size ? '?' + q : '';
  }
  async function run() {
    const response = await fetch('/courseware-current.json', {cache: 'no-store'});
    if (!response.ok) throw Error('无法检查最新版本');
    const record = (await response.json())[deck];
    const base = '/courseware/' + (deck === 'p1' || record?.merged === true ? 'development-mentor-module-thinking' : 'development-mentor-ligun') + '/';
    if (!record || !record.teacher.startsWith(base) || !/^\/courseware\/[a-z-]+\/r\d+\/teacher\/presenter\.html$/.test(record.teacher)) throw Error('最新版地址无效');
    const target = targetPath(record);
    if (!target || !target.startsWith(base) || target.includes('..')) throw Error('最新版地址无效');
    if (permanent) { location.replace(target + query(record)); return; }
    const old = path !== target;
    const revision=Number(path.match(/\/r(\d+)\//)?.[1]||0);
    const sharedEditable=deck==='p1'?revision>=13:revision>=6;
    const bar = document.createElement('aside');
    bar.id = 'msv-current-courseware'; bar.setAttribute('aria-label', '课件最新版入口');
    bar.style.cssText = 'display:inline-flex;flex:0 0 auto;gap:8px;align-items:center;color:#fff8e7;font:600 14px/1.4 system-ui;';
    const label = document.createElement('span'); label.textContent = old ? (record.merged ? '立棍已合并到开发课；旧版文字记录仍保存在此旧课件。' : (sharedEditable?'本页可直接编辑，保存文字与最新版共用。':'当前为旧版，已有保存文字会在最新版继承。')) : '当前为最新版';
    const link = document.createElement('a'); link.href = target + query(record); link.target = '_blank'; link.rel = 'noopener';
    link.textContent = old ? '打开最新版 ↗' : '最新版固定入口 ↗';
    if (!old) link.href = '/courseware/latest/' + deck + (workshop ? '/workshop/' : '/') + query();
    link.style.cssText = 'display:inline-block;background:#ebca63;color:#172c3e;padding:6px 10px;border:2px solid #fff8e7;text-decoration:none;white-space:nowrap;';
    link.title=label.textContent; label.hidden=true;
    bar.append(label, link);
    // Reuse the existing header, never add a row to the full-height presenter grid.
    // This also works with historical packages whose body track sizes differ.
    const host=document.querySelector('.session-panel') || document.querySelector('header.top');
    if (host) host.append(bar);
    else {
      bar.style.position='fixed'; bar.style.top='10px'; bar.style.right='10px'; bar.style.zIndex='1000';
      document.body.append(bar);
    }
    if (old && !sharedEditable) {
      const note = document.createElement('small'); note.hidden=true; note.textContent = '新窗口打开，不会关闭本页。未保存文字请先复制。';
      const copy = document.createElement('button'); copy.type='button'; copy.textContent='复制未保存文字'; copy.hidden=true;
      copy.style.cssText='background:#fff8e7;color:#172c3e;border:2px solid #ebca63;padding:8px 12px;font:inherit;';
      const editor = () => document.querySelector('dialog[open] .msv-text-editor-textarea');
      function syncDialog() {
        copy.hidden = !editor();
        const dialog = document.querySelector('dialog[open]');
        if (!editor() || !dialog || dialog.querySelector('[data-latest-recovery]')) return;
        const recovery = document.createElement('aside'); recovery.dataset.latestRecovery='true';
        recovery.style.cssText='padding:12px;border:2px solid #b94729;background:#fff8e7;color:#172c3e;';
        const next=link.cloneNode(true); next.textContent='打开最新版继续编辑 ↗';
        const duplicate=copy.cloneNode(true); duplicate.hidden=false; duplicate.onclick=()=>copy.click();
        const hint=document.createElement('p'); hint.textContent='先复制当前文字，再到新版粘贴保存。本窗口与未保存文字会保留。';
        recovery.append(hint,duplicate,next); dialog.append(recovery);
      }
      const observer = new MutationObserver(syncDialog);
      observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['open']});
      syncDialog();
      copy.onclick=async()=>{ const input=editor(); if(!input)return; try{ await navigator.clipboard.writeText(input.value); note.textContent='已复制未保存文字。请在最新版打开对应文字并粘贴保存。'; } catch { input.focus();input.select();note.textContent='请按 Ctrl+C／⌘C 复制选中的文字，再打开最新版。'; } };
      bar.append(copy,note);
    }
  }
  run().catch(() => {
    if (permanent) {
      document.body.textContent='暂时无法打开最新版。请刷新重试，或从课件库打开。';
      const a=document.createElement('a');a.href='/course/';a.textContent='打开课件库';document.body.append(a);
    }
  });
})();
