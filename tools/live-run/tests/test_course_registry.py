"""Acceptance tests for immutable candidate/release course registry semantics (T-075).

These tests intentionally describe the registry contract before its implementation.
"""
import copy
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import course  # noqa: E402


class CourseRegistryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = course.CourseRepository(Path(self.tmp.name), bundled_files=course.BUNDLED_FILES)
        self.package = course.load_script(course.DEFAULT_COURSE_ID)

    def tearDown(self):
        self.tmp.cleanup()

    def candidate(self, description="candidate one"):
        value = copy.deepcopy(self.package)
        value["course"]["description"] = description
        return value

    def test_candidate_revisions_are_immutable_and_exact_ref_is_addressable(self):
        first = self.repo.save_candidate(self.candidate("one"))
        second = self.repo.save_candidate(self.candidate("two"))
        self.assertEqual(second["revision"], first["revision"] + 1)
        self.assertNotEqual(first["digest"], second["digest"])
        loaded = self.repo.load_ref(course.DEFAULT_COURSE_ID, first["revision"], first["digest"])
        self.assertEqual(loaded["course"]["description"], "one")
        with self.assertRaises((ValueError, KeyError)):
            self.repo.load_ref(course.DEFAULT_COURSE_ID, first["revision"], second["digest"])

    def test_approval_binds_exact_run_and_candidate_digest(self):
        candidate = self.repo.save_candidate(self.candidate())
        approval = self.repo.approve(
            course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"],
            run_id="run-001", run_digest=candidate["digest"],
        )
        self.assertEqual(approval["revision"], candidate["revision"])
        self.assertEqual(approval["digest"], candidate["digest"])
        self.assertEqual(approval["runId"], "run-001")
        with self.assertRaises((ValueError, KeyError)):
            self.repo.approve(course.DEFAULT_COURSE_ID, candidate["revision"], "wrong", "run-001", candidate["digest"])

    def test_release_only_moves_pointer_and_preserves_package_bytes(self):
        candidate = self.repo.save_candidate(self.candidate())
        self.repo.approve(course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"], "run-001", candidate["digest"])
        before = self.repo.load_ref(course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"])
        released = self.repo.release(course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"])
        after = self.repo.load_ref(course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"])
        self.assertEqual(released["revision"], candidate["revision"])
        self.assertEqual(released["digest"], candidate["digest"])
        self.assertEqual(course.course_digest(before), course.course_digest(after))
        self.assertEqual(self.repo.current_ref(course.DEFAULT_COURSE_ID)["digest"], candidate["digest"])
        self.assertEqual(self.repo.save_candidate(self.candidate())["revision"], candidate["revision"] + 1)

    def test_old_approval_expires_when_package_changes(self):
        first = self.repo.save_candidate(self.candidate("old"))
        self.repo.approve(course.DEFAULT_COURSE_ID, first["revision"], first["digest"], "run-001", first["digest"])
        changed = self.repo.save_candidate(self.candidate("changed"))
        with self.assertRaises((ValueError, KeyError)):
            self.repo.release(course.DEFAULT_COURSE_ID, first["revision"], changed["digest"])

    def test_bound_old_release_ref_does_not_drift_after_new_release(self):
        old = self.repo.save_candidate(self.candidate("old"))
        self.repo.approve(course.DEFAULT_COURSE_ID, old["revision"], old["digest"], "run-old", old["digest"])
        self.repo.release(course.DEFAULT_COURSE_ID, old["revision"], old["digest"])
        new = self.repo.save_candidate(self.candidate("new"))
        self.repo.approve(course.DEFAULT_COURSE_ID, new["revision"], new["digest"], "run-new", new["digest"])
        self.repo.release(course.DEFAULT_COURSE_ID, new["revision"], new["digest"])
        self.assertEqual(self.repo.load_ref(course.DEFAULT_COURSE_ID, old["revision"], old["digest"])["course"]["description"], "old")
        self.assertEqual(self.repo.current_ref(course.DEFAULT_COURSE_ID)["digest"], new["digest"])

    def test_classroom_acknowledgement_happens_before_local_released_pointer(self):
        candidate = self.repo.save_candidate(self.candidate("atomic publish"))
        approval = self.repo.approve(
            course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"],
            "run-atomic", candidate["digest"],
        )
        before = self.repo.current_ref(course.DEFAULT_COURSE_ID, "released")
        seen = []

        def reject(value, released, actual_approval):
            seen.append((course.course_digest(value), released, actual_approval))
            raise RuntimeError("D1 unavailable")

        with self.assertRaisesRegex(RuntimeError, "D1 unavailable"):
            self.repo.release(
                course.DEFAULT_COURSE_ID, candidate["revision"], candidate["digest"],
                before_pointer=reject,
            )
        self.assertEqual(self.repo.current_ref(course.DEFAULT_COURSE_ID, "released"), before)
        self.assertEqual(seen[0][0], candidate["digest"])
        self.assertEqual(seen[0][1]["digest"], candidate["digest"])
        self.assertEqual(seen[0][2], approval)

    def test_legacy_draft_and_published_files_remain_readable(self):
        legacy = Path(self.tmp.name) / "published" / f"{course.DEFAULT_COURSE_ID}.json"
        legacy.parent.mkdir(parents=True, exist_ok=True)
        legacy.write_text(__import__("json").dumps(self.package), encoding="utf-8")
        loaded = self.repo.load(course.DEFAULT_COURSE_ID, variant="published")
        self.assertEqual(loaded["course"]["id"], course.DEFAULT_COURSE_ID)


if __name__ == "__main__":
    unittest.main()
