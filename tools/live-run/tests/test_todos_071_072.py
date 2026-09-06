import copy
import json
import random
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController  # noqa: E402
from course import (  # noqa: E402
    DECK_DRAW_BLOCKS,
    LEARNER_SEAT_IDS,
    STEP_IDS,
    CourseRepository,
    deal_course_deck,
    validate_script,
)


class CourseDeckTruthTests(unittest.TestCase):
    def setUp(self):
        self.repository = CourseRepository()

    def test_bundled_google_and_eleme_have_five_real_stage_decks(self):
        for metadata in self.repository.list_published():
            value = self.repository.load(metadata["id"])
            self.assertEqual([deck["macroStepId"] for deck in value["decks"]], list(STEP_IDS))
            self.assertEqual([deck["drawAtBlockId"] for deck in value["decks"]], list(DECK_DRAW_BLOCKS))
            self.assertEqual([len(deck["cards"]) for deck in value["decks"]], [12] * 5)
            all_ids = [card["id"] for deck in value["decks"] for card in deck["cards"]]
            self.assertEqual(len(all_ids), len(set(all_ids)))
            self.assertTrue(all("holderIdentityId" not in card for deck in value["decks"] for card in deck["cards"]))

    def test_four_by_three_deal_is_unique_and_role_independent(self):
        value = self.repository.load("eleme-2008-find-problem")
        first = deal_course_deck(value, "operate", rng=random.Random(73))
        second = deal_course_deck(value, "operate", rng=random.Random(73))
        self.assertEqual(first, second)
        self.assertEqual(set(first), set(LEARNER_SEAT_IDS))
        self.assertEqual([len(first[seat]) for seat in LEARNER_SEAT_IDS], [3, 3, 3, 3])
        ids = [card["id"] for hand in first.values() for card in hand]
        self.assertEqual(len(ids), 12); self.assertEqual(len(set(ids)), 12)

    def test_fact_requires_known_source_and_every_card_has_learner_copy(self):
        value = self.repository.load("google-1995-2004")
        for deck in value["decks"]:
            for card in deck["cards"]:
                self.assertIn(card["boundary"], {"F", "R", "G", "U"})
                self.assertTrue(card["title"].strip()); self.assertTrue(card["body"].strip())
                self.assertTrue(card["sharePrompt"].strip())
                if card["boundary"] == "F": self.assertTrue(card["sourceIds"])
        broken = copy.deepcopy(value); fact = next(card for deck in broken["decks"] for card in deck["cards"] if card["boundary"] == "F")
        fact["sourceIds"] = []
        with self.assertRaisesRegex(ValueError, "Fact cards must cite"):
            validate_script(broken)
        broken = copy.deepcopy(value); broken["decks"][0]["cards"][0]["sourceIds"] = ["missing-source"]
        with self.assertRaisesRegex(ValueError, "unknown sources"):
            validate_script(broken)


class AlphaLiveSyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.repository = CourseRepository(self.root / "courses")
        self.controller = CourseController(self.root / "run-state.json", course_repository=self.repository)

    def tearDown(self):
        self.tmp.cleanup()

    def wait_for(self, status):
        for _ in range(100):
            state = self.controller.public_state()
            if state["status"] == status: return state
            time.sleep(0.01)
        self.fail(f"controller did not reach {status}")

    def start_and_accept_first_block(self):
        self.controller.execute_async(); state = self.wait_for("awaiting-acceptance")
        self.assertEqual(state["classroom"]["cardsPerLearner"], [3, 3, 3, 3])
        self.assertEqual(state["classroom"]["uniqueDealtCards"], 12)
        self.controller.accept()

    def test_draft_hot_refresh_preserves_run_progress_economy_and_hands(self):
        self.start_and_accept_first_block()
        before = self.controller.public_state(); run_id = before["runId"]
        deal_ids = copy.deepcopy(before["courseDeals"])
        before["classroom"]["teamTreasuryTenths"] = 321
        self.controller.state["classroom"]["teamTreasuryTenths"] = 321
        edited = self.repository.load("google-1995-2004")
        edited["blocks"][1]["studentPrompt"] = "热刷新后的毛线交换指令。"
        dealt_id = deal_ids["find"]["learner01"][0]
        target = next(card for card in edited["decks"][0]["cards"] if card["id"] == dealt_id)
        target["body"] = "热刷新后的同一张私密卡正文。"
        saved = self.repository.save(edited, status="draft", expected_revision=0)
        pending = self.controller.public_state()["courseUpdate"]
        self.assertTrue(pending["updateAvailable"]); self.assertEqual(pending["latestRevision"], 1)
        refreshed = self.controller.refresh_course()
        self.assertEqual(refreshed["runId"], run_id)
        self.assertEqual(refreshed["currentBlockIndex"], 1)
        self.assertEqual(refreshed["courseDeals"], deal_ids)
        self.assertEqual(refreshed["classroom"]["teamTreasuryTenths"], 321)
        self.assertEqual(refreshed["courseRevision"], saved["authoring"]["revision"])
        self.assertEqual(self.controller.script["blocks"][1]["studentPrompt"], "热刷新后的毛线交换指令。")
        card = next(card for card in refreshed["classroom"]["learnerViews"]["learner01"]["cards"] if card["id"] == dealt_id)
        self.assertEqual(card["body"], "热刷新后的同一张私密卡正文。")
        self.assertFalse(refreshed["courseUpdate"]["updateAvailable"])
        self.assertEqual(refreshed["refreshEpoch"], 1)

    def test_preview_back_forward_changes_all_seats_but_not_execution_data(self):
        self.start_and_accept_first_block()
        before = self.controller.public_state(); blocks = copy.deepcopy(before["blocks"]); deals = copy.deepcopy(before["courseDeals"])
        backed = self.controller.preview_back()
        self.assertEqual(backed["currentBlockIndex"], 1); self.assertEqual(backed["previewBlockIndex"], 0)
        self.assertEqual(backed["blocks"], blocks); self.assertEqual(backed["courseDeals"], deals)
        self.assertTrue(all(seat["blockId"] == "B01" and seat["isPreview"] for seat in backed["seats"]))
        with self.assertRaisesRegex(ValueError, "回看"):
            self.controller.execute_async()
        forward = self.controller.preview_forward()
        self.assertEqual(forward["previewBlockIndex"], 1)
        self.assertTrue(all(seat["blockId"] == "B02" and not seat["isPreview"] for seat in forward["seats"]))

    def test_invalid_latest_file_keeps_last_complete_course(self):
        before_script = copy.deepcopy(self.controller.script); before_digest = self.controller.public_state()["courseDigest"]
        draft = self.root / "courses" / "drafts" / "google-1995-2004.json"
        draft.write_text('{"broken": true}\n')
        with self.assertRaises(ValueError): self.controller.refresh_course()
        after = self.controller.public_state()
        self.assertEqual(self.controller.script, before_script)
        self.assertEqual(after["courseDigest"], before_digest)
        self.assertIsNotNone(after["lastRefreshError"])

    def test_refresh_reconciles_deleted_dealt_card_without_duplicates(self):
        self.controller.execute_async(); before = self.wait_for("awaiting-acceptance")
        removed = before["courseDeals"]["find"]["learner01"][0]
        edited = self.repository.load("google-1995-2004")
        deck = edited["decks"][0]
        replacement = copy.deepcopy(deck["cards"][-1]); replacement["id"] = "find-replacement-unique"
        deck["cards"] = [card for card in deck["cards"] if card["id"] != removed] + [replacement]
        self.repository.save(edited, status="draft", expected_revision=0)
        refreshed = self.controller.refresh_course()
        all_ids = [card_id for hand in refreshed["courseDeals"]["find"].values() for card_id in hand]
        self.assertNotIn(removed, all_ids); self.assertEqual(len(all_ids), 12); self.assertEqual(len(set(all_ids)), 12)

    def test_cloned_course_can_replace_cards_publish_and_start_isolated_run(self):
        cloned = self.repository.clone("google-1995-2004", "custom-history-2012", "自定义历史课")
        cloned["decks"][0]["cards"][0].update({"id": "custom-card-001", "boundary": "U", "title": "U · 自定义未知", "body": "这是克隆课程自己的新线索。", "sharePrompt": "告诉队友还需要调查什么。", "sourceIds": []})
        self.repository.save(cloned, status="published", expected_revision=1)
        selected = self.controller.select_course("custom-history-2012")
        self.assertEqual(selected["courseId"], "custom-history-2012")
        self.controller.execute_async(); state = self.wait_for("awaiting-acceptance")
        dealt = [card["id"] for view in state["classroom"]["learnerViews"].values() for card in view["cards"]]
        self.assertEqual(len(dealt), 12); self.assertEqual(len(set(dealt)), 12)
        # The deck contains exactly twelve cards, so the replacement must be visible.
        self.assertIn("custom-card-001", dealt)


if __name__ == "__main__":
    unittest.main()
