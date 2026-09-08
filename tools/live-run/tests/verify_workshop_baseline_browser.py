#!/usr/bin/env python3
"""Real-browser acceptance for the read-only Released baseline Workshop overlay."""
from __future__ import annotations

import copy
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
RECOVERED_WORKSHOP = Path(os.environ.get("MSV_WORKSHOP_LEGACY_ROOT", "/private/tmp/msv-workshop-prod"))

release_spec = importlib.util.spec_from_file_location(
    "minisv_package_release", REPO / "deploy" / "minisv" / "package_release.py"
)
assert release_spec and release_spec.loader
release_module = importlib.util.module_from_spec(release_spec)
release_spec.loader.exec_module(release_module)

sys.path.insert(0, str(ROOT))
from workshop_snapshot import sha256  # noqa: E402


def fallback_workshop(target: Path) -> None:
    """Portable shell for CI; local acceptance uses the recovered real Workshop."""
    target.mkdir(parents=True)
    (target / "index.html").write_text(
        """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'none'; img-src data:">
<title>Workshop fixture</title><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="/ui-theme.css"></head>
<body><header class="topbar"><div class="brand-lockup"><span class="brand-mark">MSV</span><span><strong>Mini Silicon Valley</strong><small>WORKSHOP</small></span></div><div class="session-health"></div></header>
<div class="shell"><aside class="rail"><nav id="sectionNav"><button class="nav-item is-active" data-section="overview">概览</button><button class="nav-item" type="button" data-section="decisions">决策</button></nav></aside>
<main class="workspace"><section class="workspace-section is-active" data-panel="overview"><h1>课程设计同步工坊</h1></section></main></div>
<script src="app.js"></script><script src="/ui-theme.js"></script></body></html>""",
        encoding="utf-8",
    )
    (target / "styles.css").write_text(
        """*{box-sizing:border-box}body{margin:0;color:#182433;background:#f8f3e7;font:16px/1.5 system-ui}.topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}.brand-lockup{display:flex;align-items:center;gap:10px}.shell{display:grid;grid-template-columns:220px minmax(0,1fr)}.rail{padding:16px}.nav-item{display:block;width:100%;min-height:44px;margin:5px}.workspace{min-width:0;padding:24px}.workspace-section[hidden]{display:none}.section-heading{display:flex;justify-content:space-between}.button{min-height:44px;padding:8px 12px}@media(max-width:700px){.shell{grid-template-columns:1fr}.rail{position:static}.workspace{padding:14px}}""",
        encoding="utf-8",
    )
    (target / "app.js").write_text(
        """document.addEventListener('click',e=>{const b=e.target.closest('[data-section]');if(!b)return;document.querySelectorAll('.workspace-section').forEach(x=>{const on=x.dataset.panel===b.dataset.section;x.hidden=!on;x.classList.toggle('is-active',on)});});""",
        encoding="utf-8",
    )
    (target / "public-deploy.js").write_text("", encoding="utf-8")
    (target / "manifest.json").write_text("{}", encoding="utf-8")


class QuietHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *_args) -> None:
        return


def next_snapshot(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    value = copy.deepcopy(value)
    course = value["courses"][0]
    course["revision"] += 1
    course["digest"] = "a" * 64
    value["generatedAt"] = "2026-09-06T09:00:00Z"
    refs = [
        {key: item[key] for key in ("courseId", "schemaVersion", "revision", "digest", "status")}
        for item in value["courses"]
    ]
    value["source"]["aggregateDigest"] = sha256(refs)
    value.pop("integrity", None)
    value["integrity"] = {"algorithm": "sha256", "digest": sha256(value)}
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return value


def geometry(page) -> dict:
    return page.evaluate(
        """() => { const brand=document.querySelector('.msv-static-brand'), img=brand.querySelector('img'), r=brand.getBoundingClientRect();
        return {innerWidth, rootWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth,
          brand:{left:r.left,right:r.right,top:r.top,width:r.width,height:r.height}, href:brand.getAttribute('href'),
          aria:brand.getAttribute('aria-label'), img:{width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}} }"""
    )


def wait_js(page, expression: str, timeout: float = 5.0) -> None:
    """Poll through CDP; the production CSP intentionally forbids unsafe-eval."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate(f"() => Boolean({expression})"):
            return
        time.sleep(0.04)
    raise AssertionError(f"browser condition timed out: {expression}")


def main() -> None:
    result: dict[str, object] = {"ok": False, "source": "real" if RECOVERED_WORKSHOP.is_dir() else "portable-fixture", "viewports": {}}
    artifact = Path(os.environ["MSV_QA_ARTIFACT_DIR"]) if os.environ.get("MSV_QA_ARTIFACT_DIR") else None
    if artifact:
        artifact.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        site = Path(temporary) / "site"
        workshop = site / "workshop"
        if RECOVERED_WORKSHOP.is_dir():
            shutil.copytree(RECOVERED_WORKSHOP, workshop)
            (workshop / "public-deploy.js").touch(exist_ok=True)
        else:
            fallback_workshop(workshop)
        shutil.copy2(REPO / "public" / "favicon.svg", site / "favicon.svg")
        shutil.copy2(REPO / "deploy" / "minisv" / "site" / "ui-theme.css", site / "ui-theme.css")
        shutil.copy2(REPO / "deploy" / "minisv" / "site" / "ui-theme.js", site / "ui-theme.js")
        (site / "index.html").write_text("<a id='home' href='/workshop/'>Workshop</a>", encoding="utf-8")
        release_module.apply_workshop_overlay(workshop)

        server = ThreadingHTTPServer(("127.0.0.1", 0), lambda *args, **kwargs: QuietHandler(*args, directory=str(site), **kwargs))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                launch: dict[str, object] = {"headless": True}
                if CHROME.exists():
                    launch["executable_path"] = str(CHROME)
                browser = playwright.chromium.launch(**launch)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()
                writes: list[str] = []
                page.on("request", lambda request: writes.append(f"{request.method} {request.url}") if request.method not in {"GET", "HEAD"} else None)
                page.goto(f"http://127.0.0.1:{server.server_port}/workshop/", wait_until="networkidle")
                page.locator('[data-section="baseline"]').click()
                page.wait_for_selector('[data-panel="baseline"]:not([hidden])')

                # Loading a valid source must not silently establish the meeting baseline.
                assert page.locator("#baselineCurrentSource").inner_text() == "尚未载入"
                assert "门" in page.locator("#baselineLatestSource").inner_text()
                assert page.locator("#applyBaselineUpdate").is_disabled()
                page.locator("#previewBaselineDiff").click()
                assert not page.locator("#applyBaselineUpdate").is_disabled()
                page.locator("#applyBaselineUpdate").click()
                page.locator("#baselineConfirmActor").fill("浏览器验收员")
                page.locator('#baselineConfirmDialog button[value="confirm"]').click()
                wait_js(page, "document.querySelector('#baselineCurrentSource').textContent.includes('门')")

                # A proposal is exactly one record, survives baseline refresh, and can
                # only become a change request after a separate meeting decision.
                page.locator("#baselineProposalTitle").fill("让 B06 的动作更具体")
                page.locator("#baselineProposalBody").fill("增加一次由同伴独立完成的操作验收。")
                page.locator("#baselineProposalOwner").fill("课程小组")
                page.locator("#baselineProposalForm button[type=submit]").click()
                assert page.locator("#baselineProposalList .baseline-item").count() == 1
                assert page.locator("#baselineReturnCount").inner_text() == "0"
                page.locator("#baselineActor").fill("会议主持人")
                page.locator('[data-baseline-decision="accepted"]').click()
                assert page.locator("#baselineReturnCount").inner_text() == "1"
                with page.expect_download() as download_info:
                    page.locator("#exportBaselineChanges").click()
                download = download_info.value
                downloaded = Path(temporary) / "change-request.json"
                download.save_as(downloaded)
                exported = json.loads(downloaded.read_text(encoding="utf-8"))
                assert exported["target"] == "/control/editor/" and exported["writesCourse"] is False
                assert len(exported["requests"]) == 1

                updated = next_snapshot(workshop / "confirmed-baseline.json")
                page.locator("#reloadBaselineSource").click()
                wait_js(page, f"document.querySelector('#baselineLatestSource').textContent.includes('{updated['integrity']['digest'][:12]}')")
                page.locator("#previewBaselineDiff").click()
                page.locator("#applyBaselineUpdate").click()
                page.locator("#baselineConfirmActor").fill("版本管理员")
                page.locator('#baselineConfirmDialog button[value="confirm"]').click()
                wait_js(page, "document.querySelector('#baselineProposalList .baseline-item')?.dataset.stale === 'true'")
                assert page.locator("#baselineProposalList .baseline-item").count() == 1
                old_current = page.locator("#baselineCurrentSource").inner_text()

                # Corruption never replaces the last confirmed local baseline.
                tampered = json.loads((workshop / "confirmed-baseline.json").read_text(encoding="utf-8"))
                tampered["courses"][0]["title"] = "被篡改"
                (workshop / "confirmed-baseline.json").write_text(json.dumps(tampered, ensure_ascii=False), encoding="utf-8")
                page.locator("#reloadBaselineSource").click()
                wait_js(page, "document.querySelector('#baselineError').textContent.includes('继续沿用上一版')")
                assert page.locator("#baselineCurrentSource").inner_text() == old_current

                for width, height in ((320, 760), (390, 844), (768, 1024), (1440, 900)):
                    page.set_viewport_size({"width": width, "height": height})
                    page.reload(wait_until="networkidle")
                    if page.locator("#mobileNavButton").is_visible():
                        page.locator("#mobileNavButton").click()
                    page.locator('[data-section="baseline"]').click()
                    page.wait_for_selector('[data-panel="baseline"]:not([hidden])')
                    assert not page.locator(".rail").evaluate("element => element.classList.contains('is-open')")
                    value = geometry(page)
                    assert value["rootWidth"] <= width + 1 and value["bodyWidth"] <= width + 1, (width, value)
                    assert value["brand"]["left"] >= -1 and value["brand"]["right"] <= width + 1
                    assert value["href"] == "/" and value["aria"] == "返回 Mini Silicon Valley 主页"
                    assert value["img"]["naturalWidth"] > 0 and abs(value["img"]["width"] - value["img"]["height"]) <= 1
                    if page.locator(".skip-link").count():
                        page.locator(".skip-link").focus()
                    else:
                        page.evaluate("document.body.tabIndex=-1;document.body.focus()")
                    page.keyboard.press("Tab")
                    assert page.evaluate("document.activeElement?.classList.contains('msv-static-brand')")
                    assert page.locator(".msv-static-brand").evaluate("element => element.matches(':focus-visible')")
                    result["viewports"][str(width)] = {"noOverflow": True, "brand": value["img"]}
                    if artifact and width in {390, 1440}:
                        page.screenshot(path=artifact / f"workshop-baseline-{width}.png", full_page=width == 1440)

                assert not writes, writes
                context.close()
                browser.close()
                result["ok"] = True
        finally:
            server.shutdown()
            server.server_close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
