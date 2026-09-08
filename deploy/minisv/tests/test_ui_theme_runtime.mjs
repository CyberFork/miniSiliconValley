import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.id = "";
    this.tabIndex = 0;
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  focus() { this.focused = true; }
  set innerHTML(_value) {}
  get innerHTML() { return ""; }
  walk() { return [this, ...this.children.flatMap((child) => child.walk())]; }
  querySelectorAll(selector) {
    if (selector === "button[data-theme]") return this.walk().filter((item) => item.tagName === "BUTTON" && item.dataset.theme);
    return [];
  }
  querySelector(selector) {
    const match = selector.match(/^button\[data-theme='([^']+)'\]$/);
    if (match) return this.walk().find((item) => item.tagName === "BUTTON" && item.dataset.theme === match[1]) ?? null;
    return null;
  }
}

function boot(search = "", stored = null, pathname = "/") {
  const root = new Element("html");
  const body = new Element("body");
  const callbacks = {};
  const storage = new Map(stored ? [["minisv.ui.theme", stored]] : []);
  const document = {
    documentElement: root,
    body,
    readyState: "loading",
    createElement: (tag) => new Element(tag),
    addEventListener: (name, handler) => { callbacks[name] = handler; },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: (id) => body.walk().find((item) => item.id === id) ?? null,
  };
  const events = [];
  const window = {
    location: { search, pathname },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    addEventListener: (name, handler) => { callbacks[name] = handler; },
    setTimeout: (handler) => handler(),
    dispatchEvent: (event) => events.push(event),
  };
  const sourceCandidates = [
    new URL("../site/ui-theme.js", import.meta.url),
    new URL("../../site/ui-theme.js", import.meta.url),
  ];
  const sourceUrl = sourceCandidates.find((candidate) => existsSync(candidate));
  assert.ok(sourceUrl, "ui-theme.js must exist in source or release layout");
  const source = readFileSync(sourceUrl, "utf8");
  vm.runInNewContext(source, { document, window, URLSearchParams, CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options.detail; } } });
  callbacks.load();
  return { root, body, storage, events };
}

{
  const runtime = boot("", null, "/framework/");
  const shortcut = runtime.body.walk().find((item) => item.id === "msv-course-shortcut");
  assert.ok(shortcut, "framework must receive a post-hydration course shortcut");
  assert.equal(shortcut.href, "/course/");
  assert.equal(shortcut.textContent, "导师课件 ↗");
}

{
  const runtime = boot();
  const switcher = runtime.body.walk().find((item) => item.id === "msv-ui-switch");
  assert.ok(switcher, "switch must mount");
  assert.equal(runtime.root.dataset.msvTheme, "classic");
  const buttons = switcher.querySelectorAll("button[data-theme]");
  assert.deepEqual(buttons.map((button) => button.textContent), ["当前", "冒险"]);
  buttons[1].listeners.click();
  assert.equal(runtime.root.dataset.msvTheme, "adventure");
  assert.equal(runtime.storage.get("minisv.ui.theme"), "adventure");
  assert.equal(buttons[1].attributes["aria-pressed"], "true");
}

{
  const runtime = boot("?ui=adventure", "classic");
  assert.equal(runtime.root.dataset.msvTheme, "adventure", "URL comparison mode must override storage");
}

console.log("ui theme runtime: ok");
