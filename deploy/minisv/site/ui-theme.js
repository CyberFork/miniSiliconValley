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
    if (/^\/workshop(?:\/|$)/.test(window.location.pathname)) return;
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

  function mountPublicNavigator() {
    if (document.getElementById("msv-public-nav")) return;
    var pathname = window.location.pathname.replace(/\/+$/, "/");
    if (["/framework/", "/parents/"].indexOf(pathname) === -1) return;
    var nav = document.createElement("nav");
    nav.id = "msv-public-nav";
    nav.className = "msv-public-nav";
    nav.setAttribute("aria-label", "MINI硅谷公共服务导航");
    [
      ["首页", "/"],
      ["历史世界", "/world/"],
      ["课程大纲", "/framework/"],
      ["家长入口", "/parents/"],
      ["上课入口", "/classroom/"],
      ["课件查看", "/course/"],
    ].forEach(function (item) {
      var link = document.createElement("a");
      link.href = item[1];
      link.textContent = item[0];
      if (item[1] === pathname) link.setAttribute("aria-current", "page");
      nav.appendChild(link);
    });
    document.body.appendChild(nav);
  }

  // The latest Adventure skin is the single product UI. Apply the root
  // contract immediately so there is no classic-theme flash; mount only the
  // optional navigation enhancement after independently built pages hydrate.
  applyCanonicalTheme();
  if (document.readyState === "complete") {
    window.setTimeout(function () {
      applyCanonicalTheme();
      mountPublicNavigator();
    }, 0);
  } else {
    window.addEventListener("load", function () {
      applyCanonicalTheme();
      mountPublicNavigator();
    }, { once: true });
  }
})();
