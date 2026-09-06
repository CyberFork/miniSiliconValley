import tempfile
import time
import unittest
import sys
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from controller import CourseController


def wait_until_stopped(controller: CourseController, timeout: float = 3.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = controller.public_state()
        if state["status"] != "executing":
            return state
        time.sleep(0.01)
    raise AssertionError("controller did not stop executing")


class FailOnceAdapter:
    def __init__(self) -> None:
        self.calls = 0
        # CourseController checks this before attempting startup refresh.  A
        # deterministic fake represents a room-less adapter until execute().
        self.room_id = None

    def execute(self, _action, _block):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("deterministic test failure")
        return {"apiBacked": True, "phase": "identity"}

    def configure_alpha_course(self, _course, _course_ref, _run_id):
        """Match the real adapter's pre-execution exact-course binding hook."""
        return None

    def export_refs(self):
        return {"roomId": "test-room", "teamPublicId": "TEAM-TEST", "teamId": "team"}


class ControllerStateMachineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "state.json"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_execute_stops_for_human_acceptance(self) -> None:
        controller = CourseController(self.path)
        controller.execute_async()
        state = wait_until_stopped(controller)
        self.assertEqual(state["status"], "awaiting-acceptance")
        self.assertEqual(state["currentBlockIndex"], 0)
        self.assertEqual(state["blocks"][0]["status"], "awaiting-acceptance")
        self.assertEqual(state["blocks"][1]["status"], "locked")
        time.sleep(0.12)
        self.assertEqual(controller.public_state()["currentBlockIndex"], 0, "must never auto-advance")
        controller.accept()
        state = controller.public_state()
        self.assertEqual(state["currentBlockIndex"], 1)
        self.assertEqual(state["status"], "ready")

    def test_accept_before_execution_is_rejected(self) -> None:
        controller = CourseController(self.path)
        with self.assertRaisesRegex(ValueError, "尚未执行"):
            controller.accept()

    def test_error_is_visible_and_retryable(self) -> None:
        adapter = FailOnceAdapter()
        controller = CourseController(self.path, api_factory=lambda _persisted, _campaign_id: adapter)
        with redirect_stderr(StringIO()):
            controller.execute_async()
            state = wait_until_stopped(controller)
        self.assertEqual(state["status"], "error")
        self.assertIn("deterministic test failure", state["error"])
        with self.assertRaisesRegex(ValueError, "先点击.*错误重试"):
            controller.execute_async()
        controller.retry()
        self.assertEqual(controller.public_state()["status"], "ready")
        controller.execute_async()
        self.assertEqual(wait_until_stopped(controller)["status"], "awaiting-acceptance")

    def test_all_thirteen_simulated_blocks_require_thirteen_accepts(self) -> None:
        controller = CourseController(self.path)
        for index in range(13):
            self.assertEqual(controller.public_state()["currentBlockIndex"], index)
            controller.execute_async()
            self.assertEqual(wait_until_stopped(controller)["status"], "awaiting-acceptance")
            controller.accept()
        state = controller.public_state()
        self.assertEqual(state["status"], "completed")
        self.assertEqual(state["lastCompletedBlockIndex"], 12)
        self.assertTrue(state["classroom"]["completed"])

    def test_persisted_state_is_atomic_and_resumable(self) -> None:
        first = CourseController(self.path)
        first.execute_async()
        wait_until_stopped(first)
        first.accept()
        second = CourseController(self.path)
        self.assertEqual(second.public_state()["currentBlockIndex"], 1)
        self.assertEqual(second.public_state()["blocks"][0]["status"], "passed")
        self.assertEqual(list(self.path.parent.glob(".*.tmp")), [])

    def test_pristine_course_switch_and_persistent_restore(self) -> None:
        controller = CourseController(self.path)
        state = controller.select_course("eleme-2008-find-problem")
        self.assertEqual(state["courseId"], "eleme-2008-find-problem")
        self.assertEqual(len(state["blocks"]), 13)
        self.assertTrue(state["scriptId"])
        restored = CourseController(self.path)
        self.assertEqual(restored.public_state()["courseId"], "eleme-2008-find-problem")

    def test_started_course_requires_confirmed_reset_to_switch(self) -> None:
        controller = CourseController(self.path)
        controller.execute_async()
        self.assertEqual(wait_until_stopped(controller)["status"], "awaiting-acceptance")
        with self.assertRaisesRegex(ValueError, "确认"):
            controller.select_course("eleme-2008-find-problem")
        state = controller.select_course("eleme-2008-find-problem", confirm_reset=True)
        self.assertEqual(state["courseId"], "eleme-2008-find-problem")
        self.assertEqual(state["currentBlockIndex"], 0)
        self.assertEqual(state["status"], "ready")

    def test_eleme_thirteen_blocks_keep_manual_gates_and_reset_keeps_course(self) -> None:
        controller = CourseController(self.path)
        controller.select_course("eleme-2008-find-problem")
        for index in range(13):
            self.assertEqual(controller.public_state()["currentBlockIndex"], index)
            controller.execute_async()
            stopped = wait_until_stopped(controller)
            self.assertEqual(stopped["status"], "awaiting-acceptance")
            self.assertEqual(stopped["currentBlockIndex"], index)
            controller.accept()
        completed = controller.public_state()
        self.assertEqual(completed["status"], "completed")
        self.assertTrue(completed["classroom"]["completed"])
        reset = controller.reset()
        self.assertEqual(reset["courseId"], "eleme-2008-find-problem")
        self.assertEqual(len(reset["blocks"]), 13)
        self.assertEqual(reset["status"], "ready")


if __name__ == "__main__":
    unittest.main()
