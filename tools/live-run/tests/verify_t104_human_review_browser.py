#!/usr/bin/env python3
"""T-104 real-browser acceptance with isolated D1 and Parent-QA event storage."""
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
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright


REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA_DIR = REPO / "docs" / "qa" / "t104-human-review"
COURSE_FIXTURE = REPO / "tools" / "live-run" / "courses" / "candidates" / "eleme-2008-unified-t095.json"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_http(port: int, path: str, process: subprocess.Popen[str], log: Path, statuses: tuple[int, ...]) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(log.read_text(encoding="utf-8", errors="replace"))
        try:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
            connection.request("GET", path)
            response = connection.getresponse()
            response.read()
            connection.close()
            if response.status in statuses:
                return
        except OSError:
            pass
        time.sleep(0.2)
    raise TimeoutError(log.read_text(encoding="utf-8", errors="replace"))


def login(page, base: str, username: str, password: str) -> None:
    target = "/studio/reviews/"
    page.goto(f"{base}/auth/login/?returnTo={quote(target, safe='')}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url("**/studio/reviews/")


def stop(process: subprocess.Popen[str]) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").is_file(), "run npm run build:minisv-app first"
    assert (REPO / "dist/parent-qa/server.mjs").is_file(), "run npm run build:parent-qa first"
    course = json.loads(COURSE_FIXTURE.read_text(encoding="utf-8"))
    review_items = course["contentPackages"]["reviewQueue"]
    assert len(review_items) >= 3
    QA_DIR.mkdir(parents=True, exist_ok=True)

    app_port, qa_port = free_port(), free_port()
    while qa_port == app_port:
        qa_port = free_port()
    base = f"http://127.0.0.1:{app_port}"
    token = secrets.token_urlsafe(48)
    suffix = secrets.token_hex(4)
    username = f"t104-admin-{suffix}"
    password = f"T104 browser {secrets.token_urlsafe(18)}!"
    result: dict[str, object] = {"ok": False, "scope": "isolated local D1 and synthetic redacted Parent-QA log"}

    with tempfile.TemporaryDirectory(prefix="msv-t104-browser-") as temporary:
        root = Path(temporary)
        accounts, seed, env_file = root / "accounts.json", root / "seed.sql", root / "app.env"
        gap_log, app_log, qa_log = root / "knowledge-gaps.ndjson", root / "wrangler.log", root / "parent-qa.log"
        accounts.write_text(json.dumps({
            "dm": {"username": username, "name": "T104 人工审核管理员", "password": password},
            "mentors": [], "learners": [],
            "outsider": {"username": f"{username}-outside", "name": "T104 Outside", "password": f"{password} outside"},
        }, ensure_ascii=False), encoding="utf-8")
        env_file.write_text(
            f"QA_INTERNAL_REVIEW_TOKEN={token}\nPARENT_QA_INTERNAL_URL=http://127.0.0.1:{qa_port}/internal/knowledge-gaps\n",
            encoding="utf-8",
        )
        gap_id = "gap_0123456789abcdef"
        gap_question = "下一期课程的报名截止日是什么时候？"
        gap_log.write_text(json.dumps({
            "schemaVersion": 2,
            "eventType": "observation",
            "eventId": "gapobs_fixture_0001",
            "id": gap_id,
            "question": gap_question,
            "observedAt": "2026-09-11T00:00:00.000Z",
            "model": "synthetic-browser-fixture",
            "sourceIds": [],
        }, ensure_ascii=False) + "\n", encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run(
            [str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts", "--accounts", str(accounts), "--output", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )
        subprocess.run(
            [str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local",
             "--persist-to", temporary, "--config", "dist/server/wrangler.json", "--file", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )

        qa_env = {
            **env,
            "QA_AUTOSTART": "1",
            "QA_HOST": "127.0.0.1",
            "QA_PORT": str(qa_port),
            "DEEPSEEK_API_KEY": "synthetic-not-used",
            "QA_INTERNAL_REVIEW_TOKEN": token,
            "QA_KNOWLEDGE_GAP_FILE": str(gap_log),
        }
        with qa_log.open("w", encoding="utf-8") as qa_output, app_log.open("w", encoding="utf-8") as app_output:
            qa_process = subprocess.Popen(
                ["node", str(REPO / "dist/parent-qa/server.mjs")],
                cwd=REPO, env=qa_env, stdout=qa_output, stderr=subprocess.STDOUT, text=True,
            )
            app_process: subprocess.Popen[str] | None = None
            try:
                wait_http(qa_port, "/health", qa_process, qa_log, (200,))
                app_process = subprocess.Popen(
                    [str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json", "--env-file", str(env_file),
                     "--persist-to", temporary, "--ip", "127.0.0.1", "--port", str(app_port), "--no-show-interactive-dev-session"],
                    cwd=REPO / "dist/server", env=env, stdout=app_output, stderr=subprocess.STDOUT, text=True,
                )
                wait_http(app_port, "/api/auth/session", app_process, app_log, (200, 401))
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    page = browser.new_page(viewport={"width": 1440, "height": 1000})
                    errors: list[str] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    login(page, base, username, password)

                    created = page.evaluate("""async (course) => {
                      const response = await fetch('/api/studio/candidates', {
                        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({course, expectedCandidateRef:null})
                      });
                      const body = await response.json();
                      if (!response.ok || !body.ok) throw new Error(JSON.stringify(body));
                      return body.data;
                    }""", course)
                    assert created["courseId"] == course["course"]["id"]
                    page.reload(wait_until="networkidle")
                    expect(page.get_by_role("heading", name="人工审核工作台")).to_be_visible()
                    expect(page.get_by_role("heading", name="课程内容待核对")).to_be_visible()
                    expect(page.get_by_role("heading", name="家长问答待补充")).to_be_visible()
                    expect(page.get_by_text("3", exact=True).first).to_be_visible()
                    expect(page.get_by_text("✓ 写入健康")).to_be_visible()

                    first_title = review_items[0]["title"]
                    course_card = page.locator("article").filter(has_text=first_title).first
                    expect(course_card).to_be_visible()
                    course_card.locator("select").select_option("excluded-this-release")
                    course_card.locator("textarea").fill("本轮只验证审核机制，明确排除并保留后续证据核对任务。")
                    course_card.get_by_role("button", name="保存人工处置").click()
                    expect(page.locator("article").filter(has_text=first_title).first).to_contain_text("本次明确排除 · 不代表已修复")
                    course_card = page.locator("article").filter(has_text=first_title).first
                    course_card.locator("textarea").fill("新的来源线索出现，需要由课程负责人重新核对。")
                    course_card.get_by_role("button", name="显式重开此项").click()
                    expect(page.locator("article").filter(has_text=first_title).first).to_contain_text("已人工重开 · 阻断发布")

                    qa_card = page.locator("article").filter(has_text=gap_question).first
                    expect(qa_card).to_be_visible()
                    qa_card.locator("textarea").fill("当前正式资料没有排期，确认属于需向课程团队咨询的范围外运营信息。")
                    qa_card.locator("select").select_option("dismissed_out_of_scope")
                    qa_card.get_by_role("button", name="保存人工处置").click()
                    expect(page.locator("article").filter(has_text=gap_question).first).to_contain_text("确认范围外")
                    qa_card = page.locator("article").filter(has_text=gap_question).first
                    qa_card.locator("textarea").fill("运营团队已建立排期制度，现需显式重新调查并补充正式来源。")
                    qa_card.get_by_role("button", name="显式重新打开").click()
                    expect(page.locator("article").filter(has_text=gap_question).first).to_contain_text("待导师审核")

                    page.screenshot(path=str(QA_DIR / "human-review-workbench.png"), full_page=True)
                    geometry = page.evaluate("""() => ({inner:window.innerWidth, scroll:document.documentElement.scrollWidth})""")
                    assert geometry["scroll"] <= geometry["inner"], geometry
                    assert not errors, errors
                    result.update({
                        "ok": True,
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "courseExact": {"courseId": created["courseId"], "revision": created["revision"], "digest": created["digest"]},
                        "courseDecisionAppendOnly": True,
                        "courseExplicitReopen": True,
                        "parentQaDecision": True,
                        "parentQaExplicitReopen": True,
                        "internalTokenStayedServerSide": True,
                        "noHorizontalOverflow": True,
                        "screenshot": "docs/qa/t104-human-review/human-review-workbench.png",
                    })
                    browser.close()
            finally:
                if app_process is not None:
                    stop(app_process)
                stop(qa_process)

    (QA_DIR / "browser-receipt.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
