#!/usr/bin/env python3
"""Craft-table UI regression in isolated anonymous browser contexts; synthetic inventory only."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:18218');p.add_argument('--output',default='/tmp/minisv-craft-table/browser');a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);base=a.base.rstrip('/');report={'base':base,'checks':[],'pageErrors':[]}
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for label,query,touch in [('normal','',False),('pure','?view=game',False),('tablet','?view=game',True)]:
        context=browser.new_context(viewport={'width':1024 if touch else 1280,'height':768 if touch else 900},has_touch=touch)
        page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
        page.goto(f'{base}/showcase/2026-09/zrq/play/{query}');page.wait_for_function("() => document.querySelector('#load-status').textContent.includes('已初始化')")
        f=next(f for f in page.frames if '/runtime/game/' in f.url)
        if not query:page.locator('#fullscreen-frame').click()
        def click(locator):
            locator.tap() if touch else locator.click()
        click(f.locator('#boot'));click(f.get_by_role('button',name='继续求生'));click(f.locator('#intro'))
        f.wait_for_function("() => document.querySelector('#prep').classList.contains('active')")
        # Seed only this disposable browser's in-memory test state, never a user's saved game.
        f.evaluate("() => { Game.S.bag={cloth:3,alcohol:2,metal:3,wood:1}; }")
        click(f.get_by_role('button',name='背包与合成',exact=True));click(f.locator('[data-tab="craft"]'))
        assert f.evaluate('UI.tab')=='craft'
        assert f.locator('#bag-grid [data-recipe]').count()==f.evaluate('RECIPES.length')==6
        before=f.evaluate('({bag:{...Game.S.bag},crafts:Game.S.stats.crafts})')
        click(f.locator('[data-recipe="r_bandage_hi"]'))
        after=f.evaluate('({bag:{...Game.S.bag},crafts:Game.S.stats.crafts})')
        assert after['bag']['cloth']==before['bag']['cloth']-2 and after['bag']['alcohol']==before['bag']['alcohol']-1
        assert after['bag']['bandage_hi']==1 and after['crafts']==before['crafts']+1
        # A second attempt lacks cloth: no material/output/stat mutation.
        click(f.locator('[data-recipe="r_bandage_hi"]'))
        assert f.evaluate('({bag:{...Game.S.bag},crafts:Game.S.stats.crafts})')==after
        page.screenshot(path=str(out/f'{label}-craft.png'))
        click(f.locator('#bag-tabs [data-tab="bag"]'));assert f.evaluate('UI.tab')=='bag'
        assert f.locator('#bag-grid').evaluate('(g)=>g.style.gridTemplateColumns')==''
        assert f.locator('#bag-grid [data-item="bandage_hi"]').count()==1
        click(f.get_by_role('button',name='返回',exact=True));assert f.locator('#prep').is_visible()
        click(f.get_by_role('button',name='背包与合成',exact=True));click(f.locator('[data-tab="craft"]'))
        assert f.locator('#bag-grid [data-recipe]').count()==6
        click(f.get_by_role('button',name='返回',exact=True));assert f.locator('#prep').is_visible()
        report['checks'].append({'mode':label,'sixRecipes':True,'craftConsumesAndProduces':True,'insufficientMaterialsNoMutation':True,'bagGridRestored':True,'reopenAndReturn':True})
        context.close()
    assert not report['pageErrors'],report['pageErrors'];browser.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
