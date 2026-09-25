"""Real final-page review checks, locally and on immutable deployed URLs."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.getenv('EVIDENCE_DIR','/tmp/msv-recap-focused'));OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=None
if not os.getenv('LIVE_ORIGIN'):
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
report={'decks':[],'errors':[]}
specs=[('module-thinking-deck','development-mentor-module-thinking',8,'p1',26,'module-review',3),('ligun-deck','development-mentor-ligun',3,'p2',28,'ligun-review',2)]
AUDIT='''el=>{const r=el.closest('.slide-body'),b=r.getBoundingClientRect();return {overflow:r.scrollHeight>r.clientHeight+1||r.scrollWidth>r.clientWidth+1,escaped:[...el.querySelectorAll('article,.recap-takeaway,.recap-exit')].filter(n=>n.getBoundingClientRect().bottom>b.bottom+1).map(n=>n.textContent)}}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ctx=browser.new_context(viewport={'width':1600,'height':1000},storage_state=os.getenv('STORAGE_STATE') or None)
  for folder,slug,rev,kind,count,ident,minutes in specs:
   base=os.environ['LIVE_ORIGIN'].rstrip('/')+f'/courseware/{slug}/r{rev}' if os.getenv('LIVE_ORIGIN') else f'http://127.0.0.1:{server.server_port}/{folder}/dist'
   teacher=ctx.new_page();teacher.on('pageerror',lambda e:report['errors'].append(str(e)))
   teacher.goto(base+'/teacher/presenter.html?session=recap-qa',wait_until='networkidle')
   assert teacher.locator('#slide-list button').count()==count
   with ctx.expect_page() as popup:teacher.click('#open-audience')
   audience=popup.value;audience.wait_for_load_state('networkidle')
   # Reach the new last page from the preserved old outro through the real control.
   teacher.locator('#slide-list button').nth(count-2).click();teacher.click('#next-slide')
   audience.wait_for_function('id=>MSVModuleDeckController.getState().slideId===id',arg=ident)
   teacher.click('#reset-reveal');audience.wait_for_function('MSVModuleDeckController.getState().reveal===0')
   for i in range(1,4):
    if i==2:teacher.locator('#current-title').click();teacher.keyboard.press('ArrowRight')
    else:teacher.click('#reveal')
    audience.wait_for_function('n=>MSVModuleDeckController.getState().reveal===n',arg=i)
   audience.wait_for_timeout(350)
   for page,prefix in [(audience,'#deck'),(teacher,'#current-preview')]:
    audit=page.locator(prefix+' .course-recap').evaluate(AUDIT);assert not audit['overflow'] and not audit['escaped'],(kind,audit)
    assert page.locator(prefix+' .recap-answer.revealed').count()==3
   assert teacher.locator('#note-time').inner_text()==f'{minutes} 分钟'
   assert teacher.locator('#note-goal').inner_text()
   teacher.click('#reveal');assert teacher.evaluate('MSVModulePresenterController.getState().slide')==count-1
   teacher.reload(wait_until='networkidle');assert teacher.evaluate('MSVModulePresenterController.getState().slideId')==ident
   audience.locator('.deck-slide').screenshot(path=str(OUT/f'{kind}-recap.png'))
   teacher.screenshot(path=str(OUT/f'{kind}-teacher.png'),full_page=True)
   teacher.locator('#current-title').click();teacher.keyboard.press('ArrowLeft');audience.wait_for_function('MSVModuleDeckController.getState().reveal===2')
   touch=browser.new_context(viewport={'width':1024,'height':768},has_touch=True,storage_state=os.getenv('STORAGE_STATE') or None)
   pad=touch.new_page();pad.goto(base+f'/audience/index.html?session=recap-touch&slideId={ident}',wait_until='networkidle')
   for i in range(3):pad.tap('#advance')
   assert pad.locator('.recap-answer.revealed').count()==3
   assert not pad.locator('.course-recap').evaluate(AUDIT)['overflow']
   pad.screenshot(path=str(OUT/f'{kind}-touch.png'));touch.close()
   report['decks'].append({'deck':kind,'url':base,'count':count,'finalPage':ident,'recapMinutes':minutes,'teacherAudienceSync':'PASS','reveals':3,'keyboardBack':'PASS','refresh':'PASS','touch':'PASS','layout':'PASS'})
   teacher.close();audience.close()
  assert not report['errors'];report['browser']=browser.version;browser.close()
finally:
 if server:server.shutdown()
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
