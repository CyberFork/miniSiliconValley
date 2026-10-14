import hashlib
import json
import re
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parents[1]
SHOWCASE = ROOT / "site" / "showcase"
COHORT = SHOWCASE / "2026-09"
MANIFEST = ROOT / "student-showcase-import.json"
GATEWAY = ROOT / "gateway" / "default.conf"
DISPLAY = list(SHOWCASE.rglob("*.html"))

class References(HTMLParser):
    def __init__(self): super().__init__(); self.refs=[]
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in ('src','href','data-src') and v: self.refs.append(v)


class ShowcaseTests(unittest.TestCase):
    def test_fourteen_public_pages_and_names(self):
        # showcase root + cohort + four creator pages + eight wrappers
        students = ("cwe", "tzx", "zrq", "dky")
        pages = [SHOWCASE / "index.html", COHORT / "index.html"] + [COHORT / s / "index.html" for s in students] + [COHORT / s / n / "index.html" for s in students for n in ("play", "slides")]
        self.assertEqual(len(pages), 14)
        for p in pages: self.assertTrue(p.is_file(), p)
        self.assertIn("蔡玮恩", (COHORT / "cwe" / "index.html").read_text())
        self.assertIn("唐梓轩", (COHORT / "tzx" / "index.html").read_text())
        self.assertIn("章睿棋", (COHORT / "zrq" / "index.html").read_text())
        self.assertIn("段柯屹", (COHORT / "dky" / "index.html").read_text())
        self.assertNotIn("蔡玮思", "\n".join(p.read_text() for p in pages))

    def test_local_static_references_exist(self):
        for page in DISPLAY:
            parser = References(); parser.feed(page.read_text())
            text = page.read_text()
            refs = parser.refs
            for ref in refs:
                if ref.startswith(("#", "mailto:", "javascript:", "data:", "http:", "https:")): continue
                target = urlparse(ref).path
                if not target or target == "/": continue
                candidate = SHOWCASE / target.removeprefix("/showcase/") if target.startswith("/showcase/") else (page.parent / target.split("?",1)[0])
                self.assertTrue((candidate.is_file() or (candidate.is_dir() and (candidate / "index.html").is_file())), f"{page}: missing {ref} -> {candidate}")

    def test_wrappers_iframe_contract(self):
        for student in ("cwe", "tzx", "zrq", "dky"):
            for kind, folder in (("game", "play"), ("slides", "slides")):
                text = (COHORT / student / folder / "index.html").read_text()
                self.assertIn(f'data-src="/showcase/2026-09/{student}/runtime/{kind}/index.html"', text)
                self.assertIn('sandbox="allow-scripts allow-pointer-lock"', text)
                self.assertNotIn("allow-same-origin", text)
                self.assertNotIn("allow-top-navigation", text)

    def test_game_runtime_bridge_and_no_remote_cdn(self):
        for student in ("cwe", "tzx", "zrq", "dky"):
            text = (COHORT / student / "runtime" / "game" / "index.html").read_text()
            self.assertIn("/showcase/runtime-bridge.js", text)
            self.assertNotRegex(text, r'''(?:src|href)=["']https?://''')
        self.assertIn("doomsday_endless_v1", (COHORT / "zrq" / "runtime" / "game" / "js" / "data.js").read_text())
        self.assertIn("echofault.save.v1", (COHORT / "dky" / "runtime" / "game" / "index.html").read_text())
        self.assertIn("BUILD v0.22.0", (COHORT / "dky" / "runtime" / "game" / "index.html").read_text())

    def test_published_files_have_allowed_suffixes_and_no_private_markers(self):
        forbidden = ("蔡玮思", "private", ".zip", ".docx", ".pptx", ".md")
        allowed = {".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2", ".mp3", ".wav", ".webp"}
        for p in COHORT.rglob("*"):
            if not p.is_file(): continue
            self.assertIn(p.suffix.lower(), allowed, p)
            data = p.read_bytes()
            text = data.decode("utf-8", "ignore")
            for marker in forbidden:
                if marker.startswith(".") or marker in ("private",):
                    self.assertNotIn(marker, str(p).lower(), p)
                else:
                    self.assertNotIn(marker, text, p)

    def test_import_manifest_hashes(self):
        self.assertTrue(MANIFEST.is_file())
        manifest = json.loads(MANIFEST.read_text())
        records = manifest["publicRuntimeFiles"]
        actual = {p.relative_to(SHOWCASE).as_posix() for s in ("cwe", "tzx", "zrq", "dky") for p in (COHORT / s / "runtime").rglob("*") if p.is_file()}
        self.assertEqual({item.get("path") or item.get("file") for item in records}, actual)
        self.assertEqual(len(records), len(actual))
        for item in records:
            rel = item.get("path") or item.get("file")
            expected = item.get("sha256") or item.get("hash")
            self.assertTrue(rel and expected, item)
            p = SHOWCASE / rel
            self.assertTrue(p.is_file(), rel)
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(), expected, rel)

    def test_gateway_runtime_policy_and_existing_auth_surface(self):
        text = GATEWAY.read_text()
        self.assertRegex(text, r"~\^/showcase/2026-09/\(cwe\|tzx\|zrq\|dky\)/runtime/")
        self.assertIn("map $uri $minisv_csp", text)  # normalized paths: percent encoding cannot bypass sandbox
        self.assertIn("connect-src 'none'", text)
        self.assertIn('sandbox allow-scripts allow-pointer-lock', text)
        self.assertIn("~^/showcase/2026-09/(cwe|tzx|zrq|dky)/runtime/", text)
        self.assertIn("auth_request", text)  # existing protected teacher surfaces remain present
        self.assertIn("/courseware/development-mentor-module-thinking", text)

    def test_existing_cwe_tzx_runtime_files_unchanged(self):
        for student in ("cwe", "tzx"):
            runtime = COHORT / student / "runtime"
            for path in runtime.rglob("*"):
                if not path.is_file():
                    continue
                repo = ROOT.parent.parent
                rel = path.relative_to(repo)
                old = subprocess.run(["git", "show", f"c38065b6dadc6d5831fb136ea6c4029b2395d176:{rel.as_posix()}"], cwd=repo, capture_output=True, check=True).stdout
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), hashlib.sha256(old).hexdigest(), path)

if __name__ == "__main__":
    unittest.main()
