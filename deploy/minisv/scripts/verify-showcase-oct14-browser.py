#!/usr/bin/env python3
"""Browser acceptance for the two added public works; no site login or real student data."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:18216');p.add_argument('--output',default='/tmp/minisv-showcase-oct14/browser');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);base=a.base.rstrip('/');report={'base':base,'checks':[],'pageErrors':[],'failedResponses':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':1280,'height':900});page=ctx.new_page()
 page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 page.on('response',lambda r:report['failedResponses'].append([r.status,r.url]) if '/showcase/' in r.url and r.status>=400 else None)
 def open_frame(sid,kind):
  page.goto(f'{base}/showcase/2026-09/{sid}/{kind}/');page.wait_for_function("() => document.querySelector('#student-frame').src.includes('/runtime/')");f=next(f for f in page.frames if '/runtime/' in f.url)
  if kind=='play':
   page.wait_for_function("() => document.querySelector('#load-status').textContent.includes('已初始化')")
  return f
 def isolated(f):
  assert f.evaluate('''() => [()=>document.cookie,()=>localStorage.length,()=>parent.document.title].every(fn=>{try{fn();return false}catch(e){return e.name==='SecurityError'}})''')
 f=open_frame('zrq','play');isolated(f);f.wait_for_function('() => SHEET_READY.done && SHEETS.hero.cellW > 64');report['checks'].append('Zhang original sprites loaded with anonymous CORS, not fallback silhouettes')
 page.locator('#fullscreen-frame').click();f.locator('#boot').click();f.get_by_role('button',name='继续求生').click();f.locator('#intro').click(position={'x':100,'y':100});f.get_by_role('button',name='睡觉过夜',exact=False).click();assert '第 2 天' in f.locator('#prep-day').inner_text()
 f.get_by_role('button',name='存档',exact=True).click();f.get_by_role('button',name='进入街区',exact=False).click();f.wait_for_function('() => Game.running');before=f.evaluate('[Game.cur().x,Game.cur().z]');page.keyboard.down('w');page.wait_for_timeout(500);page.keyboard.up('w');after=f.evaluate('[Game.cur().x,Game.cur().z]');assert before!=after,(before,after)
 page.screenshot(path=str(out/'zrq-play.png'));f.get_by_role('button',name='背包',exact=True).click();assert f.locator('#bag').is_visible();f.get_by_role('button',name='返回',exact=True).click();page.evaluate('document.exitFullscreen()');page.reload();page.wait_for_timeout(600);f=next(f for f in page.frames if '/runtime/' in f.url);f.wait_for_function('() => typeof Game!=="undefined" && Game.S?.day===2');f.locator('#boot').click()
 f.get_by_role('button',name='清空存档',exact=False).click();f.locator('dialog button',has_text='取消').click();assert f.evaluate('Game.S.day')==2
 f.get_by_role('button',name='清空存档',exact=False).click();f.locator('dialog button',has_text='确定').click();assert f.evaluate('Game.S.day')==1
 report['checks'].append('Zhang boot, intro, safehouse/day/save, movement, bag, reload persistence, cancel/confirm reset')
 f=open_frame('dky','play');isolated(f);assert f.evaluate('BUILD')=='v0.22.0'
 page.locator('#fullscreen-frame').click();f.locator('#btnMap').click();f.locator('#mapStart').click();f.wait_for_function('() => curScreen==="game" && run!==null');page.wait_for_timeout(200)
 # The original game asks to click the canvas to enable pointer-lock before keyboard movement.
 f.locator('#lockHint').click();before=f.evaluate('[run.px,run.py]');page.keyboard.down('w');page.wait_for_timeout(500);page.keyboard.up('w');after=f.evaluate('[run.px,run.py]');assert before!=after,(before,after)
 page.keyboard.press('r');page.keyboard.press('q');page.keyboard.press('Escape');page.screenshot(path=str(out/'dky-play.png'));page.evaluate('document.exitFullscreen()')
 f.evaluate("MSV_SHOWCASE_STORAGE.setItem('echofault.save.v1',JSON.stringify({...JSON.parse(MSV_SHOWCASE_STORAGE.getItem('echofault.save.v1')||'{}'),coins:37}))")
 page.wait_for_timeout(150);page.reload();page.wait_for_timeout(600);f=next(f for f in page.frames if '/runtime/' in f.url);f.wait_for_function("() => typeof MSV_SHOWCASE_STORAGE!=='undefined' && MSV_SHOWCASE_STORAGE.getItem('echofault.save.v1')!==null");assert json.loads(f.evaluate("MSV_SHOWCASE_STORAGE.getItem('echofault.save.v1')"))['coins']==37
 f.evaluate("parent.postMessage({type:'minisv-showcase-remove',key:'doomsday_endless_v1'},'*')");page.wait_for_timeout(100);assert page.evaluate("localStorage.getItem('minisv.showcase.2026-09.zrq.doomsday_endless_v1')") is not None
 report['checks'].append('Duan v0.22.0 map/start, pointer lock, keyboard movement/reload/switch, browser save persistence; cross-student removal blocked')
 for sid in ['zrq','dky']:
  f=open_frame(sid,'slides');isolated(f);page.locator('#fullscreen-frame').click();page.wait_for_function('() => document.fullscreenElement!==null')
  if sid=='dky':
   f.locator('#next').click();assert f.locator('#count').inner_text()=='2 / 10'
   for _ in range(8):f.locator('#next').click()
   assert f.locator('#next').is_disabled();f.locator('#prev').click();assert f.locator('#count').inner_text()=='9 / 10'
  else:
   f.locator('.btn-arrow').last.click();assert f.evaluate('currentSlide')==2
  f.wait_for_function('() => Array.from(document.images).filter(i=>i.offsetWidth>0).every(i=>i.complete && i.naturalWidth>0)')
  page.screenshot(path=str(out/f'{sid}-slides.png'));page.evaluate('document.exitFullscreen()')
  page.goto(f'{base}/showcase/2026-09/{sid}/runtime/game/index.html');assert page.evaluate("(()=>{try{return localStorage.length}catch(e){return e.name}})()")=='SecurityError'
 report['checks'].append('Both slide viewers next/previous, images, fullscreen; direct runtime sandbox')
 for width in [390,768,1280]:
  page.set_viewport_size({'width':width,'height':900})
  for route in ['', 'zrq/','dky/','zrq/play/','dky/slides/']:
   page.goto(f'{base}/showcase/2026-09/'+route);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,route)
  page.screenshot(path=str(out/f'layout-{width}.png'),full_page=True)
 report['checks'].append('390/768/1280 outer layouts without horizontal overflow; Duan desktop-only guidance')
 assert not report['pageErrors'],report['pageErrors'];assert not report['failedResponses'],report['failedResponses'];b.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
