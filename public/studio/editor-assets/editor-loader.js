(() => {
  "use strict";

  // The editor is intentionally split into reusable, framework-free assets.  They
  // have hard dependencies, so loading them as sibling `next/script` elements is
  // unsafe on a real network: the main editor may execute before its projectors exist.
  // Keep this list sequential and make this loader the only editor script entry.
  const ASSETS = [
    "/studio/editor-assets/ui-theme.js?v=t085-editor-r4",
    "/studio/editor-assets/card-view.js?v=t085-editor-r4",
    "/studio/editor-assets/course-preview.js?v=t085-editor-r4",
    "/studio/editor-assets/editor.js?v=t085-editor-r4",
  ];

  if (window.__MSV_EDITOR_BOOT_PROMISE__) return;

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
    for (const asset of ASSETS) await loadScript(asset);
    window.dispatchEvent(new CustomEvent("msv:editor-ready"));
  })().catch((error) => {
    showBootFailure(error);
    throw error;
  });
})();
