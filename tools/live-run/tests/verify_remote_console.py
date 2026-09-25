#!/usr/bin/env python3
"""Run a destructive-but-self-resetting LAN acceptance against the T-070 console.

The script clears only ephemeral seat claims. With --controller-base it also
resets the isolated LIVE RUN, executes B01 to materialize four private learner
views, verifies them through the LAN projection, and resets the run afterwards.
It never prints or writes leases or the controller token.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SEATS = ["mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04"]
WINDOWS = [f"W{index:02d}" for index in range(8)]
CLIENTS = [f"acceptance_client_{index:02d}_20260903" for index in range(1, 5)]
ASSIGNMENTS = list(zip(CLIENTS, zip(SEATS[:4], SEATS[4:])))


def request(base: str, path: str, *, method: str = "GET", body: dict[str, Any] | None = None,
            headers: dict[str, str] | None = None) -> tuple[int, dict[str, Any]]:
    payload = None if body is None else json.dumps(body).encode()
    merged = {
        "Content-Type": "application/json",
        "User-Agent": "MSV-Alpha-Acceptance/1.0",
        **(headers or {}),
    }
    req = urllib.request.Request(urllib.parse.urljoin(base.rstrip("/") + "/", path.lstrip("/")), data=payload, method=method, headers=merged)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(0.35 * (2 ** attempt))
    raise AssertionError("unreachable")


def claim_pair(base: str, client: str, pair: tuple[str, str]) -> list[dict[str, str]]:
    claims = []
    for seat in pair:
        status, envelope = request(base, "/api/claims", method="POST", body={
            "seatId": seat, "clientId": client, "nickname": f"验收者{client[-11:-9]}",
        })
        assert status == 201 and envelope["ok"], (seat, status, envelope)
        claims.append({"seatId": seat, "lease": envelope["data"]["lease"]})
    return claims


def control(base: str, token: str, action: str) -> dict[str, Any]:
    status, envelope = request(base, "/api/control", method="POST", body={"action": action}, headers={
        "Origin": base.rstrip("/"), "X-Live-Run-Token": token,
    })
    assert status in (200, 202), (action, status, envelope)
    return envelope["data"]


def prepare_controller(base: str) -> tuple[str, str]:
    status, bootstrap = request(base, "/api/bootstrap")
    assert status == 200 and bootstrap["ok"]
    token = bootstrap["data"]["token"]
    control(base, token, "reset")
    state = control(base, token, "execute")
    assert state["currentBlockIndex"] == 0
    for _ in range(80):
        _, envelope = request(base, "/api/state")
        state = envelope["data"]
        if state["status"] != "executing":
            break
        time.sleep(0.1)
    assert state["status"] == "awaiting-acceptance", state["status"]
    return token, state["runId"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://192.168.50.243:18766")
    parser.add_argument("--controller-base", help="Optional loopback controller URL used to materialize B01 private cards")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    controller_token = None
    prepared_run = None
    claims: dict[str, list[dict[str, str]]] = {}
    try:
        status, health = request(args.base_url, "/healthz")
        assert status == 200 and health["data"]["service"] == "msv-remote-console"
        status, _ = request(args.base_url, "/api/claims/reset", method="POST", body={"confirm": "RESET ALL TEST SEATS"})
        assert status == 200
        if args.controller_base:
            controller_token, prepared_run = prepare_controller(args.controller_base)

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(claim_pair, args.base_url, client, pair): client for client, pair in ASSIGNMENTS}
            for future, client in [(future, client) for future, client in futures.items()]:
                claims[client] = future.result()

        status, overview = request(args.base_url, f"/api/console?clientId={CLIENTS[0]}")
        assert status == 200 and overview["data"]["connected"] is True
        assert len(overview["data"]["seats"]) == 8
        assert [seat["window"] for seat in overview["data"]["seats"]] == WINDOWS
        assert sum(bool(seat["claimed"]) for seat in overview["data"]["seats"]) == 8
        assert overview["data"]["clientClaimCount"] == 2
        assert sum(bool(seat["isMine"]) for seat in overview["data"]["seats"]) == 2
        for seat in overview["data"]["seats"]:
            if seat["isMine"]:
                assert seat["lease"] and seat["url"]
            else:
                assert seat["lease"] is None and seat["url"] is None

        all_private_card_ids: set[str] = set()
        learner_card_counts: dict[str, int] = {}
        projections: list[dict[str, Any]] = []
        for client, pair_claims in claims.items():
            for claim in pair_claims:
                status, envelope = request(
                    args.base_url,
                    f"/api/state?{urllib.parse.urlencode({'seat': claim['seatId']})}",
                    headers={"X-MSV-Client-ID": client, "X-MSV-Seat-Lease": claim["lease"]},
                )
                assert status == 200 and envelope["ok"]
                state = envelope["data"]
                assert [seat["id"] for seat in state["seats"]] == [claim["seatId"]]
                views = state["classroom"]["learnerViews"]
                expected_keys = [claim["seatId"]] if claim["seatId"].startswith("learner") else []
                if expected_keys and not views and not args.controller_base:
                    expected_keys = []
                assert list(views) == expected_keys, (claim["seatId"], list(views))
                count = 0
                if views:
                    cards = views[claim["seatId"]]["cards"]
                    count = len(cards)
                    assert count == 3, (claim["seatId"], count)
                    ids = {card["id"] for card in cards}
                    assert all_private_card_ids.isdisjoint(ids)
                    all_private_card_ids.update(ids)
                    learner_card_counts[claim["seatId"]] = count
                projections.append({"seatId": claim["seatId"], "returnedSeatCount": 1, "learnerViewKeys": list(views), "privateCardCount": count})

        if args.controller_base:
            assert len(all_private_card_ids) == 12
            assert learner_card_counts == {f"learner{index:02d}": 3 for index in range(1, 5)}

        fifth = "acceptance_conflict_20260903"
        status, conflict = request(args.base_url, "/api/claims", method="POST", body={
            "seatId": "mentor01", "clientId": fifth, "nickname": "冲突验收",
        })
        assert status == 409 and conflict["error"]["code"] == "SEAT_BUSY"
        status, no_lease = request(
            args.base_url,
            "/api/state?seat=learner01",
            headers={"X-MSV-Client-ID": CLIENTS[0]},
        )
        assert status == 403 and no_lease["error"]["code"] == "LEASE_REQUIRED"

        blocked = {}
        for method, path in (("GET", "/api/bootstrap"), ("GET", "/api/script"), ("POST", "/api/control")):
            status, _ = request(args.base_url, path, method=method, body={} if method == "POST" else None)
            assert status == 404
            blocked[f"{method} {path}"] = status

        receipt = {
            "schemaVersion": 1,
            "verifiedAt": datetime.now(timezone.utc).isoformat(),
            "target": args.base_url,
            "controllerConnected": True,
            "course": overview["data"]["course"],
            "run": {**overview["data"]["run"], "runId": prepared_run},
            "seatCount": 8,
            "windowIds": WINDOWS,
            "simulatedBrowsers": 4,
            "maxSeatsPerBrowser": 2,
            "allSeatsClaimedConcurrently": True,
            "conflictCode": "SEAT_BUSY",
            "serverSideSeatProjections": projections,
            "uniquePrivateCards": len(all_private_card_ids),
            "privilegedRoutesBlocked": blocked,
            "containsCredentialsOrCapabilities": False,
        }
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(receipt, ensure_ascii=False))
    finally:
        try:
            request(args.base_url, "/api/claims/reset", method="POST", body={"confirm": "RESET ALL TEST SEATS"})
        except Exception:
            pass
        if args.controller_base and controller_token:
            try:
                control(args.controller_base, controller_token, "reset")
            except Exception:
                pass


if __name__ == "__main__":
    main()
