#!/usr/bin/env python3
"""Browser geometry regression for the Course Studio and shared UI switch."""
from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController, LiveRunServer  # noqa: E402
from course import CourseRepository  # noqa: E402

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
VIEWPORTS = (1660, 1366, 1100, 900, 768, 430)


def snapshot(page) -> dict:
    return page.evaluate(
        """() => {
          const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const value = element.getBoundingClientRect();
            return {x:value.x, y:value.y, width:value.width, height:value.height,
                    right:value.right, bottom:value.bottom};
          };
          const overflowing = [...document.body.querySelectorAll(
            '.studio,.studio>.panel,.deck-studio,.deck-layout,.deck-card-form,.block-layout,.block-form,.form-section'
          )]
            .filter((element) => {
              const value = element.getBoundingClientRect();
              return value.right > innerWidth + 1 || value.left < -1;
            })
            .map((element) => element.id || element.className || element.tagName)
            .slice(0, 12);
          const deckList = rect('.deck-card-list');
          const deckForm = rect('.deck-card-form');
          return {
            innerWidth,
            bodyScrollWidth: document.body.scrollWidth,
            rootScrollWidth: document.documentElement.scrollWidth,
            dock: document.documentElement.dataset.msvUiDock || null,
            railCount: document.querySelectorAll('.msv-ui-switch-rail').length,
            switchPlacement: document.querySelector('#msv-ui-switch')?.dataset.placement,
            topbarMarginBottom: getComputedStyle(document.querySelector('.topbar')).marginBottom,
            emptyStateDisplay: getComputedStyle(document.querySelector('#emptyState')).display,
            studio: rect('.studio'), library: rect('.library'), workspace: rect('.workspace'),
            guide: rect('.guide'), deckList, deckForm,
            deckStacked: Boolean(deckList && deckForm && deckList.bottom <= deckForm.y + 1),
            overflowing,
          };
        }"""
    )


def same_geometry(first: dict, second: dict) -> bool:
    for selector in ("studio", "library", "workspace", "guide"):
        for key in ("x", "y", "width", "height", "right", "bottom"):
            if abs(first[selector][key] - second[selector][key]) > 0.25:
                return False
    return True


def structure_snapshot(page) -> dict:
    return page.evaluate(
        """() => {
          const rect = (selector) => {
            const value = document.querySelector(selector).getBoundingClientRect();
            return {x:value.x, y:value.y, width:value.width, height:value.height,
                    right:value.right, bottom:value.bottom};
          };
          const layout = rect('.block-layout');
          const list = rect('.block-list');
          const form = rect('.block-form');
          const buttons = [...document.querySelectorAll('.block-list button')].map((element) => {
            const value = element.getBoundingClientRect();
            return {x:value.x, y:value.y, right:value.right, bottom:value.bottom, width:value.width};
          });
          const stacked = form.y > list.y + 1;
          const buttonOverflow = stacked ? [] : buttons.filter((button) =>
            button.x < list.x - 1 || button.right > list.right + 1
          );
          return {
            innerWidth, bodyScrollWidth:document.body.scrollWidth,
            rootScrollWidth:document.documentElement.scrollWidth,
            workspace:rect('.workspace'), layout, list, form, buttons,
            stacked, buttonOverflow,
            separated: stacked ? list.bottom <= form.y + 1 : list.right <= form.x + 1,
          };
        }"""
    )


def same_structure_geometry(first: dict, second: dict) -> bool:
    for selector in ("workspace", "layout", "list", "form"):
        for key in ("x", "y", "width", "height", "right", "bottom"):
            if abs(first[selector][key] - second[selector][key]) > 0.25:
                return False
    return first["stacked"] == second["stacked"]


def editor_identity(page) -> dict:
    """State that a layout-only disclosure must never mutate."""
    return page.evaluate(
        """() => ({
          course: document.querySelector('[data-course][aria-current="true"]')?.dataset.course || null,
          revision: document.querySelector('#revisionLine')?.textContent || '',
          saveState: document.querySelector('#saveState')?.dataset.state || '',
          search: document.querySelector('#cardSearch')?.value || '',
          selectedCard: document.querySelector('#deckCardList [aria-current="true"]')?.dataset.cardId || null,
        })"""
    )


def library_snapshot(page) -> dict:
    return page.evaluate(
        """() => {
          const library = document.querySelector('#courseLibrary');
          const workspace = document.querySelector('.workspace');
          const backdrop = document.querySelector('#libraryBackdrop');
          const style = getComputedStyle(library);
          const bodyStyle = getComputedStyle(document.body);
          const rect = library.getBoundingClientRect();
          return {
            collapsed: document.body.classList.contains('library-collapsed'),
            drawerOpen: document.body.classList.contains('library-drawer-open'),
            libraryDisplay: style.display,
            libraryPosition: style.position,
            libraryWidth: rect.width,
            workspaceWidth: workspace.getBoundingClientRect().width,
            backdropHidden: backdrop.hidden,
            bodyOverflow: bodyStyle.overflow,
            courseListCount: document.querySelectorAll('#courseList').length,
            expanded: document.querySelector('#topbarLibrary').getAttribute('aria-expanded'),
          };
        }"""
    )


def wait_js(page, expression: str, *, timeout: float = 5.0) -> None:
    """Poll through CDP without Playwright's eval-based wait helper.

    The production controller deliberately omits ``unsafe-eval`` from CSP, so
    ``page.wait_for_function`` is expected to be blocked.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate(f"() => Boolean({expression})"):
            return
        time.sleep(0.04)
    raise AssertionError(f"browser condition timed out: {expression}")


def main() -> None:
    result: dict[str, object] = {"ok": False, "viewports": {}}
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        repository = CourseRepository(root / "courses")
        controller = CourseController(root / "run-state.json", course_repository=repository)
        server = LiveRunServer(("127.0.0.1", 0), controller, "layout-browser-token")
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                launch: dict[str, object] = {"headless": True}
                if CHROME.exists():
                    launch["executable_path"] = str(CHROME)
                browser = playwright.chromium.launch(**launch)
                page = browser.new_page(viewport={"width": VIEWPORTS[0], "height": 1000})
                page.goto(f"http://127.0.0.1:{server.server_port}/editor/", wait_until="networkidle")
                page.wait_for_selector("#cardsTab")

                # Begin from the documented adaptive default, independent of a
                # developer's persistent browser preference.
                page.evaluate("localStorage.removeItem('minisv.course-editor.library-collapsed')")
                page.reload(wait_until="networkidle")
                page.wait_for_selector("#editor:not([hidden])")

                # T-079 desktop: collapse the *real* course library to a 58px
                # rail.  It must yield space to the editor and preserve every
                # piece of authoring context across both toggle and reload.
                expanded_library = library_snapshot(page)
                expanded_identity = editor_identity(page)
                assert not expanded_library["collapsed"]
                page.click("#closeLibrary")
                wait_js(page, "document.body.classList.contains('library-collapsed')")
                collapsed_library = library_snapshot(page)
                assert 46 <= collapsed_library["libraryWidth"] <= 70
                assert collapsed_library["workspaceWidth"] > expanded_library["workspaceWidth"]
                assert editor_identity(page) == expanded_identity
                assert page.evaluate("localStorage.getItem('minisv.course-editor.library-collapsed')") == "true"
                page.reload(wait_until="networkidle")
                page.wait_for_selector("#editor:not([hidden])")
                assert library_snapshot(page)["collapsed"], "desktop disclosure preference must survive reload"
                assert editor_identity(page)["course"] == expanded_identity["course"]
                page.click("#openLibrary")
                wait_js(page, "!document.body.classList.contains('library-collapsed')")

                # T-080: fail closed without discarding typed content, then
                # save the whole Course Package as a new immutable Candidate.
                # Merely saving must not refresh or move the running Alpha.
                page.click("#cardsTab")
                page.wait_for_selector("#deckCardForm textarea[data-path$='.body']")
                body_field = page.locator("#deckCardForm textarea[data-path$='.body']").first
                original_body = body_field.input_value()
                changed_body = original_body + "【浏览器保存验收】"
                alpha_before = page.evaluate("async () => (await (await fetch('../api/state', {cache:'no-store'})).json()).data")
                body_field.fill(changed_body)
                wait_js(page, "document.querySelector('#saveState')?.dataset.state === 'dirty'")
                page.route(
                    "**/api/courses/save",
                    lambda route: route.fulfill(
                        status=409,
                        content_type="application/json",
                        body=json.dumps({"ok": False, "error": {"code": "REVISION_CONFLICT", "message": "课程已被其他人更新；请重新载入或重试。"}}, ensure_ascii=False),
                    ),
                )
                page.locator("#saveCardContext").scroll_into_view_if_needed()
                save_box = page.locator("#saveCardContext").bounding_box()
                assert save_box and 0 <= save_box["y"] < 1000 and save_box["y"] + save_box["height"] <= 1001
                page.click("#saveCardContext")
                wait_js(page, "document.querySelector('.card-context-save')?.dataset.state === 'error'")
                assert body_field.input_value() == changed_body
                assert "重新载入" in page.locator("#cardSaveMeta").inner_text()
                page.unroute("**/api/courses/save")
                page.click("#saveCardContext")
                wait_js(page, "document.querySelector('#saveState')?.dataset.state === 'saved' && /Candidate r1/.test(document.querySelector('#saveState')?.textContent || '')")
                alpha_after = page.evaluate("async () => (await (await fetch('../api/state', {cache:'no-store'})).json()).data")
                for key in ("runId", "currentBlock", "courseRevision", "courseDigest", "refreshEpoch"):
                    assert alpha_after.get(key) == alpha_before.get(key), f"Candidate save changed Alpha {key}"
                page.reload(wait_until="networkidle")
                page.wait_for_selector("#editor:not([hidden])")
                page.click("#cardsTab")
                page.wait_for_selector("#deckCardForm textarea[data-path$='.body']")
                assert page.locator("#deckCardForm textarea[data-path$='.body']").first.input_value() == changed_body

                result["courseLibrary"] = {
                    "desktopRail": True,
                    "preferencePersists": True,
                    "singleCourseList": True,
                }
                result["cardSave"] = {
                    "stickyActionVisible": True,
                    "failureKeepsInput": True,
                    "reloadKeepsCandidate": True,
                    "alphaUnchanged": True,
                }

                page.click("#structuredTab")

                # The structure pane has its own nested grid. A nowrap block
                # title previously forced buttons beyond the 170px track and
                # painted them over the form without increasing body scrollWidth.
                for width in VIEWPORTS:
                    page.set_viewport_size({"width": width, "height": 1000})
                    if width <= 1040 and not library_snapshot(page)["collapsed"]:
                        page.click("#closeLibrary")
                    page.locator("#msv-ui-switch [data-theme=classic]").click()
                    page.wait_for_timeout(40)
                    classic_structure = structure_snapshot(page)
                    page.locator("#msv-ui-switch [data-theme=adventure]").click()
                    page.wait_for_timeout(40)
                    adventure_structure = structure_snapshot(page)
                    for current in (classic_structure, adventure_structure):
                        assert current["bodyScrollWidth"] <= current["innerWidth"] + 1
                        assert current["rootScrollWidth"] <= current["innerWidth"] + 1
                        assert current["layout"]["right"] <= current["innerWidth"] + 1
                        assert current["form"]["right"] <= current["layout"]["right"] + 1
                        assert current["separated"], f"block list overlaps form at {width}px"
                        assert not current["buttonOverflow"], f"block button escapes track at {width}px"
                    assert same_structure_geometry(classic_structure, adventure_structure)
                    if adventure_structure["workspace"]["width"] <= 780:
                        assert adventure_structure["stacked"], f"structure controls must stack at {width}px"
                    result["viewports"].setdefault(str(width), {}).update({
                        "structureNoOverlap": True,
                        "structureStacked": adventure_structure["stacked"],
                    })

                if not library_snapshot(page)["collapsed"]:
                    page.click("#closeLibrary")
                page.click("#cardsTab")
                page.wait_for_selector("#deckCardList button")
                for width in VIEWPORTS:
                    page.set_viewport_size({"width": width, "height": 1000})
                    if width <= 1040 and not library_snapshot(page)["collapsed"]:
                        page.click("#closeLibrary")
                    page.locator("#msv-ui-switch [data-theme=classic]").click()
                    page.wait_for_timeout(40)
                    classic = snapshot(page)
                    page.locator("#msv-ui-switch [data-theme=adventure]").click()
                    page.wait_for_timeout(40)
                    adventure = snapshot(page)
                    for current in (classic, adventure):
                        assert current["railCount"] == 0
                        assert current["dock"] is None
                        assert current["switchPlacement"] == "inline"
                        assert current["topbarMarginBottom"] == "0px"
                        assert current["emptyStateDisplay"] == "none"
                        assert current["bodyScrollWidth"] <= current["innerWidth"] + 1
                        assert current["rootScrollWidth"] <= current["innerWidth"] + 1
                        assert current["studio"]["right"] <= current["innerWidth"] + 1
                        assert not current["overflowing"], current["overflowing"]
                    assert same_geometry(classic, adventure)
                    if adventure["workspace"]["width"] <= 780:
                        assert adventure["deckStacked"], f"deck controls must stack at {width}px"
                    result["viewports"][str(width)].update({
                        "noOverflow": True,
                        "noRail": True,
                        "sameThemeGeometry": True,
                        "deckStacked": adventure["deckStacked"],
                    })

                # T-079 tablet/phone: the same course-list becomes a modal
                # drawer with a backdrop. Escape closes it and returns focus
                # to the trigger; course/card/search context is unchanged.
                page.fill("#cardSearch", "线索")
                drawer_identity = editor_identity(page)
                for width in (900, 768, 430):
                    page.set_viewport_size({"width": width, "height": 900})
                    if not library_snapshot(page)["collapsed"]:
                        page.click("#closeLibrary")
                    page.click("#topbarLibrary")
                    wait_js(page, "document.body.classList.contains('library-drawer-open')")
                    opened = library_snapshot(page)
                    assert opened["libraryPosition"] == "fixed"
                    assert not opened["backdropHidden"]
                    assert opened["courseListCount"] == 1
                    assert opened["bodyOverflow"] == "hidden"
                    assert opened["libraryWidth"] <= width * 0.89
                    assert editor_identity(page) == drawer_identity
                    page.keyboard.press("Escape")
                    wait_js(page, "document.body.classList.contains('library-collapsed')")
                    page.wait_for_timeout(40)
                    assert page.evaluate("document.activeElement?.id") == "topbarLibrary"
                    assert editor_identity(page) == drawer_identity
                    result["viewports"][str(width)]["libraryDrawer"] = True
                browser.close()
                result["ok"] = True
        finally:
            server.shutdown()
            server.server_close()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
