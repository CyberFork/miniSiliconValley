(() => {
  "use strict";

  // The editor is intentionally split into reusable, framework-free assets.  They
  // have hard dependencies, so loading them as sibling `next/script` elements is
  // unsafe on a real network: the main editor may execute before its projectors exist.
  // Preload every dependency together, then execute sequentially. Network
  // latency must not be paid four times, but a failed dependency must still
  // prevent the editor from starting. This remains the only script entry.
  const ASSETS = [
    "/studio/editor-assets/ui-theme.js?v=studio-startup-r2",
    "/studio/editor-assets/card-view.js?v=studio-startup-r2",
    "/studio/editor-assets/course-projection-core.js?v=course-projector-v7",
    "/studio/editor-assets/course-preview.js?v=course-projector-v7",
    "/studio/editor-assets/editor.js?v=studio-startup-r3",
  ];

  if (window.__MSV_EDITOR_BOOT_PROMISE__) return;

  // Keep one monotonic, browser-readable startup trace.  It is deliberately
  // diagnostic-only: no course identity or authoring decision is derived from
  // these numbers.  T-110's browser acceptance reads this object to separate
  // document, script, bootstrap and first-editable time instead of treating a
  // single load event as proof that the editor is ready.
  const startup = window.__MSV_EDITOR_STARTUP__ = {
    navigationStart: 0,
    loaderStart: Math.round(performance.now() * 10) / 10,
  };
  function startupMark(name) {
    startup[name] = Math.round(performance.now() * 10) / 10;
    window.dispatchEvent(new CustomEvent("msv:editor-startup", {detail: {...startup}}));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.msvEditorAsset = src;
      script.addEventListener("load", resolve, {once: true});
      script.addEventListener("error", () => reject(new Error(`无法载入 ${src.split("?")[0]}`)), {once: true});
      document.head.appendChild(script);
    });
  }

  function showBootFailure(error) {
    console.error("Mini Silicon Valley editor boot failed", error);

    const saveState = document.getElementById("saveState");
    if (saveState) {
      saveState.textContent = "编辑器加载失败";
      saveState.dataset.state = "error";
    }

    const emptyState = document.getElementById("emptyState");
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.innerHTML = "<b>课程编辑器没有完整载入</b><p>请刷新页面重试；若仍失败，请把当前时间和页面地址发给管理员。你的课程数据没有被修改。</p>";
    }

    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "编辑器加载失败，请刷新页面重试。";
      toast.className = "toast show error";
    }
  }

  window.__MSV_EDITOR_BOOT_PROMISE__ = (async () => {
    for (const asset of ASSETS) {
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "script";
      preload.href = asset;
      document.head.appendChild(preload);
    }
    startupMark("preloadsStarted");
    for (const asset of ASSETS) await loadScript(asset);
    startupMark("scriptsReady");
    window.dispatchEvent(new CustomEvent("msv:editor-scripts-ready", {detail: {...startup}}));
  })().catch((error) => {
    startupMark("failed");
    showBootFailure(error);
    throw error;
  });
})();
