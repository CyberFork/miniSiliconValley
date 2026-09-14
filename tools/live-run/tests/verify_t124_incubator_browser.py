#!/usr/bin/env python3
"""Chromium acceptance for T-124's real incubator pages and project interactions."""
from __future__ import annotations

import functools
import os
import threading
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import expect, sync_playwright

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


@contextmanager
def target() -> str:
    base = os.environ.get("MSV_T124_URL", "").rstrip("/")
    site = os.environ.get("MSV_T124_SITE", "")
    if base:
        yield base
        return
    if not site:
        raise RuntimeError("set MSV_T124_URL or MSV_T124_SITE")
    root = Path(site).resolve()
    if not (root / "incubator/projects/recitation/index.html").is_file():
        raise RuntimeError(f"not a packaged MiniSV site: {root}")

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, _format: str, *_args: object) -> None:
            return

    handler = functools.partial(QuietHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join(timeout=5)


def open_path(page, base: str, route: str) -> None:
    page.goto(urljoin(base + "/", route.lstrip("/")), wait_until="networkidle")


def assert_no_overflow(page, label: str) -> None:
    size = page.evaluate(
        "() => ({inner: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth})"
    )
    assert size["body"] <= size["inner"] + 1 and size["root"] <= size["inner"] + 1, (label, size)


def exercise(context, base: str, viewport_name: str, artifacts: Path) -> None:
    page = context.new_page()
    errors: list[str] = []
    failed: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "response",
        lambda response: failed.append(f"{response.status} {response.url}")
        if response.status >= 400
        else None,
    )

    open_path(page, base, "/incubator/")
    expect(page.locator("#incubator-title")).to_contain_text("做出一个项目")
    expect(page.get_by_role("link", name="查看已孵化项目 →")).to_be_visible()
    assert_no_overflow(page, f"{viewport_name}:incubator")
    page.screenshot(path=str(artifacts / f"{viewport_name}-incubator.png"), full_page=True)

    open_path(page, base, "/incubator/projects/")
    expect(page.get_by_role("heading", name="项目列表")).to_be_visible()
    expect(page.get_by_role("link", name="直接打开背课文 →")).to_be_visible()
    expect(page.get_by_role("link", name="直接打开错题集 →")).to_be_visible()
    assert_no_overflow(page, f"{viewport_name}:projects")

    page.get_by_role("link", name="直接打开背课文 →").click()
    page.wait_for_load_state("networkidle")
    expect(page.locator(".msv-project-brand img")).to_be_visible()
    expect(page.get_by_role("link", name="← 项目列表")).to_be_visible()
    expect(page.locator("#featureVisualImage")).to_be_visible()
    assert page.locator("#featureVisualImage").evaluate("img => img.naturalWidth") > 0
    page.locator("#startPracticeBtn").click()
    expect(page.get_by_role("heading", name="选择背诵模式")).to_be_visible()
    page.locator('[data-mode="挖空"]').click()
    page.locator("#confirmPracticeBtn").click()
    expect(page.locator("#practiceSessionModal.open")).to_be_visible()
    expect(page.locator("#sessionBody")).to_contain_text("至若")
    assert_no_overflow(page, f"{viewport_name}:recitation")
    page.screenshot(path=str(artifacts / f"{viewport_name}-recitation.png"), full_page=False)

    open_path(page, base, "/incubator/projects/mistake-notebook/")
    expect(page.locator(".msv-project-brand img")).to_be_visible()
    expect(page.get_by_role("link", name="← 项目列表")).to_be_visible()
    expect(page.get_by_text("今日攻关重点", exact=True)).to_be_visible()
    page.locator("#triggerCaptureBtn").click()
    expect(page.get_by_role("heading", name="录入错题")).to_be_visible()
    expect(page.locator("#captureModal.open")).to_be_visible()
    assert_no_overflow(page, f"{viewport_name}:mistake-notebook")
    page.screenshot(path=str(artifacts / f"{viewport_name}-mistake-notebook.png"), full_page=False)

    assert not errors, (viewport_name, "page errors", errors)
    assert not failed, (viewport_name, "failed network responses", failed)
    page.close()


def main() -> None:
    artifacts = Path(os.environ.get("MSV_T124_ARTIFACT_DIR", "/tmp/minisv-t124-browser"))
    artifacts.mkdir(parents=True, exist_ok=True)
    with target() as base, sync_playwright() as playwright:
        launch: dict[str, object] = {"headless": True}
        if CHROME.exists():
            launch["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**launch)
        try:
            desktop = browser.new_context(viewport={"width": 1440, "height": 1000})
            exercise(desktop, base, "desktop", artifacts)
            desktop.close()
            mobile = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                has_touch=True,
                is_mobile=True,
            )
            exercise(mobile, base, "mobile", artifacts)
            mobile.close()
        finally:
            browser.close()
    print(f"T124_BROWSER_PASS base={base} viewports=1440x1000,390x844 projects=recitation,mistake-notebook artifacts={artifacts}")


if __name__ == "__main__":
    main()
