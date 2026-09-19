import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function loadGlobal(file, key) {
  const context = { window: {} };
  vm.runInNewContext(read(file), context, { filename: file });
  assert.ok(context.window[key], `${file} should define ${key}`);
  return context.window[key];
}

const deck = loadGlobal('deck-data.js', 'MSV_MODULE_DECK');
const notes = loadGlobal('presenter-notes.js', 'MSV_MODULE_PRESENTER_NOTES');
assert.equal(deck.version, '2026.09.19-p2-r3');
assert.equal(deck.slides.length, 28);
assert.equal(deck.slides.reduce((sum, slide) => sum + slide.minutes, 0), 120);
assert.deepEqual(Array.from(deck.slides, (slide) => slide.id), [...Array.from({ length: 27 }, (_, i) => `ligun-${String(i + 1).padStart(2, '0')}`), 'ligun-review']);
assert.deepEqual(Object.keys(notes).sort(), Array.from(deck.slides, (slide) => slide.id).sort());

const byId = (id) => deck.slides.find((slide) => slide.id === id);
const html = (id) => byId(id).content;
const fields = ['执行者', '上下文与项目设计', '目标', '约束', '避免', '验收'];
const fieldOrder = (value) => [...value.matchAll(/data-field=["']([^"']+)["']/g)].map((m) => m[1]);
const visual = (id, kind) => {
  const value = html(id);
  assert.match(value, new RegExp(`data-p2-visual=["']${kind}["']`));
  assert.deepEqual(fieldOrder(value), fields, `${id} six-field order`);
  return value;
};

for (const id of ['ligun-07', 'ligun-18']) {
  const value = visual(id, id === 'ligun-07' ? 'master' : 'child');
  assert.match(value, /A、B、C/);
  assert.ok((value.match(/data-field=/g) ?? []).length >= 6);
}
const decomposition = html('ligun-11');
assert.match(decomposition, /data-p2-visual=["']decomposition["']/);
for (const label of ['地图', '移动', '线索', '背包', '障碍', '胜负']) assert.match(decomposition, new RegExp(label));
assert.match(byId("ligun-11").subtitle, /不是.*执行顺序/);
const repair = html('ligun-22');
assert.match(repair, /data-p2-visual=["']repair["']/);
assert.match(repair, /A[、,， ]+B[、,， ]+B/);
for (const [id, kind] of [['ligun-19', 'integration'], ['ligun-26', 'transfer']]) {
  assert.match(html(id), new RegExp(`data-p2-visual=["']${kind}["']`));
}
assert.match(notes['ligun-26'].script.join(' '), /迁移|带走|学生/);
assert.match(notes['ligun-19'].script.join(' '), /交接|整体|模块/);

for (const file of ['index.html','presenter.html','dist/audience/index.html','dist/teacher/presenter.html']) assert.match(read(file), /p2-visuals\.css/);
for (const file of ['dist/audience/p2-visuals.css','dist/teacher/p2-visuals.css']) assert.equal(read(file),read('p2-visuals.css'));
assert.match(byId('ligun-22').subtitle, /预设.*不是学生/);
for (const name of ['map','movement','clues','inventory','obstacles','outcome']) {
 const md=read(`templates/campus-${name}.md`);
 assert.deepEqual([...md.matchAll(/^## (.+)$/gm)].map(m=>m[1]),fields);
}
const {compareRepeatedClue}=await import('../demo/game.js');
assert.deepEqual(compareRepeatedClue(),[
 {version:'首版',input:['A','B','B'],ids:['A','B','B'],count:3,wonAtExit:true},
 {version:'修正版',input:['A','B','B'],ids:['A','B'],count:2,wonAtExit:false}
]);
console.log('P2 visuals: six fields, six children, 28 slides/120 minutes, same-input repair and physical styles PASS');
