import os
from playwright.sync_api import sync_playwright

BASE = os.getenv("MSV_T122_URL", "http://127.0.0.1:8122")
DIST = os.getenv("MSV_T122_MODE", "source") == "dist"
CHROME = os.getenv("MSV_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
AUDIENCE = "/audience" if DIST else ""
TEACHER = "/teacher" if DIST else ""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda err: errors.append(f"page:{err}"))
    page.goto(f"{BASE}{AUDIENCE}/index.html?session=qa-audience", wait_until="networkidle")
    assert page.locator(".deck-slide").get_attribute("data-source") == "S01"
    page.keyboard.press("ArrowRight")
    assert page.evaluate("MSVModuleDeckController.getState().reveal") == 1
    page.reload(wait_until="networkidle")
    assert page.evaluate("MSVModuleDeckController.getState().reveal") == 1
    resources = page.evaluate("performance.getEntriesByType('resource').map(x=>x.name)")
    assert not any("presenter-notes" in resource for resource in resources)

    presenter = context.new_page()
    presenter.goto(f"{BASE}{TEACHER}/presenter.html?session=qa-sync", wait_until="networkidle")
    assert presenter.locator("#note-goal").inner_text().strip()
    with context.expect_page() as popup_info:
        presenter.click("#open-audience")
    audience = popup_info.value
    audience.wait_for_load_state("networkidle")
    presenter.click("#reveal")
    audience.wait_for_function("MSVModuleDeckController.getState().reveal === 1")
    presenter.keyboard.press("Shift+ArrowRight")
    audience.wait_for_function("MSVModuleDeckController.getState().slide === 1")
    assert presenter.locator("#connection").inner_text() == "投屏已连接"

    isolated = context.new_page()
    isolated.goto(f"{BASE}{AUDIENCE}/index.html?session=qa-isolated&controlled=1", wait_until="networkidle")
    assert isolated.evaluate("MSVModuleDeckController.getState().slide") == 0

    for index in range(16):
        audience.evaluate("index => MSVModuleDeckController.setState({slide:index,reveal:99})", index)
        dimensions = audience.evaluate("""() => { const slide=document.querySelector('.deck-slide'); const body=document.querySelector('.slide-body'); return {slideScroll:slide.scrollHeight,slideClient:slide.clientHeight,bodyScroll:body.scrollHeight,bodyClient:body.clientHeight}; }""")
        assert dimensions["slideScroll"] <= dimensions["slideClient"] + 1, (index, dimensions)
        assert dimensions["bodyScroll"] <= dimensions["bodyClient"] + 1, (index, dimensions)

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    mobile = mobile_context.new_page()
    mobile.goto(f"{BASE}{AUDIENCE}/index.html?session=qa-mobile", wait_until="networkidle")
    metrics = mobile.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight})")
    assert metrics["sw"] <= metrics["cw"] and metrics["sh"] <= metrics["ch"]
    mobile.tap("#advance")
    assert mobile.evaluate("MSVModuleDeckController.getState().reveal") == 1

    module_map = context.new_page()
    module_map.goto(f"{BASE}{AUDIENCE}/printables/module-map.html", wait_until="networkidle")
    assert "项目模块地图" in module_map.locator("h1").inner_text()
    interface_card = context.new_page()
    interface_card.goto(f"{BASE}{AUDIENCE}/printables/interface-card.html", wait_until="networkidle")
    assert interface_card.locator(".card").count() == 2
    assert not errors, errors
    browser.close()

print("T-122 browser checks passed: projection, reveal/refresh, presenter sync, session isolation, all-slide overflow, mobile touch and printables.")
