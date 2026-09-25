"""Real canvas picking: center snapping, ghost preview, click vs drag, no tool selector."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('/tmp/msv-mc-direct-evidence');OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:18135'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 c=b.new_context(viewport={'width':1440,'height':1000})
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'/workshop/teacher/presenter.html?session=direct-test',wait_until='networkidle');page.wait_for_function('MSVWorkshop.inspect().canvas&&MSVWorkshop.inspect().owner')
 assert page.locator('#tool,#layer,#block-grid,#camera').count()==0
 def state():return page.evaluate('MSVWorkshop.inspect()')
 def point(x,y,z):return page.evaluate('p=>MSVWorkshop.screenPoint(...p)',[x,y,z])
 def hover(x,y,z):
  a=point(x,y,z);page.mouse.move(a['x'],a['y']);page.wait_for_timeout(120);return a
 # Grid cells are centered on integers, boundaries at half-integers.
 a=hover(.28,0,.23);s=state();assert s['ghost']['visible'];assert s['ghost']['cell']=={'x':0,'y':0,'z':0};assert s['ghost']['position']==[0,.5,0];assert not s['project']['blocks']
 page.screenshot(path=str(OUT/'ghost.png'),full_page=True)
 # Check negative cells too: rounding must not bias toward the origin.
 hover(-1.51,0,-.2);assert state()['ghost']['cell']=={'x':-2,'y':0,'z':0}
 hover(-1.49,0,-.2);assert state()['ghost']['cell']=={'x':-1,'y':0,'z':0}
 page.mouse.click(a['x'],a['y']);assert state()['project']['blocks']==[{'x':0,'y':0,'z':0,'material':'rubber'}]
 # Adjacent top face, not interpenetrating original cube.
 a=hover(0,.97,0);assert state()['ghost']['cell']=={'x':0,'y':1,'z':0};page.mouse.click(a['x'],a['y']);assert len(state()['project']['blocks'])==2
 # Real right click deletes, Shift click selects and action removes selected.
 a=hover(0,1.97,0);page.mouse.click(a['x'],a['y'],button='right');assert len(state()['project']['blocks'])==1
 a=hover(0,.97,0);page.keyboard.down('Shift');page.mouse.click(a['x'],a['y']);page.keyboard.up('Shift');assert state()['selected']==['0,0,0'];page.locator('#delete-selected').click();assert not state()['project']['blocks']
 page.locator('#undo').click();assert len(state()['project']['blocks'])==1
 # Moving away then back must still count as a drag (no accidental click).
 a=hover(2,0,0);before=state();page.mouse.move(a['x'],a['y']);page.mouse.down();page.mouse.move(a['x']+75,a['y']+30,steps=10);assert not state()['ghost']['visible'];page.mouse.move(a['x'],a['y'],steps=10);page.mouse.up();page.wait_for_timeout(180);assert state()['project']==before['project']
 # Camera may return close on out/back; separate one-way drag proves orbit works.
 old=state()['canvas']['camera'];page.mouse.move(a['x'],a['y']);page.mouse.down();page.mouse.move(a['x']+100,a['y']+65,steps=12);page.mouse.up();page.wait_for_timeout(300);assert state()['canvas']['camera']!=old;assert state()['project']==before['project']
 old=state()['canvas']['camera'];page.mouse.wheel(0,180);page.wait_for_timeout(200);assert state()['canvas']['camera']!=old
 # Right drag pans but does not erase.
 page.locator('#home').click();page.wait_for_timeout(300);a=point(0,.97,0);page.mouse.move(a['x'],a['y']);page.mouse.down(button='right');page.mouse.move(a['x']+75,a['y']+20,steps=10);page.mouse.up(button='right');assert len(state()['project']['blocks'])==1
 # Hover outside board has no preview and cannot place a block.
 page.locator('#home').click();page.wait_for_timeout(300);a=hover(5.3,0,0);assert not state()['ghost']['visible'];page.mouse.click(a['x'],a['y']);assert len(state()['project']['blocks'])==1
 # Touch: one tap places, long press selects without adding; drag and pinch do not place.
 tc=b.new_context(viewport={'width':820,'height':1100},has_touch=True,is_mobile=True);t=tc.new_page();t.goto(BASE+'/workshop/teacher/presenter.html?session=direct-touch',wait_until='networkidle');t.wait_for_function('MSVWorkshop.inspect().canvas&&MSVWorkshop.inspect().owner');t.locator('#canvas').scroll_into_view_if_needed()
 def tp(x,y,z):return t.evaluate('p=>MSVWorkshop.screenPoint(...p)',[x,y,z])
 a=tp(.2,0,.2);t.touchscreen.tap(a['x'],a['y']);assert t.evaluate('MSVWorkshop.inspect().project.blocks.length')==1
 cdp=tc.new_cdp_session(t);a=tp(0,.97,0);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]});t.wait_for_timeout(650);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert t.evaluate('MSVWorkshop.inspect().selected.length')==1;assert t.evaluate('MSVWorkshop.inspect().project.blocks.length')==1
 a=tp(2,0,0);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':a['x']+60,'y':a['y']+50}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert t.evaluate('MSVWorkshop.inspect().project.blocks.length')==1
 r=t.locator('#canvas canvas').bounding_box();cx=r['x']+r['width']/2;cy=max(80,r['y']+r['height']/2);before=t.evaluate('MSVWorkshop.inspect().canvas.camera');a={'x':cx-50,'y':cy,'id':1};a2={'x':cx+50,'y':cy,'id':2};cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,a2]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{**a,'x':cx-90},{**a2,'x':cx+90}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert t.evaluate('MSVWorkshop.inspect().project.blocks.length')==1
 t.wait_for_timeout(200);assert t.evaluate('MSVWorkshop.inspect().canvas.camera')!=before
 t.screenshot(path=str(OUT/'touch.png'),full_page=True)
 assert not errors,errors
 (OUT/'report.json').write_text(json.dumps({'gridCellCenter':'PASS','ghostEqualsPlaced':'PASS','attachToFace':'PASS','dragNeverPlaces':'PASS','orbitPanZoom':'PASS','deleteAndSelection':'PASS','touchTapHoldDragPinch':'PASS','noToolSelection':'PASS','errors':errors},indent=2))
 b.close();print('DIRECT_PLACEMENT_PASS')
