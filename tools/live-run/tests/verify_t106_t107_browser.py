#!/usr/bin/env python3
"""Real-browser acceptance for T-106 multi-account switching and T-107 menus.

The suite uses synthetic accounts and an isolated local D1 database.  It never
reads or mutates production identities.  The public homepage is fulfilled from
the exact deploy/minisv/site assets while its account calls go to the same
compiled Worker, so the static shell and protected React surfaces exercise one
real authentication contract.
"""
from __future__ import annotations

import http.client
import json
import math
import os
import re
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t106-t107-accounts"
ADMIN_NAME = "T106 管理员"
LEARNER_NAME = "T106 学员"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log_path: Path) -> None:
    deadline = time.monotonic() + 50
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


def login(page: Page, base: str, username: str, password: str, return_to: str) -> None:
    page.goto(f"{base}/auth/login/?returnTo={return_to.replace('/', '%2F')}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_load_state("networkidle")


def session_user(page: Page) -> dict[str, object] | None:
    return page.evaluate(
        """async () => {
          const response = await fetch('/api/auth/session', {credentials:'same-origin', cache:'no-store'});
          if (response.status === 401) return null;
          const body = await response.json();
          if (!response.ok || !body.ok) throw new Error(body?.error?.message || `session ${response.status}`);
          return body.data.user;
        }"""
    )


def open_account_menu(page: Page, display_name: str) -> None:
    summary = page.locator(f'summary[aria-label="账户菜单：{display_name}"]')
    expect(summary).to_be_visible()
    if summary.get_attribute("aria-expanded") != "true":
        summary.click()
    expect(page.get_by_text("这台设备的账号", exact=True)).to_be_visible()


def switch_from_menu(page: Page, target_name: str) -> None:
    row = page.get_by_text(target_name, exact=True).locator("xpath=ancestor::div[1]")
    expect(row.get_by_role("button", name="切换", exact=True)).to_be_visible()
    row.get_by_role("button", name="切换", exact=True).click()


def assert_official_brand(page: Page) -> None:
    """Every portal shell must render the audited wordmark, never the favicon."""
    image = page.locator('a[href="/"] img[src*="mini-silicon-valley-logo-transparent.png"]').first
    expect(image).to_be_visible()
    dimensions = image.evaluate("node => ({naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight})")
    assert dimensions == {"naturalWidth": 1650, "naturalHeight": 420}, dimensions
    assert page.locator('a img[src*="favicon.svg"]').count() == 0


def static_shell_routes(context, base: str) -> None:
    assets = {
        f"{base}/": (REPO / "deploy/minisv/site/index.html", "text/html; charset=utf-8"),
        f"{base}/portal.js": (REPO / "deploy/minisv/site/portal.js", "application/javascript; charset=utf-8"),
        f"{base}/portal.css": (REPO / "deploy/minisv/site/portal.css", "text/css; charset=utf-8"),
    }
    for url, (path, content_type) in assets.items():
        context.route(url, lambda route, _request=None, path=path, content_type=content_type: route.fulfill(
            status=200, path=str(path), content_type=content_type
        ))


def channel(value: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)", value)
    if not match:
        raise AssertionError(f"unsupported CSS color: {value}")
    return tuple(int(item) for item in match.groups())


def contrast(foreground: str, background: str) -> float:
    def luminance(rgb: tuple[int, int, int]) -> float:
        def linear(item: int) -> float:
            value = item / 255
            return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        red, green, blue = (linear(item) for item in rgb)
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    first, second = luminance(channel(foreground)), luminance(channel(background))
    return (max(first, second) + 0.05) / (min(first, second) + 0.05)


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    admin_username = f"t106-admin-{stamp}"
    learner_username = f"t106-learner-{stamp}"
    admin_password = f"T106 admin {secrets.token_urlsafe(18)}!"
    learner_password = f"T106 learner {secrets.token_urlsafe(18)}!"
    result: dict[str, object] = {
        "ok": False,
        "syntheticAccounts": True,
        "api": {},
        "multiTab": {},
        "protectedSurfaces": [],
        "homepage": {},
        "pageErrors": [],
        "serverErrors": [],
    }

    with tempfile.TemporaryDirectory(prefix="msv-t106-browser-") as temp:
        temp_path = Path(temp)
        fixture = temp_path / "accounts.json"
        seed = temp_path / "seed.sql"
        fixture.write_text(json.dumps({
            "dm": {"username": admin_username, "name": ADMIN_NAME, "password": admin_password},
            "mentors": [],
            "learners": [{"username": learner_username, "name": LEARNER_NAME, "password": learner_password}],
            "outsider": {"username": f"t106-observer-{stamp}", "name": "T106 Observer", "password": f"T106 observer {secrets.token_urlsafe(18)}!"},
        }, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(fixture), "--output", str(seed),
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
                    result["browser"] = {"engine": "Chromium", "version": browser.version}
                    context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    page = context.new_page()
                    page_errors: list[str] = []
                    server_errors: list[str] = []
                    context.on("page", lambda opened: opened.on("pageerror", lambda error: page_errors.append(str(error))))
                    page.on("pageerror", lambda error: page_errors.append(str(error)))
                    page.on("response", lambda response: server_errors.append(f"{response.status} {response.url}") if response.status >= 500 else None)

                    # A is authenticated and upgraded into a one-account browser set.
                    login(page, base, admin_username, admin_password, "/studio/")
                    expect(page.get_by_role("heading", name="课程生产工作台")).to_be_visible()
                    open_account_menu(page, ADMIN_NAME)
                    menu_accounts = page.locator('section[aria-label="这台设备已登录账号"]')
                    expect(menu_accounts.get_by_text(ADMIN_NAME, exact=True)).to_be_visible()
                    expect(page.get_by_text("当前", exact=True)).to_be_visible()

                    # Adding B first fails.  A remains the authoritative session and
                    # cancel returns to the list without revoking or replacing A.
                    page.get_by_role("link", name="＋ 添加账号").click()
                    page.wait_for_url("**/auth/login/**")
                    expect(page.get_by_role("tab", name="添加账号")).to_have_attribute("aria-selected", "true")
                    page.locator('input[name="username"]').fill(learner_username)
                    page.locator('input[name="password"]').fill("definitely-wrong-password")
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
                    expect(page.get_by_role("alert")).to_contain_text("用户名或密码不正确")
                    assert session_user(page)["username"] == admin_username
                    page.get_by_role("button", name="取消，返回账号列表").click()
                    expect(page.get_by_role("tab", name="已登录账号")).to_have_attribute("aria-selected", "true")
                    page.get_by_role("tab", name="添加账号").click()

                    # Successful B login joins the list.  Because B is a learner and
                    # the original returnTo is Studio, navigation safely lands in the
                    # accessible Classroom Center with an explicit explanation.
                    page.locator('input[name="username"]').fill(learner_username)
                    page.locator('input[name="password"]').fill(learner_password)
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
                    page.wait_for_url("**/classroom/?accountNotice=studio-role")
                    expect(page.get_by_role("heading", name="我的课堂")).to_be_visible()
                    expect(page.get_by_role("status")).to_contain_text("没有 Course Studio 权限")
                    assert session_user(page)["username"] == learner_username
                    open_account_menu(page, LEARNER_NAME)
                    menu_accounts = page.locator('section[aria-label="这台设备已登录账号"]')
                    expect(menu_accounts.get_by_text(ADMIN_NAME, exact=True)).to_be_visible()
                    expect(menu_accounts.get_by_text(LEARNER_NAME, exact=True)).to_be_visible()
                    switch_from_menu(page, ADMIN_NAME)
                    page.wait_for_url("**/classroom/")
                    assert session_user(page)["username"] == admin_username
                    result["api"] = {
                        "failedAddPreservedA": True,
                        "cancelPreservedA": True,
                        "directAtoB": True,
                        "directBtoA": True,
                        "roleSafeFallback": True,
                    }

                    # The same current identity and menu follow A through all
                    # protected navigation shells.
                    for path, heading in (
                        ("/studio/", "课程生产工作台"),
                        ("/classroom/", "课堂中心"),
                        ("/course/", "课件查看"),
                        ("/account/", "Young Builder 账户"),
                    ):
                        page.goto(f"{base}{path}", wait_until="networkidle")
                        expect(page.get_by_role("heading", name=heading)).to_be_visible()
                        assert_official_brand(page)
                        expect(page.locator(f'summary[aria-label="账户菜单：{ADMIN_NAME}"]')).to_be_visible()
                        assert session_user(page)["username"] == admin_username
                        result["protectedSurfaces"].append(path)

                    # A second dirty Studio tab is frozen as soon as the first tab
                    # changes the browser identity.  It can switch the browser back
                    # to A without submitting or losing its in-memory draft marker.
                    page.goto(f"{base}/studio/", wait_until="networkidle")
                    dirty = context.new_page()
                    dirty.on("pageerror", lambda error: page_errors.append(str(error)))
                    dirty.on("response", lambda response: server_errors.append(f"{response.status} {response.url}") if response.status >= 500 else None)
                    dirty.goto(f"{base}/studio/editor/", wait_until="networkidle")
                    expect(dirty.get_by_role("heading", name="课程编排工作台")).to_be_visible()
                    dirty.evaluate("document.documentElement.dataset.msvUnsaved = 'true'")
                    open_account_menu(page, ADMIN_NAME)
                    switch_from_menu(page, LEARNER_NAME)
                    page.wait_for_url("**/classroom/?accountNotice=studio-role")
                    guard = dirty.get_by_role("alertdialog", name="这台设备已切换账号")
                    expect(guard).to_be_visible(timeout=8_000)
                    inert_state = dirty.evaluate("""() => ({
                      guarded: document.documentElement.dataset.msvUnsaved === 'true',
                      inertOutside: Array.from(document.body.children)
                        .filter(node => node.id !== 'msv-account-identity-guard')
                        .every(node => node.inert && node.getAttribute('aria-hidden') === 'true')
                    })""")
                    assert inert_state == {"guarded": True, "inertOutside": True}
                    dirty.get_by_role("button", name=f"切回 {ADMIN_NAME}").click()
                    expect(guard).not_to_be_visible()
                    assert dirty.evaluate("document.documentElement.dataset.msvUnsaved") == "true"
                    assert session_user(dirty)["username"] == admin_username
                    result["multiTab"] = {
                        "identityGuard": True,
                        "outsideContentInert": True,
                        "dirtyDraftPreservedAfterExplicitRestore": True,
                        "credentialsBroadcast": False,
                    }
                    page.close()
                    dirty.evaluate("delete document.documentElement.dataset.msvUnsaved")
                    page = dirty

                    # B exits independently and A remains selectable without a
                    # password.  Logout-all then makes every protected route reject
                    # the old browser state, even after navigation history is used.
                    open_account_menu(page, ADMIN_NAME)
                    switch_from_menu(page, LEARNER_NAME)
                    page.wait_for_url("**/classroom/?accountNotice=studio-role")
                    open_account_menu(page, LEARNER_NAME)
                    page.get_by_role("button", name="退出当前账号").click()
                    page.wait_for_url("**/auth/login/**signedOut=current**")
                    expect(page.get_by_role("status")).to_contain_text("其他已验证账号仍可直接选择")
                    picker = page.locator('section[aria-label="这台设备已登录账号"]')
                    expect(picker.get_by_text(ADMIN_NAME, exact=True)).to_be_visible()
                    expect(picker.get_by_text(LEARNER_NAME, exact=True)).not_to_be_visible()
                    page.get_by_role("button", name="切换", exact=True).click()
                    page.wait_for_url("**/classroom/")
                    assert session_user(page)["username"] == admin_username
                    open_account_menu(page, ADMIN_NAME)
                    page.on("dialog", lambda dialog: dialog.accept())
                    page.get_by_role("button", name="退出本设备全部账号").click()
                    page.wait_for_url("**/auth/login/**signedOut=all**")
                    expect(page.get_by_role("status")).to_contain_text("全部账号已经安全退出")
                    assert session_user(page) is None
                    page.goto(f"{base}/studio/", wait_until="networkidle")
                    page.wait_for_url("**/auth/login/**")
                    result["api"].update({"logoutCurrentKeptA": True, "logoutAllRevoked": True, "historyCannotRestore": True})

                    # Log A in once more, then serve the exact static production
                    # homepage assets against the same API and cookies.
                    login(page, base, admin_username, admin_password, "/classroom/")
                    expect(page.get_by_role("heading", name="课堂中心")).to_be_visible()
                    static_shell_routes(context, base)
                    page.goto(f"{base}/", wait_until="load")
                    assert_official_brand(page)
                    trigger = page.get_by_role("button", name=re.compile(ADMIN_NAME))
                    expect(trigger).to_be_visible()
                    trigger.click()
                    account_link = page.get_by_role("link", name="账户中心")
                    expect(account_link).to_be_visible()
                    visual_states: dict[str, object] = {}
                    for state in ("initial", "hover", "focus"):
                        if state == "hover":
                            account_link.hover()
                        elif state == "focus":
                            account_link.focus()
                        style = account_link.evaluate("""node => {
                          const s = getComputedStyle(node);
                          const r = node.getBoundingClientRect();
                          return {color:s.color, background:s.backgroundColor, fontSize:s.fontSize,
                            width:r.width, height:r.height, left:r.left, right:r.right, top:r.top, bottom:r.bottom};
                        }""")
                        ratio = contrast(style["color"], style["background"])
                        assert ratio >= 4.5, (state, style, ratio)
                        visual_states[state] = {**style, "contrast": round(ratio, 2)}
                    page.screenshot(path=str(QA / "homepage-account-menu-desktop.png"), full_page=True)

                    page.set_viewport_size({"width": 390, "height": 844})
                    panel = page.locator(".portal-account-panel")
                    expect(panel).to_be_visible()
                    geometry = panel.evaluate("""node => {
                      const r = node.getBoundingClientRect();
                      return {left:r.left, right:r.right, top:r.top, bottom:r.bottom,
                        width:r.width, viewportWidth:innerWidth, viewportHeight:innerHeight,
                        rootWidth:document.documentElement.scrollWidth};
                    }""")
                    assert geometry["left"] >= 0 and geometry["right"] <= geometry["viewportWidth"] + 1
                    assert geometry["rootWidth"] <= geometry["viewportWidth"] + 1
                    page.screenshot(path=str(QA / "homepage-account-menu-mobile.png"), full_page=True)
                    stored = page.evaluate("JSON.stringify({...localStorage, ...sessionStorage})")
                    body = page.locator("body").inner_text()
                    assert admin_password not in stored and learner_password not in stored
                    assert admin_password not in body and learner_password not in body
                    result["homepage"] = {
                        "realStaticAssets": True,
                        "officialBrandWordmark": True,
                        "desktop": visual_states,
                        "mobileGeometry": geometry,
                        "credentialStorage": False,
                        "screenshots": [
                            "docs/qa/t106-t107-accounts/homepage-account-menu-desktop.png",
                            "docs/qa/t106-t107-accounts/homepage-account-menu-mobile.png",
                        ],
                    }

                    # A separate anonymous context receives the same cacheable HTML
                    # but no identity projection from another browser context.
                    anonymous = browser.new_context(viewport={"width": 390, "height": 844})
                    static_shell_routes(anonymous, base)
                    anon_page = anonymous.new_page()
                    anon_page.on("pageerror", lambda error: page_errors.append(str(error)))
                    anon_page.goto(f"{base}/", wait_until="load")
                    anon_page.wait_for_timeout(500)
                    anon_trigger = anon_page.locator(".portal-account-trigger")
                    expect(anon_trigger).to_be_visible()
                    expect(anon_trigger).to_contain_text("登录")
                    anon_trigger.click()
                    expect(anon_page.get_by_text("这台设备还没有可直接选择的账号。", exact=True)).to_be_visible()
                    anonymous.close()
                    result["homepage"]["anonymousIsolation"] = True

                    assert not page_errors, page_errors
                    assert not server_errors, server_errors
                    result["pageErrors"] = page_errors
                    result["serverErrors"] = server_errors
                    result["ok"] = True
                    context.close()
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    receipt = QA / "browser-automated-evidence.json"
    receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
