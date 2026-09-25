"""Loopback preview text revisions. Never connects to the production database."""
import json
import re
import sqlite3
import sys
import importlib.util
from datetime import datetime, timezone
from pathlib import Path


class TextError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


REPO=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(REPO/'scripts'))
from courseware_text_fields import inventory
migration_spec=importlib.util.spec_from_file_location('text_recovery',REPO/'deploy/minisv/scripts/migrate-courseware-text.py')
migration=importlib.util.module_from_spec(migration_spec);migration_spec.loader.exec_module(migration)
SHARED='@shared-v1'
def runtime_fields(deck,base):
    entries=json.loads((REPO/'courseware/shared/runtime-text-catalog.json').read_text())
    return next((e['fields'] for e in entries if e['id']==deck and base in e['bases']),{})


class TextStore:
    def __init__(self, path, deck_path):
        self.path = Path(path)
        self.deck_path = Path(deck_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS editions (deck TEXT, base TEXT, revision INTEGER, patches TEXT, created_at TEXT, PRIMARY KEY(deck,base,revision))')
            db.execute('BEGIN IMMEDIATE')
            migration.recover(db,json.loads((REPO/'deploy/minisv/scripts/courseware-text-legacy-map.json').read_text()),'editions')

    def connect(self):
        return sqlite3.connect(self.path, timeout=10)

    def spec(self, deck, base):
        source = self.deck_path.read_text()
        spec = json.JSONDecoder().raw_decode(source.split('Object.freeze(', 1)[1].lstrip())[0]
        if deck != spec['id'] or base != spec['version']:
            raise TextError('当前本地预览不包含这个课件版本，请刷新后重试。', 404)
        return spec

    def data(self, db, deck, base, revision=None):
        if revision is not None and (type(revision) is not int or revision < 0):
            raise TextError('文字版本编号无效。')
        spec=self.spec(deck,base)
        shared=spec.get('textSchema')=='shared-v1'
        fields={v['id']:v['original'] for v in inventory(spec,shared).values()};fields.update(runtime_fields(deck,base))
        rows = db.execute('SELECT revision,patches,created_at FROM editions WHERE deck=? AND base=? ORDER BY revision DESC', (deck, SHARED if shared else base)).fetchall()
        latest = rows[0][0] if rows else 0
        selected = latest if revision is None else revision
        row = next((r for r in rows if r[0] == selected), None)
        if selected and row is None:
            raise TextError('找不到此文字版本。', 404)
        state=json.loads(row[1]) if row else {};patches={};conflicts=[]
        if shared:
            for key,edit in state.items():
                if edit['value'] is None:continue
                if key in fields and fields[key]==edit['original']:patches[key]=edit['value']
                else:conflicts.append({'key':key,'value':edit['value'],'original':edit['original'],'current':fields.get(key),'sourceBase':edit['base'],'reason':'新版位置或原文已改变，请核对；修改仍保留'})
        else:patches=state
        return {'conflicts':conflicts,'deckId': deck, 'base': base, 'storage': 'local-preview', 'edition': {'revision': selected, 'patches': patches, 'createdAt': row[2] if row else None}, 'latestRevision': latest, 'history': [{'revision': r[0], 'created_at': r[2]} for r in rows[:100]]}

    def read(self, deck, base, revision=None):
        self.spec(deck, base)
        with self.connect() as db:
            return self.data(db, deck, base, revision)

    def save(self, deck, body):
        if not isinstance(body, dict):
            raise TextError('请求内容无效。')
        base, key, value, expected = (body.get(k) for k in ['base', 'key', 'value', 'expectedRevision'])
        spec = self.spec(deck, base)
        if type(expected) is not int or not 0 <= expected <= 1_000_000:
            raise TextError('请先加载最新文字版。')
        if not isinstance(key, str) or ':' not in key:
            raise TextError('文字位置无效。')
        slide, field = key.split(':', 1)
        if spec.get('textSchema')!='shared-v1' and (slide not in [s['id'] for s in spec['slides']] or not re.fullmatch(r'(title|subtitle|body(?:\.\d{1,3}){1,12})', field)):
            raise TextError('文字位置无效，请刷新课件后重试。')
        if value is not None and (not isinstance(value, str) or len(value.encode('utf-16-le')) // 2 > 2000 or any(ord(c) < 32 and c not in '\t\r\n' for c in value)):
            raise TextError('每处文字最多2000字，不能包含控制字符。')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            current = self.data(db, deck, base)
            if current['latestRevision'] != expected:
                raise TextError('另一窗口已保存新版。你的输入仍保留，请加载最新文字版后核对再保存。', 409)
            shared=spec.get('textSchema')=='shared-v1'
            if shared:
                row=db.execute('SELECT patches FROM editions WHERE deck=? AND base=? ORDER BY revision DESC LIMIT 1',(deck,SHARED)).fetchone()
                patches=json.loads(row[0]) if row else {}
                fields={v['id']:v['original'] for v in inventory(spec,True).values()};fields.update(runtime_fields(deck,base))
                if key not in fields and not (value is None and key in patches):raise TextError('文字位置无效。')
                patches[key]={'value':value,'original':fields.get(key,patches.get(key,{}).get('original','')),'base':base}
            else:
                patches = current['edition']['patches']
                if value is None:patches.pop(key,None)
                else:patches[key]=value
            encoded = json.dumps(patches, ensure_ascii=False)
            if len(patches) > 2000 or len(encoded.encode()) > 256 * 1024:
                raise TextError('修改内容过多，请整理课件。')
            db.execute('INSERT INTO editions VALUES(?,?,?,?,?)', (deck, SHARED if shared else base, expected + 1, encoded, datetime.now(timezone.utc).isoformat()))
            return self.data(db, deck, base, expected + 1)
