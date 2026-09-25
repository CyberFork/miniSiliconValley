import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const data = await read('deck-data.js');
const box = { window: {} };
vm.runInNewContext(data, box);
const deck = box.window.MSV_MODULE_DECK;
assert(deck, 'deck data did not initialise');

const expected = [
  ['module-s02', 'S02-A'], ['module-s02-build', 'S02-B'],
  ['module-s02-voxel', 'S02-C'], ['module-s03', 'S03'],
  ['module-description', 'P1-六句'], ['module-s05', 'S05'],
  ['module-s04', 'S04'],
];
for (const [id, source] of expected) {
  const slide = deck.slides.find((item) => item.id === id);
  assert(slide, `${id} slide is missing`);
  assert.equal(slide.source, source, `${id} source mapping changed`);
  assert.match(slide.content, /data-module-3d=/, `${id} must retain a 3D host`);
}
assert.equal(JSON.stringify(deck.slides.slice(1, 8).map(({ id, source }) => [id, source])), JSON.stringify(expected));

const css = await read('p1-scenes.css');
const has = (pattern, message) => assert.match(css, pattern, message);
const scoped = '(?:\\[data-slide-id=["\\\'](?:module-s02|module-s02-build|module-s02-voxel|module-s03|module-description|module-s04|module-s05)["\\\'])';
has(new RegExp(`\\.deck-slide:is\\(${scoped}`, 's'), 'large-scene rules must be P1-scoped');
has(/\.deck-slide\[data-slide-id="module-s02"\] \.transformer-demo\s*\{[^}]*grid-template-columns:\s*150px\s+minmax\(0,1fr\)\s+430px[^}]*height:\s*464px/s, 'S02-A enlarged grid/height contract missing');
has(/\.deck-slide\[data-slide-id="module-s02"\] \.transform-3d\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/s, 'S02-A flexible 3D height contract missing');
for (const [id, height] of [['module-s02-build', 410], ['module-s02-voxel', 365]]) {
  has(new RegExp(`\\.deck-slide\\[data-slide-id="${id}"\\][^}]*\\.?(?:lego-automation-demo|voxel-lab)`, 's'), `${id} scope missing`);
  has(new RegExp(`data-slide-id="${id}"\\][^}]*\\}[\\s\\S]*?height:\\s*${height}px`, 's'), `${id} enlarged height missing`);
}
for (const id of ['module-s03', 'module-s04']) {
  has(new RegExp(`data-slide-id="${id}"[\\s\\S]*?\\.case-reuse-scene \\{[^}]*height:\\s*410px`, 's'), `${id} scene height missing`);
}
has(/data-slide-id="module-description"[\s\S]*?\.conveyor-scene\s*\{[^}]*height:\s*470px/s, 'six-field scene height missing');
has(/data-slide-id="module-s05"[\s\S]*?\.relation-scene\s*\{[^}]*height:\s*425px/s, 'S05 scene height missing');
has(/\.deck-slide:is\([^)]*module-s05[^)]*\) \.lesson-banner\s*\{[^}]*font-size:\s*21px/s, 'compact lesson banner rule missing');
has(/\.deck-slide:is\([^)]*module-s02[^)]*\) \.slide-heading h1\s*\{[^}]*font-size:\s*56px/s, 'compact heading rule missing');
has(/\.deck-slide:is\([^)]*module-s02[^)]*\) \.slide-body\s*\{[^}]*top:\s*210px[^}]*bottom:\s*72px/s, '618px body rule missing');

for (const file of ['ligun-deck/index.html', 'ligun-deck/presenter.html']) {
  assert.doesNotMatch(await readFile(new URL(`../../${file}`, import.meta.url), 'utf8'), /p1-scenes\.css/, `${file} must not import P1 CSS`);
}
console.log('verify-large-scenes PASS: 7 P1 scenes, scoped enlarged dimensions, compact 618px body, P2 isolation');
