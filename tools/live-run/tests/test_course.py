import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import course  # noqa: E402


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

    def test_macro_step_must_cover_every_block_once(self):
        value = course.load_script(course.DEFAULT_COURSE_ID)
        value["macroSteps"][0]["blocks"][2] = value["macroSteps"][0]["blocks"][1]
        with self.assertRaisesRegex(ValueError, "exactly once"):
            course.validate_script(value)


if __name__ == "__main__":
    unittest.main()
