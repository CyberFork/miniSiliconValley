import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).parents[1]
spec=importlib.util.spec_from_file_location('chrome_bundle',ROOT/'package_bundle.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class CoursewareChromeCacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.site=Path(self.tmp.name)/'site';self.site.mkdir()
        self.ops=Path(self.tmp.name)/'ops';(self.ops/'gateway').mkdir(parents=True)
        self.gateway=self.ops/'gateway/default.conf'
        self.template='map $uri $x { default \'<script src="/courseware-current.js"></script>\'; }\nlocation = /courseware-current.js { auth_request /gate; try_files $uri =404; }\n'
        self.gateway.write_text(self.template)
    def stage(self,body):
        name='courseware-current-'+hashlib.sha256(body).hexdigest()[:16]+'.js'
        (self.site/'courseware-current.js').write_bytes(body);(self.site/name).write_bytes(body)
        return name
    def test_content_change_updates_only_script_src(self):
        names=[]
        for body in (b'OLD',b'NEW'):
            name=self.stage(body);names.append(name);self.gateway.write_text(self.template)
            mod.bind_courseware_chrome(self.site,self.ops)
            self.assertEqual(self.gateway.read_text(),self.template.replace('src="/courseware-current.js"',f'src="/{name}"'))
        self.assertNotEqual(*names)
    def test_missing_or_mismatched_hash_copy_is_rejected(self):
        name=self.stage(b'NEW');(self.site/name).unlink()
        with self.assertRaises(ValueError):mod.bind_courseware_chrome(self.site,self.ops)
        (self.site/name).write_bytes(b'WRONG')
        with self.assertRaises(ValueError):mod.bind_courseware_chrome(self.site,self.ops)
    def test_old_fixture_without_helper_is_unchanged(self):
        mod.bind_courseware_chrome(self.site,self.ops)
        self.assertEqual(self.gateway.read_text(),self.template)
    def test_missing_or_duplicate_injection_marker_is_rejected(self):
        self.stage(b'NEW')
        for text in ('location / {}',self.template+self.template):
            self.gateway.write_text(text)
            with self.assertRaises(ValueError):mod.bind_courseware_chrome(self.site,self.ops)
    def test_helper_metadata_latest_no_store_and_hashed_route(self):
        gateway=(ROOT/'gateway/default.conf').read_text()
        for prefix in ('~^/courseware-current','~^/courseware/latest/'):
            self.assertIn(prefix+' "no-store, no-transform";',gateway)
        self.assertIn(r'location ~ ^/courseware-current-[0-9a-f]+\.js$',gateway)
        for endpoint in ('/courseware-current.js','/courseware-current.json'):
            self.assertIn('location = '+endpoint+' { try_files $uri =404; expires off; }',gateway)
        self.assertIn('auth_request /_minisv_mentor_courseware_auth;',gateway)
if __name__=='__main__':unittest.main()
