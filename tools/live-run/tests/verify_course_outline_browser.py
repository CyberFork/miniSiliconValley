#!/usr/bin/env python3
"""Browser acceptance for the unmodified colleague-owned /course/ site."""
from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


VIEWPORTS = ((390, 844), (430, 932), (768, 1024), (1440, 1000))
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def close_first_visit_briefing(page) -> None:
    dialog = page.get_by_role("dialog")
    if dialog.count():
        dialog.get_by_role("button", name="关闭").click()


def assert_colleague_site(page, width: int) -> None:
    page.wait_for_selector(".pixel-home")
    close_first_visit_briefing(page)

    assert page.get_by_role("heading", name="青少年AI创业营").count() == 1
    assert page.locator(".pixel-home-route article").count() == 4
    assert page.locator('img[src="/course/assets/home-workbench.png"]').evaluate(
        "image => image.complete && image.naturalWidth > 0"
    )
    assert page.locator('script[src*="/course/_next/"]').count() > 0
    assert page.locator('script[src="/ui-theme.js"]').count() == 0

    metrics = page.evaluate("""() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    })""")
    assert metrics["scrollWidth"] <= metrics["innerWidth"] + 1, (
        f"{width}px has horizontal page overflow: {metrics}"
    )

    page.get_by_role("button", name="课程大纲", exact=True).click()
    page.wait_for_selector(".pixel-course-outline")
    assert page.locator(".pixel-outline-chapter").count() == 9
    assert page.locator(".pixel-outline-phase-tabs button").count() == 4
    assert page.get_by_role("button", name="课程总览", exact=False).count() >= 1

    page.get_by_role("button", name="返回 MINI硅谷首页").click()
    page.wait_for_selector(".pixel-home")
    page.get_by_role("button", name="开始", exact=True).click()
    page.wait_for_selector(".pixel-course-outline")


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
            assert_colleague_site(page, width)
            assert not failures, failures
            page.close()

        target = urlsplit(base)
        origin = f"{target.scheme}://{target.netloc}"
        for width in (390, 1440):
            for path in ("/", "/world/", "/framework/", "/parents/"):
                page = browser.new_page(viewport={"width": width, "height": 900}, reduced_motion="reduce")
                failures: list[str] = []
                page.on("pageerror", lambda error: failures.append(f"pageerror: {error}"))
                response = page.goto(origin + path, wait_until="networkidle")
                assert response and response.ok, (path, response.status if response else None)
                page.wait_for_timeout(650)
                links = page.locator('a[href="/course/"]')
                assert links.count() >= 1, f"{path} is missing /course/ navigation"
                assert any(links.nth(index).is_visible() for index in range(links.count())), (
                    f"{path} hides /course/ at {width}px"
                )
                assert not failures, (path, failures)
                page.close()
        browser.close()
    print(f"T077_CHJ_COURSE_BROWSER_OK {base} viewports={len(VIEWPORTS)} public-nav=8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3000/course/")
    args = parser.parse_args()
    run(args.base)


if __name__ == "__main__":
    main()
