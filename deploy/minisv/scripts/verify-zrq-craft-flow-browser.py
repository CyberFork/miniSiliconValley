#!/usr/bin/env python3
"""All recipes and real item effects in disposable test saves, never existing user data."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--base',default='http://127.0.0.1:18218');ap.add_argument('--output',default='/tmp/minisv-zrq-craft-flow/local');a=ap.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'base':a.base,'checks':[],'pageErrors':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for mode,query,touch in [('normal','',False),('pure','?view=game',False),('tablet','?view=game',True)]:
  ctx=b.new_context(viewport={'width':1024 if touch else 1280,'height':800},has_touch=touch);p=ctx.new_page();p.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
  p.goto(a.base.rstrip('/')+'/showcase/2026-09/zrq/play/'+query,timeout=90000);p.wait_for_function("() => document.querySelector('#load-status').textContent.includes('已初始化')",timeout=90000)
  f=next(f for f in p.frames if '/runtime/game/' in f.url)
  def click(loc):loc.tap() if touch else loc.click()
  if not query:click(p.locator('#fullscreen-frame'))
  click(f.locator('#boot'));click(f.get_by_role('button',name='继续求生'));click(f.locator('#intro'))
  f.evaluate("() => {Game.S.bag={cloth:50,alcohol:50,metal:50,wood:50};Game.cur().x=40;Game.cur().z=40;Game.S.started=true;}")
  click(f.get_by_role('button',name='背包与合成',exact=True));click(f.locator('[data-tab=craft]'))
  before=f.evaluate('JSON.stringify(Game.S)');click(f.locator('[data-recipe=r_bandage_hi]'))
  assert f.evaluate('JSON.stringify(Game.S)')==before
  assert '请先回到安全区合成' in f.locator('#bag-result').inner_text() and f.locator('#bag-result').is_visible()
  p.screenshot(path=str(out/(mode+'-outside.png')))
  # Fixtures simulate having walked back; no teleport added to the public game.
  f.evaluate("() => {Game.cur().x=2.5;Game.cur().z=3.5;UI.renderBag();}")
  recipes=f.evaluate('RECIPES')
  for r in recipes:
   before=f.evaluate('({bag:{...Game.S.bag},crafts:Game.S.stats.crafts})');click(f.locator('[data-recipe="'+r['id']+'"]'))
   after=f.evaluate('({bag:{...Game.S.bag},crafts:Game.S.stats.crafts})')
   expected=dict(before['bag'])
   for k,n in r['need'].items():expected[k]-=n
   expected={k:v for k,v in expected.items() if v>0};expected[r['out']]=expected.get(r['out'],0)+r['n']
   assert after['bag']==expected and after['crafts']==before['crafts']+1
   assert '合成成功' in f.locator('#bag-result').inner_text() and f.locator('#bag-result').is_visible()
  p.screenshot(path=str(out/(mode+'-crafted.png')))
  click(f.locator('[data-tab=bag]'))
  def use(kind):
   click(f.locator('[data-item="'+kind+'"]'));click(f.locator('[data-use="'+kind+'"]'))
  for kind,heal in [('bandage_hi',45),('medkit',60)]:
   f.evaluate('() => {Game.cur().hp=10;}');use(kind)
   assert f.evaluate('Game.cur().hp')==10+heal and not f.evaluate('Boolean(Game.S.bag["'+kind+'"])')
  hp=f.evaluate('Object.fromEntries(Object.entries(Game.S.chars).map(([k,c])=>[k,{hp:c.hp,maxHp:c.maxHp}]))')
  for kind in ['armor','knife','flashlight']:use(kind);assert f.evaluate('Game.S.passives["'+kind+'"]')==1
  for key,v in hp.items():assert f.evaluate('Game.S.chars["'+key+'"].maxHp')==v['maxHp']+25 and f.evaluate('Game.S.chars["'+key+'"].hp')==v['hp']
  assert f.evaluate('Game.atkBonus()')==12
  # Repeat equipment must not consume another copy or stack its benefit.
  click(f.locator('[data-tab=craft]'));click(f.locator('[data-recipe=r_armor]'));click(f.locator('[data-tab=bag]'));use('armor')
  assert f.evaluate('Game.S.bag.armor')==1 and '不叠加' in f.locator('#bag-result').inner_text()
  assert f.evaluate('Game.cur().maxHp')==hp['jy']['maxHp']+25
  # Healing when already full does not waste a crafted medical kit.
  click(f.locator('[data-tab=craft]'));click(f.locator('[data-recipe=r_medkit]'));click(f.locator('[data-tab=bag]'))
  f.evaluate('() => {Game.cur().hp=Game.cur().maxHp;}');use('medkit');assert f.evaluate('Game.S.bag.medkit')==1
  # Throwing from prep must explain why, not silently consume it in an invisible paused world.
  use('molotov');assert f.evaluate('Game.S.bag.molotov')==2 and '出发' in f.locator('#bag-result').inner_text()
  # Exercise actual damage functions with nonlethal isolated in-memory targets.
  result=f.evaluate("""() => {
   const c=Game.cur(),forward=Game.forward();
   const target={hp:1000,dead:false,pos:new THREE.Vector3(c.x+forward.x,0,c.z+forward.z),spr:new THREE.Object3D()};
   target.spr.position.copy(target.pos);Game.mobs=[target];Game.running=true;Game.paused=false;Game.cd={};
   Game.basicAttack();const basic=1000-target.hp;
   target.hp=1000;Game.castSkill('flame');const direct=1000-target.hp;
   Game.running=false;Game.nightF=1;World.setNight(1);const fog=World.scene.fog.density;
   Game.updateFlashlight();const light=Game.flashlight.intensity;const litFog=World.scene.fog.density;
   // Both inventory and skill paths use the same stock and fire parameters.
   Game.effects=[];Game.pauseForUI=true;Game.uiReturnScreen='battle';return {basic,direct,light,fog,litFog};
  }""")
  assert result['basic']==28 and result['direct']==f.evaluate('SKILLS.flame.damage+12')
  assert result['light']>1 and result['litFog']<result['fog']
  use('molotov');assert f.locator('#battle').is_visible()
  fire=f.evaluate("""() => {
   Game.running=false;const fire=Game.effects.find(e=>e.kind==='fire');
   const m=Game.mobs[0];m.hp=1000;m.dead=false;m.pos.set(fire.x,0,fire.z);
   const params={radius:fire.radius,dps:fire.dps,duration:fire.max};
   Game.effects=[fire];fire.life=4;for(let i=0;i<16;i++)Game.updateEffects(.25);
   return {...params,damage:1000-m.hp,bottles:Game.S.bag.molotov,effects:Game.effects.length};
  }""")
  assert fire=={'radius':5,'dps':22,'duration':4,'damage':88,'bottles':1,'effects':0},fire
  f.evaluate("() => {Game.cd={};Game.castSkill('throw');}");assert not f.evaluate('Boolean(Game.S.bag.molotov)')
  # Capacity is evaluated on the resulting bag, not the pre-consumption bag.
  f.evaluate("() => {Game.running=false;UI.go('prep');Game.S.bag=Object.fromEntries(Object.keys(ITEMS).filter(k=>k!=='knife').slice(0,12).map(k=>[k,5]));Game.S.bag.metal=2;Game.S.bag.cloth=1;}")
  click(f.get_by_role('button',name='背包与合成',exact=True));click(f.locator('[data-tab=craft]'));click(f.locator('[data-recipe=r_knife]'))
  assert '合成成功' in f.locator('#bag-result').inner_text() and f.evaluate('Object.keys(Game.S.bag).length')<=12
  f.evaluate("() => {Game.S.bag=Object.fromEntries(Object.keys(ITEMS).filter(k=>k!=='knife').slice(0,12).map(k=>[k,5]));UI.renderBag();}")
  before=f.evaluate('JSON.stringify(Game.S)');click(f.locator('[data-recipe=r_knife]'));assert f.evaluate('JSON.stringify(Game.S)')==before
  assert '空间不足' in f.locator('#bag-result').inner_text()
  f.evaluate("() => {Game.S.bag={cloth:1};UI.renderBag();}");before=f.evaluate('JSON.stringify(Game.S)');click(f.locator('[data-recipe=r_bandage_hi]'));assert f.evaluate('JSON.stringify(Game.S)')==before
  assert '材料不足' in f.locator('#bag-result').inner_text()
  # Persist crafted item and equipment through the real save button and a page reload.
  f.evaluate("() => {Game.S.bag={cloth:2,alcohol:1};UI.renderBag();}");click(f.locator('[data-recipe=r_bandage_hi]'))
  click(f.get_by_role('button',name='返回',exact=True));assert f.locator('#prep').is_visible();click(f.get_by_role('button',name='存档',exact=True))
  expected=f.evaluate('({bag:Game.S.bag,passives:Game.S.passives})')
  p.wait_for_function("(expected) => {const s=JSON.parse(localStorage.getItem('minisv.showcase.2026-09.zrq.doomsday_endless_v1')||'null');return s && JSON.stringify({bag:s.bag,passives:s.passives})===JSON.stringify(expected)}",arg=expected)
  p.reload(timeout=90000);p.wait_for_function("() => document.querySelector('#load-status').textContent.includes('已初始化')",timeout=90000)
  f=next(f for f in p.frames if '/runtime/game/' in f.url);f.wait_for_function('() => typeof Game!=="undefined" && !!Game.S')
  assert f.evaluate('({bag:Game.S.bag,passives:Game.S.passives})')==expected,(mode,expected,f.evaluate('({bag:Game.S.bag,passives:Game.S.passives})'))
  report['checks'].append({'mode':mode,'allSixRecipes':True,'outsideSafeAreaVisibleRejection':True,'noLossOnFailure':True,'postConsumptionCapacity':True,'healingAndNoWaste':True,'armorBothCharacters':True,'knifeActualDamage':True,'flashlightNightEffect':True,'molotovBothPathsAnd88Damage':True,'duplicateEquipmentNoWaste':True,'saveReload':True})
  ctx.close()
 assert not report['pageErrors'],report['pageErrors'];b.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
