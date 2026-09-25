#!/usr/bin/env python3
"""Stage compatible authoring fixes outside immutable r22/r23 package bytes."""
from pathlib import Path
import hashlib,json,shutil,sys,io,zipfile

def stage(site, repo):
    target=Path(site)/'courseware-maintenance/p1-ai-text'
    target.mkdir(parents=True,exist_ok=True)
    files={'ai-lessons.js':'courseware/module-thinking-deck/ai-lessons.js',
           'text-editions.js':'courseware/shared/text-editions.js',
           'text-editor-dialog.js':'courseware/shared/text-editor-dialog.js'}
    for name in ['loading.js','app.mjs','gameplay.mjs','drive-input.mjs','model.mjs','physics.mjs','render.mjs','workshop.css','teacher/presenter.html','audience/index.html']:
        files['workshop/'+name]='courseware/module-thinking-deck/workshop/'+name
    for name in ['app.mjs','index.html','effects.mjs','state.mjs']:
        files['route-game/'+name]='courseware/module-thinking-deck/route-game/'+name
    for name in ['deck-runtime.js','presenter-runtime.js','lesson-tools.js','p1-scenes.css','module-3d.js','bag-compare.js']:
        files[name]='courseware/module-thinking-deck/'+name
    files['printables/module-map.html']='courseware/module-thinking-deck/printables/module-map.html'
    manifest={}
    for name,source in files.items():
        data=(Path(repo)/source).read_bytes()
        (target/name).parent.mkdir(parents=True,exist_ok=True)
        (target/name).write_bytes(data)
        manifest[name]=hashlib.sha256(data).hexdigest()
    # Add/change only the requested lesson pages; keep each revision's base and
    # all unrelated content. Original package bytes remain immutable on disk.
    source=Path(repo)/'courseware/module-thinking-deck'
    def read_model(path):
        return json.JSONDecoder().raw_decode(path.read_text().split('Object.freeze(',1)[1].lstrip())[0]
    current=read_model(source/'deck-data.js')
    updates={slide['id']:slide for slide in current['slides'] if slide['id'] in ('module-s12','module-my-map','module-minecraft-map','module-my-check')}
    current_notes=read_model(source/'presenter-notes.js')
    def emit(name,data):
        (target/name).parent.mkdir(parents=True,exist_ok=True)
        (target/name).write_bytes(data)
        manifest[name]=hashlib.sha256(data).hexdigest()
    for rev in (22,23):
        package=Path(site)/f'courseware/development-mentor-module-thinking/r{rev}'
        path=package/'audience/deck-data.js'
        if not path.exists():continue
        model=read_model(path)
        model['slides']=[updates.get(slide['id'],slide) for slide in model['slides']]
        if not any(slide['id']=='module-minecraft-map' for slide in model['slides']):
            index=next(i for i,slide in enumerate(model['slides']) if slide['id']=='module-my-start')
            model['slides'].insert(index,updates['module-minecraft-map'])
        model['teachingStages'][0]['count']=25
        model['teachingStages'][1]['start']=25
        assert sum(slide['minutes'] for slide in model['slides'])==240
        emit(f'r{rev}/deck-data.js',('(function(){window.MSV_MODULE_DECK=Object.freeze('+json.dumps(model,ensure_ascii=False)+');})();\n').encode())
        notes=read_model(package/'teacher/presenter-notes.js')
        for key in ('module-s12','module-minecraft-map','module-my-check'):notes[key]=current_notes[key]
        emit(f'r{rev}/presenter-notes.js',('(function(){window.MSV_MODULE_PRESENTER_NOTES=Object.freeze('+json.dumps(notes,ensure_ascii=False)+');})();\n').encode())
        # Download archive gets the same one-line removal; other materials untouched.
        archive=package/'audience/printables/materials.zip'
        if archive.exists():
            buf=io.BytesIO()
            with zipfile.ZipFile(archive) as old,zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as new:
                for entry in old.infolist():
                    data=(source/'printables/module-map.html').read_bytes() if entry.filename=='module-map.html' else old.read(entry)
                    new.writestr(entry,data)
            emit(f'r{rev}/materials.zip',buf.getvalue())
    (target/'manifest.json').write_text(json.dumps({'compatibleRevisions':[22,23],'sha256':manifest},indent=2)+'\n')
    return manifest
if __name__=='__main__':
    print(json.dumps(stage(sys.argv[1],Path(__file__).resolve().parents[3])))
