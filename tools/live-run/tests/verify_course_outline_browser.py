#!/usr/bin/env python3
"""Browser acceptance for the stable T-077 course-outline route."""
from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


VIEWPORTS = (
    (390, 844),
    (430, 932),
    (768, 1024),
    (1440, 1000),
)
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def assert_outline(page, width: int) -> None:
    page.wait_for_selector('[data-course-outline-schema="1"]')
    assert page.locator('nav[aria-label="Mini Silicon Valley 主导航"] a[aria-current="page"]').inner_text() == "课程大纲"
    assert page.locator('[data-testid="course-map-stage"] [data-step-id]').count() == 5
    assert page.locator('[data-course-steps="5"][data-course-blocks="13"][data-course-decks="5"]').count() == 1
    assert page.locator('img[alt*="五个步骤"]').evaluate("image => image.complete && image.naturalWidth > 0")

    metrics = page.evaluate("""() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stage: (() => {
        const rect = document.querySelector('[data-testid="course-map-stage"]').getBoundingClientRect();
        return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height};
      })(),
      nodes: Array.from(document.querySelectorAll('[data-testid="course-map-stage"] [data-step-id]')).map(node => {
        const rect = node.getBoundingClientRect();
        return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom};
      }),
    })""")
    assert metrics["scrollWidth"] <= metrics["innerWidth"] + 1, f"{width}px has horizontal overflow: {metrics}"
    expected_ratio = 1671 / 941
    actual_ratio = metrics["stage"]["width"] / metrics["stage"]["height"]
    assert abs(actual_ratio - expected_ratio) < 0.03, (width, actual_ratio)
    for node in metrics["nodes"]:
        assert node["left"] >= metrics["stage"]["left"] - 1
        assert node["right"] <= metrics["stage"]["right"] + 1
        assert node["top"] >= metrics["stage"]["top"] - 1
        assert node["bottom"] <= metrics["stage"]["bottom"] + 1


def run(base: str) -> None:
    with sync_playwright() as playwright:
        launch: dict[str, object] = {"headless": True}
        if CHROME.exists():
            launch["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**launch)
        for width, height in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
            failures: list[str] = []
            page.on("pageerror", lambda error: failures.append(f"pageerror: {error}"))
            response = page.goto(base, wait_until="networkidle")
            assert response and response.ok, (base, response.status if response else None)
            assert_outline(page, width)

            google = page.get_by_role("button", name="02 · 1995—2004 Google")
            google.click()
            page.wait_for_url("**#course=google-1995-2004**")
            assert page.locator('[data-course-id="google-1995-2004"]').count() == 1

            page.locator('[data-step-id="build"]').click()
            page.wait_for_url("**step=build**")
            assert "B06" in page.url
            page.get_by_role("button", name="B07").click()
            page.wait_for_url("**block=B07")
            assert page.locator('[data-block-id="B07"]').count() == 1
            page.reload(wait_until="networkidle")
            assert "block=B07" in page.url
            assert page.locator('[data-block-id="B07"]').count() == 1
            page.go_back(wait_until="networkidle")
            assert "block=B06" in page.url
            assert page.locator('[data-block-id="B06"]').count() == 1

            page.goto(f"{base}#course=google-1995-2004&step=market&block=B09", wait_until="networkidle")
            assert page.locator('[data-course-id="google-1995-2004"][data-course-steps="5"]').count() == 1
            assert page.locator('[data-block-id="B09"]').count() == 1
            assert not failures, failures
            page.close()

        target = urlsplit(base)
        origin = f"{target.scheme}://{target.netloc}"
        for width in (390, 1440):
            for path in ("/", "/world/", "/course/", "/framework/", "/parents/"):
                page = browser.new_page(viewport={"width": width, "height": 900}, reduced_motion="reduce")
                failures: list[str] = []
                page.on("pageerror", lambda error: failures.append(f"pageerror: {error}"))
                response = page.goto(origin + path, wait_until="networkidle")
                assert response and response.ok, (path, response.status if response else None)
                page.wait_for_timeout(650)
                links = page.locator('a[href="/course/"]')
                assert links.count() >= 1, f"{path} is missing /course/ navigation"
                assert any(links.nth(index).is_visible() for index in range(links.count())), f"{path} hides /course/ at {width}px"
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                assert overflow <= 1, f"{path} overflows by {overflow}px at {width}px"
                assert not failures, (path, failures)
                page.close()
        browser.close()
    print(f"T077_COURSE_BROWSER_OK {base} viewports={len(VIEWPORTS)} public-nav=10")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3000/course/")
    args = parser.parse_args()
    run(args.base)


if __name__ == "__main__":
    main()
