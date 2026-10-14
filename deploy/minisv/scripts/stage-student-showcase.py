#!/usr/bin/env python3
"""Stage onto a COPY of current/site; preserve every unrelated published byte."""
import hashlib, json, shutil, sys
from datetime import datetime, timezone
from pathlib import Path
site, release, commit = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
assert len(commit)==40 and all(c in '0123456789abcdef' for c in commit)
ops=Path(__file__).resolve().parents[1]
source=ops/'site'/'showcase'
manifest=json.loads((ops/'student-showcase-import.json').read_text())
for item in manifest['publicRuntimeFiles']:
    assert hashlib.sha256((source/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
if (site/'showcase').exists():
    # Updates must start from the exact reviewed public baseline, not an unknown live edit.
    baseline=manifest.get('updateBaseline', {})
    assert baseline, 'No reviewed update baseline'
    actual={p.relative_to(site/'showcase').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (site/'showcase').rglob('*') if p.is_file()}
    assert actual==baseline, 'Published showcase changed; review differences before updating'
    shutil.copytree(source,site/'showcase',dirs_exist_ok=True)
    assert '/showcase/' in (site/'index.html').read_text()
    assert '/showcase/' in (site/'ui-theme.js').read_text()
else:
    shutil.copytree(source,site/'showcase')
    p=site/'index.html'; s=p.read_text(); marker='<a href="/incubator/">项目孵化</a>'
    assert marker in s and '/showcase/' not in s, 'Homepage changed: review navigation'
    p.write_text(s.replace(marker,marker+'\n        <a href="/showcase/">学生作品</a>',1))
    p=site/'ui-theme.js'; s=p.read_text(); marker='["项目孵化", "/incubator/"],'
    assert marker in s and '/showcase/' not in s
    p.write_text(s.replace(marker,marker+'\n      ["学生作品", "/showcase/"],',1))
p=site/'release.json'; meta=json.loads(p.read_text())
meta['studentShowcase']={'cohort':'2026-09','entry':'/showcase/2026-09/','students':['cwe','tzx','zrq','dky'],'sourceCommit':commit,'importManifestSha256':hashlib.sha256((ops/'student-showcase-import.json').read_bytes()).hexdigest(),'previousRelease':meta.get('release')}
meta['release']=release;meta['builtAt']=datetime.now(timezone.utc).isoformat();p.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta['studentShowcase']))
