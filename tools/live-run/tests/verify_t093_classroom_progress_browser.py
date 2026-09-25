#!/usr/bin/env python3
"""Real compiled-Classroom acceptance for T-093.

Creates one isolated Test Classroom in a temporary local D1, unlocks B01-B07,
then operates the *rendered progress segments* with mouse, touch, Enter and
Space.  No production database and no human acceptance receipt are touched.
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
from urllib.parse import quote, urlparse, parse_qs

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t093-classroom-progress"


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
            method, credentials: 'same-origin', cache: 'no-store',
            headers: body === null ? undefined : {'content-type':'application/json'},
            body: body === null ? undefined : JSON.stringify(body),
          });
          let payload = null;
          try { payload = await response.json(); } catch {}
          return {status: response.status, payload};
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


def current_block(page) -> str:
    return parse_qs(urlparse(page.url).query).get("block", [""])[0]


def expect_block(page, block_id: str) -> None:
    expect(page.locator("h1").filter(has_text=f"{block_id} ·")).to_be_visible(timeout=10_000)
    assert current_block(page) == block_id, page.url


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    admin = {"username": f"t093-admin-{stamp}", "name": "T093 进度管理员", "password": f"T093 admin {secrets.token_urlsafe(18)}!"}
    mentors = [
        {"username": f"t093-mentor-{role.lower()}-{stamp}", "name": f"{role} 导师", "password": f"T093 mentor {role} {secrets.token_urlsafe(16)}!"}
        for role in ("P", "D", "M", "O")
    ]
    learners = [
        {"username": f"t093-learner-{index}-{stamp}", "name": f"T093 Young Builder {index}", "password": f"T093 learner {index} {secrets.token_urlsafe(16)}!"}
        for index in range(1, 5)
    ]
    fixture = {
        "dm": admin, "mentors": mentors, "learners": learners,
        "outsider": {"username": f"t093-outside-{stamp}", "name": "T093 Outside", "password": f"T093 outside {secrets.token_urlsafe(16)}!"},
    }

    with tempfile.TemporaryDirectory(prefix="msv-t093-browser-") as temp:
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
                    control = admin_context.new_page()
                    errors: list[str] = []
                    failed_assets: list[str] = []
                    control.on("pageerror", lambda error: errors.append(str(error)))
                    control.on("requestfailed", lambda req: failed_assets.append(req.url) if req.resource_type in ("document", "script", "stylesheet") else None)
                    login(control, base, admin["username"], admin["password"], "/studio/")

                    bootstrap = api(control, "/api/studio/bootstrap")
                    released = next(item for item in bootstrap["versions"] if item["released"] and item["ref"]["courseId"] == "google-1995-2004")
                    course = released["course"]
                    course["title"] = f"{course['title']} · T093 Browser {stamp}"
                    candidate = api(control, "/api/studio/candidates", "POST", {"course": course, "expectedCandidateRef": None})
                    policy = released["learnerPolicy"]
                    view_receipt = api(control, "/api/studio/view-acceptance", "POST", {
                        "courseRef": candidate,
                        "reviewedBlockIds": [block["id"] for block in course["blocks"]],
                        "reviewedLearnerCounts": list(range(policy["minCount"], policy["maxCount"] + 1)),
                    })
                    preferred = {"P": "product-mentor-foundations", "D": "development-mentor-ligun", "M": "market-mentor-user-system", "O": "operations-mentor-field-kit"}
                    courseware = [{
                        "mentorRole": item["mentorRole"], "packageId": item["packageId"], "slug": item["slug"],
                        "revision": item["latestRevision"], "digest": item["latestDigest"],
                    } for item in bootstrap["courseware"] if preferred.get(item["mentorRole"]) == item["slug"]]
                    assert {item["mentorRole"] for item in courseware} == {"P", "D", "M", "O"}, courseware
                    created = api(control, "/api/platform/classrooms", "POST", {
                        "environment": "test", "title": "T093 Classroom 进度条真实验收", "learnerCount": 4,
                        "courseRef": candidate, "viewAcceptanceReceiptId": view_receipt["receiptId"], "coursewareRefs": courseware,
                        "adminDmProfileIds": [bootstrap["user"]["userId"]],
                        "mentorSeats": [{"mentorRole": role, "profileId": mentors[index]["username"]} for index, role in enumerate(("P", "D", "M", "O"))],
                        "learnerProfileIds": [item["username"] for item in learners],
                    })
                    room_id = created["classroomId"]

                    detail = api(control, f"/api/platform/classrooms/{room_id}?surface=control")
                    for number in range(2, 8):
                        progress = api(control, f"/api/platform/classrooms/{room_id}/control", "POST", {
                            "expectedVersion": detail["script"]["version"],
                            "expectedRunId": detail["runtimeIdentity"]["runId"],
                            "expectedResetGeneration": detail["runtimeIdentity"]["resetGeneration"],
                            "action": {"type": "unlock-next", "nextBlockId": f"B{number:02d}"},
                        })
                        detail["script"] = progress
                    assert detail["script"]["unlockedThroughBlockId"] == "B07"

                    # A real Admin-DM window remains on B04 while the learner
                    # exercises independent cursor navigation in another login.
                    control.goto(f"{base}/classroom/{room_id}/control/?block=B04", wait_until="networkidle")
                    expect_block(control, "B04")
                    learner_context = browser.new_context(viewport={"width": 768, "height": 1024}, has_touch=True, is_mobile=True)
                    learner = learner_context.new_page()
                    learner.on("pageerror", lambda error: errors.append(str(error)))
                    learner.on("requestfailed", lambda req: failed_assets.append(req.url) if req.resource_type in ("document", "script", "stylesheet") else None)
                    login(learner, base, learners[0]["username"], learners[0]["password"], f"/classroom/{room_id}/")
                    learner.goto(f"{base}/classroom/{room_id}/?block=B04", wait_until="networkidle")
                    expect_block(learner, "B04")

                    progress_group = learner.locator('div[role="group"][aria-label^="剧本进度"]')
                    segments = progress_group.locator("button")
                    assert segments.count() == 13, segments.count()
                    for index in range(13):
                        expected_state = "current" if index == 3 else "unlocked" if index <= 6 else "locked"
                        expect(segments.nth(index)).to_have_attribute("data-state", expected_state)
                        if index <= 6:
                            assert segments.nth(index).get_attribute("aria-disabled") is None
                        else:
                            expect(segments.nth(index)).to_have_attribute("aria-disabled", "true")
                    sizes = learner.evaluate("""() => [...document.querySelectorAll('[role="group"][aria-label^="剧本进度"] button')].map((el) => {
                      const r = el.getBoundingClientRect(); return {height:r.height, left:r.left, right:r.right};
                    })""")
                    assert all(item["height"] >= 44 for item in sizes), sizes
                    assert all(sizes[index]["right"] <= sizes[index + 1]["left"] + 0.5 for index in range(len(sizes) - 1)), sizes

                    mutating_requests: list[dict[str, str]] = []
                    learner.on("request", lambda req: mutating_requests.append({"method": req.method, "url": req.url}) if req.method in ("POST", "PUT", "PATCH", "DELETE") else None)

                    # Mouse, touch, keyboard, current-page idempotency, and a
                    # locked future segment all operate the progress control.
                    segments.nth(1).click()
                    expect_block(learner, "B02")
                    expect_block(control, "B04")
                    draft = learner.locator("#block-work")
                    expect(draft).to_be_visible()
                    draft.fill("B02 尚未提交的本机草稿：翻页不能丢失")
                    progress_group.locator("button").nth(5).tap()
                    expect_block(learner, "B06")
                    progress_group.locator("button").nth(6).focus()
                    learner.keyboard.press("Enter")
                    expect_block(learner, "B07")
                    progress_group.locator("button").nth(3).focus()
                    learner.keyboard.press("Space")
                    expect_block(learner, "B04")
                    before_current = learner.url
                    progress_group.locator("button").nth(3).click()
                    expect(learner.get_by_text("你正在查看 B04；课堂解锁边界没有变化。", exact=True)).to_be_visible()
                    assert learner.url == before_current
                    progress_group.locator("button").nth(7).focus()
                    learner.keyboard.press("Enter")
                    expect(learner.get_by_text("B08 尚未解锁", exact=False)).to_be_visible()
                    expect_block(learner, "B04")

                    progress_group.locator("button").nth(1).click()
                    expect_block(learner, "B02")
                    expect(draft).to_have_value("B02 尚未提交的本机草稿：翻页不能丢失")
                    learner.go_back()
                    expect_block(learner, "B04")
                    learner.go_forward()
                    expect_block(learner, "B02")

                    # The Test mentor and shared-screen projections use the
                    # same progress component and still perform GET-only cursor moves.
                    control.get_by_role("button", name="P · P 导师", exact=True).click()
                    expect(control.get_by_text("TEST CLASSROOM · P 导师", exact=True)).to_be_visible(timeout=10_000)
                    control.locator('div[role="group"][aria-label^="剧本进度"] button').nth(2).click()
                    expect_block(control, "B03")
                    control.get_by_role("button", name="投屏", exact=True).click()
                    expect(control.get_by_text("已解锁课堂页 · 投屏独立翻阅", exact=True)).to_be_visible(timeout=10_000)
                    control.locator('div[role="group"][aria-label^="剧本进度"] button').nth(4).click()
                    expect(control.locator("main main").filter(has_text="· B05")).to_be_visible(timeout=10_000)
                    assert current_block(control) == "B05", control.url

                    locked = request(learner, f"/api/platform/classrooms/{room_id}?block=B08")
                    assert locked["status"] == 409, locked
                    assert locked["payload"]["error"]["code"] == "SCRIPT_PAGE_LOCKED", locked
                    final_detail = api(learner, f"/api/platform/classrooms/{room_id}?block=B02")
                    assert final_detail["script"]["unlockedThroughBlockId"] == "B07"
                    assert final_detail["courseRef"]["revision"] == candidate["revision"]
                    assert final_detail["courseRef"]["digest"] == candidate["digest"]
                    assert not mutating_requests, mutating_requests

                    geometry = learner.evaluate("() => ({inner:innerWidth, root:document.documentElement.scrollWidth, body:document.body.scrollWidth})")
                    assert geometry["root"] <= geometry["inner"] + 1, geometry
                    assert geometry["body"] <= geometry["inner"] + 1, geometry
                    learner.screenshot(path=str(QA / "learner-pad-progress-b02.png"), full_page=True)
                    control.screenshot(path=str(QA / "mentor-screen-progress-b05.png"), full_page=True)
                    assert not errors, errors
                    assert not failed_assets, failed_assets
                    result = {
                        "ok": True,
                        "scope": "compiled Classroom + temporary local D1; no production writes",
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "scenario": {"viewing": "B04", "unlockedThrough": "B07", "blockCount": 13},
                        "realProgressControl": True,
                        "mouse": ["B02", "B04-current", "mentor-B03", "screen-B05"],
                        "touch": ["B06"],
                        "keyboard": ["Enter-B07", "Space-B04", "Enter-locked-B08"],
                        "lockedServerStatus": locked["status"],
                        "independentObserverStayedAtB04": True,
                        "globalFrontierStayedAtB07": True,
                        "exactCourseUnchanged": True,
                        "draftRestored": True,
                        "browserBackForward": True,
                        "mutatingRequestsFromProgress": mutating_requests,
                        "minimumHitAreaPx": min(item["height"] for item in sizes),
                        "padNoHorizontalOverflow": True,
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
