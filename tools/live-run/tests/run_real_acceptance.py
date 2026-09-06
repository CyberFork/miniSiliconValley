#!/usr/bin/env python3
"""Drive all 13 manual gates against the isolated local classroom API.

This is an acceptance harness, not the normal teaching flow.  It talks only
to the loopback LIVE RUN controller, verifies that every execute stops for a
separate human-accept action, and writes a credential-free receipt.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class ControllerClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        parsed = urlparse(self.base_url)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"} or not parsed.port or parsed.path:
            raise SystemExit("Real acceptance is restricted to an explicit loopback HTTP controller port")
        bootstrap = self.get("/api/bootstrap")
        self.token = bootstrap["token"]
        self.course_catalog = bootstrap["courseCatalog"]
        self.script = bootstrap["script"]

    def request(self, path: str, *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Accept": "application/json"}
        if payload is not None:
            headers.update({
                "Content-Type": "application/json",
                "Origin": self.base_url,
                "X-Live-Run-Token": self.token,
            })
        request = Request(self.base_url + path, data=data, headers=headers, method="POST" if data else "GET")
        try:
            with urlopen(request, timeout=30) as response:
                envelope = json.load(response)
        except HTTPError as exc:
            try:
                envelope = json.load(exc)
            except Exception:
                raise AssertionError(f"HTTP {exc.code} without a JSON error envelope") from exc
            raise AssertionError(envelope.get("error", {}).get("message", f"HTTP {exc.code}")) from exc
        if not envelope.get("ok"):
            raise AssertionError(envelope.get("error", {}).get("message", "controller rejected request"))
        return envelope["data"]

    def get(self, path: str) -> dict[str, Any]:
        return self.request(path)

    def action(self, action: str, **details: Any) -> dict[str, Any]:
        return self.request("/api/control", payload={"action": action, **details})

    def select_course(self, course_id: str) -> dict[str, Any]:
        if course_id not in {item["id"] for item in self.course_catalog}:
            raise AssertionError(f"controller does not expose requested course: {course_id}")
        state = self.action("select-course", courseId=course_id, confirmReset=True)
        self.script = self.get("/api/script")
        assert state["scriptId"] == self.script["id"]
        return state

    def wait_until_stopped(self, timeout: float = 90.0) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            state = self.get("/api/state")
            if state["status"] != "executing":
                return state
            time.sleep(0.1)
        raise AssertionError("current block did not stop within the acceptance timeout")


def assert_no_secret_keys(value: Any, path: str = "root") -> None:
    forbidden = {"password", "cookie", "session", "resetToken", "recoveryCode", "token"}
    if isinstance(value, dict):
        for key, child in value.items():
            assert key not in forbidden, f"secret-shaped field leaked at {path}.{key}"
            assert_no_secret_keys(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            assert_no_secret_keys(child, f"{path}[{index}]")


def assert_b01(state: dict[str, Any]) -> dict[str, dict[str, int]]:
    classroom = state["classroom"]
    assert classroom["apiBacked"] is True
    assert classroom["mentorCount"] == 4
    assert classroom["learnerCount"] == 4
    assert classroom["learnerPdmoCount"] == 0
    assert classroom["cardsPerLearner"] == [3, 3, 3, 3]
    assert classroom["uniqueDealtCards"] == 12
    views = classroom["learnerViews"]
    assert set(views) == {f"learner{index:02d}" for index in range(1, 5)}
    identities = [view["identity"]["name"] for view in views.values()]
    assert len(set(identities)) == 4
    cards = [card["id"] for view in views.values() for card in view["cards"]]
    assert len(cards) == len(set(cards)) == 12
    assert all(isinstance(view["reputation"], int) for view in views.values())
    assert all(isinstance(view["walletTenths"], int) for view in views.values())
    assert_no_secret_keys(classroom)
    return {
        seat: {"reputation": view["reputation"], "walletTenths": view["walletTenths"]}
        for seat, view in views.items()
    }


def assert_b12(state: dict[str, Any], baseline: dict[str, dict[str, int]]) -> None:
    classroom = state["classroom"]
    views = classroom["learnerViews"]
    assert len(views) == 4
    assert all(view["reputation"] >= baseline[seat]["reputation"] + 10 for seat, view in views.items())
    assert all(view["walletTenths"] > baseline[seat]["walletTenths"] for seat, view in views.items())
    assert all(view["recentReputation"] and view["recentReputation"]["points"] > 0 for view in views.values())
    assert all(view["recentWallet"] and view["recentWallet"]["direction"] == "in" for view in views.values())
    assert classroom["teamTreasuryTenths"] > 0


def run(client: ControllerClient, output: Path, reset_after: bool, course_id: str = "google-1995-2004") -> dict[str, Any]:
    client.select_course(course_id)
    state = client.action("reset")
    assert state["status"] == "ready" and state["currentBlockIndex"] == 0
    assert state["courseId"] == course_id
    started = now()
    block_receipts = []
    learner_baseline: dict[str, dict[str, int]] | None = None
    for index, block in enumerate(client.script["blocks"]):
        before = client.get("/api/state")
        assert before["status"] == "ready"
        assert before["currentBlockIndex"] == index
        assert before["blocks"][index]["status"] == "ready"
        if index + 1 < len(client.script["blocks"]):
            assert before["blocks"][index + 1]["status"] == "locked"
        began = time.monotonic()
        started_state = client.action("execute")
        assert started_state["currentBlockIndex"] == index
        assert started_state["status"] == "executing"
        executed = client.wait_until_stopped()
        assert executed["status"] == "awaiting-acceptance", executed.get("error")
        assert executed["currentBlockIndex"] == index, "execute must never auto-advance"
        assert executed["blocks"][index]["status"] == "awaiting-acceptance"
        if index + 1 < len(client.script["blocks"]):
            assert executed["blocks"][index + 1]["status"] == "locked"
        if block["id"] == "B01":
            learner_baseline = assert_b01(executed)
        if block["id"] == "B12":
            assert learner_baseline is not None
            assert_b12(executed, learner_baseline)
        accepted = client.action("accept")
        if index + 1 < len(client.script["blocks"]):
            assert accepted["status"] == "ready"
            assert accepted["currentBlockIndex"] == index + 1
        else:
            assert accepted["status"] == "completed"
            assert accepted["classroom"]["completed"] is True
        block_receipts.append({
            "id": block["id"],
            "manualGateVerified": True,
            "elapsedSeconds": round(time.monotonic() - began, 3),
            "roomPhaseAfterExecute": executed["classroom"]["phase"],
        })

    final = client.get("/api/state")
    views = final["classroom"]["learnerViews"]
    receipt = {
        "schemaVersion": 1,
        "kind": "msv-live-run-real-api-acceptance",
        "startedAt": started,
        "completedAt": now(),
        "runId": final["runId"],
        "courseId": final["courseId"],
        "scriptId": final["scriptId"],
        "roomId": final["classroom"]["roomId"],
        "teamPublicId": final["classroom"]["teamPublicId"],
        "apiMode": final["apiMode"],
        "verified": {
            "macroSteps": len(client.script["macroSteps"]),
            "manualBlocks": len(block_receipts),
            "mentorCount": final["classroom"]["mentorCount"],
            "learnerCount": final["classroom"]["learnerCount"],
            "uniqueDealtCards": final["classroom"]["uniqueDealtCards"],
            "learnerPdmoCount": final["classroom"]["learnerPdmoCount"],
            "individualRp": {seat: view["reputation"] for seat, view in views.items()},
            "personalWalletTenths": {seat: view["walletTenths"] for seat, view in views.items()},
            "teamTreasuryTenths": final["classroom"]["teamTreasuryTenths"],
            "completed": final["classroom"]["completed"],
        },
        "blocks": block_receipts,
    }
    assert_no_secret_keys(receipt)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if reset_after:
        reset = client.action("reset")
        assert reset["status"] == "ready" and reset["currentBlockIndex"] == 0
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:18765")
    parser.add_argument("--output", type=Path, default=Path("/tmp/msv-live-run-runtime/acceptance-receipt.json"))
    parser.add_argument("--course", default="google-1995-2004", help="Course id exposed by /api/bootstrap")
    parser.add_argument("--reset-after", action="store_true", help="Return the controller to B01 ready after the full run")
    args = parser.parse_args()
    receipt = run(ControllerClient(args.url), args.output, args.reset_after, args.course)
    print(
        "REAL_ACCEPTANCE_OK "
        f"course={receipt['courseId']} blocks={receipt['verified']['manualBlocks']} room={receipt['roomId']} "
        f"receipt={args.output.resolve()}"
    )


if __name__ == "__main__":
    main()
