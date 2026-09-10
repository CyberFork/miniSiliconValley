#!/usr/bin/env python3
"""T-111 browser acceptance on the compiled ClassroomHub.

The app and authentication use a temporary local D1 database.  Only the
Classroom list/archive endpoints are intercepted with two synthetic Test
Classrooms, so this exercises the real React UI without creating or signing a
human acceptance receipt and without touching production.
"""
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
from urllib.parse import parse_qs, quote, urlparse

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t111-test-classrooms"


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


def path_query_fragment(url: str) -> tuple[str, dict[str, list[str]], str]:
    parsed = urlparse(url)
    return parsed.path, parse_qs(parsed.query), parsed.fragment


def room(room_id: str, digest_character: str, title: str) -> dict[str, object]:
    return {
        "id": room_id,
        "title": title,
        "environment": "test",
        "lifecycle": "running",
        "learnerCount": 4,
        "courseRef": {
            "courseId": "eleme-2008-find-problem",
            "schemaVersion": 1,
            "revision": 12,
            "digest": digest_character * 64,
            "status": "candidate",
        },
        "script": {
            "stateMachineVersion": 3,
            "unlockedThroughBlockId": "B04",
            "unlockedThroughIndex": 3,
            "updatedAt": "2026-09-11T08:00:00.000Z",
            "version": 7,
        },
        "mentorRole": "P",
        "learnerSeat": None,
        "isAdminDm": True,
        "adminDmMode": "primary",
        "canDelegateAdminDm": True,
        "acceptance": {"viewReceiptId": "view-receipt-t111", "uiReceiptId": None},
        "archive": None,
        "resetGeneration": 4,
        "updatedAt": "2026-09-11T08:00:00.000Z",
    }


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    username = f"t111-admin-{stamp}"
    password = f"T111 browser {secrets.token_urlsafe(18)}!"
    rooms = [room("t111-room-a", "a", "r12 · 产品导师回归 A"), room("t111-room-b", "b", "r12 · 产品导师回归 B")]
    archive_payloads: list[dict[str, object]] = []

    with tempfile.TemporaryDirectory(prefix="msv-t111-browser-") as temp:
        temp_path = Path(temp)
        accounts = temp_path / "accounts.json"
        seed = temp_path / "seed.sql"
        accounts.write_text(json.dumps({
            "dm": {"username": username, "name": "T111 生命周期管理员", "password": password},
            "mentors": [],
            "learners": [],
            "outsider": {"username": f"{username}-outside", "name": "T111 Outside", "password": f"{password} outside"},
        }, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(accounts), "--output", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)
        subprocess.run([
            str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local",
            "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)

        log_path = temp_path / "wrangler.log"
        with log_path.open("w", encoding="utf-8") as wrangler_log:
            process = subprocess.Popen([
                str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json",
                "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port),
                "--no-show-interactive-dev-session",
            ], cwd=REPO / "dist/server", env=env, stdout=wrangler_log, stderr=subprocess.STDOUT, text=True)
            try:
                wait_ready(port, process, log_path)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    page = browser.new_page(viewport={"width": 1440, "height": 1000})
                    page_errors: list[str] = []
                    native_dialogs: list[str] = []
                    page.on("pageerror", lambda error: page_errors.append(str(error)))
                    page.on("dialog", lambda dialog: (native_dialogs.append(dialog.type), dialog.dismiss()))

                    def list_handler(route) -> None:
                        if route.request.method != "GET":
                            route.fallback()
                            return
                        route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "data": rooms}))

                    def archive_handler(route) -> None:
                        payload = route.request.post_data_json
                        archive_payloads.append(payload)
                        target_id = urlparse(route.request.url).path.split("/")[-2]
                        target = next(item for item in rooms if item["id"] == target_id)
                        target["archive"] = {
                            "archivedAt": "2026-09-11T09:00:00.000Z",
                            "archivedByProfileId": "t111-local-admin",
                            "previousLifecycle": target["lifecycle"],
                            "reason": payload.get("reason", ""),
                        }
                        target["updatedAt"] = "2026-09-11T09:00:00.000Z"
                        route.fulfill(status=200, content_type="application/json", body=json.dumps({
                            "ok": True,
                            "data": {
                                "archived": True,
                                "archivedAt": target["archive"]["archivedAt"],
                                "classroomId": target_id,
                                "idempotent": False,
                                "restorePolicy": "create-new-test",
                            },
                        }))

                    page.route("**/api/platform/classrooms", list_handler)
                    page.route("**/api/platform/classrooms/*/archive", archive_handler)
                    destination = "/classroom/"
                    page.goto(f"{base}/auth/login/?returnTo={quote(destination, safe='')}", wait_until="networkidle")
                    page.locator('input[name="username"]').fill(username)
                    page.locator('input[name="password"]').fill(password)
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
                    page.wait_for_url("**/classroom/")
                    expect(page.get_by_role("heading", name="课堂中心")).to_be_visible()
                    expect(page.get_by_text("r12 · 产品导师回归 A", exact=True)).to_be_visible()
                    expect(page.get_by_text("r12 · 产品导师回归 B", exact=True)).to_be_visible()

                    # The entry lives at the TEST heading and is a normal anchor.
                    create_entry = page.get_by_role("link", name="＋ 新建测试课堂")
                    expect(create_entry).to_have_attribute("href", "#factory")
                    create_entry.click()
                    expect(page.locator("#factory")).to_be_visible()
                    assert urlparse(page.url).fragment == "factory"

                    active_a = page.locator("article", has_text="r12 · 产品导师回归 A")
                    for expected in ("t111-room-a", "eleme-2008-find-problem@r12", "a" * 64, "4 学员", "RUNNING"):
                        expect(active_a).to_contain_text(expected)
                    expect(active_a.locator("time")).to_have_attribute("datetime", "2026-09-11T08:00:00.000Z")

                    active_a.get_by_role("button", name="归档测试课堂").click()
                    dialog = page.get_by_role("dialog", name="归档这一个测试课堂？")
                    expect(dialog).to_be_visible()
                    expect(dialog).to_contain_text("重置")
                    expect(dialog).to_contain_text("永久删除")
                    dialog.locator("textarea").fill("r13 已替代本轮测试")
                    dialog.get_by_role("button", name="确认归档为只读").click()
                    expect(page.get_by_role("heading", name="已归档测试课堂")).to_be_visible()
                    expect(page.get_by_text("r12 · 产品导师回归 B", exact=True)).to_be_visible()
                    assert len(page.get_by_text("r12 · 产品导师回归 A", exact=True).all()) == 1
                    archived = page.locator("article", has_text="r12 · 产品导师回归 A")
                    expect(archived).to_contain_text("READ ONLY")
                    expect(archived).to_contain_text("r13 已替代本轮测试")
                    assert native_dialogs == [], native_dialogs
                    assert archive_payloads == [{
                        "expectedRunId": "t111-room-a:run:4",
                        "expectedResetGeneration": 4,
                        "expectedScriptVersion": 7,
                        "idempotencyKey": archive_payloads[0]["idempotencyKey"],
                        "reason": "r13 已替代本轮测试",
                    }], archive_payloads
                    assert str(archive_payloads[0]["idempotencyKey"]).startswith("archive.")
                    page.screenshot(path=str(QA / "active-and-archived-test-classrooms.png"), full_page=True)

                    # Both exact links are normal navigation and preserve identity.
                    deep = archived.get_by_role("link", name="打开只读档案 →")
                    expect(deep).to_have_attribute("href", "/classroom/t111-room-a/")
                    deep.click()
                    page.wait_for_url("**/classroom/t111-room-a/")
                    assert urlparse(page.url).path == "/classroom/t111-room-a/"
                    page.go_back(wait_until="networkidle")
                    recreate = page.locator("article", has_text="r12 · 产品导师回归 A").get_by_role("link", name="以此 exact 版本新建 →")
                    recreate_href = recreate.get_attribute("href")
                    assert recreate_href
                    recreate.click()
                    page.wait_for_url(lambda url: urlparse(str(url)).fragment == "factory")
                    path, query, fragment = path_query_fragment(page.url)
                    assert path == "/classroom/" and fragment == "factory"
                    assert query == {
                        "course": ["eleme-2008-find-problem"],
                        "revision": ["12"],
                        "digest": ["a" * 64],
                        "environment": ["test"],
                        "viewReceipt": ["view-receipt-t111"],
                    }, query

                    responsive: dict[str, object] = {}
                    for name, width, height in (("phone", 390, 844), ("pad", 768, 1024)):
                        page.set_viewport_size({"width": width, "height": height})
                        geometry = page.evaluate("() => ({inner:innerWidth, root:document.documentElement.scrollWidth, body:document.body.scrollWidth})")
                        assert geometry["root"] <= geometry["inner"] + 1, (name, geometry)
                        assert geometry["body"] <= geometry["inner"] + 1, (name, geometry)
                        responsive[name] = geometry
                        if name == "phone":
                            page.screenshot(path=str(QA / "archived-test-classroom-phone.png"), full_page=True)

                    assert not page_errors, page_errors
                    result = {
                        "ok": True,
                        "scope": "compiled app + temporary local D1 + intercepted synthetic classroom lifecycle; no production writes",
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "ordinaryCreateAnchor": True,
                        "exactIdentity": True,
                        "customArchiveDialog": True,
                        "archiveCasPayload": {key: archive_payloads[0][key] for key in ("expectedRunId", "expectedResetGeneration", "expectedScriptVersion")},
                        "isolatedArchive": True,
                        "exactDeepLink": True,
                        "exactRecreateLink": query,
                        "responsive": responsive,
                        "humanAcceptanceReceiptCreated": False,
                    }
                    (QA / "browser-automated-evidence.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(json.dumps(result, ensure_ascii=False))
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()


if __name__ == "__main__":
    main()
