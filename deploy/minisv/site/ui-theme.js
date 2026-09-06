(function () {
  "use strict";

  var STORAGE_KEY = "minisv.ui.theme";
  var MODES = ["classic", "adventure"];
  var root = document.documentElement;

  function safeRead() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (_error) {
      return null;
    }
  }

  function safeWrite(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (_error) {
      // The switch still works for this page when storage is unavailable.
    }
  }

  function requestedMode() {
    var query = new URLSearchParams(window.location.search).get("ui");
    if (MODES.indexOf(query) !== -1) return query;
    var stored = safeRead();
    return MODES.indexOf(stored) !== -1 ? stored : "classic";
  }

  function surfaceKind() {
    var links = Array.prototype.slice.call(document.querySelectorAll("link[rel='stylesheet']"));
    var joined = links.map(function (link) { return link.getAttribute("href") || ""; }).join(" ");
    return /(?:console|seat)\.css/.test(joined) ? "dark" : "light";
  }

  function setMode(mode, persist) {
    var next = MODES.indexOf(mode) !== -1 ? mode : "classic";
    root.dataset.msvTheme = next;
    root.style.colorScheme = surfaceKind() === "dark" ? "dark" : "light";
    if (persist) safeWrite(next);

    var switcher = document.getElementById("msv-ui-switch");
    if (switcher) {
      switcher.querySelectorAll("button[data-theme]").forEach(function (button) {
        var active = button.dataset.theme === next;
        button.setAttribute("aria-pressed", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      var status = switcher.querySelector("[data-theme-status]");
      if (status) status.textContent = next === "adventure" ? "像素冒险版" : "当前版";
    }

    window.dispatchEvent(new CustomEvent("msv:themechange", { detail: { theme: next } }));
  }

  function makeButton(mode, label) {
    var button = document.createElement("button");
    button.type = "button";
    button.dataset.theme = mode;
    button.textContent = label;
    button.addEventListener("click", function () { setMode(mode, true); });
    button.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      var next = event.key === "ArrowRight"
        ? MODES[(MODES.indexOf(mode) + 1) % MODES.length]
        : MODES[(MODES.indexOf(mode) + MODES.length - 1) % MODES.length];
      setMode(next, true);
      switcher.querySelector("button[data-theme='" + next + "']").focus();
    });
    return button;
  }

  var switcher;
  function mountSwitcher() {
    if (document.getElementById("msv-ui-switch")) return;
    root.dataset.msvSurface = surfaceKind();

    switcher = document.createElement("section");
    switcher.id = "msv-ui-switch";
    switcher.className = "msv-ui-switch";
    switcher.setAttribute("aria-label", "界面风格对比");
    switcher.innerHTML = "<span class='msv-ui-switch__label'>UI</span><span class='sr-only' data-theme-status aria-live='polite'></span>";
    switcher.appendChild(makeButton("classic", "当前"));
    switcher.appendChild(makeButton("adventure", "冒险"));

    var slot = document.querySelector("[data-msv-theme-slot]")
      || document.querySelector(".header-actions")
      || document.querySelector(".controller-access");
    if (slot) {
      slot.appendChild(switcher);
      switcher.dataset.placement = "inline";
    } else {
      var topbar = document.querySelector(".topbar, body > header, body > nav, [class*='_authNav_']");
      if (topbar) {
        var rail = document.createElement("div");
        rail.className = "msv-ui-switch-rail";
        rail.setAttribute("aria-label", "界面风格工具栏");
        rail.appendChild(switcher);
        document.body.appendChild(rail);
        root.dataset.msvUiDock = "true";
        switcher.dataset.placement = "rail";

        var syncDock = function () {
          var currentTopbar = document.querySelector(".topbar, body > header, body > nav, [class*='_authNav_']");
          if (!currentTopbar || !currentTopbar.getBoundingClientRect) return;
          root.style.setProperty("--msv-ui-dock-top", Math.max(0, currentTopbar.getBoundingClientRect().bottom) + "px");
        };
        syncDock();
        if (window.requestAnimationFrame) window.requestAnimationFrame(syncDock);
        if (window.addEventListener) window.addEventListener("resize", syncDock, { passive: true });
      } else {
        document.body.appendChild(switcher);
        switcher.dataset.placement = "floating";
      }
    }
    setMode(root.dataset.msvTheme || requestedMode(), false);
  }

  // Apply the stored mode before the body is parsed to avoid a light/dark flash.
  root.dataset.msvTheme = requestedMode();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSwitcher, { once: true });
  } else {
    mountSwitcher();
  }
})();
