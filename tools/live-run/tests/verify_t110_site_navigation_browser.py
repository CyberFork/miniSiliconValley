#!/usr/bin/env python3
"""T-110 Chromium acceptance for native navigation, exact links and editor startup.

The run uses a temporary local D1 database and synthetic credentials.  It never
publishes a course, signs a human acceptance receipt, or touches production data.
Safari/iPad hardware remains the separate T-088 acceptance gate.
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

from playwright.sync_api import Page, expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t110-navigation"


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


def path_query(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.path}{'?' + parsed.query if parsed.query else ''}"


def login(page: Page, username: str, password: str, destination: str) -> None:
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(lambda url: path_query(str(url)) == destination, timeout=15_000)


def editor_startup(page: Page) -> dict[str, object]:
    page.wait_for_function("document.querySelectorAll('#courseList .course-item').length > 0", timeout=20_000)
    expect(page.locator("#editor")).to_be_visible(timeout=20_000)
    expect(page.locator("#saveState")).to_have_attribute("data-state", "saved", timeout=20_000)
    if page.locator("#libraryContent").is_hidden():
        page.locator("#topbarLibrary").click()
    expect(page.locator("#courseList .course-item").first).to_be_visible(timeout=5_000)
    trace = page.evaluate("() => ({...window.__MSV_EDITOR_STARTUP__})")
    required = [
        "loaderStart", "preloadsStarted", "scriptsReady", "bootstrapStarted",
        "bootstrapFinished", "courseListVisible", "firstCourseEditable",
    ]
    for key in required:
        assert isinstance(trace.get(key), (int, float)), (key, trace)
    assert trace["loaderStart"] <= trace["preloadsStarted"] <= trace["scriptsReady"]
    assert trace["bootstrapStarted"] <= trace["bootstrapFinished"] <= trace["courseListVisible"] <= trace["firstCourseEditable"]
    navigation = page.evaluate(
        """() => { const n = performance.getEntriesByType('navigation')[0]; return n ? {
          responseStart:n.responseStart, responseEnd:n.responseEnd,
          domContentLoaded:n.domContentLoadedEventEnd, load:n.loadEventEnd
        } : null; }"""
    )
    bootstrap = page.evaluate(
        """() => performance.getEntriesByType('resource')
          .filter((entry) => entry.name.includes('/api/studio/bootstrap?scope=current'))
          .map((entry) => ({start:entry.startTime, responseEnd:entry.responseEnd, duration:entry.duration,
            transferSize:entry.transferSize, encodedBodySize:entry.encodedBodySize, decodedBodySize:entry.decodedBodySize}))
          .at(-1) || null"""
    )
    assert bootstrap, "initial scope=current bootstrap was not recorded"
    return {"phasesMs": trace, "navigationMs": navigation, "bootstrapResource": bootstrap}


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    username = f"t110-admin-{stamp}"
    password = f"T110 browser {secrets.token_urlsafe(18)}!"
    result: dict[str, object] = {
        "ok": False,
        "scope": "isolated local D1; no production writes",
        "public": {}, "auth": {}, "studio": {}, "course": {}, "touch": {},
        "deferredToT088": ["desktop Safari", "real iPad Safari", "system back gesture", "hardware context-menu behavior"],
    }

    with tempfile.TemporaryDirectory(prefix="msv-t110-browser-") as temp:
        temp_path = Path(temp)
        fixture = temp_path / "accounts.json"
        seed = temp_path / "seed.sql"
        fixture.write_text(json.dumps({
            "dm": {"username": username, "name": "T110 导航验收管理员", "password": password},
            "mentors": [], "learners": [],
            "outsider": {"username": f"{username}-outside", "name": "T110 Outside", "password": f"{password} outside"},
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
                    page.on("pageerror", lambda error: page_errors.append(str(error)))
                    page.on("requestfailed", lambda request: failed_requests.append(request.url)
                            if request.resource_type in ("document", "script", "stylesheet") and not request.url.endswith("/favicon.svg") else None)
                    page.on("response", lambda response: server_errors.append(f"{response.status} {response.url}") if response.status >= 500 else None)

                    # Public native anchor -> protected Course -> exact login returnTo.
                    page.goto(f"{base}/", wait_until="networkidle")
                    briefing = page.get_by_role("button", name="进入迷你硅谷 →")
                    if briefing.is_visible():
                        briefing.click()
                    expect(page.get_by_role("link", name="导师课件")).to_be_visible()
                    page.get_by_role("link", name="导师课件").click()
                    page.wait_for_url("**/auth/login/**")
                    query = parse_qs(urlparse(page.url).query)
                    assert query.get("returnTo") == ["/course/"], query
                    result["public"] = {"worldToCourseOrdinaryClick": True, "protectedReturnTo": query["returnTo"][0]}

                    # Failed authentication must stay actionable; recovery and brand
                    # links use ordinary anchors and keyboard activation.
                    page.locator('input[name="username"]').fill(username)
                    page.locator('input[name="password"]').fill("definitely-wrong")
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
                    expect(page.get_by_role("alert")).to_be_visible()
                    expect(page.get_by_role("button", name="进入 Mini Silicon Valley")).to_be_enabled()
                    page.get_by_role("link", name="忘记密码").click()
                    page.wait_for_url("**/auth/recover/")
                    expect(page.get_by_role("heading", name="请联系你的导师")).to_be_visible()
                    back_login = page.get_by_role("link", name="返回登录")
                    back_login.focus()
                    expect(back_login).to_be_focused()
                    page.keyboard.press("Enter")
                    page.wait_for_url("**/auth/login/")
                    brand = page.get_by_role("link", name="返回 Mini Silicon Valley 主页")
                    brand.click()
                    page.wait_for_url(f"{base}/")
                    expect(page.get_by_role("navigation", name="主导航")).to_be_visible()

                    # Safe login returnTo is exercised with a real full-document form
                    # submit; no client router shortcut is involved.
                    destination = "/studio/releases/"
                    page.goto(f"{base}/auth/login/?returnTo={quote(destination, safe='')}", wait_until="networkidle")
                    login(page, username, password, destination)
                    expect(page.get_by_role("heading", name="验收与发布")).to_be_visible()
                    result["auth"] = {"invalidLoginFeedback": True, "recoveryClick": True, "recoveryEnter": True, "brandHomeClick": True, "safeReturnTo": destination}

                    # Studio side navigation, workflow cards and reported releases ->
                    # exact preview link all use unmodified ordinary clicks.
                    page.locator('nav[aria-label="Course Studio"] a[href="/studio/"]').click()
                    page.wait_for_url("**/studio/")
                    expect(page.get_by_role("heading", name="课程生产工作台")).to_be_visible()
                    editor_entry = page.get_by_role("link", name="打开课程编辑器 →")
                    editor_entry.click()
                    page.wait_for_url("**/studio/editor/")
                    cold = editor_startup(page)

                    # A failed release diagnostic is not a startup prerequisite.  The
                    # next navigation is warm and deliberately returns 503 only for
                    # that optional request; editor and course remain usable.
                    page.route("**/release.json", lambda route: route.fulfill(status=503, body="unavailable"))
                    page.reload(wait_until="domcontentloaded")
                    warm = editor_startup(page)
                    assert page.locator("#saveState").get_attribute("data-state") == "saved"
                    page.unroute("**/release.json")

                    # The editor's real ordinary anchor returns to Studio.  Browser
                    # back/forward/reload then proves the destination remains usable.
                    page.get_by_role("link", name="← COURSE STUDIO").click()
                    page.wait_for_url("**/studio/")
                    expect(page.get_by_role("heading", name="课程生产工作台")).to_be_visible()
                    page.go_back(wait_until="domcontentloaded")
                    editor_startup(page)
                    page.go_forward(wait_until="networkidle")
                    expect(page.get_by_role("heading", name="课程生产工作台")).to_be_visible()
                    expect(page.get_by_role("link", name="打开课程编辑器 →")).to_be_visible()

                    # Keyboard Enter matches ordinary click for the view stage.
                    view_link = page.get_by_role("link", name="开始多角色视图验收 →")
                    view_link.focus()
                    page.keyboard.press("Enter")
                    page.wait_for_url("**/studio/preview/")
                    expect(page.get_by_role("heading", name="多角色视图验收")).to_be_visible()

                    # Reproduce the originally broken releases body link.  It must
                    # retain the exact course/revision/digest and work with no Ctrl.
                    page.goto(f"{base}/studio/releases/", wait_until="networkidle")
                    exact_link = page.get_by_role("link", name="前往多角色视图验收 →").first
                    exact_href = exact_link.get_attribute("href")
                    assert exact_href and "course=" in exact_href and "revision=" in exact_href and "digest=" in exact_href
                    exact_link.click()
                    page.wait_for_url(lambda url: path_query(str(url)) == exact_href)
                    expect(page.get_by_role("heading", name="多角色视图验收")).to_be_visible()
                    page.go_back(wait_until="networkidle")
                    expect(page.get_by_role("link", name="前往多角色视图验收 →").first).to_be_visible()
                    assert "正在打开" not in page.get_by_role("link", name="前往多角色视图验收 →").first.inner_text()
                    with context.expect_page() as popup_info:
                        page.get_by_role("link", name="前往多角色视图验收 →").first.click(modifiers=["Meta"])
                    popup = popup_info.value
                    popup.wait_for_load_state("networkidle")
                    assert path_query(popup.url) == exact_href
                    popup.close()
                    result["studio"] = {
                        "ordinaryWorkflowLinks": True, "keyboardEnter": True,
                        "exactPreviewHref": exact_href, "metaNewTabPreserved": True,
                        "backForwardRefresh": True, "diagnosticFailureNonBlocking": True,
                        "startupCold": cold, "startupWarm": warm,
                    }

                    # Course library exact identity survives ordinary click, reload,
                    # back/forward and Cmd-new-tab.  Account Center is also a real
                    # navigation target rather than a menu-only label.
                    page.goto(f"{base}/course/", wait_until="networkidle")
                    expect(page.get_by_role("heading", name="课程目录")).to_be_visible()
                    page.locator('summary[aria-label="账户菜单：T110 导航验收管理员"]').click()
                    page.get_by_role("link", name="账户中心").click()
                    page.wait_for_url("**/account/")
                    expect(page.get_by_role("heading", name="Young Builder 账户")).to_be_visible()
                    page.go_back(wait_until="networkidle")
                    course_link = page.locator('a[href^="/course/"][href*="revision="][href*="digest="]').first
                    course_href = course_link.get_attribute("href")
                    assert course_href
                    course_title = course_link.locator("xpath=ancestor::article[1]").get_by_role("heading").inner_text()
                    course_link.click()
                    page.wait_for_url(lambda url: path_query(str(url)) == course_href)
                    expect(page.get_by_role("heading", name=course_title)).to_be_visible()
                    page.reload(wait_until="networkidle")
                    assert path_query(page.url) == course_href
                    expect(page.get_by_role("heading", name=course_title)).to_be_visible()
                    page.go_back(wait_until="networkidle")
                    expect(page.get_by_role("heading", name="课程目录")).to_be_visible()
                    page.go_forward(wait_until="networkidle")
                    expect(page.get_by_role("heading", name=course_title)).to_be_visible()
                    page.go_back(wait_until="networkidle")
                    with context.expect_page() as popup_info:
                        page.locator(f'a[href="{course_href}"]').click(modifiers=["Meta"])
                    popup = popup_info.value
                    popup.wait_for_load_state("networkidle")
                    assert path_query(popup.url) == course_href
                    popup.close()

                    # Expire the server session while retaining the exact deep link.
                    exact_url = f"{base}{course_href}"
                    status = page.evaluate("""async () => (await fetch('/api/auth/logout', {method:'POST', credentials:'same-origin'})).status""")
                    assert status == 200
                    page.goto(exact_url, wait_until="networkidle")
                    page.wait_for_url("**/auth/login/**")
                    return_to = parse_qs(urlparse(page.url).query).get("returnTo", [None])[0]
                    assert return_to == course_href, (return_to, course_href)
                    login(page, username, password, course_href)
                    expect(page.get_by_role("heading", name=course_title)).to_be_visible()
                    result["course"] = {
                        "accountCenterOrdinaryClick": True, "exactHref": course_href,
                        "ordinaryClick": True, "reload": True, "backForward": True,
                        "metaNewTab": True, "expiredSessionExactReturnTo": True,
                    }

                    # Chromium touch emulation is deterministic automation, not a
                    # substitute for the separate real iPad/Safari T-088 gate.
                    touch = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
                    touch.add_cookies(context.cookies())
                    touch_page = touch.new_page()
                    touch_page.goto(f"{base}/studio/", wait_until="networkidle")
                    touch_page.get_by_role("link", name="开始多角色视图验收 →").tap()
                    touch_page.wait_for_url("**/studio/preview/")
                    expect(touch_page.get_by_role("heading", name="多角色视图验收")).to_be_visible()
                    geometry = touch_page.evaluate("() => ({innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth})")
                    assert geometry["body"] <= geometry["innerWidth"] + 1
                    assert geometry["root"] <= geometry["innerWidth"] + 1
                    touch_page.screenshot(path=str(QA / "chromium-touch-preview.png"), full_page=True)
                    touch.close()
                    result["touch"] = {"chromiumEmulationSingleTap": True, "viewport": geometry, "realDeviceGate": "T-088 pending"}

                    # An absolute/foreign returnTo is never followed.  Use an
                    # independent session so the main acceptance page remains
                    # authenticated for the final screenshot and error audit.
                    unsafe = browser.new_context(viewport={"width": 900, "height": 760})
                    unsafe_page = unsafe.new_page()
                    unsafe_page.goto(f"{base}/auth/login/?returnTo=https%3A%2F%2Fevil.example%2Fescape", wait_until="networkidle")
                    login(unsafe_page, username, password, "/classroom/")
                    expect(unsafe_page.get_by_role("heading", name="课堂中心")).to_be_visible()
                    create_test = unsafe_page.get_by_role("link", name="＋ 新建测试课堂")
                    expect(create_test).to_have_attribute("href", "#factory")
                    create_test.click()
                    expect(unsafe_page.locator("#factory")).to_be_visible()
                    assert urlparse(unsafe_page.url).fragment == "factory"
                    unsafe.close()
                    result["auth"]["foreignReturnToRejected"] = True
                    result["studio"]["testClassroomCreateOrdinaryClick"] = True

                    page.goto(f"{base}/studio/releases/", wait_until="networkidle")
                    page.screenshot(path=str(QA / "releases-exact-navigation.png"), full_page=True)
                    assert not page_errors, page_errors
                    assert not failed_requests, failed_requests
                    # The deliberately injected release.json 503 is diagnostic-only.
                    unexpected_server_errors = [item for item in server_errors if not item.endswith("/release.json")]
                    assert not unexpected_server_errors, unexpected_server_errors
                    result.update({
                        "ok": True, "pageErrors": 0, "requestFailures": 0,
                        "serverErrors": 0, "expectedInjectedDiagnostic503": any(item.endswith("/release.json") for item in server_errors),
                        "screenshots": [
                            "docs/qa/t110-navigation/releases-exact-navigation.png",
                            "docs/qa/t110-navigation/chromium-touch-preview.png",
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
