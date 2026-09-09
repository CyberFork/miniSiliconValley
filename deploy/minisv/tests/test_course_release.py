from __future__ import annotations

import importlib.util
import hashlib
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
    def test_workshop_snapshot_rejects_tampering_and_private_runtime_fields(self) -> None:
        source = MODULE.WORKSHOP_OVERLAY / "confirmed-baseline.json"
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "snapshot.json"
            value = json.loads(source.read_text())
            value["courses"][0]["title"] = "tampered"
            path.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, "integrity digest"):
                MODULE.validate_workshop_snapshot(path)

            value = json.loads(source.read_text())
            value["lease"] = "must-not-leak"
            unsigned = {key: item for key, item in value.items() if key != "integrity"}
            value["integrity"] = {"algorithm": "sha256", "digest": MODULE.canonical_digest(unsigned)}
            path.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, "private field"):
                MODULE.validate_workshop_snapshot(path)

    def test_release_rejects_untraceable_source_sha_before_writing_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inputs = [root / name for name in ("legacy", "client", "static", "course", "portal")]
            for directory in inputs:
                directory.mkdir()
            output = root / "release"
            with self.assertRaisesRegex(ValueError, "invalid main SHA"):
                MODULE.build(*inputs, output, "t077-test", main_sha="main")
            self.assertFalse(output.exists())

    def test_release_packages_current_world_and_opaque_product_mentor_courseware(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            legacy = root / "legacy"
            client = root / "client"
            static = root / "static"
            course = root / "course"
            portal = root / "portal"
            output = root / "release"
            for directory in (
                legacy,
                client / "_next",
                client / "assets",
                client / "courseware" / "development-mentor-ligun" / "assets",
                client / "courseware" / "market-mentor-user-system",
                static / "world",
                static / "parents",
                course / "_next",
                course / "assets",
                portal,
            ):
                directory.mkdir(parents=True, exist_ok=True)

            (legacy / "demo.html").write_text("<html><head></head><body>retired world</body></html>")
            (legacy / "123456.html").write_text('<html><head></head><body><div class="_topActions_x_1"><a href="/world/">世界地图</a></div></body></html>')
            (legacy / "qa.html").write_text('<html><head></head><body><header><div class="_onlineBadge_x_1">在线</div></header></body></html>')
            for name, value in (
                ("launch.html", """<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'none'; img-src data:\"></head><body><header><div class=\"brand-lockup\" aria-label=\"Mini Silicon Valley 课程设计同步工坊\"><span class=\"brand-mark\" aria-hidden=\"true\">MSV</span><span><strong>Mini Silicon Valley</strong><small>COURSE SYSTEM</small></span></div><div class=\"session-health\"></div></header><nav><button class=\"nav-item\" type=\"button\" data-section=\"decisions\">决策</button></nav><main></main><script src=\"app.js\"></script></body></html>"""),
                ("app.js", "void 0;"), ("styles.css", "body{}"),
                ("public-deploy.js", "void 0;"), ("manifest.json", "{}"),
            ):
                (legacy / name).write_text(value)
            (client / "favicon.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>")
            development = client / "courseware" / "development-mentor-ligun"
            (development / "index.html").write_text("<html><body><h1>先立棍，再让 AI 跑</h1></body></html>")
            (development / "assets" / "diagram.png").write_bytes(b"\x89PNG\r\n\x1a\nD mentor")
            development_files = []
            for path in sorted(item for item in development.rglob("*") if item.is_file()):
                relative = path.relative_to(development).as_posix()
                content = path.read_bytes()
                development_files.append({"path": relative, "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)})
            development_tree = hashlib.sha256("".join(
                f"{item['path']}\0{item['sha256']}\n" for item in development_files
            ).encode()).hexdigest()
            (development / "SOURCE-MANIFEST.json").write_text(json.dumps({
                "schemaVersion": 1, "slideCount": 18, "files": development_files,
                "contentTreeSha256": development_tree,
            }))
            market = client / "courseware" / "market-mentor-user-system"
            (market / "index.html").write_text("<html><body><h1>产品的用户体系</h1><b>USER SYSTEM</b></body></html>")
            market_files = []
            for path in sorted(item for item in market.rglob("*") if item.is_file()):
                relative = path.relative_to(market).as_posix()
                content = path.read_bytes()
                market_files.append({"path": relative, "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)})
            market_tree = hashlib.sha256("".join(
                f"{item['path']}\0{item['sha256']}\n" for item in market_files
            ).encode()).hexdigest()
            (market / "SOURCE-MANIFEST.json").write_text(json.dumps({
                "schemaVersion": 1, "slideCount": 49, "files": market_files,
                "contentTreeSha256": market_tree,
            }))
            (static / "world" / "index.html").write_text('<html><head></head><body><a href="/course/">课程大纲</a>current world</body></html>')
            (static / "parents" / "index.html").write_text('<html><head></head><body><a class="msv-brand-home" href="/"><img src="/favicon.svg">current parents</a></body></html>')
            course_html = (
                '<html><head><link rel="stylesheet" href="/courseware/product-mentor-foundations/_next/chj.css"></head>'
                '<body><h1>青少年AI创业营</h1><b>MINI硅谷</b>'
                '<img src="/courseware/product-mentor-foundations/assets/home-workbench.png"></body></html>'
            )
            (course / "index.html").write_text(course_html)
            (course / "_next" / "chj.css").write_bytes(b"/* colleague bytes */")
            (course / "assets" / "home-workbench.png").write_bytes(b"\x89PNG\r\n\x1a\ncolleague")
            (portal / "index.html").write_text('<html><head></head><body><a href="/course/">课程大纲</a></body></html>')
            (portal / "404.html").write_text('<html><head></head><body><a href="/">返回 Mini Silicon Valley 主页</a></body></html>')
            for name in ("portal.css", "portal.js", "ui-theme.css", "ui-theme.js", "robots.txt", "site.webmanifest"):
                if name == "ui-theme.js":
                    value = 'var routes = ["/framework/", "/parents/"]; link.href = "/course/";'
                else:
                    value = "{}" if name.endswith((".json", ".webmanifest")) else "ok"
                (portal / name).write_text(value)

            main_sha = "a" * 40
            source_snapshot = {
                path.relative_to(course).as_posix(): path.read_bytes()
                for path in course.rglob("*") if path.is_file()
            }
            MODULE.build(legacy, client, static, course, portal, output, "t077-test", main_sha=main_sha)

            self.assertIn("current world", (output / "world" / "index.html").read_text())
            self.assertIn("current parents", (output / "parents" / "index.html").read_text())
            self.assertNotIn('msv-course-nav-link', (output / "framework" / "index.html").read_text())
            self.assertNotIn('msv-course-nav-link', (output / "parents" / "index.html").read_text())
            self.assertIn('link.href = "/course/"', (output / "ui-theme.js").read_text())
            self.assertTrue((output / "courseware" / "product-mentor-foundations" / "index.html").is_file())
            output_snapshot = {
                path.relative_to(output / "courseware" / "product-mentor-foundations").as_posix(): path.read_bytes()
                for path in (output / "courseware" / "product-mentor-foundations").rglob("*") if path.is_file()
            }
            self.assertEqual(output_snapshot, source_snapshot)
            self.assertNotIn("/ui-theme.js", (output / "courseware" / "product-mentor-foundations" / "index.html").read_text())
            self.assertEqual(
                MODULE.validate_development_courseware(output / "courseware" / "development-mentor-ligun")["sha256"],
                development_tree,
            )
            self.assertEqual(
                MODULE.validate_market_courseware(output / "courseware" / "market-mentor-user-system")["sha256"],
                market_tree,
            )
            workshop_html = (output / "workshop" / "index.html").read_text()
            self.assertIn("msv-workshop-released-baseline", workshop_html)
            self.assertIn('href="/" aria-label="返回 Mini Silicon Valley 主页"', workshop_html)
            self.assertIn('src="/favicon.svg"', workshop_html)
            self.assertIn("connect-src 'self'", workshop_html)
            self.assertIn("img-src 'self' data:", workshop_html)
            self.assertIn('data-msv-theme="adventure"', workshop_html)
            self.assertNotIn("data-msv-theme-slot", workshop_html)
            self.assertIn('data-panel="baseline"', workshop_html)
            for name in ("baseline.css", "baseline.js", "confirmed-baseline.json", "workshop-snapshot.schema.json"):
                self.assertTrue((output / "workshop" / name).is_file(), name)
            snapshot = json.loads((output / "workshop" / "confirmed-baseline.json").read_text())
            self.assertEqual(snapshot["source"]["channel"], "released")
            self.assertEqual(snapshot["scope"], "public-redacted-summary")
            self.assertIn("/course/", json.loads((output / "sitemap.json").read_text())["routes"])
            release = json.loads((output / "release.json").read_text())
            self.assertEqual(release["sources"]["main"], main_sha)
            self.assertEqual(release["sources"]["chjCourseUi"], MODULE.CHJ_COURSE_UI_SHA)
            self.assertEqual(release["sources"]["chjCourseTree"], MODULE.CHJ_COURSE_UI_TREE)
            self.assertIn("verbatim-product-mentor-courseware", release["features"])
            self.assertIn("shared-brand-home", release["features"])
            self.assertIn("released-workshop-snapshot", release["features"])
            self.assertFalse(release["coursewareArtifact"]["transformed"])
            self.assertEqual(release["coursewareArtifact"]["mentorRole"], "P")
            self.assertEqual(release["coursewareArtifact"]["files"], len(source_snapshot))
            self.assertEqual(release["developmentCoursewareArtifact"]["mentorRole"], "D")
            self.assertEqual(release["developmentCoursewareArtifact"]["sha256"], development_tree)
            self.assertFalse(release["developmentCoursewareArtifact"]["transformed"])
            self.assertEqual(release["marketCoursewareArtifact"]["mentorRole"], "M")
            self.assertEqual(release["marketCoursewareArtifact"]["sha256"], market_tree)
            self.assertFalse(release["marketCoursewareArtifact"]["transformed"])
            self.assertTrue((output / "MANIFEST.sha256").is_file())


if __name__ == "__main__":
    unittest.main()
