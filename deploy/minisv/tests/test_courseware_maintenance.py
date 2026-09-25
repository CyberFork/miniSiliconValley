import hashlib,importlib.util,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('maintenance',ROOT/'deploy/minisv/scripts/stage-courseware-maintenance.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Maintenance(unittest.TestCase):
 def test_stage_leaves_historical_packages_untouched(self):
  with tempfile.TemporaryDirectory() as tmp:
   site=Path(tmp);old=site/'courseware/development-mentor-module-thinking/r22/teacher/ai-lessons.js'
   old.parent.mkdir(parents=True);old.write_text('historical bytes')
   manifest=m.stage(site,ROOT)
   self.assertEqual(old.read_text(),'historical bytes')
   for name,digest in manifest.items():
    data=(site/'courseware-maintenance/p1-ai-text'/name).read_bytes()
    self.assertEqual(hashlib.sha256(data).hexdigest(),digest)
 def test_existing_auth_boundary_and_cache_are_preserved(self):
  config=(ROOT/'deploy/minisv/gateway/default.conf').read_text()
  self.assertIn('location ^~ /courseware-maintenance/ { internal; }',config)
  for rev in (22,23):
   for side in ('teacher','audience'):
    for name in ('ai-lessons.js','text-editions.js','module-3d.js','bag-compare.js'):
     self.assertIn(f'/r{rev}/{side}/{name} /courseware-maintenance/p1-ai-text/{name};',config)
   loc=config.split(f'location ^~ /courseware/development-mentor-module-thinking/r{rev}/teacher/ {{')[1].split('}')[0]
   self.assertIn('auth_request /_minisv_mentor_courseware_auth;',loc)
   self.assertIn('try_files $minisv_courseware_asset $uri =404;',loc)
if __name__=='__main__':unittest.main()

class GatewayPreflight(unittest.TestCase):
 def test_real_nginx_checked_before_release_mutation(self):
  s=(ROOT/'deploy/minisv/scripts/deploy-hecate.sh').read_text()
  self.assertIn('"$GATEWAY_IMAGE" nginx -t',s)
  self.assertLess(s.index('"$GATEWAY_IMAGE" nginx -t'),s.index('mv "$INCOMING" "$TARGET"'))
  self.assertIn('map_hash_bucket_size 128;', (ROOT/'deploy/minisv/gateway/default.conf').read_text())
  health=s.split('service health timeout;')[1].split('\n')[0]
  self.assertIn('false;',health)
  self.assertNotIn('exit 1',health)

class WorkshopMaintenance(unittest.TestCase):
 def test_workshop_and_shared_route_engine_use_same_maintenance_source(self):
  config=(ROOT/'deploy/minisv/gateway/default.conf').read_text()
  with tempfile.TemporaryDirectory() as tmp:
   manifest=m.stage(tmp,ROOT)
   for rev in (22,23):
    for side in ('teacher','audience'):
     for name in ('model.mjs','physics.mjs','render.mjs','drive-input.mjs'):
      self.assertIn(f'/r{rev}/{side}/workshop/{name} /courseware-maintenance/p1-ai-text/workshop/{name};',config)
      self.assertIn('workshop/'+name,manifest)
    for name in ('app.mjs','gameplay.mjs','teacher/presenter.html','audience/index.html','workshop.css'):
     self.assertIn(f'/r{rev}/teacher/workshop/{name} /courseware-maintenance/p1-ai-text/workshop/{name};',config)
   self.assertIn('route-game/effects.mjs',manifest)
   self.assertIn('route-game/state.mjs',manifest)
   for rev in (22,23):
    for side in ('teacher','audience'):
     self.assertIn(f'/r{rev}/{side}/route-game/state.mjs /courseware-maintenance/p1-ai-text/route-game/state.mjs;',config)
   app=(ROOT/'courseware/module-thinking-deck/workshop/app.mjs').read_text()
   self.assertNotIn('请先接好四个轮子和一个推进器',app)
   self.assertIn('glassFinish:true,breakableWall:true',app)
   game=(ROOT/'courseware/module-thinking-deck/workshop/gameplay.mjs').read_text()
   self.assertIn("from '../route-game/state.mjs'",game)
   self.assertIn('discardItem',game)
   self.assertIn('showModal()',game)

class WholeGameMapMaintenance(unittest.TestCase):
 def test_maps_insert_once_preserve_base_and_packages(self):
  import json,zipfile
  def load(p):return json.JSONDecoder().raw_decode(p.read_text().split('Object.freeze(',1)[1].lstrip())[0]
  source=ROOT/'courseware/module-thinking-deck'
  with tempfile.TemporaryDirectory() as tmp:
   site=Path(tmp);original={}
   for rev in (22,23):
    package=site/f'courseware/development-mentor-module-thinking/r{rev}'
    (package/'audience/printables').mkdir(parents=True);(package/'teacher').mkdir()
    model=load(source/'deck-data.js');model['version']=f'fixture-r{rev}'
    model['slides']=[s for s in model['slides'] if s['id'] not in ('module-minecraft-map','ai-minecraft-modules')]
    next(s for s in model['slides'] if s['id']=='ai-13')['minutes']=32
    next(s for s in model['slides'] if s['id']=='module-s12')['minutes']=7
    model['slides'][0]['title']='unrelated historical title'
    file=package/'audience/deck-data.js';file.write_text('window.MSV_MODULE_DECK=Object.freeze('+json.dumps(model)+');')
    (package/'teacher/presenter-notes.js').write_bytes((source/'presenter-notes.js').read_bytes())
    with zipfile.ZipFile(package/'audience/printables/materials.zip','w') as z:
     z.writestr('module-map.html','old footer');z.writestr('quick-start.html','unchanged')
   original={p:p.read_bytes() for p in (site/'courseware').rglob('*') if p.is_file()}
   first=m.stage(site,ROOT);self.assertEqual(first,m.stage(site,ROOT))
   self.assertTrue(all(p.read_bytes()==data for p,data in original.items()))
   for rev in (22,23):
    target=site/f'courseware-maintenance/p1-ai-text/r{rev}'
    model=load(target/'deck-data.js')
    self.assertEqual(model['version'],f'fixture-r{rev}')
    self.assertEqual(model['slides'][0]['title'],'unrelated historical title')
    self.assertEqual(len(model['slides']),38)
    self.assertEqual(sum(s['minutes'] for s in model['slides']),240)
    with zipfile.ZipFile(target/'materials.zip') as z:
     self.assertEqual(z.read('quick-start.html'),b'unchanged')
     self.assertNotIn('先自己想，再两人互查'.encode(),z.read('module-map.html'))
    config=(ROOT/'deploy/minisv/gateway/default.conf').read_text()
    for side in ('teacher','audience'):
     self.assertIn(f'/r{rev}/{side}/deck-data.js /courseware-maintenance/p1-ai-text/r{rev}/deck-data.js;',config)
