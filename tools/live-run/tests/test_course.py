import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import course  # noqa: E402

T091_CANDIDATE = ROOT / "courses" / "candidates" / "eleme-2008-product-mentor-t091.json"
T090_CANDIDATE = ROOT / "courses" / "candidates" / "eleme-2008-product-development-t090.json"


class CourseTests(unittest.TestCase):
    def test_bundled_courses_are_complete_and_distinct(self):
        scripts = [course.load_script(item["id"]) for item in course.list_courses()]
        self.assertEqual([len(x["macroSteps"]) for x in scripts], [5, 5])
        self.assertEqual([len(x["blocks"]) for x in scripts], [13, 13])
        self.assertEqual(len({x["id"] for x in scripts}), 2)
        self.assertTrue(all(x["course"]["completeFiveStep"] is True for x in scripts))

    def test_load_returns_isolated_copy(self):
        first = course.load_script(course.DEFAULT_COURSE_ID)
        first["blocks"][0]["title"] = "mutated"
        second = course.load_script(course.DEFAULT_COURSE_ID)
        self.assertNotEqual(second["blocks"][0]["title"], "mutated")

    def test_unknown_course_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "未知课程"):
            course.load_script("../../secret")

    def test_duplicate_block_has_json_path(self):
        value = course.load_script(course.DEFAULT_COURSE_ID)
        value["blocks"][1]["id"] = value["blocks"][0]["id"]
        with self.assertRaisesRegex(ValueError, r"\$\.blocks\[1\]\.id"):
            course.validate_script(value)

    def test_missing_step_is_rejected(self):
        value = course.load_script(course.DEFAULT_COURSE_ID)
        value["macroSteps"].pop()
        with self.assertRaisesRegex(ValueError, r"\$\.macroSteps"):
            course.validate_script(value)

    def test_missing_seat_task_is_rejected(self):
        value = course.load_script(course.DEFAULT_COURSE_ID)
        del value["blocks"][0]["seatTasks"]["learner04"]
        with self.assertRaisesRegex(ValueError, r"\$\.blocks\[0\]\.seatTasks"):
            course.validate_script(value)

    def test_multiple_or_wrong_active_mentors_are_rejected(self):
        value = course.load_script(course.DEFAULT_COURSE_ID)
        value["blocks"][0]["seatTasks"]["mentor02"]["state"] = "active"
        with self.assertRaisesRegex(ValueError, "exactly leadMentorId"):
            course.validate_script(value)

    def test_macro_step_must_cover_every_block_once(self):
        value = course.load_script(course.DEFAULT_COURSE_ID)
        value["macroSteps"][0]["blocks"][2] = value["macroSteps"][0]["blocks"][1]
        with self.assertRaisesRegex(ValueError, "exactly once"):
            course.validate_script(value)

    def test_t091_content_package_relations_fail_closed(self):
        value = json.loads(T091_CANDIDATE.read_text(encoding="utf-8"))
        course.validate_script(value)

        missing_fact = copy.deepcopy(value)
        missing_fact["contentPackages"]["casePackages"][0]["factCardIds"].pop()
        with self.assertRaisesRegex(ValueError, "does not archive F cards"):
            course.validate_script(missing_fact)

        wrong_owner = copy.deepcopy(value)
        wrong_owner["contentPackages"]["scriptPackages"][0]["ownerMentorRole"] = "D"
        with self.assertRaisesRegex(ValueError, "must equal the CasePackage owner"):
            course.validate_script(wrong_owner)

        same_owner_handoff = copy.deepcopy(value)
        same_owner_handoff["contentPackages"]["scriptPackages"][0]["handoff"]["toMentorRole"] = "P"
        with self.assertRaisesRegex(ValueError, "must be another professional mentor"):
            course.validate_script(same_owner_handoff)

        early_handoff = copy.deepcopy(value)
        early_handoff["contentPackages"]["scriptPackages"][0]["handoff"]["availableAtBlockId"] = "B04"
        with self.assertRaisesRegex(ValueError, "must be later than fromBlockId"):
            course.validate_script(early_handoff)

        duplicate_kind = copy.deepcopy(value)
        duplicate = copy.deepcopy(duplicate_kind["contentPackages"]["submissionSchemas"][0])
        duplicate["id"] = "another-product-brief"
        duplicate_kind["contentPackages"]["submissionSchemas"].append(duplicate)
        with self.assertRaisesRegex(ValueError, r"submissionSchemas\[1\]\.kind"):
            course.validate_script(duplicate_kind)

    def test_t090_supports_two_four_and_six_identity_free_learners(self):
        value = json.loads(T090_CANDIDATE.read_text(encoding="utf-8"))
        course.validate_script(value)
        for learner_count in (2, 4, 6):
            hands = course.deal_course_deck(value, "build", learner_count=learner_count)
            self.assertEqual(len(hands), learner_count)
            card_ids = [card["id"] for hand in hands.values() for card in hand]
            self.assertEqual(len(card_ids), learner_count * 2)
            self.assertEqual(len(set(card_ids)), learner_count * 2)
            self.assertTrue(all(card["boundary"] == "R" for hand in hands.values() for card in hand))
        with self.assertRaisesRegex(ValueError, "supports 2 through 6"):
            course.deal_course_deck(value, "build", learner_count=7)

    def test_t090_simulation_and_schema_boundaries_fail_closed(self):
        value = json.loads(T090_CANDIDATE.read_text(encoding="utf-8"))
        simulation = value["contentPackages"]["casePackages"][1]
        self.assertEqual(simulation["caseType"], "simulation")
        self.assertEqual(simulation["sourceIds"], [])
        self.assertEqual(simulation["factCardIds"], [])

        bad_source = copy.deepcopy(value)
        bad_source["contentPackages"]["casePackages"][1]["sourceIds"] = [value["sources"][0]["id"]]
        with self.assertRaisesRegex(ValueError, "simulation sourceIds and factCardIds must be empty"):
            course.validate_script(bad_source)

        duplicate_submit_block = copy.deepcopy(value)
        duplicate_submit_block["contentPackages"]["submissionSchemas"][1]["submitAtBlockId"] = "B04"
        with self.assertRaisesRegex(ValueError, "each Block accepts one structured artifact"):
            course.validate_script(duplicate_submit_block)

        bad_category = copy.deepcopy(value)
        bad_category["decks"][2]["cards"][0]["simulationCategory"] = "history"
        with self.assertRaisesRegex(ValueError, "invalid simulation category"):
            course.validate_script(bad_category)

        for field, invalid_value in (("boundary", "G"), ("sourceIds", [value["sources"][0]["id"]])):
            bad_private_card = copy.deepcopy(value)
            private_deck = bad_private_card["decks"][2]
            card = private_deck["cards"][0]
            card[field] = invalid_value
            card.pop("simulationCategory", None)
            with self.assertRaisesRegex(ValueError, rf"simulation private decks.*{card['id']}"):
                course.validate_script(bad_private_card)


if __name__ == "__main__":
    unittest.main()
