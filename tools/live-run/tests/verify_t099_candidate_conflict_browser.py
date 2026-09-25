#!/usr/bin/env python3
"""Real-browser regression for T-099 Candidate compare-and-swap UX."""
from __future__ import annotations

import http.client
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
CURSOR_NODE = Path("/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node")
NODE = CURSOR_NODE if CURSOR_NODE.exists() else Path(shutil.which("node") or "node")
WRANGLER = REPO / "node_modules" / "wrangler" / "bin" / "wrangler.js"
QA = REPO / "docs" / "qa" / "t099-candidate-conflict"
COURSE_ID = "google-1995-2004"
ADMIN = {"username": "t099-admin", "name": "T099 主编 A", "password": "T099 admin browser password 2026!"}
MENTOR = {"username": "t099-mentor", "name": "T099 协作编辑 B", "password": "T099 mentor browser password 2026!"}


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log_path: Path) -> None:
    deadline = time.monotonic() + 60
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


def login(page, base: str, account: dict[str, str]) -> None:
    target = f"/studio/editor/?course={COURSE_ID}"
    page.goto(f"{base}/auth/login/?returnTo={target.replace('/', '%2F').replace('?', '%3F').replace('=', '%3D')}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(account["username"])
    page.locator('input[name="password"]').fill(account["password"])
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(f"**/studio/editor/?course={COURSE_ID}")
    page.wait_for_selector("#editor:not([hidden])")
    expect(page.locator("#saveState")).not_to_have_attribute("data-state", "loading")


def set_working_title(page, value: str) -> None:
    page.locator("#jsonTab").click()
    source = json.loads(page.locator("#rawJson").input_value())
    source["title"] = value
    page.locator("#rawJson").fill(json.dumps(source, ensure_ascii=False, indent=2))
    page.locator("#applyJson").click()
    expect(page.locator("#saveState")).to_have_attribute("data-state", "dirty")
    assert json.loads(page.locator("#rawJson").input_value())["title"] == value


def working_title(page) -> str:
    return str(json.loads(page.locator("#rawJson").input_value())["title"])


def candidate_from_bootstrap(page) -> dict:
    result = page.evaluate(
        """async (courseId) => {
          const response = await fetch('/api/studio/bootstrap', {credentials:'same-origin', cache:'no-store'});
          const envelope = await response.json();
          if (!response.ok || !envelope.ok) throw new Error(JSON.stringify(envelope));
          return envelope.data.versions.find((item) => item.ref.courseId === courseId && item.candidate);
        }""",
        COURSE_ID,
    )
    assert result
    return result


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    assert WRANGLER.exists(), "wrangler runtime is missing"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    result: dict[str, object] = {"ok": False, "courseId": COURSE_ID, "browser": {}, "checks": []}

    with tempfile.TemporaryDirectory(prefix="msv-t099-browser-") as temporary:
        root = Path(temporary)
        fixture = root / "accounts.json"
        seed = root / "seed.sql"
        fixture.write_text(json.dumps({
            "dm": ADMIN,
            "mentors": [{**MENTOR, "mentorRole": "P"}],
            "learners": [],
            "outsider": {"username": "t099-outsider", "name": "T099 Outside", "password": "T099 outsider browser password 2026!"},
        }, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run(
            [str(NODE), "--import", "tsx", "scripts/generate-auth-seed.ts", "--accounts", str(fixture), "--output", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60,
        )
        subprocess.run(
            [str(NODE), str(WRANGLER), "d1", "execute", "DB", "--yes", "--json", "--local", "--persist-to", temporary,
             "--config", "dist/server/wrangler.json", "--file", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60,
        )
        log_path = root / "wrangler.log"
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                [str(NODE), str(WRANGLER), "dev", "--config", "wrangler.json", "--persist-to", temporary,
                 "--ip", "127.0.0.1", "--port", str(port), "--no-show-interactive-dev-session"],
                cwd=REPO / "dist" / "server", env=env, stdout=log, stderr=subprocess.STDOUT, text=True,
            )
            try:
                wait_ready(port, process, log_path)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    result["browser"] = {"engine": "Chromium", "version": browser.version}
                    admin_context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    mentor_context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    admin_page = admin_context.new_page()
                    mentor_merge_page = mentor_context.new_page()
                    mentor_reload_page = mentor_context.new_page()
                    errors: list[str] = []
                    for page in (admin_page, mentor_merge_page, mentor_reload_page):
                        page.on("pageerror", lambda error: errors.append(str(error)))

                    login(admin_page, base, ADMIN)
                    login(mentor_merge_page, base, MENTOR)
                    # A second stale tab is deliberately loaded before A saves;
                    # it verifies that destructive reload also requires consent.
                    mentor_reload_page.goto(f"{base}/studio/editor/?course={COURSE_ID}", wait_until="networkidle")
                    mentor_reload_page.wait_for_selector("#editor:not([hidden])")

                    title_a = "T099 并发主编 A 的修改"
                    title_b = "T099 协作编辑 B 的显式合并"
                    title_c = "T099 旧标签页 C 待重载"
                    set_working_title(admin_page, title_a)
                    set_working_title(mentor_merge_page, title_b)
                    set_working_title(mentor_reload_page, title_c)

                    admin_page.locator("#saveDraft").click()
                    expect(admin_page.locator("#saveState")).to_have_attribute("data-state", "saved")
                    first = candidate_from_bootstrap(admin_page)
                    assert first["course"]["title"] == title_a
                    assert first["ref"]["createdByDisplayName"] == ADMIN["name"]
                    result["checks"].append("A 的 exact Candidate 保存成功")

                    mentor_merge_page.locator("#saveDraft").click()
                    conflict = mentor_merge_page.locator("#conflictDialog")
                    expect(conflict).to_be_visible()
                    expect(mentor_merge_page.locator("#conflictSummary")).to_contain_text("系统拒绝了静默覆盖")
                    expect(mentor_merge_page.locator("#conflictRemoteMeta")).to_contain_text(ADMIN["name"])
                    assert "T" in mentor_merge_page.locator("#conflictRemoteMeta").inner_text()
                    for selector in ("#conflictLocalChanges", "#conflictRemoteChanges", "#conflictOverlap"):
                        expect(mentor_merge_page.locator(selector)).to_contain_text("$.title")
                    assert working_title(mentor_merge_page) == title_b
                    expect(mentor_merge_page.locator("#saveState")).to_have_attribute("data-state", "error")
                    result["checks"].append("冲突显示基线、最新作者/时间与双方字段差异")

                    mentor_merge_page.screenshot(path=str(QA / "candidate-conflict.png"), full_page=True)
                    merge = mentor_merge_page.locator("#conflictMerge")
                    merge.click()
                    expect(conflict).to_be_visible()
                    expect(merge).to_contain_text("再次点击")
                    assert working_title(mentor_merge_page) == title_b
                    merge.click()
                    expect(conflict).to_be_hidden()
                    expect(mentor_merge_page.locator("#saveState")).to_have_attribute("data-state", "dirty")
                    expect(mentor_merge_page.locator("#saveState")).to_contain_text("合并后待保存")
                    assert working_title(mentor_merge_page) == title_b
                    mentor_merge_page.locator("#saveDraft").click()
                    expect(mentor_merge_page.locator("#saveState")).to_have_attribute("data-state", "saved")
                    second = candidate_from_bootstrap(mentor_merge_page)
                    assert second["ref"]["revision"] > first["ref"]["revision"]
                    assert second["course"]["title"] == title_b
                    assert second["ref"]["createdByDisplayName"] == MENTOR["name"]
                    result["checks"].append("同路径合并二次确认，且合并后手动保存为新 revision")

                    mentor_reload_page.locator("#saveDraft").click()
                    reload_conflict = mentor_reload_page.locator("#conflictDialog")
                    expect(reload_conflict).to_be_visible()
                    reload_button = mentor_reload_page.locator("#conflictReload")
                    reload_button.click()
                    expect(reload_conflict).to_be_visible()
                    expect(reload_button).to_contain_text("再次点击")
                    assert working_title(mentor_reload_page) == title_c
                    reload_button.click()
                    expect(reload_conflict).to_be_hidden()
                    expect(mentor_reload_page.locator("#saveState")).to_have_attribute("data-state", "saved")
                    assert working_title(mentor_reload_page) == title_b
                    result["checks"].append("破坏性重载二次确认，确认前 Working Copy 不丢失")

                    final = candidate_from_bootstrap(admin_page)
                    assert final["ref"]["revision"] == second["ref"]["revision"]
                    assert final["ref"]["digest"] == second["ref"]["digest"]
                    assert final["course"]["title"] == title_b
                    assert not errors, errors
                    result.update({
                        "ok": True,
                        "firstRevision": first["ref"]["revision"],
                        "finalRevision": final["ref"]["revision"],
                        "workingCopyPreserved": True,
                        "explicitMerge": True,
                        "destructiveReloadConfirmation": True,
                        "authorDisplayName": True,
                        "screenshot": "docs/qa/t099-candidate-conflict/candidate-conflict.png",
                    })
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    receipt = QA / "browser-receipt.json"
    receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
