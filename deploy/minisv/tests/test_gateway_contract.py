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
        self.assertIn("^/(studio|course|classroom|account)", self.gateway)
        self.assertIn("/courseware/product-mentor-foundations/", self.gateway)

    def test_all_origins_are_loopback_and_windows_is_not_a_dependency(self) -> None:
        combined = self.gateway + self.tunnel
        self.assertNotIn("192.168.", combined)
        self.assertNotIn("18765", combined)
        self.assertIn("127.0.0.1:18780", self.tunnel)
        for port in (18787, 18789):
            self.assertIn(f":{port}", self.gateway)
        for retired in (18790, 18791):
            self.assertNotIn(f":{retired}", self.gateway)

    def test_classroom_launchd_follows_the_same_unified_release_symlink(self) -> None:
        plist = (ROOT / "launchd" / "com.cyberforker.msv-classroom.plist").read_text()
        self.assertIn("__HOME__/Services/minisv/current/app/dist/server/wrangler.json", plist)
        self.assertIn("__HOME__/Services/minisv/current/app/dist/server", plist)
        self.assertIn("__HOME__/Services/msv-classroom/data", plist)
        self.assertNotIn("Services/msv-classroom/current", plist)
        self.assertNotIn("192.168.", plist)

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

    def test_global_alpha_and_control_are_gone(self) -> None:
        self.assertRegex(self.gateway, r"location = /alpha \{ return 410;")
        self.assertRegex(self.gateway, r"location = /control \{ return 410;")
        self.assertNotIn("minisv_alpha_backend", self.gateway)
        self.assertNotIn("minisv_control_backend", self.gateway)
        self.assertNotIn("location ^~ /alpha/", self.gateway)
        self.assertNotIn("location ^~ /control/", self.gateway)

    def test_classroom_adapter_is_native_to_the_public_origin(self) -> None:
        self.assertNotIn("work.cyberforker.com", self.gateway)
        self.assertNotIn("work.cyberforker.com", self.proxy)
        self.assertNotIn("/msv/demo/app", self.proxy)
        self.assertIn("proxy_set_header Host minisv.vip", self.proxy)
        self.assertIn("proxy_set_header X-Forwarded-Host minisv.vip", self.proxy)
        route = re.search(r"location ~ \^/\(studio\|course\|classroom\|account\)\(/\.\*\)\?\$ \{(.*?)\n    \}", self.gateway, re.DOTALL)
        self.assertIsNotNone(route)
        self.assertIn("set $app_path $uri;", route.group(1))
        self.assertNotIn("set $app_path /$1;", route.group(1))

    def test_upstream_receives_the_real_browser_origin_for_csrf_validation(self) -> None:
        self.assertIn("proxy_set_header Origin $http_origin;", self.proxy)
        self.assertNotIn("proxy_set_header Origin https://minisv.vip;", self.proxy)

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

    def test_public_portal_exposes_courseware_classroom_and_studio(self) -> None:
        site = ROOT / "site"
        portal = (site / "index.html").read_text()
        healthcheck = (ROOT / "scripts" / "healthcheck-hecate.sh").read_text()
        self.assertIn('<a href="/course/">导师课件</a>', portal)
        self.assertIn('class="route route-course" href="/course/"', portal)
        self.assertIn('href="/studio/"', portal)
        self.assertIn("(studio|course|classroom|account)", self.gateway)
        self.assertIn("/courseware/product-mentor-foundations/index.html", self.gateway)
        self.assertIn("probe /course/ 307", healthcheck)
        self.assertIn("probe /studio/ 307", healthcheck)

    def test_retired_numeric_entry_redirects_to_framework_with_both_slash_forms(self) -> None:
        self.assertRegex(self.gateway, r"location = /123456 \{ return 308 /framework/")
        self.assertRegex(self.gateway, r"location = /123456/ \{ return 308 /framework/")

    def test_map_hotspot_interaction_lifts_active_tooltip(self) -> None:
        css = (ROOT.parent.parent / "app" / "globals.css").read_text()
        self.assertRegex(css, r"\.map-hotspot:hover,\s*\.map-hotspot:focus-visible,\s*\.map-hotspot:active")
        self.assertIn("z-index: 30", css)

    def test_global_ui_comparison_assets_are_served_and_injected(self) -> None:
        site = ROOT / "site"
        if not site.is_dir():
            site = ROOT.parent / "site"
        portal = (site / "index.html").read_text()
        theme_css = (site / "ui-theme.css").read_text()
        theme_js = (site / "ui-theme.js").read_text()

        self.assertIn('href="/ui-theme.css?v=', portal)
        self.assertIn('src="/ui-theme.js?v=', portal)
        self.assertIn("data-msv-theme-slot", portal)
        self.assertIn('location = /ui-theme.css', self.gateway)
        self.assertIn('location = /ui-theme.js', self.gateway)
        self.assertIn('sub_filter \'</head>\'', self.proxy)
        self.assertIn('data-msv-theme="adventure"', theme_css)
        self.assertIn('[class*="_authCard_"]', theme_css)
        self.assertNotIn('overflow-x: clip', theme_css)
        self.assertNotIn('msv-ui-switch-rail', theme_css + theme_js)
        self.assertIn('dataset.placement = "floating"', theme_js)
        self.assertIn('minisv.ui.theme', theme_js)
        self.assertNotIn("work.cyberforker.com", theme_css + theme_js)

        portal_version = re.search(r'/ui-theme\.js\?v=([A-Za-z0-9._-]+)', portal)
        proxy_version = re.search(r'/ui-theme\.js\?v=([A-Za-z0-9._-]+)', self.proxy)
        self.assertIsNotNone(portal_version)
        self.assertIsNotNone(proxy_version)
        self.assertEqual(portal_version.group(1), proxy_version.group(1), "静态页与 Classroom 必须命中同一套 UI runtime")


if __name__ == "__main__":
    unittest.main()
