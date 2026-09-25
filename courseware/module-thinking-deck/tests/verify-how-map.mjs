import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const box = { window: {} };
for (const file of ['deck-data.js', 'presenter-notes.js']) {
  vm.runInNewContext(await readFile(new URL(file, root), 'utf8'), box, { filename: file });
}
const deck = box.window.MSV_MODULE_DECK;
const notes = box.window.MSV_MODULE_PRESENTER_NOTES;
assert.equal(deck.slides.length, 41);
assert.equal(deck.slides.reduce((sum, slide) => sum + Number(slide.minutes || 0), 0), 240);

const byId = (id) => deck.slides.find((slide) => slide.id === id);
const start = byId('module-my-start');
const map = byId('module-my-map');
assert.equal(start?.source, 'HOW-01');
assert.equal(map?.source, 'HOW-02');
assert.ok(start && map, 'HOW-01 and HOW-02 stable slide ids must remain');

const fields = (html) => [...html.matchAll(/data-msv-field="([^"]+)"/g)].map((match) => match[1]);
for (const slide of [start, map]) {
  const ids = fields(slide.content);
  for (const id of Array.from({ length: 10 }, (_, i) => `f${String(i + 1).padStart(4, '0')}`)) {
    assert.equal(ids.filter((field) => field === id).length, 1, `${slide.id} keeps ${id} exactly once`);
  }
  assert.equal(new Set(ids).size, ids.length, `${slide.id} text fields have stable unique ids`);
}

assert.match(start.content, /how-example-pair/);
for (const phrase of ['模块', '功能', '产品', '钥匙', '背包满', '背包模块']) assert.match(start.content, new RegExp(phrase));
assert.match(map.content, /how-module-map/);
assert.equal((map.content.match(/class="how-map-function"/g) || []).length, 4);
for (const label of ['移动', '拾取', '携带物品', '关卡判断']) assert.match(map.content, new RegExp(`>${label}<`));
assert.match(map.content, /同一个背包模块.*参与拾取、携带和过关/);

for (const id of ['module-my-start', 'module-my-map']) {
  const script = JSON.stringify(notes[id]);
  assert.match(script, /小车/);
  assert.match(script, /自己的游戏|个人游戏|你的游戏/);
}

const how03 = byId('module-my-card');
for (const label of ['职责', '输入', '处理规则', '输出', '接口', '正常／异常表现']) assert.match(how03.content, new RegExp(label));

const css = await readFile(new URL('p1-scenes.css', root), 'utf8');
for (const selector of ['.how-example-pair', '.how-module-map', '.how-map-function']) assert.match(css, new RegExp(`\\${selector}`));
assert.match(css, /\.how-map-(?:module|function|product)[^{]*\{[^}]*color:\s*var\(--ink\)/s);
execFileSync('python3',[fileURLToPath(new URL('../../scripts/courseware_text_fields.py',root)),fileURLToPath(new URL('deck-data.js',root)),'--check']);
for(const surface of ['audience','teacher']) assert.equal(await readFile(new URL('dist/'+surface+'/deck-data.js',root),'utf8'),await readFile(new URL('deck-data.js',root),'utf8'));
console.log('verify-how-map: PASS');
