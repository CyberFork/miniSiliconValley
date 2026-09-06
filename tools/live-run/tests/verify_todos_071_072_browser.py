#!/usr/bin/env python3
"""Headless browser acceptance for stage decks and Alpha explicit live sync."""
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
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        repository = CourseRepository(root / "courses")
        controller = CourseController(root / "run-state.json", course_repository=repository)
        server = LiveRunServer(("127.0.0.1", 0), controller, "browser-acceptance-token")
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}/"
        receipt: dict[str, object] = {"ok": False, "base": base}
        try:
            with sync_playwright() as playwright:
                launch = {"headless": True}
                if CHROME.exists(): launch["executable_path"] = str(CHROME)
                browser = playwright.chromium.launch(**launch)
                editor = browser.new_page(viewport={"width": 1440, "height": 1050})
                editor.goto(base + "editor/")
                editor.wait_for_selector("#cardsTab")
                editor.click("#cardsTab")
                editor.wait_for_selector("#deckCardList button")
                assert editor.locator("#deckCardList button").count() == 60
                expect(editor.locator("#deckSummary")).to_contain_text("4 人每人 3 张")
                editor.click("#simulateDeal")
                assert editor.locator(".deal-hands > section").count() == 4
                expect(editor.locator("#dealPreview")).to_contain_text("12 张全部不重复")

                editor.locator('[data-path="decks.0.cards.0.body"]').fill("浏览器验收：同一张卡热刷新后的正文。")
                editor.click("#saveDraft")
                expect(editor.locator("#saveState")).to_contain_text("草稿 r1")
                expect(editor.locator("#alphaSync")).to_contain_text("有新内容待主动刷新")
                run_before = controller.public_state()["runId"]
                editor.click("#refreshAlpha")
                expect(editor.locator("#alphaSync")).to_contain_text("版本一致")
                assert controller.public_state()["runId"] == run_before

                control = browser.new_page(viewport={"width": 1280, "height": 900})
                control.goto(base)
                control.wait_for_selector("#versionPanel")
                expect(control.locator("#versionPanel")).to_contain_text("已一致")
                control.click("#execute")
                expect(control.locator("#runStatus")).to_contain_text("待人工验收")
                state = controller.public_state()
                assert state["classroom"]["cardsPerLearner"] == [3, 3, 3, 3]
                assert state["classroom"]["uniqueDealtCards"] == 12
                assert all(seat["courseRevision"] == 1 for seat in state["seats"])
                control.click("#accept")
                expect(control.locator("[data-testid=current-block]")).to_contain_text("B02")
                control.click("#previewBack")
                expect(control.locator("[data-testid=current-block]")).to_contain_text("调试回看")
                state = controller.public_state()
                assert state["currentBlockIndex"] == 1 and state["previewBlockIndex"] == 0
                assert all(seat["isPreview"] and seat["blockId"] == "B01" for seat in state["seats"])
                control.click("#previewForward")
                expect(control.locator("[data-testid=current-block]")).not_to_contain_text("调试回看")
                browser.close()
                receipt.update({
                    "ok": True, "courseRevision": state["courseRevision"],
                    "refreshEpoch": state["refreshEpoch"], "runPreserved": True,
                    "decks": 5, "cards": 60, "deal": "4x3 unique",
                    "previewDoesNotMoveExecution": True,
                })
        finally:
            server.shutdown(); server.server_close()
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
        if not receipt["ok"]: raise SystemExit(1)


if __name__ == "__main__":
    main()
