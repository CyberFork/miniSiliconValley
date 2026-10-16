#!/usr/bin/env python3
"""Verify final-page recordings; HTTPS additionally verifies range-backed seeking."""
from playwright.sync_api import sync_playwright
import json,sys,pathlib,argparse
parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:18218');parser.add_argument('--output',default='/tmp/minisv-roadshow-video/browser');args=parser.parse_args()
base=args.base.rstrip('/');out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
report=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1280,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 for sid,count,nxt,prev in [('cwe',11,'#btn-next','#btn-prev'),('tzx',11,'#btnNext','#btnPrev'),('zrq',13,'.btn-arrow:last-child','.btn-arrow:first-child'),('dky',11,'#next','#prev')]:
  requests=[];page.on('request',lambda r:requests.append(r.url))
  page.goto(f'{base}/showcase/2026-09/{sid}/slides/');page.wait_for_function("document.querySelector('#student-frame').src.includes('/runtime/')")
  page.locator('#fullscreen-frame').click();page.wait_for_timeout(300)
  f=next(f for f in page.frames if '/runtime/' in f.url);f.locator('#game-demo').wait_for(state='attached')
  assert not any('.mp4' in u for u in requests),requests
  if sid=='zrq':
   for _ in range(count-1):f.locator('.btn-arrow').last.click()
  else:
   for _ in range(count-1):f.locator(nxt).click()
  v=f.locator('#game-demo');v.wait_for(state='visible');page.wait_for_timeout(600)
  box=v.bounding_box();assert box['height']>200,box
  assert v.evaluate('(v)=>v.paused')
  v.evaluate('(v)=>v.play()');f.wait_for_function('() => document.querySelector("#game-demo").currentTime>0.2',timeout=30000)
  duration=v.evaluate('(v)=>v.duration');v.evaluate('(v)=>v.currentTime=v.duration/2');f.wait_for_function('() => !document.querySelector("#game-demo").seeking',timeout=30000)
  if 'https:' in base: assert v.evaluate('(v)=>v.currentTime')>duration/2-2
  page.screenshot(path=str(out/(sid+'.png')))
  if sid=='zrq':f.locator('.btn-arrow').first.click()
  else:f.locator(prev).click()
  assert v.evaluate('(v)=>v.paused')
  report.append({'student':sid,'duration':duration,'videoBox':box,'playsAndPausesOnPrevious':True,'seekVerified':'https:' in base,'noEarlyMp4Fetch':True})
 page.evaluate('document.exitFullscreen()');page.wait_for_timeout(300)
 for width in [390,768]:
  page.set_viewport_size({'width':width,'height':900})
  for sid in ['cwe','tzx','zrq','dky']:
   page.goto(f'{base}/showcase/2026-09/{sid}/slides/');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 b.close()
(out/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
