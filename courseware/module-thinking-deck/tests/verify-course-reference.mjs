import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const load = (code) => {
  const box = { window: {} };
  vm.runInNewContext(code, box);
  return box.window;
};
const window = load(read('deck-data.js'));
const notes = load(read('presenter-notes.js')).MSV_MODULE_PRESENTER_NOTES;
const deck = window.MSV_MODULE_DECK;
assert.equal(deck.slides.length, 41, 'reference slides bring the deck to 41');
assert.equal(deck.slides.slice(0, 39).at(-1).id, 'ai-14');
assert.deepEqual(Array.from(deck.slides.slice(-2), (s) => s.id), ['course-map', 'course-flow']);
assert.deepEqual(Array.from(deck.slides.slice(-2), (s) => s.source), ['总览-01', '总览-02']);
assert.deepEqual(Array.from(deck.slides.slice(-2), (s) => s.minutes), [0, 0]);
assert.equal(deck.slides.reduce((sum, s) => sum + Number(s.minutes || 0), 0), 240);
assert.equal(JSON.stringify(deck.timeline.slice(-1)[0]), JSON.stringify({ name: 'AI 可控开发', minutes: 120, start: 120, end: 240 }));

// The first 39 slides are a preserved r28 base; compare the executable model, not formatting.
assert.equal(createHash('sha256').update(JSON.stringify(deck.slides.slice(0,39))).digest('hex'), '9883d0166505646a2efed590f1b573ac00bd30760c3b0edb053c01054842e22f', 'first 39 slides unchanged from published r28');

const map = deck.slides.find((s) => s.id === 'course-map');
const flow = deck.slides.find((s) => s.id === 'course-flow');
assert.ok(map && flow);
assert.match(map.content, /模块地图/);
assert.match(map.content, /模块组合\s*→\s*功能\s*→\s*完整/);
assert.match(map.content, /模块本身|模块描述/);
assert.match(map.content, /主棍/);
assert.match(map.content, /子棍/);
const moduleFields = ['职责', '输入', '处理规则', '输出', '接口', '正常／异常表现'];
const stickFields = ['执行者', '上下文与项目设计', '目标', '约束', '避免', '验收'];
for (const field of [...moduleFields, ...stickFields]) assert.match(map.content, new RegExp(field));
assert.deepEqual((map.content.match(/data-msv-field="f00(?:1[7-9]|2[0-2])"/g) || []).length, 6);
assert.notDeepEqual(moduleFields, stickFields);
assert.match(flow.content, /人[^<]{0,20}(选择|确认)/);
assert.match(flow.content, /执行棍[^<]*(AI|自查)/);
assert.match(flow.content, /人实际试玩|实际结果/);
for (const slide of [map, flow]) {
  assert.equal(slide.content.includes('iframe'), false);
  assert.equal(slide.content.includes('<canvas'), false);
  assert.doesNotMatch(slide.content, /data-(?:image|bitmap)|\.png|\.jpg|\.webp/);
  assert.ok(notes[slide.id], `presenter notes missing for ${slide.id}`);
  assert.equal(notes[slide.id].minutes, '0 分钟 · 实践时查阅，不新增课时');
}
console.log('verify-course-reference: PASS');
