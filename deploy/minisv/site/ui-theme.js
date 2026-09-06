(function () {
  "use strict";

  var STORAGE_KEY = "minisv.ui.theme";
  var MODES = ["classic", "adventure"];
  var root = document.documentElement;

  function safeRead() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function safeWrite(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
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
      // Never manufacture a full-width toolbar for pages that do not declare
      // a theme slot. It changes document geometry and can cover editor fields
      // at browser zoom levels. The fallback is one non-layout control.
      document.body.appendChild(switcher);
      switcher.dataset.placement = "floating";
    }
    setMode(root.dataset.msvTheme || requestedMode(), false);
  }

  function mountCourseShortcut() {
    if (document.getElementById("msv-course-shortcut")) return;
    var pathname = window.location.pathname.replace(/\/+$/, "/");
    if (["/framework/", "/parents/"].indexOf(pathname) === -1) return;
    var link = document.createElement("a");
    link.id = "msv-course-shortcut";
    link.className = "msv-course-nav-link";
    link.dataset.placement = "floating";
    link.href = "/course/";
    link.textContent = "课程大纲 ↗";
    link.setAttribute("aria-label", "打开统一课程大纲");
    document.body.appendChild(link);
  }

  function mountSharedUi() {
    mountSwitcher();
    mountCourseShortcut();
  }

  // Do not mutate the root or insert the switcher before independently built
  // React pages have hydrated. Both changes are mounted after window.load so
  // the shared enhancement never invalidates server HTML.
  if (document.readyState === "complete") {
    window.setTimeout(mountSharedUi, 500);
  } else {
    window.addEventListener("load", function () { window.setTimeout(mountSharedUi, 500); }, { once: true });
  }
})();
