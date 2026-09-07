from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


class DeployScriptContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.script = (ROOT / "scripts" / "deploy-hecate.sh").read_text()

    def test_launch_agents_use_bounded_bootstrap_retry(self) -> None:
        self.assertIn("bootstrap_agent()", self.script)
        self.assertIn("for attempt in {1..10}", self.script)
        self.assertIn('launchctl print "$DOMAIN/$label"', self.script)
        self.assertIn("failed to bootstrap $label after 10 attempts", self.script)
        for label in (
            "com.minisv.live-run-controller",
            "com.minisv.remote-console",
            "com.minisv.cloudflared",
        ):
            self.assertIn(f"bootstrap_agent {label}", self.script)

    def test_tunnel_restarts_after_local_stack_and_is_health_checked(self) -> None:
        gateway = self.script.index('$DOCKER compose -f compose.yml up -d --force-recreate gateway')
        tunnel = self.script.index("bootstrap_agent com.minisv.cloudflared")
        self.assertLess(gateway, tunnel)
        self.assertIn("http://127.0.0.1:18792/metrics", self.script)


if __name__ == "__main__":
    unittest.main()
