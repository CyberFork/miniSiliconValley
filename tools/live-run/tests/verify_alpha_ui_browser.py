#!/usr/bin/env python3
"""Computed-style and responsive browser acceptance for T-076 Alpha UI."""
from __future__ import annotations

import copy
import json
import math
import os
import re
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController, LiveRunServer  # noqa: E402
from course import CourseRepository  # noqa: E402

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
VIEWPORTS = ((390, 844), (430, 932), (600, 960), (768, 1024), (1440, 900))
SEATS = ("W00", "W01", "W02", "W03", "W04", "W05", "W06", "W07")
STATUS_BY_SEAT = {
    "W00": "ready", "W01": "executing", "W02": "awaiting-acceptance", "W03": "error",
    "W04": "completed", "W05": "ready", "W06": "awaiting-acceptance", "W07": "completed",
}


def rgb(value: str) -> tuple[float, float, float]:
    match = re.search(r"rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)", value)
    if not match:
        raise AssertionError(f"unsupported CSS colour: {value}")
    return tuple(float(item) / 255 for item in match.groups())  # type: ignore[return-value]


def contrast(foreground: str, background: str) -> float:
    def channel(value: float) -> float:
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
    values = []
    for colour in (foreground, background):
        red, green, blue = rgb(colour)
        values.append(0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue))
    light, dark = max(values), min(values)
    return (light + 0.05) / (dark + 0.05)


def state_for_seat(base: dict, window: str) -> dict:
    result = copy.deepcopy(base)
    result["status"] = STATUS_BY_SEAT[window]
    alias = {f"W0{index}": seat for index, seat in enumerate(
        ("mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04")
    )}[window]
    result["classroom"].update({"mentorCount": 4, "learnerCount": 4, "teamTreasuryTenths": 138, "chapterCount": 5})
    if alias.startswith("learner"):
        number = int(alias[-2:])
        result["classroom"].setdefault("learnerViews", {})[alias] = {
            "displayName": f"Young Builder {number:02d}",
            "reputation": number * 2,
            "walletTenths": number * 9,
            "unlockIds": ["tool-interview"],
            "identity": {"name": f"校园观察员 {number}", "publicGoal": "找出一个真实发生、值得解决的麻烦。", "ability": "追问一次为什么", "privateConcern": "不要把猜测说成事实。"},
            "cards": [{
                "id": f"qa-card-{number}", "title": "一张可以讲清楚的现场线索",
                "body": "午饭时间，同学拨了三次电话仍然没有订到餐。",
                "sharePrompt": "把你看到的人、地点和具体麻烦讲给队友。", "sourceIds": ["qa-source"],
                "evidenceBoundary": "F", "state": "unread",
            }],
        }
    for seat in result["seats"]:
        if result["status"] == "error":
            seat["headline"] = "当前块停住 · 查看错误并重试"
        elif result["status"] == "awaiting-acceptance":
            seat["headline"] = "本块已同步 · 等待主控验收"
        elif result["status"] == "completed":
            seat["headline"] = "本次课程完成"
        elif result["status"] == "executing":
            seat["headline"] = "系统正在执行当前块"
    return result


def handler_for(base_state: dict):
    static = ROOT / "static"
    remote = ROOT / "remote-console" / "static"
    site = REPO / "deploy" / "minisv" / "site"
    files = {
        "/seat.html": static / "seat.html", "/seat.css": static / "seat.css", "/seat.js": static / "seat.js",
        "/card-view.js": static / "card-view.js", "/course-preview.css": static / "course-preview.css",
        "/course-preview.js": static / "course-preview.js", "/ui-theme.css": site / "ui-theme.css",
        "/ui-theme.js": site / "ui-theme.js", "/alpha/": remote / "index.html",
        "/favicon.svg": REPO / "public" / "favicon.svg",
        "/alpha/index.html": remote / "index.html", "/alpha/console.css": remote / "console.css",
        "/alpha/console.js": remote / "console.js", "/alpha/seat-loading.html": remote / "seat-loading.html",
    }

    class Handler(BaseHTTPRequestHandler):
        def send_bytes(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def send_json(self, value: dict) -> None:
            self.send_bytes(200, (json.dumps(value, ensure_ascii=False) + "\n").encode(), "application/json; charset=utf-8")

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/api/state":
                seat = parse_qs(parsed.query).get("seat", ["W00"])[0]
                aliases = {name: f"W0{index}" for index, name in enumerate(
                    ("mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04")
                )}
                window = seat if seat in STATUS_BY_SEAT else aliases.get(seat, "W00")
                self.send_json({"ok": True, "data": state_for_seat(base_state, window)})
                return
            if parsed.path == "/alpha/api/console":
                seats = []
                titles = ("主 DM · 产品导师", "开发导师", "市场导师", "运营导师", "Young Builder 01", "Young Builder 02", "Young Builder 03", "Young Builder 04")
                for index, (window, title) in enumerate(zip(SEATS, titles, strict=True)):
                    seats.append({"id": f"seat-{index}", "window": window, "title": title, "kind": "mentor" if index < 4 else "learner", "claimed": False, "isMine": False})
                self.send_json({"ok": True, "data": {"connected": True, "connectionError": None, "course": {"name": "饿了么｜五步创业闭环", "coverage": "五步 / 13 Block"}, "run": {"status": "ready", "currentBlock": 1, "executionBlock": 1, "totalBlocks": 13, "macroStepName": "找真问题", "courseRevision": 7, "courseDigest": "0123456789abcdef", "refreshEpoch": 2}, "seats": seats, "clientClaimCount": 0, "maxClaims": 2, "now": 0}})
                return
            path = files.get(parsed.path)
            if path and path.is_file():
                mime = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml"}.get(path.suffix, "application/octet-stream")
                self.send_bytes(200, path.read_bytes(), mime)
                return
            self.send_bytes(404, b"not found", "text/plain")

        def log_message(self, *_args) -> None:
            return

    return Handler


def page_contract(page, content_selector: str) -> dict:
    return page.evaluate(
        """(contentSelector) => {
          const rect = (selector) => { const r=document.querySelector(selector).getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
          const content=rect(contentSelector);
          return {innerWidth, rootWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth,
            theme:document.documentElement.dataset.msvTheme||null,
            switchCount:document.querySelectorAll('#msv-ui-switch').length,
            content};
        }""",
        content_selector,
    )


def brand_contract(page) -> dict:
    value = page.evaluate(
        """() => {const link=document.querySelector('.msv-static-brand'),img=link?.querySelector('img');
          if(!link||!img)return null;const a=link.getBoundingClientRect(),b=img.getBoundingClientRect();
          return {tag:link.tagName,href:link.getAttribute('href'),aria:link.getAttribute('aria-label'),
            left:a.left,right:a.right,width:b.width,height:b.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight};}"""
    )
    assert value and value["tag"] == "A" and value["href"] == "/"
    assert value["aria"] == "返回 Mini Silicon Valley 主页"
    assert value["left"] >= -1 and value["right"] <= page.viewport_size["width"] + 1
    assert value["naturalWidth"] > 0 and value["naturalHeight"] > 0
    assert abs(value["width"] - value["height"]) <= 1
    return value


def seat_style_contract(page) -> dict:
    pairs = page.evaluate(
        """() => {
          const sample=(text,background) => { const t=document.querySelector(text), b=document.querySelector(background); return t&&b ? {selector:text, color:getComputedStyle(t).color, background:getComputedStyle(b).backgroundColor, fontSize:parseFloat(getComputedStyle(t).fontSize)} : null; };
          return [
            sample('.surface-mission>.surface-value>p','.surface-mission'),
            sample('.surface-mission>.surface-value+.surface-value>p','.surface-mission'),
            sample('.surface-result p','.surface-result'),
            sample('.surface-card li p','.surface-card li'),
            sample('.surface-subidentity','.msv-seat-surface'),
            sample('.private-card>p','.private-card')
          ].filter(Boolean);
        }"""
    )
    ratios = {item["selector"]: round(contrast(item["color"], item["background"]), 2) for item in pairs}
    for item in pairs:
        assert ratios[item["selector"]] >= 4.5, (item, ratios)
        if item["selector"] in {".surface-mission>.surface-value>p", ".surface-mission>.surface-value+.surface-value>p", ".surface-result p", ".surface-card li p", ".private-card>p"}:
            assert item["fontSize"] >= 16, item
    return {"contrast": ratios, "minimumCoreFontPx": min(item["fontSize"] for item in pairs)}


def main() -> None:
    result: dict[str, object] = {"ok": False, "seat": {}, "console": {}, "control": {}, "editor": {}}
    artifact = Path(os.environ["MSV_QA_ARTIFACT_DIR"]) if os.environ.get("MSV_QA_ARTIFACT_DIR") else None
    if artifact:
        artifact.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        temp_path = Path(temp)
        repository = CourseRepository(temp_path / "courses")
        controller = CourseController(temp_path / "run-state.json", course_repository=repository)
        fixture = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(controller.public_state()))
        control = LiveRunServer(("127.0.0.1", 0), controller, "t076-browser-token")
        threading.Thread(target=fixture.serve_forever, daemon=True).start()
        threading.Thread(target=control.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                options: dict[str, object] = {"headless": True}
                if CHROME.exists():
                    options["executable_path"] = str(CHROME)
                browser = playwright.chromium.launch(**options)
                page = browser.new_page(viewport={"width": 430, "height": 932})
                base = f"http://127.0.0.1:{fixture.server_port}"

                # Every mentor and learner view receives the one canonical
                # Adventure skin. Statuses span every runtime state.
                for window in SEATS:
                    page.goto(f"{base}/seat.html?seat={window}#clientId=browser-test-client&lease=browser-test-lease-0123456789", wait_until="networkidle")
                    page.wait_for_selector(".msv-seat-surface[data-preview='false']")
                    brand = brand_contract(page)
                    geometry = page_contract(page, ".surface-header")
                    assert geometry["theme"] == "adventure"
                    assert geometry["switchCount"] == 0
                    assert geometry["rootWidth"] <= geometry["innerWidth"] + 1
                    assert geometry["bodyWidth"] <= geometry["innerWidth"] + 1
                    styles = seat_style_contract(page)
                    result["seat"][window] = {"status": STATUS_BY_SEAT[window], "noOverflow": True, "adventureOnly": True, "brand": brand, **styles}
                if artifact:
                    page.goto(f"{base}/seat.html?seat=W05#clientId=browser-test-client&lease=browser-test-lease-0123456789", wait_until="networkidle")
                    page.screenshot(path=artifact / "alpha-seat-adventure-430.png", full_page=True)

                # Console responsive matrix: 390–600 uses one readable column,
                # 768 two columns, projector width four columns.
                for width, height in VIEWPORTS:
                    page.set_viewport_size({"width": width, "height": height})
                    page.goto(f"{base}/alpha/", wait_until="networkidle")
                    page.wait_for_selector("#seatGrid .seat")
                    brand = brand_contract(page)
                    assert page.locator("#seatGrid .seat").count() == 8
                    geometry = page_contract(page, "header h1")
                    assert geometry["theme"] == "adventure" and geometry["switchCount"] == 0
                    assert geometry["rootWidth"] <= geometry["innerWidth"] + 1
                    boxes = [page.locator("#seatGrid .seat").nth(index).bounding_box() for index in range(4)]
                    rows = len({round(box["y"]) for box in boxes if box})
                    expected_rows = 4 if width <= 640 else 2 if width <= 900 else 1
                    assert rows == expected_rows, (width, rows, boxes)
                    button = page.locator("#seatGrid .seat button").first.bounding_box()
                    assert button and button["height"] >= 44 and button["width"] >= 44
                    style = page.evaluate("() => {const t=document.querySelector('.seat-status'),b=document.querySelector('.seat');return {color:getComputedStyle(t).color,background:getComputedStyle(b).backgroundColor,fontSize:parseFloat(getComputedStyle(t).fontSize)}}")
                    ratio = contrast(style["color"], style["background"])
                    assert ratio >= 4.5 and style["fontSize"] >= 15
                    result["console"][str(width)] = {"columns": 4 // expected_rows, "contrast": round(ratio, 2), "noOverflow": True, "adventureOnly": True, "brand": brand}
                    if artifact and width == 600:
                        page.screenshot(path=artifact / "alpha-console-adventure-600.png", full_page=True)

                # LIVE RUN master and Course Studio use Adventure without any
                # injected control, horizontal overflow or status remapping.
                control_base = f"http://127.0.0.1:{control.server_port}"
                for surface, path, heading in (("control", "/", "header h1"), ("editor", "/editor/", ".topbar h1")):
                    for width, height in ((390, 844), (1440, 900)):
                        page.set_viewport_size({"width": width, "height": height})
                        page.goto(f"{control_base}{path}", wait_until="networkidle")
                        brand = brand_contract(page)
                        geometry = page_contract(page, heading)
                        assert geometry["theme"] == "adventure" and geometry["switchCount"] == 0
                        assert geometry["rootWidth"] <= geometry["innerWidth"] + 1
                        result[surface][str(width)] = {"noOverflow": True, "adventureOnly": True, "brand": brand}
                        if artifact and surface == "control" and width == 390:
                            page.screenshot(path=artifact / "control-adventure-390.png", full_page=True)
                        if artifact and surface == "editor" and width == 1440:
                            page.screenshot(path=artifact / "editor-adventure-1440.png", full_page=False)
                browser.close()
                result["ok"] = True
        finally:
            fixture.shutdown(); fixture.server_close()
            control.shutdown(); control.server_close()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"] or not all(math.isfinite(value) for item in result["seat"].values() for value in item["contrast"].values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
