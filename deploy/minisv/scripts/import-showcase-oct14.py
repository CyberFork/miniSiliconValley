#!/usr/bin/env python3
"""Curated Oct 14 import. Private source directories are never copied wholesale.
Duan input must be the verified latest v0.22.0 self-contained HTML. Slides are
rendered from the supplied PPTX (LibreOffice -> PDF -> 1600px JPEG), not rewritten.
"""
import argparse, hashlib, html, json, re, runpy, shutil
from pathlib import Path

p=argparse.ArgumentParser()
for name in ['zhang-game','zhang-slides','zhang-slide-assets','duan-game','duan-slide-images','duan-pptx']:
    p.add_argument('--'+name,type=Path,required=True)
a=p.parse_args();ops=Path(__file__).resolve().parents[1];root=ops/'site/showcase';mp=ops/'student-showcase-import.json';manifest=json.loads(mp.read_text())
defer=runpy.run_path(str(Path(__file__).with_name('import-student-showcase.py')))['defer_scripts']
records=[]
def put(student,kind,rel,data,source):
    target=root/'2026-09'/student/'runtime'/kind/rel
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    records.append({'path':target.relative_to(root).as_posix(),'sha256':hashlib.sha256(data).hexdigest(),'source':source})
# Do not remove or overwrite previously published authors' files.
for student in ['zrq','dky']:
    assert not (root/'2026-09'/student/'runtime').exists(), 'Import is one-time; review changes before replacing runtime'
for f in sorted(a.zhang_game.rglob('*')):
    if not f.is_file() or f.suffix not in {'.html','.js','.png'}:continue
    rel=f.relative_to(a.zhang_game).as_posix();data=f.read_bytes()
    rel=rel.replace('开机页面','boot').replace('登陆界面','login')
    if f.suffix in {'.html','.js'}:
        s=data.decode().replace('assets/开机页面.png','assets/boot.png').replace('assets/登陆界面.png','assets/login.png')
        s=s.replace('localStorage.', 'window.MSV_SHOWCASE_STORAGE.')
        if rel=='js/game.js':
            assert 'wipeSave(keepPlaying)' in s
            s=s.replace('wipeSave(keepPlaying)', 'async wipeSave(keepPlaying)').replace("!confirm('清空存档", "!await window.MSV_CONFIRM('清空存档")
        if rel=='js/sprites.js':
            s=s.replace('const img = new Image();', "const img = new Image();\n    img.crossOrigin = 'anonymous'; // opaque-origin canvas readback needs runtime CORS")
        if rel=='js/main.js':
            assert "window.addEventListener('load', () => {" in s
            s=s.replace("window.addEventListener('load', () => {", 'window.MSV_SHOWCASE_READY.then(() => {')
        if rel=='index.html':
            s=re.sub(r'(<head\b[^>]*>)',r'\1\n<script src="/showcase/runtime-bridge.js"></script>',s,count=1);s=defer(s)
        data=s.encode()
    put('zrq','game',rel,data,'章-末日生存-开发包-20261012.zip:doomsday/'+f.relative_to(a.zhang_game).as_posix())
s=a.zhang_slides.read_text();assert '章睿棋' in s
put('zrq','slides','index.html',s.encode(),'cwe.zip:末日战争.html')
for rel in sorted(set(re.findall(r'src="(assets/doomsday_ppt/[^\"]+)"',s))):
    put('zrq','slides',rel,(a.zhang_slide_assets/rel.removeprefix('assets/')).read_bytes(),'cwe.zip:'+rel)
s=a.duan_game.read_text();assert 'const BUILD = "v0.22.0"' in s
assert hashlib.sha256(s.encode()).hexdigest()=='bc0ba95681aa609bae3f786e120abcafa8679d82e60399a2722a652b8dcff9b4'
s=s.replace('localStorage.', 'window.MSV_SHOWCASE_STORAGE.').replace('<head>', '<head>\n<script src="/showcase/runtime-bridge.js"></script>')
s=defer(s)
put('dky','game','index.html',s.encode(),'段-回声断层_开发文件_2026-10-13.zip:回音断层/回声断层_游戏原型.html (BUILD v0.22.0)')
images=sorted(a.duan_slide_images.glob('slide-*.jpg'));assert len(images)==10
for i,f in enumerate(images,1):put('dky','slides',f'slide-{i:02}.jpg',f.read_bytes(),'cwe.zip:回声断层_我的第一份商业计划书.pptx#slide'+str(i))
s='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>回声断层｜段柯屹｜路演</title><style>*{box-sizing:border-box}body{margin:0;background:#07101b;color:#fff;font-family:system-ui}main{height:100vh;display:flex;flex-direction:column;align-items:center}img{display:block;width:100%;height:calc(100vh - 52px);object-fit:contain}nav{height:52px;display:flex;align-items:center;justify-content:center;gap:28px}button{font:inherit;padding:7px 22px;color:#172d40;background:#f1c453;border:2px solid white;cursor:pointer}button:disabled{opacity:.5}</style></head><body><main><img id="slide" src="slide-01.jpg" alt="段柯屹《回声断层》路演，第1页"><nav><button id="prev" type="button">← 上一页</button><span id="count" aria-live="polite">1 / 10</span><button id="next" type="button">下一页 →</button></nav></main><script>let n=1;function show(v){n=Math.max(1,Math.min(10,v));document.querySelector('#slide').src='slide-'+String(n).padStart(2,'0')+'.jpg';document.querySelector('#slide').alt='段柯屹《回声断层》路演，第'+n+'页';document.querySelector('#count').textContent=n+' / 10';document.querySelector('#prev').disabled=n===1;document.querySelector('#next').disabled=n===10;}document.querySelector('#prev').onclick=()=>show(n-1);document.querySelector('#next').onclick=()=>show(n+1);document.addEventListener('keydown',e=>{if(['ArrowRight',' ','ArrowDown'].includes(e.key)){e.preventDefault();show(n+1)}if(['ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();show(n-1)}});show(1);</script></body></html>'''
put('dky','slides','index.html',s.encode(),'Web viewer for supplied PPTX rendered pages (10 slides)')
manifest['publicRuntimeFiles']+=records
manifest['additionalSources']={'zrq':{'archiveSha256':'6c8b27b81286367292c0ff55be25989e97a04af7248fc281fc01e312b77a3d19','game':'末日生存','slides':'末日战争','slideAuthor':'章睿棋'},'dky':{'version':'v0.22.0','originalHtmlSha256':hashlib.sha256(a.duan_game.read_bytes()).hexdigest(),'pptxSha256':hashlib.sha256(a.duan_pptx.read_bytes()).hexdigest(),'slideAuthor':'段柯屹','gameSelfContained':True}}
manifest['adaptations']+=['Zhang: opaque-origin storage, in-frame reset confirmation, boot after storage seed; Chinese image URLs renamed ASCII only','Duan: latest v0.22.0 only, opaque-origin storage; existing PPTX rendered as 10 browser slides; no historical builds or development source bundle']
mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('Added',len(records),'runtime files')
