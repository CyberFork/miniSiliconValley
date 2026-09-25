import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../deck-data.js', import.meta.url);
const notesUrl = new URL('../presenter-notes.js', import.meta.url);
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(root, 'utf8'), context, { filename: root.pathname });
vm.runInNewContext(fs.readFileSync(notesUrl, 'utf8'), context, { filename: notesUrl.pathname });
const model = context.window.MSV_MODULE_DECK;
const notes = context.window.MSV_MODULE_PRESENTER_NOTES;
assert.ok(model?.slides, 'deck model should expose slides');
assert.equal(model.slides.length, 41, 'deck must contain exactly 41 slides');
const timelineMinutes = model.slides.reduce((n, item) => n + Number(item.minutes || 0), 0);
assert.equal(timelineMinutes, 240, 'timeline must total 240 minutes');

const slide = model.slides.find((item) => item.id === 'module-my-card');
assert.ok(slide, 'HOW-03 module-my-card slide must exist');
assert.equal(slide.source, 'HOW-03');
assert.match(slide.title, /六件事/);
const content = slide.content;
const grid = content.match(/<div class="lesson-grid\s+cols-3">([\s\S]*?)<\/div>/);
assert.ok(grid, 'HOW-03 must use lesson-grid cols-3');
const articles = [...grid[1].matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map((m) => m[1]);
assert.equal(articles.length, 6, 'HOW-03 must contain exactly six field articles');
const labels = ['01 职责', '02 输入', '03 处理规则', '04 输出', '05 接口', '06 正常／异常表现'];
const headings = articles.map((html) => html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1]?.replace(/<[^>]+>/g, '').trim());
assert.deepEqual(headings, labels, 'six article headings must match the required order exactly');

const text = slide.subtitle + ' ' + articles.join(' ').replace(/<[^>]+>/g, ' ');
for (const keyword of ['小车', '钥匙', '背包', '两格', '道具模块', '终点模块']) {
  assert.match(text, new RegExp(keyword), `HOW-03 example should mention ${keyword}`);
}
assert.match(text, /不负责|边界/, 'responsibility article must state the boundary rather than adding a seventh field');

const note = notes?.['module-my-card'];
assert.ok(note, 'teacher notes for module-my-card must exist');
const noteText = JSON.stringify(note);
for (const label of labels) assert.match(noteText, new RegExp(label.slice(3).replace(/[／]/g, '[／/]')), `teacher notes should cover ${label}`);
assert.match(noteText, /不是第七项/, 'teacher notes clarify that scope belongs to responsibility');
console.log('verify-six-field-card: PASS');
