#!/usr/bin/env python3
"""Browser acceptance for T-093 unlocked courseware progress navigation."""
from __future__ import annotations

import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


REPO = Path(__file__).resolve().parents[3]
ROOT = REPO / "public" / "courseware" / "development-mentor-ligun"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args) -> None:
        return


def main() -> None:
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}/"
    receipt: dict[str, object] = {"ok": False}
    try:
        with sync_playwright() as playwright:
            options: dict[str, object] = {"headless": True}
            if CHROME.exists():
                options["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**options)
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            page = context.new_page()
            errors: list[str] = []
            failures: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: errors.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
            page.on("requestfailed", lambda request: failures.append(request.url))

            page.goto(base + "?revision=0&campaign=retain&slide=1&step=0", wait_until="networkidle")
            segments = page.locator("#progress .progress-segment")
            assert segments.count() == 18
            expect(page.locator("#counter")).to_have_text("01 / 18")
            assert page.locator('#progress .progress-segment[aria-current="step"]').count() == 1
            assert page.locator('#progress .progress-segment[aria-disabled="false"]').count() == 1
            assert page.locator('#progress .progress-segment[aria-disabled="true"]').count() == 17

            # A locked future segment explains itself but cannot move or reveal.
            segments.nth(2).click(force=True)
            expect(page.locator("#counter")).to_have_text("01 / 18")
            expect(page.locator("#progress-notice")).to_contain_text("第 3 页尚未解锁")

            # Advance using the real player until the third slide is unlocked.
            for _ in range(40):
                if page.locator("#counter").inner_text() == "03 / 18":
                    break
                page.locator("#next").click()
            expect(page.locator("#counter")).to_have_text("03 / 18")
            assert page.locator('#progress .progress-segment[aria-disabled="false"]').count() == 3

            # A current segment is inert; an unlocked old segment is accessible
            # by keyboard and does not bubble into the deck's next-step handler.
            current_url = page.url
            segments.nth(2).click()
            assert page.url == current_url
            segments.nth(0).focus()
            page.keyboard.press("Enter")
            expect(page.locator("#counter")).to_have_text("01 / 18")
            segments.nth(2).focus()
            page.keyboard.press("Space")
            expect(page.locator("#counter")).to_have_text("03 / 18")

            # Returning to an old slide never shrinks the unlock frontier.
            segments.nth(0).click()
            assert page.locator('#progress .progress-segment[aria-disabled="false"]').count() == 3
            page.reload(wait_until="networkidle")
            expect(page.locator("#counter")).to_have_text("01 / 18")
            assert page.locator('#progress .progress-segment[aria-disabled="false"]').count() == 3
            segments.nth(2).click()
            expect(page.locator("#counter")).to_have_text("03 / 18")

            # Stored progress clamps a manually edited future deep link. URL
            # updates preserve independent query parameters and exact revision.
            page.goto(base + "?revision=0&campaign=retain&slide=18&step=99", wait_until="networkidle")
            expect(page.locator("#counter")).to_have_text("03 / 18")
            query = page.evaluate("() => Object.fromEntries(new URL(location.href).searchParams)")
            assert query["revision"] == "0"
            assert query["campaign"] == "retain"
            assert query["slide"] == "3"

            # A fresh presenter session may start from an authorized deep link,
            # including its legal reveal step, without affecting another session.
            second = browser.new_context(viewport={"width": 1280, "height": 720}).new_page()
            second.goto(base + "?revision=0&slide=6&step=2", wait_until="networkidle")
            expect(second.locator("#counter")).to_have_text("06 / 18")
            assert second.locator(".slide.active [data-reveal].revealed").count() == min(
                2, second.locator(".slide.active [data-reveal]").count()
            )
            assert second.locator('#progress .progress-segment[aria-disabled="false"]').count() == 6
            second.close()

            # Overview preserves the same locked boundary.
            page.keyboard.press("KeyO")
            assert page.locator("body").evaluate("node => node.classList.contains('overview')")
            page.locator(".slide").nth(3).click(force=True)
            expect(page.locator("#counter")).to_have_text("03 / 18")
            page.keyboard.press("KeyO")

            assert not errors, errors
            assert not failures, failures
            receipt.update({
                "ok": True,
                "slides": 18,
                "mouse": True,
                "keyboard": True,
                "lockedBoundary": True,
                "sessionRestore": True,
                "queryPreservation": True,
                "consoleErrors": errors,
                "requestFailures": failures,
            })
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    assert receipt["ok"]


if __name__ == "__main__":
    main()
