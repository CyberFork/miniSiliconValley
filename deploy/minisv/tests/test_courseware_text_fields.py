import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('fields',Path(__file__).resolve().parents[3]/'scripts/courseware_text_fields.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StableFields(unittest.TestCase):
 def test_move_and_reword_preserve_ids_and_do_not_reuse_deleted(self):
  model={'slides':[{'id':'s','title':'T','content':'<div><b>One</b><p>Two</p><button><b>Not editable</b></button></div>'}]}
  m.annotate(model);first=m.inventory(model,True);self.assertEqual(len(first),4)
  slide=model['slides'][0];slide['content']='<section>'+slide['content'].replace('One','Changed')+'</section>';m.annotate(model)
  moved=m.inventory(model,True);self.assertEqual({v['id'] for v in first.values()},{v['id'] for v in moved.values()})
  slide['content']='<p>New field</p>';m.annotate(model);self.assertIn('text.f0003',str(m.inventory(model,True)))
 def test_dynamic_exclusion_and_duplicates_fail(self):
  model={'slides':[{'id':'s','content':'<div data-module-3d><b>Dynamic</b></div><p data-msv-field="f0001">Static</p>'}]};self.assertEqual(len(m.inventory(model,True)),3)
  model['slides'][0]['content']+='<p data-msv-field="f0001">Duplicate</p>'
  with self.assertRaisesRegex(ValueError,'Duplicate'):m.inventory(model,True)
 def test_missing_ids_fail(self):
  with self.assertRaisesRegex(ValueError,'Missing'):m.inventory({'slides':[{'id':'s','content':'<p>Text</p>'}]},True)
if __name__=='__main__':unittest.main()
