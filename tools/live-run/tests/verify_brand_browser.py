#!/usr/bin/env python3
"""Real-browser geometry and navigation acceptance for the shared MSV mark."""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
ROUTES = ("/", "/auth/register/", "/auth/recover/", "/qa/", "/brand-contract-missing/")
VIEWPORTS = ((320, 760), (390, 844), (768, 1024), (1440, 900))


def snapshot(page) -> dict:
    return page.evaluate(
        """() => { const link=document.querySelector('.msv-brand-home'), img=link?.querySelector('img');
        if(!link||!img)return null; const a=link.getBoundingClientRect(), b=img.getBoundingClientRect();
        return {href:link.getAttribute('href'),aria:link.getAttribute('aria-label'),tag:link.tagName,
          innerWidth,rootWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
          link:{left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height},
          image:{src:img.getAttribute('src'),width:b.width,height:b.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}} }"""
    )


def main() -> None:
    base = os.environ.get("MSV_APP_URL", "http://127.0.0.1:4178/")
    artifact = Path(os.environ["MSV_QA_ARTIFACT_DIR"]) if os.environ.get("MSV_QA_ARTIFACT_DIR") else None
    if artifact:
        artifact.mkdir(parents=True, exist_ok=True)
    result: dict[str, object] = {"ok": False, "base": base, "routes": {}}
    with sync_playwright() as playwright:
        launch: dict[str, object] = {"headless": True}
        if CHROME.exists():
            launch["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**launch)
        page = browser.new_page()
        for route in ROUTES:
            route_result: dict[str, object] = {}
            for width, height in VIEWPORTS:
                page.set_viewport_size({"width": width, "height": height})
                response = page.goto(urljoin(base, route.lstrip("/")), wait_until="networkidle")
                assert response and response.status in ({404} if "missing" in route else {200}), (route, response.status if response else None)
                page.wait_for_selector(".msv-brand-home img")
                value = snapshot(page)
                assert value and value["tag"] == "A"
                assert value["href"] == "/" and value["aria"] == "返回 Mini Silicon Valley 主页"
                assert "favicon.svg" in value["image"]["src"]
                assert value["image"]["naturalWidth"] > 0 and value["image"]["naturalHeight"] > 0
                assert abs(value["image"]["width"] - value["image"]["height"]) <= 1
                assert value["link"]["left"] >= -1 and value["link"]["right"] <= width + 1, (route, width, value)
                assert value["rootWidth"] <= width + 1 and value["bodyWidth"] <= width + 1, (route, width, value)
                route_result[str(width)] = {"noOverflow": True, "mark": value["image"]}
                if artifact and route in {"/", "/auth/register/", "/brand-contract-missing/"} and width in {390, 1440}:
                    slug = "home" if route == "/" else "register" if "register" in route else "404"
                    page.screenshot(path=artifact / f"brand-{slug}-{width}.png", full_page=False)
            result["routes"][route] = route_result

        # A keyboard-activated shared mark performs ordinary root navigation in
        # the current tab; this is not a decorative div or JS-only action.
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(urljoin(base, "auth/register/"), wait_until="networkidle")
        page.locator(".msv-brand-home").focus()
        page.keyboard.press("Enter")
        page.wait_for_url(urljoin(base, ""))
        assert page.url.rstrip("/") == base.rstrip("/")
        browser.close()
        result["ok"] = True
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
