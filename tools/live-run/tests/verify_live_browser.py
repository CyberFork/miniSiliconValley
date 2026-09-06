#!/usr/bin/env python3
"""Verify the running nine-window Chrome-for-Testing classroom wall."""

from __future__ import annotations

import argparse
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

import websocket

from launch_grid import controller_bounds, tile_work_area


SEAT_ORDER = {
    "mentor01": 0, "mentor02": 1, "mentor03": 2, "mentor04": 3,
    "learner01": 4, "learner02": 5, "learner03": 6, "learner04": 7,
}


def ws_call(connection: websocket.WebSocket, request_id: int, method: str, params: dict | None = None) -> dict:
    connection.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
    while True:
        message = json.loads(connection.recv())
        if message.get("id") == request_id:
            if "error" in message:
                raise AssertionError(f"CDP {method} failed: {message['error']}")
            return message.get("result", {})


def target_value(target: dict, expression: str) -> object:
    connection = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=5)
    try:
        result = ws_call(connection, 1, "Runtime.evaluate", {"expression": expression, "returnByValue": True})
        return result["result"].get("value")
    finally:
        connection.close()


def reload_target(target: dict) -> None:
    """Force hidden popup windows to observe the latest no-store assets/state.

    Chrome may heavily throttle timers in seven background phone windows.  A
    reload is side-effect free for these read-only views and avoids accepting a
    stale DOM merely because its heartbeat has not fired yet.
    """
    connection = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=5)
    try:
        ws_call(connection, 1, "Page.reload", {"ignoreCache": True})
    finally:
        connection.close()


def overlap(a: dict, b: dict) -> int:
    width = max(0, min(a["left"] + a["width"], b["left"] + b["width"]) - max(a["left"], b["left"]))
    height = max(0, min(a["top"] + a["height"], b["top"] + b["height"]) - max(a["top"], b["top"]))
    return width * height


def verify(debug_port: int, output: Path) -> dict:
    with urlopen(f"http://127.0.0.1:{debug_port}/json/list", timeout=5) as response:
        pages = [item for item in json.load(response) if item.get("type") == "page"]
    seats = [item for item in pages if "/seat.html?" in item.get("url", "")]
    controllers = [item for item in pages if urlparse(item.get("url", "")).path == "/"]
    assert len(pages) == 9, f"expected 9 page targets, found {len(pages)}"
    assert len(seats) == 8, f"expected 8 seat pages, found {len(seats)}"
    assert len(controllers) == 1, f"expected one controller page, found {len(controllers)}"
    work_area = target_value(
        seats[0],
        "({left:screen.availLeft,top:screen.availTop,width:screen.availWidth,height:screen.availHeight})",
    )
    assert isinstance(work_area, dict)
    work_area = {key: int(work_area[key]) for key in ("left", "top", "width", "height")}
    expected_tiles = tile_work_area(work_area)
    for target in [*seats, *controllers]:
        reload_target(target)
    time.sleep(1.2)
    controller_origin = f"{urlparse(controllers[0]['url']).scheme}://{urlparse(controllers[0]['url']).netloc}"
    with urlopen(f"{controller_origin}/api/script", timeout=5) as response:
        script = json.load(response)["data"]
    with urlopen(f"{controller_origin}/api/state", timeout=5) as response:
        run_state = json.load(response)["data"]
    assert run_state["scriptId"] == script["id"]
    block_count = len(script["blocks"])
    course_id = script["course"]["id"]

    with urlopen(f"http://127.0.0.1:{debug_port}/json/version", timeout=5) as response:
        browser_url = json.load(response)["webSocketDebuggerUrl"]
    browser = websocket.create_connection(browser_url, timeout=5)
    try:
        window_rows = []
        seen = set()
        for target in seats:
            seat_id = parse_qs(urlparse(target["url"]).query).get("seat", [""])[0]
            assert seat_id in SEAT_ORDER, f"unknown seat URL: {target['url']}"
            seen.add(seat_id)
            result = ws_call(browser, len(window_rows) + 1, "Browser.getWindowForTarget", {"targetId": target["id"]})
            window_rows.append({"seat": seat_id, "order": SEAT_ORDER[seat_id], "windowId": result["windowId"], **result["bounds"]})
        assert seen == set(SEAT_ORDER)
        controller_window = ws_call(browser, 20, "Browser.getWindowForTarget", {"targetId": controllers[0]["id"]})
        assert controller_window["windowId"] not in {item["windowId"] for item in window_rows}
    finally:
        browser.close()

    window_rows.sort(key=lambda item: item["order"])
    assert len({item["windowId"] for item in window_rows}) == 8
    for first, a in enumerate(window_rows):
        expected = expected_tiles[a["order"]]
        received = {key: a[key] for key in ("left", "top", "width", "height")}
        assert received == expected, f"{a['seat']} does not match the safe work-area tile: {received} != {expected}"
        for b in window_rows[first + 1:]:
            assert overlap(a, b) == 0, f"seat windows overlap: {a['seat']} / {b['seat']}"
    assert window_rows[0]["left"] == work_area["left"]
    assert window_rows[0]["top"] == work_area["top"]
    assert window_rows[3]["left"] + window_rows[3]["width"] == work_area["left"] + work_area["width"]
    assert window_rows[7]["top"] + window_rows[7]["height"] == work_area["top"] + work_area["height"]
    actual_controller = controller_window["bounds"]
    expected_controller = controller_bounds(work_area)
    assert all(actual_controller[key] == expected_controller[key] for key in ("left", "top", "width", "height"))

    learner_results = {}
    identities = []
    for target in seats:
        seat_id = parse_qs(urlparse(target["url"]).query)["seat"][0]
        if not seat_id.startswith("learner"):
            continue
        expression = "({text:document.body.innerText,name:document.querySelector('#name')?.textContent,cards:document.querySelectorAll('.private-card').length,metrics:document.querySelector('#metrics')?.innerText,bars:document.querySelectorAll('#progress i').length,phase:document.querySelector('#phaseNo')?.textContent,room:document.querySelector('#room')?.textContent})"
        deadline = time.monotonic() + 12
        while True:
            view = target_value(target, expression)
            if isinstance(view, dict) and view.get("cards") == 3 and view.get("bars") == block_count:
                break
            if time.monotonic() >= deadline:
                break
            time.sleep(0.2)
        assert isinstance(view, dict)
        identities.append(view["name"])
        assert view["cards"] == 3, f"{seat_id} should see exactly three private cards"
        assert view["bars"] == block_count, f"{seat_id} progress does not match selected course"
        assert str(block_count).zfill(2) in view["phase"], f"{seat_id} block total is stale"
        for phrase in ("RP", "我的钱包", "团队资金", "我要说", "我要问", "做成的样子"):
            assert phrase in view["text"], f"{seat_id} missing {phrase}"
        for forbidden in ("learnerPdmoCount", "intel-network", "dm-gate", "LOCAL REAL API"):
            assert forbidden not in view["text"], f"{seat_id} leaks developer language {forbidden}"
        if course_id == "eleme-2008-find-problem" and not run_state["classroom"]["historyRevealed"]:
            assert "饿了么" not in view["room"], f"{seat_id} reveals the company answer in its room label"
        learner_results[seat_id] = {"identity": view["name"], "privateCardCount": view["cards"], "growthHud": True}
    assert len(set(identities)) == 4, "the four learner windows must have different identities"

    controller_expression = "({text:document.body.innerText,status:document.querySelector('#runStatus')?.textContent,executeDisabled:document.querySelector('#execute')?.disabled,acceptDisabled:document.querySelector('#accept')?.disabled,courses:document.querySelectorAll('[data-course-id]').length,selected:document.querySelector('[data-course-id][aria-pressed=\"true\"] b')?.textContent,blocks:document.querySelectorAll('#blockNav button').length})"
    expected_controls = {
        "ready": ("待执行", False, True),
        "awaiting-acceptance": ("待人工验收", True, False),
        "completed": ("全程完成", True, True),
    }
    expected_status, expected_execute_disabled, expected_accept_disabled = expected_controls[run_state["status"]]
    deadline = time.monotonic() + 12
    while True:
        controller = target_value(controllers[0], controller_expression)
        if isinstance(controller, dict) and controller.get("courses", 0) >= 2 and controller.get("status") == expected_status:
            break
        if time.monotonic() >= deadline:
            break
        time.sleep(0.2)
    assert isinstance(controller, dict)
    for step in (item["name"] for item in script["macroSteps"]):
        assert step in controller["text"]
    assert controller["courses"] >= 2
    assert controller["blocks"] == block_count
    assert script["course"]["name"] in controller["selected"]
    assert expected_status in controller["status"]
    assert controller["executeDisabled"] is expected_execute_disabled
    assert controller["acceptDisabled"] is expected_accept_disabled

    receipt = {
        "schemaVersion": 1,
        "kind": "msv-live-run-browser-wall-acceptance",
        "verifiedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "courseId": course_id,
        "scriptId": script["id"],
        "blockCount": block_count,
        "pageTargets": 9,
        "seatWindows": 8,
        "controllerWindows": 1,
        "layout": {
            "rows": 2,
            "columns": 4,
            "noOverlap": True,
            "safeWorkAreaEdgeToEdge": True,
            "workArea": work_area,
        },
        "learners": learner_results,
        "controllerManualGate": run_state["status"] in expected_controls,
        "controllerStatus": run_state["status"],
        "courseSelector": True,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--debug-port", type=int, default=19222)
    parser.add_argument("--output", type=Path, default=Path("/tmp/msv-live-run-runtime/browser-acceptance-receipt.json"))
    args = parser.parse_args()
    receipt = verify(args.debug_port, args.output)
    print(
        "BROWSER_ACCEPTANCE_OK "
        f"pages={receipt['pageTargets']} seats={receipt['seatWindows']} "
        f"layout=2x4 receipt={args.output.resolve()}"
    )


if __name__ == "__main__":
    main()
