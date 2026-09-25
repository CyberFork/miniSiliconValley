from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class HecateProductionContractTests(unittest.TestCase):
    def test_current_operator_guides_use_only_the_canonical_domain(self) -> None:
        guides = [ROOT / "README.md", ROOT / "remote-console" / "README.md"]
        for guide in guides:
            text = guide.read_text(encoding="utf-8")
            self.assertIn("https://minisv.vip/", text)
            self.assertNotIn("work.cyberforker.com", text)
            self.assertNotIn("192.168.50.243", text)

    def test_retired_windows_and_reverse_tunnel_commands_fail_closed(self) -> None:
        tombstones = [
            ROOT / "remote-console" / "controller-tunnel.sh",
            ROOT / "remote-console" / "deploy-windows.sh",
            ROOT / "windows" / "launch_remote_grid.ps1",
            ROOT / "remote-console" / "windows" / "install-release.ps1",
            ROOT / "remote-console" / "windows" / "rollback-console.ps1",
            ROOT / "remote-console" / "windows" / "run-console.ps1",
        ]
        for tombstone in tombstones:
            text = tombstone.read_text(encoding="utf-8")
            self.assertIn("RETIRED", text)
            self.assertIn("https://minisv.vip/", text)
            self.assertNotIn("192.168.", text)
            self.assertNotIn("127.0.0.1:18765", text)

    def test_old_receipts_are_explicitly_classified_as_history(self) -> None:
        policy = (ROOT / "docs" / "HISTORICAL-RECEIPTS.md").read_text(encoding="utf-8")
        self.assertIn("不可改写", policy)
        self.assertIn("不是当前入口", policy)
        self.assertIn("唯一生产节点：Hecate", policy)


if __name__ == "__main__":
    unittest.main()
