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
        html = "<!doctype html><html data-msv-theme=\"classic\"><head><title>x</title></head><body><div data-msv-theme-slot></div></body></html>"
        once = MODULE.inject_theme_assets(html)
        twice = MODULE.inject_theme_assets(once)

        self.assertEqual(once, twice)
        self.assertEqual(once.count('/ui-theme.css'), 1)
        self.assertEqual(once.count('/ui-theme.js'), 1)
        self.assertEqual(once.count('data-msv-theme="adventure"'), 1)
        self.assertNotIn('data-msv-theme="classic"', once)
        self.assertNotIn('data-msv-theme-slot', once)
        self.assertLess(once.index('/ui-theme.css'), once.index('</head>'))

    def test_every_live_run_surface_loads_the_canonical_adventure_skin(self) -> None:
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
                self.assertIn('data-msv-theme="adventure"', html)
                self.assertNotIn('data-msv-theme-slot', html)

    def test_theme_runtime_forces_adventure_without_rendering_a_switch(self) -> None:
        script = (self.site_root() / "ui-theme.js").read_text()
        styles = (self.site_root() / "ui-theme.css").read_text()
        self.assertIn('root.dataset.msvTheme = "adventure"', script)
        self.assertIn('window.localStorage.removeItem(LEGACY_STORAGE_KEY)', script)
        self.assertNotIn('window.localStorage.getItem', script)
        self.assertNotIn('window.localStorage.setItem', script)
        self.assertNotIn('makeButton', script)
        self.assertNotIn('mountSwitcher', script)
        self.assertNotIn('msv-ui-switch', styles)

    def test_course_editor_has_no_retired_slot_and_keeps_responsive_layout(self) -> None:
        live_run = self.live_run_root()
        html = (live_run / "static" / "editor.html").read_text()
        styles = (live_run / "static" / "editor.css").read_text()
        script = (live_run / "static" / "editor.js").read_text()
        self.assertNotIn("data-msv-theme-slot", html)
        self.assertIn(".topbar-actions", styles)
        self.assertIn("container:course-workspace / inline-size", styles)
        self.assertIn("@container course-workspace (max-width:780px)", styles)
        self.assertIn(".studio>*{min-width:0;max-width:100%}", styles)
        self.assertIn("[hidden]{display:none!important}", styles)

        # T-079: one course-list DOM is disclosed as a real desktop rail or a
        # modal drawer.  Selection, revision and unsaved state therefore stay
        # in the same editor instance instead of being copied into a second UI.
        self.assertEqual(html.count('id="courseList"'), 1)
        for marker in ('id="courseLibrary"', 'id="libraryContent"', 'id="topbarLibrary"', 'id="libraryBackdrop"'):
            self.assertIn(marker, html)
        self.assertIn('aria-controls="libraryContent"', html)
        self.assertIn('min-width:1041px', styles)
        self.assertIn('width:min(380px,88vw)', styles)
        self.assertIn('minisv.course-editor.library-collapsed', script)
        self.assertIn('event.key === "Escape"', script)
        self.assertIn('libraryReturnFocus.focus()', script)

        # T-080: card authoring has an in-context, sticky action whose true
        # transaction boundary is the complete immutable Candidate package.
        self.assertIn('class="card-context-save"', script)
        self.assertIn('data-save-context', script)
        self.assertIn('保存整门 Course Package', script)
        self.assertIn('不会自动刷新 Alpha', script)
        self.assertIn('.card-context-save{position:sticky', styles)
        self.assertIn('saveError = error.message', script)

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
