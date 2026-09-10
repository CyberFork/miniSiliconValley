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

(() => {
  "use strict";
  const root = document.querySelector("[data-portal-account]");
  if (!root) return;

  const CHANNEL_NAME = "msv-auth-v1";
  const tabId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}.${Math.random()}`;
  const roleLabels = { admin: "平台管理员", mentor: "导师账号", learner: "Young Builder", observer: "观察员" };
  const statusLabels = {
    available: "可直接切换",
    expired: "登录已到期",
    disabled: "账号已停用",
    reauthenticate: "需要重新验证",
  };
  let accountSet = null;
  let open = false;
  let busy = false;
  let loadError = "";

  const loginPath = (username = "") => {
    const params = new URLSearchParams({ returnTo: `${location.pathname}${location.search}${location.hash}` });
    if (username) {
      params.set("add", "1");
      params.set("username", username);
    }
    return `/auth/login?${params}`;
  };

  const request = async (method, body) => {
    const response = await fetch("/api/auth/accounts", {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const envelope = await response.json().catch(() => null);
    if (!response.ok || !envelope?.ok || envelope.data === undefined) {
      throw new Error(envelope?.error?.message || "账号服务没有完成这次操作。");
    }
    return envelope.data;
  };

  const emitChange = (action) => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "account-changed", action, source: tabId, at: Date.now() });
    channel.close();
  };

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const actionLink = (label, href, className = "") => {
    const link = element("a", className, label);
    link.href = href;
    return link;
  };

  const mutate = async (action, targetUserId) => {
    if (!accountSet || busy) return;
    busy = true;
    loadError = "";
    render();
    try {
      const data = await request("POST", {
        action,
        expectedVersion: accountSet.version,
        idempotencyKey: `${action}.${crypto.randomUUID()}`,
        ...(targetUserId ? { targetUserId } : {}),
      });
      accountSet = data.accountSet;
      emitChange(action);
      if (action === "switch") location.reload();
      else if (action === "logout-current") location.assign(`/auth/login?returnTo=${encodeURIComponent("/")}&select=1&signedOut=current`);
      else if (action === "logout-all") location.assign(`/auth/login?returnTo=${encodeURIComponent("/")}&signedOut=all`);
      else {
        busy = false;
        render();
      }
    } catch (error) {
      loadError = error instanceof Error ? error.message : "账号操作没有完成。";
      busy = false;
      await load(false);
    }
  };

  const render = () => {
    root.replaceChildren();
    const current = accountSet?.accounts?.find((account) => account.current) || null;
    const trigger = element("button", "portal-account-trigger");
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", String(open));
    trigger.disabled = busy;
    trigger.append(element("span", "portal-account-avatar", current ? initials(current.displayName) : "ID"));
    trigger.append(element("span", "portal-account-label", current?.displayName || (accountSet?.accounts?.length ? "选择账号" : "登录")));
    trigger.append(element("span", "portal-account-chevron", "⌄"));
    trigger.addEventListener("click", () => { open = !open; render(); });
    root.append(trigger);
    if (!open) return;

    const panel = element("div", "portal-account-panel");
    panel.setAttribute("role", "menu");
    if (loadError) {
      const error = element("div", "portal-account-error", loadError);
      error.setAttribute("role", "alert");
      const retry = element("button", "portal-account-retry", "重试");
      retry.type = "button";
      retry.addEventListener("click", () => void load(true));
      error.append(retry);
      panel.append(error);
    }

    if (!accountSet?.accounts?.length) {
      panel.append(element("p", "portal-account-empty", "这台设备还没有可直接选择的账号。"));
      panel.append(actionLink("登录账号 →", loginPath(), "portal-account-action"));
    } else {
      panel.append(element("b", "portal-account-title", "这台设备的账号"));
      for (const account of accountSet.accounts) {
        const row = element("div", "portal-account-row");
        row.dataset.current = String(account.current);
        const identity = element("span", "portal-account-identity");
        identity.append(element("b", "", account.displayName));
        identity.append(element("small", "", `@${account.username} · ${roleLabels[account.role] || account.role}`));
        const state = element("em", "", statusLabels[account.status] || "需要验证");
        state.dataset.status = account.status;
        identity.append(state);
        row.append(identity);
        const controls = element("span", "portal-account-controls");
        if (account.current) {
          controls.append(element("b", "portal-account-current", "当前"));
        } else if (account.status === "available") {
          const button = element("button", "portal-account-switch", busy ? "切换中…" : "切换");
          button.type = "button";
          button.disabled = busy;
          button.addEventListener("click", () => void mutate("switch", account.userId));
          controls.append(button);
        } else if (account.status === "disabled") {
          controls.append(element("span", "portal-account-disabled", "不可用"));
        } else {
          controls.append(actionLink("重新验证", loginPath(account.username), "portal-account-switch"));
        }
        if (!account.current) {
          const remove = element("button", "portal-account-remove", "×");
          remove.type = "button";
          remove.disabled = busy;
          remove.setAttribute("aria-label", `从本设备移除 ${account.displayName}`);
          remove.addEventListener("click", () => {
            if (confirm(`从这台设备移除 ${account.displayName}？平台账号不会被删除。`)) void mutate("remove", account.userId);
          });
          controls.append(remove);
        }
        row.append(controls);
        panel.append(row);
      }
      const actions = element("div", "portal-account-actions");
      actions.append(actionLink("账户中心", "/account/", "portal-account-action"));
      actions.append(actionLink("＋ 添加账号", `${loginPath()}&add=1`, "portal-account-action"));
      const logoutCurrent = element("button", "portal-account-action", "退出当前账号");
      logoutCurrent.type = "button";
      logoutCurrent.disabled = busy || !current;
      logoutCurrent.addEventListener("click", () => void mutate("logout-current"));
      actions.append(logoutCurrent);
      const logoutAll = element("button", "portal-account-action portal-account-danger", "退出本设备全部账号");
      logoutAll.type = "button";
      logoutAll.disabled = busy;
      logoutAll.addEventListener("click", () => {
        if (confirm("退出这台设备上的全部账号？之后需要重新输入密码。")) void mutate("logout-all");
      });
      actions.append(logoutAll);
      panel.append(actions);
    }
    root.append(panel);
  };

  async function load(showBusy = true) {
    if (showBusy) busy = true;
    loadError = "";
    if (showBusy) render();
    try {
      const data = await request("GET");
      accountSet = data.accountSet;
      if (!accountSet) {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (sessionResponse.ok) {
          const ensured = await request("POST", { action: "ensure" });
          accountSet = ensured.accountSet;
        } else if (sessionResponse.status !== 401) {
          throw new Error("无法确认当前账号状态，请重试。");
        }
      }
    } catch (error) {
      loadError = error instanceof Error ? error.message : "无法读取账号状态。";
    } finally {
      busy = false;
      render();
    }
  }

  function initials(value) {
    return Array.from(String(value || "MS").trim()).slice(0, 2).join("").toUpperCase() || "MS";
  }

  document.addEventListener("pointerdown", (event) => {
    if (open && event.target instanceof Node && !root.contains(event.target)) { open = false; render(); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) { open = false; render(); root.querySelector("button")?.focus(); }
  });
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", (event) => {
      if (event.data?.type === "account-changed" && event.data.source !== tabId) void load(false);
    });
  }
  window.addEventListener("focus", () => void load(false));
  void load(false);
})();
