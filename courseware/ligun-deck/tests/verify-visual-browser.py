"""Actual reveal controls, same-input replay and dual-view P2 visual QA.
BASE_URL points to .../r2 for post-deploy verification; STORAGE_STATE is private.
"""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.getenv('EVIDENCE_DIR','/tmp/msv-p2-visual-evidence'));OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=None
if os.getenv('BASE_URL'):base=os.environ['BASE_URL'].rstrip('/')
else:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
 threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
report={'url':base,'version':'2026.09.19-p2-r2','pages':[],'errors':[]}
AUDIT='''root=>{
 const body=root.closest('.slide-body'),br=body.getBoundingClientRect(),nodes=[...root.querySelectorAll('article,.p2-strip,.p2-handoff,.p2-link,.p2-repair-row')];
 const overflow=nodes.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>br.bottom+1||r.right>br.right+1||n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1}).map(n=>n.textContent);
 const link=root.querySelector('.p2-link'),intersections=[];
 if(link)for(const n of root.children){if(n===link)continue;const a=n.getBoundingClientRect(),b=link.getBoundingClientRect();if(a.bottom>b.top+1&&a.right>b.left&&a.left<b.right)intersections.push(n.textContent)}
 return {overflow,intersections};}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ctx=browser.new_context(viewport={'width':1600,'height':1000},storage_state=os.getenv('STORAGE_STATE') or None,permissions=['clipboard-read','clipboard-write'])
  teacher=ctx.new_page();teacher.on('pageerror',lambda e:report['errors'].append(str(e)))
  teacher.goto(base+'/teacher/presenter.html?session=p2-visual-qa',wait_until='networkidle')
  assert teacher.evaluate('MSV_MODULE_DECK.version')==report['version']
  with ctx.expect_page() as popup:teacher.click('#open-audience')
  audience=popup.value;audience.wait_for_load_state('networkidle')
  for index,kind in [(6,'master'),(10,'decomposition'),(17,'child'),(18,'integration'),(21,'repair'),(25,'transfer')]:
   teacher.locator('#slide-list button').nth(index).click()
   teacher.click('#reset-reveal')
   audience.wait_for_function('i=>MSVModuleDeckController.getState().slide===i&&MSVModuleDeckController.getState().reveal===0',arg=index)
   num=teacher.locator('#current-preview [data-reveal]').count();assert num>0
   for count in range(1,num+1):
    if count%2:teacher.click('#reveal')
    else:teacher.locator('#current-title').click();teacher.keyboard.press('ArrowRight')
    audience.wait_for_function('v=>MSVModuleDeckController.getState().reveal===v',arg=count)
   audience.wait_for_timeout(350)
   for page,selector in [(audience,'#deck'),(teacher,'#current-preview')]:
    audit=page.locator(selector+' [data-p2-visual]').evaluate(AUDIT);assert not audit['overflow'] and not audit['intersections'],(kind,audit)
   assert teacher.locator('#note-script').inner_text()
   audience.locator('.deck-slide').screenshot(path=str(OUT/f'{kind}.png'))
   report['pages'].append({'slide':index+1,'visual':kind,'revealSteps':num,'controls':'mouse+keyboard','dualView':'PASS','layout':'PASS'})
  teacher.screenshot(path=str(OUT/'teacher.png'),full_page=True)
  demo=ctx.new_page();demo.goto(base+'/audience/demo/index.html',wait_until='networkidle')
  before=demo.locator('#bag').inner_text();demo.click('#replay-abb')
  replay=demo.locator('#replay-result').inner_text();assert '数量 3' in replay and '数量 2' in replay and '错误判赢' in replay and '不赢，仍缺 C' in replay
  assert demo.locator('#bag').inner_text()==before
  demo.select_option('#version','fixed');demo.click('#check');assert demo.locator('#checks .passed').count()==7
  demo.screenshot(path=str(OUT/'same-input-repair.png'),full_page=True)
  report['sameInputReplay']={'input':['A','B','B'],'brokenCount':3,'fixedCount':2,'unchangedPlayer':True,'fixedChecks':7}
  workbook=ctx.new_page();workbook.goto(base+'/audience/workbook/index.html',wait_until='networkidle');assert workbook.evaluate('MSV_PROMPT_TEMPLATES.length')==11
  report['templates']=11
  # An actual touch tap must reveal the diagram on a tablet; no hover-only data.
  touch=browser.new_context(viewport={'width':1024,'height':768},has_touch=True,storage_state=os.getenv('STORAGE_STATE') or None)
  pad=touch.new_page();pad.goto(base+'/audience/index.html?session=p2-touch&slideId=ligun-11',wait_until='networkidle')
  pad.tap('#advance');assert pad.evaluate('MSVModuleDeckController.getState().reveal')==1
  pad.screenshot(path=str(OUT/'touch.png'));report['touch']='PASS'
  report['browser']=browser.version
  assert not report['errors'],report['errors']
  browser.close()
finally:
 if server:server.shutdown()
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
