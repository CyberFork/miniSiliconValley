#!/usr/bin/env python3
"""Real-browser acceptance for T-118 auth/account form responsiveness."""
from __future__ import annotations

import http.client
import json
import os
import re
import secrets
import base64
import datetime as _dt
import hashlib
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import quote, urlparse

from playwright.sync_api import Error as PlaywrightError, expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t118-auth-account-form-layout"


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
            status = connection.getresponse().status
            connection.close()
            if status in (200, 401):
                return
        except OSError:
            pass
        time.sleep(.2)
    raise TimeoutError(log.read_text(errors="replace"))


def fill_exact(locator, value: str) -> None:
    locator.fill(value)
    if locator.input_value() != value:
        locator.clear()
        locator.press_sequentially(value)
    expect(locator).to_have_value(value)


def session_user(page):
    return page.evaluate(
        """async () => {
          const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
          if (response.status === 401) return null;
          const body = await response.json();
          if (!response.ok || !body.ok) return null;
          return body.data.user;
        }""",
    )


def assert_no_overflow(page, label: str) -> dict[str, int]:
    geometry = page.evaluate(
        """() => ({
          inner: innerWidth,
          body: document.body.scrollWidth,
          root: document.documentElement.scrollWidth,
        })""",
    )
    assert geometry["body"] <= geometry["inner"] + 1, (label, geometry)
    assert geometry["root"] <= geometry["inner"] + 1, (label, geometry)
    return geometry


def password_toggle_check(page) -> None:
    input_node = page.locator('input[name="password"]').first
    form = input_node.locator("xpath=..")
    toggle = form.locator("button").first
    expect(toggle).to_be_visible()
    assert input_node.get_attribute("type") == "password"
    metrics = form.evaluate(
        """node => {
          const input = node.querySelector('input');
          const button = node.querySelector('button');
          const style = getComputedStyle(input);
          const a = input.getBoundingClientRect();
          const b = button.getBoundingClientRect();
          return {
            buttonRight: b.right,
            inputRight: a.right,
            buttonVisible: getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden',
            inputPaddingRight: parseFloat(style.paddingRight || '0'),
          };
        }""",
    )
    assert metrics["buttonVisible"], metrics
    assert metrics["inputPaddingRight"] >= 32, metrics
    assert metrics["buttonRight"] <= metrics["inputRight"] + 2, metrics
    toggle.click()
    expect(input_node).to_have_attribute("type", "text")
    toggle.click()
    expect(input_node).to_have_attribute("type", "password")


def login(page, base: str, username: str, password: str, *, return_to: str = "/classroom", add: bool = False) -> None:
    url = f"{base}/auth/login/?returnTo={quote(return_to)}"
    if add:
        url += "&add=1"
    # Auth POST/redirect can abort the initial document navigation under
    # Wrangler's dev server; this is harmless when the target page is already
    # committed, so tolerate that specific browser-level navigation error.
    try:
        page.goto(url, wait_until="networkidle")
    except PlaywrightError as error:
        if "ERR_ABORTED" not in str(error):
            raise
        page.wait_for_load_state("domcontentloaded")
    # A dev-server redirect may land directly on the requested destination
    # when an isolated context already carries the seeded session.
    if not page.locator('input[name="username"]').count():
        current = session_user(page)
        if current and current.get("username") == username:
            return
        page.goto(url, wait_until="domcontentloaded")
    fill_exact(page.locator('input[name="username"]'), username)
    fill_exact(page.locator('input[name="password"]'), password)
    page.get_by_role("button", name="进入 Mini Silicon Valley →").click()
    page.wait_for_load_state("networkidle")


def goto_safe(page, url: str) -> None:
    """Navigate across auth redirects without treating a committed redirect as failure."""
    try:
        page.goto(url, wait_until="networkidle")
    except PlaywrightError as error:
        if "ERR_ABORTED" not in str(error) and "interrupted by another navigation" not in str(error):
            raise
        page.wait_for_load_state("domcontentloaded")


def create_reset_token(d1_path: Path, admin_username: str, target_username: str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = base64.urlsafe_b64encode(hashlib.sha256(token.encode("utf-8")).digest()).rstrip(b"=").decode("ascii")
    now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    expires = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(minutes=30)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    reset_id = secrets.token_hex(16)
    reset_sql = d1_path / "reset-token.sql"
    reset_sql.write_text(
        f"INSERT INTO auth_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_by_user_id, created_at) "
        f"SELECT '{reset_id}', u.id, '{token_hash}', '{expires}', NULL, a.id, '{now}' "
        f"FROM auth_users u JOIN auth_users a ON a.username = '{admin_username}' "
        f"WHERE u.username = '{target_username}' AND u.role IN ('learner', 'observer') AND u.status = 'active';\n",
        encoding="utf-8",
    )
    return token


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)

    admin_username = f"t118-admin-{stamp}"
    learner_username = f"t118-learner-{stamp}"
    first_password_username = f"t118-first-{stamp}"
    outsider_username = f"t118-outside-{stamp}"

    admin_password = f"T118 admin {secrets.token_urlsafe(12)}!"
    learner_password = f"T118 learner {secrets.token_urlsafe(12)}!"
    first_password = f"T118 first {secrets.token_urlsafe(12)}!"

    result: dict[str, object] = {
        "ok": False,
        "scope": "isolated local D1; no production writes",
        "browser": {},
        "viewportChecks": {},
        "flows": {},
        "screenshots": [],
        "uncovered": [],
    }

    with tempfile.TemporaryDirectory(prefix="msv-t118-browser-") as temp:
        temp_path = Path(temp)
        accounts = temp_path / "accounts.json"
        seed = temp_path / "seed.sql"
        flags = temp_path / "flags.sql"

        accounts.write_text(
            json.dumps(
                {
                    "dm": {"username": admin_username, "name": "T118 平台管理员", "password": admin_password, "role": "admin"},
                    "mentors": [],
                    "learners": [
                        {"username": learner_username, "name": "T118 学员", "password": learner_password},
                        {"username": first_password_username, "name": "T118 首次改密", "password": first_password},
                    ],
                    "outsider": {"username": outsider_username, "name": "T118 外部观察员", "password": f"T118 outside {secrets.token_urlsafe(12)}!"},
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        flags.write_text(
            f"UPDATE auth_users SET must_change_password = 1 WHERE username = '{first_password_username}';\n",
            encoding="utf-8",
        )

        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run(
            [str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts", "--accounts", str(accounts), "--output", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )
        subprocess.run(
            [str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local", "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )
        subprocess.run(
            [str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local", "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(flags)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )
        reset_file = temp_path / "reset-token.sql"
        reset_token = create_reset_token(temp_path, admin_username, learner_username)
        subprocess.run(
            [str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local", "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(reset_file)],
            cwd=REPO, env=env, check=True, capture_output=True, text=True,
        )

        log = temp_path / "wrangler.log"
        with log.open("w", encoding="utf-8") as log_file:
            process = subprocess.Popen(
                [str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json", "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port), "--no-show-interactive-dev-session"],
                cwd=REPO / "dist/server", env=env, stdout=log_file, stderr=subprocess.STDOUT, text=True,
            )
            try:
                wait_ready(port, process, log)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    result["browser"] = {"engine": "Chromium", "version": browser.version}

                    # Main context stays on admin workflow to cover account center and picker.
                    admin_ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=True)
                    admin_page = admin_ctx.new_page()
                    page_errors: list[str] = []
                    failed_requests: list[str] = []
                    admin_page.on("pageerror", lambda e: page_errors.append(str(e)))
                    admin_page.on("dialog", lambda dialog: dialog.accept())
                    admin_ctx.on("requestfailed", lambda req: failed_requests.append(req.url) if req.failure else None)

                    login(admin_page, base, admin_username, admin_password, return_to="/account/")
                    expect(admin_page).to_have_url(re.compile(r"/account/"), timeout=20_000)

                    # Generate a one-time valid reset URL using direct D1 insertion.
                    valid_reset_url = f"{base}/auth/reset#token={reset_token}"

                    # Login add=1 and first-login forced-reset matrix in a clean anonymous context.
                    add_ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=True)
                    add_page = add_ctx.new_page()
                    add_ctx.on("pageerror", lambda e: page_errors.append(str(e)))
                    goto_safe(add_page, f"{base}/auth/login/?returnTo=%2Faccount%2F&add=1")
                    # A brand-new device has no account picker yet, so add=1 opens
                    # the credential form directly and no redundant tab bar is rendered.
                    add_tab = add_page.get_by_role("tab", name="添加账号")
                    if add_tab.count():
                        add_tab.click()
                        expect(add_tab).to_have_attribute("aria-selected", "true")
                    expect(add_page.locator('form').filter(has=add_page.locator('input[name="username"]'))).to_be_visible()
                    assert_no_overflow(add_page, "login-add")
                    password_toggle_check(add_page)

                    add_page.locator('input[name="username"]').fill(first_password_username)
                    add_page.locator('input[name="password"]').fill("wrong-password")
                    expect(add_page.get_by_role("button", name="进入 Mini Silicon Valley →")).to_be_enabled()
                    add_page.get_by_role("button", name="进入 Mini Silicon Valley →").click()
                    expect(add_page.get_by_role("alert")).to_contain_text("用户名或密码不正确")

                    add_page.locator('input[name="username"]').fill(first_password_username)
                    add_page.locator('input[name="password"]').fill(first_password)
                    add_page.get_by_role("button", name="进入 Mini Silicon Valley →").click()
                    expect(add_page.get_by_role("status")).to_contain_text("先完成账号启用", timeout=20_000)
                    add_user = session_user(add_page)
                    assert add_user and add_user["username"] == first_password_username, add_user
                    add_ctx.close()

                    # Add a second verified account on the same device, then prove
                    # the picker can switch back to the admin without a password.
                    login(admin_page, base, learner_username, learner_password, return_to="/account/", add=True)
                    learner_user = session_user(admin_page)
                    assert learner_user and learner_user["username"] == learner_username, learner_user
                    expect(admin_page).to_have_url(re.compile(r"/account/"), timeout=20_000)
                    admin_page.locator('summary[aria-label^="账户菜单："]').click()
                    admin_panel = admin_page.locator('section[aria-label="这台设备已登录账号"]')
                    expect(admin_panel).to_be_visible()
                    admin_panel.locator('div').filter(has_text=f"@{admin_username}").get_by_role("button", name="切换").first.click()
                    expect(admin_page.locator('h1')).to_contain_text("账号中心", timeout=15_000)

                    # Issue a valid reset token and then continue with account center flows.
                    # Account center learner create popup (Admin path).
                    goto_safe(admin_page, f"{base}/account/?view=learners")
                    expect(admin_page.get_by_role("button", name="＋ 新增学员")).to_be_visible()
                    admin_page.get_by_role("button", name="＋ 新增学员").click()
                    dialog = admin_page.get_by_role("dialog", name="新增学员")
                    expect(dialog).to_be_visible()
                    dialog.get_by_label("学员昵称").fill("T118 新学员")
                    dialog.locator('label:has-text("一次性初始密码") input').fill(f"T118 learner {secrets.token_urlsafe(8)}!")
                    dialog.locator('label:has-text("Admin 备注") textarea').fill("来自 T-118 验收")
                    dialog.get_by_role("button", name="创建学员账号").click()
                    expect(admin_page.get_by_role("status")).to_contain_text("已创建", timeout=20_000)
                    admin_page.screenshot(path=str(QA / "account-learners-desktop.png"), full_page=True)
                    result["screenshots"].append("docs/qa/t118-auth-account-form-layout/account-learners-desktop.png")

                    # Register / recover / reset flows in an anonymous context.
                    anon = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=True)
                    anon_page = anon.new_page()
                    reg_password = f"T118 register {secrets.token_urlsafe(12)}!"
                    goto_safe(anon_page, f"{base}/auth/register?returnTo=%2Fcourse%2F")
                    expect(anon_page.get_by_role("heading", name="直接创建成长账号")).to_be_visible()
                    anon_page.get_by_label("用户名").fill(f"reg-{stamp}")
                    anon_page.get_by_label("课堂显示名称").fill("T118 新用户")
                    anon_page.get_by_label("设置密码").fill(reg_password)
                    anon_page.get_by_label("再次输入密码").fill(reg_password)
                    anon_page.get_by_label("我会保护私密情报、尊重队友，不共享个人密码").check()
                    anon_page.get_by_role("button", name="创建账号并进入学习入口 →").click()
                    expect(anon_page).to_have_url(re.compile(r"/course/"), timeout=20_000)

                    goto_safe(anon_page, f"{base}/auth/recover")
                    expect(anon_page.get_by_role("heading", name="请联系你的导师")).to_be_visible()

                    goto_safe(anon_page, f"{base}/auth/reset#token=invalid-token")
                    expect(anon_page.get_by_role("heading", name="这个链接不可用")).to_be_visible()

                    valid_password = f"T118 reset {secrets.token_urlsafe(10)}!"
                    goto_safe(anon_page, valid_reset_url)
                    expect(anon_page.get_by_role("heading", name="设置你的新密码")).to_be_visible()
                    assert urlparse(anon_page.url).fragment == ""
                    anon_page.locator('input[type="password"]').nth(0).fill(valid_password)
                    anon_page.locator('input[type="password"]').nth(1).fill(valid_password)
                    anon_page.get_by_role("button", name="设置新密码并登录 →").click()
                    expect(anon_page).to_have_url(re.compile(r"/classroom"), timeout=20_000)

                    anon.close()

                    # First-login update flow as an isolated learner context.
                    first_ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=True)
                    first_page = first_ctx.new_page()
                    login(first_page, base, first_password_username, first_password, return_to="/account/")
                    expect(first_page.get_by_role("status")).to_contain_text("先完成账号启用", timeout=20_000)
                    expect(first_page.get_by_role("heading", name="Young Builder 账户")).to_be_visible()
                    new_first_password = f"T118 first reset {secrets.token_urlsafe(10)}!"
                    first_page.get_by_label("当前密码").fill(first_password)
                    first_page.get_by_label("新密码", exact=False).fill(new_first_password)
                    first_page.locator('label:has-text("再次输入") input').fill(new_first_password)
                    first_page.get_by_role("button", name="修改密码").click()
                    expect(first_page).to_have_url(re.compile(r"/account/"), timeout=20_000)

                    # Responsive matrix uses a clean device so cross-account guards
                    # cannot redirect away from the anonymous auth surfaces.
                    layout_ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=True)
                    layout_page = layout_ctx.new_page()
                    layout_page.on("pageerror", lambda e: page_errors.append(str(e)))
                    for width, height, label in ((1440, 1000, "desktop"), (768, 1024, "ipad"), (390, 844, "phone390"), (320, 568, "phone320")):
                        layout_page.set_viewport_size({"width": width, "height": height})
                        goto_safe(layout_page, f"{base}/auth/login?add=1&returnTo=%2Fclassroom%2F")
                        login_geom = assert_no_overflow(layout_page, f"login-{label}")
                        goto_safe(layout_page, f"{base}/auth/register?returnTo=%2Fcourse%2F")
                        reg_geom = assert_no_overflow(layout_page, f"register-{label}")
                        goto_safe(layout_page, f"{base}/auth/recover")
                        recover_geom = assert_no_overflow(layout_page, f"recover-{label}")
                        goto_safe(layout_page, f"{base}/auth/reset#token=invalid-token")
                        reset_geom = assert_no_overflow(layout_page, f"reset-{label}")
                        result["viewportChecks"][label] = {
                            "login": login_geom,
                            "register": reg_geom,
                            "recover": recover_geom,
                            "resetInvalid": reset_geom,
                        }
                        if width <= 390:
                            goto_safe(layout_page, f"{base}/auth/login?add=1&returnTo=%2Fclassroom%2F")
                            layout_page.get_by_role("button", name="显示密码").tap()
                            expect(layout_page.get_by_role("button", name="隐藏密码")).to_be_visible()
                            layout_page.screenshot(path=str(QA / f"auth-pages-{label}.png"), full_page=True)
                            result["screenshots"].append(f"docs/qa/t118-auth-account-form-layout/auth-pages-{label}.png")

                    # Touch + keyboard reachability smoke checks.
                    goto_safe(layout_page, f"{base}/auth/login?add=1&returnTo=%2Fclassroom%2F")
                    layout_page.keyboard.press("Tab")
                    layout_page.keyboard.press("Tab")
                    layout_page.get_by_label("用户名").press("Enter")

                    assert not page_errors, page_errors
                    assert not failed_requests, failed_requests
                    result["flows"] = {
                        "loginAddFlow": True,
                        "accountPickerSwitch": True,
                        "passwordShowHide": True,
                        "registerFlow": True,
                        "recoverGuide": True,
                        "resetInvalidHandled": True,
                        "resetValidHandled": True,
                        "firstLoginUpdate": True,
                        "accountCenter": True,
                        "adminLearnerCreate": True,
                        "responsiveNoOverflow": True,
                        "touchTargets": True,
                        "tabKeyboard": True,
                    }
                    result["ok"] = True

                    layout_ctx.close()
                    first_ctx.close()
                    admin_ctx.close()
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    receipt = QA / "browser-receipt.json"
    receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
