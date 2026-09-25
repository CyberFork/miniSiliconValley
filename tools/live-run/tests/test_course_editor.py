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
from course import CourseRepository, course_digest, legacy_course_digest  # noqa: E402


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

    def test_clone_candidate_and_alpha_runtime_discovery(self):
        _, cloned = self.request("POST", "/api/courses/clone", {
            "sourceCourseId": "google-1995-2004", "newCourseId": "sample-course-2010", "newName": "样例课程｜五步闭环",
        })
        value = cloned["data"]["course"]
        self.assertEqual(value["authoring"]["status"], "candidate")
        self.assertNotIn("sample-course-2010", {x["id"] for x in self.repository.list_published()})
        value["course"]["description"] = "一份经过编辑的完整课程。"
        saved = self.repository.save(value, status="candidate", expected_revision=1)
        self.assertEqual(saved["authoring"]["revision"], 2)
        self.assertEqual(len(saved["decks"]), 5)
        self.assertIn("sample-course-2010", {x["id"] for x in self.repository.list_for_editor()["courses"]})
        status, loaded = self.request("GET", "/api/courses/sample-course-2010?channel=candidate")
        self.assertEqual(status, 200); self.assertEqual(loaded["data"]["course"]["course"]["description"], value["course"]["description"])

    def test_formal_release_requires_completed_exact_candidate_receipt(self):
        base = self.repository.load("google-1995-2004")
        self.controller.state["status"] = "completed"
        status, body = self.request("POST", "/api/courses/release", {
            "courseId": base["course"]["id"], "revision": 0, "digest": course_digest(base),
        })
        self.assertEqual(status, 409); self.assertIn("Candidate", body["error"]["message"])

        value = self.repository.load("google-1995-2004")
        value["blocks"][0]["title"] += " · Candidate"
        candidate = self.repository.save(value, status="draft", expected_revision=0)
        digest = course_digest(candidate)
        self.controller.refresh_course()

        status, body = self.request("POST", "/api/courses/release", {
            "courseId": candidate["course"]["id"], "revision": 1, "digest": digest,
        })
        self.assertEqual(status, 409); self.assertIn("验收回执", body["error"]["message"])

        self.controller.state["status"] = "completed"
        status, body = self.request("POST", "/api/courses/release", {
            "courseId": candidate["course"]["id"], "revision": 1, "digest": "wrong",
        })
        self.assertEqual(status, 409); self.assertIn("exact Candidate", body["error"]["message"])

        self.repository.approve(candidate["course"]["id"], 1, digest, self.controller.state["runId"], digest)
        status, body = self.request("POST", "/api/courses/release", {
            "courseId": candidate["course"]["id"], "revision": 1, "digest": digest,
        })
        self.assertEqual(status, 200)
        released = body["data"]["course"]
        self.assertEqual(course_digest(released), digest)
        self.assertEqual(body["data"]["releasedRef"]["digest"], digest)

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
        ref = self.repository.save_candidate(edited, expected_revision=0)
        self.repository.approve("google-1995-2004", ref["revision"], ref["digest"], "run-release-test", ref["digest"])
        self.repository.release("google-1995-2004", ref["revision"], ref["digest"])
        restarted = CourseController(Path(self.tmp.name) / "run-state.json", course_repository=self.repository)
        self.assertEqual(restarted.script["course"]["description"], original)
        restarted.reset()
        self.assertEqual(restarted.script["course"]["description"], edited["course"]["description"])

    def test_pre_t083_digest_migrates_without_resetting_active_run(self):
        state_path = Path(self.tmp.name) / "run-state.json"
        state = json.loads(state_path.read_text())
        active_script = json.loads(json.dumps(self.controller.script, ensure_ascii=False))
        active_script["authoring"] = {"status": "draft", "revision": 8, "updatedAt": "2026-09-06T00:00:00Z"}
        self.controller.script_store.write(active_script)
        legacy_digest = legacy_course_digest(active_script)
        self.assertNotEqual(legacy_digest, course_digest(active_script))
        state.update({
            "courseDigest": legacy_digest,
            "runId": "run-preserve-across-t083",
            "status": "awaiting-acceptance",
            "currentBlockIndex": 4,
            "previewBlockIndex": 4,
        })
        state["blocks"][4]["status"] = "awaiting-acceptance"
        state["blocks"][4]["attempts"] = 1
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")

        restarted = CourseController(state_path, course_repository=self.repository)
        self.assertEqual(restarted.state["runId"], "run-preserve-across-t083")
        self.assertEqual(restarted.state["status"], "awaiting-acceptance")
        self.assertEqual(restarted.state["currentBlockIndex"], 4)
        self.assertEqual(restarted.state["blocks"][4]["attempts"], 1)
        self.assertEqual(restarted.state["courseDigest"], course_digest(active_script))


if __name__ == "__main__":
    unittest.main()
