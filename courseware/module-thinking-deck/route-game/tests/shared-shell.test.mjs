import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const box = { window: {} };
vm.runInNewContext(await read('deck-data.js'), box, { filename: 'deck-data.js' });
const deck = box.window.MSV_MODULE_DECK;
const catalog = JSON.parse(await readFile(new URL('../../../../app/lib/courseware-text-catalog.json', import.meta.url)));
const edition = catalog.find((item) => item.version === deck.version);
assert(edition, `text edition ${deck.version} exists`);

const byId = (id) => deck.slides.find((slide) => slide.id === id);
const fields = (slide) => [...slide.content.matchAll(/data-msv-field="([^"]+)"/g)].map((m) => m[1]);
const s06 = byId('module-s06');
const ai12 = byId('ai-12');
assert(s06 && ai12, 'shared game slides exist');
assert.deepEqual(fields(s06), ['f0001', 'f0002'], 'S06 keeps its two editable fields');
assert.deepEqual(fields(ai12), ['f0001'], 'AI-12 keeps its own banner field');
assert.equal(edition.fields['module-s06:text.f0001'], '现场试玩：驾驶同一辆小车 → 碰道具 → 存背包 → 检查过关条件 → 显示结果');
assert.equal(edition.fields['module-s06:text.f0002'], '先玩一遍，再说清：谁收到什么？交给下一块什么？背包满了，谁负责告诉玩家？');
assert.equal(edition.fields['ai-12:text.f0001'], '先试：没有钥匙到终点。再试：丢掉工具腾位，拿钥匙再到终点。局部通过 ≠ 整体通过。');
assert.match(s06.content, /data-car-game/);
assert.match(ai12.content, /data-car-game/);

const preload = await read('route-preload.js');
assert.match(preload, /function paint\(stage, markup\)/);
assert.match(preload, /gameSlides = new Set\(\['module-s06','ai-12'\]\)/);
assert.match(preload, /frame\.parentElement/);
assert.match(preload, /frame\.src = url\.href/);
assert.match(preload, /paint,create/);

for (const file of ['deck-runtime.js', 'presenter-runtime.js']) {
  const source = await read(file);
  assert.match(source, /MSVRoutePreload\.paint\(cached,slideMarkup/, `${file} paints cached shell`);
  const paintAt = source.indexOf('MSVRoutePreload.paint(cached,slideMarkup');
  const decorateAt = Math.max(source.indexOf('textEdits?.decorate(deck', paintAt), source.indexOf('textEdits?.decorate(cached', paintAt));
  assert.ok(paintAt >= 0 && decorateAt > paintAt, `${file} decorates after paint`);
}

const presenter = await read('presenter-runtime.js');
assert.match(presenter, /renderPreview\(document\.getElementById\("next-preview"\), state\.slide \+ 1, 0\)/, 'next preview remains non-interactive');
assert.doesNotMatch(presenter, /renderPreview\(document\.getElementById\("next-preview"\), state\.slide \+ 1, 0, true\)/);
const previewBlock = presenter.slice(presenter.indexOf('function renderPreview'), presenter.indexOf('function renderPreview') + 2200);
assert.match(previewBlock, /interactive\?gamePreload|interactive&&/, 'game src is only set for interactive previews');
assert.match(presenter, /gameFrame\.src\s*=\s*url\.href/);
console.log('shared-shell: PASS');
