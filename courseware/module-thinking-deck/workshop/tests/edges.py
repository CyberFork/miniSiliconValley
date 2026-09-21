"""Failure/touch/focus checks supplement the primary real-interaction suite."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:18135';OUT=Path('/tmp/msv-mc-workshop-evidence')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 ctx=browser.new_context(viewport={'width':820,'height':1180},has_touch=True,is_mobile=True)
 page=ctx.new_page();page.goto(BASE+'/workshop/teacher/presenter.html?session=touch-drive',wait_until='networkidle');page.wait_for_function('MSVWorkshop.inspect().canvas&&MSVWorkshop.inspect().owner')
 page.locator('#import').set_input_files(str(OUT/'project.json'));expect(page.locator('#feedback')).to_contain_text('导入成功')
 # Successful whole-instance move to a free socket changes no definition/other instance.
 project=page.evaluate('MSVWorkshop.inspect().project');first,second=project['instances'][:2]
 page.locator('#instance').select_option(second['id']);page.locator('#delete-instance').tap();page.locator('#instance').select_option(first['id']);page.locator('#socket').select_option(second['socket']);page.locator('#move-instance').tap()
 moved=page.evaluate('MSVWorkshop.inspect().project');assert moved['definitions']==project['definitions'];assert next(i for i in moved['instances'] if i['id']==first['id'])['socket']==second['socket']
 page.locator('#import').set_input_files(str(OUT/'project.json'));expect(page.locator('#feedback')).to_contain_text('导入成功')
 page.locator('[data-mode=drive]').tap();page.wait_for_timeout(1500)
 # CDP touchStart/touchEnd really hold the on-screen control, not a simulation setter.
 page.locator('#thrust').scroll_into_view_if_needed();rect=page.locator('#thrust').bounding_box();cdp=ctx.new_cdp_session(page);point={'x':rect['x']+rect['width']/2,'y':rect['y']+rect['height']/2}
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});page.wait_for_timeout(1700);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert page.evaluate('MSVWorkshop.inspect().snapshot.speed')>1
 page.locator('#reset-car').tap();assert page.evaluate('MSVWorkshop.inspect().snapshot.time')<.2
 # Active vehicle controls in an embedded sample never bubble to the host deck.
 host=ctx.new_page();host.goto(BASE+'/workshop/audience/index.html?session=host',wait_until='networkidle')
 host.evaluate("""() => {window.hostKeys=0;document.addEventListener('keydown',()=>window.hostKeys++);let f=document.createElement('iframe');f.src='/workshop/teacher/presenter.html?session=frame';f.style='width:800px;height:1000px';document.body.replaceChildren(f);}""")
 frame=host.frame_locator('iframe');frame.locator('#canvas canvas').wait_for();frame.locator('#canvas').focus();host.keyboard.press('ArrowRight');assert host.evaluate('window.hostKeys')==0
 host.locator('iframe').evaluate('el=>el.blur()');host.locator('body').click(position={'x':1,'y':1},force=True);host.keyboard.press('ArrowRight');assert host.evaluate('window.hostKeys')>0
 # Quota failure keeps project/export available and warning persistent after editing.
 fail=browser.new_context();fail.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('Quota full','QuotaExceededError')}")
 f=fail.new_page();f.goto(BASE+'/workshop/teacher/presenter.html?session=quota',wait_until='networkidle');f.wait_for_function('MSVWorkshop.inspect().canvas&&MSVWorkshop.inspect().owner');f.locator('#tool').select_option('place');f.get_by_role('button',name='方块 X0 Y0 Z0',exact=True).click();expect(f.locator('#storage-warning')).to_contain_text('保存失败');assert f.evaluate('MSVWorkshop.inspect().project.blocks.length')==1
 with f.expect_download() as d:f.locator('#export').click()
 d.value.save_as(OUT/'quota-export.json');assert len(json.loads((OUT/'quota-export.json').read_text())['blocks'])==1
 # A real WebGL context loss stops physics and shows a retry path.
 page.locator('#canvas canvas').evaluate("el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
 expect(page.locator('#fallback')).to_be_visible();assert page.evaluate('MSVWorkshop.inspect().snapshot') is None
 page.screenshot(path=str(OUT/'context-loss.png'),full_page=True)
 browser.close();(OUT/'edges.json').write_text(json.dumps({'touchDriveAndReset':'PASS','wholeInstanceMove':'PASS','embeddedKeyIsolation':'PASS','storageFailureExport':'PASS','webglContextLoss':'PASS','physicalDevice':'NOT_TESTED'},indent=2));print('MC_WORKSHOP_EDGE_PASS')
