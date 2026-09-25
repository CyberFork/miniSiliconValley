"""Isolated courseware-only browser checks; never contacts production APIs."""
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from pypdf import PdfReader
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.getenv('MSV_DECK_EVIDENCE', '/tmp/msv-p132-p133-evidence'))
OUT.mkdir(parents=True, exist_ok=True)
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Layout regression uses the original edition; real API save tests live
        # in verify_courseware_text_edits_browser.py (no API mocking there).
        if self.path.startswith("/api/courseware/text-editions/"):
            body=json.dumps({"ok":True,"data":{"edition":{"revision":0,"patches":{}},"latestRevision":0,"history":[]}}).encode()
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(body);return
        super().do_GET()
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'
CHROME = os.getenv('MSV_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
AUDIT = r'''root => {
 const parse = v => {const a=v.match(/[\d.]+/g)?.map(Number)||[];return [a[0]||0,a[1]||0,a[2]||0,a[3]??1]};
 const lum = ([r,g,b])=>{const f=v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4;return .2126*f(r)+.7152*f(g)+.0722*f(b)};
 const textNodes=[...root.querySelectorAll('*')].filter(n=>[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).opacity!=='0');
 const contrast=[];
 for(const n of textNodes){let bg=n,b=[0,0,0,0];while(bg){b=parse(getComputedStyle(bg).backgroundColor);if(b[3]>.95)break;bg=bg.parentElement;}const s=getComputedStyle(n),a=lum(parse(s.color)),z=lum(b),ratio=(Math.max(a,z)+.05)/(Math.min(a,z)+.05),min=parseFloat(s.fontSize)>=24?3:4.5;if(ratio<min)contrast.push({text:n.textContent.slice(0,40),ratio,min});}
 const body=root.querySelector('.slide-body'),heading=root.querySelector('.slide-heading');
 const overflow=body.scrollHeight>body.clientHeight+1||body.scrollWidth>body.clientWidth+1;
 const headingOverlap=heading.getBoundingClientRect().bottom>body.getBoundingClientRect().top+1;
 const grid=body.querySelector('.lesson-grid'),banner=body.querySelector('.lesson-banner'),link=body.querySelector('.lesson-link');
 const intersections=[];
 if(grid&&banner&&grid.getBoundingClientRect().bottom>banner.getBoundingClientRect().top+1)intersections.push('grid/banner');
 if(banner&&link&&banner.getBoundingClientRect().bottom>link.getBoundingClientRect().top+1)intersections.push('banner/link');
 return {contrast,overflow,headingOverlap,intersections};
}'''
errors=[]
report={'decks':[], 'screenshots':[], 'pdfs':[]}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True, executable_path=CHROME)
  context=browser.new_context(viewport={'width':1600,'height':1000}, permissions=['clipboard-read','clipboard-write'])
  def page_new(ctx=context):
   page=ctx.new_page();page.set_default_timeout(12000)
   page.on('pageerror',lambda error: errors.append(str(error)))
   page.on('response',lambda response: errors.append(f'HTTP {response.status}: {response.url}') if response.status>=400 else None)
   page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
   return page
  teacher_pages={}
  for name,count in [('module-thinking-deck',26),('ligun-deck',28)]:
   base=f'{BASE}/{name}/dist'; teacher=page_new();teacher.goto(base+'/teacher/presenter.html?session=shared-name',wait_until='networkidle');teacher_pages[name]=teacher
   with context.expect_page() as popup: teacher.click('#open-audience')
   audience=popup.value;audience.wait_for_load_state('networkidle')
   audience.on('pageerror',lambda error:errors.append(str(error)))
   assert audience.locator('#slide-jump option').count()==count
   teacher.click('#next-slide');audience.wait_for_function('MSVModuleDeckController.getState().slide===1')
   teacher.locator('#slide-list button').nth(4).click();audience.wait_for_function('MSVModuleDeckController.getState().slide===4')
   audience.locator('#slide-jump').select_option('6');teacher.wait_for_function('MSVModulePresenterController.getState().slide===6')
   # Native selection arrows must not accidentally flip the slide.
   audience.locator('#slide-jump').focus();audience.keyboard.press('ArrowLeft');assert audience.evaluate('MSVModuleDeckController.getState().slide')==6
   teacher.click('#timer-toggle');initial=teacher.locator('#timer-value').inner_text();teacher.wait_for_function('text=>document.getElementById("timer-value").textContent!==text',arg=initial)
   teacher.click('#timer-toggle');paused=teacher.locator('#timer-value').inner_text();teacher.wait_for_timeout(1100);assert teacher.locator('#timer-value').inner_text()==paused
   teacher.click('#timer-reset');assert teacher.locator('#timer-value').inner_text()==initial
   teacher.reload(wait_until='networkidle');assert teacher.evaluate('MSVModulePresenterController.getState().slide')==6
   assert teacher.locator('#note-goal').inner_text()
   for index in range(count):
    teacher.evaluate('i=>MSVModulePresenterController.setState({slide:i,reveal:99})',index)
    audience.wait_for_function('i=>MSVModuleDeckController.getState().slide===i',arg=index)
    audience.wait_for_timeout(310)
    for page,selector in [(audience,'.deck-slide'),(teacher,'#current-preview .deck-slide')]:
     audit=page.locator(selector).evaluate(AUDIT)
     assert not audit['contrast'] and not audit['overflow'] and not audit['headingOverlap'] and not audit['intersections'],(name,index,selector,audit)
    if index in ([1,3,5,19,24] if count==26 else [3,5,10,17,22,26]):
     dest=OUT/f'{name}-{index+1:02}.png';audience.locator('.deck-slide').screenshot(path=str(dest));report['screenshots'].append(str(dest))
   resource=teacher.locator('.lesson-timer a').get_attribute('href');assert '/audience/' in resource
   assert context.request.get(resource).status==200
   assert not any('presenter-notes' in x for x in audience.evaluate("performance.getEntriesByType('resource').map(x=>x.name)"))
   report['decks'].append({'name':name,'slides':count,'surfaces':2,'contrast':'PASS','overflow':'PASS','sync':'PASS','buildDigest':json.loads((ROOT/name/'dist/BUILD-MANIFEST.json').read_text())['digest']})
   teacher.screenshot(path=str(OUT/f'{name}-teacher.png'),full_page=True)
   audience.close()
  # Same named session, different decks: no position or state cross-talk.
  p1=teacher_pages['module-thinking-deck'];p2=teacher_pages['ligun-deck']
  before=p1.evaluate('MSVModulePresenterController.getState().slide')
  p2.click('#slide-list button:first-child');p1.wait_for_timeout(200);assert p1.evaluate('MSVModulePresenterController.getState().slide')==before
  # Legacy numeric references still land on the original S05, now reordered.
  legacy=page_new();legacy.goto(f'{BASE}/module-thinking-deck/dist/audience/index.html?session=legacy&slide=6')
  assert legacy.locator('.deck-slide').get_attribute('data-source')=='S05'
  legacy.goto(f'{BASE}/module-thinking-deck/dist/audience/index.html?session=legacy&slideId=module-my-card')
  assert legacy.locator('.deck-slide').get_attribute('data-slide-id')=='module-my-card'
  legacy.close()
  for page in teacher_pages.values():page.close()
  # Storage-event transport fallback without BroadcastChannel.
  fallback_context=browser.new_context(viewport={'width':1440,'height':900})
  fallback_context.add_init_script('window.BroadcastChannel=undefined')
  ft=page_new(fallback_context);ft.goto(f'{BASE}/ligun-deck/dist/teacher/presenter.html?session=fallback')
  with fallback_context.expect_page() as popup:ft.click('#open-audience')
  fa=popup.value;fa.wait_for_load_state('networkidle');ft.click('#next-slide');fa.wait_for_function('MSVModuleDeckController.getState().slide===1');fallback_context.close()
  # Real editable-template interactions; clipboard and download must carry actual edits.
  workbook=page_new();workbook.goto(f'{BASE}/ligun-deck/dist/audience/workbook/index.html',wait_until='networkidle')
  docs=workbook.evaluate('MSV_PROMPT_TEMPLATES.map(d=>({id:d.id,text:d.text}))')
  master_index=next(i for i,d in enumerate(docs) if d['id']=='master-rod')
  workbook.select_option('#template',str(master_index));modified=workbook.input_value('#text')+'\n我的游戏：飞行猫';workbook.fill('#text',modified)
  workbook.click('#copy');assert workbook.evaluate('navigator.clipboard.readText()')==modified
  workbook.select_option('#template','0');workbook.select_option('#template',str(master_index));assert workbook.input_value('#text')==modified
  for i,doc in enumerate(docs):
   if doc['id'].startswith('campus-') and doc['id']!='campus-master':
    workbook.select_option('#template',str(i));workbook.click('#copy');assert workbook.evaluate('navigator.clipboard.readText()')==doc['text']
  workbook.click('#add');workbook.fill('#title','我的飞行模块');workbook.fill('#text','## 执行者\n这是我的新子棍')
  workbook.click('#copy');assert workbook.evaluate('navigator.clipboard.readText()').endswith('这是我的新子棍')
  with workbook.expect_download() as download:workbook.click('#download')
  assert '这是我的新子棍' in Path(download.value.path()).read_text()
  with workbook.expect_download() as download:workbook.click('#download-all')
  content=Path(download.value.path()).read_text();assert '我的飞行模块' in content and '我的游戏：飞行猫' in content
  # denied clipboard falls back to actual selected text, never false success.
  workbook.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('test denial')}}})")
  workbook.click('#copy');assert '手动复制' in workbook.inner_text('#status')
  assert workbook.locator('#text').evaluate('e=>e.selectionEnd-e.selectionStart')==len(workbook.input_value('#text'))
  workbook.evaluate('window.print=()=>{}');workbook.click('#print');workbook.emulate_media(media='print');assert workbook.locator('#print-content').is_visible();assert not workbook.locator('main').is_visible();workbook.emulate_media(media='screen')
  workbook.screenshot(path=str(OUT/'p2-workbook.png'),full_page=True)
  # True playable game: real controls, repeat pickup, same check button in both versions.
  game=page_new();game.goto(f'{BASE}/ligun-deck/dist/audience/demo/index.html',wait_until='networkidle')
  game.keyboard.press('ArrowRight');game.keyboard.press('ArrowLeft');game.keyboard.press('ArrowRight');assert '数量 2' in game.inner_text('#bag')
  game.click('#check');assert game.locator('#checks .failed').count()==2
  game.select_option('#version','fixed');game.click('[data-move=right]');game.click('[data-move=left]');game.click('[data-move=right]');assert '数量 1' in game.inner_text('#bag')
  before=game.inner_text('#bag');game.click('#check');assert game.locator('#checks .passed').count()==7 and game.inner_text('#bag')==before
  game.click('#reset')
  for direction in ['right','right','right','right','down','down','down','down','down','left','right','right']:game.click(f'[data-move={direction}]')
  assert '已获胜' in game.inner_text('#log')
  game.screenshot(path=str(OUT/'p2-game-verified.png'),full_page=True)
  # Four independent A4 content drafts render to one page each.
  printable=page_new()
  for name in ['quick-start','module-map','interface-card','validation-record']:
   printable.goto(f'{BASE}/module-thinking-deck/dist/audience/printables/{name}.html',wait_until='networkidle')
   dest=OUT/f'{name}.pdf';printable.pdf(path=str(dest),prefer_css_page_size=True,print_background=True)
   assert len(PdfReader(dest).pages)==1,(name,'A4 overflow')
   report['pdfs'].append(str(dest))
  # Touch and responsive utility pages; projection still scales one 16:9 stage.
  mobile_context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  mobile=page_new(mobile_context)
  for path in ['ligun-deck/dist/audience/index.html','ligun-deck/dist/audience/workbook/index.html','ligun-deck/dist/audience/demo/index.html','module-thinking-deck/dist/audience/printables/index.html']:
   mobile.goto(f'{BASE}/{path}',wait_until='networkidle');assert mobile.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),path
  mobile.goto(f'{BASE}/ligun-deck/dist/audience/demo/index.html');mobile.tap('[data-move=right]');assert '数量 1' in mobile.inner_text('#bag')
  mobile.select_option('#version','fixed');mobile.tap('#check');assert mobile.locator('#checks .passed').count()==7
  assert not errors,errors
  report['interactions']=['dual-display','directory','keyboard','timer','refresh','deck/session isolation','legacy links','clipboard + denied fallback','custom child + download','print','game failure + fix + full path','touch']
  report['manualAcceptance']='NOT SIGNED; rehearsal and physical projector remain human review'
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  browser.close()
finally:
 server.shutdown()
print('T-132/T-133 real-browser checks PASS: 54 pages × 2 surfaces, copy/edit/download, playable demo, 4 A4 PDFs, touch; '+str(OUT))
