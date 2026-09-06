(() => {
  "use strict";

  const CLIENT_KEY = "msv-remote-console-client-id";
  const NICKNAME_KEY = "msv-remote-console-nickname";
  const APP_BASE = new URL(".", window.location.href);
  const CONTROLLER_URL = new URL("../control/", APP_BASE).href;
  const clientId = localStorage.getItem(CLIENT_KEY) || crypto.randomUUID();
  let nickname = normalizeNickname(localStorage.getItem(NICKNAME_KEY) || "");
  let nicknameDialogPromise = null;
  let controllerWindow = null;
  let toastTimer = null;
  localStorage.setItem(CLIENT_KEY, clientId);
  if (nickname) localStorage.setItem(NICKNAME_KEY, nickname);
  else localStorage.removeItem(NICKNAME_KEY);

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
  function normalizeNickname(value) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
  }

  function toast(message) {
    const element = byId("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
  }

  async function syncNicknameToOwnedSeats() {
    try {
      const data = await api(`/api/console?${new URLSearchParams({ clientId })}`);
      await Promise.all((data.seats || []).filter((seat) => seat.isMine).map((seat) => api("/api/claims", {
        method: "POST",
        body: JSON.stringify({ seatId: seat.id, clientId, nickname }),
      })));
      await refresh();
    } catch (error) {
      toast(`昵称已保存，但同步席位失败：${error.message}`);
    }
  }

  function editNickname({ onSave } = {}) {
    const dialog = byId("nicknameDialog");
    const form = byId("nicknameForm");
    const input = byId("nicknameInput");
    const error = byId("nicknameError");
    if (nicknameDialogPromise) {
      input.focus();
      return nicknameDialogPromise;
    }

    dialog.returnValue = "";
    input.value = nickname;
    error.textContent = "";
    dialog.showModal();
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    nicknameDialogPromise = new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        form.removeEventListener("submit", handleSubmit);
        dialog.removeEventListener("close", handleClose);
        nicknameDialogPromise = null;
        resolve(value);
      };
      const handleClose = () => settle(false);
      const handleSubmit = (event) => {
        event.preventDefault();
        const next = normalizeNickname(input.value);
        if (!next || next.length > 24) {
          error.textContent = "请输入 1–24 个字符，不能只有空格。";
          input.focus();
          return;
        }
        nickname = next;
        localStorage.setItem(NICKNAME_KEY, nickname);
        byId("nicknameLabel").textContent = nickname;
        // Open a pending seat card while the submit gesture is still active.
        // Waiting for the network request would make popup blockers reject it.
        if (typeof onSave === "function") onSave();
        dialog.close("save");
        settle(true);
        void syncNicknameToOwnedSeats();
      };
      form.addEventListener("submit", handleSubmit);
      dialog.addEventListener("close", handleClose);
    });
    return nicknameDialogPromise;
  }

  async function api(path, options = {}) {
    const target = new URL(String(path).replace(/^\/+/, ""), APP_BASE);
    const response = await fetch(target, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let envelope;
    try {
      envelope = await response.json();
    } catch {
      throw new Error(`服务返回了无法识别的响应（HTTP ${response.status}）。`);
    }
    if (!response.ok || !envelope.ok) {
      throw new Error(envelope.error?.message || `请求失败（HTTP ${response.status}）。`);
    }
    return envelope.data;
  }

  function formatLease(seat, now) {
    if (!seat.expiresAt) return "";
    const seconds = Math.max(0, Math.ceil((seat.expiresAt - now) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `无操作 ${minutes}:${String(remainder).padStart(2, "0")} 后释放`;
  }

  function seatWindowName(seat) {
    return `msv_seat_${String(seat.id || "card").replace(/[^A-Za-z0-9_-]/g, "_")}`;
  }

  function seatWindowFeatures() {
    const availableWidth = Math.max(320, Number(window.screen?.availWidth) || window.innerWidth || 1280);
    const availableHeight = Math.max(480, Number(window.screen?.availHeight) || window.innerHeight || 800);
    const availableLeft = Number.isFinite(window.screen?.availLeft) ? window.screen.availLeft : 0;
    const availableTop = Number.isFinite(window.screen?.availTop) ? window.screen.availTop : 0;
    const width = Math.max(320, Math.min(440, availableWidth - 48));
    const height = Math.max(480, Math.min(860, availableHeight - 64));
    const left = Math.round(availableLeft + (availableWidth - width) / 2);
    const top = Math.round(availableTop + (availableHeight - height) / 2);
    return [
      "popup=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "resizable=yes",
      "scrollbars=yes",
      "toolbar=no",
      "location=no",
      "menubar=no",
      "status=no",
    ].join(",");
  }

  function controllerWindowFeatures() {
    const availableWidth = Math.max(360, Number(window.screen?.availWidth) || window.innerWidth || 1440);
    const availableHeight = Math.max(480, Number(window.screen?.availHeight) || window.innerHeight || 900);
    const availableLeft = Number.isFinite(window.screen?.availLeft) ? window.screen.availLeft : 0;
    const availableTop = Number.isFinite(window.screen?.availTop) ? window.screen.availTop : 0;
    const width = Math.max(360, Math.min(1320, availableWidth - 48));
    const height = Math.max(480, Math.min(940, availableHeight - 48));
    const left = Math.round(availableLeft + (availableWidth - width) / 2);
    const top = Math.round(availableTop + (availableHeight - height) / 2);
    return [
      "popup=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "resizable=yes",
      "scrollbars=yes",
      "toolbar=no",
      "location=no",
      "menubar=no",
      "status=no",
    ].join(",");
  }

  function openController() {
    if (controllerWindow && !controllerWindow.closed) {
      try {
        controllerWindow.focus();
        toast("LIVE RUN 主控窗口已置于最前。");
        return;
      } catch {
        controllerWindow = null;
      }
    }
    try {
      controllerWindow = window.open(CONTROLLER_URL, "msv_live_run_controller", controllerWindowFeatures());
    } catch {
      // The inline fallback below gives the DM an actionable recovery path.
    }
    if (!controllerWindow) {
      toast("浏览器拦截了主控窗口；请允许此站点的弹出窗口后重试。");
      return;
    }
    try {
      controllerWindow.opener = null;
      controllerWindow.focus();
    } catch {
      // Browsers may still restrict WindowProxy properties after navigation.
    }
    toast("正在打开受导师权限保护的 LIVE RUN 主控…");
  }

  function openSeatCard(url, seat) {
    if (!url) {
      toast("席位链接不可用，请刷新后重试。");
      return null;
    }
    const popup = window.open(new URL(url, APP_BASE).href, seatWindowName(seat), seatWindowFeatures());
    if (!popup) return null;
    try {
      // Isolate the private seat from the public console while retaining this
      // handle long enough to replace the loading card after the claim.
      popup.opener = null;
      popup.focus();
    } catch {
      // Navigation still works in browsers that restrict popup properties.
    }
    return popup;
  }

  function reserveSeatCard(seat) {
    const loadingUrl = new URL("seat-loading.html", APP_BASE);
    loadingUrl.searchParams.set("seat", seat.window || seat.id);
    return openSeatCard(loadingUrl.href, seat);
  }

  function navigateSeatCard(popup, url) {
    if (!popup || popup.closed || !url) return false;
    try {
      popup.location.replace(new URL(url, APP_BASE).href);
      popup.focus();
      return true;
    } catch {
      return false;
    }
  }

  function closeSeatCard(popup) {
    if (!popup || popup.closed) return;
    try {
      popup.close();
    } catch {
      // A failed claim must not fail again while closing its loading card.
    }
  }

  function openClaimedSeat(seat) {
    const popup = openSeatCard(seat.url, seat);
    if (!popup) toast("浏览器拦截了卡片窗口；请允许此站点的弹出窗口后重试。");
  }

  function renderSeat(seat, data) {
    const mine = seat.isMine;
    const occupiedByOther = seat.claimed && !mine;
    const card = document.createElement("article");
    card.className = `seat ${mine ? "mine" : occupiedByOther ? "other" : "idle"}`;
    const status = mine
      ? `我在用 · ${formatLease(seat, data.now)}`
      : occupiedByOther
        ? `他人使用 · ${formatLease(seat, data.now)}`
        : data.connected ? "空闲 · 可以领取" : "主控离线 · 暂不可打开";
    const title = seat.claimed ? `${seat.title || seat.id} · ${seat.claimedBy || "其他测试者"}` : (seat.title || seat.id);
    card.innerHTML = `
      <div class="seat-top">
        <strong>${escapeHtml(seat.window || seat.id)}</strong>
        <span>${seat.kind === "mentor" ? "导师席" : "学员席"}</span>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <div class="seat-status">${escapeHtml(status)}</div>
      <div class="seat-actions"></div>`;
    const actions = card.querySelector(".seat-actions");
    if (mine) {
      const openButton = document.createElement("button");
      openButton.textContent = "打开卡片窗口";
      openButton.addEventListener("click", () => openClaimedSeat(seat));
      actions.append(openButton);
      const releaseButton = document.createElement("button");
      releaseButton.className = "release";
      releaseButton.textContent = "释放";
      releaseButton.addEventListener("click", () => releaseSeat(seat));
      actions.append(releaseButton);
    } else if (!seat.claimed) {
      const claimButton = document.createElement("button");
      claimButton.textContent = "领取并打开";
      claimButton.disabled = !data.connected;
      claimButton.addEventListener("click", () => requestSeatClaim(seat));
      actions.append(claimButton);
    }
    return card;
  }

  function render(data) {
    byId("courseName").textContent = data.course?.name || "等待课程主控";
    byId("courseCoverage").textContent = data.course?.coverage || "完整五步课程";
    const current = Number(data.run?.currentBlock || 0);
    const total = Number(data.run?.totalBlocks || 0);
    byId("courseBar").value = total ? Math.round((current / total) * 100) : 0;
    byId("blockNow").textContent = current || "—";
    byId("blockTotal").textContent = total || "—";
    const revision = data.run?.courseRevision;
    const sync = revision == null ? "" : ` · r${revision} · #${data.run?.refreshEpoch || 0}`;
    const preview = data.run?.executionBlock && data.run.executionBlock !== current ? ` · 回看 B${String(current).padStart(2,"0")}，真实 B${String(data.run.executionBlock).padStart(2,"0")}` : "";
    byId("macroStep").textContent = `${data.run?.macroStepName || data.run?.status || "等待连接…"}${sync}${preview}`;
    byId("claimCount").textContent = data.clientClaimCount ?? 0;
    byId("connText").textContent = data.connected ? "课程主控已连接" : "席位台在线 · 课程主控离线";
    byId("connDot").classList.toggle("off", !data.connected);
    byId("connectionMessage").textContent = data.connectionError || "八个席位读取同一场测试课堂，并由服务器按席位裁剪可见内容。";
    byId("lastUpdated").textContent = `最后同步 ${new Date(data.now || Date.now()).toLocaleTimeString()}`;
    const grid = byId("seatGrid");
    grid.replaceChildren(...(data.seats || []).map((seat) => renderSeat(seat, data)));
  }

  async function refresh() {
    try {
      const query = new URLSearchParams({ clientId });
      render(await api(`/api/console?${query}`));
    } catch (error) {
      byId("connText").textContent = "席位控制台连接失败";
      byId("connDot").classList.add("off");
      byId("connectionMessage").textContent = error.message;
    }
  }

  function requestSeatClaim(seat) {
    const openAndClaim = () => {
      const popup = reserveSeatCard(seat);
      void claimSeat(seat, popup);
    };
    if (nickname) return openAndClaim();
    void editNickname({ onSave: openAndClaim }).then((saved) => {
      if (!saved) toast("设置昵称后才能领取席位。");
    });
  }

  async function claimSeat(seat, popup) {
    try {
      const result = await api("/api/claims", {
        method: "POST",
        body: JSON.stringify({ seatId: seat.id, clientId, nickname }),
      });
      const cardOpened = navigateSeatCard(popup, result.url);
      await refresh();
      toast(cardOpened
        ? `${seat.window || seat.id} 已领取，卡片窗口已打开。`
        : `${seat.window || seat.id} 已领取；浏览器拦截了弹窗，请点击“打开卡片窗口”。`);
    } catch (error) {
      closeSeatCard(popup);
      toast(error.message);
      await refresh();
    }
  }

  async function releaseSeat(seat) {
    try {
      await api(`/api/claims/${encodeURIComponent(seat.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ clientId, lease: seat.lease }),
      });
      toast(`${seat.window || seat.id} 已释放。`);
      await refresh();
    } catch (error) {
      toast(error.message);
      await refresh();
    }
  }

  byId("editNick").addEventListener("click", () => editNickname());
  document.querySelectorAll(".dialog-cancel").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close("cancel")));
  byId("refreshBtn").addEventListener("click", refresh);
  byId("controllerBtn").addEventListener("click", openController);
  byId("resetBtn").addEventListener("click", () => {
    const dialog = byId("resetDialog");
    const input = byId("resetInput");
    dialog.returnValue = "";
    input.value = "";
    byId("resetError").textContent = "";
    dialog.showModal();
    window.requestAnimationFrame(() => input.focus());
  });
  byId("resetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const confirmation = byId("resetInput").value.trim();
    if (confirmation !== "RESET ALL TEST SEATS") {
      byId("resetError").textContent = "确认文字不匹配，未执行重置。";
      byId("resetInput").focus();
      return;
    }
    byId("resetDialog").close("reset");
    try {
      await api("/api/claims/reset", {
        method: "POST",
        body: JSON.stringify({ confirm: confirmation }),
      });
      toast("八个测试席位已全部释放。");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  });

  byId("nicknameLabel").textContent = nickname || "点击设置";
  refresh();
  window.setInterval(refresh, 2_000);
})();
