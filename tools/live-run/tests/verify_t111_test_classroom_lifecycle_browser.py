#!/usr/bin/env python3
"""Real compiled-app browser acceptance for T-111 Test deletion.

All classrooms, requests, dependency evidence and deletes use a temporary local
D1.  The script never contacts or mutates the production database and never
claims that its synthetic receipt is a human acceptance.
"""
from __future__ import annotations

import http.client
import json
import os
import re
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import quote, urlparse

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t111-test-classrooms"
UI_CHECKS = (
    "sameRuntimeUi", "membershipsAndRbac", "mentorTasksAndCourseware", "learnerTasks",
    "learnerPrivacy", "sharedScreenRedaction", "scriptUnlockFlow", "independentNavigation",
    "testRoleSwitching", "explicitClassroomFinish", "refreshAndRelogin", "concurrencyConflict",
    "testReset", "responsiveLayouts", "immutableRuntime", "exactVersions",
)


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


def request(page, path: str, method: str = "GET", body: object | None = None) -> dict[str, object]:
    return page.evaluate(
        """async ({path, method, body}) => {
          const response = await fetch(path, {
            method, credentials:'same-origin', cache:'no-store',
            headers: body === null ? undefined : {'content-type':'application/json'},
            body: body === null ? undefined : JSON.stringify(body),
          });
          let payload = null;
          try { payload = await response.json(); } catch {}
          return {status:response.status, payload};
        }""",
        {"path": path, "method": method, "body": body},
    )


def api(page, path: str, method: str = "GET", body: object | None = None) -> object:
    result = request(page, path, method, body)
    assert int(result["status"]) < 400, result
    return result["payload"]["data"]


def login(page, base: str, username: str, password: str, destination: str) -> None:
    page.goto(f"{base}/auth/login/?returnTo={quote(destination, safe='')}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(lambda url: urlparse(str(url)).path == destination)


def room_card(page, title: str):
    return page.locator("article", has_text=title)


def open_delete(page, title: str):
    card = room_card(page, title)
    expect(card).to_be_visible()
    card.get_by_role("button", name="删除测试课堂").click()
    dialog = page.get_by_role("dialog", name="删除这一个测试课堂？")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_text(title, exact=True)).to_be_visible()
    expect(dialog.get_by_text("正在检查实例范围", exact=False)).not_to_be_visible(timeout=10_000)
    return dialog


def confirm_delete(dialog) -> None:
    checkbox = dialog.get_by_label(re.compile("我已核对 classroomId"))
    checkbox.check()
    button = dialog.get_by_role("button", name="确认永久删除 TEST")
    expect(button).to_be_enabled()
    button.click()


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port, stamp = free_port(), secrets.token_hex(4)
    base = f"http://127.0.0.1:{port}"
    admin = {"username": f"t111-admin-{stamp}", "name": "T111 删除管理员", "password": f"T111 admin {secrets.token_urlsafe(18)}!"}
    mentors = [
        {"username": f"t111-mentor-{role.lower()}-{stamp}", "name": f"T111 {role} 导师", "password": f"T111 mentor {role} {secrets.token_urlsafe(16)}!"}
        for role in ("P", "D", "M", "O")
    ]
    learners = [
        {"username": f"t111-learner-{index}-{stamp}", "name": f"T111 Young Builder {index}", "password": f"T111 learner {index} {secrets.token_urlsafe(16)}!"}
        for index in range(1, 5)
    ]
    fixture = {
        "dm": admin, "mentors": mentors, "learners": learners,
        "outsider": {"username": f"t111-outside-{stamp}", "name": "T111 Outside", "password": f"T111 outside {secrets.token_urlsafe(16)}!"},
    }
    titles = {
        "active": f"T111 可删除活跃课堂 {stamp}",
        "archive": f"T111 可删除历史课堂 {stamp}",
        "blocked": f"T111 回执阻断课堂 {stamp}",
        "network": f"T111 网络失败保留课堂 {stamp}",
    }

    with tempfile.TemporaryDirectory(prefix="msv-t111-browser-") as temp:
        root = Path(temp)
        accounts, seed = root / "accounts.json", root / "seed.sql"
        accounts.write_text(json.dumps(fixture, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(accounts), "--output", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)
        subprocess.run([
            str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local",
            "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)

        log_path = root / "wrangler.log"
        with log_path.open("w", encoding="utf-8") as output:
            process = subprocess.Popen([
                str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json",
                "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port),
                "--no-show-interactive-dev-session",
            ], cwd=REPO / "dist/server", env=env, stdout=output, stderr=subprocess.STDOUT, text=True)
            try:
                wait_ready(port, process, log_path)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    admin_context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    page = admin_context.new_page()
                    errors: list[str] = []
                    failed_assets: list[str] = []
                    delete_payloads: list[dict[str, object]] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("requestfailed", lambda req: failed_assets.append(req.url) if req.resource_type in ("document", "script", "stylesheet") else None)
                    page.on("request", lambda req: delete_payloads.append({"url": req.url, "body": req.post_data_json}) if req.method == "DELETE" else None)
                    login(page, base, admin["username"], admin["password"], "/studio/")

                    bootstrap = api(page, "/api/studio/bootstrap")
                    released = next(item for item in bootstrap["versions"] if item["released"] and item["ref"]["courseId"] == "google-1995-2004")
                    course = released["course"]
                    course["title"] = f"{course['title']} · T111 Browser {stamp}"
                    candidate = api(page, "/api/studio/candidates", "POST", {"course": course, "expectedCandidateRef": None})
                    policy = released["learnerPolicy"]
                    view_receipt = api(page, "/api/studio/view-acceptance", "POST", {
                        "courseRef": candidate,
                        "reviewedBlockIds": [block["id"] for block in course["blocks"]],
                        "reviewedLearnerCounts": list(range(policy["minCount"], policy["maxCount"] + 1)),
                    })
                    preferred = {"P": "product-mentor-foundations", "D": "development-mentor-ligun", "M": "market-mentor-user-system", "O": "operations-mentor-field-kit"}
                    courseware = [{
                        "mentorRole": item["mentorRole"], "packageId": item["packageId"], "slug": item["slug"],
                        "revision": item["latestRevision"], "digest": item["latestDigest"],
                    } for item in bootstrap["courseware"] if preferred.get(item["mentorRole"]) == item["slug"]]
                    assert {item["mentorRole"] for item in courseware} == {"P", "D", "M", "O"}
                    create_body = {
                        "environment": "test", "learnerCount": 4, "courseRef": candidate,
                        "viewAcceptanceReceiptId": view_receipt["receiptId"], "coursewareRefs": courseware,
                        "adminDmProfileIds": [bootstrap["user"]["userId"]],
                        "mentorSeats": [{"mentorRole": role, "profileId": mentors[index]["username"]} for index, role in enumerate(("P", "D", "M", "O"))],
                        "learnerProfileIds": [item["username"] for item in learners],
                    }
                    rooms: dict[str, str] = {}
                    for kind, title in titles.items():
                        created = api(page, "/api/platform/classrooms", "POST", {**create_body, "title": title})
                        rooms[kind] = created["classroomId"]

                    # Build an isolated synthetic evidence dependency on one
                    # room. It is explicitly not a user/human acceptance.
                    blocked = rooms["blocked"]
                    detail = api(page, f"/api/platform/classrooms/{blocked}?surface=control")
                    for number in range(2, 14):
                        progress = api(page, f"/api/platform/classrooms/{blocked}/control", "POST", {
                            "expectedVersion": detail["script"]["version"],
                            "expectedRunId": detail["runtimeIdentity"]["runId"],
                            "expectedResetGeneration": detail["runtimeIdentity"]["resetGeneration"],
                            "action": {"type": "unlock-next", "nextBlockId": f"B{number:02d}"},
                        })
                        detail["script"] = progress
                    api(page, f"/api/platform/classrooms/{blocked}/finish", "POST", {
                        "expectedRunId": detail["runtimeIdentity"]["runId"],
                        "expectedResetGeneration": detail["runtimeIdentity"]["resetGeneration"],
                        "expectedScriptVersion": detail["script"]["version"],
                        "idempotencyKey": f"t111.synthetic-finish.{stamp}",
                    })
                    synthetic_receipt = api(page, f"/api/platform/classrooms/{blocked}/receipt", "POST", {
                        "checks": {key: True for key in UI_CHECKS},
                        "clientMatrix": [{"browser": "T111 automated fixture", "platform": "temporary local D1", "viewport": {"width": 1440, "height": 1000}}],
                    })

                    page.goto(f"{base}/classroom/", wait_until="networkidle")
                    expect(page.get_by_role("heading", name="课堂中心")).to_be_visible()
                    for title in titles.values():
                        expect(room_card(page, title)).to_be_visible()

                    # Cancel is a real no-op; the confirmation names the exact
                    # instance and keeps the destructive button gated.
                    active_dialog = open_delete(page, titles["active"])
                    expect(active_dialog.get_by_text(rooms["active"], exact=True)).to_be_visible()
                    expect(active_dialog.get_by_text("将永久删除", exact=True)).to_be_visible()
                    expect(active_dialog.get_by_text("明确保留", exact=True)).to_be_visible()
                    expect(active_dialog.get_by_role("button", name="确认永久删除 TEST")).to_be_disabled()
                    active_dialog.get_by_role("button", name="取消，不做任何修改").click()
                    expect(room_card(page, titles["active"])).to_be_visible()
                    assert not delete_payloads, delete_payloads

                    # Active-list deletion uses the actual DELETE API and
                    # physical D1 cascade. Retry is idempotent; a new key is 410.
                    active_dialog = open_delete(page, titles["active"])
                    confirm_delete(active_dialog)
                    expect(room_card(page, titles["active"])).not_to_be_visible(timeout=10_000)
                    assert len(delete_payloads) == 1, delete_payloads
                    active_payload = delete_payloads[0]["body"]
                    old_active = request(page, f"/api/platform/classrooms/{rooms['active']}")
                    assert old_active["status"] == 410 and old_active["payload"]["error"]["code"] == "CLASSROOM_DELETED", old_active
                    replay = request(page, f"/api/platform/classrooms/{rooms['active']}", "DELETE", active_payload)
                    assert replay["status"] == 200 and replay["payload"]["data"]["idempotent"] is True, replay
                    conflicting = request(page, f"/api/platform/classrooms/{rooms['active']}", "DELETE", {**active_payload, "idempotencyKey": f"t111.other-key.{stamp}"})
                    assert conflicting["status"] == 410 and conflicting["payload"]["error"]["code"] == "CLASSROOM_ALREADY_DELETED", conflicting

                    # Archive through the real UI, then delete from the history
                    # list. Archive is not accepted as a substitute for delete.
                    archive_card = room_card(page, titles["archive"])
                    archive_card.get_by_role("button", name="归档测试课堂").click()
                    archive_dialog = page.get_by_role("dialog", name="归档这一个测试课堂？")
                    expect(archive_dialog).to_be_visible()
                    archive_dialog.locator("textarea").fill("T111 历史入口删除验证")
                    archive_dialog.get_by_role("button", name="确认归档为只读").click()
                    history = page.get_by_role("heading", name="已归档测试课堂")
                    expect(history).to_be_visible(timeout=10_000)
                    archived_card = room_card(page, titles["archive"])
                    expect(archived_card).to_contain_text("READ ONLY")
                    archived_dialog = open_delete(page, titles["archive"])
                    expect(archived_dialog.get_by_text("READ ONLY", exact=False)).to_be_visible()
                    confirm_delete(archived_dialog)
                    expect(room_card(page, titles["archive"])).not_to_be_visible(timeout=10_000)
                    old_archive = request(page, f"/api/platform/classrooms/{rooms['archive']}")
                    assert old_archive["status"] == 410 and old_archive["payload"]["error"]["code"] == "CLASSROOM_DELETED", old_archive

                    # Evidence-linked Test remains visible and reports the exact
                    # blocker. No destructive confirmation is offered.
                    blocked_dialog = open_delete(page, titles["blocked"])
                    expect(blocked_dialog.get_by_text("当前不能删除", exact=False)).to_be_visible()
                    expect(blocked_dialog.get_by_text(synthetic_receipt["receiptId"], exact=False)).to_be_visible()
                    expect(blocked_dialog.get_by_role("button", name="确认永久删除 TEST")).to_have_count(0)
                    blocked_dialog.get_by_role("button", name="取消，不做任何修改").click()
                    expect(room_card(page, titles["blocked"])).to_be_visible()

                    # A network failure must stay in the dialog, say that no
                    # delete happened, refresh the preview, and preserve the room.
                    network_dialog = open_delete(page, titles["network"])
                    network_pattern = f"**/api/platform/classrooms/{rooms['network']}"
                    def fail_delete(route):
                        if route.request.method == "DELETE":
                            route.abort("failed")
                        else:
                            route.fallback()
                    page.route(network_pattern, fail_delete)
                    confirm_delete(network_dialog)
                    expect(network_dialog.get_by_text("删除没有执行", exact=True).first).to_be_visible(timeout=10_000)
                    expect(network_dialog.get_by_text("已重新读取目标状态", exact=False)).to_be_visible()
                    page.unroute(network_pattern, fail_delete)
                    network_dialog.get_by_role("button", name="取消，不做任何修改").click()
                    expect(room_card(page, titles["network"])).to_be_visible()
                    network_detail = request(page, f"/api/platform/classrooms/{rooms['network']}")
                    assert network_detail["status"] == 200, network_detail

                    # A classroom learner sees the remaining rooms but never a
                    # delete control, and the API independently rejects both
                    # preview and mutation attempts.
                    learner_context = browser.new_context(viewport={"width": 768, "height": 1024}, has_touch=True, is_mobile=True)
                    learner = learner_context.new_page()
                    learner.on("pageerror", lambda error: errors.append(str(error)))
                    login(learner, base, learners[0]["username"], learners[0]["password"], "/classroom/")
                    expect(room_card(learner, titles["network"])).to_be_visible()
                    assert learner.get_by_role("button", name="删除测试课堂").count() == 0
                    denied_preview = request(learner, f"/api/platform/classrooms/{rooms['network']}?deletePreview=1")
                    assert denied_preview["status"] == 403 and denied_preview["payload"]["error"]["code"] == "ADMIN_DM_REQUIRED", denied_preview
                    denied_delete = request(learner, f"/api/platform/classrooms/{rooms['network']}", "DELETE", {
                        "expectedRunId": f"{rooms['network']}:run:0", "expectedResetGeneration": 0,
                        "expectedScriptVersion": 1, "expectedStateToken": "a" * 64,
                        "confirmClassroomId": rooms["network"], "idempotencyKey": f"t111.learner-denied.{stamp}",
                    })
                    assert denied_delete["status"] == 403 and denied_delete["payload"]["error"]["code"] == "ADMIN_DM_REQUIRED", denied_delete

                    page.set_viewport_size({"width": 768, "height": 1024})
                    geometry = page.evaluate("() => ({inner:innerWidth, root:document.documentElement.scrollWidth, body:document.body.scrollWidth})")
                    assert geometry["root"] <= geometry["inner"] + 1, geometry
                    assert geometry["body"] <= geometry["inner"] + 1, geometry
                    page.screenshot(path=str(QA / "dependency-blocked-and-network-preserved.png"), full_page=True)
                    assert not errors, errors
                    assert not failed_assets, failed_assets
                    result = {
                        "ok": True,
                        "scope": "compiled app + actual UI/API + temporary local D1; no production writes",
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "actualDeleteRequests": len(delete_payloads),
                        "cancelWasNoop": True,
                        "activeTestPhysicallyDeleted": True,
                        "archivedTestPhysicallyDeletedFromHistory": True,
                        "oldLinks": {"active": old_active["status"], "archived": old_archive["status"]},
                        "idempotentRetry": True,
                        "differentKeyRejected": True,
                        "evidenceBlocker": synthetic_receipt["receiptId"],
                        "networkFailurePreservedTarget": True,
                        "learnerPreviewStatus": denied_preview["status"],
                        "learnerDeleteStatus": denied_delete["status"],
                        "padNoHorizontalOverflow": True,
                        "syntheticFixtureReceiptCreated": True,
                        "humanAcceptanceReceiptCreated": False,
                    }
                    (QA / "browser-automated-evidence.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(json.dumps(result, ensure_ascii=False))
                    learner_context.close()
                    admin_context.close()
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()


if __name__ == "__main__":
    main()
