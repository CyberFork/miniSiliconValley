#!/usr/bin/env python3
"""Deterministic browser acceptance for T-109 public IA and Workshop archive.

This test never connects to production and never writes platform data. It
serves the repo-owned static assets, uses synthetic legacy browser records,
and validates both desktop and touch-sized layouts with real Chromium.
"""
from __future__ import annotations

import json
import mimetypes
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


REPO = Path(__file__).resolve().parents[3]
SITE = REPO / "deploy" / "minisv" / "site"
WORKSHOP = REPO / "deploy" / "minisv" / "workshop"
CLIENT = REPO / "dist" / "client"
STATIC = REPO / "dist" / "minisv-static"
QA = REPO / "docs" / "qa" / "t109-public-internal-ia"
CHROME = Path("/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
LEGACY_KEYS = [
    "msv.curriculumWorkshop.v1",
    "msv.curriculumWorkshop.v2",
    "msv.curriculumWorkshop.backup.v2",
    "msv.curriculumWorkshop.checkpoint.v2",
    "msv.workshop.confirmed-baseline.v1",
    "msv.workshop.confirmed-baseline.backup.v1",
    "msv.workshop.baseline.proposals.v1",
    "msv.workshop.baseline.decisions.v1",
    "msv.workshop.baseline.audit.v1",
    "msv.workshop.baseline.actor.v1",
]


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def file_response(handler: BaseHTTPRequestHandler, path: Path, content_type: str | None = None) -> None:
    if not path.is_file():
        handler.send_error(404)
        return
    body = path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        files: dict[str, Path] = {
            "/": SITE / "index.html",
            "/portal.css": SITE / "portal.css",
            "/portal.js": SITE / "portal.js",
            "/ui-theme.css": SITE / "ui-theme.css",
            "/ui-theme.js": SITE / "ui-theme.js",
            "/favicon.svg": CLIENT / "favicon.svg",
            "/world-preview.json": STATIC / "world-preview.json",
            "/assets/map-1998.webp": CLIENT / "assets" / "map-1998.webp",
            "/assets/map-1891.webp": CLIENT / "assets" / "map-1891.webp",
            "/assets/map-1976.webp": CLIENT / "assets" / "map-1976.webp",
            "/assets/map-2026.webp": CLIENT / "assets" / "map-2026.webp",
            "/workshop/": WORKSHOP / "archive.html",
            "/workshop/archive.css": WORKSHOP / "archive.css",
            "/workshop/archive.js": WORKSHOP / "archive.js",
            "/workshop/confirmed-baseline.json": WORKSHOP / "confirmed-baseline.json",
        }
        if path in files:
            file_response(self, files[path])
            return
        if path in {"/api/auth/accounts", "/api/auth/session"}:
            body = json.dumps({"ok": False, "error": {"code": "UNAUTHENTICATED", "message": "请先登录。"}}).encode()
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith("/assets/"):
            file_response(self, CLIENT / path.lstrip("/"))
            return
        if path in {"/world/", "/framework/", "/parents/", "/classroom/", "/course/"}:
            title = {
                "/world/": "历史世界",
                "/framework/": "课程大纲",
                "/parents/": "家长入口",
                "/classroom/": "上课入口",
                "/course/": "课件查看",
            }[path]
            body = f"<!doctype html><html lang='zh-CN'><title>{title}</title><body><h1>{title}</h1><a href='/'>回到首页</a></body></html>".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)


def geometry(page) -> dict[str, int]:
    return page.evaluate("() => ({innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth})")


def assert_no_overflow(page) -> dict[str, int]:
    value = geometry(page)
    assert value["body"] <= value["innerWidth"] + 1, value
    assert value["root"] <= value["innerWidth"] + 1, value
    return value


def main() -> None:
    for required in (STATIC / "world-preview.json", CLIENT / "assets" / "map-1998.webp", WORKSHOP / "confirmed-baseline.json"):
        if not required.is_file():
            raise SystemExit(f"missing build prerequisite: {required}")
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"
    result: dict[str, object] = {"ok": False, "browser": {}, "public": {}, "archive": {}}
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            if CHROME.exists():
                launch["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**launch)
            result["browser"] = {"engine": "Chromium", "version": browser.version}

            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            page = context.new_page()
            errors: list[str] = []
            failures: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("requestfailed", lambda request: failures.append(request.url) if request.resource_type in {"document", "script", "stylesheet", "image"} else None)
            page.goto(base, wait_until="networkidle")
            expect(page.locator(".hero-copy h1")).to_contain_text("把科技史")
            expect(page.locator(".hero-copy h1")).to_contain_text("玩成一次创业")
            expect(page.locator("[data-world-status]")).to_contain_text("精选节点")
            assert page.locator('a[href^="/studio/"]').count() == 0
            assert page.locator('a[href^="/workshop/"]').count() == 0
            desktop_geometry = assert_no_overflow(page)

            page.locator("[data-world-range]").evaluate("(node) => { node.value='1969'; node.dispatchEvent(new Event('input', {bubbles:true})); }")
            expect(page.locator("[data-world-year]")).to_have_text("1969")
            expect(page.locator("[data-world-story]")).to_contain_text("ARPANET")
            page.locator('[data-world-jump="1998"]').click()
            expect(page.locator("[data-world-year]")).to_have_text("1998")
            expect(page.locator("[data-world-story]")).to_contain_text("Google")
            page.screenshot(path=str(QA / "public-home-desktop.png"), full_page=True)

            for selector, destination, heading in (
                ('.hero-actions a[href="/world/"]', "/world/", "历史世界"),
                ('.mentor-section a[href="/framework/"]', "/framework/", "课程大纲"),
                ('.parent-entry a[href="/parents/"]', "/parents/", "家长入口"),
                ('.learner-entry a[href="/classroom/"]', "/classroom/", "上课入口"),
                ('.learner-entry a[href="/course/"]', "/course/", "课件查看"),
            ):
                page.goto(base, wait_until="networkidle")
                page.locator(selector).click()
                page.wait_for_url(f"**{destination}")
                expect(page.get_by_role("heading", name=heading)).to_be_visible()

            mobile = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
            mobile_page = mobile.new_page()
            mobile_errors: list[str] = []
            mobile_page.on("pageerror", lambda error: mobile_errors.append(str(error)))
            mobile_page.goto(base, wait_until="networkidle")
            mobile_geometry = assert_no_overflow(mobile_page)
            mobile_page.get_by_role("link", name="看看怎样完成项目").tap()
            expect(mobile_page.locator("#journey")).to_be_in_viewport()
            mobile_page.screenshot(path=str(QA / "public-home-mobile.png"), full_page=True)
            mobile.close()

            result["public"] = {
                "desktopNoOverflow": desktop_geometry,
                "mobileNoOverflow": mobile_geometry,
                "historyCatalogPreview": True,
                "ordinaryNavigation": ["world", "framework", "parents", "classroom", "course"],
                "internalLinksAbsent": True,
            }

            archive_context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
            seed = {key: json.dumps({"synthetic": True, "key": key}, ensure_ascii=False) for key in LEGACY_KEYS}
            archive_context.add_init_script(script=f"const records = {json.dumps(seed, ensure_ascii=False)}; for (const [key,value] of Object.entries(records)) localStorage.setItem(key, value);")
            archive_page = archive_context.new_page()
            archive_errors: list[str] = []
            archive_page.on("pageerror", lambda error: archive_errors.append(str(error)))
            archive_page.goto(f"{base}/workshop/", wait_until="networkidle")
            expect(archive_page.get_by_role("heading", name="早期课程工作坊 历史归档")).to_be_visible()
            expect(archive_page.locator("[data-baseline-status]")).to_contain_text("完整性通过")
            expect(archive_page.locator(".baseline-card").first).to_contain_text("饿了么")
            assert archive_page.locator(".record-item").count() == len(LEGACY_KEYS)
            expect(archive_page.locator("[data-record-summary]")).to_contain_text("找到 10 / 10")
            before = archive_page.evaluate("keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]))", LEGACY_KEYS)
            archive_page.locator(".record-item").first.locator("summary").click()
            expect(archive_page.locator(".record-item").first.locator("pre")).to_contain_text("synthetic")
            with archive_page.expect_download() as download_info:
                archive_page.get_by_role("button", name="导出本浏览器记录 JSON").click()
            exported = json.loads(Path(download_info.value.path()).read_text(encoding="utf-8"))
            assert exported["readOnly"] is True and len(exported["records"]) == len(LEGACY_KEYS), exported
            archive_page.reload(wait_until="networkidle")
            after = archive_page.evaluate("keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]))", LEGACY_KEYS)
            assert before == after
            archive_geometry = assert_no_overflow(archive_page)
            archive_page.evaluate("window.scrollTo(0, 0)")
            archive_page.screenshot(path=str(QA / "workshop-readonly-archive.png"), full_page=True)
            archive_context.close()

            assert not errors, errors
            assert not mobile_errors, mobile_errors
            assert not archive_errors, archive_errors
            assert not failures, failures
            result["archive"] = {
                "keysRead": len(LEGACY_KEYS),
                "exportComplete": True,
                "valuesUnchangedAfterReload": True,
                "releasedBaselineVisible": True,
                "desktopNoOverflow": archive_geometry,
            }
            result["ok"] = True
            result["screenshots"] = [
                "docs/qa/t109-public-internal-ia/public-home-desktop.png",
                "docs/qa/t109-public-internal-ia/public-home-mobile.png",
                "docs/qa/t109-public-internal-ia/workshop-readonly-archive.png",
            ]
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    (QA / "browser-receipt.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
