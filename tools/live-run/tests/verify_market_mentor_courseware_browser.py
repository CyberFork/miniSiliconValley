#!/usr/bin/env python3
"""Browser acceptance for the immutable M-mentor user-system deck."""
from __future__ import annotations

import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


REPO = Path(__file__).resolve().parents[3]
ROOT = REPO / "public" / "courseware" / "market-mentor-user-system"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
VIEWPORTS = ((1600, 900), (1280, 720), (1024, 768), (390, 844))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler contract
        if self.path.split("?", 1)[0] == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()


def main() -> None:
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}/"
    receipt: dict[str, object] = {"ok": False, "viewports": []}
    try:
        with sync_playwright() as playwright:
            options: dict[str, object] = {"headless": True}
            if CHROME.exists():
                options["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**options)
            for width, height in VIEWPORTS:
                page = browser.new_page(viewport={"width": width, "height": height})
                console_errors: list[str] = []
                request_failures: list[str] = []
                page.on("pageerror", lambda error: console_errors.append(str(error)))
                page.on("console", lambda message: console_errors.append(f"{message.type}:{message.text}") if message.type == "error" else None)
                page.on("requestfailed", lambda request: request_failures.append(request.url))
                page.goto(base + "?revision=0&campaign=qa&slide=1", wait_until="networkidle")
                page.wait_for_timeout(100)

                assert page.locator(".slide").count() == 49
                assert page.locator("#pagenum").inner_text() == "1 / 49"
                assert page.evaluate("document.documentElement.scrollWidth === innerWidth")

                page.keyboard.press("End")
                page.wait_for_timeout(100)
                assert page.locator("#pagenum").inner_text() == "49 / 49"
                assert page.evaluate("Object.fromEntries(new URL(location.href).searchParams)") == {
                    "revision": "0", "campaign": "qa", "slide": "49",
                }
                page.keyboard.press("Home")
                page.wait_for_timeout(100)
                assert page.locator("#pagenum").inner_text() == "1 / 49"

                if width > 600:
                    page.locator(".nav-dot").nth(20).click()
                    page.wait_for_timeout(100)
                    assert page.locator("#pagenum").inner_text() == "21 / 49"

                clipped = page.locator(".slide-content").evaluate_all("""elements => elements.map((element, index) => {
                  const slide = element.closest('.slide').getBoundingClientRect();
                  const content = element.getBoundingClientRect();
                  return { slide: index + 1, left: content.left - slide.left, top: content.top - slide.top,
                    right: content.right - slide.right, bottom: content.bottom - slide.bottom };
                }).filter(item => item.left < -1 || item.top < -1 || item.right > 1 || item.bottom > 1)""")
                assert not clipped, clipped
                assert not console_errors, console_errors
                assert not request_failures, request_failures
                receipt["viewports"].append({"width": width, "height": height, "fit": True})  # type: ignore[union-attr]
                page.close()

            deep_link = browser.new_page(viewport={"width": 1280, "height": 720})
            deep_link.goto(base + "?revision=0&slide=42&step=3", wait_until="networkidle")
            assert deep_link.locator("#pagenum").inner_text() == "42 / 49"
            assert deep_link.evaluate("Object.fromEntries(new URL(location.href).searchParams)") == {
                "revision": "0", "slide": "42", "step": "3",
            }
            deep_link.close()
            browser.close()
            receipt.update({
                "ok": True,
                "slides": 49,
                "keyboard": True,
                "mouse": True,
                "queryPreservation": True,
                "deepLink": True,
                "externalRuntimeRequests": False,
            })
    finally:
        server.shutdown()
        server.server_close()
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    assert receipt["ok"]


if __name__ == "__main__":
    main()
