from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "package_release.py"
SPEC = importlib.util.spec_from_file_location("package_release_t077", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CourseReleaseTests(unittest.TestCase):
    def test_release_rejects_untraceable_source_sha_before_writing_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inputs = [root / name for name in ("legacy", "client", "static", "portal")]
            for directory in inputs:
                directory.mkdir()
            output = root / "release"
            with self.assertRaisesRegex(ValueError, "invalid main SHA"):
                MODULE.build(*inputs, output, "t077-test", main_sha="main")
            self.assertFalse(output.exists())

    def test_release_packages_current_world_and_course_and_bridges_legacy_public_pages(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            legacy = root / "legacy"
            client = root / "client"
            static = root / "static"
            portal = root / "portal"
            output = root / "release"
            for directory in (legacy, client / "_next", client / "assets", static / "world", static / "course", portal):
                directory.mkdir(parents=True, exist_ok=True)

            (legacy / "demo.html").write_text("<html><head></head><body>retired world</body></html>")
            (legacy / "123456.html").write_text('<html><head></head><body><div class="_topActions_x_1"><a href="/world/">世界地图</a></div></body></html>')
            (legacy / "qa.html").write_text('<html><head></head><body><header><div class="_onlineBadge_x_1">在线</div></header></body></html>')
            for name, value in (
                ("launch.html", "<html><head></head><body>workshop</body></html>"),
                ("app.js", "void 0;"), ("styles.css", "body{}"),
                ("public-deploy.js", "void 0;"), ("manifest.json", "{}"),
            ):
                (legacy / name).write_text(value)
            (client / "favicon.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>")
            (client / "assets" / "course-outline-world-map.webp").write_bytes(b"map")
            (static / "world" / "index.html").write_text('<html><head></head><body><a href="/course/">课程大纲</a>current world</body></html>')
            (static / "course" / "index.html").write_text('<html><head></head><body><a href="/course/">课程大纲</a><div data-course-steps="5" data-course-blocks="13">六分钟 Demo Day</div></body></html>')
            (portal / "index.html").write_text('<html><head></head><body><a href="/course/">课程大纲</a></body></html>')
            for name in ("portal.css", "portal.js", "ui-theme.css", "ui-theme.js", "robots.txt", "site.webmanifest"):
                if name == "ui-theme.js":
                    value = 'var routes = ["/framework/", "/parents/"]; link.href = "/course/";'
                else:
                    value = "{}" if name.endswith((".json", ".webmanifest")) else "ok"
                (portal / name).write_text(value)

            main_sha = "a" * 40
            MODULE.build(legacy, client, static, portal, output, "t077-test", main_sha=main_sha)

            self.assertIn("current world", (output / "world" / "index.html").read_text())
            self.assertNotIn('msv-course-nav-link', (output / "framework" / "index.html").read_text())
            self.assertNotIn('msv-course-nav-link', (output / "parents" / "index.html").read_text())
            self.assertIn('link.href = "/course/"', (output / "ui-theme.js").read_text())
            self.assertTrue((output / "course" / "index.html").is_file())
            self.assertIn("/course/", json.loads((output / "sitemap.json").read_text())["routes"])
            release = json.loads((output / "release.json").read_text())
            self.assertEqual(release["sources"]["main"], main_sha)
            self.assertEqual(release["sources"]["chjCourseUi"], MODULE.CHJ_COURSE_UI_SHA)
            self.assertIn("stable-course-outline", release["features"])
            self.assertTrue((output / "MANIFEST.sha256").is_file())


if __name__ == "__main__":
    unittest.main()
