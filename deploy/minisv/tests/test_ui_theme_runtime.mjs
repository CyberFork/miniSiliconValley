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
    this.parent = null;
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  set innerHTML(_value) {}
  get innerHTML() { return ""; }
  walk() { return [this, ...this.children.flatMap((child) => child.walk())]; }
}

function boot({ search = "", stored = null, pathname = "/", legacySwitcher = false } = {}) {
  const root = new Element("html");
  const body = new Element("body");
  if (legacySwitcher) {
    const old = new Element("section");
    old.id = "msv-ui-switch";
    body.appendChild(old);
  }
  const callbacks = {};
  const storage = new Map(stored === null ? [] : [["minisv.ui.theme", stored]]);
  const document = {
    documentElement: root,
    body,
    readyState: "loading",
    createElement: (tag) => new Element(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => body.walk().find((item) => item.id === id) ?? null,
  };
  const events = [];
  const window = {
    location: { search, pathname },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
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
  vm.runInNewContext(source, {
    document,
    window,
    MutationObserver: class {
      constructor(handler) { this.handler = handler; }
      observe() {}
      disconnect() {}
    },
    CustomEvent: class {
      constructor(name, options) {
        this.type = name;
        this.detail = options.detail;
      }
    },
  });
  callbacks.load();
  return { root, body, storage, events };
}

{
  const runtime = boot({ pathname: "/framework/" });
  const nav = runtime.body.walk().find((item) => item.id === "msv-public-nav");
  assert.ok(nav, "framework must receive the shared public-service navigator");
  assert.deepEqual(Array.from(nav.children, (item) => item.href), ["/", "/world/", "/framework/", "/parents/", "/classroom/", "/course/"]);
  assert.equal(nav.children[2].attributes["aria-current"], "page");
  assert.equal(runtime.root.dataset.msvTheme, "adventure");
  assert.equal(runtime.root.dataset.msvSurface, "light");
}

{
  const runtime = boot({
    search: "?ui=classic",
    stored: "classic",
    pathname: "/classroom/521a12fb-ec3f-4f72-bb2a-4cdaa7063219/control/",
    legacySwitcher: true,
  });
  assert.equal(runtime.root.dataset.msvTheme, "adventure", "URL and stale storage cannot select a retired theme");
  assert.equal(runtime.root.dataset.msvSurface, "dark", "classroom instance routes are dark operational surfaces");
  assert.equal(runtime.root.style.colorScheme, "dark");
  assert.equal(runtime.storage.has("minisv.ui.theme"), false, "retired preference must be cleared");
  assert.equal(runtime.body.walk().some((item) => item.id === "msv-ui-switch"), false, "no switch may remain in the DOM");
  assert.ok(runtime.events.every((event) => event.detail.theme === "adventure" && event.detail.canonical));
}

{
  const runtime = boot({ pathname: "/classroom/" });
  assert.equal(runtime.root.dataset.msvSurface, "light", "the classroom list remains a light product surface");
  assert.equal(runtime.body.walk().some((item) => item.id === "msv-ui-switch"), false);
}

console.log("canonical Adventure UI runtime: ok");
