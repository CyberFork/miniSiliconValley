#!/usr/bin/env python3
"""Real Chromium acceptance for T-119 against an isolated local D1."""
from __future__ import annotations

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
        root = Path(temp); log = root / "wrangler.log"
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
                    expect(page.get_by_text("请使用昵称，不要填写手机号、住址、证件、密码或他人的私密信息。")).to_be_visible()
                    expect(page.get_by_role("link", name="查看全部提交")).to_have_count(0)
                    expect(page.get_by_role("link", name="时空终端")).to_have_count(0)
                    for removed in ["可以只填一部分", "可以重复提交", "图片完全可选", "可以只交一部分"]:
                        expect(page.get_by_text(removed, exact=True)).to_have_count(0)
                    for title in ["我的游戏是什么", "谁来玩我的游戏", "游戏怎么玩", "怎样算赢", "画出我的游戏世界", "角色故事", "关卡和任务", "敌人、障碍和道具", "奖励和成长", "胜利、失败和结局", "游戏画风、颜色和声音"]:
                        assert title in page.locator("body").inner_text()
                    expect(page.locator('input[type="file"]')).to_have_count(0)
                    expect(page.locator('section[data-locked="true"]')).to_have_count(6)
                    expect(page.get_by_text("第二部分尚未解锁：还差 20 个必填项。")).to_be_visible()
                    expect(page.get_by_text("玩法句式", exact=True)).to_have_count(0)
                    for removed in ["玩家怎样从“小菜鸟”变得越来越厉害", "后面的关卡比前面难在哪里", "游戏最后，玩家会"]:
                        expect(page.get_by_text(removed, exact=True)).to_have_count(0)
                    expect(page.get_by_text("最前面的未完成项：01｜我的游戏是什么？ → 我的游戏叫")).to_be_visible()
                    no_overflow(page, "form-tablet")
                    nickname = page.locator('input[autocomplete="nickname"]')
                    expect(nickname).to_have_attribute("required", "")
                    required_mark = page.locator('[aria-label="必填"]')
                    expect(required_mark.first).to_have_text("*")
                    assert required_mark.first.evaluate("el => getComputedStyle(el).color") == "rgb(255, 107, 87)"
                    post_count = {"value": 0}
                    page.on("request", lambda request: post_count.__setitem__("value", post_count["value"] + 1) if request.method == "POST" and "/api/public/homework/first-game/submissions" in request.url else None)
                    page.get_by_role("button", name="提交这次作业 →").click()
                    assert post_count["value"] == 0
                    assert nickname.evaluate("el => el.validationMessage")
                    nickname.fill("T119 浏览器验收")
                    page.get_by_label("公司名称").fill("像素信使工作室")
                    page.get_by_role("button", name="去填写“我的游戏叫” ↑").click()
                    expect(page.get_by_label("我的游戏叫")).to_be_focused()
                    page.get_by_label("我的游戏叫").fill("像素信使")
                    expect(page.get_by_text("最前面的未完成项：01｜我的游戏是什么？ → 游戏类型")).to_be_visible()
                    page.get_by_role("button", name="🔒 去补未完成项").first.click()
                    expect(page.locator('[data-field-id="gameTypes"] input').first).to_be_focused()
                    page.get_by_text("冒险游戏", exact=True).first.click()
                    page.get_by_label("一句话介绍").fill("帮助信使找到回家的路。")
                    page.get_by_label("我的游戏是给谁玩的").fill("喜欢探索的初中生")
                    page.get_by_label("适合几岁的小朋友").fill("12—15 岁")
                    page.get_by_text("一个人玩", exact=True).first.click()
                    page.get_by_text("成就感", exact=True).first.click()
                    page.get_by_label("我觉得玩家会喜欢它，是因为").fill("每次路线都不同。")
                    page.get_by_label("第一步｜玩家一开始要").fill("选择入口")
                    page.get_by_label("第二步｜接下来玩家要").fill("收集线索")
                    page.get_by_label("第三步｜玩家继续要").fill("找到出口")
                    page.get_by_text("选择", exact=True).first.click()
                    page.get_by_label("玩家最终要完成什么事情").fill("离开迷宫")
                    page.get_by_label("完成什么就算赢").fill("找到出口")
                    page.get_by_label("发生什么就会失败").fill("时间用完")
                    page.get_by_label("玩家赢了以后会看到").fill("新的地图")
                    page.get_by_text("重新开始", exact=True).first.click()
                    page.get_by_label("游戏发生在哪里").fill("会变化的迷宫")
                    page.get_by_label("玩家是谁").fill("小小探险家")
                    page.get_by_label("玩家为什么要开始游戏").fill("找回丢失的地图")
                    expect(page.get_by_text("✓ 第一部分已完成，第二部分 06—11 已解锁。")).to_be_visible()
                    expect(page.locator('section[data-locked="true"]')).to_have_count(0)
                    expect(page.locator('[aria-label="必填"]')).to_have_count(22)
                    expect(page.locator('[data-required-missing="true"]')).to_have_count(0)
                    no_overflow(page, "form-tablet-unlocked")

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
                    expect(page.locator("img")).to_have_count(1)  # Brand logo only; no homework image output.
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
    print("T119_BROWSER_PASS public=form+list+detail identity-required=2 part1-required=20 part2-lock=yes uploads=none failure-preserves-input touch=820x1180 overflow=none d1=isolated")


if __name__ == "__main__": main()
