"""Real input sequence, offline-local resources, no production APIs."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.getenv('MC_WORKSHOP_URL','http://127.0.0.1:18135')
OUT=Path('/tmp/msv-mc-workshop-evidence');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
 page=context.new_page();errors=[];external=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r: external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('blob:') else None)
 page.goto(BASE+'/workshop/teacher/presenter.html?session=test-main',wait_until='networkidle')
 page.wait_for_function('MSVWorkshop.inspect().canvas && MSVWorkshop.inspect().owner')
 def inspect():return page.evaluate('MSVWorkshop.inspect()')
 def place(x,y,material='rubber'):
  page.locator('#material').select_option(material);page.locator('#tool').select_option('place');page.get_by_role('button',name=f'方块 X{x} Y{y} Z0',exact=True).click()
 def save(name,behavior):
  page.locator('#select-all').click();page.locator('#module-name').fill(name);page.locator('#responsibility').fill('支撑滚动' if behavior=='wheel' else '按箭头推动');page.locator('#behavior').select_option(behavior);page.get_by_role('button',name='保存选中的模块',exact=True).click()
 for x,y in [(1,1),(0,1),(2,1),(1,0),(1,2)]:place(x,y)
 page.locator('#undo').click();assert len(inspect()['project']['blocks'])==4
 page.locator('#redo').click();save('我造的轮子','wheel');assert len(inspect()['project']['definitions'])==1
 page.locator('#clear-blocks').click()
 for x,m in [(0,'metal'),(1,'metal'),(2,'fuel')]:place(x,0,m)
 save('我造的推进器','thruster');assert len(inspect()['project']['definitions'])==2
 page.locator('[data-mode=drive]').click();assert inspect()['mode']=='build';expect(page.locator('#feedback')).to_contain_text('接好')
 for socket in ['wheel-fl','wheel-fr','wheel-rl','wheel-rr']:
  page.locator('#definition').select_option(label='我造的轮子');page.locator('#socket').select_option(socket);page.locator('#place-module').click()
 page.locator('#definition').select_option(label='我造的推进器');page.locator('#socket').select_option('engine');page.locator('#place-module').click()
 assembled=inspect()['project'];assert len(assembled['instances'])==5
 page.screenshot(path=str(OUT/'assembly.png'),full_page=True)
 # Actual export/import; malformed import must preserve current project.
 with page.expect_download() as download:page.locator('#export').click()
 exported=OUT/'project.json';download.value.save_as(exported);assert json.loads(exported.read_text())==assembled
 bad=OUT/'invalid.json';bad.write_text('{"script":"alert(1)"}')
 page.locator('#import').set_input_files(str(bad));expect(page.locator('#feedback')).to_contain_text('导入失败');assert inspect()['project']==assembled
 page.locator('#delete-instance').click();assert len(inspect()['project']['instances'])==4
 page.locator('#import').set_input_files(str(exported));expect(page.locator('#feedback')).to_contain_text('导入成功');assert inspect()['project']==assembled
 page.reload(wait_until='networkidle');page.wait_for_function('MSVWorkshop.inspect().canvas && MSVWorkshop.inspect().owner');assert inspect()['project']==assembled
 with page.expect_popup() as popup:page.locator('#open-screen').click()
 audience=popup.value;audience.wait_for_load_state('networkidle');audience.wait_for_function('MSVWorkshop.inspect().project.instances.length===5')
 assert audience.locator('.teacher-notes').count()==0
 other=context.new_page();other.goto(BASE+'/workshop/audience/index.html?session=unrelated',wait_until='networkidle');assert other.evaluate('MSVWorkshop.inspect().project.instances.length')==0
 follower=context.new_page();follower.goto(BASE+'/workshop/teacher/presenter.html?session=test-main',wait_until='networkidle');assert follower.evaluate('MSVWorkshop.inspect().owner') is False
 # Enter physical mode by real button. Resize doesn't rebuild the simulator/camera.
 page.locator('[data-mode=drive]').click();page.wait_for_timeout(1700);assert inspect()['snapshot']['chassis']['p']['y']<1.2
 before=inspect();page.locator('#expand').click();page.wait_for_timeout(250);expanded=inspect();assert expanded['canvas']['width']!=before['canvas']['width'] or expanded['canvas']['height']!=before['canvas']['height'];assert expanded['project']==assembled;assert expanded['canvas']['camera']==before['canvas']['camera'];assert expanded['snapshot']['steps']>before['snapshot']['steps']
 page.locator('#fullscreen').click();page.wait_for_function('Boolean(document.fullscreenElement)');page.locator('#exit-full').click();page.wait_for_function('!document.fullscreenElement');page.locator('#expand').click()
 # Hold/release actual button. No key makes a slide navigation here (isolated embedded surface).
 page.locator('#thrust').dispatch_event('pointerdown',{'pointerId':1}) if False else None
 box=page.locator('#thrust').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_timeout(4200);page.mouse.up();coast=inspect();assert coast['snapshot']['chassis']['p']['x']>8;assert coast['snapshot']['speed']>1
 page.wait_for_timeout(250);assert inspect()['snapshot']['speed']>.5
 box=page.locator('#brake').bounding_box();page.mouse.move(box['x']+20,box['y']+20);page.mouse.down();page.wait_for_timeout(1200);page.mouse.up();assert inspect()['snapshot']['speed']<coast['snapshot']['speed']
 page.screenshot(path=str(OUT/'drive.png'),full_page=True)
 # Follower renders the authority snapshots, not a second simulator.
 audience.wait_for_function('MSVWorkshop.inspect().mode==="drive" && MSVWorkshop.inspect().snapshot.steps>100')
 assert abs(audience.evaluate('MSVWorkshop.inspect().snapshot.time')-inspect()['snapshot']['time'])<.3
 page.locator('#reset-car').click();assert inspect()['snapshot']['time']<.2;assert inspect()['project']==assembled
 page.locator('[data-mode=assemble]').click();page.locator('#instance').select_option(assembled['instances'][-1]['id']);page.locator('#rotate-instance').click();rotated=inspect()['project'];assert rotated['instances'][-1]['rotation']==180;assert rotated['definitions']==assembled['definitions'];assert rotated['instances'][:-1]==assembled['instances'][:-1]
 page.locator('[data-mode=drive]').click();page.wait_for_timeout(1000);page.locator('#canvas').focus();page.keyboard.down('ArrowUp');page.wait_for_timeout(1600);page.keyboard.up('ArrowUp');assert inspect()['snapshot']['chassis']['p']['x']<-.3
 assert other.evaluate('MSVWorkshop.inspect().project.instances.length')==0
 # UI failure path must not replace the playable test with an animation.
 failed=context.new_page();failed.route('**/vendor/rapier.mjs',lambda route:route.abort());failed.goto(BASE+'/workshop/teacher/presenter.html?session=broken',wait_until='networkidle');expect(failed.locator('#fallback')).to_be_visible();assert failed.evaluate('MSVWorkshop.inspect().snapshot') is None
 # Touch-only block placement + camera and projection sizing.
 touch=browser.new_context(viewport={'width':820,'height':1180},has_touch=True,is_mobile=True)
 tablet=touch.new_page();tablet.goto(BASE+'/workshop/teacher/presenter.html?session=touch',wait_until='networkidle');tablet.wait_for_function('MSVWorkshop.inspect().canvas && MSVWorkshop.inspect().owner');tablet.locator('#tool').select_option('place');tablet.get_by_role('button',name='方块 X0 Y0 Z0',exact=True).tap();assert tablet.evaluate('MSVWorkshop.inspect().project.blocks.length')==1;tablet.locator('#expand').tap();tablet.screenshot(path=str(OUT/'touch.png'),full_page=True);assert tablet.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors;assert not external,external
 report={'realBlockBuild':'PASS','moduleReuse':'PASS','importExportRefresh':'PASS','gravityDriveBrakeReset':'PASS','direction':'PASS','singleOwnerDualScreen':'PASS','sessionIsolation':'PASS','expandFullscreen':'PASS','touch':'PASS','fallback':'PASS','errors':errors,'manualUserTryout':'NOT_SIGNED'}
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close();print('MC_WORKSHOP_BROWSER_PASS')
