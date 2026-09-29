import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PublicPromptsTests(unittest.TestCase):
    def test_exact_public_routes_and_old_links(self):
        config = (ROOT / 'gateway/default.conf').read_text()
        for name in ['', 'index.html', 'workbook.css', 'workbook.js',
                     'student-prompt.js', 'student-prompt.txt', 'manifest.json']:
            block = re.search(r'location = ' + re.escape('/prompts/' + name) + r' \{([^}]+)\}', config)
            self.assertIsNotNone(block, name)
            self.assertNotIn('auth_request', block[1])
            self.assertIn('try_files', block[1])
        self.assertIn('location ^~ /prompts/ { return 404; }', config)
        for revision in range(24, 30):
            for name in ['', 'index.html']:
                self.assertIn(f'location = /courseware/development-mentor-module-thinking/r{revision}/audience/ai-materials/workbook/{name} {{ return 302 /prompts/$is_args$args; }}', config)
        self.assertIn('location = /courseware/latest/p1/workbook/ { return 302 /prompts/$is_args$args; }', config)
        self.assertIn('location ^~ /courseware-maintenance/ { internal; }', config)
        for revision in (24, 28, 29):
            block = config.split(f'location ^~ /courseware/development-mentor-module-thinking/r{revision}/ {{')[1].split('}')[0]
            self.assertIn('auth_request /_minisv_courseware_auth;', block)

    def test_navigation_and_packager_consume_public_source(self):
        self.assertIn('href="/prompts/">提示词中心', (ROOT / 'site/index.html').read_text())
        self.assertIn('["提示词中心", "/prompts/"]', (ROOT / 'site/ui-theme.js').read_text())
        package = (ROOT / 'package_release.py').read_text()
        self.assertIn('prompts/build.mjs', package)
        self.assertIn('output / "prompts"', package)


if __name__ == '__main__':
    unittest.main()
