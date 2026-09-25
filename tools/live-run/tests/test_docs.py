import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DocumentationContractTests(unittest.TestCase):
    def test_local_markdown_links_exist(self) -> None:
        for source in [ROOT / "README.md", *(ROOT / "docs").glob("*.md")]:
            text = source.read_text(encoding="utf-8")
            for target in re.findall(r"\[[^]]+\]\(([^)#]+)(?:#[^)]+)?\)", text):
                if "://" in target or target.startswith("mailto:"):
                    continue
                destination = (source.parent / target).resolve()
                self.assertTrue(destination.exists(), f"broken local link in {source}: {target}")

    def test_committed_acceptance_receipts_are_parseable_and_secret_free(self) -> None:
        forbidden = {"password", "cookie", "session", "resettoken", "recoverycode", "token"}

        def walk(value, path="root"):
            if isinstance(value, dict):
                for key, child in value.items():
                    self.assertNotIn(key.lower(), forbidden, f"secret-shaped field at {path}.{key}")
                    walk(child, f"{path}.{key}")
            elif isinstance(value, list):
                for index, child in enumerate(value):
                    walk(child, f"{path}[{index}]")

        real = json.loads((ROOT / "docs/REAL_ACCEPTANCE_RECEIPT.json").read_text(encoding="utf-8"))
        eleme = json.loads((ROOT / "docs/REAL_ACCEPTANCE_ELEME_RECEIPT.json").read_text(encoding="utf-8"))
        browser = json.loads((ROOT / "docs/BROWSER_ACCEPTANCE_RECEIPT.json").read_text(encoding="utf-8"))
        eleme_browser = json.loads((ROOT / "docs/BROWSER_ACCEPTANCE_ELEME_RECEIPT.json").read_text(encoding="utf-8"))
        for receipt_path in (ROOT / "docs").glob("*RECEIPT.json"):
            walk(json.loads(receipt_path.read_text(encoding="utf-8")), receipt_path.name)
        self.assertEqual(real["verified"]["manualBlocks"], 13)
        self.assertTrue(real["verified"]["completed"])
        self.assertEqual(eleme["courseId"], "eleme-2008-find-problem")
        # These historical receipts are retained for audit; the v2 receipt is
        # intentionally pending until a real run is rerun.
        self.assertIn(eleme["verified"]["manualBlocks"], {4, 13})
        self.assertEqual(eleme["verified"]["mentorCount"], 4)
        self.assertEqual(eleme["verified"]["learnerCount"], 4)
        self.assertEqual(eleme["verified"]["uniqueDealtCards"], 12)
        self.assertTrue(eleme["verified"]["completed"])
        self.assertEqual(browser["pageTargets"], 9)
        self.assertTrue(browser["layout"]["noOverlap"])
        self.assertEqual(eleme_browser["courseId"], "eleme-2008-find-problem")
        self.assertIn(eleme_browser["blockCount"], {4, 13})
        self.assertEqual(eleme_browser["pageTargets"], 9)
        self.assertTrue(eleme_browser["layout"]["noOverlap"])
        self.assertTrue(eleme_browser["courseSelector"])

        remote = json.loads((ROOT / "docs/REMOTE_CONSOLE_ACCEPTANCE_RECEIPT.json").read_text(encoding="utf-8"))
        remote_browser = json.loads((ROOT / "docs/REMOTE_CONSOLE_BROWSER_RECEIPT.json").read_text(encoding="utf-8"))
        self.assertEqual(remote["seatCount"], 8)
        self.assertEqual(remote["simulatedBrowsers"], 4)
        self.assertTrue(remote["allSeatsClaimedConcurrently"])
        self.assertEqual(remote["uniquePrivateCards"], 12)
        self.assertTrue(all(item["returnedSeatCount"] == 1 for item in remote["serverSideSeatProjections"]))
        self.assertEqual(remote_browser["seatCards"], 8)
        self.assertTrue(remote_browser["claimRendered"])
        self.assertTrue(remote_browser["releaseRendered"])
        self.assertTrue(remote_browser["mobileViewport"]["noHorizontalOverflow"])


if __name__ == "__main__":
    unittest.main()
