"""Text editing must cross the real deployment gateway, not only local app tests."""
import importlib.util
from pathlib import Path
import re
import unittest
ROOT=Path(__file__).resolve().parents[1]
class TextEditionsGatewayTests(unittest.TestCase):
    def test_api_is_forwarded_unchanged_with_limits(self):
        config=(ROOT/'gateway/default.conf').read_text()
        match=re.search(r'location \^~ /api/courseware/text-editions/ \{([^}]+)\}',config)
        self.assertIsNotNone(match)
        body=match.group(1)
        for value in ['set $app_path $uri;', 'include /etc/nginx/minisv/app-proxy.conf;', 'limit_req zone=minisv_platform_write', 'client_max_body_size 96k;']:
            self.assertIn(value,body)
    def test_public_health_gate_exercises_both_authenticated_apis(self):
        spec=importlib.util.spec_from_file_location('text_edit_public_smoke',ROOT/'scripts/public-smoke.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        for deck in ['module-thinking-p1','ligun-p2']:
            checks=[status for path,status in module.EXPECTED.items() if path.startswith('/api/courseware/text-editions/'+deck+'?base=')]
            self.assertEqual(checks,[401])
