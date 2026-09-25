import http.client
import json
import re
import tempfile
import threading
import time
import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from controller import CourseController, LiveRunServer


class HttpContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        controller = CourseController(Path(self.temp.name) / "state.json")
        self.server = LiveRunServer(("127.0.0.1", 0), controller, "test-control-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=4)
        data = None if body is None else json.dumps(body).encode()
        merged = {"Content-Type": "application/json", **(headers or {})}
        connection.request(method, path, data, merged)
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        return response.status, response.getheaders(), payload

    def test_static_assets_and_bootstrap(self) -> None:
        assets = {}
        for path in ("/", "/styles.css", "/controller.js", "/seat.html?seat=learner01", "/seat.css", "/seat.js"):
            status, headers, payload = self.request("GET", path)
            self.assertEqual(status, 200, path)
            self.assertTrue(payload)
            self.assertIn(("Cache-Control", "no-store"), headers)
            assets[path] = payload.decode("utf-8")
        self.assertIn('id="confirmDialog"', assets["/"])
        self.assertIn('aria-labelledby="confirmTitle"', assets["/"])
        self.assertIn('aria-describedby="confirmBody"', assets["/"])
        self.assertIn("askConfirmation", assets["/controller.js"])
        self.assertIsNone(
            re.search(r"\b(?:window\.)?(?:prompt|confirm|alert)\s*\(", assets["/controller.js"]),
            "LIVE RUN controller must not fall back to browser-native dialogs",
        )
        self.assertIn(".confirm-dialog::backdrop", assets["/styles.css"])
        status, _, payload = self.request("GET", "/api/bootstrap")
        data = json.loads(payload)["data"]
        self.assertEqual(status, 200)
        self.assertEqual(data["token"], "test-control-token")
        self.assertEqual(len(data["script"]["blocks"]), 13)
        self.assertEqual(sorted(item["id"] for item in data["courseCatalog"]), [
            "eleme-2008-find-problem", "google-1995-2004",
        ])

    def test_retired_run_launcher_redirects_to_the_live_controller(self) -> None:
        status, headers, payload = self.request("GET", "/run-launcher.html?run=old-bookmark")
        self.assertEqual(status, 307)
        self.assertIn(("Location", "/"), headers)
        self.assertIn(("Cache-Control", "no-store"), headers)
        self.assertEqual(payload, b"")

    def test_control_requires_loopback_same_origin_and_token(self) -> None:
        status, _, _ = self.request("POST", "/api/control", {"action": "execute"})
        self.assertEqual(status, 403)
        headers = {"X-Live-Run-Token": "test-control-token", "Origin": "https://evil.example"}
        status, _, _ = self.request("POST", "/api/control", {"action": "execute"}, headers)
        self.assertEqual(status, 403)

    def test_execute_then_accept_manual_gate_over_http(self) -> None:
        headers = {"X-Live-Run-Token": "test-control-token", "Origin": f"http://127.0.0.1:{self.port}"}
        status, _, _ = self.request("POST", "/api/control", {"action": "execute"}, headers)
        self.assertEqual(status, 202)
        deadline = time.monotonic() + 3
        while True:
            _, _, payload = self.request("GET", "/api/state")
            state = json.loads(payload)["data"]
            if state["status"] != "executing" or time.monotonic() > deadline:
                break
            time.sleep(0.01)
        self.assertEqual(state["status"], "awaiting-acceptance")
        self.assertEqual(state["currentBlockIndex"], 0)
        status, _, payload = self.request("POST", "/api/control", {"action": "accept"}, headers)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["data"]["currentBlockIndex"], 1)

    def test_course_selection_is_server_validated_and_script_stays_in_sync(self) -> None:
        headers = {"X-Live-Run-Token": "test-control-token", "Origin": f"http://127.0.0.1:{self.port}"}
        status, _, payload = self.request("POST", "/api/control", {
            "action": "select-course", "courseId": "eleme-2008-find-problem", "confirmReset": False,
        }, headers)
        self.assertEqual(status, 200)
        state = json.loads(payload)["data"]
        self.assertEqual(state["courseId"], "eleme-2008-find-problem")
        self.assertEqual(len(state["blocks"]), 13)
        self.assertTrue(all(seat["blockCount"] == 13 for seat in state["seats"]))
        status, _, payload = self.request("GET", "/api/script")
        script = json.loads(payload)["data"]
        self.assertEqual(status, 200)
        self.assertEqual(script["id"], state["scriptId"])
        self.assertEqual(script["case"]["campaignId"], state["courseId"])

        status, _, payload = self.request("POST", "/api/control", {
            "action": "select-course", "courseId": "not-a-course",
        }, headers)
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(payload)["error"]["code"], "CONTROL_STATE_INVALID")


if __name__ == "__main__":
    unittest.main()
