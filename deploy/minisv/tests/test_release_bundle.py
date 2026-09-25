from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MODULE_PATH = ROOT / "package_bundle.py"
SPEC = importlib.util.spec_from_file_location("minisv_package_bundle", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReleaseBundleTests(unittest.TestCase):
    def fixture(self, root: Path) -> tuple[Path, Path, Path]:
        site = root / "site"
        app = root / "dist"
        parent_qa = app / "parent-qa"
        ops = root / "ops"
        site.mkdir(parents=True)
        (site / "index.html").write_text("MiniSV")
        (site / "MANIFEST.sha256").write_text(f"{hashlib.sha256(b'MiniSV').hexdigest()}  index.html\n")
        (app / "server").mkdir(parents=True)
        (app / "client").mkdir()
        (app / "server" / "index.js").write_text("export default {}")
        (app / "server" / "BUILD_ID").write_text("build-1\n")
        (app / "server" / "wrangler.json").write_text(json.dumps({
            "main": "index.js",
            "assets": {"directory": "../client"},
            "d1_databases": [{"binding": "DB"}],
            "vars": {"MSV_SELF_HOSTED_AUTH": "app-session", "MSV_APP_BASE_PATH": "/"},
        }))
        (app / "client" / "vinext-client-entry-manifest.json").write_text("{}")
        parent_qa.mkdir()
        server = b"export const service = 'parent-qa'\n"
        (parent_qa / "server.mjs").write_bytes(server)
        (parent_qa / "manifest.json").write_text(json.dumps({
            "schemaVersion": 1,
            "service": "msv-parent-qa",
            "entrypoint": "server.mjs",
            "bytes": len(server),
            "sha256": hashlib.sha256(server).hexdigest(),
        }))
        for entry in MODULE.OPS_ENTRIES:
            path = ops / entry
            if Path(entry).suffix:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(entry)
            else:
                path.mkdir(parents=True)
                (path / "fixture.txt").write_text(entry)
        return site, app, ops

    def test_one_bundle_contains_static_app_and_ops_but_no_runtime_data(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            site, app, ops = self.fixture(root)
            output = root / "release"
            MODULE.build_bundle(site, app, ops, output, "t085-bundle", main_sha="a" * 40)
            MODULE.verify_manifest(output)
            self.assertTrue((output / "site" / "index.html").is_file())
            self.assertTrue((output / "app" / "dist" / "server" / "index.js").is_file())
            self.assertTrue((output / "app" / "dist" / "parent-qa" / "server.mjs").is_file())
            self.assertTrue((output / "ops" / "launchd" / "fixture.txt").is_file())
            bundle = json.loads((output / "bundle.json").read_text())
            self.assertEqual(bundle["release"], "t085-bundle")
            self.assertEqual(bundle["units"]["app"]["buildId"], "build-1")
            self.assertEqual(bundle["units"]["parentQa"]["entrypoint"], "server.mjs")
            self.assertFalse(bundle["units"]["data"]["packaged"])

    def test_tampered_site_and_misconfigured_worker_fail_before_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            site, app, ops = self.fixture(root)
            (site / "index.html").write_text("tampered")
            with self.assertRaisesRegex(ValueError, "manifest mismatch"):
                MODULE.build_bundle(site, app, ops, root / "bad-site", "bad-site")
            self.assertFalse((root / "bad-site").exists())

            site, app, ops = self.fixture(root / "second")
            config = json.loads((app / "server" / "wrangler.json").read_text())
            config["d1_databases"] = []
            (app / "server" / "wrangler.json").write_text(json.dumps(config))
            with self.assertRaisesRegex(ValueError, "D1 binding DB"):
                MODULE.build_bundle(site, app, ops, root / "bad-app", "bad-app")
            self.assertFalse((root / "bad-app").exists())

    def test_secret_and_symlink_inputs_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            site, app, ops = self.fixture(root)
            (app / "client" / ".env").write_text("SECRET=value")
            with self.assertRaisesRegex(ValueError, "forbidden runtime data or secret"):
                MODULE.build_bundle(site, app, ops, root / "bad-secret", "bad-secret")
            (app / "client" / ".env").unlink()
            (app / "client" / "outside").symlink_to(root / "outside")
            with self.assertRaisesRegex(ValueError, "contains a symlink"):
                MODULE.build_bundle(site, app, ops, root / "bad-link", "bad-link")

    def test_parent_qa_manifest_and_private_runtime_files_are_required(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            site, app, ops = self.fixture(root)
            parent_qa = app / "parent-qa"
            manifest = json.loads((parent_qa / "manifest.json").read_text())
            manifest["sha256"] = "0" * 64
            (parent_qa / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "does not match"):
                MODULE.build_bundle(site, app, ops, root / "bad-parent-qa", "bad-parent-qa")
            self.assertFalse((root / "bad-parent-qa").exists())

            site, app, ops = self.fixture(root / "second-parent")
            parent_qa = app / "parent-qa"
            (parent_qa / "knowledge-gaps.ndjson").write_text("{}\n")
            with self.assertRaisesRegex(ValueError, "runtime data or secret"):
                MODULE.build_bundle(site, app, ops, root / "bad-parent-data", "bad-parent-data")


if __name__ == "__main__":
    unittest.main()
