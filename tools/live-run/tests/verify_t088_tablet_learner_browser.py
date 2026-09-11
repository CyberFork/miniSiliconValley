#!/usr/bin/env python3
"""Run and extract T-088 learner Pad engineering acceptance.

T-090 already builds the real Candidate, real Test Classroom, exact courseware
bindings, private cards, structured learner submission, mentor feedback and
weak-network recovery in an isolated D1 database. T-088 deliberately reuses
that end-to-end harness instead of creating a weaker mock classroom.

The resulting receipt is Chromium responsive/touch automation evidence only.
It never claims to be physical iPad Safari or Android device acceptance and it
never signs a ViewAcceptanceReceipt/UiAcceptanceReceipt in production.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[3]
T090_SCRIPT = REPO / "tools" / "live-run" / "tests" / "verify_t090_development_mentor_browser.py"
T090_RECEIPT = REPO / "docs" / "qa" / "t090-development-mentor" / "browser-receipt.json"
QA = REPO / "docs" / "qa" / "t088-tablet-mobile"
EXPECTED_VIEWPORTS = {
    "ipad-mini-portrait": (744, 1133),
    "ipad-mini-landscape": (1133, 744),
    "ipad-portrait": (820, 1180),
    "ipad-landscape": (1180, 820),
    "ipad-pro-portrait": (1024, 1366),
    "ipad-pro-landscape": (1366, 1024),
    "android-tablet-portrait": (800, 1280),
    "android-tablet-landscape": (1280, 800),
    "phone-390": (390, 844),
    "phone-430": (430, 932),
}


def main() -> None:
    assert (REPO / "dist" / "server" / "wrangler.json").exists(), "run npm run build:minisv-app first"
    subprocess.run(["python3", str(T090_SCRIPT)], cwd=REPO, check=True)
    source = json.loads(T090_RECEIPT.read_text(encoding="utf-8"))
    pad = source.get("t088LearnerPad")
    assert source.get("ok") is True and isinstance(pad, dict), source
    assert pad.get("session") == "real learner account; no Admin DM viewAs", pad
    assert pad.get("privateCards") == {"count": 2, "isolatedFromLearner2": True}, pad
    shield = pad.get("privacyShield")
    assert isinstance(shield, dict) and shield.get("concealed", {}).get("display") == "grid", shield
    assert shield.get("restoredAttribute") is False and shield.get("restoredDisplay") == "none", shield
    assert pad.get("touchOnlyNavigation") is True and pad.get("structuredFormFields") == 10, pad

    matrix = pad.get("responsiveViewports")
    assert isinstance(matrix, list) and len(matrix) == len(EXPECTED_VIEWPORTS), matrix
    actual = {item["id"]: (item["width"], item["height"]) for item in matrix}
    assert actual == EXPECTED_VIEWPORTS, actual
    for item in matrix:
        geometry = item["geometry"]
        touch = item["touch"]
        assert geometry["body"] <= geometry["width"] + 1, item
        assert geometry["root"] <= geometry["width"] + 1, item
        assert touch["hoverNone"] is True, item
        assert touch["undersized"] == [] and touch["smallEditors"] == [], item

    boundary = str(pad.get("automationBoundary", ""))
    assert "physical iPad Safari" in boundary and "not attested" in boundary, boundary
    screenshots = [path for path in source.get("screenshots", []) if "/t088-" in path]
    assert len(screenshots) == 4, screenshots

    receipt = {
        "ok": True,
        "scope": "T-088 learner touch-only engineering acceptance",
        "sourceHarness": "T-090 real Candidate + isolated Test Classroom + real learner account",
        "browser": source["browser"],
        "exactCourse": pad["exactCourse"],
        "automated": {
            "login": True,
            "realLearnerSession": True,
            "privateCardIsolation": True,
            "backgroundSnapshotPrivacyShield": shield,
            "touchOnlyBlockNavigation": True,
            "structuredSubmissionAndMentorFeedback": source["developmentStick"],
            "offlineRecovery": source["developmentStick"]["offlineRecovery"],
            "accountMenuAndExitReachable": True,
            "responsiveViewports": matrix,
            "pageErrors": source["pageErrors"],
            "requestFailures": source["requestFailures"],
        },
        "screenshots": screenshots,
        "humanDeviceGates": {
            "status": "required-not-attested",
            "ipadSafari": "Pending physical touch/soft-keyboard/rotation/lock-screen rehearsal",
            "androidChrome": "Pending physical touch/soft-keyboard/rotation/lock-screen rehearsal",
            "uiAcceptanceReceiptSigned": False,
        },
        "boundary": boundary,
    }
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "browser-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
