#!/usr/bin/env python3
"""Claim, render and release one production Alpha seat without logging its capability."""
from __future__ import annotations

import argparse
import http.client
import json
import secrets
import ssl
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit

from playwright.sync_api import sync_playwright


CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def request_json(base: str, method: str, relative: str, payload: dict | None = None) -> tuple[int, dict]:
    target = urlsplit(urljoin(base, relative))
    body = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    headers = {"User-Agent": "MiniSV-Alpha-Seat-Acceptance/1.0", "Accept": "application/json"}
    if body is not None:
        headers.update({"Content-Type": "application/json", "Content-Length": str(len(body))})
    connection = http.client.HTTPSConnection(target.hostname, target.port or 443, timeout=20, context=ssl.create_default_context())
    path = target.path + (f"?{target.query}" if target.query else "")
    connection.request(method, path, body=body, headers=headers)
    response = connection.getresponse()
    raw = response.read()
    status = response.status
    connection.close()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{method} {target.path} returned non-JSON status {status}") from exc
    return status, value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://minisv.vip/alpha/")
    args = parser.parse_args()
    base = args.base.rstrip("/") + "/"
    client_id = f"public_smoke_{secrets.token_hex(12)}"
    seat_id = ""
    lease = ""
    failure = ""
    browser_result: dict[str, object] = {}

    try:
        status, envelope = request_json(base, "GET", f"api/console?clientId={quote(client_id)}")
        if status != 200 or not envelope.get("ok"):
            raise RuntimeError("Alpha console inventory is unavailable")
        for seat in envelope["data"]["seats"]:
            if seat.get("claimed"):
                continue
            status, claimed = request_json(base, "POST", "api/claims", {
                "seatId": seat["id"], "clientId": client_id, "nickname": "Production Seat Smoke",
            })
            if status == 201 and claimed.get("ok"):
                seat_id = seat["id"]
                lease = claimed["data"]["lease"]
                seat_url = urljoin(base, claimed["data"]["url"])
                break
        else:
            raise RuntimeError("No free Alpha seat; existing testers were not disturbed")

        with sync_playwright() as playwright:
            options: dict[str, object] = {"headless": True}
            if CHROME.is_file():
                options["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**options)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            bad_responses: list[str] = []
            console_errors: list[str] = []
            page.on("response", lambda response: bad_responses.append(urlsplit(response.url).path) if response.status >= 400 else None)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.goto(seat_url, wait_until="networkidle", timeout=20_000)
            page.wait_for_selector(".msv-seat-surface[data-preview='false']", timeout=15_000)
            visible = page.locator("#seatApp").inner_text()
            title = page.title()
            browser_result = {
                "title": title,
                "rendered": "正在连接课堂" not in visible,
                "explicitError": "席位资源加载失败" in visible or "席位暂不可用" in visible,
                "badResponses": sorted(set(bad_responses)),
                "consoleErrorCount": len(console_errors),
            }
            browser.close()
            if not browser_result["rendered"] or browser_result["explicitError"]:
                raise RuntimeError("seat remained in loading/error state")
            if browser_result["badResponses"] or browser_result["consoleErrorCount"]:
                raise RuntimeError("seat emitted failed resources or browser console errors")
    except Exception as exc:  # keep capability fragments out of CI output
        failure = f"{type(exc).__name__}: {str(exc).split('#', 1)[0]}"
    finally:
        if seat_id and lease:
            try:
                request_json(base, "DELETE", f"api/claims/{quote(seat_id)}", {"clientId": client_id, "lease": lease})
            except Exception:
                if not failure:
                    failure = "RuntimeError: temporary Alpha seat could not be released"

    if failure:
        raise SystemExit(f"ALPHA_PUBLIC_SEAT_FAIL {failure}")
    print(
        "ALPHA_PUBLIC_SEAT_OK "
        f"seat={seat_id} rendered={str(browser_result['rendered']).lower()} "
        f"resourceErrors={len(browser_result['badResponses'])} consoleErrors={browser_result['consoleErrorCount']}"
    )


if __name__ == "__main__":
    main()
