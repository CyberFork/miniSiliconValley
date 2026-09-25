import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const base = new URL('../', import.meta.url);
const source = await readFile(new URL('deck-data.js', base), 'utf8');
const box = { window: {} };
vm.runInNewContext(source, box);
const deck = box.window.MSV_MODULE_DECK;
assert(deck, 'deck data did not initialise');
assert.equal(deck.slides.length, 41, 'public deck must contain 39 slides');
assert.equal(deck.timeline.at(-1).start + deck.timeline.at(-1).minutes, 240, 'timeline must total 240 minutes');

const s09 = deck.slides.find((slide) => slide.id === 'module-s09');
const s10 = deck.slides.find((slide) => slide.id === 'module-s10');
assert.equal(s09?.theme, 'paper');
assert.equal(s10?.theme, 'paper');
assert.match(s09.content, /interface-demo/);
assert.match(s10.content, /blackbox-lab/);
assert.equal((s10.content.match(/data-blackbox-case=/g) || []).length, 3);
assert.match(s10.content, /data-blackbox-status/);

const css = await readFile(new URL('p1-scenes.css', base), 'utf8');
assert.match(css, /\.deck-slide\[data-slide-id=["']module-s09["'][^{}]*\.interface-demo/, 'S09 selector must be scoped');
assert.match(css, /\.deck-slide\[data-slide-id=["']module-s10["'][^{}]*\.blackbox-lab/, 'S10 selector must be scoped');

const teacher = await readFile(new URL('dist/teacher/p1-scenes.css', base), 'utf8');
const audience = await readFile(new URL('dist/audience/p1-scenes.css', base), 'utf8');
assert.equal(teacher, audience, 'teacher/audience CSS builds must match');
assert.equal(teacher, css, 'built CSS must match source');

for (const runtimeName of ['deck-runtime.js', 'presenter-runtime.js']) {
  const runtime = await readFile(new URL(runtimeName, base), 'utf8');
  const begin = runtime.indexOf('  function normalize(');
  const end = runtime.indexOf('\n  function ', begin + 10);
  assert(begin >= 0 && end > begin, `${runtimeName}: normalize function missing`);
  const runtimeBox = { window:{}, model: deck, Date: { now: () => 0 }, maxReveal: (index) => (deck.slides[index].content.match(/data-reveal/g) || []).length, isRecap: (index) => index === deck.slides.length - 1, recapMask: (value, reveal) => Number.isInteger(value) ? Math.max(0, Math.min(7, value)) : reveal };
  vm.createContext(runtimeBox);
  vm.runInContext(`${runtime.slice(begin, end)}; this.normalize = normalize;`, runtimeBox);
  const s10Index = deck.slides.findIndex((slide) => slide.id === 'module-s10');
  for (const selected of [0, 1, 2]) {
    const state = runtimeBox.normalize({ slide: s10Index, activity: { blackboxCase: selected } });
    assert.equal(state.activity.blackboxCase, selected, `${runtimeName}: S10 case ${selected}`);
    assert.equal(runtimeBox.normalize(JSON.parse(JSON.stringify(state))).activity.blackboxCase, selected, `${runtimeName}: case roundtrip`);
  }
  for (const invalid of [undefined, -1, 3, '1']) {
    assert.equal(runtimeBox.normalize({ slide: s10Index, activity: { blackboxCase: invalid } }).activity.blackboxCase, -1, `${runtimeName}: invalid case`);
  }
  assert.equal(runtimeBox.normalize({ slide: s10Index }).activity.blackboxCase, -1, `${runtimeName}: missing case`);
  assert.equal(runtimeBox.normalize({ slide: s10Index - 1, activity: { blackboxCase: 1 } }).activity.blackboxCase, -1, `${runtimeName}: non-S10 case`);
  assert.match(runtime, /setAttribute\(['"]data-active['"],\s*String\(index===selected\)\)/, `${runtimeName}: data-active must use String`);
}
console.log('Public S09/S10 style and deck contract PASS');
