(() => {
  "use strict";
  const panel = document.querySelector("[data-health-state]");
  const title = document.getElementById("status-title");
  const detail = document.getElementById("status-detail");
  if (!panel || !title || !detail) return;

  const requestJson = async (path) => {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  };

  Promise.all([requestJson("/healthz"), requestJson("/release.json")])
    .then(([health, release]) => {
      if (!health.ok || health.origin !== "hecate" || release.origin !== "hecate") {
        throw new Error("production identity mismatch");
      }
      panel.dataset.healthState = "online";
      title.textContent = "Hecate 生产服务在线";
      const built = release.builtAt
        ? new Date(release.builtAt).toLocaleString("zh-CN", { hour12: false })
        : "时间未知";
      detail.replaceChildren(
        document.createTextNode("HTTPS Tunnel 已连接 · 所有入口由 Hecate 提供"),
        document.createElement("br"),
        Object.assign(document.createElement("small"), {
          textContent: `发布 ${release.release || "未知"} · ${built}`,
        }),
      );
    })
    .catch(() => {
      panel.dataset.healthState = "offline";
      title.textContent = "连接状态需要检查";
      detail.replaceChildren(
        document.createTextNode("未能确认 Hecate 生产网关，请稍后刷新。"),
        document.createElement("br"),
        Object.assign(document.createElement("small"), {
          textContent: "导航仍可使用；导师可进入主控台查看详细状态。",
        }),
      );
    });
})();
