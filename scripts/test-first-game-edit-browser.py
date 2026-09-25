"""Real browser acceptance for T-131's click-to-edit dialog.

The surrounding isolated app smoke owns the server, account fixture and
submission.  This script never points at production data.
"""

import os
from playwright.sync_api import sync_playwright


base = os.environ["MSV_FIRST_GAME_BROWSER_BASE"].rstrip("/")
submission_id = os.environ["MSV_FIRST_GAME_BROWSER_SUBMISSION_ID"]
username = os.environ["MSV_FIRST_GAME_BROWSER_USERNAME"]
password = os.environ["MSV_FIRST_GAME_BROWSER_PASSWORD"]
chrome = os.getenv("MSV_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
detail_path = f"/homework/first-game/submissions/{submission_id}/"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=chrome)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, has_touch=True)
    page = context.new_page()
    errors: list[str] = []
    page.on("console", lambda message: errors.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"page:{error}"))
    page.goto(f"{base}/auth/login?add=1&returnTo={detail_path}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(f"{base}{detail_path}")
    page.get_by_text("导师编辑模式", exact=True).wait_for()

    edit_game_name = page.get_by_role("button", name="修改：我的游戏叫")
    edit_game_name.click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for()
    dialog.locator("input").fill("浏览器弹窗修订")
    if screenshot_path := os.getenv("MSV_FIRST_GAME_BROWSER_SCREENSHOT"):
        page.screenshot(path=screenshot_path, full_page=False)
    dialog.get_by_role("button", name="保存修改").click()
    dialog.wait_for(state="hidden")
    page.get_by_text("浏览器弹窗修订", exact=True).wait_for()
    page.reload(wait_until="networkidle")
    page.get_by_text("浏览器弹窗修订", exact=True).wait_for()

    edit_one_sentence = page.get_by_role("button", name="修改：一句话介绍")
    edit_one_sentence.focus()
    page.keyboard.press("Enter")
    page.get_by_role("dialog").wait_for()
    page.keyboard.press("Escape")
    page.get_by_role("dialog").wait_for(state="hidden")

    page.set_viewport_size({"width": 390, "height": 844})
    edit_game_name.tap()
    page.get_by_role("dialog").wait_for()
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
    page.get_by_role("button", name="关闭修改弹窗").tap()
    assert not errors, "\n".join(errors)
    browser.close()

print("T131_BROWSER_PASS mouse=popup-save keyboard=open-escape touch=popup mobile=no-overflow refresh=persisted")
