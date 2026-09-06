from __future__ import annotations

import importlib.util
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MODULE_PATH = ROOT / "package_release.py"
SPEC = importlib.util.spec_from_file_location("package_release", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class UiThemeContractTests(unittest.TestCase):
    @staticmethod
    def site_root() -> Path:
        source_site = ROOT / "site"
        return source_site if source_site.is_dir() else ROOT.parent / "site"

    @staticmethod
    def live_run_root() -> Path:
        for candidate in (ROOT, *ROOT.parents):
            source_live_run = candidate / "tools" / "live-run"
            if source_live_run.is_dir():
                return source_live_run
            release_live_run = candidate / "live-run"
            if release_live_run.is_dir() and (candidate / "site").is_dir():
                return release_live_run
        raise FileNotFoundError("live-run source/release root not found")

    def test_release_injection_is_idempotent(self) -> None:
        html = "<!doctype html><html><head><title>x</title></head><body></body></html>"
        once = MODULE.inject_theme_assets(html)
        twice = MODULE.inject_theme_assets(once)

        self.assertEqual(once, twice)
        self.assertEqual(once.count('/ui-theme.css'), 1)
        self.assertEqual(once.count('/ui-theme.js'), 1)
        self.assertLess(once.index('/ui-theme.css'), once.index('</head>'))

    def test_every_live_run_surface_loads_the_shared_switch(self) -> None:
        live_run = self.live_run_root()
        surfaces = (
            live_run / "static" / "index.html",
            live_run / "static" / "editor.html",
            live_run / "static" / "seat.html",
            live_run / "remote-console" / "static" / "index.html",
            live_run / "remote-console" / "static" / "seat-loading.html",
        )
        for surface in surfaces:
            with self.subTest(surface=str(surface)):
                html = surface.read_text()
                self.assertIn('/ui-theme.css', html)
                self.assertIn('/ui-theme.js', html)

    def test_theme_copy_has_two_clear_human_labels(self) -> None:
        script = (self.site_root() / "ui-theme.js").read_text()
        for value in ('"classic"', '"adventure"', '"当前"', '"冒险"'):
            self.assertIn(value, script)
        self.assertIn('aria-pressed', script)
        self.assertIn('ArrowLeft', script)
        self.assertIn('ArrowRight', script)

    def test_topbar_pages_use_a_non_overlapping_theme_rail(self) -> None:
        script = (self.site_root() / "ui-theme.js").read_text()
        styles = (self.site_root() / "ui-theme.css").read_text()
        self.assertIn('msv-ui-switch-rail', script)
        self.assertIn('document.body.appendChild(rail)', script)
        self.assertIn('data-msv-ui-dock', styles)
        self.assertIn('.msv-ui-switch-rail', styles)
        self.assertIn('body:has(.modal-backdrop)', styles)
        self.assertNotIn('floating-belowbar', script + styles)

    def test_adventure_hero_is_skin_only_and_cannot_change_geometry(self) -> None:
        styles = (self.site_root() / "ui-theme.css").read_text()
        match = re.search(r'html\[data-msv-theme="adventure"\] \.hero-card\s*\{([^}]+)\}', styles)
        self.assertIsNotNone(match)
        rule = match.group(1)
        for property_name in ("width", "height", "padding", "margin", "display", "place-items", "text-align", "overflow", "transform"):
            with self.subTest(property=property_name):
                self.assertNotRegex(rule, rf"(?:^|[;\s]){re.escape(property_name)}\s*:")
        self.assertIn("background:", rule)
        self.assertIn("outline:", rule)


if __name__ == "__main__":
    unittest.main()
