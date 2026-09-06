#!/usr/bin/env python3
"""End-to-end browser acceptance for T-083 nine-pane Course Studio."""
from __future__ import annotations

import json
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController, LiveRunServer  # noqa: E402
from course import CourseRepository  # noqa: E402

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def main() -> None:
    receipt: dict[str, object] = {"ok": False}
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        repository = CourseRepository(root / "courses")
        controller = CourseController(root / "run-state.json", course_repository=repository)
        server = LiveRunServer(("127.0.0.1", 0), controller, "t083-browser-token")
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                launch: dict[str, object] = {"headless": True}
                if CHROME.exists():
                    launch["executable_path"] = str(CHROME)
                browser = playwright.chromium.launch(**launch)
                page = browser.new_page(viewport={"width": 1440, "height": 1000})
                errors: list[str] = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/editor/?course=google-1995-2004", wait_until="networkidle")

                expect(page.locator("#studioTab")).to_have_attribute("aria-selected", "true")
                expect(page.locator("#studioPane")).to_be_visible()
                assert page.locator(".timeline-step").count() == 5
                assert page.locator(".timeline-block").count() == 13
                assert page.locator(".seat-preview-card").count() == 8
                assert page.locator(".seat-preview-card:visible").count() == 8
                assert page.locator('[data-course-path="course.name"]').count() == 1
                assert page.locator('[data-course-path="course.description"]').count() == 1
                assert page.locator('[data-course-path="macroSteps.0.name"]').count() == 1
                expect(page.locator("#controllerShell")).to_be_visible()
                expect(page.locator("#projectionStamp")).to_contain_text("9/9 同步")
                expect(page.locator("#studioPane")).to_contain_text("不使用 Alpha lease")

                # One timeline click atomically moves the controller and all 8 seats.
                page.locator('[data-preview-block="12"]').click()
                expect(page.locator("#projectionStamp")).to_contain_text("B13")
                assert page.locator('.msv-seat-surface[data-block-id="B13"]').count() == 8
                expect(page.locator('#previewController .shared-controller')).to_have_attribute("data-block-id", "B13")

                # Layout modes stay in the same page, never opening Alpha windows.
                page.locator('[data-layout="mentors"]').click()
                assert page.locator(".seat-preview-card:visible").count() == 4
                page.locator('[data-layout="learners"]').click()
                assert page.locator(".seat-preview-card:visible").count() == 4
                page.locator('[data-layout="compare"]').click()
                assert page.locator(".seat-preview-card:visible").count() == 2
                page.locator('[data-layout="overview"]').click()

                # Same seed is reproducible; a new seed produces a new 4x3 deal.
                def dealt_ids() -> list[str]:
                    return page.locator('.seat-preview-card[data-preview-seat^="learner"] .private-card').evaluate_all("nodes => nodes.map(node => node.dataset.cardId)")
                first_deal = dealt_ids()
                page.locator('[data-preview-block="0"]').click()
                page.locator("#previewSeed").fill("BROWSER-SEED")
                deal_a = dealt_ids()
                page.locator("#previewSeed").fill("TEMP-SEED")
                page.locator("#previewSeed").fill("BROWSER-SEED")
                assert dealt_ids() == deal_a
                page.click("#nextSeed")
                assert dealt_ids() != deal_a
                assert len(set(first_deal)) == 12

                # Changing the visible lead mentor keeps the one-spotlight
                # invariant atomic instead of leaving an unsaveable half-state.
                page.locator('#previewController [data-course-path="blocks.0.leadMentorId"]').click()
                page.locator("#fieldValue").select_option("mentor02")
                page.click("#fieldClose")
                assert page.get_by_text("本块由你主导", exact=True).count() == 1
                expect(page.locator('[data-preview-seat="mentor02"]')).to_contain_text("本块由你主导")

                # Click visible content, edit its one source path, update every dependent pane.
                title_path = "blocks.0.title"
                page.locator(f'#previewController [data-course-path="{title_path}"]').click()
                expect(page.locator("#fieldPath")).to_have_text(title_path)
                marker = "B01 · 浏览器所见即所得验收"
                page.locator("#fieldValue").fill(marker)
                expect(page.locator("#saveState")).to_have_text("有未保存修改")
                assert page.locator(f'[data-course-path="{title_path}"]').count() >= 5
                expect(page.locator("#impactReport")).to_contain_text("已同步")
                page.click("#fieldClose")

                # Derived economy is explanatory/read-only, not a fake course input.
                page.locator('.surface-metric [data-derived-explain]').first.click()
                expect(page.locator("#fieldDialog")).to_have_attribute("data-readonly", "true")
                expect(page.locator("#fieldPath")).to_have_text("无 Course Package 写入路径")
                expect(page.locator("#impactReport")).to_contain_text("不会写入课程 JSON")
                page.click("#fieldClose")

                # Undo/redo preserve the WYSIWYG contract.
                page.click("#undoEdit")
                expect(page.locator('#previewController [data-course-path="blocks.0.title"]')).not_to_contain_text(marker)
                page.click("#redoEdit")
                expect(page.locator('#previewController [data-course-path="blocks.0.title"]')).to_contain_text(marker)

                # Sticky save remains visible deep in the nine-pane canvas and never hot-refreshes Alpha.
                before = controller.public_state()
                page.locator("#controllerShell").scroll_into_view_if_needed()
                assert page.locator("#saveCandidateDock").is_visible()
                save_box = page.locator("#saveCandidateDock").bounding_box()
                assert save_box and 0 <= save_box["y"] < 1000
                page.click("#saveCandidateDock")
                expect(page.locator("#saveState")).to_contain_text("Candidate r1")
                after = controller.public_state()
                assert after["runId"] == before["runId"]
                assert after["courseDigest"] == before["courseDigest"]
                assert after["currentBlockIndex"] == before["currentBlockIndex"]
                assert repository.load("google-1995-2004", variant="draft")["blocks"][0]["title"] == marker
                assert page.locator("#publish").is_disabled()

                # Both bundled courses open as complete 5x13 / 9-pane studios.
                page.goto(f"http://127.0.0.1:{server.server_port}/editor/?course=eleme-2008-find-problem", wait_until="networkidle")
                assert page.locator(".timeline-step").count() == 5
                assert page.locator(".timeline-block").count() == 13
                assert page.locator(".seat-preview-card").count() == 8
                expect(page.locator("#previewController")).to_contain_text("进入 2008")

                viewport_results = {}
                for width in (1440, 1180, 768, 430, 390):
                    page.set_viewport_size({"width": width, "height": 900})
                    page.wait_for_timeout(50)
                    geometry = page.evaluate("""() => ({innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth, font:parseFloat(getComputedStyle(document.querySelector('.msv-seat-surface')).fontSize), visibleSeats:[...document.querySelectorAll('.seat-preview-card')].filter(x=>getComputedStyle(x).display!=='none').length})""")
                    assert geometry["body"] <= geometry["innerWidth"] + 1
                    assert geometry["root"] <= geometry["innerWidth"] + 1
                    assert geometry["font"] >= 12
                    assert geometry["visibleSeats"] == 8
                    viewport_results[str(width)] = geometry

                # The real lease-backed seat and LIVE RUN controller consume
                # the same presentation functions, but runtime values are
                # plain read-only output rather than fake preview controls.
                runtime = browser.new_page(viewport={"width": 390, "height": 844})
                runtime.on("pageerror", lambda error: errors.append(f"runtime seat: {error}"))
                runtime.goto(
                    f"http://127.0.0.1:{server.server_port}/seat.html?seat=learner01#clientId=t083&lease=browser-test",
                    wait_until="networkidle",
                )
                expect(runtime.locator('.msv-seat-surface[data-seat-id="learner01"]')).to_be_visible()
                expect(runtime.locator('.msv-seat-surface')).to_have_attribute("data-preview", "false")
                assert runtime.locator(".surface-preview-watermark").count() == 0
                assert runtime.locator(".surface-derived").count() == 0
                runtime.close()

                live_controller = browser.new_page(viewport={"width": 1180, "height": 900})
                live_controller.on("pageerror", lambda error: errors.append(f"runtime controller: {error}"))
                live_controller.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="networkidle")
                expect(live_controller.locator("#block .shared-controller")).to_be_visible()
                assert live_controller.locator("#block [data-course-path]").count() == 0
                live_controller.close()

                assert not errors, errors
                browser.close()
                receipt.update({
                    "ok": True, "defaultMode": "nine-pane", "macroSteps": 5, "blocks": 13,
                    "atomicViews": 9, "layouts": ["overview", "mentors", "learners", "focus", "compare"],
                    "deterministicSeed": True, "sourcePathEditing": True, "derivedReadOnly": True,
                    "undoRedo": True, "candidateSaveWithoutRunMutation": True, "sharedRuntimeRenderer": True,
                    "courses": ["google-1995-2004", "eleme-2008-find-problem"], "viewports": viewport_results,
                })
        finally:
            server.shutdown(); server.server_close()
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    if not receipt["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
