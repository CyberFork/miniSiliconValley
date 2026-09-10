from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MODULE_PATH = ROOT / "scripts" / "sync-parent-qa-review-token.py"
SPEC = importlib.util.spec_from_file_location("minisv_parent_qa_token_sync", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ParentQaTokenSyncTests(unittest.TestCase):
    def files(self, root: Path, app: str, qa: str) -> tuple[Path, Path]:
        app_path = root / "classroom.env"
        qa_path = root / "deepseek.env"
        app_path.write_text(app, encoding="utf-8")
        qa_path.write_text(qa, encoding="utf-8")
        return app_path, qa_path

    def test_generates_one_private_token_without_overwriting_other_values(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            app, qa = self.files(Path(temporary), "SESSION_SECRET=kept\n", "DEEPSEEK_API_KEY=kept-too\n")
            self.assertEqual(MODULE.synchronize(app, qa), "generated")
            _, app_token = MODULE.read_env(app)
            _, qa_token = MODULE.read_env(qa)
            self.assertEqual(app_token, qa_token)
            self.assertGreaterEqual(len(app_token or ""), 24)
            self.assertIn("SESSION_SECRET=kept", app.read_text())
            self.assertIn("DEEPSEEK_API_KEY=kept-too", qa.read_text())
            self.assertEqual(os.stat(app).st_mode & 0o777, 0o600)
            self.assertEqual(os.stat(qa).st_mode & 0o777, 0o600)

    def test_copies_an_existing_token_and_check_mode_never_mutates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            token = "a-secure-review-token-that-is-long-enough"
            app, qa = self.files(Path(temporary), f"{MODULE.KEY}={token}\n", "DEEPSEEK_MODEL=test\n")
            self.assertEqual(MODULE.synchronize(app, qa), "copied")
            before = (app.read_bytes(), qa.read_bytes())
            self.assertEqual(MODULE.synchronize(app, qa, check=True), "verified")
            self.assertEqual(before, (app.read_bytes(), qa.read_bytes()))

    def test_mismatch_duplicate_short_and_symlink_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            token_a = "a" * 32
            token_b = "b" * 32
            app, qa = self.files(root, f"{MODULE.KEY}={token_a}\n", f"{MODULE.KEY}={token_b}\n")
            with self.assertRaisesRegex(ValueError, "differs"):
                MODULE.synchronize(app, qa)
            self.assertIn(token_a, app.read_text())
            self.assertIn(token_b, qa.read_text())

            app.write_text(f"{MODULE.KEY}=short\n", encoding="utf-8")
            qa.write_text("DEEPSEEK_MODEL=test\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "invalid"):
                MODULE.synchronize(app, qa)

            app.write_text(f"{MODULE.KEY}={token_a}\n{MODULE.KEY}={token_a}\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                MODULE.synchronize(app, qa)

            app.unlink()
            target = root / "target.env"
            target.write_text(f"{MODULE.KEY}={token_a}\n", encoding="utf-8")
            app.symlink_to(target)
            with self.assertRaisesRegex(ValueError, "symlink"):
                MODULE.synchronize(app, qa)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            app, qa = self.files(root, f"{MODULE.KEY}=short\n", "DEEPSEEK_MODEL=test\n")
            with self.assertRaisesRegex(ValueError, "invalid"):
                MODULE.synchronize(app, qa)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            token = "c" * 32
            app, qa = self.files(
                root,
                f"{MODULE.KEY}={token}\nexport {MODULE.KEY}={token}\n",
                f"{MODULE.KEY}={token}\n",
            )
            with self.assertRaisesRegex(ValueError, "duplicate"):
                MODULE.synchronize(app, qa)

    def test_cli_failure_never_echoes_either_secret(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            token_a = "private-alpha-" + "a" * 32
            token_b = "private-bravo-" + "b" * 32
            app, qa = self.files(root, f"{MODULE.KEY}={token_a}\n", f"{MODULE.KEY}={token_b}\n")
            result = subprocess.run(
                (sys.executable, str(MODULE_PATH), str(app), str(qa)),
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            combined = result.stdout + result.stderr
            self.assertNotIn(token_a, combined)
            self.assertNotIn(token_b, combined)


if __name__ == "__main__":
    unittest.main()
