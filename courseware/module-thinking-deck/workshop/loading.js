(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc) return;
  var timer = null;
  var panel, progress, title, detail, retry;
  var current = 0;
  var labels = ['准备启动', '加载三维渲染', '加载物理引擎', '创建课堂场景', '就绪'];

  function ensure() {
    if (panel) return panel;
    panel = doc.createElement('section');
    panel.id = 'workshop-loading';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'margin:12px 0;padding:16px 18px;border:2px solid #18283b;background:#fff5cf;color:#18283b;font:600 15px/1.45 system-ui,sans-serif;';
    title = doc.createElement('strong'); title.textContent = '正在连接'; panel.appendChild(title);
    detail = doc.createElement('p'); detail.style.cssText = 'margin:6px 0 10px'; detail.textContent = labels[0]; panel.appendChild(detail);
    progress = doc.createElement('progress'); progress.max = 4; progress.value = 0; progress.setAttribute('aria-label', '工坊加载进度'); progress.style.cssText = 'display:block;width:100%;accent-color:#f2c94c;'; panel.appendChild(progress);
    retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.hidden = true; retry.style.cssText = 'margin-top:10px;padding:7px 14px;border:2px solid #18283b;background:#f2c94c;color:#18283b;font-weight:700;cursor:pointer;'; retry.onclick = function () { if (global.location) global.location.reload(); };
    panel.appendChild(retry);
    var canvas = doc.getElementById('canvas');
    if (canvas && canvas.parentNode) canvas.parentNode.insertBefore(panel, canvas); else (doc.body || doc.documentElement).appendChild(panel);
    return panel;
  }
  function stop() { if (timer !== null) { global.clearTimeout(timer); timer = null; } }
  function schedule() { stop(); timer = global.setTimeout(function () { fail('加载超时（60秒没有进度）。请点击“重试”。'); }, 60000); }
  function set(step, label) {
    ensure(); current = Math.max(0, Math.min(4, Number(step) || 0)); progress.value = current; detail.textContent = label || labels[current] || '加载中'; title.textContent = '正在加载工坊 · ' + current + ' / 4'; retry.hidden = true; panel.hidden = false; panel.setAttribute('role', 'status'); schedule();
  }
  function fail(message) { ensure(); stop(); title.textContent = '加载失败'; detail.textContent = message || '加载失败，请重试。'; panel.setAttribute('role', 'alert'); retry.hidden = false; panel.hidden = false; }
  function done() { ensure(); stop(); current = 4; progress.value = 4; title.textContent = '已就绪'; detail.textContent = '三维场景已准备完成。'; retry.hidden = true; panel.hidden = true; panel.setAttribute('role', 'status'); }
  function relevantError(e) {
    var msg = String(e && (e.message || e.error && e.error.message) || '');
    var file = String(e && (e.filename || e.target && e.target.src) || '');
    if (/ethereum|metamask|chrome-extension:|moz-extension:/i.test(msg + ' ' + file)) return;
    if (e && e.type === 'error' && e.target && e.target.tagName === 'SCRIPT') { fail('脚本加载失败，请点击“重试”。'); return; }
    if (file && file.indexOf((global.location && global.location.origin || '') + '/') === 0 && /\/workshop\//.test(file)) fail('场景脚本运行失败，请点击“重试”。');
  }
  if (global.addEventListener) global.addEventListener('error', relevantError, true);
  global.MSVWorkshopLoading = { set: set, fail: fail, done: done };
  set(0, labels[0]);
})(window);
