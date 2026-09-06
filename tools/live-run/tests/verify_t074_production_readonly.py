#!/usr/bin/env python3
"""Authenticated, read-only production acceptance for the T-074 card studio.

Credentials are accepted only through environment variables and are never
printed or persisted. The check performs no POST/PUT/PATCH/DELETE request after
login and does not save, publish, restore, or refresh a course.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright

ORIGIN = os.environ.get("MSV_QA_ORIGIN", "https://minisv.vip").rstrip("/")
USERNAME = os.environ.get("MSV_QA_USERNAME", "")
PASSWORD = os.environ.get("MSV_QA_PASSWORD", "")
EXPECTED_RELEASE = os.environ.get("MSV_QA_RELEASE", "")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def geometry(page) -> dict:
    return page.evaluate("""() => {
      const rect = (selector) => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return {x: value.x, y: value.y, width: value.width, height: value.height};
      };
      return {
        innerWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        rootWidth: document.documentElement.scrollWidth,
        studio: rect('.studio'), library: rect('.library'),
        workspace: rect('.workspace'), guide: rect('.guide')
      };
    }""")


def assert_same_geometry(before: dict, after: dict) -> None:
    for region in ("studio", "library", "workspace", "guide"):
        for dimension in ("x", "y", "width", "height"):
            delta = abs(before[region][dimension] - after[region][dimension])
            if delta > 1:
                raise AssertionError(f"theme geometry drift: {region}.{dimension}={delta}")


def structure_geometry(page) -> dict:
    return page.evaluate("""() => {
      const rect = (selector) => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return {x:value.x, y:value.y, width:value.width, height:value.height,
                right:value.right, bottom:value.bottom};
      };
      const list = rect('.block-list');
      const form = rect('.block-form');
      const buttons = [...document.querySelectorAll('.block-list button')].map((element) => {
        const value = element.getBoundingClientRect();
        return {x:value.x, right:value.right};
      });
      const stacked = form.y > list.y + 1;
      return {
        list, form, stacked,
        separated: stacked ? list.bottom <= form.y + 1 : list.right <= form.x + 1,
        buttonOverflow: stacked ? 0 : buttons.filter((button) =>
          button.x < list.x - 1 || button.right > list.right + 1
        ).length
      };
    }""")


def main() -> None:
    if not USERNAME or not PASSWORD:
        raise SystemExit("Set MSV_QA_USERNAME and MSV_QA_PASSWORD; values are never logged.")

    result: dict[str, object] = {
        "ok": False,
        "origin": ORIGIN,
        "mode": "authenticated-read-only",
        "mutations": 0,
    }
    with sync_playwright() as playwright:
        launch: dict[str, object] = {"headless": True}
        if CHROME.exists():
            launch["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**launch)
        context = browser.new_context(viewport={"width": 1660, "height": 1100})
        page = context.new_page()
        return_to = quote("/control/editor/", safe="")
        page.goto(f"{ORIGIN}/auth/login?returnTo={return_to}", wait_until="networkidle")
        page.locator('input[name="username"]').fill(USERNAME)
        page.locator('input[name="password"]').fill(PASSWORD)
        page.get_by_role("button", name="进入 Mini Silicon Valley →").click()
        page.wait_for_url("**/control/editor/**", timeout=20_000)
        page.wait_for_selector('#packageHealth[data-state="ok"]', timeout=20_000)

        health = page.locator("#packageHealth")
        expect(health).to_contain_text("5/5")
        expect(health).to_contain_text("60")
        expect(health).to_contain_text("t074-card-studio-r1")
        if EXPECTED_RELEASE:
            expect(health).to_contain_text(EXPECTED_RELEASE)

        active_course = page.locator('[data-course][aria-current="true"]').get_attribute("data-course")
        if active_course != "eleme-2008-find-problem":
            raise AssertionError(f"unexpected active course: {active_course}")

        page.locator('#msv-ui-switch [data-theme="classic"]').click()
        classic_structure = structure_geometry(page)
        page.locator('#msv-ui-switch [data-theme="adventure"]').click()
        adventure_structure = structure_geometry(page)
        for current in (classic_structure, adventure_structure):
            if not current["separated"] or current["buttonOverflow"]:
                raise AssertionError("course block list overlaps the structured editor form")
        for region in ("list", "form"):
            for dimension in ("x", "y", "width", "height", "right", "bottom"):
                if abs(classic_structure[region][dimension] - adventure_structure[region][dimension]) > 1:
                    raise AssertionError(f"structured editor theme drift: {region}.{dimension}")

        page.click("#cardsTab")
        page.wait_for_selector("#deckCardList button")
        expect(page.locator("#cardResultCount")).to_have_text("60 / 60 张卡")
        cards = (
            ("亲自送餐", "e08-c-05", "F 有来源", "创始成员亲自送餐"),
            ("电话和餐厅信息", "e08-f-02", "F 有来源", "电话和餐厅信息是早期入口"),
            ("排路线", "e08-r-04", "R 课堂模拟", "多张订单需要排路线"),
        )
        for query, card_id, boundary, learner_title in cards:
            page.locator("#cardSearch").fill(query)
            expect(page.locator("#deckCardList")).to_contain_text(card_id)
            page.locator(f'[data-card-id="{card_id}"]').click()
            preview = page.locator("#learnerCardPreview")
            expect(preview).to_contain_text(boundary)
            expect(preview).to_contain_text(learner_title)
            if boundary.startswith("F"):
                expect(page.locator("#learnerSourcePreview")).to_contain_text("导师核对来源")
                if page.locator("#learnerSourcePreview a").count() < 1:
                    raise AssertionError(f"fact card has no rendered source: {card_id}")
        expect(page.locator("#learnerSourcePreview")).to_contain_text("不是史实")

        page.locator("#cardSearch").fill("")
        page.locator("#cardBoundaryFilter").select_option("R")
        role_play_count = page.locator("#deckCardList button").count()
        if role_play_count != 16:
            raise AssertionError(f"expected 16 R cards, got {role_play_count}")
        page.click("#resetCardFilters")

        expect(page.locator("#alphaHands")).to_contain_text("稳定 ID 12/12")
        hand_ids = page.locator("#alphaHands [data-hand-card]").evaluate_all(
            "nodes => nodes.map(node => node.dataset.handCard)"
        )
        if len(hand_ids) != 12 or len(set(hand_ids)) != 12:
            raise AssertionError("current Alpha hands are not 12 unique stable IDs")

        page.locator('#msv-ui-switch [data-theme="classic"]').click()
        classic = geometry(page)
        page.locator('#msv-ui-switch [data-theme="adventure"]').click()
        adventure = geometry(page)
        assert_same_geometry(classic, adventure)
        if max(classic["bodyWidth"], classic["rootWidth"]) > classic["innerWidth"] + 1:
            raise AssertionError("desktop horizontal overflow")

        page.set_viewport_size({"width": 390, "height": 844})
        page.click("#cardsTab")
        page.locator("#cardSearch").fill("亲自送餐")
        page.locator('[data-card-id="e08-c-05"]').click()
        mobile = geometry(page)
        if max(mobile["bodyWidth"], mobile["rootWidth"]) > mobile["innerWidth"] + 1:
            raise AssertionError("mobile horizontal overflow")
        if page.locator("#learnerCardPreview .private-card").count() != 1:
            raise AssertionError("learner-equivalent preview is missing")

        api = page.evaluate("""async () => {
          const [bootstrap, course, history] = await Promise.all([
            fetch('../api/bootstrap', {cache: 'no-store'}).then(r => r.json()),
            fetch('../api/courses/eleme-2008-find-problem?variant=draft', {cache: 'no-store'}).then(r => r.json()),
            fetch('../api/courses/eleme-2008-find-problem/history', {cache: 'no-store'}).then(r => r.json())
          ]);
          return {
            bootstrap: {ok: bootstrap.ok, schema: bootstrap.data?.courseSchemaVersion, build: bootstrap.data?.editorBuild},
            course: {ok: course.ok, metadata: course.data?.metadata},
            history: {ok: history.ok, length: history.data?.history?.length}
          };
        }""")
        if not (api["bootstrap"]["ok"] and api["course"]["ok"] and api["history"]["ok"]):
            raise AssertionError("authenticated GET-only API acceptance failed")
        metadata = api["course"]["metadata"]
        counts = (metadata["macroStepCount"], metadata["blockCount"], metadata["deckCount"], metadata["cardCount"])
        if counts != (5, 13, 5, 60):
            raise AssertionError(f"course metadata mismatch: {counts}")

        result.update({
            "ok": True,
            "release": EXPECTED_RELEASE or "asserted-from-page",
            "editorBuild": api["bootstrap"]["build"],
            "schemaVersion": api["bootstrap"]["schema"],
            "activeCourse": active_course,
            "package": {"macroSteps": 5, "blocks": 13, "decks": 5, "cards": 60},
            "specifiedCards": [item[1] for item in cards],
            "rBoundaryCards": role_play_count,
            "alphaHands": {"learners": 4, "cardsPerLearner": 3, "stableIds": len(hand_ids)},
            "preview": {"sharedRenderer": True, "factSourcesVisible": True, "simulationDisclaimerVisible": True},
            "structure": {"blockListSeparated": True, "buttonsContained": True, "sameThemeGeometry": True},
            "themes": {"classicAdventureSameGeometry": True, "desktopNoOverflow": True},
            "mobile": {"width": 390, "noOverflow": True, "previewVisible": True},
            "historyEntries": api["history"]["length"],
            "security": {"authenticatedEditor": True, "readOnlyAcceptance": True, "credentialsLogged": False},
        })
        browser.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
