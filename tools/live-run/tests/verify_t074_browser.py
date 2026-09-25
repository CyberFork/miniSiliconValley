#!/usr/bin/env python3
"""End-to-end browser acceptance for T-074 Alpha card authoring."""
from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController, LiveRunServer  # noqa: E402
from course import CourseRepository  # noqa: E402

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
COURSE_ID = "eleme-2008-find-problem"


def wait_until(predicate, timeout: float = 6.0) -> None:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError("condition did not become true")


def learner_card(state: dict, card_id: str) -> tuple[str, dict]:
    for seat_id, view in state["classroom"].get("learnerViews", {}).items():
        for card in view.get("cards", []):
            if card["id"] == card_id:
                return seat_id, card
    raise AssertionError(f"dealt card not projected: {card_id}")


def main() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        repository = CourseRepository(root / "courses")
        controller = CourseController(root / "run-state.json", course_repository=repository)
        controller.select_course(COURSE_ID, confirm_reset=True)
        server = LiveRunServer(("127.0.0.1", 0), controller, "t074-browser-token")
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}/"
        receipt: dict[str, object] = {"ok": False, "courseId": COURSE_ID}
        try:
            with sync_playwright() as playwright:
                launch: dict[str, object] = {"headless": True}
                if CHROME.exists():
                    launch["executable_path"] = str(CHROME)
                browser = playwright.chromium.launch(**launch)
                editor = browser.new_page(viewport={"width": 1600, "height": 1050})
                editor.goto(base + "editor/", wait_until="networkidle")
                expect(editor.locator("#packageHealth")).to_contain_text("5/5")
                expect(editor.locator("#packageHealth")).to_contain_text("60")
                expect(editor.locator("#packageHealth")).to_contain_text("完整课程包")
                editor.click("#cardsTab")
                editor.wait_for_selector("#deckCardList button")
                expect(editor.locator("#cardResultCount")).to_have_text("60 / 60 张卡")

                specified = (
                    ("亲自送餐", "e08-c-05", "F 有来源", "创始成员亲自送餐"),
                    ("电话和餐厅信息", "e08-f-02", "F 有来源", "电话和餐厅信息是早期入口"),
                    ("排路线", "e08-r-04", "R 课堂模拟", "多张订单需要排路线"),
                )
                for query, card_id, label, clean_title in specified:
                    editor.locator("#cardSearch").fill(query)
                    expect(editor.locator("#deckCardList")).to_contain_text(card_id)
                    editor.locator(f'#deckCardList [data-card-id="{card_id}"]').click()
                    preview = editor.locator("#learnerCardPreview")
                    expect(preview).to_contain_text(label)
                    expect(preview).to_contain_text(clean_title)
                    expect(preview).not_to_contain_text("C-05 ·")
                    expect(preview).not_to_contain_text("F-02 ·")
                    expect(preview).not_to_contain_text("R-04 ·")
                expect(editor.locator("#learnerSourcePreview")).to_contain_text("不是史实")

                editor.locator("#cardSearch").fill("")
                editor.locator("#cardBoundaryFilter").select_option("R")
                assert editor.locator("#deckCardList button").count() == 16
                editor.click("#resetCardFilters")
                assert editor.locator("#deckCardList button").count() == 60

                control = browser.new_page(viewport={"width": 1280, "height": 900})
                control.goto(base, wait_until="networkidle")
                control.click("#execute")
                expect(control.locator("#runStatus")).to_contain_text("待人工验收")
                wait_until(lambda: len(controller.public_state().get("courseDeals", {}).get("find", {})) == 4)
                editor.wait_for_timeout(2200)
                expect(editor.locator("#alphaHands")).to_contain_text("稳定 ID 12/12")
                assert editor.locator("#alphaHands [data-hand-card]").count() == 12

                hand_button = editor.locator("#alphaHands [data-hand-card]").first
                card_id = hand_button.get_attribute("data-hand-card")
                hand_button.click()
                body = editor.locator('#deckCardForm textarea[data-path$=".body"]')
                original = body.input_value()
                marker = "【T074 浏览器同步验收】"
                before = controller.public_state()
                before_snapshot = {
                    "runId": before["runId"],
                    "currentBlockIndex": before["currentBlockIndex"],
                    "courseDeals": before["courseDeals"],
                    "teamTreasuryTenths": before["classroom"].get("teamTreasuryTenths"),
                    "courseRevision": before["courseRevision"],
                }
                body.fill(original + marker)
                editor.click("#saveDraft")
                expect(editor.locator("#saveState")).to_contain_text("Candidate r1")
                expect(editor.locator("#alphaSync")).to_contain_text("待主动加载")
                saved_not_live = controller.public_state()
                assert saved_not_live["courseRevision"] == before_snapshot["courseRevision"]
                assert marker not in learner_card(saved_not_live, card_id)[1]["body"]

                editor.click("#refreshAlpha")
                wait_until(lambda: controller.public_state()["courseRevision"] == 1)
                refreshed = controller.public_state()
                assert refreshed["runId"] == before_snapshot["runId"]
                assert refreshed["currentBlockIndex"] == before_snapshot["currentBlockIndex"]
                assert refreshed["courseDeals"] == before_snapshot["courseDeals"]
                assert refreshed["classroom"].get("teamTreasuryTenths") == before_snapshot["teamTreasuryTenths"]
                assert marker in learner_card(refreshed, card_id)[1]["body"]

                editor.click("#historyButton")
                editor.wait_for_selector('#historyList [data-restore-revision="0"]')
                restore = editor.locator('#historyList [data-restore-revision="0"]')
                restore.click(); restore.click()
                expect(editor.locator("#saveState")).to_contain_text("Candidate r2")
                assert controller.public_state()["courseRevision"] == 1
                editor.click("#refreshAlpha")
                wait_until(lambda: controller.public_state()["courseRevision"] == 2)
                rolled_back = controller.public_state()
                assert rolled_back["runId"] == before_snapshot["runId"]
                assert rolled_back["currentBlockIndex"] == before_snapshot["currentBlockIndex"]
                assert rolled_back["courseDeals"] == before_snapshot["courseDeals"]
                assert marker not in learner_card(rolled_back, card_id)[1]["body"]
                assert learner_card(rolled_back, card_id)[1]["body"] == original

                editor.set_viewport_size({"width": 390, "height": 844})
                editor.click("#cardsTab")
                editor.locator("#cardSearch").fill("亲自送餐")
                editor.locator('#deckCardList [data-card-id="e08-c-05"]').click()
                mobile = editor.evaluate("""() => ({innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth, preview: !!document.querySelector('#learnerCardPreview .private-card')})""")
                assert mobile["body"] <= mobile["innerWidth"] + 1
                assert mobile["root"] <= mobile["innerWidth"] + 1
                assert mobile["preview"] is True

                browser.close()
                receipt.update({
                    "ok": True,
                    "specifiedCards": [item[1] for item in specified],
                    "fullTextSearch": True,
                    "boundaryFilter": True,
                    "learnerEquivalentPreview": True,
                    "alphaHands": "4x3 stable IDs",
                    "savedWithoutSilentRefresh": True,
                    "explicitRefreshPreservedRun": True,
                    "historyRollbackAsNewRevision": True,
                    "finalRevision": rolled_back["courseRevision"],
                    "refreshEpoch": rolled_back["refreshEpoch"],
                    "mobileNoOverflow": True,
                })
        finally:
            server.shutdown(); server.server_close()
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
        if not receipt["ok"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
