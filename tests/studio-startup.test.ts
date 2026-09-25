import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NavigationLink from "../app/components/NavigationLink";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

type FakeNode = {
  rel?: string; as?: string; href?: string; src?: string; async?: boolean;
  dataset: Record<string, string>;
  handlers: Record<string, () => void>;
  addEventListener(type: string, handler: () => void): void;
};

function bootContext(failAt = -1) {
  const events: string[] = [];
  const links: string[] = [];
  const scripts: FakeNode[] = [];
  const errors: unknown[][] = [];
  const document = {
    head: { appendChild(node: FakeNode) {
      if (node.rel === "preload") {
        assert.equal(node.as, "script");
        links.push(node.href!); events.push(`preload:${node.href}`); return node;
      }
      assert.equal(node.async, false);
      const index = scripts.length;
      scripts.push(node); events.push(`append:${node.src}`);
      queueMicrotask(() => { node.handlers[index === failAt ? "error" : "load"]?.(); });
      return node;
    } },
    createElement() {
      return { dataset: {}, handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } } as FakeNode;
    },
    getElementById() { return null; },
  };
  const context = {
    document, console: { error: (...args: unknown[]) => errors.push(args) },
    CustomEvent: class { constructor(type: string, init?: unknown) { void type; void init; } }, queueMicrotask, dispatchEvent() {},
    performance: { now: () => 12.3 },
    window: null as unknown,
    __MSV_EDITOR_BOOT_PROMISE__: undefined as Promise<void> | undefined,
    __MSV_EDITOR_STARTUP__: undefined as Record<string, number> | undefined,
  };
  context.window = context;
  return { context, events, links, scripts, errors };
}

test("editor loader preloads all assets, executes in order, and is failure/duplicate safe", async () => {
  const loader = source("public/studio/editor-assets/editor-loader.js");
  const ok = bootContext();
  vm.runInNewContext(loader, ok.context);
  // Before even the first load event, every ordered dependency has a network hint.
  assert.equal(ok.links.length, 5);
  assert.equal(ok.scripts.length, 1);
  assert.ok(ok.events.slice(0, 5).every((event) => event.startsWith("preload:")));
  assert.ok(ok.context.__MSV_EDITOR_BOOT_PROMISE__);
  await ok.context.__MSV_EDITOR_BOOT_PROMISE__;
  assert.equal(ok.links.length, 5);
  assert.deepEqual(ok.links, ok.scripts.map((script) => script.src));
  assert.equal(ok.scripts.length, 5);
  assert.equal(ok.context.__MSV_EDITOR_STARTUP__?.loaderStart, 12.3);
  assert.equal(ok.context.__MSV_EDITOR_STARTUP__?.preloadsStarted, 12.3);
  assert.equal(ok.context.__MSV_EDITOR_STARTUP__?.scriptsReady, 12.3);
  vm.runInNewContext(loader, ok.context);
  assert.equal(ok.scripts.length, 5);

  const failed = bootContext(1);
  vm.runInNewContext(loader, failed.context);
  assert.ok(failed.context.__MSV_EDITOR_BOOT_PROMISE__);
  await assert.rejects(failed.context.__MSV_EDITOR_BOOT_PROMISE__);
  assert.equal(failed.errors.length, 1);
  assert.equal(failed.links.length, 5);
  assert.equal(failed.scripts.length, 2);
});

test("editor init does not block catalog/course opening on release-info loading", async () => {
  const js = source("public/studio/editor-assets/editor.js");
  const start = js.indexOf("async function init()");
  assert.ok(start >= 0);
  let depth = 0, end = -1, opened = false;
  for (let i = js.indexOf("{", start); i < js.length; i++) {
    if (js[i] === "{") { depth++; opened = true; }
    else if (js[i] === "}" && opened && --depth === 0) { end = i + 1; break; }
  }
  assert.ok(end > start);
  const calls: string[] = [];
  const init = vm.runInNewContext(`
    let catalog = [{id: "first"}];
    const loadReleaseInfo = () => new Promise(() => {});
    const loadCatalog = async () => { calls.push("catalog"); catalog = [{id: "first"}]; };
    const openCourse = async () => { calls.push("course"); };
    const setSaveState = () => {};
    const toast = () => {};
    (${js.slice(start, end)})`, {
    URLSearchParams: class { get() { return null; } }, window: { location: { search: "" } }, calls,
  });
  await init();
  assert.deepEqual(calls, ["catalog", "course"]);
});

test("NavigationLink emits a native anchor and preserves exact identity query", () => {
  const href = "/studio/preview/?course=eleme-2008-find-problem&revision=12&digest=abc123";
  const html = renderToStaticMarkup(createElement(NavigationLink, { href }, "前往多角色视图验收"));
  assert.match(html, /^<a /);
  assert.ok(html.includes(`href="${href.replaceAll("&", "&amp;")}"`));
  assert.ok(html.includes("前往多角色视图验收"));
  const link = source("app/components/NavigationLink.tsx");
  assert.match(link, /return <a \{\.\.\.props\} href=\{href\}/);
  assert.match(link, /ComponentPropsWithoutRef<"a">/);
  assert.match(link, /full-document navigation/);
  assert.doesNotMatch(link, /from ["']next\/link["']/);
  assert.doesNotMatch(link, /preventDefault\s*\(/);
});
