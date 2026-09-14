#!/usr/bin/env python3
"""Real Chromium acceptance for T-119 against an isolated local D1."""
from __future__ import annotations

import base64
import http.client
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


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
            connection.request("GET", "/api/public/homework/first-game/submissions")
            response = connection.getresponse(); response.read(); connection.close()
            if response.status == 200:
                return
        except OSError:
            pass
        time.sleep(.2)
    raise TimeoutError(log.read_text(errors="replace"))


def no_overflow(page, label: str) -> None:
    sizes = page.evaluate("() => ({inner: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth})")
    assert sizes["body"] <= sizes["inner"] + 1 and sizes["root"] <= sizes["inner"] + 1, (label, sizes)


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    port = free_port(); base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="msv-t119-browser-") as temp:
        root = Path(temp); log = root / "wrangler.log"; image = root / "pixel.png"
        image.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII="))
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        with log.open("w", encoding="utf-8") as output:
            process = subprocess.Popen(
                [str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json", "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port), "--no-show-interactive-dev-session"],
                cwd=REPO / "dist/server", env=env, stdout=output, stderr=subprocess.STDOUT, text=True,
            )
            try:
                wait_ready(port, process, log)
                with sync_playwright() as playwright:
                    launch = {"headless": True}
                    if CHROME.exists(): launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    context = browser.new_context(viewport={"width": 820, "height": 1180}, has_touch=True, is_mobile=True)
                    page = context.new_page(); errors: list[str] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(f"{base}/homework/first-game/", wait_until="networkidle")
                    expect(page.get_by_role("heading", name="把脑中的游戏 讲清楚。")).to_be_visible()
                    expect(page.get_by_text("任何知道查看页地址的人都能看到")).to_be_visible()
                    for title in ["我的游戏是什么", "谁来玩我的游戏", "游戏怎么玩", "怎样算赢", "画出我的游戏世界", "角色故事", "关卡和任务", "敌人、障碍和道具", "奖励和成长", "胜利、失败和结局", "游戏画风、颜色和声音"]:
                        assert title in page.locator("body").inner_text()
                    no_overflow(page, "form-tablet")
                    page.get_by_label("姓名／昵称（可留空）").fill("T119 浏览器验收")
                    page.get_by_label("我的游戏叫").fill("像素信使")
                    page.get_by_text("冒险游戏", exact=True).first.click()
                    page.locator('input[type="file"]').first.set_input_files(str(image))
                    expect(page.locator('img[alt="游戏 Logo预览"]')).to_be_visible(timeout=10_000)

                    aborted = {"done": False}
                    def abort_once(route):
                        if not aborted["done"]:
                            aborted["done"] = True; route.abort()
                        else: route.continue_()
                    page.route("**/api/public/homework/first-game/submissions", abort_once)
                    page.get_by_role("button", name="提交这次作业 →").click()
                    expect(page.get_by_text("还没有提交成功")).to_be_visible()
                    expect(page.get_by_label("我的游戏叫")).to_have_value("像素信使")
                    page.unroute("**/api/public/homework/first-game/submissions", abort_once)
                    page.get_by_role("button", name="提交这次作业 →").click()
                    expect(page.get_by_text("提交成功")).to_be_visible(timeout=15_000)
                    detail_link = page.get_by_role("link", name="查看刚提交的完整内容 →")
                    detail_href = detail_link.get_attribute("href"); assert detail_href
                    detail_link.click(); page.wait_for_load_state("networkidle")
                    expect(page.get_by_role("heading", name="T119 浏览器验收 的游戏")).to_be_visible()
                    expect(page.get_by_text("像素信使", exact=True)).to_be_visible()
                    expect(page.get_by_text("冒险游戏", exact=True)).to_be_visible()
                    expect(page.locator('img[alt="游戏 Logo"]')).to_be_visible()
                    no_overflow(page, "detail-tablet")
                    page.get_by_role("link", name="全部提交").click(); page.wait_for_load_state("networkidle")
                    expect(page.get_by_role("heading", name="第一款游戏档案")).to_be_visible()
                    expect(page.get_by_text("T119 浏览器验收", exact=True)).to_be_visible()
                    no_overflow(page, "list-tablet")
                    assert not errors, errors
                    browser.close()
            finally:
                process.terminate()
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill()
    print("T119_BROWSER_PASS public=form+list+detail partial=yes image=png failure-preserves-input touch=820x1180 overflow=none d1=isolated")


if __name__ == "__main__": main()
