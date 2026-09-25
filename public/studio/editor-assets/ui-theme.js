(function () {
  "use strict";

  var root = document.documentElement;
  var LEGACY_STORAGE_KEY = "minisv.ui.theme";

  function surfaceKind() {
    var pathname = window.location.pathname.replace(/\/+$/, "/");
    if (/^\/classroom\/[^/]+(?:\/.*)?$/.test(pathname)) return "dark";

    var links = Array.prototype.slice.call(document.querySelectorAll("link[rel='stylesheet']"));
    var joined = links.map(function (link) { return link.getAttribute("href") || ""; }).join(" ");
    return /(?:console|seat)\.css/.test(joined) ? "dark" : "light";
  }

  function clearRetiredPreference() {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Private browsing or a locked-down origin may not expose storage.
    }
  }

  function applyCanonicalTheme() {
    var surface = surfaceKind();
    root.dataset.msvTheme = "adventure";
    root.dataset.msvSurface = surface;
    root.style.colorScheme = surface;
    clearRetiredPreference();

    // A second execution (for example after a hot reload) must also clean up
    // a switch left behind by an older cached runtime.
    var retiredSwitcher = document.getElementById("msv-ui-switch");
    if (retiredSwitcher && typeof retiredSwitcher.remove === "function") retiredSwitcher.remove();

    window.dispatchEvent(new CustomEvent("msv:themechange", {
      detail: { theme: "adventure", canonical: true },
    }));
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
    link.textContent = "导师课件 ↗";
    link.setAttribute("aria-label", "打开导师课件库");
    document.body.appendChild(link);
  }

  // The latest Adventure skin is the single product UI. Apply the root
  // contract immediately so there is no classic-theme flash; mount only the
  // optional navigation enhancement after independently built pages hydrate.
  applyCanonicalTheme();
  if (document.readyState === "complete") {
    window.setTimeout(function () {
      applyCanonicalTheme();
      mountCourseShortcut();
    }, 0);
  } else {
    window.addEventListener("load", function () {
      applyCanonicalTheme();
      mountCourseShortcut();
    }, { once: true });
  }
})();
