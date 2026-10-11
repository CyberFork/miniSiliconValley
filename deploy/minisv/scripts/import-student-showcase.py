#!/usr/bin/env python3
"""One-time, allowlisted import. Originals stay private; builds use checked-in output."""
import argparse, hashlib, json, re, zipfile
from pathlib import Path, PurePosixPath


def archive(path):
    result = {}
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.is_dir() or info.filename.startswith('__MACOSX/'): continue
            try: name = info.filename.encode('cp437').decode('utf8')
            except (UnicodeError, LookupError): name = info.filename
            parts = PurePosixPath(name).parts
            if '..' in parts or name.startswith('/'): raise ValueError('unsafe archive path')
            result['/'.join(parts[1:])] = z.read(info)
    return result


def defer_scripts(s):
    def convert(m):
        attrs=m.group(1)
        if '/showcase/runtime-bridge.js' in attrs: return m.group(0)
        assert 'type=' not in attrs, 'Review script type before deferring'
        attrs=re.sub(r'\bsrc=', 'data-src=', attrs)
        return '<script type="application/x-minisv-student"'+attrs+'>'
    return re.sub(r'<script([^>]*)>',convert,s)


def main():
    p=argparse.ArgumentParser(); p.add_argument('--cwe-archive',type=Path,required=True); p.add_argument('--tzx-archive',type=Path,required=True); p.add_argument('--output',type=Path,required=True); a=p.parse_args()
    c,t=archive(a.cwe_archive),archive(a.tzx_archive); entries=[]
    def put(student,kind,relative,data,source):
        dest=a.output/'2026-09'/student/'runtime'/kind/relative
        dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(data)
        entries.append({'path':dest.relative_to(a.output).as_posix(),'sha256':hashlib.sha256(data).hexdigest(),'source':source})
    names=['index.html','favicon.ico','css/game.css']+[f'js/{n}.js' for n in ['audio','store','worlds','entities','multiplayer','game']]+[f'assets/{n}' for n in ['title.png','dark.png','grassland.png','bunker.png','arena.png','logo.png','three.min.js']]
    for name in names:
        data=c[name]
        if name.endswith(('.html','.js','.css')):
            s=data.decode('utf8').replace('蔡玮思','蔡玮恩')
            s=s.replace('window.localStorage','window.MSV_SHOWCASE_STORAGE').replace('window.location.reload()','window.MSV_SHOWCASE_RELOAD()')
            if name=='index.html':
                s,n=re.subn(r'  <script>\s*if \(typeof THREE === .undefined.\) \{.*?</script>', '',s, count=1, flags=re.S)
                assert n==1, 'CDN fallback moved; review required'
                s=s.replace('<head>','<head>\n  <script src="/showcase/runtime-bridge.js"></script>')
                # Origin-isolated frames cannot use native prompt/confirm. Accessible in-frame dialog instead.
                for button in ['btn-switch-user','btn-import-sync','btn-quit']:
                    old=f"document.getElementById('{button}').addEventListener('click', () => {{"
                    assert old in s; s=s.replace(old,old.replace('() =>','async () =>'))
                s=s.replace('currentUser.username);', 'KirbyStore.getCurrentUser().username);')
                s=s.replace('= prompt(', '= await window.MSV_PROMPT(').replace('if (confirm(', 'if (await window.MSV_CONFIRM(')
                s=s.replace('云端同步','手动存档同步').replace('跨设备数据同步','存档导出／导入（手动）').replace('跨设备存档已就绪','存档保存在此浏览器').replace('联机模式','模拟组队').replace('随机加入联机房间','模拟组队大厅').replace('2-10人随机加入','模拟队友加入').replace('与伙伴联机协作','与模拟队友协作')
            if name=='index.html': s=defer_scripts(s)
            data=s.encode('utf8')
        put('cwe','game',name,data,'cwe.zip:'+name)
    for name,data in t.items():
        if not name.startswith('html/'): continue
        rel=name[5:]
        allowed=rel=='index.html' or (rel.startswith(('css/','js/','assets/')) and Path(rel).suffix in ['.js','.css','.svg','.png','.jpg','.jpeg'])
        if not allowed: continue
        if rel.endswith(('.html','.js','.css')):
            s=data.decode('utf8').replace('window.localStorage','window.MSV_SHOWCASE_STORAGE')
            if rel=='index.html': s=s.replace('<head>','<head>\n  <script src="/showcase/runtime-bridge.js"></script>')
            if rel=='index.html': s=defer_scripts(s)
            if rel=='js/main.js': s=s.replace("window.addEventListener('DOMContentLoaded', () => {", "window.MSV_SHOWCASE_READY.then(() => {")
            if rel=='js/game/english.js':
                s=s.replace('this.initSpeechRecognition();','// Public showcase: no microphone; explicit self-reading exercise.\n    this.recognition = null;')
                s=s.replace('麦克风未激活或浏览器不支持语音识别，请点击【确认发音无误】继续','公开试玩为自读练习（不自动评分）。请朗读后点击【我已朗读，继续】。').replace('确认发音无误','我已朗读，继续')
                s=s.replace('this.handleSpeechResult(this.currentTask.word);', '''this.statusText.textContent = '已完成自读练习（未进行自动语音评分）';
          this.btnRetryMic.disabled = true;
          setTimeout(() => {
            this.modal.classList.remove('active');
            this.btnRetryMic.disabled = false;
            if (this.onResultCallback) this.onResultCallback(true);
          }, 600);''')
            data=s.encode('utf8')
        put('tzx','game',rel,data,'tzx.zip:'+name)
    put('cwe','slides','index.html',c['kirby_pitch_deck.bak.html'].decode('utf8').replace('蔡玮思','蔡玮恩').encode('utf8'),'cwe.zip:kirby_pitch_deck.bak.html')
    # This deck is explicitly credited to 唐梓轩, even though delivered in cwe.zip.
    put('tzx','slides','index.html',c['zero_era_pitch_deck.html'],'cwe.zip:zero_era_pitch_deck.html')
    for name in ['assets/zero_era_poster.jpg','06387856c42efe4999cf311100ea9960.jpg']:
        put('tzx','slides',name,c[name],'cwe.zip:'+name)
    manifest={'schema':1,'cohort':'2026-09','originalArchives':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [a.cwe_archive,a.tzx_archive]},'publicRuntimeFiles':entries,'adaptations':['蔡玮思→蔡玮恩 in published slide copy','Local-only Three.js; no CDN fallback','Origin-isolated, namespaced browser storage bridge; in-frame dialogs','CWE multiplayer labelled simulation, sync labelled manual; nickname handler scope repaired','TZX public voice task is explicit self-reading, not automatic scoring; no microphone']}
    (a.output.parent.parent/'student-showcase-import.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Imported {len(entries)} public runtime files; originals untouched.')

if __name__=='__main__': main()
