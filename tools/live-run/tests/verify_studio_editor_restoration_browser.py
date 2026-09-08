#!/usr/bin/env python3
"""Visual/interaction regression for the restored T-085 Course Studio editor."""
from __future__ import annotations

import json
import http.client
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t085-editor-restoration"
USERNAME = "editor-visual-admin"
PASSWORD = "Editor visual regression password 2026!"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log_path: Path) -> None:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Wrangler exited early:\n{log_path.read_text(encoding='utf-8', errors='replace')}")
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
    raise TimeoutError(
        "Wrangler did not become ready:\n"
        + log_path.read_text(encoding="utf-8", errors="replace")
    )


def geometry(page) -> dict:
    return page.evaluate(
        """() => {
          const rect = (selector) => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const value = node.getBoundingClientRect();
            return {left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height};
          };
          return {
            innerWidth,
            bodyScrollWidth: document.body.scrollWidth,
            rootScrollWidth: document.documentElement.scrollWidth,
            studio: rect('.studio'), library: rect('.library'), workspace: rect('.workspace'), guide: rect('.guide'),
          };
        }"""
    )


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    result: dict[str, object] = {"ok": False, "base": base, "viewports": {}}

    with tempfile.TemporaryDirectory(prefix="msv-editor-browser-") as temp:
        temp_path = Path(temp)
        fixture = temp_path / "accounts.json"
        seed = temp_path / "seed.sql"
        fixture.write_text(json.dumps({
            "dm": {"username": USERNAME, "name": "编辑器视觉验收员", "password": PASSWORD},
            "mentors": [], "learners": [],
            "outsider": {"username": "editor-outsider", "name": "Editor Outsider", "password": f"{PASSWORD} outsider"},
        }, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(fixture), "--output", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True)
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "wrangler"), "d1", "execute", "DB", "--local",
            "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True)
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
                    context = browser.new_context(viewport={"width": 1792, "height": 1100})
                    page = context.new_page()
                    errors: list[str] = []
                    failed_requests: list[str] = []
                    loaded_scripts: list[str] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on(
                        "requestfailed",
                        lambda request: (
                            failed_requests.append(request.url)
                            if "/studio/editor-assets/" in request.url
                            and request.url.split("?")[0].endswith((".js", ".css"))
                            else None
                        ),
                    )
                    page.on(
                        "response",
                        lambda response: (
                            loaded_scripts.append(response.url)
                            if response.request.resource_type == "script"
                            and "/studio/editor-assets/" in response.url
                            and response.url.split("?")[0].endswith(
                                tuple(["/ui-theme.js", "/card-view.js", "/course-preview.js", "/editor.js", "/editor-loader.js"])
                            )
                            else None
                        ),
                    )
                    page.goto(f"{base}/auth/login/?returnTo=%2Fstudio%2Feditor%2F", wait_until="networkidle")
                    page.locator('input[name="username"]').fill(USERNAME)
                    page.locator('input[name="password"]').fill(PASSWORD)
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
                    page.wait_for_url("**/studio/editor/")
                    page.wait_for_selector("#editor:not([hidden])")
                    assert not failed_requests, failed_requests
                    assert page.locator("html").get_attribute("data-msv-theme") == "adventure"
                    assert page.locator("#msv-ui-switch").count() == 0
                    normalized = [entry.split("?")[0].split("/")[-1] for entry in loaded_scripts]
                    assert normalized == ["editor-loader.js", "ui-theme.js", "card-view.js", "course-preview.js", "editor.js"], normalized

                    expect(page.locator("h1")).to_contain_text("课程编排工作台")
                    expect(page.locator("#editor")).to_be_visible()
                    expect(page.locator("#fieldDialog")).to_be_hidden()
                    assert page.locator(".timeline-step").count() == 5
                    assert page.locator(".timeline-block").count() == 13
                    assert page.locator(".seat-preview-card").count() == 8
                    assert page.locator("#previewController .shared-controller").count() == 1
                    desktop = geometry(page)
                    assert desktop["bodyScrollWidth"] <= desktop["innerWidth"] + 1
                    assert desktop["rootScrollWidth"] <= desktop["innerWidth"] + 1
                    assert desktop["library"]["right"] <= desktop["workspace"]["left"] + 1
                    assert desktop["workspace"]["right"] <= desktop["guide"]["left"] + 1

                    page.locator('[data-preview-block="12"]').click()
                    expect(page.locator("#projectionStamp")).to_contain_text("B13")
                    assert page.locator('.msv-seat-surface[data-block-id="B13"]').count() == 8
                    page.locator('[data-preview-block="0"]').click()
                    field = page.locator('#previewController [data-course-path="blocks.0.title"]')
                    field.click()
                    expect(page.locator("#fieldPath")).to_have_text("blocks.0.title")
                    page.locator("#fieldValue").fill("B01 · 旧编辑器直改回归验收")
                    expect(page.locator("#impactReport")).to_contain_text("已同步")
                    expect(page.locator("#saveState")).to_have_attribute("data-state", "dirty")
                    page.locator("#fieldClose").click()

                    page.locator("#structuredTab").click()
                    expect(page.locator("#metadataForm")).to_be_visible()
                    page.locator("#enableDynamicPolicy").click()
                    page.locator("#studioTab").click()
                    page.locator("#previewLearnerCount").fill("6")
                    page.locator("#previewLearnerCount").press("Tab")
                    assert page.locator(".seat-preview-card").count() == 10
                    expect(page.locator("#projectionStamp")).to_contain_text("11/11 视窗同步")

                    page.locator("#cardsTab").click()
                    expect(page.locator("#deckCardForm")).to_be_visible()
                    expect(page.locator("#learnerCardPreview")).to_be_visible()
                    page.locator("#jsonTab").click()
                    expect(page.locator("#rawJson")).to_be_visible()
                    page.locator("#studioTab").click()

                    # Leave the committed visual evidence in the healthy default state.
                    # The dynamic 4+6+1 assertion above remains recorded in the receipt.
                    page.locator("#undoEdit").click()
                    page.locator("#undoEdit").click()
                    page.locator("#previewLearnerCount").fill("4")
                    page.locator("#previewLearnerCount").press("Tab")
                    assert page.locator(".seat-preview-card").count() == 8
                    expect(page.locator("#packageHealth")).not_to_have_attribute("data-state", "error")

                    awaitable_viewports = (1440, 1180, 768, 430)
                    for width in awaitable_viewports:
                        page.set_viewport_size({"width": width, "height": 1000})
                        page.wait_for_timeout(80)
                        current = geometry(page)
                        assert current["bodyScrollWidth"] <= current["innerWidth"] + 1
                        assert current["rootScrollWidth"] <= current["innerWidth"] + 1
                        result["viewports"][str(width)] = current

                    page.set_viewport_size({"width": 1792, "height": 1100})
                    page.evaluate("window.scrollTo(0, 0)")
                    page.wait_for_timeout(120)
                    page.screenshot(path=str(QA / "editor-restored-desktop.png"), full_page=True)
                    page.set_viewport_size({"width": 430, "height": 932})
                    page.evaluate("window.scrollTo(0, 0)")
                    page.wait_for_timeout(120)
                    page.screenshot(path=str(QA / "editor-restored-mobile.png"), full_page=True)
                    assert not errors, errors
                    result.update({
                        "ok": True, "macroSteps": 5, "blocks": 13, "directEdit": True,
                        "assetLoadOrder": normalized,
                        "modes": ["multi-role", "structure", "cards", "json"],
                        "dynamicLearners": 6, "views": 11, "noHorizontalOverflow": True,
                        "screenshots": [str(QA / "editor-restored-desktop.png"), str(QA / "editor-restored-mobile.png")],
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
