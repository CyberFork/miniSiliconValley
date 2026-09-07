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
        ):
            self.assertIn(f"bootstrap_agent {label}", self.script)

    def test_healthy_tunnel_is_preserved_after_local_stack(self) -> None:
        gateway = self.script.index('$DOCKER compose -f compose.yml up -d --force-recreate gateway')
        tunnel = self.script.rindex("\nensure_cloudflared\n")
        self.assertLess(gateway, tunnel)
        self.assertIn("ensure_cloudflared()", self.script)
        self.assertNotIn("bootstrap_agent com.minisv.cloudflared", self.script)
        self.assertIn('[[ "$TUNNEL_RELOAD_REQUIRED" = 0 ]]', self.script)
        self.assertIn('launchctl print "$DOMAIN/$label"', self.script)
        self.assertIn("http://127.0.0.1:18792/metrics", self.script)

    def test_unhealthy_tunnel_recovery_waits_for_readiness(self) -> None:
        self.assertIn('launchctl bootout "$DOMAIN/$label"', self.script)
        self.assertIn("for readiness_attempt in {1..15}", self.script)
        self.assertIn("cloudflared did not become ready after 10 attempts", self.script)

    def test_tunnel_reload_is_driven_by_effective_input_changes(self) -> None:
        self.assertIn("TUNNEL_RELOAD_REQUIRED=0", self.script)
        self.assertIn('TUNNEL_RELOAD_REQUIRED=1', self.script)
        self.assertIn('cmp -s "$MINISV_TUNNEL_CREDENTIAL_SOURCE" "$ROOT/secrets/tunnel-credentials.json"', self.script)
        self.assertIn('cmp -s "$cloudflared_config_next" "$ROOT/cloudflared/config.yml"', self.script)
        self.assertIn('cmp -s "$target_next" "$target"', self.script)


if __name__ == "__main__":
    unittest.main()
