#!/usr/bin/env python3
"""Isolated real D1 API + built P1/P2 pages. Never write to production course text."""
import json, os, secrets, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from verify_t090_development_mentor_browser import free_port, wait_ready
REPO=Path(__file__).resolve().parents[3]
OUT=Path(os.environ.get('EVIDENCE_DIR','/tmp/msv-text-edits-browser'));OUT.mkdir(parents=True,exist_ok=True)

def serve_assets(context,base):
    for folder,slug in [('module-thinking-deck','p1'),('ligun-deck','p2')]:
        root=REPO/'courseware'/folder/'dist'
        def route_asset(route,_request,root=root,slug=slug):
            from urllib.parse import urlsplit
            rel=urlsplit(route.request.url).path.split('/courseware/edit-'+slug+'/',1)[1]
            path=root/rel
            if path.is_dir():path=path/'index.html'
            assert path.resolve().is_relative_to(root.resolve())
            route.fulfill(path=str(path))
        context.route(base+'/courseware/edit-'+slug+'/**',route_asset)

def run(base,states):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  ctx=browser.new_context(storage_state=states['mentor'],viewport={'width':1600,'height':1000});serve_assets(ctx,base)
  errors=[]
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def open_deck(page,slug,session):
   page.goto(f'{base}/courseware/edit-{slug}/teacher/presenter.html?session={session}',wait_until='networkidle')
   expect(page.get_by_role('button',name='编辑课件文字',exact=True)).to_be_enabled()
  open_deck(page,'p1','writer')
  old=ctx.new_page();open_deck(old,'p1','unaffected')
  with page.expect_popup() as popup:page.get_by_role('button',name='打开投屏窗口',exact=True).click()
  audience=popup.value;audience.wait_for_load_state('networkidle')
  original=page.locator('#current-preview h1').inner_text()
  page.get_by_role('button',name='编辑课件文字',exact=True).click();page.locator('#current-preview h1').click()
  dialog=page.locator('dialog');expect(dialog).to_be_visible()
  value='合成测试：我的新标题'
  dialog.locator('textarea').fill(value)
  dialog.get_by_role('button',name='预览修改',exact=True).click()
  expect(page.locator('#current-preview h1')).to_have_text(value)
  expect(audience.locator('.slide-heading h1')).to_have_text(original)
  dialog.get_by_role('button',name='保存为新版',exact=True).click();expect(dialog).not_to_be_visible()
  expect(audience.locator('.slide-heading h1')).to_have_text(value)
  expect(old.locator('#current-preview h1')).to_have_text(original)
  page.reload(wait_until='networkidle');expect(page.locator('#current-preview h1')).to_have_text(value)
  fresh=browser.new_context(storage_state=states['mentor']);serve_assets(fresh,base)
  fresh_page=fresh.new_page();open_deck(fresh_page,'p1','new-device');expect(fresh_page.locator('#current-preview h1')).to_have_text(value)
  # A second stale teacher must see a conflict with their input retained.
  old.get_by_role('button',name='编辑课件文字',exact=True).click();old.locator('#current-preview h1').click()
  old.locator('dialog textarea').fill('不能覆盖新版')
  old.get_by_role('button',name='保存为新版',exact=True).click()
  expect(old.locator('dialog [role=alert]')).to_contain_text('新版')
  expect(old.locator('dialog textarea')).to_have_value('不能覆盖新版')
  old.get_by_role('button',name='取消',exact=True).click()
  # History preview does not rewrite latest.
  page.get_by_label('文字版本历史').select_option('0');expect(page.locator('#current-preview h1')).to_have_text(original)
  expect(page.get_by_role('button',name='编辑课件文字',exact=True)).to_be_disabled()
  page.get_by_role('button',name='加载最新文字版',exact=True).click();expect(page.locator('#current-preview h1')).to_have_text(value)
  # Plaintext XSS remains plaintext; actual body editing and cancellation.
  page.get_by_role('button',name='编辑课件文字',exact=True).click()
  paragraph=page.locator('#current-preview .slide-body [data-msv-text-key]').first
  before=paragraph.inner_text();paragraph.click()
  payload='<img src=x onerror="window.__text_xss=true">'
  page.locator('dialog textarea').fill(payload);page.get_by_role('button',name='保存为新版',exact=True).click();expect(dialog).not_to_be_visible()
  expect(page.locator('#current-preview .slide-body')).to_contain_text(payload)
  assert page.evaluate('window.__text_xss') is None
  assert page.locator('#current-preview img[src=x]').count()==0
  page.get_by_role('button',name='编辑课件文字',exact=True).click();page.locator('#current-preview .slide-body [data-msv-text-key]').first.click()
  page.get_by_role('button',name='恢复原文',exact=True).click();expect(page.locator('dialog textarea')).to_have_value(before)
  page.get_by_role('button',name='保存为新版',exact=True).click();expect(dialog).not_to_be_visible()
  # Scene navigation remains live and edit dialog doesn't swallow camera controls outside editing.
  page.locator('#slide-list button').nth(2).click()
  expect(page.locator('#current-preview canvas').first).to_be_visible(timeout=20000)
  page.screenshot(path=str(OUT/'teacher.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='编辑课件文字',exact=True).click();page.locator('#current-preview h1').click()
  expect(dialog).to_be_visible();box=dialog.bounding_box();assert box['x']>=0 and box['x']+box['width']<=391
  page.screenshot(path=str(OUT/'dialog-mobile.png'))
  page.get_by_role('button',name='取消',exact=True).click()
  # P2 uses the same editor without inheriting P1 edits.
  p2=ctx.new_page();open_deck(p2,'p2','p2-writer');expect(p2.locator('.msv-text-edit-status')).to_contain_text('v0')
  p2.get_by_role('button',name='编辑课件文字',exact=True).click();p2.locator('#current-preview h1').click()
  p2.locator('dialog textarea').fill('P2 独立新版');p2.get_by_role('button',name='保存为新版',exact=True).click();expect(p2.locator('dialog')).not_to_be_visible()
  expect(p2.locator('#current-preview h1')).to_have_text('P2 独立新版')
  # Server auth and same-origin checks against the actual API.
  catalog=json.loads((REPO/'app/lib/courseware-text-catalog.json').read_text());spec=catalog[0]
  endpoint=base+'/api/courseware/text-editions/'+spec['id']
  api=p.request.new_context(extra_http_headers={'Origin':base,'Cookie':'; '.join(c['name']+'='+c['value'] for c in states['learner']['cookies'])})
  read=api.get(endpoint+'?base='+spec['version']);assert read.status==200,(read.status,read.text())
  body={'base':spec['version'],'expectedRevision':3,'key':spec['slideIds'][0]+':title','value':'forbidden'}
  assert api.post(endpoint,data=body).status==403;api.dispose()
  anon=p.request.new_context();assert anon.get(endpoint+'?base='+spec['version']).status==401;anon.dispose()
  assert ctx.request.post(endpoint,data=body,headers={'Origin':'https://wrong.invalid','Cookie':'; '.join(c['name']+'='+c['value'] for c in states['mentor']['cookies'])}).status==403
  assert not errors,errors
  (OUT/'report.json').write_text(json.dumps({'p1':'PASS','p2':'PASS','persistAcrossDevices':'PASS','sameSessionSync':'PASS','otherSessionIsolation':'PASS','conflictRetainsInput':'PASS','history':'PASS','plainTextXss':'PASS','authCsrf':'PASS','threeScene':'PASS','errors':errors},indent=2))
  browser.close()
 print('COURSEWARE_TEXT_EDIT_BROWSER_PASS')

def main():
 with tempfile.TemporaryDirectory(prefix='msv-text-edits-') as temp:
  root=Path(temp);pw=secrets.token_urlsafe(20)
  fixture={'dm':{'username':'edit-admin','password':pw},'mentors':[{'username':'edit-mentor','password':pw}],'learners':[{'username':'edit-learner','password':pw}],'outsider':{'username':'edit-observer','password':pw}}
  (root/'accounts.json').write_text(json.dumps(fixture));env={**os.environ,'CI':'1','WRANGLER_SEND_METRICS':'false'}
  subprocess.run(['node_modules/.bin/tsx','scripts/generate-auth-seed.ts','--accounts',str(root/'accounts.json'),'--output',str(root/'seed.sql')],cwd=REPO,env=env,check=True,capture_output=True)
  subprocess.run(['node_modules/.bin/wrangler','d1','execute','DB','--yes','--json','--local','--persist-to',temp,'--config','dist/server/wrangler.json','--file',str(root/'seed.sql')],cwd=REPO,env=env,check=True,capture_output=True)
  port=free_port();base=f'http://127.0.0.1:{port}'
  with (root/'server.log').open('w') as log:
   proc=subprocess.Popen([str(REPO/'node_modules/.bin/wrangler'),'dev','--config','wrangler.json','--persist-to',temp,'--ip','127.0.0.1','--port',str(port),'--no-show-interactive-dev-session'],cwd=REPO/'dist/server',env=env,stdout=log,stderr=subprocess.STDOUT)
   try:
    wait_ready(port,proc,root/'server.log');states={}
    with sync_playwright() as p:
     for role in ['mentor','learner']:
      api=p.request.new_context(base_url=base,extra_http_headers={'Origin':base});assert api.post('/api/auth/login',data={'username':'edit-'+role,'password':pw}).status==200;states[role]=api.storage_state();api.dispose()
    run(base,states)
   finally:proc.terminate();proc.wait(timeout=20)
if __name__=='__main__':main()
