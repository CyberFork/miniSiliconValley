from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


class GatewayContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.gateway = (ROOT / "gateway" / "default.conf").read_text()
        cls.proxy = (ROOT / "gateway" / "app-proxy.conf").read_text()
        cls.tunnel = (ROOT / "cloudflared" / "config.yml.template").read_text()

    def test_every_public_route_has_an_explicit_owner(self) -> None:
        for route in ("world", "alpha", "control", "framework", "parents", "workshop"):
            self.assertRegex(self.gateway, rf"location[^\n]* /{route}(?:[ /{{])")
        self.assertIn("^/(classroom|account)", self.gateway)

    def test_all_origins_are_loopback_and_windows_is_not_a_dependency(self) -> None:
        combined = self.gateway + self.tunnel
        self.assertNotIn("192.168.", combined)
        self.assertNotIn("18765", combined)
        self.assertIn("127.0.0.1:18780", self.tunnel)
        for port in (18787, 18789, 18790, 18791):
            self.assertIn(f":{port}", self.gateway)

    def test_gateway_preserves_strict_security_boundary(self) -> None:
        for header in (
            "Strict-Transport-Security", "Content-Security-Policy",
            "X-Content-Type-Options", "X-Frame-Options", "no-transform",
        ):
            self.assertIn(header, self.gateway)
        self.assertIn('proxy_set_header Authorization ""', self.gateway)
        self.assertNotIn("X-Live-Run-Service-Key", self.gateway)
        self.assertIn('$http_x_forwarded_proto = "http"', self.gateway)
        self.assertIn("return 308 https://minisv.vip$request_uri", self.gateway)

    def test_old_origin_exists_only_in_internal_classroom_adapter(self) -> None:
        self.assertNotIn("work.cyberforker.com", self.gateway)
        self.assertIn("work.cyberforker.com", self.proxy)

    def test_portal_reports_live_hecate_health_instead_of_static_status(self) -> None:
        site = ROOT / "site"
        if not site.is_dir():
            site = ROOT.parent / "site"
        portal = (site / "index.html").read_text()
        script = (site / "portal.js").read_text()
        self.assertIn('src="/portal.js"', portal)
        self.assertIn('data-health-state="checking"', portal)
        self.assertIn('requestJson("/healthz")', script)
        self.assertIn('requestJson("/release.json")', script)
        self.assertIn('health.origin !== "hecate"', script)
        self.assertIn("location = /portal.js", self.gateway)
        self.assertNotIn("静态导航", portal)


if __name__ == "__main__":
    unittest.main()
