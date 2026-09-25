#!/usr/bin/env python3
"""Recover immutable legacy text snapshots into the stable deck content stream.
Run with application writes stopped during deployment. Creates SQLite backup;
BEGIN IMMEDIATE protects the import. Legacy rows are never changed/deleted.
"""
import argparse,json,sqlite3,hashlib,os
from pathlib import Path
from datetime import datetime,timezone
SHARED='@shared-v1'
def recover(db,mapping,table='courseware_text_editions'):
 local=table=='editions';deck='deck' if local else 'deck_id';base='base' if local else 'base_version';patch='patches' if local else 'patches_json'
 rows=db.execute(f'SELECT {deck},{base},revision,{patch},created_at'+('' if local else ',author_id')+f' FROM {table} WHERE {base}!=? ORDER BY created_at,{base},revision',(SHARED,)).fetchall()
 db.execute('CREATE TABLE IF NOT EXISTS courseware_text_imports (deck_id TEXT PRIMARY KEY, source_digest TEXT NOT NULL)')
 digests={d:hashlib.sha256(json.dumps([r for r in rows if r[0]==d],ensure_ascii=False).encode()).hexdigest() for d in {r[0] for r in rows}}
 states={};prior={};report=[];blocked={r[0] for r in db.execute(f'SELECT DISTINCT {deck} FROM {table} WHERE {base}=?',(SHARED,))}
 for d in blocked.intersection(digests):
  marker=db.execute('SELECT source_digest FROM courseware_text_imports WHERE deck_id=?',(d,)).fetchone()
  if not marker or marker[0]!=digests[d]:raise RuntimeError('Legacy editions changed after import; stop and reconcile rather than discard: '+d)
 for row in rows:
  d,b,rev,encoded,at=row[:5]
  if d in blocked:continue
  previous=prior.get((d,b),{});current=json.loads(encoded);state=states.setdefault(d,{})
  for key in sorted(set(previous)|set(current)):
   if previous.get(key)==current.get(key):continue
   ref=mapping.get(d+'/'+b,{}).get(key,{})
   stable=ref.get('id') or 'legacy.'+hashlib.sha256((b+':'+key).encode()).hexdigest()[:24]
   state[stable]={'value':current.get(key),'original':ref.get('original',''),'base':b}
   report.append({'deck':d,'base':b,'revision':rev,'sourceKey':key,'stableKey':stable,'mapped':bool(ref.get('id'))})
  prior[d,b]=current
  revision=db.execute(f'SELECT COALESCE(MAX(revision),0)+1 FROM {table} WHERE {deck}=? AND {base}=?',(d,SHARED)).fetchone()[0]
  values=(d,SHARED,revision,json.dumps(state,ensure_ascii=False))
  if local:db.execute('INSERT INTO editions VALUES(?,?,?,?,?)',values+(at,))
  else:db.execute('INSERT INTO courseware_text_editions(deck_id,base_version,revision,patches_json,author_id,created_at) VALUES(?,?,?,?,?,?)',values+(row[5],at))
 for d,digest in digests.items():
  if d not in blocked:db.execute('INSERT INTO courseware_text_imports VALUES(?,?)',(d,digest))
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--db',required=True);p.add_argument('--backup-dir',required=True);p.add_argument('--map',default=str(Path(__file__).with_name('courseware-text-legacy-map.json')));a=p.parse_args()
 backup=Path(a.backup_dir);backup.mkdir(parents=True,exist_ok=False);os.chmod(backup,0o700)
 dbpath=Path(a.db)
 if dbpath.is_dir():
  candidates=[]
  for f in dbpath.rglob('*.sqlite'):
   with sqlite3.connect('file:'+str(f)+'?mode=ro',uri=True) as check:
    if check.execute("SELECT 1 FROM sqlite_master WHERE name='courseware_text_editions'").fetchone():candidates.append(f)
  if not candidates:print('No existing text editions; no migration required');raise SystemExit(0)
  if len(candidates)!=1:raise RuntimeError('Ambiguous courseware text database')
  dbpath=candidates[0]
 db=sqlite3.connect(dbpath,timeout=30)
 with sqlite3.connect(backup/'before.sqlite3') as target:db.backup(target)
 os.chmod(backup/'before.sqlite3',0o600)
 try:
  db.execute('BEGIN IMMEDIATE');before=db.execute('SELECT * FROM courseware_text_editions WHERE base_version!=?',(SHARED,)).fetchall();report=recover(db,json.loads(Path(a.map).read_text()));after=db.execute('SELECT * FROM courseware_text_editions WHERE base_version!=?',(SHARED,)).fetchall();assert before==after;db.commit()
 except BaseException:db.rollback();raise
 (backup/'migration-report.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'changes':report,'legacyRowsUnchanged':len(before)},ensure_ascii=False,indent=2));os.chmod(backup/'migration-report.json',0o600)
 print(json.dumps({'importedFieldEvents':len(report),'unmappedEvents':sum(not x['mapped'] for x in report),'legacyRowsUnchanged':len(before),'backup':str(backup)}))
