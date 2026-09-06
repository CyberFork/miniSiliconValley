#!/usr/bin/env python3
"""Browser geometry regression for the Course Studio and shared UI switch."""
from __future__ import annotations

import json
import sys
import tempfile
import threading
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
                page.wait_for_selector("#deckCardList button")
                for width in VIEWPORTS:
                    page.set_viewport_size({"width": width, "height": 1000})
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
                    result["viewports"][str(width)] = {
                        "noOverflow": True,
                        "noRail": True,
                        "sameThemeGeometry": True,
                        "deckStacked": adventure["deckStacked"],
                    }
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
