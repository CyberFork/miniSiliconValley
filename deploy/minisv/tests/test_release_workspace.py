from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "package_release.py"
SPEC = importlib.util.spec_from_file_location("package_release_workspace", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def git(root: Path, *arguments: str) -> str:
    return subprocess.check_output(("git", "-C", str(root), *arguments), text=True).strip()


class ReleaseWorkspaceTests(unittest.TestCase):
    def make_repo(self, *, remote: str = MODULE.CANONICAL_REPOSITORY) -> tuple[tempfile.TemporaryDirectory[str], Path, str]:
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        subprocess.run(("git", "init", "-b", "main", str(root)), check=True, stdout=subprocess.DEVNULL)
        git(root, "config", "user.name", "MiniSV Test")
        git(root, "config", "user.email", "minisv-test@example.invalid")
        (root / "README.md").write_text("canonical\n", encoding="utf-8")
        git(root, "add", "README.md")
        git(root, "commit", "-m", "fixture")
        git(root, "remote", "add", "origin", remote)
        head = git(root, "rev-parse", "HEAD")
        git(root, "update-ref", "refs/remotes/origin/main", head)
        return temporary, root, head

    def test_clean_canonical_origin_and_exact_head_pass(self) -> None:
        temporary, root, head = self.make_repo(remote="git@github.com:CyberFork/miniSiliconValley.git")
        self.addCleanup(temporary.cleanup)
        result = MODULE.verify_release_workspace(root, head)
        self.assertTrue(result["verified"])
        self.assertFalse(result["workspaceDirty"])
        self.assertEqual(result["sourceCommit"], head)
        self.assertIsNone(result["exceptionReason"])

    def test_wrong_origin_and_unsynchronized_head_fail_closed(self) -> None:
        temporary, root, head = self.make_repo(remote="https://github.com/CyberFork/minisv.git")
        self.addCleanup(temporary.cleanup)
        with self.assertRaisesRegex(ValueError, "origin is not canonical"):
            MODULE.verify_release_workspace(root, head)
        git(root, "remote", "set-url", "origin", MODULE.CANONICAL_REPOSITORY)
        (root / "next.txt").write_text("next\n", encoding="utf-8")
        git(root, "add", "next.txt")
        git(root, "commit", "-m", "unpushed")
        new_head = git(root, "rev-parse", "HEAD")
        with self.assertRaisesRegex(ValueError, "not synchronized"):
            MODULE.verify_release_workspace(root, new_head)

    def test_dirty_workspace_requires_a_recorded_exception(self) -> None:
        temporary, root, head = self.make_repo()
        self.addCleanup(temporary.cleanup)
        (root / "working.txt").write_text("not committed\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "workspace is dirty"):
            MODULE.verify_release_workspace(root, head)
        result = MODULE.verify_release_workspace(root, head, dirty_reason="Emergency rebuild with reviewed local portal copy")
        self.assertTrue(result["workspaceDirty"])
        self.assertEqual(result["exceptionReason"], "Emergency rebuild with reviewed local portal copy")

    def test_retired_marker_and_mismatched_sha_fail_closed(self) -> None:
        temporary, root, head = self.make_repo()
        self.addCleanup(temporary.cleanup)
        with self.assertRaisesRegex(ValueError, "must equal"):
            MODULE.verify_release_workspace(root, "0" * 40)
        (root / MODULE.RETIRED_WORKSPACE_MARKER).write_text("retired\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "retired"):
            MODULE.verify_release_workspace(root, head, dirty_reason="Legacy workspace intentionally retained")


if __name__ == "__main__":
    unittest.main()
