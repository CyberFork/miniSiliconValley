import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from course import course_digest, load_script  # noqa: E402


class T083CourseStudioContractTests(unittest.TestCase):
    def test_content_digest_ignores_registry_metadata_but_not_course_content(self):
        value = load_script("google-1995-2004")
        digest = course_digest(value)
        metadata_change = copy.deepcopy(value)
        metadata_change["authoring"] = {
            "status": "published", "revision": 99, "updatedAt": "2099-01-01T00:00:00Z",
            "approval": {"digest": digest, "runId": "test", "status": "approved"},
        }
        self.assertEqual(course_digest(metadata_change), digest)
        content_change = copy.deepcopy(value)
        content_change["blocks"][0]["studentPrompt"] += " 内容变化"
        self.assertNotEqual(course_digest(content_change), digest)

    def test_editor_and_runtime_share_projector_and_renderers(self):
        html = (ROOT / "static" / "editor.html").read_text(encoding="utf-8")
        editor = (ROOT / "static" / "editor.js").read_text(encoding="utf-8")
        seat = (ROOT / "static" / "seat.js").read_text(encoding="utf-8")
        controller = (ROOT / "static" / "controller.js").read_text(encoding="utf-8")
        shared = (ROOT / "static" / "course-preview.js").read_text(encoding="utf-8")
        for marker in ("courseTimeline", "seatPreviewGrid", "previewController", "fieldDialog", "saveCandidateDock"):
            self.assertIn(marker, html)
        self.assertIn("Preview.projectCourse", editor)
        self.assertIn("Preview.renderSeatSurface", editor)
        self.assertIn("Preview.renderControllerSurface", editor)
        self.assertIn("Preview.runtimeSeatView", seat)
        self.assertIn("Preview.renderSeatSurface", seat)
        self.assertIn("Preview.runtimeControllerView", controller)
        self.assertIn("Preview.renderControllerSurface", controller)
        self.assertIn("deterministicDeal", shared)
        self.assertNotIn("<iframe", html)


if __name__ == "__main__":
    unittest.main()
