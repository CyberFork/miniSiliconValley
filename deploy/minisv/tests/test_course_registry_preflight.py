from __future__ import annotations

import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "preflight-course-registry-integrity.py"
SPEC = importlib.util.spec_from_file_location("minisv_course_registry_preflight", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class CourseRegistryPreflightTests(unittest.TestCase):
    def fixture(self, digest: str) -> tuple[tempfile.TemporaryDirectory, Path]:
        temporary = tempfile.TemporaryDirectory()
        path = Path(temporary.name) / "miniflare-D1DatabaseObject.sqlite"
        with sqlite3.connect(path) as db:
            db.executescript(
                """
                CREATE TABLE course_versions (
                  course_id TEXT NOT NULL, revision INTEGER NOT NULL, digest TEXT NOT NULL,
                  PRIMARY KEY(course_id, revision)
                );
                CREATE TABLE course_candidate_pointers (
                  course_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, digest TEXT NOT NULL
                );
                INSERT INTO course_versions VALUES ('course-a', 3, 'good');
                """
            )
            db.execute("INSERT INTO course_candidate_pointers VALUES ('course-a', 3, ?)", (digest,))
        return temporary, path

    def test_valid_database_is_discovered_and_read_only(self) -> None:
        temporary, path = self.fixture("good")
        self.addCleanup(temporary.cleanup)
        self.assertEqual(MODULE.discover_database(Path(temporary.name)), path.resolve())
        report = MODULE.inspect(path)
        self.assertTrue(report["ok"])
        with sqlite3.connect(path) as db:
            self.assertEqual(db.execute("SELECT digest FROM course_candidate_pointers").fetchone()[0], "good")

    def test_mismatch_is_reported_without_repair(self) -> None:
        temporary, path = self.fixture("wrong")
        self.addCleanup(temporary.cleanup)
        report = MODULE.inspect(path)
        self.assertFalse(report["ok"])
        self.assertEqual(report["findings"][0]["table"], "course_candidate_pointers")
        self.assertEqual(report["findings"][0]["sample"][0]["digest"], "wrong")
        with sqlite3.connect(path) as db:
            self.assertEqual(db.execute("SELECT digest FROM course_candidate_pointers").fetchone()[0], "wrong")

    def test_missing_database_is_a_safe_first_deploy_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            self.assertIsNone(MODULE.discover_database(Path(temporary)))

    def test_corrupt_sqlite_file_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "miniflare-D1DatabaseObject.sqlite"
            path.write_bytes(b"not a sqlite database")
            with self.assertRaises(sqlite3.DatabaseError):
                MODULE.discover_database(Path(temporary))

    def test_multiple_registry_databases_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            for name in ("one.sqlite", "two.sqlite"):
                with sqlite3.connect(Path(temporary) / name) as db:
                    db.execute("CREATE TABLE course_versions (course_id TEXT, revision INTEGER, digest TEXT)")
            with self.assertRaisesRegex(RuntimeError, "more than one course registry"):
                MODULE.discover_database(Path(temporary))


if __name__ == "__main__":
    unittest.main()
