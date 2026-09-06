#!/usr/bin/env python3
"""Launch a dedicated Chrome-for-Testing profile with an exact 2 x 4 grid."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import websocket


HERE = Path(__file__).resolve().parent
DEFAULT_PROFILE = Path("/tmp/msv-live-run-chrome")
DEFAULT_RUNTIME = Path("/tmp/msv-live-run-runtime")
CHROME_CANDIDATES = [
    Path("/Users/hecate/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    Path("/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chrome", type=Path)
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    parser.add_argument("--runtime-dir", type=Path, default=DEFAULT_RUNTIME)
    parser.add_argument("--controller-port", type=int, default=18765)
    parser.add_argument("--debug-port", type=int, default=19222)
    parser.add_argument("--keep-profile", action="store_true")
    return parser.parse_args()


def find_chrome(explicit: Path | None) -> Path:
    for path in ([explicit] if explicit else CHROME_CANDIDATES):
        if path and path.is_file() and os.access(path, os.X_OK):
            return path.resolve()
    raise SystemExit("Chrome for Testing was not found; pass --chrome with its executable path")


def controller_ready(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/state", timeout=2) as response:
            return response.status == 200 and json.load(response).get("ok") is True
    except Exception:
        return False


def wait_debug_port(port: int, timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.25):
                return
        except OSError:
            time.sleep(0.15)
    raise SystemExit("Chrome started but its debugging port did not become ready")


def _round_positive_fraction(numerator: int, denominator: int) -> int:
    """Match JavaScript Math.round for a non-negative rational number."""
    return (2 * numerator + denominator) // (2 * denominator)


def tile_work_area(work_area: dict[str, int], columns: int = 4, rows: int = 2) -> list[dict[str, int]]:
    """Split a browser work area exactly, preserving its non-zero origin."""
    left = int(work_area["left"])
    top = int(work_area["top"])
    width = int(work_area["width"])
    height = int(work_area["height"])
    if width <= 0 or height <= 0 or columns <= 0 or rows <= 0:
        raise ValueError("work area and grid dimensions must be positive")
    x_cuts = [left + _round_positive_fraction(width * index, columns) for index in range(columns + 1)]
    y_cuts = [top + _round_positive_fraction(height * index, rows) for index in range(rows + 1)]
    return [
        {
            "left": x_cuts[column],
            "top": y_cuts[row],
            "width": x_cuts[column + 1] - x_cuts[column],
            "height": y_cuts[row + 1] - y_cuts[row],
        }
        for row in range(rows)
        for column in range(columns)
    ]


def controller_bounds(work_area: dict[str, int]) -> dict[str, int | str]:
    """Place the ninth controller inside the same safe macOS work area."""
    horizontal_inset = _round_positive_fraction(int(work_area["width"]), 8)
    vertical_inset = min(30, max(0, (int(work_area["height"]) - 1) // 2))
    return {
        "left": int(work_area["left"]) + horizontal_inset,
        "top": int(work_area["top"]) + vertical_inset,
        "width": int(work_area["width"]) - 2 * horizontal_inset,
        "height": int(work_area["height"]) - 2 * vertical_inset,
        "windowState": "normal",
    }


def page_work_area(target: dict) -> dict[str, int]:
    """Read Chrome's primary visible work area in its own window coordinate system."""
    connection = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=5)
    try:
        connection.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "({left:screen.availLeft,top:screen.availTop,width:screen.availWidth,height:screen.availHeight})",
                "returnByValue": True,
            },
        }))
        while True:
            message = json.loads(connection.recv())
            if message.get("id") != 1:
                continue
            if "error" in message:
                raise RuntimeError(message["error"])
            value = message["result"]["result"].get("value")
            if not isinstance(value, dict):
                raise RuntimeError("Chrome did not return a screen work area")
            result = {key: int(value[key]) for key in ("left", "top", "width", "height")}
            if result["width"] <= 0 or result["height"] <= 0:
                raise RuntimeError(f"Chrome returned an invalid screen work area: {result}")
            return result
    finally:
        connection.close()


def stable_page_work_area(target: dict, timeout: float = 3.0) -> dict[str, int]:
    """Wait out Dock/app-launch animation before freezing the tiling boundary.

    Starting Chrome can add or animate its Dock icon, which briefly changes the
    reported work-area edge by one logical pixel on scaled displays.  Require a
    stable sample and at least one second of settling so the final grid does not
    preserve that transient gap.
    """
    started = time.monotonic()
    deadline = started + timeout
    previous: dict[str, int] | None = None
    matching_samples = 0
    latest: dict[str, int] | None = None
    while time.monotonic() < deadline:
        latest = page_work_area(target)
        if latest == previous:
            matching_samples += 1
        else:
            previous = latest
            matching_samples = 1
        if matching_samples >= 3 and time.monotonic() - started >= 1.0:
            return latest
        time.sleep(0.2)
    if latest is None:
        raise RuntimeError("Chrome work area could not be sampled")
    return latest


def exact_grid_via_cdp(port: int, controller_port: int, timeout: float = 20.0) -> dict[str, int]:
    """Reapply an exact 2 x 4 grid inside Chrome's visible work area.

    The extension creates stable popup window IDs. CDP then applies the same
    work-area-derived cuts after all windows exist, avoiding macOS creation
    drift without covering the Dock, menu bar, or Stage Manager strip.
    """
    deadline = time.monotonic() + timeout
    pages: list[dict] = []
    while time.monotonic() < deadline:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2) as response:
            targets = json.load(response)
        pages = [target for target in targets if target.get("type") == "page" and "/seat.html?seat=" in target.get("url", "")]
        if len(pages) == 8:
            break
        time.sleep(0.2)
    if len(pages) != 8:
        raise SystemExit(f"Expected 8 seat pages before tiling, found {len(pages)}")

    work_area = stable_page_work_area(pages[0])
    tiles = tile_work_area(work_area, 4, 2)

    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=2) as response:
        browser_url = json.load(response)["webSocketDebuggerUrl"]
    connection = websocket.create_connection(browser_url, timeout=5)
    request_id = 0

    def call(method: str, params: dict) -> dict:
        nonlocal request_id
        request_id += 1
        connection.send(json.dumps({"id": request_id, "method": method, "params": params}))
        while True:
            message = json.loads(connection.recv())
            if message.get("id") == request_id:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    try:
        targets = call("Target.getTargets", {})["targetInfos"]
        controller_targets = [
            target for target in targets
            if target.get("type") == "page" and target.get("url") == f"http://127.0.0.1:{controller_port}/"
        ]
        if controller_targets:
            controller_target_id = controller_targets[0]["targetId"]
        else:
            controller_target_id = call("Target.createTarget", {
                "url": f"http://127.0.0.1:{controller_port}/",
                "newWindow": True,
                "background": True,
            })["targetId"]
        controller_window = call("Browser.getWindowForTarget", {"targetId": controller_target_id})

        records = []
        seat_order = {
            "mentor01": 0, "mentor02": 1, "mentor03": 2, "mentor04": 3,
            "learner01": 4, "learner02": 5, "learner03": 6, "learner04": 7,
        }
        for target in pages:
            seat = parse_qs(urlparse(target["url"]).query).get("seat", [""])[0]
            if seat not in seat_order:
                raise SystemExit(f"Seat page has an unknown seat query: {target['url']}")
            window = call("Browser.getWindowForTarget", {"targetId": target["id"]})
            records.append((seat_order[seat], target, window))
        call("Browser.setWindowBounds", {
            "windowId": controller_window["windowId"],
            "bounds": controller_bounds(work_area),
        })
        # A second pass after the compositor settles prevents window creation
        # order from shifting the first popup on macOS.
        for pause in (0.25, 0.35):
            for index, _, window in records:
                call("Browser.setWindowBounds", {
                    "windowId": window["windowId"],
                    "bounds": {**tiles[index], "windowState": "normal"},
                })
            time.sleep(pause)
        for index, target, _ in records:
            actual = call("Browser.getWindowForTarget", {"targetId": target["id"]})["bounds"]
            tile = tiles[index]
            expected = (tile["left"], tile["top"], tile["width"], tile["height"])
            received = (actual["left"], actual["top"], actual["width"], actual["height"])
            if received != expected:
                raise SystemExit(
                    f"Grid verification failed for W{index:02d}: expected {expected}, got {received}. "
                    "The visible work area may be smaller than Chrome's minimum popup size."
                )
        # The 2×4 wall remains tiled behind it, while the ninth notebook-style
        # controller is the surface the DM must operate. Creating it in the
        # background used to make users believe the controller did not exist.
        call("Target.activateTarget", {"targetId": controller_target_id})
    finally:
        connection.close()
    return work_area


def main() -> None:
    args = parse_args()
    if not controller_ready(args.controller_port):
        raise SystemExit(f"Start launcher.py first; controller 127.0.0.1:{args.controller_port} is not ready")
    chrome = find_chrome(args.chrome)
    profile = args.profile.expanduser().resolve()
    if not args.keep_profile and profile.exists():
        if not profile.name.startswith("msv-live-run-chrome"):
            raise SystemExit("Refusing to clean an unsafe Chrome profile path")
        shutil.rmtree(profile)
    profile.mkdir(parents=True, exist_ok=True)
    extension_target = profile / "grid-extension"
    if extension_target.exists():
        shutil.rmtree(extension_target)
    shutil.copytree(HERE / "chrome-extension", extension_target)
    service_worker = extension_target / "service-worker.js"
    service_worker.write_text(
        service_worker.read_text(encoding="utf-8").replace(
            "http://127.0.0.1:18765/seat.html",
            f"http://127.0.0.1:{args.controller_port}/seat.html",
        ),
        encoding="utf-8",
    )

    process = subprocess.Popen([
        str(chrome),
        f"--user-data-dir={profile}",
        f"--load-extension={extension_target}",
        f"--disable-extensions-except={extension_target}",
        f"--remote-debugging-port={args.debug_port}",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--disable-background-mode",
        "--disable-notifications",
        "--disable-popup-blocking",
        "--no-startup-window",
        "--test-type",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    runtime = args.runtime_dir.expanduser().resolve()
    runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
    (runtime / "chrome.pid").write_text(f"{process.pid}\n", encoding="utf-8")
    wait_debug_port(args.debug_port)
    work_area = exact_grid_via_cdp(args.debug_port, args.controller_port)
    area = f"{work_area['left']},{work_area['top']},{work_area['width']}x{work_area['height']}"
    print(
        f"GRID_LAUNCHED pid={process.pid} profile={profile} seats=8 controller=1 "
        f"layout=2x4 exact=true safe_work_area={area}",
        flush=True,
    )


if __name__ == "__main__":
    main()
