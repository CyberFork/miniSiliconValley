from __future__ import annotations

import unittest
from pathlib import Path
import re


ROOT = Path(__file__).parents[1]


class DeployScriptContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.script = (ROOT / "scripts" / "deploy-hecate.sh").read_text()
        cls.rollback_script = (ROOT / "scripts" / "rollback-hecate.sh").read_text()

    def test_legacy_global_runtime_is_stopped_not_bootstrapped(self) -> None:
        self.assertNotIn("bootstrap_agent()", self.script)
        self.assertNotIn("bootstrap_agent com.minisv.live-run-controller", self.script)
        self.assertNotIn("bootstrap_agent com.minisv.remote-console", self.script)
        for label in ("com.minisv.live-run-controller", "com.minisv.remote-console"):
            self.assertIn(label, self.script)
        self.assertIn('launchctl bootout "$DOMAIN/$label"', self.script)
        self.assertIn('launchctl disable "$DOMAIN/$label"', self.script)

    def test_healthy_tunnel_is_preserved_after_local_stack(self) -> None:
        gateway = self.script.index('"$DOCKER" compose -f compose.yml up -d --force-recreate gateway')
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

    def test_deploy_health_has_no_alpha_or_global_controller_dependency(self) -> None:
        readiness = self.script[self.script.index("for attempt in {1..30}"):]
        self.assertNotIn("127.0.0.1:18790", readiness)
        self.assertNotIn("127.0.0.1:18791", readiness)
        self.assertIn("127.0.0.1:18780/healthz", readiness)

    def test_one_verified_release_switches_the_app_worker_and_static_gateway(self) -> None:
        self.assertIn('"$INCOMING/MANIFEST.sha256"', self.script)
        self.assertIn('"$INCOMING/app/dist/server/index.js"', self.script)
        self.assertIn("module.validate_app_dist(root / 'app' / 'dist')", self.script)
        switch = self.script.index('"$PYTHON" "$TARGET/ops/scripts/switch-current.py"')
        classroom = self.script.index("\nrestart_classroom\n", switch)
        gateway = self.script.index('"$DOCKER" compose -f compose.yml up -d --force-recreate gateway', classroom)
        self.assertLess(switch, classroom)
        self.assertLess(classroom, gateway)
        self.assertIn("classroom-data-before.tgz", self.script)
        self.assertIn('"$PYTHON" -B - "$INCOMING"', self.script)

    def test_course_registry_preflight_runs_read_only_after_backup_and_before_switch(self) -> None:
        backup = self.script.index("classroom-data-before.tgz")
        preflight = self.script.index('"$PYTHON" "$TARGET/ops/scripts/preflight-course-registry-integrity.py"')
        switch = self.script.index('"$PYTHON" "$TARGET/ops/scripts/switch-current.py"')
        self.assertLess(backup, preflight)
        self.assertLess(preflight, switch)
        self.assertIn("course-registry-preflight.json", self.script)
        self.assertIn('-f "$INCOMING/ops/scripts/preflight-course-registry-integrity.py"', self.script)

    def test_failed_mutating_deploy_restores_the_previous_release(self) -> None:
        self.assertIn("rollback_failed_deploy()", self.script)
        self.assertIn("trap rollback_failed_deploy ERR", self.script)
        self.assertIn("MINISV_DEPLOY_ROLLED_BACK", self.script)
        self.assertIn("previous-current.txt", self.script)
        self.assertIn(".rollback-current-", self.script)
        self.assertIn("legacy static-only release", self.script)
        rollback = self.script[self.script.index("rollback_failed_deploy()") : self.script.index("trap rollback_failed_deploy ERR")]
        self.assertIn("for legacy_label in com.minisv.live-run-controller com.minisv.remote-console", rollback)
        self.assertIn('cp -p "$legacy_backup" "$legacy_target"', rollback)
        self.assertIn('launchctl enable "$DOMAIN/$legacy_label"', rollback)
        self.assertIn('launchctl bootstrap "$DOMAIN" "$legacy_target"', rollback)
        self.assertIn('launchctl kickstart -k "$DOMAIN/$legacy_label"', rollback)

    def test_manifest_imports_cannot_mutate_an_immutable_release(self) -> None:
        self.assertIn('"$PYTHON" -B - "$INCOMING"', self.script)
        self.assertIn('"$PYTHON" -B - "$TARGET"', self.rollback_script)

    def test_zsh_scripts_do_not_assign_reserved_status_parameter(self) -> None:
        for name, source in (("deploy", self.script), ("rollback", self.rollback_script)):
            self.assertIsNone(re.search(r"(?m)^\s*(?:local\s+)?status=", source), f"{name} assigns zsh's read-only status parameter")


if __name__ == "__main__":
    unittest.main()
