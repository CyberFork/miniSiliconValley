import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const box = { window: {} };
vm.runInNewContext(await readFile(new URL('deck-data.js', root), 'utf8'), box, { filename: 'deck-data.js' });
const deck = box.window.MSV_MODULE_DECK;
assert.equal(deck.slides.length, 41, 'deck target is 39 slides');
assert.equal(deck.slides.reduce((sum, slide) => sum + Number(slide.minutes || 0), 0), 240);
const p1 = deck.slides.filter((slide) => !String(slide.phase).startsWith('AI ·'));
const ai = deck.slides.filter((slide) => String(slide.phase).startsWith('AI ·'));
assert.equal(p1.length, 25); assert.equal(p1.reduce((n, s) => n + Number(s.minutes || 0), 0), 120);
assert.equal(ai.length, 14); assert.equal(ai.reduce((n, s) => n + Number(s.minutes || 0), 0), 120);

const byId = (id) => deck.slides.find((slide) => slide.id === id);
const how00 = byId('module-minecraft-map');
const start = byId('module-my-start');
const how02 = byId('module-my-map');
const s12 = byId('module-s12');
assert(how00 && start && how02 && s12, 'HOW-00, HOW-01, HOW-02 and S12 remain present');
assert.equal(how00.source, 'HOW-00');
assert(deck.slides.indexOf(how00) < deck.slides.indexOf(start), 'HOW-00 precedes HOW-01');

const fields = (html) => [...html.matchAll(/data-msv-field="([^"]+)"/g)].map((m) => m[1]);
for (const [slide, max] of [[start, 28], [how02, 32]]) {
  const ids = fields(slide.content);
  assert.equal(new Set(ids).size, ids.length, `${slide.id} fields unique`);
  for (let i = 1; i <= max; i++) assert.equal(ids.filter((id) => id === `f${String(i).padStart(4, '0')}`).length, 1);
}
assert.equal(new Set(fields(s12.content)).size, fields(s12.content).length, 'S12 fields remain unique');
for(let i=1;i<=45;i++)assert.equal(fields(s12.content).filter(id=>id===`f${String(i).padStart(4,'0')}`).length,1,'S12 keeps each historical editable field');
for (const token of ['s12-tab-move', 's12-tab-pickup', 's12-tab-bag', 's12-tab-finish', 'data-module-3d="car-modules"']) assert.match(s12.content, new RegExp(token));

function maps(slide) {
  const html = slide.content;
  const maps = [...html.matchAll(/<[^>]*data-game-map[^>]*>[\s\S]*?<\/[^>]+>/g)].map((m) => m[0]);
  assert(maps.length >= 1, `${slide.id} has a game map`);
  return html;
}
function checkMap(html, label, requiredModules) {
  const modules = [...html.matchAll(/data-map-module="([^"]+)"/g)].map((m) => m[1]);
  const paths = [...html.matchAll(/data-map-path="([^"]+)"[^>]*data-modules="([^"]+)"/g)];
  assert(modules.length >= requiredModules, `${label} has enough modules`);
  assert.equal(new Set(modules).size, modules.length, `${label} draws each shared module once`);
  assert(paths.length >= 4, `${label} has paths`);
  const known = new Set(modules);
  const refs = paths.flatMap((m) => m[2].split(/\s+/).filter(Boolean));
  for (const ref of refs) assert(known.has(ref), `${label} path references existing module ${ref}`);
  assert(modules.some((mod) => paths.filter((p) => p[2].split(/\s+/).includes(mod)).length >= 2), `${label} has shared dependency`);
  assert.match(html, /<button[^>]*data-map-module=/, `${label} module controls are buttons`);
  assert.match(html, /<button[^>]*data-map-path=/, `${label} path controls are buttons`);
  return { modules, paths };
}
const m00 = checkMap(maps(how00), 'HOW-00', 6);
assert(m00.paths.length >= 4);
const bag = m00.modules.find((m) => /bag|inventory|背包/i.test(m));
assert(bag && m00.paths.filter((p) => p[2].split(/\s+/).includes(bag)).length >= 2, 'HOW-00 reuses bag across paths');
const m12 = checkMap(maps(s12), 'S12', 6);
for (const key of ['move', 'terrain', 'pickup', 'bag', 'hint', 'finish']) assert(m12.modules.includes(key), `S12 module ${key}`);
for (const key of ['move', 'pickup', 'carry', 'finish']) assert.match(s12.content, new RegExp(`data-map-path="${key}"`));

// Lightweight behavior check for the shared map controls (no browser required).
const toolsBox = { window: {}, document: { documentElement: { dataset: {} } }, URL, location: { href: 'http://localhost/' }, addEventListener() {}, setInterval() {} };
vm.runInNewContext(await readFile(new URL('lesson-tools.js', root), 'utf8'), toolsBox);
const node = (attrs = {}) => ({ dataset: attrs, classList: { values: new Set(), toggle(name, on) { on ? this.values.add(name) : this.values.delete(name); } }, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, addEventListener(k, fn) { this[k] = fn; }, hasAttribute(k) { return Object.hasOwn(this.dataset, k); } });
const modules = ['move', 'bag', 'finish'].map((mapModule) => node({ mapModule }));
const paths = [node({ mapPath: 'pickup', modules: 'move bag' }), node({ mapPath: 'finish', modules: 'move bag finish' })];
const reset = node({ 'data-map-reset': '' });
const map = { querySelectorAll(selector) { if (selector === '[data-map-module]') return modules; if (selector === '[data-map-path]') return paths; if (selector === '[data-map-edge]') return []; return []; } };
const fake = { querySelectorAll(selector) { return selector === '[data-game-map]' ? [map] : [...modules, ...paths, reset]; } };
const gameTools = toolsBox.window.MSVLessonTools;
gameTools.paintGameMap(fake, 'path:pickup');
assert.deepEqual([...modules].filter((n) => n.classList.values.has('map-related')), [modules[0], modules[1]]);
gameTools.paintGameMap(fake, 'module:bag');
assert(paths.every((n) => n.classList.values.has('map-related')), 'module focus highlights all using paths');
gameTools.paintGameMap(fake, 'bogus');
assert(modules.every((n) => n.classList.values.has('map-related')) && paths.every((n) => n.classList.values.has('map-related')), 'invalid focus resets map');
let selected = null;
gameTools.wireGameMap(fake, 'all', (value) => { selected = value; });
paths[0].click({ stopPropagation() {} }); assert.equal(selected, 'path:pickup');
reset.click({ stopPropagation() {} }); assert.equal(selected, 'all');
gameTools.wireGameMap(fake, 'all', null);
assert([...modules, ...paths, reset].every((n) => n.disabled), 'null onSelect disables controls');
console.log('verify-game-module-map: PASS');
