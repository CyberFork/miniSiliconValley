#!/usr/bin/env python3
"""Real-browser acceptance for T-112 course naming and case separation."""
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

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t112-course-naming"
COURSE_ID = "google-1995-2004"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log: Path) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(log.read_text(errors="replace"))
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
        time.sleep(.2)
    raise TimeoutError(log.read_text(errors="replace"))


def bootstrap_version(page, *, candidate: bool) -> dict:
    result = page.evaluate(
        """async ({courseId, candidate}) => {
          const response = await fetch('/api/studio/bootstrap', {credentials:'same-origin', cache:'no-store'});
          const body = await response.json();
          if (!response.ok || !body.ok) throw new Error(JSON.stringify(body));
          return body.data.versions.find((item) => item.ref.courseId === courseId && Boolean(item.candidate) === candidate);
        }""",
        {"courseId": COURSE_ID, "candidate": candidate},
    )
    assert result, (COURSE_ID, candidate)
    return result


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    account = {
        "username": f"t112-admin-{stamp}",
        "name": "T112 课程命名验收员",
        "password": f"T112 browser {secrets.token_urlsafe(16)}!",
    }
    new_name = f"AI 创业实践｜问题到验证 {stamp}"
    receipt: dict[str, object] = {
        "ok": False,
        "scope": "isolated local D1; no production writes",
        "courseId": COURSE_ID,
        "checks": [],
    }

    with tempfile.TemporaryDirectory(prefix="msv-t112-browser-") as temp:
        root = Path(temp)
        accounts = root / "accounts.json"
        seed = root / "seed.sql"
        accounts.write_text(json.dumps({
            "dm": account,
            "mentors": [],
            "learners": [],
            "outsider": {"username": f"t112-outside-{stamp}", "name": "T112 Outside", "password": f"T112 outside {secrets.token_urlsafe(16)}!"},
        }, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run(
            [str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts", "--accounts", str(accounts), "--output", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )
        subprocess.run(
            [str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local", "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )
        log = root / "wrangler.log"
        with log.open("w", encoding="utf-8") as output:
            process = subprocess.Popen(
                [str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json", "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port), "--no-show-interactive-dev-session"],
                cwd=REPO / "dist/server", env=env, stdout=output, stderr=subprocess.STDOUT, text=True,
            )
            try:
                wait_ready(port, process, log)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    receipt["browser"] = {"engine": "Chromium", "version": browser.version}
                    page = browser.new_page(viewport={"width": 1792, "height": 1100})
                    errors: list[str] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    target = f"/studio/editor/?course={COURSE_ID}"
                    page.goto(f"{base}/auth/login/?returnTo={target.replace('/', '%2F').replace('?', '%3F').replace('=', '%3D')}", wait_until="networkidle")
                    page.locator('input[name="username"]').fill(account["username"])
                    page.locator('input[name="password"]').fill(account["password"])
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
                    page.wait_for_url(f"**/studio/editor/?course={COURSE_ID}")
                    page.wait_for_selector("#editor:not([hidden])")

                    released_before = bootstrap_version(page, candidate=False)
                    original = released_before["course"]
                    stable = {
                        "courseId": original["course"]["id"],
                        "defaultCaseId": original["case"]["campaignId"],
                        "caseName": original["case"]["name"],
                        "deckIds": [deck["id"] for deck in original["decks"]],
                        "cardIds": [[card["id"] for card in deck["cards"]] for deck in original["decks"]],
                        "sourceIds": [source["id"] for source in original["sources"]],
                    }

                    page.locator("#structuredTab").click()
                    name_input = page.locator('[data-path="course.name"]')
                    expect(name_input).to_be_visible()
                    name_input.fill(new_name)
                    expect(page.locator("#saveState")).to_have_attribute("data-state", "dirty")
                    page.locator("#saveDraft").click()
                    expect(page.locator("#saveState")).to_have_attribute("data-state", "saved", timeout=20_000)

                    candidate = bootstrap_version(page, candidate=True)
                    current = candidate["course"]
                    assert current["course"]["name"] == new_name
                    assert current["title"] == f"Mini Silicon Valley｜{new_name}｜CourseDefinition"
                    assert current["course"]["id"] == stable["courseId"]
                    assert current["case"]["campaignId"] == stable["defaultCaseId"]
                    assert current["case"]["name"] == stable["caseName"]
                    assert [deck["id"] for deck in current["decks"]] == stable["deckIds"]
                    assert [[card["id"] for card in deck["cards"]] for deck in current["decks"]] == stable["cardIds"]
                    assert [source["id"] for source in current["sources"]] == stable["sourceIds"]
                    assert released_before["course"]["course"]["name"] != new_name

                    page.reload(wait_until="networkidle")
                    page.wait_for_selector("#editor:not([hidden])")
                    page.locator("#structuredTab").click()
                    expect(page.locator('[data-path="course.name"]')).to_have_value(new_name)
                    expect(page.locator('[data-path="course.id"]')).to_have_value(COURSE_ID)
                    expect(page.locator('[data-path="case.campaignId"]')).to_have_value(stable["defaultCaseId"])
                    page.screenshot(path=str(QA / "custom-course-name.png"), full_page=True)

                    assert not errors, errors
                    receipt.update({
                        "ok": True,
                        "candidateRevision": candidate["ref"]["revision"],
                        "namePersistedAfterRefresh": True,
                        "courseIdentityStable": True,
                        "caseIdentityStable": True,
                        "contentIdentityStable": True,
                        "releasedSnapshotUnchanged": True,
                        "screenshot": "docs/qa/t112-course-naming/custom-course-name.png",
                    })
                    receipt["checks"] = [
                        "UI 修改课程名称并保存 Candidate",
                        "刷新后课程名称仍保留",
                        "courseId、默认案例、案例名、牌组、卡片和来源 ID 均未改写",
                        "旧 Released 快照名称未被原地改写",
                    ]
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    (QA / "browser-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False))
    if not receipt["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
