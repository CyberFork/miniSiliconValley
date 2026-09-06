#!/usr/bin/env python3
"""Browser regression for T-084 map-hotspot tooltip stacking.

The fixture uses the production ``app/globals.css`` and reproduces the exact
NCSA Mosaic / NET overlap that originally failed.  Pointer events are enabled
on the label only for the instant of hit-testing; that does not alter stacking
and lets ``elementFromPoint`` identify the top-painted element deterministically.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[3]
CSS = (ROOT / "app" / "globals.css").read_bytes()
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
HTML = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/globals.css">
<style>
  html,body{margin:0;width:100%;height:100%;background:#eee}
  .map-viewport{position:relative;width:480px;height:260px;margin:20px;overflow:hidden;background:#d6cfb9}
  .hotspot-layer{transform-origin:0 0}
  #mosaic{left:120px;top:92px}
  #net{left:220px;top:133px}
  #mosaic .hotspot-label{width:230px;max-width:none;background:rgb(10,20,30)}
  #net .hotspot-core{background:rgb(220,30,30)}
</style></head><body>
<div class="map-viewport"><div class="hotspot-layer">
  <button id="mosaic" class="map-hotspot category-network" aria-label="NCSA Mosaic 发布">
    <span class="hotspot-core">WWW</span><span class="hotspot-label"><b>NCSA Mosaic 发布</b><small>1993 · 厄巴纳-香槟</small></span>
  </button>
  <button id="net" class="map-hotspot category-network" aria-label="NET">
    <span class="hotspot-core">NET</span><span class="hotspot-label"><b>网络节点</b><small>1994 · nearby</small></span>
  </button>
</div></div></body></html>""".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        body, content_type = (CSS, "text/css") if self.path == "/globals.css" else (HTML, "text/html; charset=utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args) -> None:
        return


def hit_test(page) -> dict:
    return page.evaluate(
        """() => {
          const label = document.querySelector('#mosaic .hotspot-label');
          const neighbour = document.querySelector('#net .hotspot-core');
          const viewport = document.querySelector('.map-viewport');
          const lr = label.getBoundingClientRect();
          const nr = neighbour.getBoundingClientRect();
          const x = (Math.max(lr.left, nr.left) + Math.min(lr.right, nr.right)) / 2;
          const y = (Math.max(lr.top, nr.top) + Math.min(lr.bottom, nr.bottom)) / 2;
          const previous = label.style.pointerEvents;
          label.style.pointerEvents = 'auto';
          const top = document.elementFromPoint(x, y);
          label.style.pointerEvents = previous;
          return {
            display:getComputedStyle(label).display,
            parentZ:getComputedStyle(document.querySelector('#mosaic')).zIndex,
            topIsLabel:top === label || label.contains(top),
            overlap:Number.isFinite(x) && Number.isFinite(y) && x >= lr.left && x <= lr.right && y >= lr.top && y <= lr.bottom,
            clipped:lr.left < viewport.getBoundingClientRect().left || lr.right > viewport.getBoundingClientRect().right || lr.top < viewport.getBoundingClientRect().top || lr.bottom > viewport.getBoundingClientRect().bottom,
            viewportOverflow:viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight,
            documentOverflow:document.documentElement.scrollWidth > innerWidth,
          };
        }"""
    )


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    result: dict[str, object] = {"ok": False, "scales": {}}
    try:
        with sync_playwright() as playwright:
            options: dict[str, object] = {"headless": True}
            if CHROME.exists():
                options["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**options)
            page = browser.new_page(viewport={"width": 560, "height": 320})
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="networkidle")
            assert page.locator("#mosaic .hotspot-label").evaluate("element => getComputedStyle(element).display") == "none"
            for scale in (0.8, 1.0, 1.25):
                page.locator(".hotspot-layer").evaluate("(element, value) => element.style.transform = `scale(${value})`", scale)
                page.locator("#mosaic").hover()
                hovered = hit_test(page)
                assert hovered["display"] == "block"
                assert hovered["parentZ"] == "30"
                assert hovered["overlap"] and hovered["topIsLabel"]
                assert not hovered["clipped"] and not hovered["documentOverflow"]
                page.locator("#mosaic").focus()
                focused = hit_test(page)
                assert focused["display"] == "block"
                assert focused["parentZ"] == "30"
                assert focused["topIsLabel"]
                result["scales"][str(scale)] = {"hover": True, "focus": True, "zIndex": 30}
            browser.close()
            result["ok"] = True
    finally:
        server.shutdown()
        server.server_close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
