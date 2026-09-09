#!/usr/bin/env python3
"""Visual acceptance for the T-091 P-owned Ele.me script and ProductBrief handoff."""
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

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
QA = REPO / "docs" / "qa" / "t091-product-mentor"
CANDIDATE = REPO / "tools" / "live-run" / "courses" / "candidates" / "eleme-2008-product-mentor-t091.json"


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


def login(page, base: str, username: str, password: str) -> None:
    page.goto(f"{base}/auth/login/?returnTo=%2Fstudio%2Fpreview%2F", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url("**/studio/preview/")


def assert_no_overflow(page) -> dict[str, int]:
    geometry = page.evaluate(
        """() => ({
          width:innerWidth,
          body:document.body.scrollWidth,
          root:document.documentElement.scrollWidth,
          offenders:[...document.querySelectorAll('body *')].map((node) => {
            const rect=node.getBoundingClientRect();
            return {tag:node.tagName, cls:String(node.className || ''), text:(node.textContent || '').trim().slice(0,60), left:rect.left, right:rect.right, scroll:node.scrollWidth, client:node.clientWidth};
          }).filter((item) => item.right > innerWidth + 1 || item.left < -1 || item.scroll > item.client + 1).slice(0,20),
        })"""
    )
    assert geometry["body"] <= geometry["width"] + 1, geometry
    assert geometry["root"] <= geometry["width"] + 1, geometry
    return geometry


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    QA.mkdir(parents=True, exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    stamp = secrets.token_hex(4)
    admin = {"username": f"t091-admin-{stamp}", "name": "T091 Admin DM", "password": f"T091 browser {secrets.token_urlsafe(18)}!"}
    mentor_names = {"P": "产品导师", "D": "开发导师", "M": "市场导师", "O": "运营导师"}
    mentors = [
        {"username": f"t091-mentor-{role.lower()}-{stamp}", "name": mentor_names[role], "password": f"T091 mentor {role} {secrets.token_urlsafe(16)}!"}
        for role in ("P", "D", "M", "O")
    ]
    learners = [
        {"username": f"t091-builder-{index}-{stamp}", "name": f"Young Builder {index}", "password": f"T091 learner {index} {secrets.token_urlsafe(16)}!"}
        for index in (1, 2)
    ]
    fixture = {
        "dm": admin,
        "mentors": mentors,
        "learners": learners,
        "outsider": {"username": f"t091-outside-{stamp}", "name": "T091 Outside", "password": f"T091 outside {secrets.token_urlsafe(16)}!"},
    }
    result: dict[str, object] = {"ok": False, "base": base}

    with tempfile.TemporaryDirectory(prefix="msv-t091-browser-") as temp:
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
                    context = browser.new_context(viewport={"width": 1600, "height": 1000})
                    page = context.new_page()
                    errors: list[str] = []
                    failed: list[str] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("requestfailed", lambda request: failed.append(request.url) if request.resource_type in ("document", "script", "stylesheet") else None)
                    login(page, base, admin["username"], admin["password"])

                    bootstrap = api(page, "/api/studio/bootstrap")
                    course = json.loads(CANDIDATE.read_text(encoding="utf-8"))
                    candidate = api(page, "/api/studio/candidates", "POST", {"course": course})
                    receipt = api(page, "/api/studio/view-acceptance", "POST", {
                        "courseRef": candidate,
                        "reviewedBlockIds": [block["id"] for block in course["blocks"]],
                        "reviewedLearnerCounts": [2, 3, 4],
                    })
                    preferred_courseware = {
                        "P": "product-mentor-foundations",
                        "D": "development-mentor-ligun",
                        "M": "market-mentor-field-kit",
                        "O": "operations-mentor-field-kit",
                    }
                    courseware = [{
                        "mentorRole": item["mentorRole"], "packageId": item["packageId"], "slug": item["slug"],
                        "revision": item["latestRevision"], "digest": item["latestDigest"],
                    } for item in bootstrap["courseware"] if preferred_courseware.get(item["mentorRole"]) == item["slug"]]
                    assert {item["mentorRole"] for item in courseware} == {"P", "D", "M", "O"}, courseware
                    classroom = api(page, "/api/platform/classrooms", "POST", {
                        "environment": "test",
                        "title": "T091 产品导师视觉验收",
                        "learnerCount": 2,
                        "courseRef": candidate,
                        "viewAcceptanceReceiptId": receipt["receiptId"],
                        "coursewareRefs": courseware,
                        "adminDmProfileIds": [bootstrap["user"]["userId"]],
                        "mentorSeats": [{"mentorRole": role, "profileId": mentors[index]["username"]} for index, role in enumerate(("P", "D", "M", "O"))],
                        "learnerProfileIds": [item["username"] for item in learners],
                    })
                    room_id = classroom["classroomId"]

                    # Studio Preview exposes full internal routing and the two
                    # unresolved items, without putting them in a learner view.
                    page.goto(f"{base}/studio/preview/?course={candidate['courseId']}&revision={candidate['revision']}&digest={candidate['digest']}", wait_until="networkidle")
                    expect(page.locator('button[data-active="true"] b')).to_contain_text("B01")
                    expect(page.get_by_text("待人工审核 · 2 项（不向学员显示）", exact=True)).to_be_visible()
                    p_card = page.locator('article[data-kind="mentor"]').first
                    p_card.get_by_role("button", name="固定展开").click()
                    expect(p_card.get_by_text("案例内容所有者", exact=True)).to_be_visible()
                    expect(p_card.get_by_text("课件第 7—15 页", exact=False)).to_be_visible()
                    for index in (1, 2, 3):
                        card = page.locator('article[data-kind="mentor"]').nth(index)
                        card.get_by_role("button", name="固定展开").click()
                        expect(card.get_by_text("没有复制当值导师讲稿", exact=True)).to_be_visible()
                    assert_no_overflow(page)
                    page.screenshot(path=str(QA / "studio-p-owned-routing.png"), full_page=True)

                    # Unlock to B04 using the same API as the real control UI.
                    detail = api(page, f"/api/platform/classrooms/{room_id}")
                    progress = detail["script"]
                    for block_id in ("B02", "B03", "B04"):
                        progress = api(page, f"/api/platform/classrooms/{room_id}/control", "POST", {
                            "expectedVersion": progress["version"],
                            "action": {"type": "unlock-next", "nextBlockId": block_id},
                        })

                    page.goto(f"{base}/classroom/{room_id}/?block=B04", wait_until="networkidle")
                    page.get_by_role("button", name="学员 1", exact=True).click()
                    expect(page.get_by_text("团队交付物 · P 导师验收", exact=True)).to_be_visible(timeout=10_000)
                    expect(page.get_by_role("heading", name="ProductBrief／产品定义卡")).to_be_visible()
                    activity = page.locator('aside[class*="structuredActivity"]')
                    assert activity.locator("label").count() == 10
                    assert page.get_by_text("只看这 5 件事", exact=True).count() == 0
                    values = [
                        "东川路宿舍里晚上九点后想订餐的学生",
                        "晚上留在宿舍时找到仍营业且能配送的餐厅并完成下单。",
                        "旧菜单可能过期，逐家电话询问很慢，也不知道能否配送。",
                        "F-01：2008 年开始尝试餐饮外送。\nC-05：成员亲自送餐。",
                        "学生愿意把逐家电话询问换成统一入口。",
                        "还不知道每天晚间订单数；下一步记录一周电话和送餐次数。",
                        "学生会少打电话，并更快知道订单是否被接收。",
                        "看到餐厅与菜品 → 提交订单 → 收到接单或无法配送回执。",
                        "人工维护菜单和确认是否足以让真人完成一次订餐。",
                        "不公开私人电话；只覆盖宿舍周边；不承诺所有时段。",
                    ]
                    controls = activity.locator("form input, form textarea")
                    assert controls.count() == 10
                    for index, value in enumerate(values):
                        controls.nth(index).fill(value)
                    activity.get_by_role("button", name="提交给 P 导师").click()
                    expect(page.get_by_text("已提交给 P 导师", exact=False)).to_be_visible(timeout=10_000)
                    assert page.get_by_text("mentorPrompt", exact=False).count() == 0
                    page.screenshot(path=str(QA / "learner-product-brief-desktop.png"), full_page=True)
                    page.reload(wait_until="networkidle")
                    expect(page.get_by_text("已提交 · 等待 P 导师", exact=True)).to_be_visible(timeout=10_000)
                    assert page.locator('aside[class*="structuredActivity"] form input').first.input_value() == values[0]

                    page.get_by_role("button", name="P · 产品导师", exact=True).click()
                    expect(page.get_by_text("P 导师工作台 · 结构化验收", exact=True)).to_be_visible(timeout=10_000)
                    rubric = page.get_by_text("只看这 5 件事", exact=True).locator("xpath=..").locator("li")
                    assert rubric.count() == 5
                    review = page.locator('article[class*="reviewCard"]')
                    review.locator("textarea").fill("请把目标用户缩小到晚上九点后仍在宿舍的人。")
                    review.get_by_role("button", name="退回修改").click()
                    expect(page.get_by_text("结构化成果已退回", exact=False)).to_be_visible(timeout=10_000)
                    page.get_by_role("button", name="学员 1", exact=True).click()
                    expect(page.get_by_text("P 导师已退回", exact=False)).to_be_visible(timeout=10_000)
                    activity = page.locator('aside[class*="structuredActivity"]')
                    activity.locator("form input").first.fill("东川路宿舍里晚上九点后仍在宿舍并想订餐的学生")
                    activity.get_by_role("button", name="重新提交给 P 导师").click()
                    expect(page.get_by_text("已提交给 P 导师", exact=False)).to_be_visible(timeout=10_000)
                    page.get_by_role("button", name="P · 产品导师", exact=True).click()
                    expect(page.get_by_text("P 导师工作台 · 结构化验收", exact=True)).to_be_visible(timeout=10_000)
                    with page.expect_response(lambda response: "/submissions/" in response.url and "/review" in response.url) as review_response:
                        page.locator('article[class*="reviewCard"]').get_by_role("button", name="通过并进入下游交接").click()
                    assert review_response.value.status == 200, review_response.value.text()
                    p_profile_id = page.evaluate("new URL(location.href).searchParams.get('as')")
                    accepted_detail = api(page, f"/api/platform/classrooms/{room_id}?block=B04&viewAs={p_profile_id}")
                    assert accepted_detail["submissions"][0]["status"] == "accepted", accepted_detail["submissions"]

                    latest = api(page, f"/api/platform/classrooms/{room_id}")
                    api(page, f"/api/platform/classrooms/{room_id}/control", "POST", {
                        "expectedVersion": latest["script"]["version"],
                        "action": {"type": "unlock-next", "nextBlockId": "B05"},
                    })
                    page.goto(f"{base}/classroom/{room_id}/?block=B05", wait_until="networkidle")
                    page.get_by_role("button", name="D · 开发导师", exact=True).click()
                    expect(page.get_by_text("P → D · 已验收成果交接", exact=True)).to_be_visible(timeout=10_000)
                    expect(page.get_by_role("heading", name="已通过的上游交付物")).to_be_visible()
                    expect(page.get_by_text("ProductBrief／产品定义卡", exact=False)).to_be_visible()
                    expect(page.get_by_text("当值导师私有提示", exact=True)).to_be_visible()
                    assert page.get_by_text("P 专属历史剧本", exact=False).count() == 0
                    desktop_geometry = assert_no_overflow(page)
                    page.screenshot(path=str(QA / "d-handoff-desktop.png"), full_page=True)

                    # The electronic script behaves like a revealed booklet:
                    # any role can revisit an unlocked page and return without
                    # mutating the accepted artifact or unlock frontier.
                    page.locator("body").press("ArrowLeft")
                    expect(page.get_by_role("heading", name=re.compile(r"B04 ·"))).to_be_visible(timeout=10_000)
                    page.locator("body").press("ArrowRight")
                    expect(page.get_by_role("heading", name=re.compile(r"B05 ·"))).to_be_visible(timeout=10_000)
                    expect(page.get_by_role("heading", name="已通过的上游交付物")).to_be_visible()

                    page.set_viewport_size({"width": 390, "height": 844})
                    page.wait_for_timeout(150)
                    mobile_geometry = assert_no_overflow(page)
                    page.screenshot(path=str(QA / "d-handoff-mobile.png"), full_page=True)
                    assert not errors, errors
                    assert not failed, failed
                    result.update({
                        "ok": True,
                        "browser": {"engine": "Chromium", "version": browser.version},
                        "candidate": candidate,
                        "viewReceiptId": receipt["receiptId"],
                        "classroomId": room_id,
                        "studio": {"pOwner": True, "dmoNoCopiedScript": True, "openReviewItems": 2},
                        "productBrief": {"fields": 10, "learnerRubricRedacted": True, "refreshPersisted": True, "returned": True, "resubmitted": True, "accepted": True},
                        "handoff": {"from": "P/B04", "to": "D/B05", "acceptedOnly": True, "backAndReturnPreserved": True},
                        "geometry": {"desktop": desktop_geometry, "mobile": mobile_geometry},
                        "pageErrors": 0,
                        "requestFailures": 0,
                        "screenshots": [
                            "docs/qa/t091-product-mentor/studio-p-owned-routing.png",
                            "docs/qa/t091-product-mentor/learner-product-brief-desktop.png",
                            "docs/qa/t091-product-mentor/d-handoff-desktop.png",
                            "docs/qa/t091-product-mentor/d-handoff-mobile.png",
                        ],
                    })
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
