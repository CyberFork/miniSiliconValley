#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from course import CourseRepository  # noqa: E402
from workshop_snapshot import build_snapshot, canonical_bytes, validate_snapshot  # noqa: E402


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


class WorkshopSnapshotTests(unittest.TestCase):
    def test_bundled_released_projection_is_complete_redacted_and_deterministic(self) -> None:
        repository = CourseRepository()
        first = build_snapshot(repository, generated_at="2026-09-06T08:00:00Z", actor="test")
        second = build_snapshot(repository, generated_at="2026-09-06T08:00:00Z", actor="test")
        self.assertEqual(canonical_bytes(first), canonical_bytes(second))
        self.assertEqual([item["courseId"] for item in first["courses"]], ["eleme-2008-find-problem", "google-1995-2004"])
        for course in first["courses"]:
            self.assertEqual(course["revision"], 0)
            self.assertEqual(len(course["macroSteps"]), 5)
            self.assertEqual(len(course["blocks"]), 13)
            self.assertEqual([item["cardCount"] for item in course["deckSummary"]], [12] * 5)
        serialized = json.dumps(first, ensure_ascii=False)
        for forbidden in ("mentorScript", "seatTasks", "privateConcern", "walletTenths", "teamTreasuryTenths", "server path"):
            self.assertNotIn(forbidden, serialized)
        # Check the private runtime key, not the letters inside "released".
        self.assertNotIn('"lease":', serialized)

    def test_integrity_tampering_is_rejected(self) -> None:
        snapshot = build_snapshot(CourseRepository(), ["google-1995-2004"], generated_at="2026-09-06T08:00:00Z")
        snapshot["courses"][0]["title"] = "tampered"
        with self.assertRaisesRegex(ValueError, "integrity digest mismatch"):
            validate_snapshot(snapshot)

    def test_export_reads_exact_released_ref_and_has_zero_registry_or_runtime_side_effects(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            registry = root / "registry-data"
            repository = CourseRepository(registry)
            course = repository.load("google-1995-2004", variant="released")
            candidate = repository.save_candidate(copy.deepcopy(course), expected_revision=0, actor="test-editor")
            repository.approve(candidate["courseId"], candidate["revision"], candidate["digest"], "run-test", candidate["digest"], actor="test-dm")
            repository.release(candidate["courseId"], candidate["revision"], candidate["digest"], actor="test-publisher")
            # A newer Candidate must not leak into the Workshop snapshot.
            newer = copy.deepcopy(course)
            newer["course"]["description"] += " Candidate only"
            repository.save_candidate(newer, expected_revision=1, actor="test-editor")
            runtime = root / "runtime"
            runtime.mkdir()
            (runtime / "alpha-run.json").write_text('{"currentBlock":7,"lease":"secret"}')
            (runtime / "classroom-room.json").write_text('{"walletTenths":99,"privateHand":["x"]}')
            before_registry = tree_digest(registry)
            before_runtime = tree_digest(runtime)

            snapshot = build_snapshot(repository, ["google-1995-2004"], generated_at="2026-09-06T08:00:00Z")

            self.assertEqual(snapshot["courses"][0]["revision"], 1)
            self.assertEqual(snapshot["courses"][0]["digest"], candidate["digest"])
            self.assertEqual(before_registry, tree_digest(registry))
            self.assertEqual(before_runtime, tree_digest(runtime))
            self.assertNotIn("Candidate only", json.dumps(snapshot, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
