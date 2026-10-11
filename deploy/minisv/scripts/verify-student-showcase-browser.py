#!/usr/bin/env python3
"""Anonymous Playwright smoke. Synthetic names only, browser-local state only."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:18215');p.add_argument('--output',default='/tmp/minisv-showcase-browser');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'base':a.base,'checks':[],'pageErrors':[]};base=a.base.rstrip('/')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1440,'height':1000})
    page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
    def open_frame(student,kind):
        page.goto(f'{base}/showcase/2026-09/{student}/{kind}/');page.wait_for_function("() => document.querySelector('#student-frame').src.includes('/runtime/')")
        page.wait_for_timeout(400)
        f=next(f for f in page.frames if '/runtime/' in f.url)
        if kind=='play':f.wait_for_function("() => typeof MSV_SHOWCASE_STORAGE==='object'")
        return f
    def isolated(f):
        result=f.evaluate('''() => { const r={};for(const [key,fn] of Object.entries({cookie:()=>document.cookie,storage:()=>localStorage.length,parentDOM:()=>parent.document.title})){try{fn();r[key]=false}catch(e){r[key]=e.name==='SecurityError'}}return r;}''')
        assert all(result.values()),result
    f=open_frame('cwe','play');f.locator('#btn-switch-user').click();f.locator('dialog textarea').fill('QA-展示测试');f.locator('dialog button').first.click();page.wait_for_timeout(150)
    page.reload();page.wait_for_timeout(700);f=next(f for f in page.frames if '/runtime/' in f.url);f.wait_for_function("() => document.querySelector('#display-username').textContent==='QA-展示测试'")
    isolated(f);report['checks'].append('CWE nickname dialog + browser save/reload + iframe isolation')
    # Wrong keys and messages from any window other than the active student frame must not persist.
    f.evaluate("parent.postMessage({type:'minisv-showcase-save',key:'unrelated_site_key',value:'blocked'},'*')")
    page.evaluate("window.postMessage({type:'minisv-showcase-save',key:'kirby_cp_current_user_v1',value:'forged'},'*')")
    page.wait_for_timeout(100)
    assert page.evaluate("localStorage.getItem('minisv.showcase.2026-09.cwe.unrelated_site_key')") is None
    assert page.evaluate("localStorage.getItem('minisv.showcase.2026-09.cwe.kirby_cp_current_user_v1')")=='QA-展示测试'
    report['checks'].append('Storage key + message-source restrictions')
    f.locator('#btn-start-game').click();f.locator('canvas').wait_for(state='visible');f.locator('canvas').click(position={'x':500,'y':320});page.keyboard.down('w');page.wait_for_timeout(400);page.keyboard.up('w');page.keyboard.press('j');page.keyboard.press('Space')
    page.screenshot(path=str(out/'cwe-play.png'),full_page=True)
    f.locator('#btn-quit').click();f.locator('dialog button').first.click();page.wait_for_timeout(800);f=next(f for f in page.frames if '/runtime/' in f.url);f.locator('#btn-start-game').wait_for(state='visible');report['checks'].append('CWE start, keyboard inputs, return-to-menu/reload')
    f=open_frame('tzx','play');f.locator('#btn-start-game').click(timeout=30000);f.locator('.grade-card').first.click();f.locator('#btn-confirm-grade').click();f.locator('.char-card').first.click();f.locator('#btn-confirm-char').click()
    f.locator('#btn-retry-mic').wait_for(state='visible',timeout=20000);assert '不自动评分' in f.locator('#challenge-status-text').inner_text();f.locator('#btn-retry-mic').click();f.wait_for_function("() => !document.querySelector('#modal-english-challenge').classList.contains('active')")
    isolated(f);page.keyboard.press('Space');page.keyboard.down('w');page.wait_for_timeout(350);page.keyboard.up('w');page.screenshot(path=str(out/'tzx-play.png'),full_page=True)
    f.evaluate("MSV_SHOWCASE_STORAGE.setItem('phantom-game-progress',JSON.stringify({stars:7,coins:3}))");page.wait_for_timeout(100);page.reload();page.wait_for_timeout(1000);f=next(f for f in page.frames if '/runtime/' in f.url);f.wait_for_function("() => MSV_SHOWCASE_STORAGE.getItem('phantom-game-progress')!==null");assert json.loads(f.evaluate("MSV_SHOWCASE_STORAGE.getItem('phantom-game-progress')"))['stars']==7
    report['checks'].append('TZX start, grade/character, explicit self-reading completion, keyboard inputs, save/reload')
    for student in ['cwe','tzx']:
        f=open_frame(student,'slides');button='#btn-next' if student=='cwe' else '#btnNext';f.locator(button).click();page.wait_for_timeout(200)
        assert '02 / 10' in f.locator('body').inner_text();assert ('蔡玮恩' if student=='cwe' else '唐梓轩') in f.locator('body').inner_text()
        page.locator('#fullscreen-frame').click();page.wait_for_function('() => document.fullscreenElement!==null');page.evaluate('document.exitFullscreen()');page.screenshot(path=str(out/f'{student}-slides.png'),full_page=True)
        report['checks'].append(student+' slides name, next page, fullscreen')
    page.goto(f'{base}/showcase/2026-09/cwe/runtime/game/index.html');assert page.evaluate("(()=>{try{return localStorage.length}catch(e){return e.name}})()")=='SecurityError';report['checks'].append('Direct runtime HTTP sandbox')
    # Responsive outer pages, then real touchscreen UI events in emulated landscape viewport.
    for width in [390,768,1280]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['','cwe/','tzx/','cwe/play/','tzx/slides/']:
            page.goto(f'{base}/showcase/2026-09/'+route)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,route)
        page.screenshot(path=str(out/f'responsive-{width}.png'),full_page=True)
    mobile=browser.new_context(viewport={'width':1024,'height':768},has_touch=True,is_mobile=True,device_scale_factor=1);m=mobile.new_page();m.goto(f'{base}/showcase/2026-09/cwe/play/');m.wait_for_timeout(700);mf=next(f for f in m.frames if '/runtime/' in f.url);mf.locator('#btn-start-game').tap();mf.locator('canvas').wait_for(state='visible');m.screenshot(path=str(out/'touch-cwe.png'),full_page=True);mobile.close()
    report['checks'].append('390/768/1280 layouts no outer overflow + tablet-emulated touch start')
    assert not report['pageErrors'],report['pageErrors']
    browser.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
