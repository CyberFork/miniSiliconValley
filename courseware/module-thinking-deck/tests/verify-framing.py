"""Check actual projected voxel bounds, not just HTML boxes, after real case/step clicks."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=os.getenv('BASE_URL',f'http://127.0.0.1:{server.server_port}').rstrip('/')
report=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  opts={'viewport':{'width':1600,'height':1100}}
  if os.getenv('STORAGE_STATE'):opts['storage_state']=os.environ['STORAGE_STATE']
  context=browser.new_context(**opts)
  for route,controller,prefix in [('audience/index.html','MSVModuleDeckController',''),('teacher/presenter.html','MSVModulePresenterController','#current-preview ')]:
   page=context.new_page();page.goto(f'{BASE}/{route}?session=framing-qa',wait_until='networkidle')
   for sid,cases in [('module-s02-voxel',['car','scope']),('module-s05',['car'])]:
    idx=page.evaluate('id=>MSV_MODULE_DECK.slides.findIndex(s=>s.id===id)',sid)
    page.evaluate('([c,i])=>window[c].setState({slide:i,reveal:99})',[controller,idx])
    for case in cases:
     page.locator(prefix+f'button[data-voxel-case="{case}"]').click()
     for step in ['blocks','components','object']:
      page.locator(prefix+f'button[data-voxel-step="{step}"]').click()
      selector=prefix+'[data-module-3d="voxel"]'
      page.wait_for_function('s=>!!document.querySelector(s)?.dataset.voxelFraming',arg=selector)
      bounds=json.loads(page.locator(selector).get_attribute('data-voxel-framing'))
      assert all(-.96 <= value <= .96 for value in bounds['min']+bounds['max']),(route,sid,case,step,bounds)
      report.append({'surface':route,'slide':sid,'case':case,'step':step,'bounds':bounds,'status':'PASS'})
    page.wait_for_timeout(800)
    page.screenshot(path=f'/tmp/p1-fit-{route.split("/")[0]}-{sid}.png')
   page.close()
  browser.close()
finally:server.shutdown()
Path('/tmp/msv-p1-framing-report.json').write_text(json.dumps(report,indent=2))
print('VOXEL_FRAMING_PASS',len(report))
