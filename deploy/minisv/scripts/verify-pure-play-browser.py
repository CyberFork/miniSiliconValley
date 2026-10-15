#!/usr/bin/env python3
"""Pure-play shares: no Fullscreen API, isolated storage retained, no real student data."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:18218');p.add_argument('--output',default='/tmp/minisv-pure-play/local');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);base=a.base.rstrip('/');report={'base':base,'checks':[],'pageErrors':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 c=b.new_context(viewport={'width':1280,'height':900},permissions=['clipboard-read','clipboard-write']);page=c.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 # Prove that pure play never needs native fullscreen support.
 page.add_init_script("Element.prototype.requestFullscreen=()=>Promise.reject(Error('unsupported'))")
 def open_game(url):
  page.goto(url);page.wait_for_function("()=>document.querySelector('#load-status').textContent.includes('已初始化')",timeout=45000)
  return next(f for f in page.frames if '/runtime/' in f.url)
 def fills():
  rect=page.locator('#student-frame').bounding_box();size=page.viewport_size
  assert abs(rect['x'])<1 and abs(rect['y'])<1 and abs(rect['width']-size['width'])<1 and abs(rect['height']-size['height'])<1,(rect,size)
  assert page.evaluate('document.fullscreenElement===null')
  assert page.locator('.top').is_hidden() and page.locator('.hero').is_hidden() and page.locator('.frame-head').is_hidden() and page.locator('.footer').is_hidden()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1 && document.documentElement.scrollHeight<=innerHeight+1')
 for sid in ['cwe','tzx','zrq','dky']:
  normal=f'{base}/showcase/2026-09/{sid}/play/';pure=normal+'?view=game'
  open_game(normal);assert page.locator('.top').is_visible()
  page.locator('#copy-link').click();page.wait_for_function("()=>document.querySelector('#load-status').textContent.includes('纯游戏链接已复制')")
  assert page.evaluate('navigator.clipboard.readText()')==pure
  assert page.locator('.pure-play-link').get_attribute('href')=='?view=game'
  page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}})")
  page.locator('#copy-link').click();assert page.get_by_label('分享链接').input_value()==pure
  f=open_game(pure)
  assert f.evaluate("()=>[()=>document.cookie,()=>localStorage.length,()=>parent.document.title].every(fn=>{try{fn();return false}catch(e){return e.name==='SecurityError'}})")
  for width,height in [(1280,900),(768,1024),(390,844)]:
   page.set_viewport_size({'width':width,'height':height});fills();page.screenshot(path=str(out/f'{sid}-{width}.png'))
  page.set_viewport_size({'width':1280,'height':900})
  if sid=='cwe':
   f.locator('#btn-switch-user').click();f.locator('dialog textarea').fill('QA-纯试玩');f.locator('dialog button').first.click()
   page.wait_for_function("()=>localStorage.getItem('minisv.showcase.2026-09.cwe.kirby_cp_current_user_v1')==='QA-纯试玩'")
   f=open_game(normal);f.wait_for_function("()=>document.querySelector('#display-username').textContent==='QA-纯试玩'")
   f=open_game(pure);f.wait_for_function("()=>document.querySelector('#display-username').textContent==='QA-纯试玩'")
   f.locator('#btn-start-game').click();f.locator('canvas').wait_for(state='visible');page.keyboard.press('Space')
  elif sid=='tzx':
   f.locator('#btn-start-game').click();f.locator('.grade-card').first.click();f.locator('#btn-confirm-grade').click();f.locator('.char-card').first.click();f.locator('#btn-confirm-char').click();f.locator('#btn-retry-mic').click(timeout=25000)
  elif sid=='zrq':
   f.locator('#boot').click();f.get_by_role('button',name='继续求生').click();f.locator('#intro').click(position={'x':100,'y':100});f.get_by_role('button',name='进入街区',exact=False).click();f.wait_for_function('()=>Game.running')
  else:
   f.locator('#btnMap').click();f.locator('#mapStart').click();f.wait_for_function('()=>curScreen==="game" && run!==null');f.locator('#lockHint').click()
   before=f.evaluate('[run.px,run.py]');page.keyboard.down('w');page.wait_for_timeout(400);page.keyboard.up('w');assert before!=f.evaluate('[run.px,run.py]');page.keyboard.press('Escape')
  report['checks'].append(sid+': share/fallback to pure URL; 3 viewport sizes; initialized and start interaction; iframe isolation')
 # Slides must keep original share behavior even with a game-only query.
 page.goto(base+'/showcase/2026-09/dky/slides/?view=game');assert 'pure-play' not in (page.locator('body').get_attribute('class') or '')
 page.locator('#copy-link').click();page.wait_for_function("()=>document.querySelector('#load-status').textContent.includes('路演链接已复制')")
 assert page.evaluate('navigator.clipboard.readText()')==base+'/showcase/2026-09/dky/slides/'
 report['checks']+=['CWE saves shared between normal/pure views','Fullscreen API rejected throughout','Slides ignore game mode and retain normal share']
 assert not report['pageErrors'],report['pageErrors'];b.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
