"""Black-box regression checks for reused 3-D lesson scenes."""
import functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = os.getenv('BASE_URL', f'http://127.0.0.1:{server.server_port}').rstrip('/')
CHROME = os.getenv('MSV_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
Path('/tmp/msv-p1-reuse-evidence').mkdir(parents=True, exist_ok=True)
report = []

try:
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    opts = {'viewport': {'width': 1600, 'height': 1100}}
    if os.getenv('STORAGE_STATE'): opts['storage_state'] = os.environ['STORAGE_STATE']
    context = browser.new_context(**opts)
    errors = []
    for route, controller, prefix in [('audience/index.html', 'MSVModuleDeckController', ''), ('teacher/presenter.html', 'MSVModulePresenterController', '#current-preview ')]:
      page = context.new_page()
      page.on("pageerror", lambda error: errors.append(str(error)))
      page.goto(f'{BASE}/{route}?session=p1-reuse-{route.split("/")[0]}', wait_until='networkidle')
      for spec in [('module-s03', 'automation', 'button[data-build-step="works"]', None), ('module-s05', 'voxel', 'button[data-voxel-step="components"]', {'activity': {'voxelCase': 'car', 'voxelStep': 'object'}}), ('module-s04', 'transform', 'button[data-transform-case="plane"]', None), ('module-s14', 'automation', 'button[data-build-step="works"]', None)]:
        slide, scene, button, activity = spec
        idx = page.evaluate('id=>MSV_MODULE_DECK.slides.findIndex(s=>s.id===id)', slide)
        args = {'slide': idx, 'reveal': 99}
        if activity: args.update(activity)
        page.evaluate('([c,s])=>window[c].setState(s)', [controller, args])
        host = page.locator(f'{prefix}[data-module-3d="{scene}"]'); canvas = host.locator('canvas'); canvas.wait_for()
        page.wait_for_function('s=>document.querySelector(s)?.dataset.webglReady === "true"', arg=f'{prefix}[data-module-3d="{scene}"]')
        assert page.evaluate(f'{controller}.getState().slide') == idx
        initial = json.loads(host.get_attribute('data-camera-state')); box = canvas.bounding_box(); x,y=box['x']+box['width']*.45,box['y']+box['height']*.55
        page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x+42,y-24,steps=8); page.mouse.up(); page.wait_for_timeout(150); moved=json.loads(host.get_attribute('data-camera-state'))
        assert abs(moved['azimuth'] - initial['azimuth']) > 0.001 and abs(moved['polar'] - initial['polar']) > 0.001
        page.mouse.move(x,y); page.mouse.wheel(0,-160); page.wait_for_timeout(100); zoom=json.loads(host.get_attribute('data-camera-state')); assert zoom['distance'] < moved['distance']
        before=host.get_attribute('data-module-3d-mode'); page.locator(prefix+button).click(); page.wait_for_timeout(100); assert host.get_attribute('data-module-3d-mode') == {'automation':'works','voxel':'car:components','transform':'plane'}[scene]
        assert page.evaluate(f'{controller}.getState().slide') == idx
        if scene == 'voxel':
          geometry=json.loads(host.get_attribute('data-voxel-geometry')); assert geometry == {'edge': .22, 'resolution': 2, 'batches': 5, 'counts': {'car': 488, 'scope': 456}}
          stats=json.loads(host.get_attribute('data-render-stats')); assert stats['calls'] <= 20 and stats['geometries'] <= 3, stats
        host.locator('button[data-camera-action="reset"]').click()
        page.wait_for_timeout(300)
        page.screenshot(path=f'/tmp/msv-p1-reuse-evidence/{route.split("/")[0]}-{slide}.png')
        report.append({'surface': route, 'slide': slide, 'scene': scene, 'status': 'PASS'})
      page.close()
    teacher=context.new_page()
    teacher.goto(f'{BASE}/teacher/presenter.html?session=p1-reuse-dual-screen', wait_until='networkidle')
    with teacher.expect_popup() as popup: teacher.locator('#open-audience').click()
    audience=popup.value; audience.wait_for_load_state('networkidle')
    for sid,selector,mode in [('module-s03','button[data-build-step="works"]','works'),('module-s05','button[data-voxel-step="components"]','car:components'),('module-s04','button[data-transform-case="plane"]','plane'),('module-s14','button[data-build-step="works"]','works')]:
      idx=teacher.evaluate('id=>MSV_MODULE_DECK.slides.findIndex(s=>s.id===id)',sid)
      teacher.evaluate('i=>MSVModulePresenterController.setState({slide:i,reveal:99,activity:{voxelCase:"car",voxelStep:"object",buildStep:"components",transformCase:"car"}})',idx)
      teacher.locator('#current-preview '+selector).click()
      audience.wait_for_function('mode=>document.querySelector("[data-module-3d]")?.getAttribute("data-module-3d-mode")===mode',arg=mode)
      assert audience.evaluate('MSVModuleDeckController.getState().slide')==idx
      report.append({'surface':'teacher → audience','slide':sid,'mode':mode,'status':'PASS'})
    teacher.close();audience.close()
    assert not errors, errors
    browser.close()
finally:
  server.shutdown()
Path('/tmp/msv-p1-reuse-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, ensure_ascii=False))
