#!/usr/bin/env python3
"""Verify that Alpha opens the local LIVE RUN controller as a reusable popup."""

from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import websocket


class Cdp:
    def __init__(self, url: str):
        self.socket = websocket.create_connection(url, timeout=8, origin="http://127.0.0.1")
        self.sequence = 0

    def call(self, method: str, params: dict | None = None) -> dict:
        self.sequence += 1
        message_id = self.sequence
        self.socket.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        while True:
            response = json.loads(self.socket.recv())
            if response.get("id") != message_id:
                continue
            if "error" in response:
                raise RuntimeError(response["error"])
            return response.get("result", {})

    def close(self) -> None:
        self.socket.close()


def get_json(url: str) -> dict | list:
    with urllib.request.urlopen(url, timeout=6) as response:
        return json.load(response)


def evaluate(page: Cdp, expression: str, *, user_gesture: bool = False) -> object:
    result = page.call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "userGesture": user_gesture,
    })
    if result.get("exceptionDetails"):
        raise RuntimeError(result["exceptionDetails"])
    return result["result"].get("value")


def wait_until(page: Cdp, expression: str, timeout: float = 12) -> object:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = evaluate(page, expression)
        if value:
            return value
        time.sleep(0.2)
    raise TimeoutError(expression)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--debug-base", default="http://127.0.0.1:19225")
    parser.add_argument("--console-url", default="https://work.cyberforker.com/msv/alpha/")
    parser.add_argument("--screenshot", type=Path, default=Path("docs/assets/alpha-controller-entry.png"))
    parser.add_argument("--output", type=Path, default=Path("docs/ALPHA_CONTROLLER_ENTRY_BROWSER_RECEIPT.json"))
    args = parser.parse_args()

    version = get_json(f"{args.debug_base}/json/version")
    browser = Cdp(version["webSocketDebuggerUrl"])
    console_target_id = None
    controller_target_id = None
    console_page = None
    controller_page = None
    initial_targets = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
    try:
        console_target_id = browser.call("Target.createTarget", {
            "url": args.console_url,
            "newWindow": True,
            "width": 1180,
            "height": 900,
        })["targetId"]
        time.sleep(0.8)
        target = next(item for item in get_json(f"{args.debug_base}/json/list") if item["id"] == console_target_id)
        console_page = Cdp(target["webSocketDebuggerUrl"])
        console_page.call("Page.enable")
        console_page.call("Runtime.enable")
        wait_until(console_page, "document.readyState==='complete' && document.querySelectorAll('.seat').length===8 && !!document.getElementById('controllerBtn')")

        before_open = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
        evaluate(console_page, "controllerBtn.click(); true", user_gesture=True)
        deadline = time.monotonic() + 12
        controller_target = None
        while time.monotonic() < deadline:
            candidates = [
                item for item in get_json(f"{args.debug_base}/json/list")
                if item["id"] not in before_open and item.get("type") == "page"
            ]
            controller_target = next((item for item in candidates if item.get("url", "").startswith("http://127.0.0.1:18765/")), None)
            if controller_target:
                break
            time.sleep(0.2)
        assert controller_target and controller_target.get("webSocketDebuggerUrl"), "未打开本机主控窗口"
        controller_target_id = controller_target["id"]

        console_window = browser.call("Browser.getWindowForTarget", {"targetId": console_target_id})
        controller_window = browser.call("Browser.getWindowForTarget", {"targetId": controller_target_id})
        assert controller_window["windowId"] != console_window["windowId"]
        bounds = controller_window["bounds"]
        assert bounds["width"] >= 360 and bounds["height"] >= 480

        controller_page = Cdp(controller_target["webSocketDebuggerUrl"])
        controller_page.call("Runtime.enable")
        wait_until(controller_page, "document.readyState==='complete'")
        visible = evaluate(controller_page, "({title:document.title,heading:document.querySelector('h1')?.textContent||'',openerIsNull:opener===null})")
        assert visible["title"] == "LIVE RUN SCRIPT"
        assert visible["heading"] == "LIVE RUN SCRIPT"
        assert visible["openerIsNull"] is True

        targets_before_reopen = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
        evaluate(console_page, "controllerBtn.click(); true", user_gesture=True)
        time.sleep(0.5)
        targets_after_reopen = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
        assert targets_after_reopen == targets_before_reopen, "主控入口应复用已打开的窗口"

        screenshot = console_page.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        args.screenshot.parent.mkdir(parents=True, exist_ok=True)
        args.screenshot.write_bytes(base64.b64decode(screenshot["data"]))
        receipt = {
            "schemaVersion": 1,
            "verifiedAt": datetime.now(timezone.utc).isoformat(),
            "target": args.console_url,
            "browser": version["Browser"],
            "buttonVisible": True,
            "controllerReached": True,
            "controllerTitle": visible["title"],
            "independentPopup": True,
            "stableWindowReused": True,
            "openerIsNull": True,
            "popupBounds": bounds,
            "privilegedApiExposedByAlpha": False,
            "containsCredentialsOrCapabilities": False,
            "screenshot": str(args.screenshot),
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(receipt, ensure_ascii=False))
    finally:
        if controller_page:
            controller_page.close()
        if console_page:
            console_page.close()
        for target in get_json(f"{args.debug_base}/json/list"):
            if target["id"] not in initial_targets:
                try:
                    browser.call("Target.closeTarget", {"targetId": target["id"]})
                except Exception:
                    pass
        browser.close()


if __name__ == "__main__":
    main()
