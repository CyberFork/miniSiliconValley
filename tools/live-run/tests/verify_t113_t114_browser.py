#!/usr/bin/env python3
"""Isolated Chromium acceptance for T-113 learner search and T-114 Admin CRUD."""
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
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t113-t114-learner-accounts"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def ready(port: int, process: subprocess.Popen[str], log: Path) -> None:
    until = time.monotonic() + 50
    while time.monotonic() < until:
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


def login(page, base: str, username: str, password: str, destination: str = "/account/") -> None:
    page.goto(f"{base}/auth/login/?returnTo={quote(destination)}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(f"**{destination}")


def fill_exact(locator, value: str) -> None:
    """Enter controlled React fields exactly once under touch-enabled Chrome."""
    locator.fill(value)
    if locator.input_value() != value:
        locator.fill("")
        locator.press_sequentially(value)
    expect(locator).to_have_value(value)


def submit_dialog(page, dialog, button) -> None:
    """Use the real submit button and tolerate one lost pre-hydration click."""
    expect(button).to_be_enabled()
    button.click()
    page.wait_for_timeout(250)
    if dialog.is_visible() and button.is_enabled():
        button.click()
    expect(dialog).to_be_hidden(timeout=15_000)


def create_from_account_center(page, display_name: str, password: str, notes: str = "") -> str:
    expect(page.get_by_role("button", name="搜索", exact=True)).to_be_enabled(timeout=15_000)
    page.get_by_role("button", name="＋ 新增学员").click()
    dialog = page.get_by_role("dialog", name="新增学员")
    fill_exact(dialog.get_by_label("学员昵称"), display_name)
    fill_exact(dialog.get_by_label("一次性初始密码"), password)
    if notes:
        fill_exact(dialog.get_by_label("Admin 备注"), notes)
    submit_dialog(page, dialog, dialog.get_by_role("button", name="创建学员账号"))
    try:
        expect(page.get_by_role("status")).to_contain_text("已创建", timeout=15_000)
    except AssertionError:
        print(json.dumps({"createFailure": display_name, "alerts": page.get_by_role("alert").all_inner_texts(), "dialog": dialog.inner_text() if dialog.count() else None}, ensure_ascii=False))
        raise
    notice = page.get_by_role("status").inner_text()
    marker = "@msv-student-"
    assert marker in notice, notice
    suffix = notice.split(marker, 1)[1].split("。", 1)[0].strip()
    return f"msv-student-{suffix}"


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port, stamp = free_port(), secrets.token_hex(4)
    base = f"http://127.0.0.1:{port}"
    admin_username = f"t114-admin-{stamp}"
    mentor_username = f"t114-mentor-{stamp}"
    admin_password = f"T114 browser admin {secrets.token_urlsafe(16)}!"
    mentor_password = f"T114 browser mentor {secrets.token_urlsafe(16)}!"
    learners = [
        {"username": f"msv-student-0{index}", "name": f"学员 0{index}", "password": f"T114 learner 0{index} isolated password!"}
        for index in range(1, 5)
    ]

    with tempfile.TemporaryDirectory(prefix="msv-t113-t114-browser-") as temp:
        root = Path(temp)
        accounts = root / "accounts.json"
        seed = root / "seed.sql"
        accounts.write_text(json.dumps({
            "dm": {"username": admin_username, "name": "T114 验收管理员", "password": admin_password},
            "mentors": [{"username": mentor_username, "name": "无后台权限导师", "password": mentor_password}],
            "learners": learners,
            "outsider": {"username": f"t114-outsider-{stamp}", "name": "T114 Outside", "password": f"T114 outside {secrets.token_urlsafe(16)}!"},
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
        with log.open("w") as output:
            process = subprocess.Popen(
                [str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json", "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port), "--no-show-interactive-dev-session"],
                cwd=REPO / "dist/server", env=env, stdout=output, stderr=subprocess.STDOUT, text=True,
            )
            try:
                ready(port, process, log)
                with sync_playwright() as playwright:
                    launch = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    context = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=True)
                    page = context.new_page()
                    login(page, base, admin_username, admin_password)

                    # /account/ defaults to the Admin learner directory, not the
                    # current user's own password form.
                    expect(page.get_by_role("heading", name="学员账号管理")).to_be_visible()
                    expect(page.get_by_role("tab", name="学员管理")).to_have_attribute("aria-selected", "true")
                    page.get_by_label("搜索 ID／账号／昵称").fill("@msv-student-03")
                    page.get_by_role("button", name="搜索", exact=True).click()
                    expect(page.locator("article").filter(has_text="@msv-student-03")).to_have_count(1)
                    page.get_by_label("搜索 ID／账号／昵称").fill("学员 03")
                    page.get_by_role("button", name="搜索", exact=True).click()
                    expect(page.locator("article").filter(has_text="@msv-student-03")).to_have_count(1)

                    page.get_by_label("搜索 ID／账号／昵称").fill("")
                    page.get_by_role("button", name="搜索", exact=True).click()
                    username_05 = create_from_account_center(page, "林桐", "T114 Linton initial password 2026!", "浏览器隔离验收备注")
                    assert username_05 == "msv-student-05", username_05
                    row = page.locator("article").filter(has_text=f"@{username_05}")
                    expect(row).to_have_count(1)
                    row.get_by_role("button", name="编辑").click()
                    edit = page.get_by_role("dialog", name="编辑 林桐")
                    fill_exact(edit.get_by_label("昵称"), "林桐同学")
                    fill_exact(edit.get_by_label("Admin 备注"), "只给平台 Admin 看的备注")
                    edit.get_by_role("button", name="换一个像素头像").click()
                    submit_dialog(page, edit, edit.get_by_role("button", name="保存资料"))
                    expect(page.get_by_role("status")).to_contain_text("资料已经保存")
                    row = page.locator("article").filter(has_text=f"@{username_05}")
                    expect(row).to_contain_text("林桐同学")

                    row.get_by_role("button", name="重置密码").click()
                    reset = page.get_by_role("dialog", name="重置学员密码")
                    fill_exact(reset.get_by_label("新的一次性密码"), "T114 replacement password 2026!")
                    fill_exact(reset.get_by_label("再次输入"), "T114 replacement password 2026!")
                    reset_button = reset.get_by_role("button", name="确认重置密码")
                    submit_dialog(page, reset, reset_button)
                    try:
                        expect(page.get_by_role("status")).to_contain_text("密码已重置", timeout=15_000)
                    except AssertionError:
                        print(json.dumps({"passwordResetFailure": username_05, "alerts": page.get_by_role("alert").all_inner_texts(), "dialog": reset.inner_text() if reset.count() else None}, ensure_ascii=False))
                        raise

                    username_06 = create_from_account_center(page, "待删除隔离账号", "T114 disposable browser password 2026!")
                    assert username_06 == "msv-student-06", username_06
                    disposable = page.locator("article").filter(has_text=f"@{username_06}")
                    disposable.get_by_role("button", name="删除").click()
                    delete = page.get_by_role("dialog", name="删除学员账号")
                    expect(delete.get_by_text("可以永久删除")).to_be_visible()
                    fill_exact(delete.get_by_label("输入登录账号确认"), username_06)
                    submit_dialog(page, delete, delete.get_by_role("button", name="永久删除账号"))
                    expect(page.get_by_role("status")).to_contain_text("已永久删除")
                    expect(page.locator("article").filter(has_text=f"@{username_06}")).to_have_count(0)

                    # T-121: select a filtered page, preview the exact impact,
                    # confirm once, and delete both safe accounts through the
                    # real batch API. This is not a loop over single-row buttons.
                    username_07 = create_from_account_center(page, "待批量删除甲", "T121 disposable browser password one 2026!")
                    username_08 = create_from_account_center(page, "待批量删除乙", "T121 disposable browser password two 2026!")
                    page.get_by_label("搜索 ID／账号／昵称").fill("待批量删除")
                    page.get_by_role("button", name="搜索", exact=True).click()
                    expect(page.locator("article")).to_have_count(2)
                    page.get_by_label("选择本页学员").check()
                    expect(page.get_by_label(f"选择 待批量删除甲 @{username_07}")).to_be_checked()
                    expect(page.get_by_label(f"选择 待批量删除乙 @{username_08}")).to_be_checked()
                    page.get_by_role("button", name="批量删除（2）").click()
                    bulk_delete = page.get_by_role("dialog", name="批量删除 2 个学员")
                    expect(bulk_delete.get_by_text("2", exact=True).first).to_be_visible()
                    expect(bulk_delete.get_by_text("可永久删除", exact=True)).to_be_visible()
                    expect(bulk_delete.get_by_text("待批量删除甲", exact=True)).to_be_visible()
                    expect(bulk_delete.get_by_text("待批量删除乙", exact=True)).to_be_visible()
                    page.screenshot(path=QA / "bulk-delete-confirmation.png", full_page=False)
                    confirmation = bulk_delete.get_by_label(re.compile("输入确认文字"))
                    fill_exact(confirmation, "永久删除 2 个学员")
                    submit_dialog(page, bulk_delete, bulk_delete.get_by_role("button", name="永久删除 2 个账号"))
                    expect(page.get_by_role("status")).to_contain_text("已永久删除 2 个学员账号")
                    expect(page.locator("article")).to_have_count(0)
                    page.get_by_label("搜索 ID／账号／昵称").fill("")
                    page.get_by_role("button", name="搜索", exact=True).click()
                    expect(page.locator("article").filter(has_text=f"@{username_05}")).to_have_count(1)
                    page.screenshot(path=QA / "admin-learner-directory.png", full_page=True)

                    # The Account menu exposes separate management and self links.
                    page.locator("summary[aria-label^='账户菜单']").click()
                    expect(page.get_by_role("link", name="学员账号管理")).to_be_visible()
                    expect(page.get_by_role("link", name="我的账户")).to_be_visible()

                    # Classroom Factory uses a per-seat, server-backed picker.
                    # The isolated response widens the selected course policy so
                    # one browser run can exercise 2/4/6 rendering without
                    # creating or mutating a real Candidate.
                    def six_learner_policy(route):
                        response = route.fetch()
                        body = response.json()
                        payload = body.get("data", body)
                        for version in payload.get("versions", []):
                            version["learnerPolicy"] = {**version.get("learnerPolicy", {}), "minCount": 2, "defaultCount": 4, "maxCount": 6}
                        route.fulfill(response=response, json=body)

                    page.route("**/api/studio/bootstrap**", six_learner_policy)
                    page.goto(f"{base}/classroom/#factory", wait_until="networkidle")
                    expect(page.get_by_role("heading", name="Classroom Factory")).to_be_visible(timeout=20_000)
                    course = page.get_by_label("选择课程剧本版本")
                    eleme = course.locator("option").filter(has_text="饿了么").first
                    assert eleme.count() == 1, course.locator("option").all_text_contents()
                    course.select_option(eleme.get_attribute("value"))
                    count = page.get_by_label("学员人数")
                    option_texts = count.locator("option").all_text_contents()
                    assert all(f"{value} 名学员" in option_texts for value in (2, 4, 6)), option_texts
                    count.select_option("4")
                    # Select by @username and retain every non-target seat.
                    seat3 = page.locator('[data-seat="3"]')
                    before = [page.locator(f'[data-seat="{seat}"]').get_attribute("data-selected-user-id") for seat in (1, 2, 4)]
                    seat3.get_by_label("搜索学员 3 账号").fill(f"@{username_05}")
                    result = seat3.get_by_role("button", name=re.compile(username_05))
                    expect(result).to_be_visible()
                    result.tap()
                    managed = page.evaluate("""async () => (await (await fetch('/api/auth/admin/learners?q=msv-student-05')).json()).data.items[0].id""")
                    expect(seat3).to_have_attribute("data-selected-user-id", managed)
                    after = [page.locator(f'[data-seat="{seat}"]').get_attribute("data-selected-user-id") for seat in (1, 2, 4)]
                    assert before == after, (before, after)

                    # Duplicate account is visible but explicitly disabled.
                    seat4 = page.locator('[data-seat="4"]')
                    seat4.get_by_label("搜索学员 4 账号").fill("林桐同学")
                    duplicate = seat4.get_by_role("button", name=re.compile(username_05))
                    expect(duplicate).to_be_disabled()
                    expect(duplicate).to_contain_text("已分配给学员 3")
                    seat4.get_by_role("button", name="收起").tap()

                    # Admin-only inline creation returns to the exact seat and
                    # retains all other course configuration and member choices.
                    seat2 = page.locator('[data-seat="2"]')
                    retained = [page.locator(f'[data-seat="{seat}"]').get_attribute("data-selected-user-id") for seat in (1, 3, 4)]
                    seat2.get_by_label("搜索学员 2 账号").focus()
                    seat2.get_by_role("button", name="＋ 新增学员并回填此席").tap()
                    inline = page.get_by_role("dialog", name="为学员 2 新增账号")
                    fill_exact(inline.get_by_label("学员昵称"), "课堂新增学员")
                    fill_exact(inline.get_by_label("一次性初始密码"), "T113 inline creation password 2026!")
                    submit_dialog(page, inline, inline.get_by_role("button", name="创建并回填当前席位"))
                    expect(seat2).to_contain_text("课堂新增学员")
                    retained_after = [page.locator(f'[data-seat="{seat}"]').get_attribute("data-selected-user-id") for seat in (1, 3, 4)]
                    assert retained == retained_after, (retained, retained_after)

                    # Dynamic 2/4/6 rendering follows the course policy.
                    for learner_count in (2, 4, 6):
                        count.select_option(str(learner_count))
                        assert page.locator("#learner-members [data-seat]").count() == learner_count

                    # Keyboard search can move to and select the first result.
                    count.select_option("4")
                    keyboard = page.locator('[data-seat="1"]')
                    keyboard.get_by_label("搜索学员 1 账号").fill("student-03")
                    expect(keyboard.get_by_role("button", name=re.compile("msv-student-03"))).to_be_visible()
                    keyboard.get_by_label("搜索学员 1 账号").press("ArrowDown")
                    page.keyboard.press("Enter")
                    expect(keyboard).to_contain_text("@msv-student-03")

                    page.set_viewport_size({"width": 768, "height": 1024})
                    page.locator('[data-seat="4"]').get_by_label("搜索学员 4 账号").fill("不存在账号")
                    expect(page.get_by_text("没有匹配账号", exact=False)).to_be_visible()
                    geometry = page.evaluate("""() => ({inner:innerWidth, scroll:document.documentElement.scrollWidth})""")
                    assert geometry["scroll"] <= geometry["inner"], geometry
                    page.screenshot(path=QA / "factory-search-pad.png", full_page=True)

                    # A mentor remains able to manage their own account, but the
                    # platform-Admin learner directory and API stay forbidden.
                    mentor_context = browser.new_context(viewport={"width": 1280, "height": 900})
                    mentor_page = mentor_context.new_page()
                    login(mentor_page, base, mentor_username, mentor_password)
                    expect(mentor_page.get_by_role("heading", name="Young Builder 账户")).to_be_visible()
                    assert mentor_page.get_by_role("heading", name="学员账号管理").count() == 0
                    forbidden = mentor_page.evaluate("""async () => { const response = await fetch('/api/auth/admin/learners'); return response.status; }""")
                    assert forbidden == 403, forbidden
                    mentor_context.close()

                    receipt = {
                        "ok": True,
                        "scope": "isolated local D1; no production writes",
                        "adminCrud": {"create": True, "rename": True, "notes": True, "avatar": True, "passwordReset": True, "delete": True, "multiSelectAndBatchDelete": True},
                        "factoryPicker": {"partialAndAtSearch": True, "displayNameSearch": True, "stableUserId": True, "duplicateBlocked": True, "inlineCreateReturnFill": True, "counts": [2, 4, 6], "keyboard": True, "touch": True},
                        "authorization": {"admin": True, "mentorApiStatus": 403},
                        "responsive": {"padWidth": 768, "noHorizontalOverflow": True},
                    }
                    (QA / "browser-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(json.dumps(receipt, ensure_ascii=False))
                    context.close()
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()


if __name__ == "__main__":
    main()
