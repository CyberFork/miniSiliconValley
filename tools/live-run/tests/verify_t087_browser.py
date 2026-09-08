#!/usr/bin/env python3
"""Browser acceptance for T-087 Studio navigation and server-side account switching."""
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
QA = REPO / "docs" / "qa" / "t087-account-navigation"


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


def login(page, base: str, username: str, password: str) -> None:
    page.goto(f"{base}/auth/login/?returnTo=%2Fstudio%2F", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url("**/studio/")
    expect(page.get_by_role("heading", name="课程生产工作台")).to_be_visible()


def session_status(page, base: str) -> int:
    return page.evaluate(
        """async (url) => (await fetch(url, {credentials:'same-origin', cache:'no-store'})).status""",
        f"{base}/api/auth/session",
    )


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    username = f"t087-browser-{secrets.token_hex(4)}"
    password = f"T087 browser {secrets.token_urlsafe(18)}!"
    result: dict[str, object] = {
        "ok": False,
        "routes": [],
        "protectedMenus": [],
        "viewports": {},
        "credentialsPersisted": False,
    }

    with tempfile.TemporaryDirectory(prefix="msv-t087-browser-") as temp:
        temp_path = Path(temp)
        fixture = temp_path / "accounts.json"
        seed = temp_path / "seed.sql"
        fixture.write_text(json.dumps({
            "dm": {"username": username, "name": "T087 浏览器验收管理员", "password": password},
            "mentors": [],
            "learners": [],
            "outsider": {"username": f"{username}-outside", "name": "T087 Outside", "password": f"{password} outside"},
        }, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(fixture), "--output", str(seed),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local",
            "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed),
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
                    result["browser"] = {"engine": "Chromium", "version": browser.version}
                    context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    page = context.new_page()
                    page_errors: list[str] = []
                    failed_requests: list[str] = []
                    server_errors: list[str] = []
                    document_responses: list[dict[str, object]] = []
                    page.on("pageerror", lambda error: page_errors.append(str(error)))
                    page.on(
                        "requestfailed",
                        lambda request: failed_requests.append(request.url)
                        if request.resource_type in ("document", "script", "stylesheet")
                        and not request.url.endswith("/favicon.svg")
                        else None,
                    )
                    page.on(
                        "response",
                        lambda response: server_errors.append(f"{response.status} {response.url}")
                        if response.status >= 500
                        else None,
                    )
                    page.on(
                        "response",
                        lambda response: document_responses.append({"status": response.status, "url": response.url})
                        if response.request.resource_type == "document"
                        else None,
                    )
                    login(page, base, username, password)
                    result["account"] = {"username": username, "role": "admin"}
                    bootstrap = page.evaluate(
                        """async () => (await (await fetch('/api/studio/bootstrap', {credentials:'same-origin', cache:'no-store'})).json()).data"""
                    )
                    result["appBuildId"] = bootstrap["acceptanceRuntime"]["appBuildId"]

                    cases = [
                        ("/studio/", "课程工作台", "课程生产工作台"),
                        ("/studio/preview/", "多角色视图验收", "多角色视图验收"),
                        ("/studio/releases/", "验收与发布", "验收与发布"),
                        ("/studio/courseware/", "导师课件库", "导师课件库"),
                    ]
                    for path, label, title in cases:
                        page.goto(f"{base}/studio/", wait_until="networkidle")
                        before_url = page.url
                        before_title = page.get_by_role("heading", name="课程生产工作台").inner_text()
                        link = page.locator(f'nav[aria-label="Course Studio"] a[href="{path}"]')
                        expect(link).to_be_visible()
                        assert link.evaluate("node => node.closest('a') === document.elementFromPoint(node.getBoundingClientRect().left + 10, node.getBoundingClientRect().top + 10)?.closest('a')"), f"{path} is covered"
                        link.click()
                        page.wait_for_url(f"**{path}")
                        expect(page.get_by_role("heading", name=title)).to_be_visible()
                        active = page.locator(f'nav[aria-label="Course Studio"] a[href="{path}"]')
                        expect(active).to_have_attribute("aria-current", "page")
                        route_response = next(
                            (item for item in reversed(document_responses) if str(item["url"]).split("?", 1)[0].endswith(path)),
                            None,
                        )
                        assert route_response and route_response["status"] == 200, route_response
                        result["routes"].append({
                            "label": label,
                            "href": path,
                            "domRole": "link",
                            "beforeUrl": before_url,
                            "beforeTitle": before_title,
                            "afterUrl": page.url,
                            "afterTitle": title,
                            "active": True,
                            "documentStatus": route_response["status"],
                        })

                    # The editor is a deliberately different full workbench, but the
                    # entry is still a real, unobstructed href and supports a new tab.
                    page.goto(f"{base}/studio/", wait_until="networkidle")
                    editor_link = page.locator('nav[aria-label="Course Studio"] a[href="/studio/editor/"]')
                    with context.expect_page() as popup_info:
                        editor_link.click(modifiers=["Meta"])
                    popup = popup_info.value
                    popup.wait_for_load_state("networkidle")
                    expect(popup.get_by_role("heading", name="课程编排工作台")).to_be_visible()
                    assert "/studio/editor/" in popup.url
                    result["editorRoute"] = {
                        "label": "课程编辑器",
                        "href": "/studio/editor/",
                        "domRole": "link",
                        "afterUrl": popup.url,
                        "afterTitle": "课程编排工作台",
                        "openMode": "Meta/Cmd new tab",
                        "fullWorkbenchPreserved": True,
                    }
                    popup.close()

                    # Keyboard Enter follows the same real URL and active state.
                    preview_link = page.locator('nav[aria-label="Course Studio"] a[href="/studio/preview/"]')
                    preview_link.focus()
                    expect(preview_link).to_be_focused()
                    page.keyboard.press("Enter")
                    page.wait_for_url("**/studio/preview/")
                    expect(page.locator('a[aria-current="page"]')).to_contain_text("多角色视图验收")

                    # A copied authenticated session still follows the same
                    # anchors when hydration/JavaScript is unavailable.
                    no_js = browser.new_context(viewport={"width": 1024, "height": 800}, java_script_enabled=False)
                    no_js.add_cookies(context.cookies())
                    no_js_page = no_js.new_page()
                    no_js_page.goto(f"{base}/studio/", wait_until="load")
                    no_js_page.locator('nav[aria-label="Course Studio"] a[href="/studio/releases/"]').click()
                    no_js_page.wait_for_url("**/studio/releases/")
                    expect(no_js_page.get_by_role("heading", name="验收与发布")).to_be_visible()
                    expect(no_js_page.locator('a[href="/studio/releases/"]')).to_have_attribute("aria-current", "page")
                    no_js.close()
                    result["noJavaScriptNavigation"] = True

                    # Unified account menu exposes the direct operations promised by
                    # T-087; no credential appears in DOM or browser storage.
                    summary = page.locator('summary[aria-label="账户菜单：T087 浏览器验收管理员"]')
                    summary.click()
                    for label in ("账户中心", "切换账号", "退出登录"):
                        expect(page.get_by_text(label, exact=True)).to_be_visible()
                    stored = page.evaluate("() => JSON.stringify({...localStorage, ...sessionStorage})")
                    assert username not in stored and password not in stored

                    # The same account control remains reachable on the other
                    # authenticated management surfaces; the projector screen
                    # is intentionally excluded because it is a redacted shared display.
                    for path, heading in (
                        ("/classroom/", "课堂中心"),
                        ("/account/", "Young Builder 账户"),
                        ("/course/", "课件是导师的工具，"),
                    ):
                        page.goto(f"{base}{path}", wait_until="networkidle")
                        expect(page.get_by_role("heading", name=heading)).to_be_visible()
                        expect(page.locator('summary[aria-label="账户菜单：T087 浏览器验收管理员"]')).to_be_visible()
                        result["protectedMenus"].append(path)

                    page.goto(f"{base}/studio/preview/", wait_until="networkidle")
                    page.locator('summary[aria-label="账户菜单：T087 浏览器验收管理员"]').click()
                    page.screenshot(path=str(QA / "studio-account-menu.png"), full_page=True)
                    result["authenticatedScreenshot"] = "docs/qa/t087-account-navigation/studio-account-menu.png"
                    page.locator('summary[aria-label="账户菜单：T087 浏览器验收管理员"]').click()

                    for width in (1440, 390):
                        page.set_viewport_size({"width": width, "height": 900})
                        page.wait_for_timeout(80)
                        geometry = page.evaluate("() => ({innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth})")
                        assert geometry["body"] <= geometry["innerWidth"] + 1
                        assert geometry["root"] <= geometry["innerWidth"] + 1
                        result["viewports"][str(width)] = geometry

                    page.set_viewport_size({"width": 1440, "height": 1000})
                    page.goto(f"{base}/studio/", wait_until="networkidle")
                    page.locator('summary[aria-label="账户菜单：T087 浏览器验收管理员"]').click()
                    page.get_by_text("切换账号", exact=True).click()
                    page.wait_for_url("**/auth/login/**")
                    page.wait_for_load_state("networkidle")
                    expect(page.get_by_text("原账号已经在服务器端安全退出", exact=False)).to_be_visible()
                    assert session_status(page, base) == 401

                    login(page, base, username, password)
                    page.locator('summary[aria-label="账户菜单：T087 浏览器验收管理员"]').click()
                    page.get_by_text("退出登录", exact=True).click()
                    page.wait_for_url("**/auth/login/**")
                    page.wait_for_load_state("networkidle")
                    expect(page.get_by_text("已经安全退出当前账号。", exact=True)).to_be_visible()
                    assert session_status(page, base) == 401

                    page.screenshot(path=str(QA / "signed-out.png"), full_page=True)
                    assert not page_errors, page_errors
                    assert not failed_requests, failed_requests
                    assert not server_errors, server_errors
                    result.update({
                        "ok": True,
                        "mouseNavigation": True,
                        "keyboardNavigation": True,
                        "newTabNavigation": True,
                        "accountMenu": True,
                        "serverLogout": True,
                        "pageErrors": 0,
                        "requestFailures": 0,
                        "serverErrors": 0,
                        "networkDocuments": document_responses,
                        "screenshot": "docs/qa/t087-account-navigation/signed-out.png",
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
