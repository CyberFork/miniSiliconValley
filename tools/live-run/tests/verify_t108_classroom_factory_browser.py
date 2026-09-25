#!/usr/bin/env python3
"""T-108 isolated Chromium acceptance for Classroom Factory recovery and gates."""
from __future__ import annotations
import http.client, json, os, secrets, socket, subprocess, tempfile, time
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse
from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t108-classroom-factory"

def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); return int(s.getsockname()[1])

def ready(port: int, process: subprocess.Popen[str], log: Path) -> None:
    until = time.monotonic() + 45
    while time.monotonic() < until:
        if process.poll() is not None: raise RuntimeError(log.read_text(errors="replace"))
        try:
            c = http.client.HTTPConnection("127.0.0.1", port, timeout=1); c.request("GET", "/api/auth/session")
            status = c.getresponse().status; c.close()
            if status in (200, 401): return
        except OSError: pass
        time.sleep(.2)
    raise TimeoutError(log.read_text(errors="replace"))

def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port, stamp = free_port(), secrets.token_hex(4); base = f"http://127.0.0.1:{port}"
    username, password = f"t108-admin-{stamp}", f"T108 browser {secrets.token_urlsafe(16)}!"
    with tempfile.TemporaryDirectory(prefix="msv-t108-browser-") as temp:
        root = Path(temp); accounts = root / "accounts.json"; seed = root / "seed.sql"
        accounts.write_text(json.dumps({
            "dm":{"username":username,"name":"T108 验收管理员","password":password},
            "mentors":[], "learners":[],
            "outsider":{"username":f"{username}-outside","name":"T108 Outside","password":f"{password} outside"},
        }, ensure_ascii=False))
        env = {**os.environ, "CI":"1", "NO_COLOR":"1", "WRANGLER_SEND_METRICS":"false"}
        subprocess.run([str(REPO/"node_modules/.bin/tsx"),"scripts/generate-auth-seed.ts","--accounts",str(accounts),"--output",str(seed)], cwd=REPO, env=env, check=True, capture_output=True, text=True)
        subprocess.run([str(REPO/"node_modules/.bin/wrangler"),"d1","execute","DB","--yes","--json","--local","--persist-to",temp,"--config","dist/server/wrangler.json","--file",str(seed)], cwd=REPO, env=env, check=True, capture_output=True, text=True)
        log = root / "wrangler.log"
        with log.open("w") as out:
            proc = subprocess.Popen([str(REPO/"node_modules/.bin/wrangler"),"dev","--config","wrangler.json","--persist-to",temp,"--ip","127.0.0.1","--port",str(port),"--no-show-interactive-dev-session"], cwd=REPO/"dist/server", env=env, stdout=out, stderr=subprocess.STDOUT, text=True)
            try:
                ready(port, proc, log)
                with sync_playwright() as pw:
                    launch = {"headless":True};
                    if CHROME.exists(): launch["executable_path"] = str(CHROME)
                    browser = pw.chromium.launch(**launch); page = browser.new_page(viewport={"width":1440,"height":1000})
                    page.goto(f"{base}/auth/login/?returnTo={quote('/classroom/')}", wait_until="networkidle")
                    page.locator('input[name="username"]').fill(username); page.locator('input[name="password"]').fill(password)
                    page.get_by_role("button", name="进入 Mini Silicon Valley").click(); page.wait_for_url("**/classroom/")
                    expect(page.get_by_role("heading", name="课堂中心")).to_be_visible()
                    # Ordinary Admin navigation and visible factory even while dependencies fail.
                    expect(page.get_by_role("heading", name="Classroom Factory")).to_be_visible(timeout=20_000)
                    page.route("**/api/studio/bootstrap**", lambda r: r.abort())
                    page.reload(wait_until="networkidle"); expect(page.locator("#factory")).to_be_visible(); expect(page.get_by_role("button", name="重试课程数据")).to_be_visible()
                    page.unroute("**/api/studio/bootstrap**")
                    page.route("**/api/studio/accounts", lambda r: r.abort())
                    page.reload(wait_until="networkidle"); expect(page.locator("#factory")).to_be_visible(); expect(page.get_by_role("button", name="重试成员账号")).to_be_visible()
                    page.unroute("**/api/studio/accounts")
                    title = page.locator("#classroom-title input"); title.fill("T108 刷新保留课堂")
                    page.route("**/api/studio/bootstrap**", lambda r: r.abort())
                    page.get_by_role("button", name="刷新创建条件").click(); page.wait_for_timeout(500)
                    expect(title).to_have_value("T108 刷新保留课堂")
                    page.unroute("**/api/studio/bootstrap**")
                    # Course title/version and learner count remain inspectable without View receipt;
                    # creation stays disabled with an explicit readiness message.
                    def no_view(route):
                        response = route.fetch(); body = response.json()
                        payload = body.get("data", body); payload["viewReceipts"] = []
                        route.fulfill(response=response, json=body)
                    page.route("**/api/studio/bootstrap**", no_view); page.reload(wait_until="networkidle")
                    expect(page.locator("#factory")).to_be_visible(); expect(page.locator("#classroom-title")).to_be_visible()
                    expect(page.get_by_text("课程视图检查")).to_be_visible(timeout=10_000)
                    expect(page.get_by_label("学员人数")).to_be_enabled()
                    expect(page.get_by_role("button", name="创建真实 UI 验收课堂 →")).to_be_disabled()
                    preview = page.get_by_role("link", name="检查这个版本")
                    href = preview.get_attribute("href"); assert href and "course=" in href and "revision=" in href and "digest=" in href
                    page.screenshot(path=QA / "candidate-with-actionable-gates.png", full_page=True)
                    preview.click(); page.wait_for_url(lambda u: f"{urlparse(str(u)).path}?{urlparse(str(u)).query}" == href)
                    page.go_back(wait_until="networkidle")
                    page.unroute("**/api/studio/bootstrap**")

                    # A dead exact deep link stays selected as unavailable. It must
                    # never be silently replaced by the first current course.
                    missing_course, missing_revision, missing_digest = "missing/course", 999, "deadbeef"
                    deep = f"/classroom/?course={quote(missing_course, safe='')}&revision={missing_revision}&digest={missing_digest}&environment=test"
                    page.goto(f"{base}{deep}", wait_until="networkidle")
                    selected = page.get_by_label("选择课程剧本版本").locator("option:checked")
                    expect(selected).to_contain_text(f"{missing_course} · r{missing_revision}")
                    expect(selected).to_contain_text("当前不可用（未自动换课）")
                    expect(page.get_by_text("导师课件 · 自动使用最新发布版")).to_be_visible()
                    assert page.get_by_label("P 导师课件").count() == 0, "Factory must not expose courseware version selectors"
                    exact_repair = page.get_by_role("link", name="查看视图验收")
                    exact_href = exact_repair.get_attribute("href"); assert exact_href
                    query = parse_qs(urlparse(exact_href).query)
                    assert query == {"course":[missing_course], "revision":[str(missing_revision)], "digest":[missing_digest]}, query
                    page.screenshot(path=QA / "unavailable-exact-version.png", full_page=True)
                    responsive = {}
                    for name, width, height in (("phone", 390, 844), ("pad", 768, 1024)):
                        page.set_viewport_size({"width":width,"height":height})
                        expect(page.locator("#factory")).to_be_visible()
                        geometry = page.evaluate("""() => ({inner:window.innerWidth, scroll:document.documentElement.scrollWidth,
                          overflow:[...document.querySelectorAll('body *')].map((el) => { const r=el.getBoundingClientRect(); return {tag:el.tagName, cls:String(el.className || ''), left:r.left, right:r.right, width:r.width}; })
                            .filter((r) => r.right > window.innerWidth + 1 || r.left < -1).slice(0,12)})""")
                        assert geometry["scroll"] <= geometry["inner"], (name, geometry)
                        responsive[name] = {"width":width,"height":height,"noHorizontalOverflow":True}
                        if name == "phone": page.screenshot(path=QA / "actionable-gates-phone.png", full_page=True)
                    result = {"ok":True,"scope":"isolated local D1; no production writes","adminClassroomClick":True,"dependencyRetries":True,"candidateWithoutView":True,"exactPreviewOrdinaryClick":True,"unavailableDeepLinkNotSubstituted":True,"singleScriptVersionSelection":True,"coursewareVersionSelectors":False,"responsive":responsive}
                    (QA / "browser-receipt.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(json.dumps(result, ensure_ascii=False))
                    browser.close()
            finally:
                proc.terminate()
                try: proc.wait(timeout=5)
                except subprocess.TimeoutExpired: proc.kill()

if __name__ == "__main__": main()
