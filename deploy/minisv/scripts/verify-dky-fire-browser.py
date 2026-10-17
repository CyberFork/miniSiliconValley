#!/usr/bin/env python3
"""Verify real pointer input in disposable anonymous contexts (no real student saves)."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:18218');p.add_argument('--output',default='/tmp/minisv-dky-fire/local');a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'base':a.base,'checks':[],'pageErrors':[]}
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for mode,query in [('native',''),('denied',''),('denied','?view=game'),('unsupported','?view=game')]:
        context=browser.new_context(viewport={'width':1280,'height':900})
        page=context.new_page();page.on('pageerror',lambda e: report['pageErrors'].append(str(e)))
        page.goto(a.base.rstrip('/')+'/showcase/2026-09/dky/play/'+query)
        page.wait_for_function("() => document.querySelector('#load-status').textContent.includes('已初始化')",timeout=90000)
        f=next(f for f in page.frames if '/runtime/game/' in f.url)
        if not query: page.locator('#fullscreen-frame').click()
        f.locator('#btnStart').click();f.locator('#introSkip').click();f.locator('#opGrid .op-card').first.click();f.locator('#opsConfirm').click()
        f.wait_for_function("() => curScreen==='game' && !!run")
        if mode=='denied':f.evaluate("() => {view.requestPointerLock=()=>Promise.reject(new DOMException('Test denial','NotAllowedError'));}")
        if mode=='unsupported':f.evaluate('view.requestPointerLock=undefined')
        ammo=f.evaluate('curAmmo()')
        f.locator('#lockHint').click()
        f.wait_for_function("() => getComputedStyle(lockHint).display==='none'")
        assert f.evaluate('curAmmo()')==ammo,'Entry click must not fire'
        locked=f.evaluate('document.pointerLockElement===view');
        if mode!='native': assert not locked
        box=f.locator('#view').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
        page.mouse.click(x,y)
        assert f.evaluate('curAmmo()')==ammo-1,'Click must consume one round'
        f.wait_for_function('() => run.fireCd<=0')
        if not locked:
            # Left drag turns but never fires; returning to origin must still count as dragging.
            direction=f.evaluate('[run.dx,run.dy]');before=f.evaluate('curAmmo()')
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+60,y,steps=5)
            assert f.evaluate('[run.dx,run.dy]')!=direction
            page.mouse.move(x,y,steps=5);page.mouse.up()
            assert f.evaluate('curAmmo()')==before
        page.mouse.down(button='right');assert f.evaluate('echoMode') is True
        page.mouse.up(button='right');assert f.evaluate('echoMode') is False
        # Combat really executes, not merely an ammo animation. Seed one isolated test target.
        f.evaluate("""() => { run.fireCd=0;run.reloading=0;const target=run.enemies[0]; Object.assign(target,{alive:true,lv:run.level,x:run.px+run.dx,y:run.py+run.dy,hp:999,hpMax:999});run.enemies=[target]; }""")
        page.mouse.click(x,y);assert f.evaluate('run.enemies[0].hp')<999
        # Reload remains available; incomplete reload cannot fire.
        page.keyboard.press('r');assert f.evaluate('run.reloading')>0
        before=f.evaluate('curAmmo()');page.mouse.click(x,y);assert f.evaluate('curAmmo()')==before
        f.wait_for_function('() => run.reloading<=0',timeout=10000);assert f.evaluate('curAmmo()===curGun().mag')
        if not locked:
            # Focus loss cancels pending clicks and held echo mode.
            page.mouse.down();f.evaluate("window.dispatchEvent(new Event('blur'))");page.mouse.up()
            assert f.evaluate('curAmmo()===curGun().mag')
            page.mouse.down(button='right');f.evaluate("window.dispatchEvent(new Event('blur'))");assert not f.evaluate('echoMode');page.mouse.up(button='right')
        page.screenshot(path=str(out/(mode+('-pure' if query else '-normal')+'.png')))
        report['checks'].append({'mode':mode,'pointerLocked':locked,'pure':bool(query),'entryDoesNotFire':True,'clickFires':True,'dragDoesNotFire':not locked,'rightHeldEcho':True,'damageApplied':True,'reload':True})
        context.close()
    assert not report['pageErrors'],report['pageErrors'];browser.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
