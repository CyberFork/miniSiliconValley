(() => {
  "use strict";
  const root = document.querySelector("[data-world-preview]");
  if (!root) return;
  const range = root.querySelector("[data-world-range]");
  const yearOutput = root.querySelector("[data-world-year]");
  const eraOutput = root.querySelector("[data-world-era]");
  const layersRoot = root.querySelector("[data-world-layers]");
  const hotspotsRoot = root.querySelector("[data-world-hotspots]");
  const story = root.querySelector("[data-world-story]");
  const status = root.querySelector("[data-world-status]");
  if (!(range instanceof HTMLInputElement) || !yearOutput || !eraOutput || !layersRoot || !hotspotsRoot || !story || !status) return;

  let catalog = null;
  const layerNodes = [];
  const hotspotNodes = [];

  const eraLabel = (year) => year < 1954
    ? "果园与车库"
    : year < 1989
      ? "芯片与个人计算"
      : year < 2006
        ? "互联网起飞"
        : "移动、云与 AI";

  const layerOpacity = (index, year, layers) => {
    const anchors = layers.map((item) => item.year);
    if (year <= anchors[0]) return index === 0 ? 1 : 0;
    if (year >= anchors[anchors.length - 1]) return index === anchors.length - 1 ? 1 : 0;
    let lower = 0;
    while (lower < anchors.length - 1 && year > anchors[lower + 1]) lower += 1;
    const upper = Math.min(lower + 1, anchors.length - 1);
    const progress = (year - anchors[lower]) / (anchors[upper] - anchors[lower]);
    if (index === lower) return 1 - progress;
    if (index === upper) return progress;
    return 0;
  };

  const closestEvent = (year) => catalog.events.reduce((closest, event) => {
    const distance = Math.abs(event.year - year);
    const previousDistance = Math.abs(closest.year - year);
    return distance < previousDistance || (distance === previousDistance && event.year <= year) ? event : closest;
  }, catalog.events[0]);

  const renderYear = (rawYear) => {
    if (!catalog) return;
    const year = Math.max(catalog.yearRange.min, Math.min(catalog.yearRange.max, Math.round(Number(rawYear))));
    range.value = String(year);
    yearOutput.textContent = String(year);
    eraOutput.textContent = eraLabel(year);
    layerNodes.forEach((node, index) => { node.style.opacity = String(layerOpacity(index, year, catalog.layers)); });
    const active = closestEvent(year);
    hotspotNodes.forEach(({ node, event }) => {
      const distance = Math.abs(event.year - year);
      node.dataset.active = String(event.id === active.id);
      node.style.opacity = String(distance <= 24 || event.id === active.id ? Math.max(.28, 1 - distance / 34) : .12);
    });
    story.replaceChildren();
    const meta = document.createElement("small");
    meta.textContent = `${active.year} · ${active.place} · ${active.sourceCount} 条来源`;
    const title = document.createElement("h3");
    title.textContent = active.title;
    const significance = document.createElement("p");
    significance.textContent = active.significance;
    story.append(meta, title, significance);
    root.querySelectorAll("[data-world-jump]").forEach((button) => {
      button.dataset.active = String(Number(button.dataset.worldJump) === year);
    });
  };

  fetch("/world-preview.json", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`world preview ${response.status}`);
    const value = await response.json();
    if (value?.schemaVersion !== 1 || value?.source !== "historyCatalog" || !Array.isArray(value.layers) || !value.layers.length || !Array.isArray(value.events) || !value.events.length) {
      throw new Error("world preview schema mismatch");
    }
    catalog = value;
    range.min = String(value.yearRange.min);
    range.max = String(value.yearRange.max);
    layersRoot.replaceChildren();
    value.layers.forEach((layer, index) => {
      const image = document.createElement("img");
      image.src = layer.src;
      image.alt = "";
      image.decoding = "async";
      image.loading = index === 2 ? "eager" : "lazy";
      layersRoot.append(image);
      layerNodes.push(image);
    });
    hotspotsRoot.replaceChildren();
    value.events.forEach((event) => {
      const button = document.createElement("button");
      button.type = "button";
      button.style.left = `${event.map.x}%`;
      button.style.top = `${event.map.y}%`;
      button.setAttribute("aria-label", `${event.year} · ${event.title}`);
      button.addEventListener("click", () => renderYear(event.year));
      hotspotsRoot.append(button);
      hotspotNodes.push({ node: button, event });
    });
    root.setAttribute("aria-busy", "false");
    status.textContent = `${value.events.length} 个精选节点 · 完整世界保留全部事件与来源`;
    renderYear(range.value);
  }).catch(() => {
    root.setAttribute("aria-busy", "false");
    status.textContent = "轻量地图暂时没有载入；完整历史世界仍可打开。";
    story.replaceChildren(
      Object.assign(document.createElement("small"), { textContent: "OFFLINE FALLBACK" }),
      Object.assign(document.createElement("h3"), { textContent: "地图画面仍在，历史节点请进入完整世界" }),
      Object.assign(document.createElement("p"), { textContent: "这里不会用演示数据替代真实历史目录。" }),
    );
  });

  range.addEventListener("input", () => renderYear(range.value));
  root.querySelectorAll("[data-world-jump]").forEach((button) => {
    button.addEventListener("click", () => renderYear(button.dataset.worldJump));
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
      actions.append(actionLink("我的课堂", "/classroom/", "portal-account-action"));
      actions.append(actionLink("课件查看", "/course/", "portal-account-action"));
      if (current && (current.role === "admin" || current.role === "mentor")) {
        actions.append(actionLink("Course Studio · 内部工作台", "/studio/", "portal-account-action portal-account-wide"));
      }
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
