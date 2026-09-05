import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from controller import CourseController, LiveRunServer, SessionAuthorizer  # noqa: E402


class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        role = None
        cookie = self.headers.get("Cookie", "")
        for candidate in ("admin", "mentor", "learner"):
            if f"session={candidate}" in cookie:
                role = candidate
        body = ({"ok": True, "data": {"user": {"role": role}}} if role else
                {"ok": False, "error": {"code": "AUTH_REQUIRED"}})
        raw = json.dumps(body).encode()
        self.send_response(200 if role else 401)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers(); self.wfile.write(raw)

    def log_message(self, *_):
        return


class ControllerSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.auth = ThreadingHTTPServer(("127.0.0.1", 0), AuthHandler)
        cls.auth_thread = threading.Thread(target=cls.auth.serve_forever, daemon=True); cls.auth_thread.start()
        key_path = Path(cls.tmp.name) / "service.key"
        key_path.write_text("s" * 48); os.chmod(key_path, 0o600)
        cls.service_key = "s" * 48
        controller = CourseController(Path(cls.tmp.name) / "state" / "run-state.json")
        authorizer = SessionAuthorizer(f"http://127.0.0.1:{cls.auth.server_port}/session", key_path, cache_seconds=0)
        cls.server = LiveRunServer(("127.0.0.1", 0), controller, "control-token", authorizer=authorizer,
                                   public_origin="https://minisv.vip", public_base="/control/", login_path="/auth/login")
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close()
        cls.auth.shutdown(); cls.auth.server_close(); cls.tmp.cleanup()

    def request(self, method, path, *, headers=None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        actual = {"Host": "minisv.vip", **(headers or {})}
        payload = None if body is None else json.dumps(body)
        if payload is not None: actual["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=actual)
        response = conn.getresponse(); raw = response.read(); headers_out = dict(response.getheaders()); conn.close()
        data = json.loads(raw) if raw and headers_out.get("Content-Type", "").startswith("application/json") else raw
        return response.status, headers_out, data

    def test_health_is_public_but_state_is_not(self):
        self.assertEqual(self.request("GET", "/healthz")[0], 200)
        status, _, body = self.request("GET", "/api/state")
        self.assertEqual(status, 401); self.assertEqual(body["error"]["code"], "AUTH_REQUIRED")

    def test_page_redirects_to_first_party_login_without_basic_auth(self):
        status, headers, _ = self.request("GET", "/")
        self.assertEqual(status, 303)
        self.assertEqual(headers["Location"], "/auth/login?returnTo=/control/")
        self.assertNotIn("WWW-Authenticate", headers)

    def test_learner_is_denied_and_mentor_gets_bootstrap(self):
        status, _, body = self.request("GET", "/api/bootstrap", headers={"Cookie": "__Secure-msv_session=x; session=learner"})
        self.assertEqual(status, 403); self.assertNotIn("token", body.get("data", {}))
        status, _, body = self.request("GET", "/api/bootstrap", headers={"Cookie": "__Secure-msv_session=x; session=mentor"})
        self.assertEqual(status, 200); self.assertEqual(body["data"]["token"], "control-token")

    def test_service_key_has_read_only_scope(self):
        headers = {"X-Live-Run-Service-Key": self.service_key}
        self.assertEqual(self.request("GET", "/api/state", headers=headers)[0], 200)
        status, _, body = self.request("GET", "/api/bootstrap", headers=headers)
        self.assertEqual(status, 403); self.assertNotIn("token", body.get("data", {}))
        self.assertEqual(self.request("GET", "/api/state", headers={"X-Live-Run-Service-Key": "bad"})[0], 401)

    def test_control_requires_rbac_token_and_exact_origin(self):
        base = {"Cookie": "__Secure-msv_session=x; session=admin", "X-Live-Run-Token": "control-token"}
        self.assertEqual(self.request("POST", "/api/control", headers={**base, "Origin": "https://evil.example"}, body={"action":"reset"})[0], 403)
        self.assertEqual(self.request("POST", "/api/control", headers={**base, "Origin": "https://minisv.vip"}, body={"action":"reset"})[0], 200)
        service = {"X-Live-Run-Service-Key": self.service_key, "X-Live-Run-Token": "control-token", "Origin": "https://minisv.vip"}
        self.assertEqual(self.request("POST", "/api/control", headers=service, body={"action":"reset"})[0], 403)

    def test_controller_assets_are_subpath_safe(self):
        html = (ROOT / "static/index.html").read_text()
        js = (ROOT / "static/controller.js").read_text()
        self.assertIn('href="styles.css"', html); self.assertIn('src="controller.js"', html)
        self.assertNotIn('fetch("/api/', js); self.assertIn('new URL(".", window.location.href)', js)


if __name__ == "__main__":
    unittest.main()
