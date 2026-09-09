#!/usr/bin/env python3
"""Browser acceptance for T-086 role-visible, independently browsed script pages."""
from __future__ import annotations

import http.client
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t086-script-runtime"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log_path: Path) -> None:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(log_path.read_text(encoding="utf-8", errors="replace"))
        try:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
            connection.request("GET", "/api/auth/session")
            response = connection.getresponse()
            response.read()
            connection.close()
            if response.status in (200, 401):
                return
        except OSError:
            pass
        time.sleep(0.2)
    raise TimeoutError(log_path.read_text(encoding="utf-8", errors="replace"))


def api(page, path: str, method: str = "GET", body: object | None = None) -> object:
    result = page.evaluate(
        """async ({path, method, body}) => {
          const response = await fetch(path, {
            method,
            credentials: 'same-origin',
            cache: 'no-store',
            headers: body === null ? undefined : {'content-type':'application/json'},
            body: body === null ? undefined : JSON.stringify(body),
          });
          const payload = await response.json();
          return {status: response.status, payload};
        }""",
        {"path": path, "method": method, "body": body},
    )
    assert result["status"] < 400, result
    return result["payload"]["data"]


def login(page, base: str, username: str, password: str) -> None:
    page.goto(f"{base}/auth/login/?returnTo=%2Fstudio%2F", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url("**/studio/")


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    admin = {"username": f"t086-admin-{stamp}", "name": "T086 剧本验收管理员", "password": f"T086 browser {secrets.token_urlsafe(18)}!"}
    mentor_names = {"P": "产品导师", "D": "开发导师", "M": "市场导师", "O": "运营导师"}
    mentors = [
        {"username": f"t086-mentor-{role.lower()}-{stamp}", "name": mentor_names[role], "password": f"T086 mentor {role} {secrets.token_urlsafe(16)}!"}
        for role in ("P", "D", "M", "O")
    ]
    learners = [
        {"username": f"t086-builder-{index}-{stamp}", "name": f"Young Builder {index}", "password": f"T086 learner {index} {secrets.token_urlsafe(16)}!"}
        for index in range(1, 5)
    ]
    fixture = {
        "dm": admin,
        "mentors": mentors,
        "learners": learners,
        "outsider": {"username": f"t086-outside-{stamp}", "name": "T086 Outside", "password": f"T086 outside {secrets.token_urlsafe(16)}!"},
    }
    result: dict[str, object] = {"ok": False, "base": base, "independentClients": False, "roleTabs": 0}

    with tempfile.TemporaryDirectory(prefix="msv-t086-browser-") as temp:
        temp_path = Path(temp)
        fixture_path = temp_path / "accounts.json"
        seed_path = temp_path / "seed.sql"
        fixture_path.write_text(json.dumps(fixture, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(fixture_path), "--output", str(seed_path),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local",
            "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed_path),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)

        log_path = temp_path / "wrangler.log"
        with log_path.open("w", encoding="utf-8") as wrangler_log:
            process = subprocess.Popen([
                str(REPO / "node_modules" / ".bin" / "wrangler"), "dev", "--config", "wrangler.json",
                "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port),
                "--no-show-interactive-dev-session",
            ], cwd=REPO / "dist" / "server", env=env, stdout=wrangler_log, stderr=subprocess.STDOUT, text=True)
            try:
                wait_ready(port, process, log_path)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    control = context.new_page()
                    errors: list[str] = []
                    failed: list[str] = []
                    for page in (control,):
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        page.on("requestfailed", lambda request: failed.append(request.url) if request.resource_type in ("document", "script", "stylesheet") else None)
                    login(control, base, admin["username"], admin["password"])

                    bootstrap = api(control, "/api/studio/bootstrap")
                    released = next(item for item in bootstrap["versions"] if item["released"] and item["ref"]["courseId"] == "google-1995-2004")
                    course = released["course"]
                    course["title"] = f"{course['title']} · T086 Browser {stamp}"
                    candidate = api(control, "/api/studio/candidates", "POST", {"course": course})
                    policy = released["learnerPolicy"]
                    receipt = api(control, "/api/studio/view-acceptance", "POST", {
                        "courseRef": candidate,
                        "reviewedBlockIds": [block["id"] for block in course["blocks"]],
                        "reviewedLearnerCounts": list(range(policy["minCount"], policy["maxCount"] + 1)),
                    })
                    courseware = [{
                        "mentorRole": item["mentorRole"], "packageId": item["packageId"], "slug": item["slug"],
                        "revision": item["releasedRevision"], "digest": item["releasedDigest"],
                    } for item in bootstrap["courseware"]]
                    classroom = api(control, "/api/platform/classrooms", "POST", {
                        "environment": "test",
                        "title": "T086 角色可见剧本浏览器验收",
                        "learnerCount": 4,
                        "courseRef": candidate,
                        "viewAcceptanceReceiptId": receipt["receiptId"],
                        "coursewareRefs": courseware,
                        "adminDmProfileIds": [bootstrap["user"]["userId"]],
                        "mentorSeats": [{"mentorRole": role, "profileId": mentors[index]["username"]} for index, role in enumerate(("P", "D", "M", "O"))],
                        "learnerProfileIds": [item["username"] for item in learners],
                    })
                    room_id = classroom["classroomId"]

                    # Stage 1 is a desktop content audit: arrows change blocks and
                    # hover/click reveal the complete private projection fields.
                    control.goto(f"{base}/studio/preview/?course={candidate['courseId']}&revision={candidate['revision']}&digest={candidate['digest']}", wait_until="networkidle")
                    active_block = control.locator('button[data-active="true"] b')
                    expect(active_block).to_contain_text("B01")
                    control.keyboard.press("ArrowRight")
                    expect(active_block).to_contain_text("B02")
                    mentor_card = control.locator('article[data-kind="mentor"]').first
                    mentor_card.hover()
                    expect(mentor_card.locator('[class*="viewDetails"]')).to_be_visible()
                    mentor_card.get_by_role("button", name="固定展开").click()
                    expect(mentor_card.get_by_role("button", name="收起")).to_be_visible()
                    control.keyboard.press("Home")
                    expect(active_block).to_contain_text("B01")

                    # A normal, unmodified click must enter the Classroom.
                    control.goto(f"{base}/classroom/", wait_until="networkidle")
                    control.get_by_role("link", name="进入我的课堂").click()
                    control.wait_for_url(f"**/classroom/{room_id}/")
                    expect(control.locator("h1").filter(has_text="B01 ·")).to_be_visible()
                    control.goto(f"{base}/classroom/{room_id}/control?block=B01", wait_until="networkidle")
                    expect(control.locator("h1").filter(has_text="B01 ·")).to_be_visible()

                    observer = context.new_page()
                    observer.on("pageerror", lambda error: errors.append(str(error)))
                    observer.on("requestfailed", lambda request: failed.append(request.url) if request.resource_type in ("document", "script", "stylesheet") else None)
                    observer.goto(f"{base}/classroom/{room_id}/?block=B01", wait_until="networkidle")
                    expect(observer.locator("h1").filter(has_text="B01 ·")).to_be_visible()

                    # Unlocking moves only the actor. The other browser remains on
                    # B01, receives a notice, and gets a one-click return to latest.
                    control.get_by_role("button", name="确认解锁下一页 →").click()
                    expect(control.get_by_role("dialog")).to_be_visible()
                    control.get_by_role("button", name="确认解锁并进入").click()
                    expect(control.locator("h1").filter(has_text="B02 ·")).to_be_visible(timeout=10_000)
                    expect(observer.get_by_role("button", name="回到最新解锁 · B02")).to_be_visible(timeout=10_000)
                    expect(observer.locator("h1").filter(has_text="B01 ·")).to_be_visible()
                    observer.get_by_role("button", name="回到最新解锁 · B02").click()
                    expect(observer.locator("h1").filter(has_text="B02 ·")).to_be_visible()
                    observer.keyboard.press("ArrowLeft")
                    expect(observer.locator("h1").filter(has_text="B01 ·")).to_be_visible()
                    observer.keyboard.press("End")
                    expect(observer.locator("h1").filter(has_text="B02 ·")).to_be_visible()

                    # Test role tabs use the same real API. They do not impersonate
                    # a platform session and do not leave this Test Classroom.
                    tabs = observer.locator('nav[aria-label="Test Classroom 角色视角"] button')
                    assert tabs.count() == 10, tabs.count()  # control + 4 mentor + 4 learner + screen
                    observer.get_by_role("button", name="学员 2", exact=True).click()
                    expect(observer.get_by_text("TEST CLASSROOM · Young Builder 2", exact=True)).to_be_visible(timeout=10_000)
                    observer.locator("#block-work").fill("学员 2 在 B02 的独立活动记录")
                    observer.get_by_role("button", name="保存 B02 活动记录").click()
                    expect(observer.get_by_text("已保存到 B02", exact=False)).to_be_visible()
                    observer.get_by_role("button", name="中控", exact=True).click()
                    expect(observer.get_by_text("学员 2 在 B02 的独立活动记录", exact=True)).to_be_visible(timeout=10_000)

                    observer.screenshot(path=str(QA / "historical-and-role-tabs.png"), full_page=True)
                    observer.set_viewport_size({"width": 390, "height": 844})
                    observer.wait_for_timeout(100)
                    geometry = observer.evaluate("() => ({width:innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth})")
                    assert geometry["body"] <= geometry["width"] + 1
                    assert geometry["root"] <= geometry["width"] + 1
                    observer.screenshot(path=str(QA / "mobile-control.png"), full_page=True)

                    assert not errors, errors
                    assert not failed, failed
                    result.update({
                        "ok": True,
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "classroomId": room_id,
                        "candidate": candidate,
                        "viewReceiptId": receipt["receiptId"],
                        "stage1Keyboard": True,
                        "stage1FullFields": True,
                        "nativeClassroomLink": True,
                        "independentClients": True,
                        "unlockNotification": True,
                        "returnToLatest": True,
                        "keyboardNavigation": ["ArrowLeft", "ArrowRight", "Home", "End"],
                        "roleTabs": tabs.count(),
                        "realRoleSubmission": True,
                        "mobileGeometry": geometry,
                        "pageErrors": 0,
                        "requestFailures": 0,
                        "screenshots": [
                            "docs/qa/t086-script-runtime/historical-and-role-tabs.png",
                            "docs/qa/t086-script-runtime/mobile-control.png",
                        ],
                    })
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    (QA / "browser-receipt.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
