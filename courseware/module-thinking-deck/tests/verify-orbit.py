"""Real mouse, keyboard and touch camera checks, using isolated lesson sessions."""
import functools
import http.server
import json
import math
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = os.getenv('BASE_URL', f'http://127.0.0.1:{server.server_port}').rstrip('/')
CHROME = os.getenv('MSV_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
report=[]
def state(host):
    return json.loads(host.get_attribute('data-camera-state'))
def approx(a,b):
    return math.isclose(a,b,abs_tol=0.001)
def target_changed(a,b):
    return any(not approx(x,y) for x,y in zip(a['target'],b['target']))
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=CHROME)
  options=dict(viewport={'width':1600,'height':1100},has_touch=True)
  if os.getenv('STORAGE_STATE'): options['storage_state']=os.environ['STORAGE_STATE']
  context=browser.new_context(**options)
  errors=[]
  for route,controller,prefix in [('audience/index.html','MSVModuleDeckController',''),('teacher/presenter.html','MSVModulePresenterController','#current-preview ')]:
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'{BASE}/{route}?session=orbit-qa-{route.split("/")[0]}',wait_until='networkidle')
   for name,slide_id,case_selector in [('transform','module-s02','[data-transform-case="plane"]'),('automation','module-s02-build','[data-build-step="components"]'),('voxel','module-s02-voxel','[data-voxel-case="scope"]')]:
    index=page.evaluate('id=>MSV_MODULE_DECK.slides.findIndex(s=>s.id===id)',slide_id);assert index>=0
    page.evaluate('([c,i])=>window[c].setState({slide:i,reveal:99})',[controller,index])
    host=page.locator(f'{prefix}[data-module-3d="{name}"]');canvas=host.locator('canvas');canvas.wait_for()
    page.wait_for_function('s=>!!document.querySelector(s)?.dataset.cameraState',arg=f'{prefix}[data-module-3d="{name}"]')
    page.wait_for_timeout(300)
    initial=state(host);b=canvas.bounding_box();x,y=b['x']+b['width']*.45,b['y']+b['height']*.55
    def drag(dx,dy):
     page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=8);page.mouse.up();page.wait_for_timeout(80)
    drag(40,0);horizontal=state(host)
    assert not approx(initial['azimuth'],horizontal['azimuth']),name
    drag(0,-25);vertical=state(host);assert not approx(horizontal['polar'],vertical['polar']),name
    page.mouse.move(x,y);page.mouse.wheel(0,-180);page.wait_for_timeout(200)
    zoomed=state(host);assert zoomed['distance']<vertical['distance'],(name,vertical,zoomed)
    page.keyboard.down('Shift');drag(25,15);page.keyboard.up('Shift');assert target_changed(zoomed,state(host)),name
    canvas.focus();before=state(host)
    page.keyboard.press('ArrowUp');assert not approx(before['polar'],state(host)['polar'])
    before=state(host);page.keyboard.press('ArrowRight');assert not approx(before['azimuth'],state(host)['azimuth'])
    before=state(host);page.keyboard.press('+');assert state(host)['distance']<before['distance']
    page.keyboard.press('-');assert approx(before['distance'],state(host)['distance'])
    assert page.evaluate(f'{controller}.getState().slide')==index
    page.keyboard.press('0');reset=state(host)
    for key in ['azimuth','polar','distance']:assert approx(initial[key],reset[key]),(name,key,initial,reset)
    assert not target_changed(initial,reset)
    host.locator('[data-camera-action="in"]').click();assert state(host)['distance']<initial['distance']
    host.locator('[data-camera-action="out"]').click();assert approx(state(host)['distance'],initial['distance'])
    host.locator('[data-camera-action="reset"]').click()
    # Physical pinch produces PointerEvents in Chrome, not a JS state setter.
    cdp=context.new_cdp_session(page)
    def touches(kind,spread,dy=0):
     points=[] if kind=='touchEnd' else [{'id':1,'x':x-spread,'y':y+dy},{'id':2,'x':x+spread,'y':y+dy}]
     cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
    touches('touchStart',20)
    for spread in [24,30,36,42]:touches('touchMove',spread)
    touches('touchEnd',0);page.wait_for_timeout(120)
    pinched=state(host);assert pinched['distance']<initial['distance'],(name,pinched,initial)
    touches('touchStart',25)
    for dy in [4,8,12,16]:touches('touchMove',25,dy)
    touches('touchEnd',0);assert target_changed(pinched,state(host))
    # Actual repeated zoom input clamps at declared distance bounds.
    canvas.focus()
    for _ in range(25):page.keyboard.press('+')
    assert approx(state(host)['distance'],initial['minDistance'])
    for _ in range(35):page.keyboard.press('-')
    assert approx(state(host)['distance'],initial['maxDistance'])
    page.keyboard.press('0');assert approx(state(host)['distance'],initial['distance'])
    mode=host.get_attribute('data-module-3d-mode');page.locator(prefix+case_selector).click(force=True)
    page.wait_for_timeout(120);assert host.get_attribute('data-module-3d-mode')!=mode
    assert page.evaluate(f'{controller}.getState().slide')==index
    report.append({'surface':route,'scene':name,'mouse':'PASS','keyboard':'PASS','pinchPan':'PASS','limits':'PASS','caseSwitch':'PASS'})
   page.close()
  assert not errors,errors
  browser.close()
finally:
 server.shutdown()
Path('/tmp/msv-orbit-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,ensure_ascii=False))
