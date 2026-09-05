from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "switch-current.py"
SPEC = importlib.util.spec_from_file_location("switch_current", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class SwitchCurrentTests(unittest.TestCase):
    def make_release(self, root: Path, release_id: str) -> Path:
        release = root / "releases" / release_id
        (release / "site").mkdir(parents=True)
        (release / "site" / "MANIFEST.sha256").write_text("verified\n")
        return release

    def test_replaces_existing_directory_symlink_instead_of_nesting(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            old = self.make_release(root, "old")
            new = self.make_release(root, "new")
            (root / "current").symlink_to("releases/old")

            MODULE.switch_current(root, "new")

            self.assertTrue((root / "current").is_symlink())
            self.assertEqual((root / "current").readlink(), Path("releases/new"))
            self.assertEqual((root / "current").resolve(), new.resolve())
            self.assertFalse((old / ".current-new").exists())

    def test_refuses_incomplete_release_and_unsafe_id(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            with self.assertRaisesRegex(ValueError, "incomplete"):
                MODULE.switch_current(root, "missing")
            with self.assertRaisesRegex(ValueError, "invalid"):
                MODULE.switch_current(root, "../escape")


if __name__ == "__main__":
    unittest.main()
