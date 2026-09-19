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
    assert page.locator('link[rel="icon"]').get_attribute("href") == "favicon.svg?v=20260919-p1-r6"
    assert page.locator(".deck-slide").get_attribute("data-source") == "S01"
    page.keyboard.press("ArrowRight")
    assert page.evaluate("MSVModuleDeckController.getState().reveal") == 1
    page.reload(wait_until="networkidle")
    assert page.evaluate("MSVModuleDeckController.getState().reveal") == 1
    resources = page.evaluate("performance.getEntriesByType('resource').map(x=>x.name)")
    assert not any("presenter-notes" in resource for resource in resources)

    presenter = context.new_page()
    presenter.goto(f"{BASE}{TEACHER}/presenter.html?session=qa-sync", wait_until="networkidle")
    assert presenter.locator('link[rel="icon"]').get_attribute("href") == "favicon.svg?v=20260919-p1-r6"
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
    audience.wait_for_selector('[data-module-3d="transform"] canvas.module-3d-canvas')
    assert audience.locator('[data-module-3d="transform"]').get_attribute("data-webgl-ready") == "true"
    assert audience.locator('[data-module-3d="transform"] .module-3d-fallback').count() == 1

    plane = presenter.locator('#current-preview [data-transform-case="plane"]')
    plane.click(force=True)
    audience.wait_for_function("MSVModuleDeckController.getState().activity.transformCase === 'plane'")
    assert audience.locator("[data-transform-stage]").get_attribute("data-transform-stage") == "plane"
    assert audience.locator('[data-module-3d="transform"]').get_attribute("data-module-3d-mode") == "plane"
    assert audience.locator('[data-transform-role="wheel"]').inner_text() == "起落架轮"
    assert "接口仍要匹配" in audience.locator("[data-transform-feedback]").inner_text()
    robot = audience.locator('[data-transform-case="robot"]')
    robot.focus()
    audience.keyboard.press("Space")
    presenter.wait_for_function("MSVModulePresenterController.getState().activity.transformCase === 'robot'")
    audience.wait_for_function("MSVModuleDeckController.getState().activity.transformCase === 'robot'")
    assert presenter.locator('#current-preview [data-transform-stage]').get_attribute("data-transform-stage") == "robot"

    presenter.keyboard.press("Shift+ArrowRight")
    audience.wait_for_function("MSVModuleDeckController.getState().slide === 2")
    presenter.wait_for_function("MSVModulePresenterController.getState().slide === 2")
    audience.wait_for_selector('[data-module-3d="automation"] canvas.module-3d-canvas')
    presenter.locator('#current-preview [data-build-step="components"]').click(force=True)
    audience.wait_for_function("MSVModuleDeckController.getState().activity.buildStep === 'components'")
    assert audience.locator('[data-build-layer="components"]').get_attribute("data-active") is not None
    assert audience.locator('[data-module-3d="automation"]').get_attribute("data-module-3d-mode") == "components"
    assert "轮组" in audience.locator("[data-build-feedback]").inner_text()
    audience.reload(wait_until="networkidle")
    assert audience.evaluate("MSVModuleDeckController.getState().activity.buildStep") == "components"
    assert audience.locator('[data-build-layer="components"]').get_attribute("data-active") is not None

    presenter.keyboard.press("Shift+ArrowRight")
    audience.wait_for_function("MSVModuleDeckController.getState().slide === 3")
    presenter.wait_for_function("MSVModulePresenterController.getState().slide === 3")
    audience.wait_for_selector('[data-module-3d="voxel"] canvas.module-3d-canvas')
    assert audience.locator('[data-module-3d="voxel"]').get_attribute("data-webgl-ready") == "true"
    assert audience.locator('[data-module-3d="voxel"] .module-3d-fallback').count() == 1
    presenter.locator('#current-preview [data-voxel-case="scope"]').click(force=True)
    audience.wait_for_function("MSVModuleDeckController.getState().activity.voxelCase === 'scope'")
    assert audience.locator('[data-module-3d="voxel"]').get_attribute("data-module-3d-mode") == "scope:blocks"
    assert "玻璃方块 + 金属方块" in audience.locator('[data-voxel-material="one"]').inner_text()
    component_step = audience.locator('[data-voxel-step="components"]')
    component_step.focus()
    audience.keyboard.press("Space")
    presenter.wait_for_function("MSVModulePresenterController.getState().activity.voxelStep === 'components'")
    audience.wait_for_function("MSVModuleDeckController.getState().activity.voxelStep === 'components'")
    assert audience.locator('[data-voxel-layer="components"]').get_attribute("data-active") is not None
    assert audience.locator('[data-module-3d="voxel"]').get_attribute("data-module-3d-mode") == "scope:components"
    assert "枪托" in audience.locator("[data-voxel-feedback]").inner_text()
    audience.reload(wait_until="networkidle")
    assert audience.evaluate("MSVModuleDeckController.getState().activity.voxelCase") == "scope"
    assert audience.evaluate("MSVModuleDeckController.getState().activity.voxelStep") == "components"

    isolated = context.new_page()
    isolated.goto(f"{BASE}{AUDIENCE}/index.html?session=qa-isolated&controlled=1", wait_until="networkidle")
    assert isolated.evaluate("MSVModuleDeckController.getState().slide") == 0

    blackbox_index = audience.evaluate("MSV_MODULE_DECK.slides.findIndex(slide => slide.id === 'module-s10')")
    audience.evaluate("index => MSVModuleDeckController.setState({slide:index,reveal:99})", blackbox_index)
    contrast = audience.evaluate("""() => {
      const rgb = value => value.match(/\\d+(?:\\.\\d+)?/g).slice(0, 3).map(Number);
      const luminance = value => {
        const channels = rgb(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      };
      const ratio = node => {
        const style = getComputedStyle(node);
        const high = Math.max(luminance(style.color), luminance(style.backgroundColor));
        const low = Math.min(luminance(style.color), luminance(style.backgroundColor));
        return (high + .05) / (low + .05);
      };
      return {
        input: ratio(document.querySelector('[data-blackbox-case]')),
        output: ratio(document.querySelector('[data-blackbox-output]')),
        question: ratio(document.querySelector('.three-questions span')),
        answer: ratio(document.querySelector('.reveal-card')),
      };
    }""")
    assert all(value >= 4.5 for value in contrast.values()), contrast
    second_input = audience.locator('[data-blackbox-case="1"]')
    second_input.click()
    assert second_input.get_attribute("aria-pressed") == "true"
    assert audience.locator('[data-blackbox-output]').nth(1).get_attribute("data-active") is not None
    assert "输入 5 → 返回 10" in audience.locator("[data-blackbox-status]").inner_text()
    wrong_input = audience.locator('[data-blackbox-case="2"]')
    wrong_input.click()
    assert audience.locator('[data-blackbox-output]').nth(2).locator("b").inner_text() == "拒绝"
    assert "发现失败行为" in audience.locator("[data-blackbox-status]").inner_text()
    wrong_input.focus()
    audience.keyboard.press("Space")
    assert audience.evaluate("MSVModuleDeckController.getState().slide") == blackbox_index

    slide_count = audience.evaluate("MSV_MODULE_DECK.slides.length")
    assert slide_count == 25
    for index in range(slide_count):
        audience.evaluate("index => MSVModuleDeckController.setState({slide:index,reveal:99})", index)
        dimensions = audience.evaluate("""() => { const slide=document.querySelector('.deck-slide'); const body=document.querySelector('.slide-body'); return {slideScroll:slide.scrollHeight,slideClient:slide.clientHeight,bodyScroll:body.scrollHeight,bodyClient:body.clientHeight}; }""")
        assert dimensions["slideScroll"] <= dimensions["slideClient"] + 1, (index, dimensions)
        assert dimensions["bodyScroll"] <= dimensions["bodyClient"] + 1, (index, dimensions)
        low_contrast = audience.evaluate("""() => {
          const parse = value => { const values = value.match(/[\\d.]+/g)?.map(Number) || []; return [values[0] || 0, values[1] || 0, values[2] || 0, values[3] ?? 1]; };
          const luminance = ([r,g,b]) => { const convert = value => (value /= 255) <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; return .2126 * convert(r) + .7152 * convert(g) + .0722 * convert(b); };
          const ratio = (foreground, background) => { const a = luminance(foreground); const b = luminance(background); return (Math.max(a,b) + .05) / (Math.min(a,b) + .05); };
          return [...document.querySelectorAll('.deck-slide *')]
            .filter(node => [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()) && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0')
            .map(node => {
              let backgroundNode = node;
              let background = [0,0,0,0];
              while (backgroundNode) {
                background = parse(getComputedStyle(backgroundNode).backgroundColor);
                if (background[3] > .95) break;
                backgroundNode = backgroundNode.parentElement;
              }
              const style = getComputedStyle(node);
              const contrast = ratio(parse(style.color), background);
              const minimum = parseFloat(style.fontSize) >= 24 ? 3 : 4.5;
              return { text: node.textContent.trim().slice(0, 48), contrast, minimum };
            })
            .filter(item => item.contrast < item.minimum);
        }""")
        assert not low_contrast, (index, low_contrast)

    # Slides are also embedded inside the dark teacher shell. The slide must
    # own its foreground palette instead of inheriting the shell's light text.
    # Audit every current-preview slide so a light card cannot silently turn
    # white again only in presenter mode.
    assert presenter.evaluate("MSV_MODULE_DECK.slides.length") == slide_count
    for index in range(slide_count):
        presenter.evaluate("index => MSVModulePresenterController.setState({slide:index,reveal:99})", index)
        presenter.wait_for_function("index => MSVModulePresenterController.getState().slide === index", arg=index)
        teacher_low_contrast = presenter.locator("#current-preview").evaluate("""root => {
          const parse = value => { const values = value.match(/[\\d.]+/g)?.map(Number) || []; return [values[0] || 0, values[1] || 0, values[2] || 0, values[3] ?? 1]; };
          const luminance = ([r,g,b]) => { const convert = value => (value /= 255) <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; return .2126 * convert(r) + .7152 * convert(g) + .0722 * convert(b); };
          const ratio = (foreground, background) => { const a = luminance(foreground); const b = luminance(background); return (Math.max(a,b) + .05) / (Math.min(a,b) + .05); };
          return [...root.querySelectorAll('.deck-slide *')]
            .filter(node => [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()) && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0')
            .map(node => {
              let backgroundNode = node;
              let background = [0,0,0,0];
              while (backgroundNode) {
                background = parse(getComputedStyle(backgroundNode).backgroundColor);
                if (background[3] > .95) break;
                backgroundNode = backgroundNode.parentElement;
              }
              const style = getComputedStyle(node);
              const contrast = ratio(parse(style.color), background);
              const minimum = parseFloat(style.fontSize) >= 24 ? 3 : 4.5;
              return { text: node.textContent.trim().slice(0, 48), contrast, minimum };
            })
            .filter(item => item.contrast < item.minimum);
        }""")
        assert not teacher_low_contrast, ("teacher", index, teacher_low_contrast)

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    mobile = mobile_context.new_page()
    mobile.goto(f"{BASE}{AUDIENCE}/index.html?session=qa-mobile", wait_until="networkidle")
    metrics = mobile.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight})")
    assert metrics["sw"] <= metrics["cw"] and metrics["sh"] <= metrics["ch"]
    mobile.tap("#advance")
    assert mobile.evaluate("MSVModuleDeckController.getState().reveal") == 1
    mobile.evaluate("MSVModuleDeckController.setState({slide:1,reveal:0})")
    mobile.wait_for_selector('[data-module-3d="transform"] canvas.module-3d-canvas')
    mobile.tap('[data-transform-case="plane"]')
    assert mobile.locator('[data-transform-role="wheel"]').inner_text() == "起落架轮"
    mobile.evaluate("MSVModuleDeckController.setState({slide:2,reveal:0})")
    mobile.wait_for_selector('[data-module-3d="automation"] canvas.module-3d-canvas')
    mobile.tap('[data-build-step="works"]')
    assert mobile.locator('[data-build-layer="works"]').get_attribute("data-active") is not None
    assert mobile.locator('[data-module-3d="automation"]').get_attribute("data-module-3d-mode") == "works"
    mobile.evaluate("MSVModuleDeckController.setState({slide:3,reveal:0})")
    mobile.wait_for_selector('[data-module-3d="voxel"] canvas.module-3d-canvas')
    mobile.tap('[data-voxel-case="scope"]')
    mobile.tap('[data-voxel-step="object"]')
    assert mobile.locator('[data-voxel-layer="object"]').get_attribute("data-active") is not None
    assert mobile.locator('[data-module-3d="voxel"]').get_attribute("data-module-3d-mode") == "scope:object"
    mobile.evaluate("index => MSVModuleDeckController.setState({slide:index,reveal:99})", mobile.evaluate("MSV_MODULE_DECK.slides.findIndex(slide => slide.id === 'module-s10')"))
    mobile.tap('[data-blackbox-case="2"]')
    assert mobile.locator('[data-blackbox-output]').nth(2).locator("b").inner_text() == "拒绝"

    module_map = context.new_page()
    module_map.goto(f"{BASE}{AUDIENCE}/printables/module-map.html", wait_until="networkidle")
    assert "我的游戏模块地图" in module_map.locator("h1").inner_text()
    interface_card = context.new_page()
    interface_card.goto(f"{BASE}{AUDIENCE}/printables/interface-card.html", wait_until="networkidle")
    assert interface_card.locator(".field").count() == 6
    assert not errors, errors
    browser.close()

print("T-132 browser checks passed (T-128/T-130 preserved): three local Three.js scenes, projection, reveal/refresh, presenter sync, session isolation, 25-slide contrast/overflow, S02-A/S02-B/S02-C and S10 mouse-keyboard-touch interaction, HTML fallbacks, and printables.")
