import http.client
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import course  # noqa: E402
from controller import CourseController, LiveRunServer  # noqa: E402


class T074Tests(unittest.TestCase):
    def test_builtins_have_five_decks_and_sixty_cards_and_elemee_cards(self):
        for item in course.list_courses():
            value = course.load_script(item["id"])
            self.assertEqual(len(value["decks"]), 5)
            self.assertEqual(sum(len(deck["cards"]) for deck in value["decks"]), 60)
        value = course.load_script("eleme-2008-find-problem")
        cards = {card["id"]: card for deck in value["decks"] for card in deck["cards"]}
        for cid, boundary, source in (
            ("e08-c-05", "F", "src-eleme-sjtu-youth-origin"),
            ("e08-f-02", "F", "src-eleme-sjtu-youth-process"),
            ("e08-r-04", "R", None),
        ):
            self.assertEqual(cards[cid]["boundary"], boundary)
            self.assertIn(source, cards[cid]["sourceIds"] if source else []) if source else self.assertEqual(cards[cid]["sourceIds"], [])

    def test_repository_metadata_and_get_schema(self):
        repo = course.CourseRepository()
        value = repo.load("eleme-2008-find-problem")
        manifest = course.course_manifest(value)
        self.assertEqual((manifest["schemaVersion"], manifest["deckCount"], manifest["cardCount"]), (1, 5, 60))
        self.assertEqual(len(manifest["digest"]), 64)
        self.assertEqual(repo.describe(value["course"]["id"])["digestShort"], manifest["digest"][:16])
        # Exercise the real GET API and its nested course/deck/card contract.
        with tempfile.TemporaryDirectory() as tmp:
            controller = CourseController(Path(tmp) / "run-state.json", course_repository=repo)
            server = LiveRunServer(("127.0.0.1", 0), controller, "t074")
            import threading
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
                conn.request("GET", "/api/courses/eleme-2008-find-problem")
                response = conn.getresponse(); body = json.loads(response.read()); conn.close()
                self.assertEqual(response.status, 200)
                data = body["data"]; self.assertEqual(data["metadata"]["digest"], manifest["digest"])
                self.assertEqual(len(data["course"]["decks"]), 5)
                self.assertEqual(len(data["course"]["decks"][0]["cards"]), 12)
            finally:
                server.shutdown(); server.server_close()

    def test_history_restore_is_append_only_and_returns_new_draft(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = course.CourseRepository(Path(tmp) / "courses")
            value = repo.load("eleme-2008-find-problem")
            value["decks"][0]["cards"][0]["body"] += " 第一版。"
            first = repo.save(value, status="draft", expected_revision=0)
            value = first
            value["decks"][0]["cards"][0]["body"] += " 第二版。"
            second = repo.save(value, status="draft", expected_revision=1)
            restored = repo.restore("eleme-2008-find-problem", 1, expected_revision=2)
            self.assertEqual(restored["authoring"]["revision"], 3)
            self.assertIn("第一版。", restored["decks"][0]["cards"][0]["body"])
            self.assertNotIn("第二版。", restored["decks"][0]["cards"][0]["body"])
            self.assertEqual([item["revision"] for item in repo.list_history("eleme-2008-find-problem")], [3, 2, 1, 0])
            self.assertEqual(second["authoring"]["revision"], 2)

    def test_source_url_cannot_inject_an_executable_scheme(self):
        value = course.load_script("eleme-2008-find-problem")
        value["sources"][0]["url"] = "javascript:alert(1)"
        with self.assertRaisesRegex(ValueError, r"\$\.sources\[0\]\.url"):
            course.validate_script(value)

    def test_editor_entrypoints_and_card_controls_are_static(self):
        html = (ROOT / "static/editor.html").read_text()
        js = (ROOT / "static/editor.js").read_text()
        for marker in ("cardsTab", "cardSearch", "cardStepFilter", "cardBoundaryFilter", "learnerPreview", "alphaHands", "packageHealth", "historyDialog"):
            self.assertIn(marker, html)
        for marker in ("renderCardResults", "cardSearch", "cardAlphaFilter", "renderLearnerPreview", "alphaHands"):
            self.assertIn(marker, js)


if __name__ == "__main__":
    unittest.main()
