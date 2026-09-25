import importlib.util
import json
import sqlite3
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "migrate-courseware-text.py"
spec = importlib.util.spec_from_file_location("migrate_courseware_text", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)
recover = module.recover
SHARED = module.SHARED

class RecoveryTests(unittest.TestCase):
    def db(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE editions (deck TEXT, base TEXT, revision INTEGER, patches TEXT, created_at TEXT)")
        return db

    def add(self, db, deck, base, revision, patches, at):
        db.execute("INSERT INTO editions VALUES (?,?,?,?,?)", (deck, base, revision, json.dumps(patches, ensure_ascii=False), at))

    def shared(self, db, deck):
        rows = db.execute("SELECT revision, patches, created_at FROM editions WHERE deck=? AND base=? ORDER BY revision", (deck, SHARED)).fetchall()
        return [(revision, json.loads(patches), at) for revision, patches, at in rows]

    def test_merges_bases_and_preserves_legacy_snapshots(self):
        db = self.db(); mapping = {"deck/old": {"a": {"id": "slide:title", "original": "A"}, "b": {"id": "slide:subtitle", "original": "B"}}, "deck/new": {"a": {"id": "slide:title", "original": "A"}}}
        self.add(db, "deck", "old", 1, {"a": "old-a", "b": "old-b"}, "2020-01-01")
        self.add(db, "deck", "new", 1, {"a": "new-a"}, "2020-01-02")
        before = db.execute("SELECT * FROM editions WHERE base!=?", (SHARED,)).fetchall()
        report = recover(db, mapping, "editions")
        self.assertEqual(self.shared(db, "deck")[-1][1], {"slide:title": {"value": "new-a", "original": "A", "base": "new"}, "slide:subtitle": {"value": "old-b", "original": "B", "base": "old"}})
        self.assertEqual(db.execute("SELECT * FROM editions WHERE base!=?", (SHARED,)).fetchall(), before)
        self.assertEqual(len(report), 3)

    def test_last_explicit_edit_wins_and_repeat_is_idempotent(self):
        db = self.db(); mapping = {"d/a": {"k": {"id": "stable:k", "original": "O"}}, "d/b": {"k": {"id": "stable:k", "original": "O"}}}
        self.add(db, "d", "a", 1, {"k": "first"}, "2020-01-01")
        self.add(db, "d", "b", 1, {"k": "last"}, "2020-01-02")
        recover(db, mapping, "editions")
        rows = self.shared(db, "d"); self.assertEqual(rows[-1][1]["stable:k"]["value"], "last")
        count = db.execute("SELECT count(*) FROM editions").fetchone()[0]
        self.assertEqual(recover(db, mapping, "editions"), []); self.assertEqual(db.execute("SELECT count(*) FROM editions").fetchone()[0], count)

    def test_null_restore_is_tombstone_and_does_not_resurrect(self):
        db = self.db(); mapping = {"d/old": {"k": {"id": "stable:k", "original": "O"}}}
        self.add(db, "d", "old", 1, {"k": "value"}, "2020-01-01")
        self.add(db, "d", "old", 2, {"k": None}, "2020-01-02")
        recover(db, mapping, "editions")
        state = self.shared(db, "d")[-1][1]["stable:k"]
        self.assertIsNone(state["value"]); self.assertEqual(state["base"], "old")

    def test_unmapped_keys_are_retained_under_legacy_namespace(self):
        db = self.db(); self.add(db, "d", "old", 1, {"mystery": "keep"}, "2020-01-01")
        report = recover(db, {}, "editions")
        stable = next(iter(self.shared(db, "d")[-1][1]))
        self.assertTrue(stable.startswith("legacy.")); self.assertFalse(report[0]["mapped"])

    def test_new_legacy_writes_after_rollback_fail_closed(self):
        db=self.db();self.add(db,"d","old",1,{"k":"one"},"2020-01-01");recover(db,{},"editions")
        self.add(db,"d","old",2,{"k":"two"},"2020-01-02")
        with self.assertRaisesRegex(RuntimeError,"Legacy editions changed"):recover(db,{},"editions")

    def test_decks_are_isolated(self):
        db = self.db(); mapping = {"a/v": {"k": {"id": "same", "original": "O"}}, "b/v": {"k": {"id": "same", "original": "O"}}}
        self.add(db, "a", "v", 1, {"k": "A"}, "2020-01-01"); self.add(db, "b", "v", 1, {"k": "B"}, "2020-01-01")
        recover(db, mapping, "editions")
        self.assertEqual(self.shared(db, "a")[-1][1]["same"]["value"], "A"); self.assertEqual(self.shared(db, "b")[-1][1]["same"]["value"], "B")

if __name__ == "__main__": unittest.main()
