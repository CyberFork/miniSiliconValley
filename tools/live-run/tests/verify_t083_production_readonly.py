#!/usr/bin/env python3
"""Authenticated GET-only production acceptance for the T-083 Course Studio.

Credentials are accepted only through environment variables and are never
printed or persisted. Mutation monitoring starts immediately after login.
"""
from __future__ import annotations
import json, os
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import expect, sync_playwright

ORIGIN=os.environ.get('MSV_QA_ORIGIN','https://minisv.vip').rstrip('/')
USERNAME=os.environ.get('MSV_QA_USERNAME', '')
PASSWORD=os.environ.get('MSV_QA_PASSWORD', '')
EXPECTED=os.environ.get('MSV_QA_RELEASE', '')
EXPECTED_MAIN=os.environ.get('MSV_QA_MAIN_SHA', '')
SCREENSHOT=os.environ.get('MSV_QA_SCREENSHOT', '/tmp/t083-production-studio.png')
if not USERNAME or not PASSWORD or not EXPECTED:
    raise SystemExit('Set MSV_QA_USERNAME, MSV_QA_PASSWORD and MSV_QA_RELEASE; values are never logged.')
CHROME=Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
result={'ok':False,'origin':ORIGIN,'mode':'authenticated-read-only','mutations':[]}
with sync_playwright() as p:
    opts={'headless':True}
    if CHROME.exists(): opts['executable_path']=str(CHROME)
    browser=p.chromium.launch(**opts)
    context=browser.new_context(viewport={'width':1440,'height':1000})
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    return_to=quote('/control/editor/?course=google-1995-2004',safe='')
    page.goto(f'{ORIGIN}/auth/login?returnTo={return_to}',wait_until='networkidle')
    page.locator('input[name="username"]').fill(USERNAME)
    page.locator('input[name="password"]').fill(PASSWORD)
    page.get_by_role('button',name='进入 Mini Silicon Valley →').click()
    page.wait_for_url('**/control/editor/**',timeout=20000)
    page.wait_for_selector('#packageHealth[data-state="ok"]',timeout=20000)
    def watch(req):
        if req.method not in ('GET','HEAD','OPTIONS'):
            result['mutations'].append({'method':req.method,'url':req.url})
    page.on('request',watch)
    health=page.locator('#packageHealth')
    expect(health).to_contain_text('5 步 / 13 块')
    expect(health).to_contain_text('60')
    expect(health).to_contain_text('t083-nine-pane-studio-r1')
    expect(health).to_contain_text(EXPECTED)
    expect(page.locator('#studioTab')).to_have_attribute('aria-selected','true')
    expect(page.locator('#studioPane')).to_be_visible()
    assert page.locator('.timeline-step').count()==5
    assert page.locator('.timeline-block').count()==13
    assert page.locator('.seat-preview-card').count()==8
    assert page.locator('.seat-preview-card:visible').count()==8
    assert page.locator('.shared-controller').count()==1
    expect(page.locator('#projectionStamp')).to_contain_text('9/9 同步')
    assert page.get_by_text('本块由你主导',exact=True).count()==1
    assert page.locator('[data-preview-seat^="mentor"] .private-card').count()==0
    learner_cards=page.locator('[data-preview-seat^="learner"] .private-card')
    ids=learner_cards.evaluate_all('nodes => nodes.map(n => n.dataset.cardId)')
    assert len(ids)==12 and len(set(ids))==12,(len(ids),len(set(ids)))

    page.locator('[data-preview-block="12"]').click()
    expect(page.locator('#projectionStamp')).to_contain_text('B13')
    assert page.locator('.msv-seat-surface[data-block-id="B13"]').count()==8
    expect(page.locator('#previewController .shared-controller')).to_have_attribute('data-block-id','B13')
    visible_by_layout={}
    for layout, expected in [('overview',8),('mentors',4),('learners',4),('focus',1),('compare',2)]:
        page.locator(f'button[data-layout="{layout}"]').click()
        count=page.locator('.seat-preview-card:visible').count()
        assert count==expected,(layout,count)
        visible_by_layout[layout]=count
    page.locator('button[data-layout="overview"]').click()

    page.locator('[data-preview-block="0"]').click()
    page.locator('#previewSeed').fill('PROD-READONLY-SEED')
    deal_a=page.locator('[data-preview-seat^="learner"] .private-card').evaluate_all('nodes => nodes.map(n => n.dataset.cardId)')
    page.locator('#previewSeed').fill('TEMP-SEED')
    page.locator('#previewSeed').fill('PROD-READONLY-SEED')
    deal_b=page.locator('[data-preview-seat^="learner"] .private-card').evaluate_all('nodes => nodes.map(n => n.dataset.cardId)')
    assert deal_a==deal_b and len(set(deal_a))==12

    page.locator('#previewController [data-course-path="blocks.0.title"]').click()
    expect(page.locator('#fieldPath')).to_have_text('blocks.0.title')
    expect(page.locator('#fieldDialog')).to_have_attribute('data-readonly','false')
    page.locator('#fieldClose').click()
    page.locator('.surface-metric [data-derived-explain]').first.click()
    expect(page.locator('#fieldDialog')).to_have_attribute('data-readonly','true')
    expect(page.locator('#fieldPath')).to_have_text('无 Course Package 写入路径')
    page.locator('#fieldClose').click()

    viewports={}
    for width in (1440,1180,768,430,390):
        page.set_viewport_size({'width':width,'height':900}); page.wait_for_timeout(60)
        g=page.evaluate('''() => ({inner:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth,visible:[...document.querySelectorAll('.seat-preview-card')].filter(n=>getComputedStyle(n).display!=='none').length,font:parseFloat(getComputedStyle(document.querySelector('.msv-seat-surface')).fontSize)})''')
        assert g['body']<=g['inner']+1 and g['root']<=g['inner']+1,g
        assert g['visible']==8 and g['font']>=12,g
        viewports[str(width)]=g
    page.set_viewport_size({'width':1440,'height':1000})
    page.screenshot(path=SCREENSHOT,full_page=False)

    api=page.evaluate('''async () => {
      const ids=['google-1995-2004','eleme-2008-find-problem']; const courses={};
      for (const id of ids) { const body=await fetch(`../api/courses/${id}?variant=draft`,{cache:'no-store'}).then(r=>r.json()); courses[id]={ok:body.ok,metadata:body.data?.metadata,course:body.data?.course}; }
      const release=await fetch('/release.json',{cache:'no-store'}).then(r=>r.json());
      const bootstrap=await fetch('../api/bootstrap',{cache:'no-store'}).then(r=>r.json());
      return {courses,release,bootstrap:{ok:bootstrap.ok,build:bootstrap.data?.editorBuild,schema:bootstrap.data?.courseSchemaVersion}};
    }''')
    assert api['release']['release']==EXPECTED
    if EXPECTED_MAIN:
        assert api['release']['sources']['main']==EXPECTED_MAIN
    assert api['bootstrap']=={'ok':True,'build':'t083-nine-pane-studio-r1','schema':1}
    packages={}
    for cid,item in api['courses'].items():
        assert item['ok']
        m=item['metadata']; counts=(m['macroStepCount'],m['blockCount'],m['deckCount'],m['cardCount'])
        assert counts==(5,13,5,60),(cid,counts)
        c=item['course']
        for block in c['blocks']:
            active=[seat for seat in ('mentor01','mentor02','mentor03','mentor04') if block['seatTasks'][seat]['state']=='active']
            assert active==[block['leadMentorId']],(cid,block['id'],active)
        packages[cid]={'macroSteps':5,'blocks':13,'decks':5,'cards':60,'revision':m['revision'],'digest':m['digest']}
    assert not errors,errors
    assert result['mutations']==[],result['mutations']
    result.update({'ok':True,'release':EXPECTED,'editorBuild':'t083-nine-pane-studio-r1','defaultMode':'nine-pane','atomicViews':9,'layouts':visible_by_layout,'deterministicDeal':{'learners':4,'cardsPerLearner':3,'unique':12},'roleIsolation':True,'sourcePathEditing':True,'derivedReadOnly':True,'viewports':viewports,'packages':packages,'consoleErrors':errors,'screenshot':SCREENSHOT,'mainSha':api['release']['sources']['main']})
    browser.close()
print(json.dumps(result,ensure_ascii=False,indent=2))
