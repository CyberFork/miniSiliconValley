import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController, LiveRunServer  # noqa: E402
from course import CourseRepository  # noqa: E402


class CourseEditorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.repository = CourseRepository(root / "courses")
        self.controller = CourseController(root / "run-state.json", course_repository=self.repository)
        self.server = LiveRunServer(("127.0.0.1", 0), self.controller, "editor-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.tmp.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=4)
        actual = {"Host": f"127.0.0.1:{self.server.server_port}", **(headers or {})}
        raw = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        if raw is not None:
            actual.update({"Content-Type": "application/json", "Content-Length": str(len(raw)), "X-Live-Run-Token": "editor-token"})
        connection.request(method, path, body=raw, headers=actual)
        response = connection.getresponse(); payload = response.read(); content_type = response.getheader("Content-Type", "")
        connection.close()
        return response.status, json.loads(payload) if content_type.startswith("application/json") else payload.decode()

    def test_editor_assets_and_catalog_are_served(self):
        status, html = self.request("GET", "/editor/")
        self.assertEqual(status, 200); self.assertIn("课程编辑器", html)
        self.assertIn("阶段卡组", html); self.assertIn("模拟 4 人发牌", html)
        status, body = self.request("GET", "/api/courses")
        self.assertEqual(status, 200)
        self.assertEqual({x["id"] for x in body["data"]["courses"]}, {"google-1995-2004", "eleme-2008-find-problem"})

    def test_editor_javascript_exposes_card_crud_and_explicit_alpha_refresh(self):
        status, javascript = self.request("GET", "/editor.js")
        self.assertEqual(status, 200)
        for marker in ("addCard", "data-card-action", "simulateDeal", "refresh-course", "Alpha Run"):
            self.assertIn(marker, javascript)

    def test_controller_exposes_preview_and_refresh_controls(self):
        status, html = self.request("GET", "/")
        self.assertEqual(status, 200)
        for marker in ("previewBack", "previewForward", "refreshCourse", "versionPanel"):
            self.assertIn(marker, html)

    def test_clone_draft_publish_and_runtime_discovery(self):
        _, cloned = self.request("POST", "/api/courses/clone", {
            "sourceCourseId": "google-1995-2004", "newCourseId": "sample-course-2010", "newName": "样例课程｜五步闭环",
        })
        value = cloned["data"]["course"]
        self.assertEqual(value["authoring"]["status"], "draft")
        self.assertNotIn("sample-course-2010", {x["id"] for x in self.repository.list_published()})
        value["course"]["description"] = "一份经过编辑的完整课程。"
        status, saved = self.request("POST", "/api/courses/save", {"course": value, "status": "published", "expectedRevision": 1})
        self.assertEqual(status, 200); self.assertEqual(saved["data"]["revision"], 2)
        self.assertEqual(len(saved["data"]["course"]["decks"]), 5)
        self.assertIn("sample-course-2010", {x["id"] for x in self.repository.list_published()})
        status, loaded = self.request("GET", "/api/courses/sample-course-2010?variant=published")
        self.assertEqual(status, 200); self.assertEqual(loaded["data"]["course"]["course"]["description"], value["course"]["description"])

    def test_invalid_json_path_and_revision_conflict_are_visible(self):
        value = self.repository.load("google-1995-2004")
        del value["blocks"][0]["seatTasks"]["learner04"]
        status, body = self.request("POST", "/api/courses/validate", {"course": value})
        self.assertEqual(status, 409); self.assertIn("$.blocks[0].seatTasks", body["error"]["message"])
        value = self.repository.load("google-1995-2004")
        status, _ = self.request("POST", "/api/courses/save", {"course": value, "status": "draft", "expectedRevision": 9})
        self.assertEqual(status, 409)

    def test_bad_origin_cannot_write(self):
        value = self.repository.load("google-1995-2004")
        status, body = self.request("POST", "/api/courses/validate", {"course": value}, {"Origin": "https://evil.example"})
        self.assertEqual(status, 403); self.assertEqual(body["error"]["code"], "CONTROL_FORBIDDEN")

    def test_active_run_pins_course_revision_across_restart_until_reset(self):
        original = self.controller.script["course"]["description"]
        edited = self.repository.load("google-1995-2004")
        edited["course"]["description"] = "新发布版不应热替换正在上课的 Run。"
        self.repository.save(edited, status="published", expected_revision=0)
        restarted = CourseController(Path(self.tmp.name) / "run-state.json", course_repository=self.repository)
        self.assertEqual(restarted.script["course"]["description"], original)
        restarted.reset()
        self.assertEqual(restarted.script["course"]["description"], edited["course"]["description"])


if __name__ == "__main__":
    unittest.main()
