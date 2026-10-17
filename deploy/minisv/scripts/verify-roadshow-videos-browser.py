#!/usr/bin/env python3
"""Verify recordings in original demo slots; HTTPS additionally verifies range-backed seeking."""
from playwright.sync_api import sync_playwright
import json,sys,pathlib,argparse
parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:18218');parser.add_argument('--output',default='/tmp/minisv-roadshow-video/browser');args=parser.parse_args()
base=args.base.rstrip('/');out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
report=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1280,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 for sid,total_pages,video_page,nxt,prev in [('cwe',10,9,'#btn-next','#btn-prev'),('tzx',10,9,'#btnNext','#btnPrev'),('zrq',12,11,'.btn-arrow:last-child','.btn-arrow:first-child'),('dky',10,9,'#next','#prev')]:
  requests=[];page.on('request',lambda r:requests.append(r.url))
  page.goto(f'{base}/showcase/2026-09/{sid}/slides/');page.wait_for_function("document.querySelector('#student-frame').src.includes('/runtime/')")
  page.locator('#fullscreen-frame').click();page.wait_for_timeout(300)
  f=next(f for f in page.frames if '/runtime/' in f.url);f.locator('#game-demo').wait_for(state='attached')
  if sid=='dky': assert f.locator('#count').inner_text()=='1 / 10'
  else: assert f.locator('.slide-item' if sid=='zrq' else '.slide-card').count()==total_pages
  if sid=='zrq': assert f.locator('#slide-13').count()==0
  assert not any('.mp4' in u for u in requests),requests
  if sid=='zrq':
   for _ in range(video_page-1):f.locator('.btn-arrow').last.click()
  else:
   for _ in range(video_page-1):f.locator(nxt).click()
  v=f.locator('#game-demo');v.wait_for(state='visible');page.wait_for_timeout(600)
  box=v.bounding_box();assert box['height']>200,box
  assert v.evaluate('(v)=>v.paused')
  v.click(position={'x':30,'y':v.evaluate('(v)=>v.clientHeight')-48});f.wait_for_function('() => document.querySelector("#game-demo").currentTime>0.2',timeout=120000)
  duration=v.evaluate('(v)=>v.duration');v.evaluate('(v)=>v.currentTime=v.duration/2');f.wait_for_function('() => !document.querySelector("#game-demo").seeking',timeout=120000)
  if 'https:' in base: assert v.evaluate('(v)=>v.currentTime')>duration/2-2
  page.screenshot(path=str(out/(sid+'.png')))
  if sid=='zrq':
   f.locator('.btn-arrow').last.click()
   assert f.locator('#slide-12').is_visible()
   assert '谢谢大家' in f.locator('#slide-12').inner_text()
   assert not f.locator('#slide-13').count()
  elif sid in ['cwe','tzx']:
   f.locator(nxt).click();assert '10 / 10' in f.locator('body').inner_text()
   closing=f.locator('[data-index="10"]' if sid=='cwe' else '[data-slide="10"]');assert closing.is_visible()
  elif sid=='dky':
   f.locator(nxt).click();assert f.locator('#count').inner_text()=='10 / 10'
   assert f.locator('#video-page').is_hidden()
   assert f.locator('#slide').get_attribute('src')=='slide-10.jpg'
  else:f.locator(prev).click()
  assert v.evaluate('(v)=>v.paused')
  report.append({'student':sid,'duration':duration,'videoBox':box,'videoPage':video_page,'totalPages':total_pages,'playsAndPausesWhenLeaving':True,'seekVerified':'https:' in base,'noEarlyMp4Fetch':True})
 page.evaluate('document.exitFullscreen()');page.wait_for_timeout(300)
 for width in [390,768]:
  page.set_viewport_size({'width':width,'height':900})
  for sid in ['cwe','tzx','zrq','dky']:
   page.goto(f'{base}/showcase/2026-09/{sid}/slides/');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 b.close()
(out/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
