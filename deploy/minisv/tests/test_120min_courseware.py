"""Artifact checks after npm run build:t132-t133:courseware."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
ROOT=Path(__file__).parents[3]
SPEC=importlib.util.spec_from_file_location('release120', ROOT/'deploy/minisv/package_release.py')
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
class SplitReleaseTests(unittest.TestCase):
    def test_both_new_artifacts_and_teacher_boundaries_are_validated(self):
        for folder,identity,revision in [('module-thinking-deck','module-thinking-p1',5),('ligun-deck','ligun-p2',1)]:
            source=ROOT/'courseware'/folder/'dist'
            with tempfile.TemporaryDirectory() as temp:
                dest=Path(temp)/'dist';shutil.copytree(source,dest)
                manifest=json.loads((dest/'BUILD-MANIFEST.json').read_text())
                result=M.validate_module_thinking_courseware(dest,courseware_id=identity)
                self.assertEqual(result['revision'],revision)
                self.assertEqual(result['sha256'],manifest['digest'])
                self.assertEqual(manifest['manualAcceptance'],'not-signed-by-user')
                (dest/'audience/leaked-teacher.js').write_text('private')
                with self.assertRaisesRegex(ValueError,'undeclared'):M.validate_module_thinking_courseware(dest,courseware_id=identity)
                (dest/'audience/leaked-teacher.js').unlink()
                manifest['digest']='0'*64;(dest/'BUILD-MANIFEST.json').write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError,'deployment-ready'):M.validate_module_thinking_courseware(dest,courseware_id=identity)
