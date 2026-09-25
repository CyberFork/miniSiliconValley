#!/usr/bin/env python3
"""Visual acceptance for the deployed T-070 console through an existing Edge CDP tunnel."""

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
            result = json.loads(self.socket.recv())
            if result.get("id") == message_id:
                if "error" in result:
                    raise RuntimeError(result["error"])
                return result.get("result", {})

    def close(self) -> None:
        self.socket.close()


def get_json(url: str) -> dict | list:
    with urllib.request.urlopen(url, timeout=6) as response:
        return json.load(response)


def evaluate(page: Cdp, expression: str, *, await_promise: bool = False, user_gesture: bool = False) -> object:
    result = page.call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": await_promise,
        "userGesture": user_gesture,
    })
    if result.get("exceptionDetails"):
        raise RuntimeError(result["exceptionDetails"])
    return result["result"].get("value")


def wait_until(page: Cdp, expression: str, timeout: float = 10) -> object:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = evaluate(page, expression)
        if value:
            return value
        time.sleep(0.2)
    raise TimeoutError(expression)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--debug-base", default="http://127.0.0.1:19223")
    parser.add_argument("--console-url", default="http://192.168.50.243:18766/")
    parser.add_argument("--screenshot", type=Path, default=Path("docs/assets/remote-console-eight-seats.png"))
    parser.add_argument("--mobile-screenshot", type=Path, default=Path("docs/assets/remote-console-mobile.png"))
    parser.add_argument("--popup-screenshot", type=Path, default=Path("docs/assets/remote-console-seat-card.png"))
    parser.add_argument("--output", type=Path, default=Path("docs/REMOTE_CONSOLE_BROWSER_RECEIPT.json"))
    parser.add_argument("--skip-global-reset", action="store_true", help="Do not exercise the destructive reset flow on a shared deployment.")
    args = parser.parse_args()

    version = get_json(f"{args.debug_base}/json/version")
    browser = Cdp(version["webSocketDebuggerUrl"])
    target_id = None
    popup_target_id = None
    page = None
    initial_targets = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
    try:
        target_id = browser.call("Target.createTarget", {
            "url": args.console_url,
            "newWindow": True,
            "width": 1180,
            "height": 900,
        })["targetId"]
        deadline = time.monotonic() + 10
        target = None
        while time.monotonic() < deadline:
            target = next((item for item in get_json(f"{args.debug_base}/json/list") if item["id"] == target_id), None)
            if target and target.get("webSocketDebuggerUrl"):
                break
            time.sleep(0.2)
        assert target and target.get("webSocketDebuggerUrl")
        page = Cdp(target["webSocketDebuggerUrl"])
        page.call("Page.enable")
        page.call("Runtime.enable")
        # Edge may create the requested app window as about:blank when an
        # existing 2x4 test grid owns the browser session.  Navigate explicitly
        # so the acceptance target is deterministic for both LAN and Work URLs.
        page.call("Page.navigate", {"url": args.console_url})
        wait_until(page, "document.readyState === 'complete'")
        wait_until(page, "document.querySelectorAll('.seat').length === 8")
        wait_until(page, "document.getElementById('connText').textContent.includes('已连接')")

        evaluate(page, "localStorage.removeItem('msv-remote-console-client-id'); localStorage.removeItem('msv-remote-console-nickname'); location.reload(); true")
        time.sleep(1)
        wait_until(page, "document.querySelectorAll('.seat').length === 8")
        evaluate(page, "window.__nativeDialogs=[]; for(const name of ['prompt','confirm','alert']) window[name]=(...args)=>{window.__nativeDialogs.push([name,...args]); throw new Error('native dialog: '+name)}; true")
        evaluate(page, "document.querySelector('.seat button:not([disabled])').click(); true", user_gesture=True)
        wait_until(page, "document.getElementById('nicknameDialog').open")
        assert evaluate(page, "document.activeElement.id") == "nicknameInput"
        evaluate(page, "nicknameInput.value='   '; nicknameForm.requestSubmit(); true")
        wait_until(page, "nicknameError.textContent.includes('不能只有空格')")
        assert evaluate(page, "nicknameDialog.open") is True
        targets_before_claim = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
        evaluate(page, "nicknameInput.value='浏览器验收'; nicknameForm.requestSubmit(); true", user_gesture=True)
        wait_until(page, "document.querySelectorAll('.seat.mine').length === 1")

        popup_target = None
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            candidates = [
                item for item in get_json(f"{args.debug_base}/json/list")
                if item["id"] not in targets_before_claim and item.get("type") == "page"
            ]
            popup_target = next((item for item in candidates if "/seat.html?seat=" in item.get("url", "")), None)
            if popup_target:
                break
            time.sleep(0.2)
        assert popup_target and popup_target.get("webSocketDebuggerUrl"), "领取后未创建独立席位卡片窗口"
        popup_target_id = popup_target["id"]
        console_window = browser.call("Browser.getWindowForTarget", {"targetId": target_id})
        popup_window = browser.call("Browser.getWindowForTarget", {"targetId": popup_target_id})
        assert popup_window["windowId"] != console_window["windowId"], "席位必须在独立 popup 窗口，不能是主控同窗标签"
        popup_bounds = popup_window["bounds"]
        assert 300 <= popup_bounds["width"] <= 520, popup_bounds
        assert 450 <= popup_bounds["height"] <= 920, popup_bounds

        popup_page = Cdp(popup_target["webSocketDebuggerUrl"])
        try:
            popup_page.call("Page.enable")
            popup_page.call("Runtime.enable")
            wait_until(popup_page, "location.pathname.endsWith('/seat.html')")
            popup_visible = evaluate(popup_page, "({title:document.title, openerIsNull:opener===null, width:innerWidth, height:innerHeight})")
            assert popup_visible["openerIsNull"] is True
            assert popup_visible["width"] <= 520
            popup_shot = popup_page.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
            args.popup_screenshot.parent.mkdir(parents=True, exist_ok=True)
            args.popup_screenshot.write_bytes(base64.b64decode(popup_shot["data"]))
        finally:
            popup_page.close()

        visible = evaluate(page, "({title:document.title, heading:document.querySelector('h1').textContent, connection:document.getElementById('connText').textContent, course:document.getElementById('courseName').textContent, coverage:document.getElementById('courseCoverage').textContent, seats:[...document.querySelectorAll('.seat')].map(x=>x.innerText), mine:document.querySelectorAll('.seat.mine').length, other:document.querySelectorAll('.seat.other').length})")
        assert visible["heading"] == "测试席位控制台"
        assert visible["mine"] == 1
        assert len(visible["seats"]) == 8
        assert all(code in "\n".join(visible["seats"]) for code in [f"W{i:02d}" for i in range(8)])
        assert "5 步 / 13 块" in visible["coverage"]
        claimed_title = evaluate(page, "document.querySelector('.seat.mine h3').textContent")
        assert claimed_title.endswith(" · 浏览器验收"), claimed_title

        # The stable per-seat window name must focus/reuse the existing card
        # instead of spawning a second popup for the same seat.
        targets_before_reopen = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
        evaluate(page, "document.querySelector('.seat.mine button:not(.release)').click(); true", user_gesture=True)
        time.sleep(0.5)
        targets_after_reopen = {item["id"] for item in get_json(f"{args.debug_base}/json/list")}
        assert targets_after_reopen == targets_before_reopen, "重新打开同席位不应生成重复窗口"

        evaluate(page, "editNick.click(); true")
        wait_until(page, "nicknameDialog.open")
        evaluate(page, "nicknameInput.value='浏览器改名验收'; nicknameForm.requestSubmit(); true")
        wait_until(page, "document.querySelector('.seat.mine h3').textContent.endsWith(' · 浏览器改名验收')")
        renamed_by_stranger = evaluate(page, "fetch(new URL('api/console?clientId=stranger_browser_123456',new URL('.',location.href))).then(r=>r.json()).then(x=>x.data.seats.find(s=>s.claimed).claimedBy)", await_promise=True)
        assert renamed_by_stranger == "浏览器改名验收"

        page.call("Page.bringToFront")
        screenshot = page.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        args.screenshot.parent.mkdir(parents=True, exist_ok=True)
        args.screenshot.write_bytes(base64.b64decode(screenshot["data"]))

        page.call("Emulation.setDeviceMetricsOverride", {
            "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True,
        })
        time.sleep(0.3)
        mobile = evaluate(page, "({innerWidth,scrollWidth:document.documentElement.scrollWidth,seatCards:document.querySelectorAll('.seat').length,gridColumns:getComputedStyle(document.getElementById('seatGrid')).gridTemplateColumns})")
        assert mobile["innerWidth"] == 390
        assert mobile["scrollWidth"] <= 390
        assert mobile["seatCards"] == 8
        assert " " not in mobile["gridColumns"].strip(), mobile["gridColumns"]
        mobile_shot = page.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        args.mobile_screenshot.parent.mkdir(parents=True, exist_ok=True)
        args.mobile_screenshot.write_bytes(base64.b64decode(mobile_shot["data"]))

        browser.call("Target.closeTarget", {"targetId": popup_target_id})
        popup_target_id = None
        evaluate(page, "document.querySelector('.seat.mine .release').click(); true", user_gesture=True)
        wait_until(page, "document.querySelectorAll('.seat.mine').length === 0")

        if not args.skip_global_reset:
            evaluate(page, "resetBtn.click(); true")
            wait_until(page, "resetDialog.open")
            assert evaluate(page, "resetInput.value==='' && resetError.textContent==='' ") is True
            evaluate(page, "resetForm.requestSubmit(); true")
            wait_until(page, "resetError.textContent.includes('未执行重置')")
            evaluate(page, "resetInput.value='WRONG'; resetForm.requestSubmit(); true")
            assert evaluate(page, "resetDialog.open") is True
            evaluate(page, "document.querySelector('#resetDialog .dialog-cancel').click(); true")
            wait_until(page, "!resetDialog.open")
            evaluate(page, "resetBtn.click(); true")
            wait_until(page, "resetDialog.open")
            assert evaluate(page, "resetInput.value==='' && resetError.textContent==='' ") is True
            evaluate(page, "resetInput.value='RESET ALL TEST SEATS'; resetForm.requestSubmit(); true")
            wait_until(page, "!resetDialog.open")
        assert evaluate(page, "window.__nativeDialogs.length") == 0
        receipt = {
            "schemaVersion": 1,
            "verifiedAt": datetime.now(timezone.utc).isoformat(),
            "target": args.console_url,
            "browser": version["Browser"],
            "title": visible["title"],
            "connection": visible["connection"],
            "course": visible["course"],
            "coverage": visible["coverage"],
            "seatCards": len(visible["seats"]),
            "windowIdsVisible": True,
            "claimRendered": True,
            "releaseRendered": True,
            "nicknameDialogValidated": True,
            "nicknameWhitespaceRejectedInline": True,
            "claimedRoleIncludesNickname": True,
            "nicknameRenameVisibleToOtherClient": True,
            "seatOpenedAsIndependentPopup": True,
            "seatPopupReusedByStableName": True,
            "seatPopupOpenerIsNull": True,
            "seatPopupBounds": popup_bounds,
            "resetDialogValidated": not args.skip_global_reset,
            "globalResetSkippedForSharedDeployment": args.skip_global_reset,
            "nativeDialogsObserved": 0,
            "mobileViewport": {**mobile, "noHorizontalOverflow": True},
            "screenshot": str(args.screenshot),
            "mobileScreenshot": str(args.mobile_screenshot),
            "popupScreenshot": str(args.popup_screenshot),
            "containsCredentialsOrCapabilities": False,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(receipt, ensure_ascii=False))
    finally:
        if page:
            page.close()
        if target_id:
            try:
                browser.call("Target.closeTarget", {"targetId": target_id})
            except Exception:
                pass
        if popup_target_id:
            try:
                browser.call("Target.closeTarget", {"targetId": popup_target_id})
            except Exception:
                pass
        # Close only targets created by this acceptance run, leaving any
        # existing W00-W07 test grid intact.
        try:
            for target in get_json(f"{args.debug_base}/json/list"):
                if target["id"] not in initial_targets:
                    browser.call("Target.closeTarget", {"targetId": target["id"]})
        except Exception:
            pass
        browser.close()


if __name__ == "__main__":
    main()
