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
HOST = SHOWCASE / "host.js"
STYLES = SHOWCASE / "showcase.css"
DISPLAY = list(SHOWCASE.rglob("*.html"))

class References(HTMLParser):
    def __init__(self): super().__init__(); self.refs=[]
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in ('src','href','data-src') and v: self.refs.append(v)


class ShowcaseCards(HTMLParser):
    """Collect the small, deliberately rigid public card contract."""
    def __init__(self):
        super().__init__()
        self.cards = []
        self._card = None
        self._depth = 0
        self._child = None
        self._link_text = None

    def handle_starttag(self, tag, attrs):
        attrs = tuple(sorted((k, v or "") for k, v in attrs))
        if self._card is None:
            if tag == "article" and "card" in dict(attrs).get("class", "").split():
                self._card = []
                self._depth = 1
            return
        self._depth += 1
        if self._depth == 2:
            self._child = [tag, attrs, [], []]
        elif self._child is not None:
            self._child[3].append(("start", tag, attrs))
            if tag == "a":
                self._link_text = []

    def handle_data(self, data):
        if self._child is not None:
            self._child[2].append(data)
            if self._link_text is not None:
                self._link_text.append(data)

    def handle_endtag(self, tag):
        if self._card is None:
            return
        if self._depth == 2 and self._child is not None:
            tag_name, attrs, text, nested = self._child
            self._card.append((tag_name, attrs, " ".join("".join(text).split()), tuple(nested)))
            self._child = None
        elif self._link_text is not None and tag == "a":
            kind, name, attrs = self._child[3][-1]
            self._child[3][-1] = (kind, name, attrs, "".join(self._link_text).strip())
            self._link_text = None
        self._depth -= 1
        if self._depth == 0:
            self.cards.append(tuple(self._card))
            self._card = None


class ShowcaseTests(unittest.TestCase):
    def test_student_showcase_cards_have_one_shared_contract(self):
        students = ("cwe", "tzx", "zrq", "dky")
        pages = [SHOWCASE / "index.html", COHORT / "index.html"]
        parsed = []
        for page in pages:
            parser = ShowcaseCards()
            parser.feed(page.read_text())
            self.assertEqual(len(parser.cards), 4, page)
            for card in parser.cards:
                self.assertEqual([child[0] for child in card], ["p", "h2", "p", "div"], page)
                self.assertEqual(card[0][1], (("class", "eyebrow"),), page)
                self.assertEqual(card[3][1], (("class", "actions"),), page)
                self.assertEqual([event[1] for event in card[3][3]], ["a", "a"], page)
                self.assertEqual([dict(event[2]).get("class") for event in card[3][3]], ["btn", "btn"], page)
                self.assertEqual([event[3] for event in card[3][3]], ["试玩游戏", "看路演"], page)
            parsed.append(parser.cards)
        self.assertEqual(parsed[0], parsed[1])
        expected = {
            student: (f"/showcase/2026-09/{student}/play/", f"/showcase/2026-09/{student}/slides/")
            for student in students
        }
        for card in parsed[0]:
            hrefs = tuple(dict(event[2])["href"] for event in card[3][3])
            self.assertIn(hrefs, expected.values())
        self.assertEqual({hrefs for hrefs in expected.values()},
                         {tuple(dict(event[2])["href"] for event in card[3][3]) for card in parsed[0]})

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
                # Query-only links (for example ?view=game) must resolve
                # against the containing page; existence checks only use path.
                parsed_ref = urlparse(ref)
                target = parsed_ref.path
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
                if kind == 'game':
                    pure = re.search(r'<a\b[^>]*href="\?view=game"[^>]*>', text)
                    self.assertIsNotNone(pure, f"{student} play page missing pure-game link")
                    self.assertIn('target="_blank"', pure.group(0))
                    self.assertIn('rel="noopener"', pure.group(0))
                    self.assertIn("纯游戏窗口", text)

    def test_pure_play_host_and_fullscreen_contract(self):
        host = HOST.read_text()
        self.assertIn("URLSearchParams", host)
        self.assertIn("const purePlay = kind === 'game' &&", host)
        self.assertIn("/play/?view=game", host)
        self.assertRegex(host, r"URLSearchParams\([^)]*location\.search[^)]*\).*get\([\"\']view")
        self.assertRegex(host, r"get\([\"\']view[\"\']\)\s*===\s*[\"\']game")
        self.assertRegex(host, r"classList\.add\([\"\']pure-play[\"\']\)")
        self.assertIn("location.origin + location.pathname", host)
        css = STYLES.read_text()
        self.assertRegex(css, r"\.pure-play #student-frame\s*\{[^}]*position:fixed")
        self.assertRegex(css, r"\.pure-play #student-frame\s*\{[^}]*inset:0")
        self.assertRegex(css, r"\.pure-play #student-frame\s*\{[^}]*height:100dvh")

    def test_game_runtime_bridge_and_no_remote_cdn(self):
        for student in ("cwe", "tzx", "zrq", "dky"):
            text = (COHORT / student / "runtime" / "game" / "index.html").read_text()
            self.assertIn("/showcase/runtime-bridge.js", text)
            self.assertNotRegex(text, r'''(?:src|href)=["']https?://''')
        self.assertIn("doomsday_endless_v1", (COHORT / "zrq" / "runtime" / "game" / "js" / "data.js").read_text())
        self.assertIn("echofault.save.v1", (COHORT / "dky" / "runtime" / "game" / "index.html").read_text())
        self.assertIn("BUILD v0.22.0", (COHORT / "dky" / "runtime" / "game" / "index.html").read_text())

    def test_zrq_video_fullscreen_contract(self):
        text = (COHORT / "zrq/runtime/slides/index.html").read_text()
        self.assertIn('id="video-fullscreen"', text)
        self.assertIn('await video.requestFullscreen()', text)
        self.assertIn('video.webkitEnterFullscreen()', text)
        self.assertIn("demo.preload = 'metadata'", text)
        self.assertIn("if (currentSlide !== 11) demo.pause()", text)
        self.assertIn("else if (!demo.dataset.prepared)", text)
        self.assertIn("#game-demo:fullscreen", text)
        self.assertIn("video, #video-fullscreen", text)

    def test_zrq_bag_handlers_use_ui(self):
        html = (COHORT / "zrq" / "runtime" / "game" / "index.html").read_text()
        ui = (COHORT / "zrq" / "runtime" / "game" / "js" / "ui.js").read_text()
        self.assertRegex(html, r"onclick=\"UI\.bagTab\\?\(\\?'bag'\\?\)")
        self.assertRegex(html, r"onclick=\"UI\.bagTab\\?\(\\?'craft'\\?\)")
        self.assertNotIn("Game.bagTab", html)
        self.assertRegex(ui, r"\bbagTab\s*\(t\)")

    def test_published_files_have_allowed_suffixes_and_no_private_markers(self):
        forbidden = ("蔡玮思", "private", ".zip", ".docx", ".pptx", ".md")
        allowed = {".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2", ".mp3", ".wav", ".webp", ".mp4"}
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

    def test_runtime_slides_video_contract(self):
        expected_pages = {"cwe": 10, "tzx": 10, "zrq": 12, "dky": 10}
        for student, pages in expected_pages.items():
            slides = COHORT / student / "runtime" / "slides"
            text = (slides / "index.html").read_text()
            self.assertIn('id="game-demo"', text, student)
            self.assertIn('controls playsinline preload="none" poster="game-demo.jpg"', text, student)
            self.assertIn('<source src="game-demo.mp4" type="video/mp4">', text, student)
            self.assertNotRegex(text, r"<video[^>]*\bautoplay\b", student)
            self.assertTrue((slides / "game-demo.mp4").is_file(), student)
            self.assertTrue((slides / "game-demo.jpg").is_file(), student)
            self.assertIn(f"{pages}", text, student)
            self.assertEqual(len(re.findall(r'id="game-demo"', text)), 1, student)
            if student == "cwe":
                self.assertRegex(text, r'(?s)<section[^>]+data-index="9"[^>]*>(?:(?!</section>).)*id="game-demo"', student)
            elif student == "tzx":
                self.assertRegex(text, r'(?s)<section[^>]+data-slide="9"[^>]*>(?:(?!</section>).)*id="game-demo"', student)
            elif student == "zrq":
                self.assertRegex(text, r'(?s)<section[^>]+id="slide-11"[^>]*>(?:(?!</section>).)*id="game-demo"', student)
                self.assertIn('id="slide-12"', text, student)
                self.assertNotIn('id="slide-13"', text, student)
                self.assertNotIn("演示画面放这里", text, student)
                self.assertNotIn("发布会时替换成游戏实录", text, student)
            elif student == "dky":
                self.assertIn('video-page', text, student)
                self.assertIn('hidden=n!==9', text, student)

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
                if path.parent.name == "slides" and path.name in {"index.html", "game-demo.mp4", "game-demo.jpg"}:
                    continue
                repo = ROOT.parent.parent
                rel = path.relative_to(repo)
                old = subprocess.run(["git", "show", f"c38065b6dadc6d5831fb136ea6c4029b2395d176:{rel.as_posix()}"], cwd=repo, capture_output=True, check=True).stdout
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), hashlib.sha256(old).hexdigest(), path)

if __name__ == "__main__":
    unittest.main()
