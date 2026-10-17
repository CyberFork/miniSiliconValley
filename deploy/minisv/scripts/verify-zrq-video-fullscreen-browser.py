#!/usr/bin/env python3
"""Verify page 11 video fullscreen, including actual Chromium native control clicks."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--base',default='http://127.0.0.1:18218');ap.add_argument('--output',default='/tmp/minisv-video-fullscreen/local');a=ap.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'base':a.base,'checks':[],'pageErrors':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True)
 for deck_mode,control,unloaded in [('outer','native',False),('inner','button',False),('normal','button',False),('outer','button',True)]:
  ctx=b.new_context(viewport={'width':1440,'height':900});p=ctx.new_page();requests=[]
  p.on('pageerror',lambda e:report['pageErrors'].append(str(e)));p.on('request',lambda r:requests.append(r.url))
  if unloaded:p.route('**/game-demo.mp4',lambda route:route.abort())
  p.goto(a.base.rstrip('/')+'/showcase/2026-09/zrq/slides/',timeout=90000)
  p.wait_for_function("() => document.querySelector('#student-frame').src.includes('/runtime/')")
  f=next(f for f in p.frames if '/runtime/' in f.url)
  if deck_mode=='normal':p.locator('.slides-stage').scroll_into_view_if_needed()
  if deck_mode=='outer':p.locator('#fullscreen-frame').click();p.wait_for_function('() => !!document.fullscreenElement')
  if deck_mode=='inner':f.locator('[onclick="toggleFullscreen()"]').click();f.wait_for_function('() => !!document.fullscreenElement')
  def next_page():
   if deck_mode=='normal':f.locator('#btnMode').press('ArrowRight')
   else:f.locator('.btn-arrow').last.click()
  for _ in range(9):next_page()
  assert not any('.mp4' in url for url in requests),'Earlier slides must not fetch video'
  next_page();v=f.locator('#game-demo');v.wait_for(state='visible');p.wait_for_timeout(450)
  if not unloaded and control=='native':f.wait_for_function('() => document.querySelector("#game-demo").readyState>=1',timeout=120000)
  assert v.evaluate('(v)=>v.paused'),'Preparing metadata must not autoplay'
  if control=='native':
   box=v.bounding_box();scale=box['width']/v.evaluate('(v)=>v.clientWidth')
   # Visible Chromium native fullscreen icon, not a JS requestFullscreen shortcut.
   p.mouse.click(box['x']+box['width']-72*scale,box['y']+box['height']-48*scale)
  else:f.locator('#video-fullscreen').click()
  f.wait_for_function('() => document.fullscreenElement===document.querySelector("#game-demo")')
  p.wait_for_timeout(300)
  dims=f.evaluate('() => {const r=document.querySelector("#game-demo").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight}}')
  outer=p.evaluate('() => {const r=document.querySelector("iframe").getBoundingClientRect();return {w:r.width,h:r.height,vw:innerWidth,vh:innerHeight}}')
  assert abs(dims['w']-dims['vw'])<2 and abs(dims['h']-dims['vh'])<2 and abs(dims['x'])<2 and abs(dims['y'])<2,dims
  assert abs(outer['w']-outer['vw'])<2 and abs(outer['h']-outer['vh'])<2,outer
  p.screenshot(path=str(out/(deck_mode+'-'+control+('-unloaded' if unloaded else '')+'.png')))
  if not unloaded:
   v.evaluate('(v)=>v.play()');f.wait_for_function('() => document.querySelector("#game-demo").currentTime>0.2',timeout=120000)
  before=v.evaluate('(v)=>v.currentTime')
  f.evaluate('() => document.exitFullscreen()')
  f.wait_for_function('() => document.fullscreenElement!==document.querySelector("#game-demo")');p.wait_for_timeout(300)
  assert f.locator('#slide-11').is_visible() and f.evaluate('currentSlide')==11
  assert v.evaluate('(v)=>v.currentTime')>=before-.1
  if deck_mode=='outer':assert p.evaluate('document.fullscreenElement?.classList.contains("slides-stage")')
  if deck_mode=='inner':assert f.evaluate('document.fullscreenElement===document.documentElement')
  if deck_mode=='normal':assert not p.evaluate('Boolean(document.fullscreenElement)')
  next_page();assert f.locator('#slide-12').is_visible() and v.evaluate('(v)=>v.paused')
  report['checks'].append({'deckFullscreen':deck_mode,'control':control,'metadataUnavailable':unloaded,'fillsViewport':True,'doesNotAutoplay':True,'returnsToPage11AndKeepsTime':True,'leavingPauses':True,'noEarlyVideoFetch':True})
  ctx.close()
 assert not report['pageErrors'],report['pageErrors'];b.close()
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
