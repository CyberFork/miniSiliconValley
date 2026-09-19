"""Artifact checks after npm run build:t132-t133:courseware."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
ROOT=Path(__file__).parents[3]
SPEC=importlib.util.spec_from_file_location('release120', ROOT/'deploy/minisv/package_release.py')
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
class SplitReleaseTests(unittest.TestCase):
    def test_both_new_artifacts_and_teacher_boundaries_are_validated(self):
        for folder,identity,revision in [('module-thinking-deck','module-thinking-p1',7),('ligun-deck','ligun-p2',2)]:
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


class HistoryTests(unittest.TestCase):
    def test_r5_is_required_for_r6_and_validated_against_immutable_identity(self):
        with self.assertRaisesRegex(ValueError, "missing"): M.validate_module_history([], 6)
        root = Path("/isolated/previous-r5")
        artifact = {"revision": 5, "sha256": M.MODULE_HISTORY_DIGESTS[5]}
        with patch.object(M, "validate_module_thinking_courseware", return_value=artifact):
            self.assertEqual(M.validate_module_history([root], 6), {5: root})
            with self.assertRaisesRegex(ValueError, "duplicate"): M.validate_module_history([root, root], 6)
            with self.assertRaisesRegex(ValueError, "unexpected"): M.validate_module_history([root], 5)
        for artifact in ({"revision": 5, "sha256": "0" * 64}, {"revision": 6, "sha256": M.MODULE_HISTORY_DIGESTS[5]}):
            with patch.object(M, "validate_module_thinking_courseware", return_value=artifact):
                with self.assertRaisesRegex(ValueError, "identity mismatch"): M.validate_module_history([root], 6)

    def test_r7_requires_both_published_revisions(self):
        roots = [Path("/isolated/r5"), Path("/isolated/r6")]
        artifacts = [{"revision": r, "sha256": M.MODULE_HISTORY_DIGESTS[r]} for r in (5, 6)]
        with patch.object(M, "validate_module_thinking_courseware", side_effect=artifacts):
            self.assertEqual(M.validate_module_history(roots, 7), dict(zip((5, 6), roots)))
        with patch.object(M, "validate_module_thinking_courseware", return_value=artifacts[0]):
            with self.assertRaisesRegex(ValueError, "missing"): M.validate_module_history(roots[:1], 7)


class LigunHistoryTests(unittest.TestCase):
    def test_published_r1_required_and_identity_pinned(self):
        self.assertEqual(M.validate_ligun_history([],1),{})
        with self.assertRaisesRegex(ValueError,'missing'): M.validate_ligun_history([],2)
        root=Path('/isolated/p2-r1')
        artifact={'revision':1,'sha256':M.LIGUN_HISTORY_DIGESTS[1]}
        with patch.object(M,'validate_module_thinking_courseware',return_value=artifact) as validate:
            self.assertEqual(M.validate_ligun_history([root],2),{1:root})
            validate.assert_called_with(root,courseware_id='ligun-p2')
            with self.assertRaisesRegex(ValueError,'duplicate'): M.validate_ligun_history([root,root],2)
            with self.assertRaisesRegex(ValueError,'unexpected'): M.validate_ligun_history([root],1)
        with patch.object(M,'validate_module_thinking_courseware',return_value={'revision':1,'sha256':'0'*64}):
            with self.assertRaisesRegex(ValueError,'identity mismatch'): M.validate_ligun_history([root],2)
