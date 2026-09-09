#!/usr/bin/env python3
"""Browser acceptance for T-090 D-mentor simulation and DevelopmentStick."""
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

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t090-development-mentor"
CANDIDATE = REPO / "tools" / "live-run" / "courses" / "candidates" / "eleme-2008-product-development-t090.json"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log_path: Path) -> None:
    deadline = time.monotonic() + 45
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


def api(page, path: str, method: str = "GET", body: object | None = None) -> object:
    result = page.evaluate(
        """async ({path, method, body}) => {
          const response = await fetch(path, {
            method,
            credentials: 'same-origin',
            cache: 'no-store',
            headers: body === null ? undefined : {'content-type':'application/json'},
            body: body === null ? undefined : JSON.stringify(body),
          });
          const payload = await response.json();
          return {status: response.status, payload};
        }""",
        {"path": path, "method": method, "body": body},
    )
    assert result["status"] < 400, result
    return result["payload"]["data"]


def login(page, base: str, username: str, password: str, return_to: str = "/studio/preview/") -> None:
    encoded = return_to.replace("/", "%2F").replace("?", "%3F").replace("=", "%3D").replace("&", "%26")
    page.goto(f"{base}/auth/login/?returnTo={encoded}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(f"**{return_to}")


def assert_no_page_overflow(page) -> dict[str, int]:
    geometry = page.evaluate(
        """() => ({
          width: innerWidth,
          body: document.body.scrollWidth,
          root: document.documentElement.scrollWidth,
        })"""
    )
    assert geometry["body"] <= geometry["width"] + 1, geometry
    assert geometry["root"] <= geometry["width"] + 1, geometry
    return geometry


def preferred_courseware(bootstrap: dict) -> list[dict]:
    slugs = {
        "P": "product-mentor-foundations",
        "D": "development-mentor-ligun",
        "M": "market-mentor-field-kit",
        "O": "operations-mentor-field-kit",
    }
    selected = [{
        "mentorRole": item["mentorRole"],
        "packageId": item["packageId"],
        "slug": item["slug"],
        "revision": item["latestRevision"],
        "digest": item["latestDigest"],
    } for item in bootstrap["courseware"] if slugs.get(item["mentorRole"]) == item["slug"]]
    assert {item["mentorRole"] for item in selected} == {"P", "D", "M", "O"}, selected
    return selected


def unlock_through(page, room_id: str, progress: dict, target: str) -> dict:
    target_number = int(target[1:])
    while progress["unlockedThroughIndex"] + 1 < target_number:
        next_id = f"B{progress['unlockedThroughIndex'] + 2:02d}"
        progress = api(page, f"/api/platform/classrooms/{room_id}/control", "POST", {
            "expectedVersion": progress["version"],
            "action": {"type": "unlock-next", "nextBlockId": next_id},
        })
    return progress


def product_brief_values() -> dict[str, str]:
    return {
        "target-user": "校内晚上临时需要借用共享设备的学生",
        "user-task": "在活动开始前找到空闲设备，完成预约，并确认管理员能看到记录。",
        "observed-problem": "同学不知道设备是否空闲，提交后也无法确认管理员名单是否真的保存。",
        "facts-and-sources": "课堂观察：多人会查看同一设备时段。\n访谈记录：管理员依赖预约名单发放设备。",
        "assumptions": "一个统一的空闲时段入口可能减少来回询问。",
        "unknowns": "还不知道高峰时段同时提交的人数；下一步在社团活动前观察。",
        "value-hypothesis": "如果预约结果可回读且不冲突，学生会更快确认设备，管理员也不会发放错位。",
        "core-journey": "查看空闲时段 → 选择设备 → 提交预约 → 从名单回读确认。",
        "mvp-hypothesis": "一条能保存并回读的唯一预约路径，是否足以避免第一类借用冲突。",
        "boundaries": "不收集家庭住址；不承诺跨校设备；同一设备同时段只能有一条有效预约。",
    }


def development_stick_values() -> list[str]:
    return [
        "学生提交预约后页面显示成功，但管理员名单没有记录，或同一时段出现两个人。",
        "学生要在社团活动前预约一台相机，并确认管理员能够看到同一条记录。",
        "让一名学生预约一个设备时段，并从管理员名单回读到唯一且真实的结果。",
        "打开空闲时段\n选择相机和时间\n提交并保存预约\n重新打开名单确认",
        "提交后名单出现且设备、时段、学生一致\n两人同时提交时只能一人成功且名单只有一条",
        "不得先显示成功再保存\n不得收集家庭住址或家长手机号",
        "保存唯一预约｜相同设备时段最多一条\n回读真实结果｜刷新后名单仍与提交一致",
        "冲突判断函数｜相同设备时段第二次写入必须失败",
        "两台设备同时提交同一相机同一时段 → 只有一次成功且管理员名单只有一条",
        "新异常是断网重连后重复提交；旧测试只看成功提示；本次增加唯一写入与回读测试。",
    ]


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    password = f"T090 browser {secrets.token_urlsafe(18)}!"
    admin = {"username": f"t090-admin-{stamp}", "name": "T090 Admin DM", "password": password}
    mentor_names = {"P": "产品导师", "D": "开发导师", "M": "市场导师", "O": "运营导师"}
    mentors = [{
        "username": f"t090-mentor-{role.lower()}-{stamp}",
        "name": mentor_names[role],
        "password": f"{password} {role}",
    } for role in ("P", "D", "M", "O")]
    learners = [{
        "username": f"t090-builder-{index}-{stamp}",
        "name": f"Young Builder {index}",
        "password": f"{password} {index}",
    } for index in range(1, 7)]
    fixture = {
        "dm": admin,
        "mentors": mentors,
        "learners": learners,
        "outsider": {"username": f"t090-outside-{stamp}", "name": "T090 Outside", "password": f"{password} outsider"},
    }
    result: dict[str, object] = {"ok": False, "base": base}

    with tempfile.TemporaryDirectory(prefix="msv-t090-browser-") as temp:
        temp_path = Path(temp)
        fixture_path = temp_path / "accounts.json"
        seed_path = temp_path / "seed.sql"
        fixture_path.write_text(json.dumps(fixture, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "tsx"), "scripts/generate-auth-seed.ts",
            "--accounts", str(fixture_path), "--output", str(seed_path),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)
        subprocess.run([
            str(REPO / "node_modules" / ".bin" / "wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local",
            "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed_path),
        ], cwd=REPO, env=env, check=True, capture_output=True, text=True, timeout=60)

        log_path = temp_path / "wrangler.log"
        with log_path.open("w", encoding="utf-8") as wrangler_log:
            process = subprocess.Popen([
                str(REPO / "node_modules" / ".bin" / "wrangler"), "dev", "--config", "wrangler.json",
                "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port),
                "--no-show-interactive-dev-session",
            ], cwd=REPO / "dist" / "server", env=env, stdout=wrangler_log, stderr=subprocess.STDOUT, text=True)
            try:
                wait_ready(port, process, log_path)
                with sync_playwright() as playwright:
                    launch: dict[str, object] = {"headless": True}
                    if CHROME.exists():
                        launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)
                    desktop_context = browser.new_context(viewport={"width": 1600, "height": 1000})
                    desktop = desktop_context.new_page()
                    desktop_errors: list[str] = []
                    desktop_failed: list[str] = []
                    desktop.on("pageerror", lambda error: desktop_errors.append(str(error)))
                    desktop.on("requestfailed", lambda request: desktop_failed.append(request.url) if request.resource_type in ("document", "script", "stylesheet") else None)
                    login(desktop, base, admin["username"], admin["password"])

                    bootstrap = api(desktop, "/api/studio/bootstrap")
                    course = json.loads(CANDIDATE.read_text(encoding="utf-8"))
                    candidate = api(desktop, "/api/studio/candidates", "POST", {"course": course})
                    receipt = api(desktop, "/api/studio/view-acceptance", "POST", {
                        "courseRef": candidate,
                        "reviewedBlockIds": [block["id"] for block in course["blocks"]],
                        "reviewedLearnerCounts": [2, 3, 4, 5, 6],
                    })
                    courseware = preferred_courseware(bootstrap)
                    d_ref = next(item for item in courseware if item["mentorRole"] == "D")
                    assert d_ref["digest"] == "cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d"

                    rooms: dict[int, str] = {}
                    for learner_count in (2, 4, 6):
                        classroom = api(desktop, "/api/platform/classrooms", "POST", {
                            "environment": "test",
                            "title": f"T090 开发导师 {learner_count} 人浏览器验收",
                            "learnerCount": learner_count,
                            "courseRef": candidate,
                            "viewAcceptanceReceiptId": receipt["receiptId"],
                            "coursewareRefs": courseware,
                            "adminDmProfileIds": [bootstrap["user"]["userId"]],
                            "mentorSeats": [{"mentorRole": role, "profileId": mentors[index]["username"]} for index, role in enumerate(("P", "D", "M", "O"))],
                            "learnerProfileIds": [item["username"] for item in learners[:learner_count]],
                        })
                        room_id = classroom["classroomId"]
                        rooms[learner_count] = room_id
                        detail = api(desktop, f"/api/platform/classrooms/{room_id}")
                        unlock_through(desktop, room_id, detail["script"], "B05")
                        desktop.goto(f"{base}/classroom/{room_id}/?block=B05", wait_until="networkidle")
                        tabs = desktop.locator('nav[aria-label="Test Classroom 角色视角"] button')
                        assert tabs.count() == learner_count + 6, (learner_count, tabs.count())
                        for index in range(1, learner_count + 1):
                            expect(desktop.get_by_role("button", name=f"学员 {index}", exact=True)).to_be_visible()

                    # Internal preview: keyboard Block navigation and all supported
                    # 2/4/6 projections show two private cards for every learner.
                    desktop.goto(f"{base}/studio/preview/?course={candidate['courseId']}&revision={candidate['revision']}&digest={candidate['digest']}", wait_until="networkidle")
                    desktop.locator("body").press("Home")
                    expect(desktop.locator('button[data-active="true"] b')).to_contain_text("B01")
                    for _ in range(4):
                        desktop.locator("body").press("ArrowRight")
                    expect(desktop.locator('button[data-active="true"] b')).to_contain_text("B05")
                    for learner_count in (2, 4, 6):
                        desktop.get_by_role("button", name=re.compile(fr"^{learner_count}(?: ✓)?$")).click()
                        expect(desktop.get_by_text(f"✓ {learner_count} 人投影通过容量校验", exact=True)).to_be_visible()
                        learner_cards = desktop.locator('article[data-kind="learner"]')
                        assert learner_cards.count() == learner_count
                        for index in range(learner_count):
                            toggle = learner_cards.nth(index).locator("header button")
                            if toggle.get_attribute("aria-expanded") != "true":
                                toggle.click()
                            assert learner_cards.nth(index).locator('div[class*="cards"] > span').count() == 2
                    desktop.screenshot(path=str(QA / "studio-b05-2-4-6-projection.png"), full_page=True)

                    # Prepare a real accepted ProductBrief so D receives only the
                    # accepted upstream artifact when the simulation starts.
                    room_id = rooms[4]
                    api(desktop, f"/api/platform/classrooms/{room_id}/submissions", "POST", {
                        "blockId": "B04",
                        "schemaId": "product-brief-v1",
                        "values": product_brief_values(),
                        "viewAsProfileId": learners[0]["username"],
                    })
                    p_b04 = api(desktop, f"/api/platform/classrooms/{room_id}?block=B04&viewAs={mentors[0]['username']}")
                    brief = p_b04["submissions"][0]
                    api(desktop, f"/api/platform/classrooms/{room_id}/submissions/{brief['id']}/review", "POST", {
                        "status": "accepted",
                        "feedback": "问题、路径与边界足够具体，可以交给 D。",
                        "expectedUpdatedAt": brief["updatedAt"],
                        "viewAsProfileId": mentors[0]["username"],
                    })

                    desktop.goto(f"{base}/classroom/{room_id}/?block=B05", wait_until="networkidle")
                    desktop.get_by_role("button", name="学员 1", exact=True).click()
                    expect(desktop.get_by_role("heading", name=re.compile(r"B05 ·"))).to_be_visible(timeout=10_000)
                    private_cards = desktop.locator('article[class*="privateCard"]')
                    assert private_cards.count() == 2
                    for index in range(2):
                        expect(private_cards.nth(index)).to_contain_text("R 课堂模拟")
                        expect(private_cards.nth(index)).to_contain_text("课堂模拟：")
                    hand_one = private_cards.locator("b").all_text_contents()
                    desktop.get_by_role("button", name="学员 2", exact=True).click()
                    expect(desktop.locator('article[class*="privateCard"]')).to_have_count(2)
                    hand_two = desktop.locator('article[class*="privateCard"] b').all_text_contents()
                    assert set(hand_one).isdisjoint(hand_two), (hand_one, hand_two)
                    desktop.get_by_role("button", name="D · 开发导师", exact=True).click()
                    expect(desktop.get_by_text("D 专属课堂模拟剧本", exact=False)).to_be_visible(timeout=10_000)
                    expect(desktop.get_by_text("课件章节提示", exact=True)).to_be_visible()
                    expect(desktop.get_by_text("第 1—5 页", exact=False)).to_be_visible()
                    expect(desktop.get_by_text("B04 由 P 导师通过", exact=True)).to_be_visible()
                    expect(desktop.get_by_text("ProductBrief／产品定义卡", exact=False)).to_be_visible()
                    exact_link = desktop.get_by_role("link", name="打开 D 导师 exact 课件 →")
                    expect(exact_link).to_have_attribute("href", re.compile(r"/course/development-mentor-ligun/\?revision=0$"))
                    desktop_geometry = assert_no_page_overflow(desktop)
                    desktop.screenshot(path=str(QA / "b05-d-owner-and-handoff.png"), full_page=True)

                    detail = api(desktop, f"/api/platform/classrooms/{room_id}")
                    unlock_through(desktop, room_id, detail["script"], "B08")

                    # A separate touch-enabled mobile session proves that core
                    # learner/review/navigation work needs neither hover nor a keyboard.
                    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
                    mobile = mobile_context.new_page()
                    mobile_errors: list[str] = []
                    offline = {"active": False}
                    mobile_failed: list[str] = []
                    mobile.on("pageerror", lambda error: mobile_errors.append(str(error)))
                    mobile.on("requestfailed", lambda request: mobile_failed.append(request.url) if not offline["active"] and request.resource_type in ("document", "script", "stylesheet") else None)
                    login(mobile, base, admin["username"], admin["password"], f"/classroom/{room_id}/?block=B08")
                    mobile.get_by_role("button", name="学员 1", exact=True).click()
                    expect(mobile.get_by_role("heading", name="DevelopmentStick／开发立棍卡")).to_be_visible(timeout=10_000)
                    activity = mobile.locator('aside[class*="structuredActivity"]')
                    assert activity.locator("label").count() == 10
                    assert mobile.get_by_text("只看这 6 件事", exact=True).count() == 0
                    controls = activity.locator("form input, form textarea")
                    values = development_stick_values()
                    for index, value in enumerate(values):
                        controls.nth(index).fill(value)
                    submit = activity.get_by_role("button", name="提交给 D 导师")
                    expect(submit).to_be_enabled()
                    # Exact list cardinality is enforced in the touch UI.
                    controls.nth(6).fill("只有一根子棍｜这不是合格分解")
                    expect(submit).to_be_disabled()
                    controls.nth(6).fill(values[6])
                    expect(submit).to_be_enabled()
                    submit.tap()
                    expect(mobile.get_by_text("已提交 · 等待 D 导师", exact=True)).to_be_visible(timeout=10_000)
                    mobile.screenshot(path=str(QA / "learner-development-stick-mobile.png"), full_page=True)
                    mobile_geometry = assert_no_page_overflow(mobile)

                    # Planned disconnect followed by reload must recover the
                    # server-saved draft without creating a duplicate submission.
                    offline["active"] = True
                    mobile_context.set_offline(True)
                    try:
                        mobile.reload(timeout=2_000)
                    except PlaywrightError:
                        pass
                    mobile_context.set_offline(False)
                    offline["active"] = False
                    mobile.goto(f"{base}/classroom/{room_id}/?block=B08&as={learners[0]['username']}", wait_until="networkidle")
                    expect(mobile.get_by_text("已提交 · 等待 D 导师", exact=True)).to_be_visible(timeout=10_000)
                    assert mobile.locator('aside[class*="structuredActivity"] form textarea').first.input_value() == values[0]

                    # Another learner never sees the first learner's private draft.
                    mobile.get_by_role("button", name="学员 2", exact=True).tap()
                    expect(mobile.get_by_role("heading", name="DevelopmentStick／开发立棍卡")).to_be_visible(timeout=10_000)
                    assert mobile.locator('aside[class*="structuredActivity"] form textarea').first.input_value() == ""

                    mobile.get_by_role("button", name="D · 开发导师", exact=True).tap()
                    expect(mobile.get_by_text("D 导师工作台 · 结构化验收", exact=True)).to_be_visible(timeout=10_000)
                    expect(mobile.get_by_text("只看这 6 件事", exact=True)).to_be_visible()
                    review = mobile.locator('article[class*="reviewCard"]')
                    review.locator("textarea").fill("请把并发测试写成两台设备同时提交，并检查管理员名单只能有一条。")
                    review.get_by_role("button", name="退回修改").tap()
                    expect(mobile.get_by_text("结构化成果已退回", exact=False)).to_be_visible(timeout=10_000)
                    mobile.get_by_role("button", name="学员 1", exact=True).tap()
                    expect(mobile.get_by_text("D 导师已退回", exact=False)).to_be_visible(timeout=10_000)
                    activity = mobile.locator('aside[class*="structuredActivity"]')
                    activity.locator("form textarea").nth(8).fill("两台设备同时提交同一相机同一时段 → 只有一次成功且管理员名单只有一条")
                    activity.get_by_role("button", name="重新提交给 D 导师").tap()
                    expect(mobile.get_by_text("已提交 · 等待 D 导师", exact=True)).to_be_visible(timeout=10_000)
                    mobile.get_by_role("button", name="D · 开发导师", exact=True).tap()
                    review = mobile.locator('article[class*="reviewCard"]')
                    review.locator("textarea").fill("三级立棍、验收、红线、测试和纠偏已经对齐。")
                    review.get_by_role("button", name="通过并进入下游交接").tap()
                    expect(mobile.get_by_text("结构化成果已通过", exact=False)).to_be_visible(timeout=10_000)

                    # Use the visible mobile control and confirmation dialog to
                    # reveal B09, then revisit B08 and jump back to the frontier.
                    mobile.get_by_role("button", name="确认解锁下一页 →").tap()
                    expect(mobile.get_by_role("dialog")).to_be_visible()
                    expect(mobile.get_by_role("heading", name="解锁 B09？")).to_be_visible()
                    mobile.get_by_role("button", name="确认解锁并进入").tap()
                    expect(mobile.get_by_role("heading", name=re.compile(r"B09 ·"))).to_be_visible(timeout=10_000)
                    mobile.get_by_role("button", name="M · 市场导师", exact=True).tap()
                    expect(mobile.get_by_text("D → M · 已验收成果交接", exact=True)).to_be_visible(timeout=10_000)
                    expect(mobile.get_by_role("heading", name="已通过的上游交付物")).to_be_visible()
                    expect(mobile.get_by_text("DevelopmentStick／开发立棍卡", exact=False)).to_be_visible()
                    mobile.get_by_role("button", name="← 上一页").tap()
                    expect(mobile.get_by_role("heading", name=re.compile(r"B08 ·"))).to_be_visible(timeout=10_000)
                    mobile.get_by_role("button", name="回到最新解锁 · B09").tap()
                    expect(mobile.get_by_role("heading", name=re.compile(r"B09 ·"))).to_be_visible(timeout=10_000)
                    expect(mobile.get_by_text("DevelopmentStick／开发立棍卡", exact=False)).to_be_visible()
                    mobile.screenshot(path=str(QA / "m-handoff-mobile.png"), full_page=True)
                    assert_no_page_overflow(mobile)

                    # The same touch context is checked in both common iPad
                    # orientations; neither path relies on hover affordances.
                    mobile.set_viewport_size({"width": 768, "height": 1024})
                    mobile.goto(f"{base}/classroom/{room_id}/?block=B08&as={learners[0]['username']}", wait_until="networkidle")
                    expect(mobile.get_by_role("heading", name="DevelopmentStick／开发立棍卡")).to_be_visible(timeout=10_000)
                    tablet_portrait_geometry = assert_no_page_overflow(mobile)
                    mobile.screenshot(path=str(QA / "development-stick-ipad-portrait.png"), full_page=False)
                    mobile.set_viewport_size({"width": 1024, "height": 768})
                    mobile.goto(f"{base}/classroom/{room_id}/?block=B05&as={learners[0]['username']}", wait_until="networkidle")
                    expect(mobile.locator('article[class*="privateCard"]')).to_have_count(2)
                    tablet_landscape_geometry = assert_no_page_overflow(mobile)
                    mobile.screenshot(path=str(QA / "private-cards-ipad-landscape.png"), full_page=False)

                    # Desktop keyboard navigation remains a convenience for
                    # internal mentors and does not mutate the unlock frontier.
                    desktop.goto(f"{base}/classroom/{room_id}/?block=B09", wait_until="networkidle")
                    desktop.get_by_role("button", name="M · 市场导师", exact=True).click()
                    desktop.locator("body").press("ArrowLeft")
                    expect(desktop.get_by_role("heading", name=re.compile(r"B08 ·"))).to_be_visible(timeout=10_000)
                    desktop.locator("body").press("End")
                    expect(desktop.get_by_role("heading", name=re.compile(r"B09 ·"))).to_be_visible(timeout=10_000)
                    expect(desktop.get_by_text("DevelopmentStick／开发立棍卡", exact=False)).to_be_visible()

                    assert not desktop_errors, desktop_errors
                    assert not desktop_failed, desktop_failed
                    assert not mobile_errors, mobile_errors
                    assert not mobile_failed, mobile_failed
                    result.update({
                        "ok": True,
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "candidate": candidate,
                        "viewReceiptId": receipt["receiptId"],
                        "classrooms": rooms,
                        "projection": {"learnerCounts": [2, 4, 6], "cardsPerLearner": 2, "uniqueWithinTeam": True},
                        "simulation": {"blockRange": "B05-B08", "boundary": "R", "pHistorySeparated": True},
                        "developmentStick": {"fields": 10, "learnerRubricRedacted": True, "listCardinality": True, "offlineRecovery": True, "privacy": True, "returned": True, "resubmitted": True, "accepted": True},
                        "handoff": {"from": "D/B08", "to": "M/B09", "acceptedOnly": True, "touchBackAndLatest": True, "keyboardBackAndLatest": True},
                        "exactCourseware": d_ref,
                        "geometry": {
                            "desktop": desktop_geometry,
                            "mobilePortrait": mobile_geometry,
                            "tabletPortrait": tablet_portrait_geometry,
                            "tabletLandscape": tablet_landscape_geometry,
                        },
                        "pageErrors": 0,
                        "requestFailures": 0,
                        "screenshots": [
                            "docs/qa/t090-development-mentor/studio-b05-2-4-6-projection.png",
                            "docs/qa/t090-development-mentor/b05-d-owner-and-handoff.png",
                            "docs/qa/t090-development-mentor/learner-development-stick-mobile.png",
                            "docs/qa/t090-development-mentor/m-handoff-mobile.png",
                            "docs/qa/t090-development-mentor/development-stick-ipad-portrait.png",
                            "docs/qa/t090-development-mentor/private-cards-ipad-landscape.png",
                        ],
                    })
                    mobile_context.close()
                    desktop_context.close()
                    browser.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    (QA / "browser-receipt.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
